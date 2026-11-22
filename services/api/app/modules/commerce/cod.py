"""COD intake: persisted orders, explicit final-price acceptance and cash receipts."""

import hashlib
import json
from decimal import Decimal
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import Actor, get_actor, require_admin
from app.core.database import get_db
from app.modules.commerce.calculator import calculate
from app.modules.commerce.models import ServiceSetting
from app.modules.commerce.schemas import PaymentSettings
from app.modules.commerce.service import event, get_setting
from app.modules.groceries.models import GroceryLine, GroceryOrder, Product
from app.modules.groceries.schemas import Checkout

router = APIRouter(tags=["Cash on delivery"])
DB = Annotated[Session, Depends(get_db)]
Customer = Annotated[Actor, Depends(get_actor)]
Owner = Annotated[Actor, Depends(require_admin)]


def require_cod(db):
    if not get_setting(db, "payments", PaymentSettings).cod_enabled:
        raise HTTPException(503, "Cash on delivery ordering is currently closed")


def is_cod_order(order):
    return order.payment_method == "cod" and order.checkout_data.get("mode") == "cod_order"


def reserve_stock(db, order):
    if order.checkout_data.get("stock_reserved"):
        return
    lines = db.scalars(
        select(GroceryLine).where(GroceryLine.order_id == order.id).order_by(GroceryLine.sku)
    ).all()
    products = []
    for line in lines:
        p = db.scalar(
            select(Product)
            .where(Product.sku == line.sku)
            .execution_options(populate_existing=True)
            .with_for_update()
        )
        if p is None or not p.active or p.stock_qty < line.quantity:
            raise HTTPException(
                409, "Update verified available inventory before confirming: " + line.sku
            )
        products.append((p, line))
    for product, line in products:
        product.stock_qty -= line.quantity
    order.checkout_data = {**order.checkout_data, "stock_reserved": True}


def collect_cash(db, actor, order, amount, note):
    if amount is None or amount != order.amount_bdt:
        raise HTTPException(
            422, "Confirm the exact cash amount collected before completing COD delivery"
        )
    if order.checkout_data.get("quote_pending") or order.payment_status != "unpaid":
        raise HTTPException(409, "The final price must be accepted and payment must be unpaid")
    order.payment_status = "paid"
    event(
        db,
        actor,
        "grocery_order",
        order.id,
        "cod_cash_collected",
        {"amount_bdt": str(amount), "note": note},
    )


@router.post("/commerce/cod-orders", status_code=201)
def place_cod(
    payload: Checkout,
    db: DB,
    actor: Customer,
    idempotency_key: Annotated[str, Header(min_length=8, max_length=120)],
):
    require_cod(db)
    if payload.payment_method != "cod" or payload.payment_reference:
        raise HTTPException(
            422, "Only cash on delivery is accepted here; do not send an online payment"
        )
    digest = hashlib.sha256(
        json.dumps(payload.model_dump(mode="json"), sort_keys=True).encode()
    ).hexdigest()

    def prior():
        return db.scalar(
            select(GroceryOrder).where(
                GroceryOrder.customer_id == actor.subject,
                GroceryOrder.idempotency_key == idempotency_key,
            )
        )

    def result(order):
        if order.request_hash != digest or not is_cod_order(order):
            raise HTTPException(409, "Checkout key belongs to a different order")
        return {
            "id": order.id,
            "order_number": order.order_number,
            "status": order.status,
            "payment_status": order.payment_status,
            "quote_pending": order.checkout_data.get("quote_pending", False),
        }

    existing = prior()
    if existing:
        return result(existing)
    # Serialize tariff changes and concurrent checkouts while taking the price snapshot.
    db.scalar(select(ServiceSetting).where(ServiceSetting.key == "pilot").with_for_update())
    review = calculate(payload, db)
    pending = bool(review["pending"])
    total = Decimal(review["total_bdt"]) if not pending else None
    if total is not None and payload.expected_total_bdt != total:
        raise HTTPException(
            409, "Prices changed. Review the latest total before placing your order"
        )
    # Do not silently switch a reviewed fixed total to an unpriced order.
    if pending and payload.expected_total_bdt is not None:
        raise HTTPException(409, "Pricing now requires store confirmation. Review again")
    order = GroceryOrder(
        customer_id=actor.subject,
        order_number="TRC-" + uuid4().hex[:12].upper(),
        idempotency_key=idempotency_key,
        request_hash=digest,
        destination=payload.destination.model_dump(),
        status="placed",
        payment_method="cod",
        payment_status="unpaid",
        amount_bdt=total
        if total is not None
        else Decimal(review["known_subtotal_bdt"]) + Decimal(review["delivery_fee_bdt"] or "0"),
        delivery_fee_bdt=Decimal(review["delivery_fee_bdt"] or "0"),
        delivery_deadline=review["delivery_deadline"],
        checkout_data={
            "mode": "cod_order",
            "quote_pending": pending,
            "stock_reserved": False,
            "instructions": payload.instructions,
            "preparation_notes": payload.preparation_notes,
            "item_snapshots": review["lines"],
            "calculation": {k: v for k, v in review.items() if k != "delivery_deadline"},
            "accepted_total_bdt": str(total) if total is not None else None,
            "slot_confirmed": False,
        },
    )
    try:
        db.add(order)
        db.flush()
        for line in review["lines"]:
            db.add(
                GroceryLine(
                    order_id=order.id,
                    sku=line["sku"],
                    quantity=Decimal(line["quantity"]),
                    preparation=line["preparation"],
                    amount_bdt=Decimal(line["amount_bdt"]),
                )
            )
        event(db, actor, "grocery_order", order.id, "cod_order_placed", {"quote_pending": pending})
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = prior()
        if existing:
            return result(existing)
        raise HTTPException(409, "Checkout changed concurrently; retry")
    return result(order)


