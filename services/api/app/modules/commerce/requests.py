"""No-payment order requests: persistent, customer scoped, no fabricated stock/dispatch."""

import hashlib
import json
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import Actor, get_actor, require_admin
from app.core.database import get_db
from app.modules.commerce.service import event
from app.modules.commerce.models import ServiceSetting
from app.modules.groceries.models import GroceryLine, GroceryOrder, Product
from app.modules.groceries.schemas import CartItem, Recipient
from app.modules.groceries.scheduling import provisional_deadline

router = APIRouter(prefix="/commerce/order-requests", tags=["Order requests"])
DB = Annotated[Session, Depends(get_db)]
Customer = Annotated[Actor, Depends(get_actor)]


class RequestOrder(BaseModel):
    model_config = ConfigDict(extra="forbid")
    destination: Recipient
    items: list[CartItem] = Field(min_length=1, max_length=50)
    instructions: str = Field(default="", max_length=1000)
    preparation_notes: str = Field(default="", max_length=500)


def price_request(payload, db):
    if len({i.sku for i in payload.items}) != len(payload.items):
        raise HTTPException(422, "Combine duplicate products")
    lines = []
    subtotal = Decimal(0)
    for item in payload.items:
        p = db.get(Product, item.sku)
        if p is None or not p.active:
            raise HTTPException(422, "Product no longer available: " + item.sku)
        if p.category == "dry" and item.preparation != "none":
            raise HTTPException(422, "Preparation applies only to fresh groceries")
        minimum = Decimal(str(p.details.get("minimum_quantity", ".001")))
        step = Decimal(str(p.details.get("quantity_step", ".001")))
        if item.quantity < minimum or item.quantity % step:
            raise HTTPException(422, "Check quantity increments for " + item.sku)
        if item.preparation == "custom" and not payload.preparation_notes.strip():
            raise HTTPException(422, "Please describe your preparation request")
        known = p.price_approved and p.price_bdt > 0
        amount = (p.price_bdt * item.quantity).quantize(Decimal(".01")) if known else Decimal(0)
        subtotal += amount
        lines.append(
            {
                "sku": p.sku,
                "name_en": p.name_en,
                "name_bn": p.name_bn,
                "unit": p.unit,
                "quantity": str(item.quantity),
                "preparation": item.preparation,
                "amount_bdt": str(amount),
                "price_pending": not known,
                "preparation_fee_pending": item.preparation not in ("whole", "none"),
            }
        )
    return {
        "lines": lines,
        "subtotal_bdt": str(subtotal),
        "payment_required": False,
        "delivery_fee_bdt": None,
        "total_bdt": None,
        "quote_pending": True,
        "message": "Item estimate only. Availability, preparation and delivery costs will be confirmed before you accept a final quote. No payment is collected.",
    }


@router.post("/review")
def review_request(payload: RequestOrder, db: DB, actor: Customer):
    return price_request(payload, db)


@router.post("", status_code=201)
def submit_request(
    payload: RequestOrder,
    db: DB,
    actor: Customer,
    idempotency_key: Annotated[str, Header(min_length=8, max_length=120)],
):
    digest = hashlib.sha256(
        json.dumps(payload.model_dump(mode="json"), sort_keys=True).encode()
    ).hexdigest()
    existing = db.scalar(
        select(GroceryOrder).where(
            GroceryOrder.customer_id == actor.subject,
            GroceryOrder.idempotency_key == idempotency_key,
        )
    )

    def result(o):
        return {
            "id": o.id,
            "order_number": o.order_number,
            "status": o.status,
            "payment_status": o.payment_status,
        }

    if existing:
        if existing.request_hash != digest:
            raise HTTPException(409, "This request key belongs to a different basket")
        return result(existing)
    count = db.scalar(
        select(func.count())
        .select_from(GroceryOrder)
        .where(
            GroceryOrder.customer_id == actor.subject,
            GroceryOrder.created_at > datetime.now(UTC) - timedelta(days=1),
        )
    )
    if count >= 20:
        raise HTTPException(429, "Please contact support before submitting further requests today")
    review = price_request(payload, db)
    o = GroceryOrder(
        customer_id=actor.subject,
        order_number="TRR-" + uuid4().hex[:12].upper(),
        idempotency_key=idempotency_key,
        request_hash=digest,
        destination=payload.destination.model_dump(),
        status="requested",
        payment_method="disabled",
        payment_status="not_requested",
        amount_bdt=Decimal(review["subtotal_bdt"]),
        delivery_fee_bdt=0,
        delivery_deadline=provisional_deadline(datetime.now(UTC)),
        checkout_data={
            "mode": "request_only",
            "stock_reserved": False,
            "quote_pending": True,
            "instructions": payload.instructions,
            "preparation_notes": payload.preparation_notes,
            "items": review["lines"],
            "delivery_confirmed": False,
        },
    )
    db.add(o)
    try:
        db.flush()
        for line in review["lines"]:
            db.add(
                GroceryLine(
                    order_id=o.id,
                    sku=line["sku"],
                    quantity=Decimal(line["quantity"]),
                    preparation=line["preparation"],
                    amount_bdt=Decimal(line["amount_bdt"]),
                )
            )
        cart = db.get(
            ServiceSetting, "cart:" + hashlib.sha256(actor.subject.encode()).hexdigest()[:40]
        )
        if cart:
            cart.value = {"items": []}
        event(db, actor, "grocery_order", o.id, "request_submitted", {"payment_collected": False})
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.scalar(
            select(GroceryOrder).where(
                GroceryOrder.customer_id == actor.subject,
                GroceryOrder.idempotency_key == idempotency_key,
            )
        )
        if existing and existing.request_hash == digest:
            return result(existing)
        raise HTTPException(409, "Request changed concurrently; reload and retry")
    return result(o)


