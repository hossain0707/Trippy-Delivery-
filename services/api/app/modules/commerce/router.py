import hashlib
from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Header
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import Actor, get_actor, require_admin
from app.core.config import settings
from app.core.database import get_db
from app.modules.commerce.models import CommerceEvent, ServiceSetting
from app.modules.commerce.schemas import CatalogContent, PaymentSettings, PilotSettings
from app.modules.commerce.service import (
    delivery,
    event,
    get_setting,
    payment_destination,
    promotion_discount,
    require_live_orders,
)
from app.modules.couriers.models import DeliveryPartner
from app.modules.groceries.models import GroceryLine, GroceryOrder, Product
from app.modules.groceries.schemas import CartItem, Checkout
from app.modules.operations.models import CustomerProfile
from app.modules.operations.router import row

DB = Annotated[Session, Depends(get_db)]
Customer = Annotated[Actor, Depends(get_actor)]
Owner = Annotated[Actor, Depends(require_admin)]
router = APIRouter(prefix="/commerce", tags=["Commerce"])
admin = APIRouter(prefix="/admin/commerce", dependencies=[Depends(require_admin)])


@router.get("/configuration")
def configuration(db: DB):
    c = settings()
    payments = get_setting(db, "payments", PaymentSettings)
    result = {}
    for method in ["bkash", "nagad", "rocket", "bank"]:
        d = getattr(payments, method)
        result[method] = (
            d.model_dump(mode="json")
            if d.enabled and d.verified
            else {
                "enabled": False,
                "verified": False,
                "demo_number": "00000000000",
                "instructions": "Not configured. Do not send money to demonstration numbers.",
            }
        )
    pilot = get_setting(db, "pilot", PilotSettings)
    issues = []
    if c.app_env == "preview" or not (c.live_orders_enabled and c.pilot_approved):
        issues.append("Ordering has not been activated on the server.")
    if not any(
        z.active and z.preparation_ready and z.courier_ready and z.capacity_per_slot > 0
        for z in pilot.zones
    ):
        issues.append("No delivery area has confirmed preparation and courier capacity.")
    if not payments.cod_enabled and not any(
        getattr(payments, name).enabled for name in ("bkash", "nagad", "rocket", "bank")
    ):
        issues.append("No payment method has been configured.")
    return {
        "setup_issues": issues,
        "request_intake_open": False,
        "preview_checkout": c.app_env == "preview",
        "cod_ordering_open": payments.cod_enabled,
        "payments_collected": False,
        "online_payments_enabled": False if c.app_env == "preview" else any(getattr(payments, name).enabled for name in ("bkash", "nagad", "rocket", "bank")),
        "ordering_open": c.app_env != "preview" and c.live_orders_enabled and c.pilot_approved,
        "payments": {"cod": {"enabled": payments.cod_enabled}, **result},
        "pilot": get_setting(db, "pilot", PilotSettings).model_dump(mode="json"),
    }