class FinalQuote(BaseModel):
    model_config = ConfigDict(extra="forbid")
    final_total_bdt: Decimal = Field(gt=0, le=1000000, decimal_places=2)
    note: str = Field(min_length=10, max_length=1000)


@router.post("/admin/commerce/cod-orders/{order_id}/quote")
def quote_cod(order_id: str, payload: FinalQuote, db: DB, actor: Owner):
    order = db.scalar(select(GroceryOrder).where(GroceryOrder.id == order_id).with_for_update())
    if order is None or not is_cod_order(order):
        raise HTTPException(404, "COD order not found")
    if order.status not in ("placed", "pending_review", "quoted"):
        raise HTTPException(409, "A confirmed order cannot be repriced")
    order.amount_bdt = payload.final_total_bdt
    order.status = "quoted"
    order.checkout_data = {
        **order.checkout_data,
        "quote_pending": True,
        "quoted_total_bdt": str(payload.final_total_bdt),
        "quote_note": payload.note,
        "accepted_total_bdt": None,
    }
    event(
        db,
        actor,
        "grocery_order",
        order.id,
        "final_quote_ready",
        {"total_bdt": str(payload.final_total_bdt), "note": payload.note},
    )
    db.commit()
    return {"status": order.status}


class AcceptQuote(BaseModel):
    model_config = ConfigDict(extra="forbid")
    accepted_total_bdt: Decimal = Field(gt=0, le=1000000, decimal_places=2)


@router.post("/commerce/cod-orders/{order_id}/accept")
def accept_cod(order_id: str, payload: AcceptQuote, db: DB, actor: Customer):
    order = db.scalar(
        select(GroceryOrder)
        .where(GroceryOrder.id == order_id, GroceryOrder.customer_id == actor.subject)
        .with_for_update()
    )
    if order is None or not is_cod_order(order):
        raise HTTPException(404, "COD order not found")
    if order.status != "quoted" or payload.accepted_total_bdt != order.amount_bdt:
        raise HTTPException(409, "Reload and accept the latest final quote")
    stock = stock_availability(db, order)
    if any(not item["active"] for item in stock["items"]):
        raise HTTPException(
            409, "A product is no longer active. Contact the store before accepting"
        )
    if stock["can_confirm"] or all(
        i["active"] and Decimal(i["shortfall"]) == 0 for i in stock["items"]
    ):
        reserve_stock(db, order)
        order.status = "confirmed"
    else:
        order.status = "awaiting_purchase"
    order.checkout_data = {
        **order.checkout_data,
        "quote_pending": False,
        "accepted_total_bdt": str(payload.accepted_total_bdt),
    }
    event(
        db,
        actor,
        "grocery_order",
        order.id,
        "final_quote_accepted",
        {"total_bdt": str(payload.accepted_total_bdt)},
    )
    db.commit()
    return {"status": order.status, "payment_status": order.payment_status}


@router.post("/commerce/cod-orders/{order_id}/cancel")
def cancel_cod(order_id: str, db: DB, actor: Customer):
    order = db.scalar(
        select(GroceryOrder)
        .where(GroceryOrder.id == order_id, GroceryOrder.customer_id == actor.subject)
        .with_for_update()
    )
    if order is None or not is_cod_order(order):
        raise HTTPException(404, "COD order not found")
    if order.status == "cancelled":
        return {"status": order.status}
    if order.status not in (
        "placed",
        "pending_review",
        "quoted",
        "confirmed",
        "awaiting_purchase",
        "purchased",
    ):
        raise HTTPException(409, "Preparation has started; contact support to request cancellation")
    if order.checkout_data.get("stock_reserved"):
        for line in db.scalars(
            select(GroceryLine).where(GroceryLine.order_id == order.id).order_by(GroceryLine.sku)
        ):
            product = db.scalar(
                select(Product)
                .where(Product.sku == line.sku)
                .execution_options(populate_existing=True)
                .with_for_update()
            )
            product.stock_qty += line.quantity
        order.checkout_data = {**order.checkout_data, "stock_reserved": False}
    order.status = "cancelled"
    event(db, actor, "grocery_order", order.id, "cancelled")
    db.commit()
    return {"status": order.status}