class RequestUpdate(BaseModel):
    status: Literal[
        "reviewing",
        "contacted",
        "quoted",
        "confirmed",
        "preparing",
        "packed",
        "assigned",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "rejected",
    ]
    note: str = Field(min_length=3, max_length=1000)
    final_total_bdt: Decimal | None = Field(default=None, gt=0, le=1000000, decimal_places=2)
    accepted_total_bdt: Decimal | None = Field(default=None, gt=0, le=1000000, decimal_places=2)
    courier_id: str | None = Field(default=None, max_length=36)


@router.post("/{order_id}/update")
def update_request(order_id: str, payload: RequestUpdate, db: DB, actor: Customer):
    from app.modules.couriers.models import DeliveryPartner

    o = db.scalar(select(GroceryOrder).where(GroceryOrder.id == order_id).with_for_update())
    if o is None or o.checkout_data.get("mode") != "request_only":
        raise HTTPException(404, "Request not found")
    owner = "admin" in actor.roles
    if not owner:
        if o.customer_id != actor.subject:
            raise HTTPException(404, "Request not found")
        if payload.status == "confirmed":
            if o.status != "quoted" or not o.checkout_data.get("quoted_total_bdt"):
                raise HTTPException(409, "There is no final quote to accept")
            if payload.accepted_total_bdt != Decimal(o.checkout_data["quoted_total_bdt"]):
                raise HTTPException(
                    409, "The quote changed. Reload and review the latest total before accepting."
                )
        elif payload.status != "cancelled":
            raise HTTPException(403, "Only the owner can review requests")
    elif payload.status == "confirmed":
        raise HTTPException(409, "The customer must accept the final quote")
    allowed = {
        "requested": {"reviewing", "contacted", "quoted", "cancelled", "rejected"},
        "reviewing": {"contacted", "quoted", "cancelled", "rejected"},
        "contacted": {"quoted", "cancelled", "rejected"},
        "quoted": {"confirmed", "quoted", "cancelled", "rejected"},
        "confirmed": {"preparing", "cancelled", "rejected"},
        "preparing": {"packed", "cancelled", "rejected"},
        "packed": {"assigned", "cancelled", "rejected"},
        "assigned": {"out_for_delivery", "cancelled"},
        "out_for_delivery": {"delivered"},
    }
    if payload.status not in allowed.get(o.status, set()):
        raise HTTPException(409, "This status change is not available")
    if payload.status == "quoted":
        if payload.final_total_bdt is None:
            raise HTTPException(422, "Enter the final total including preparation and delivery")
        o.checkout_data = {
            **o.checkout_data,
            "quoted_total_bdt": str(payload.final_total_bdt),
            "quote_note": payload.note,
            "quote_pending": False,
        }
        o.amount_bdt = payload.final_total_bdt
    if payload.status == "assigned":
        c = db.get(DeliveryPartner, payload.courier_id) if payload.courier_id else None
        if (
            c is None
            or c.status != "approved"
            or not all(
                c.details.get(k) for k in ("identity_verified", "documents_verified", "active")
            )
            or o.destination["city"].casefold()
            not in [v.casefold() for v in c.details.get("service_cities", [])]
        ):
            raise HTTPException(422, "Choose an active verified courier serving this city")
        o.courier_id = c.id
    o.status = payload.status
    event(
        db,
        actor,
        "grocery_order",
        o.id,
        payload.status,
        {"note": payload.note, "payment_collected": False},
    )
    db.commit()
    return {"status": o.status}