class Cart(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[CartItem] = Field(default_factory=list, max_length=50)


def cart_key(actor):
    return "cart:" + hashlib.sha256(actor.subject.encode()).hexdigest()[:40]


@router.get("/cart")
def get_cart(db: DB, actor: Customer):
    value = db.get(ServiceSetting, cart_key(actor))
    return value.value if value else {"items": []}


@router.put("/cart")
def save_cart(payload: Cart, db: DB, actor: Customer):
    if len({i.sku for i in payload.items}) != len(payload.items):
        raise HTTPException(422, "Use one preparation option per product per order")
    key = cart_key(actor)
    value = db.get(ServiceSetting, key)
    if value is None:
        value = ServiceSetting(key=key)
        db.add(value)
    value.value = payload.model_dump(mode="json")
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(409, "Cart changed concurrently; reload and retry") from error
    return value.value


@router.post("/review")
def review(payload: Checkout, db: DB, actor: Customer):
    if settings().app_env == "preview":
        from app.modules.commerce.calculator import calculate
        return calculate(payload, db)
    shipping, deadline, confirmed = delivery(db, payload.destination)
    payment_destination(db, payload.payment_method)
    subtotal = Decimal(0)
    lines = []
    if len({i.sku for i in payload.items}) != len(payload.items):
        raise HTTPException(422, "Duplicate product")
    for item in payload.items:
        p = db.get(Product, item.sku)
        if (
            p is None
            or not p.active
            or not p.price_approved
            or p.price_bdt <= 0
            or p.stock_qty < item.quantity
        ):
            raise HTTPException(
                409, "Product unavailable or awaiting owner price approval: " + item.sku
            )
        opts = p.details.get("preparation_options", [])
        option = next(
            (o for o in opts if o["id"] == item.preparation and o.get("enabled", True)), None
        )
        if opts and option is None:
            raise HTTPException(422, "Unavailable preparation")
        if p.category == "dry" and item.preparation != "none":
            raise HTTPException(422, "Dry products do not support fresh preparation")
        minimum = Decimal(str(p.details.get("minimum_quantity", "0.001")))
        step = Decimal(str(p.details.get("quantity_step", "0.001")))
        if item.quantity < minimum or item.quantity % step:
            raise HTTPException(422, "Invalid quantity increment")
        fee = (
            Decimal(str(option["fee_bdt"]))
            if option
            else (
                p.processing_fee_bdt
                if item.preparation in ("cleaned", "cut", "cut-only")
                else Decimal(0)
            )
        )
        amount = ((p.price_bdt + fee) * item.quantity).quantize(Decimal(".01"))
        subtotal += amount
        lines.append(
            {
                "sku": p.sku,
                "quantity": str(item.quantity),
                "preparation": item.preparation,
                "amount_bdt": str(amount),
                "estimated_final_quantity": str(
                    item.quantity
                    * Decimal(str(option.get("yield_percent", 100) if option else 100))
                    / 100
                ),
            }
        )
    discount = promotion_discount(db, payload.promo_code, subtotal)
    return {
        "discount_bdt": str(discount),
        "subtotal_bdt": str(subtotal),
        "delivery_fee_bdt": str(shipping),
        "total_bdt": str(subtotal + shipping - discount),
        "lines": lines,
        "delivery_deadline": deadline,
        "slot_confirmed": confirmed,
        "ordering_open": configuration(db)["ordering_open"],
        "message": "Slot and inventory are checked again when an order is submitted.",
    }


@router.post("/preview-orders", status_code=201)
def preview_checkout(payload: Checkout, db: DB, actor: Customer,
                     idempotency_key: Annotated[str, Header(min_length=8, max_length=120)]):
    if settings().app_env != "preview":
        raise HTTPException(404, "Preview checkout is unavailable")
    if payload.payment_reference:
        raise HTTPException(422, "Payments are disabled")
    from app.modules.commerce.calculator import save_preview
    return save_preview(payload, db, actor, idempotency_key)


@router.get("/orders/{order_id}")
def customer_order(order_id: str, db: DB, actor: Customer):
    o = db.get(GroceryOrder, order_id)
    if o is None or (o.customer_id != actor.subject and "admin" not in actor.roles):
        raise HTTPException(404, "Order not found")
    return {
        **row(o),
        "items": [
            row(l) for l in db.scalars(select(GroceryLine).where(GroceryLine.order_id == o.id))
        ],
        "history": [
            {k: v for k, v in row(e).items() if k != "actor_id"}
            for e in db.scalars(
                select(CommerceEvent)
                .where(
                    CommerceEvent.entity_type == "grocery_order", CommerceEvent.entity_id == o.id
                )
                .order_by(CommerceEvent.created_at, CommerceEvent.id)
            )
        ],
    }


@admin.get("/settings/{key}")
def admin_settings(key: str, db: DB):
    model = {"payments": PaymentSettings, "pilot": PilotSettings}.get(key)
    if model is None:
        raise HTTPException(404, "Unknown setting")
    return get_setting(db, key, model).model_dump(mode="json")


@admin.put("/settings/payments")
def save_payments(payload: PaymentSettings, db: DB, actor: Owner):
    value = db.get(ServiceSetting, "payments")
    if value is None:
        value = ServiceSetting(key="payments")
        db.add(value)
    value.value = payload.model_dump(mode="json")
    event(db, actor, "settings", "payments", "payment_configuration_changed")
    db.commit()
    return {"saved": True}


@admin.put("/settings/pilot")
def save_pilot(payload: PilotSettings, db: DB, actor: Owner):
    value = db.scalar(select(ServiceSetting).where(ServiceSetting.key == "pilot").with_for_update())
    if value is None:
        value = ServiceSetting(key="pilot")
        db.add(value)
    value.value = payload.model_dump(mode="json")
    event(db, actor, "settings", "pilot", "pilot_configuration_changed")
    db.commit()
    return {"saved": True, "ordering_open": configuration(db)["ordering_open"]}


@admin.put("/catalog/{sku}")
def save_content(sku: str, payload: CatalogContent, db: DB, actor: Owner):
    p = db.scalar(select(Product).where(Product.sku == sku).with_for_update())
    if p is None:
        raise HTTPException(404, "Product not found")
    if p.category == "dry" and payload.preparation_options:
        raise HTTPException(422, "Dry goods cannot have fresh preparation options")
    p.details = payload.model_dump(mode="json")
    event(db, actor, "product", sku, "content_changed")
    db.commit()
    return row(p)


class PaymentConfirmation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    received_amount_bdt: Decimal = Field(gt=0, decimal_places=2)
    receipt_reference: str = Field(min_length=3, max_length=120)
    simulate: bool = False


@admin.post("/orders/{order_id}/payment")
def confirm_payment(order_id: str, payload: PaymentConfirmation, db: DB, actor: Owner):
    if payload.simulate and settings().app_env != "test":
        raise HTTPException(
            403, "Simulated payments are restricted to the isolated test environment"
        )
    if not payload.simulate:
        require_live_orders()
    o = db.scalar(select(GroceryOrder).where(GroceryOrder.id == order_id).with_for_update())
    if o is None:
        raise HTTPException(404, "Order not found")
    if o.payment_status in ("paid", "test_paid"):
        raise HTTPException(409, "Payment already confirmed")
    if o.status in ("cancelled", "rejected", "failed"):
        raise HTTPException(409, "Order cannot accept payment confirmation")
    if o.payment_method == "cod" and o.status != "delivered":
        raise HTTPException(409, "Confirm COD collection only after delivery")
    if payload.received_amount_bdt != o.amount_bdt:
        raise HTTPException(422, "Receipt amount does not match order total")
    o.payment_status = "test_paid" if payload.simulate else "paid"
    event(
        db,
        actor,
        "grocery_order",
        o.id,
        "payment_simulated" if payload.simulate else "payment_verified",
        {
            "receipt_reference": payload.receipt_reference,
            "amount_bdt": str(payload.received_amount_bdt),
        },
    )
    db.commit()
    return {"payment_status": o.payment_status}


class Transition(BaseModel):
    status: Literal[
        "pending_review",
        "awaiting_purchase",
        "confirmed",
        "preparing",
        "packed",
        "assigned",
        "out_for_delivery",
        "delivered",
        "rejected",
        "failed",
    ]
    courier_id: str | None = Field(default=None, max_length=36)
    note: str = Field(default="", max_length=500)
    cash_collected_bdt: Decimal | None = Field(default=None, gt=0, le=1000000, decimal_places=2)


@admin.post("/orders/{order_id}/transition")
def transition(order_id: str, payload: Transition, db: DB, actor: Owner):
    from app.modules.commerce.cod import is_cod_order, reserve_stock, collect_cash
    o = db.scalar(select(GroceryOrder).where(GroceryOrder.id == order_id).with_for_update())
    if o is None:
        raise HTTPException(404, "Order not found")
    cod_order = is_cod_order(o)
    if not cod_order:
        require_live_orders()
    allowed = {
        "placed": {"pending_review", "confirmed", "rejected"},
        "pending_review": {"confirmed", "rejected"},
        "quoted": {"rejected"},
        "confirmed": {"preparing", "rejected"},
        "preparing": {"packed", "failed"},
        "packed": {"assigned", "failed"},
        "assigned": {"out_for_delivery", "failed"},
        "out_for_delivery": {"delivered", "failed"},
    }
    if cod_order:
        allowed["placed"].add("awaiting_purchase")
        allowed["pending_review"].add("awaiting_purchase")
        allowed["awaiting_purchase"] = {"rejected"}
        allowed["purchased"] = {"preparing", "rejected"}
    if payload.status not in allowed.get(o.status, set()):
        raise HTTPException(409, "Invalid fulfillment transition")
    if (
        payload.status == "confirmed"
        and o.payment_method != "cod"
        and o.payment_status not in ("paid", "test_paid")
    ):
        raise HTTPException(409, "Manual transfer must be verified before confirming the order")
    if cod_order and payload.status == "awaiting_purchase" and o.checkout_data.get("quote_pending"):
        raise HTTPException(409, "The customer must accept the final price before purchase confirmation")
    if cod_order and payload.status == "confirmed":
        if o.checkout_data.get("quote_pending"):
            raise HTTPException(409, "Send a final quote for customer acceptance before confirmation")
        reserve_stock(db, o)
    if cod_order and payload.status == "delivered":
        if len(payload.note.strip()) < 10:
            raise HTTPException(422, "Record the recipient acknowledgement before completing delivery")
        collect_cash(db, actor, o, payload.cash_collected_bdt, payload.note)
    if payload.status == "assigned":
        c = db.get(DeliveryPartner, payload.courier_id) if payload.courier_id else None
        if (
            c is None
            or c.status != "approved"
            or not c.details.get("identity_verified")
            or not c.details.get("documents_verified")
            or not c.details.get("active")
            or o.destination["city"].lower()
            not in [v.lower() for v in c.details.get("service_cities", [])]
        ):
            raise HTTPException(422, "An active, verified courier covering the city is required")
        o.courier_id = c.id
    if payload.status in ("rejected", "failed") and not payload.note.strip():
        raise HTTPException(422, "A reason is required")
    if payload.status == "rejected" and (not cod_order or o.checkout_data.get("stock_reserved")):
        for line in db.scalars(
            select(GroceryLine).where(GroceryLine.order_id == o.id).order_by(GroceryLine.sku)
        ):
            product = db.scalar(select(Product).where(Product.sku == line.sku).with_for_update())
            product.stock_qty += line.quantity
        if cod_order:
            o.checkout_data = {**o.checkout_data, "stock_reserved": False}
    if payload.status in ("rejected", "failed") and o.payment_status in ("paid", "test_paid"):
        o.payment_status = "refund_required"
    o.status = payload.status
    event(db, actor, "grocery_order", o.id, payload.status, {"note": payload.note})
    db.commit()
    return {"status": o.status, "payment_status": o.payment_status}


class CourierApplication(BaseModel):
    transport_mode: Literal["walk", "bicycle", "motorcycle", "car", "van", "bus", "other"]
    phone: str = Field(min_length=8, max_length=20)
    service_cities: list[str] = Field(min_length=1, max_length=20)
    experience: str = Field(default="", max_length=1000)


@router.post("/courier/application")
def apply_courier(payload: CourierApplication, db: DB, actor: Customer):
    existing = db.scalar(select(DeliveryPartner).where(DeliveryPartner.actor_id == actor.subject))
    if existing:
        raise HTTPException(409, "Application already exists")
    c = DeliveryPartner(
        actor_id=actor.subject,
        transport_mode=payload.transport_mode,
        status="pending",
        details={
            **payload.model_dump(),
            "identity_verified": False,
            "documents_verified": False,
            "active": False,
        },
    )
    db.add(c)
    db.flush()
    event(db, actor, "courier", c.id, "applied")
    db.commit()
    return {"id": c.id, "status": c.status}


class CourierReview(BaseModel):
    status: Literal["pending", "approved", "rejected", "suspended"]
    identity_verified: bool = False
    documents_verified: bool = False
    active: bool = False
    service_cities: list[str] = Field(default_factory=list, max_length=20)
    review_note: str = Field(min_length=3, max_length=500)


@admin.put("/couriers/{courier_id}/review")
def review_courier(courier_id: str, payload: CourierReview, db: DB, actor: Owner):
    c = db.scalar(select(DeliveryPartner).where(DeliveryPartner.id == courier_id).with_for_update())
    if c is None:
        raise HTTPException(404, "Courier not found")
    if payload.status == "approved" and not (
        payload.identity_verified and payload.documents_verified and payload.service_cities
    ):
        raise HTTPException(422, "Verify identity, required documents and service areas first")
    if payload.active and payload.status != "approved":
        raise HTTPException(422, "Only approved couriers can be active")
    c.status = payload.status
    c.details = {**c.details, **payload.model_dump()}
    c.approved_by = actor.subject if payload.status == "approved" else None
    c.approved_at = datetime.now(UTC) if payload.status == "approved" else None
    event(db, actor, "courier", c.id, "reviewed", {"status": c.status, "note": payload.review_note})
    db.commit()
    return {"id": c.id, "status": c.status}


@router.get("/courier/work")
def courier_work(db: DB, actor: Customer):
    from app.modules.parcels.models import Parcel

    c = db.scalar(select(DeliveryPartner).where(DeliveryPartner.actor_id == actor.subject))
    if c is None:
        return {"application": None, "orders": [], "parcels": []}
    orders = db.scalars(
        select(GroceryOrder)
        .where(GroceryOrder.courier_id == c.id)
        .order_by(GroceryOrder.created_at.desc())
        .limit(100)
    ).all()
    parcels = db.scalars(
        select(Parcel)
        .where(Parcel.courier_id == c.id)
        .order_by(Parcel.created_at.desc())
        .limit(100)
    ).all()
    active = (
        c.status == "approved"
        and c.details.get("active")
        and c.details.get("identity_verified")
        and c.details.get("documents_verified")
    )
    return {
        "application": {"id": c.id, "status": c.status},
        "orders": [
            {
                "id": o.id,
                "status": o.status,
                "order_number": o.order_number,
                "payment_method": o.payment_method,
                "payment_status": o.payment_status,
                "amount_bdt": str(o.amount_bdt),
                **(
                    {"destination": o.destination}
                    if active and o.status in ("assigned", "out_for_delivery")
                    else {}
                ),
            }
            for o in orders
        ],
        "parcels": [
            {
                "id": p.id,
                "tracking_code": p.tracking_code,
                "status": p.status,
                **(
                    {"sender": p.sender, "recipient": p.recipient}
                    if active and p.status in ("assigned", "picked_up", "in_transit")
                    else {}
                ),
            }
            for p in parcels
        ],
    }


@admin.get("/customers")
def customers(db: DB, offset: int = Query(0, ge=0)):
    return [
        {
            "subject": c.subject,
            "name": c.name,
            "email": (c.email[:2] + "***@" + c.email.split("@")[-1]) if c.email else None,
            "phone": ("***" + c.phone[-4:]) if c.phone else "",
            "language": c.language,
        }
        for c in db.scalars(
            select(CustomerProfile).order_by(CustomerProfile.subject).offset(offset).limit(100)
        )
    ]


@admin.get("/events")
def events(db: DB, offset: int = Query(0, ge=0)):
    return [
        row(e)
        for e in db.scalars(
            select(CommerceEvent)
            .order_by(CommerceEvent.created_at.desc())
            .offset(offset)
            .limit(100)
        )
    ]


class CourierUpdate(BaseModel):
    entity: Literal["grocery", "parcel"]
    record_id: str = Field(min_length=1, max_length=36)
    status: Literal["picked_up", "in_transit", "out_for_delivery", "delivered", "failed"]
    note: str = Field(min_length=3, max_length=500)
    cash_collected_bdt: Decimal | None = Field(default=None, gt=0, le=1000000, decimal_places=2)


@router.post("/courier/update")
def courier_update(payload: CourierUpdate, db: DB, actor: Customer):
    from app.modules.parcels.models import Parcel, ParcelEvent

    c = db.scalar(select(DeliveryPartner).where(DeliveryPartner.actor_id == actor.subject))
    if (
        c is None
        or c.status != "approved"
        or not c.details.get("active")
        or not c.details.get("identity_verified")
        or not c.details.get("documents_verified")
    ):
        raise HTTPException(403, "Active verified courier access required")
    model = GroceryOrder if payload.entity == "grocery" else Parcel
    record = db.scalar(
        select(model)
        .where(model.id == payload.record_id, model.courier_id == c.id)
        .with_for_update()
    )
    if record is None:
        raise HTTPException(404, "Assignment not found")
    request_only = (
        record.checkout_data.get("mode") == "request_only"
        if payload.entity == "grocery"
        else record.package.get("request_only", False)
    )
    from app.modules.commerce.cod import is_cod_order, collect_cash
    cod_order = payload.entity == "grocery" and is_cod_order(record)
    if not request_only and not cod_order:
        require_live_orders()
    allowed = {
        "assigned": (
            {"out_for_delivery", "failed"}
            if payload.entity == "grocery"
            else {"picked_up", "failed"}
        ),
        "picked_up": {"in_transit", "failed"},
        "in_transit": {"delivered", "failed"},
        "out_for_delivery": {"delivered", "failed"},
    }
    if payload.status not in allowed.get(record.status, set()):
        raise HTTPException(409, "Invalid assignment update")
    if payload.status == "delivered" and len(payload.note.strip()) < 10:
        raise HTTPException(
            422, "Record the recipient acknowledgement or delivery exception details"
        )
    if cod_order and payload.status == "delivered":
        if len(payload.note.strip()) < 10:
            raise HTTPException(422, "Record the recipient acknowledgement before completing delivery")
        collect_cash(db, actor, record, payload.cash_collected_bdt, payload.note)
    record.status = payload.status
    if payload.entity == "parcel":
        db.add(ParcelEvent(parcel_id=record.id, actor_id=actor.subject, event_type=payload.status))
    elif payload.status == "failed" and record.payment_status in ("paid", "test_paid"):
        record.payment_status = "refund_required"
    event(
        db,
        actor,
        "grocery_order" if payload.entity == "grocery" else "parcel",
        record.id,
        payload.status,
        {"note": payload.note},
    )
    db.commit()
    return {"status": record.status}


@admin.get("/catalog")
def owner_catalog(db: DB, offset: int = Query(0, ge=0)):
    return [
        row(p)
        for p in db.scalars(select(Product).order_by(Product.name_en).offset(offset).limit(500))
    ]