def stock_availability(db, order):
    reserved = bool(order.checkout_data.get("stock_reserved"))
    lines = []
    for line in db.scalars(
        select(GroceryLine).where(GroceryLine.order_id == order.id).order_by(GroceryLine.sku)
    ):
        p = db.get(Product, line.sku)
        available = p.stock_qty if p else Decimal(0)
        lines.append(
            {
                "sku": line.sku,
                "name_en": p.name_en if p else line.sku,
                "name_bn": p.name_bn if p else line.sku,
                "unit": p.unit if p else "",
                "required": str(line.quantity),
                "available": str(available),
                "shortfall": str(
                    Decimal(0) if reserved else max(Decimal(0), line.quantity - available)
                ),
                "active": bool(p and p.active),
                "reserved": reserved,
            }
        )
    return {
        "items": lines,
        "stock_reserved": reserved,
        "can_confirm": not order.checkout_data.get("quote_pending")
        and all(l["active"] and Decimal(l["shortfall"]) == 0 for l in lines),
        "quote_pending": bool(order.checkout_data.get("quote_pending")),
    }


@router.get("/admin/commerce/cod-orders/{order_id}/availability")
def availability(order_id: str, db: DB, actor: Owner):
    order = db.get(GroceryOrder, order_id)
    if order is None or not is_cod_order(order):
        raise HTTPException(404, "COD order not found")
    return stock_availability(db, order)


class StockCount(BaseModel):
    model_config = ConfigDict(extra="forbid")
    available_qty: Decimal = Field(ge=0, le=1000000, decimal_places=3)
    expected_qty: Decimal = Field(ge=0, le=1000000, decimal_places=3)
    verified: bool
    note: str = Field(min_length=3, max_length=500)


@router.put("/admin/commerce/catalog/{sku}/stock")
def count_stock(sku: str, payload: StockCount, db: DB, actor: Owner):
    if not payload.verified:
        raise HTTPException(422, "Confirm this is actual verified available stock")
    p = db.scalar(select(Product).where(Product.sku == sku).with_for_update())
    if p is None:
        raise HTTPException(404, "Product not found")
    if p.stock_qty != payload.expected_qty:
        raise HTTPException(409, "Stock changed. Refresh availability before saving a new count")
    p.stock_qty = payload.available_qty
    event(
        db,
        actor,
        "product",
        sku,
        "stock_count_verified",
        {
            "previous": str(payload.expected_qty),
            "available": str(p.stock_qty),
            "note": payload.note,
        },
    )
    db.commit()
    return {"stock_qty": str(p.stock_qty)}


class ReceiptLine(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sku: str = Field(min_length=1, max_length=50)
    quantity: Decimal = Field(ge=0, le=1000000, decimal_places=3)


class PurchaseReceipt(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[ReceiptLine] = Field(min_length=1, max_length=50)
    verified: bool
    note: str = Field(min_length=3, max_length=500)


@router.post("/admin/commerce/cod-orders/{order_id}/purchase")
def receive_purchase(order_id: str, payload: PurchaseReceipt, db: DB, actor: Owner):
    if not payload.verified:
        raise HTTPException(
            422, "Verify the goods were actually received before recording a purchase"
        )
    digest = hashlib.sha256(
        json.dumps(payload.model_dump(mode="json"), sort_keys=True).encode()
    ).hexdigest()
    order = db.scalar(select(GroceryOrder).where(GroceryOrder.id == order_id).with_for_update())
    if order is None or not is_cod_order(order):
        raise HTTPException(404, "COD order not found")
    if order.checkout_data.get("purchase_receipt_hash") == digest:
        return {"status": order.status, "payment_status": order.payment_status}
    if order.status != "awaiting_purchase" or order.checkout_data.get("quote_pending"):
        raise HTTPException(409, "Only an accepted order awaiting purchase can receive goods")
    required = db.scalars(
        select(GroceryLine).where(GroceryLine.order_id == order.id).order_by(GroceryLine.sku)
    ).all()
    quantities = {i.sku: i.quantity for i in payload.items}
    if len(quantities) != len(payload.items) or set(quantities) != {l.sku for l in required}:
        raise HTTPException(422, "Provide one received quantity for every ordered product")
    locked = []
    for line in required:
        p = db.scalar(
            select(Product)
            .where(Product.sku == line.sku)
            .execution_options(populate_existing=True)
            .with_for_update()
        )
        if p is None or not p.active or p.stock_qty + quantities[line.sku] < line.quantity:
            raise HTTPException(
                409, "Received goods plus available stock do not cover: " + line.sku
            )
        locked.append(p)
    for p in locked:
        p.stock_qty += quantities[p.sku]
    reserve_stock(db, order)
    order.status = "purchased"
    order.checkout_data = {
        **order.checkout_data,
        "purchase_receipt_hash": digest,
        "purchase_receipt": payload.model_dump(mode="json"),
    }
    event(
        db,
        actor,
        "grocery_order",
        order.id,
        "purchased",
        {"note": payload.note, "items": payload.model_dump(mode="json")["items"]},
    )
    db.commit()
    return {"status": order.status, "payment_status": order.payment_status}
