from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import Actor, get_actor, require_admin
from app.core.config import settings
from app.core.database import get_db
from app.modules.audit.models import AuditRecord, write_audit
from app.modules.couriers.models import DeliveryPartner
from app.modules.groceries.models import GroceryLine, GroceryOrder, Product
from app.modules.operations.models import CustomerProfile
from app.modules.parcels.models import Parcel, ParcelEvent
from app.modules.commerce.schemas import CatalogContent
from app.modules.commerce.service import require_live_orders

router = APIRouter()
admin = APIRouter(prefix="/admin", dependencies=[Depends(require_admin)])


class CheckoutDefaults(BaseModel):
    model_config = ConfigDict(extra="forbid")
    address_line: str = Field(default="", max_length=300)
    area: str = Field(default="", max_length=120)
    city: str = Field(default="Dhaka", max_length=80)
    postal_code: str = Field(default="", max_length=20)
    instructions: str = Field(default="", max_length=1000)
    preparation_notes: str = Field(default="", max_length=500)
    payment_method: Literal["cod", "bkash", "nagad", "rocket", "bank"] = "cod"


class ProfileEdit(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(default="", max_length=20, pattern=r"^[+0-9 ()-]*$")
    language: Literal["en", "bn"] = "en"
    checkout_defaults: CheckoutDefaults | None = None


class ProductEdit(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name_en: str = Field(min_length=1, max_length=160)
    name_bn: str = Field(min_length=1, max_length=160)
    category: Literal["fresh", "dry"]
    unit: str = Field(min_length=1, max_length=20)
    price_bdt: Decimal = Field(ge=0, le=1000000, decimal_places=2)
    processing_fee_bdt: Decimal = Field(ge=0, le=1000000, decimal_places=2)
    stock_qty: Decimal = Field(ge=0, le=1000000, decimal_places=3)
    active: bool = True
    price_approved: bool = False
    details: CatalogContent = Field(default_factory=CatalogContent)


def row(value):
    from zoneinfo import ZoneInfo
    def normalized(column):
        data=getattr(value,column)
        if isinstance(data,datetime) and data.tzinfo is None:
            return data.replace(tzinfo=ZoneInfo("Asia/Dhaka") if column=="delivery_deadline" else UTC)
        return str(data) if isinstance(data,Decimal) else data
    return {c.name:normalized(c.name) for c in value.__table__.columns}



def profile(db, actor):
    value = db.get(CustomerProfile, actor.subject)
    if value is None:
        value = CustomerProfile(
            subject=actor.subject, email=actor.email, name=(actor.name or "")[:120]
        )
        db.add(value)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            value=db.get(CustomerProfile,actor.subject)
            if value is None:raise
    return value


@router.get("/account/profile")
def get_profile(
    db: Annotated[Session, Depends(get_db)], actor: Annotated[Actor, Depends(get_actor)]
):
    return row(profile(db, actor))


@router.put("/account/profile")
def save_profile(
    payload: ProfileEdit,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[Actor, Depends(get_actor)],
):
    value = profile(db, actor)
    # Older profile clients must not erase saved checkout defaults.
    for key, data in payload.model_dump(exclude_unset=True).items():
        if key == "checkout_defaults" and data is None:
            continue
        setattr(value, key, data)
    value.email = actor.email
    value.updated_at = datetime.now(UTC)
    db.commit()
    return row(value)


@router.get("/account/history")
def history(
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[Actor, Depends(get_actor)],
    offset: int = Query(0, ge=0),
):
    return {
        "orders": [
            row(v)
            for v in db.scalars(
                select(GroceryOrder)
                .where(GroceryOrder.customer_id == actor.subject)
                .order_by(GroceryOrder.created_at.desc())
                .offset(offset)
                .limit(100)
            )
        ],
        "parcels": [
            row(v)
            for v in db.scalars(
                select(Parcel)
                .where(Parcel.customer_id == actor.subject)
                .order_by(Parcel.created_at.desc())
                .offset(offset)
                .limit(100)
            )
        ],
    }


@admin.get("/dashboard")
def dashboard(db: Annotated[Session, Depends(get_db)]):
    return {
        "counts": {
            m.__tablename__: db.scalar(select(func.count()).select_from(m))
            for m in (Product, GroceryOrder, Parcel, DeliveryPartner)
        },
        "environment": settings().app_env,
        "fulfillment_enabled": False,
        "payments_enabled": False,
    }


@admin.get("/session")
def admin_session(actor: Annotated[Actor, Depends(require_admin)]):
    return {"name": actor.name, "email": actor.email, "is_admin": True}


@admin.get("/{collection}")
def records(collection: str, db: Annotated[Session, Depends(get_db)], offset: int = Query(0, ge=0)):
    model = {
        "products": Product,
        "orders": GroceryOrder,
        "parcels": Parcel,
        "couriers": DeliveryPartner,
        "activity": AuditRecord,
    }.get(collection)
    if model is None:
        raise HTTPException(404, "Unknown collection")
    return [
        row(v)
        for v in db.scalars(
            select(model).order_by(*model.__table__.primary_key.columns).offset(offset).limit(100)
        )
    ]


@admin.put("/products/{sku}")
def save_product(
    sku: str,
    payload: ProductEdit,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[Actor, Depends(require_admin)],
):
    if not 1 <= len(sku) <= 50:
        raise HTTPException(422, "Invalid SKU")
    if payload.price_approved and payload.price_bdt <= 0:
        raise HTTPException(422,"An approved product must have a positive selling price")
    if payload.category == "dry" and (payload.processing_fee_bdt != 0 or payload.details.preparation_options):
        raise HTTPException(422, "Dry groceries cannot have preparation fees")
    product = db.scalar(select(Product).where(Product.sku == sku).with_for_update())
    if product is None:
        product = Product(sku=sku)
        db.add(product)
    for key, value in payload.model_dump(mode="json").items():
        setattr(product, key, value)
    write_audit(
        db,
        actor_id=actor.subject,
        action="product.saved",
        entity_type="product",
        entity_id=sku,
        request_id=request.state.request_id,
    )
    db.commit()
    return row(product)


@admin.get("/orders/{order_id}")
def order_detail(order_id: str, db: Annotated[Session, Depends(get_db)]):
    order = db.get(GroceryOrder, order_id)
    if order is None:
        raise HTTPException(404, "Order not found")
    return {
        **row(order),
        "items": [
            row(v) for v in db.scalars(select(GroceryLine).where(GroceryLine.order_id == order_id))
        ],
    }


class Assignment(BaseModel):
    courier_id: str = Field(min_length=1, max_length=36)


class ParcelStatus(BaseModel):
    status: Literal["picked_up", "in_transit", "delivered", "cancelled"]


class OrderStatus(BaseModel):
    status: Literal["preparing", "ready", "dispatched", "delivered"]


def fulfillment_guard():
    require_live_orders()
    if settings().app_env == "preview":
        raise HTTPException(503, "Preview fulfillment is disabled")


@admin.post("/parcels/{parcel_id}/assignment", dependencies=[Depends(fulfillment_guard)])
def assign(
    parcel_id: str,
    payload: Assignment,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[Actor, Depends(require_admin)],
):
    parcel = db.scalar(select(Parcel).where(Parcel.id == parcel_id).with_for_update())
    courier = db.get(DeliveryPartner, payload.courier_id)
    if parcel is None:
        raise HTTPException(404, "Parcel not found")
    if courier is None or courier.status != "approved" or (settings().app_env not in ("test","local") and not (courier.details.get("active") and courier.details.get("identity_verified") and courier.details.get("documents_verified") and parcel.sender["city"].lower() in [c.lower() for c in courier.details.get("service_cities",[])])):
        raise HTTPException(422, "An approved courier is required")
    if parcel.status not in ("created", "assigned"):
        raise HTTPException(409, "Parcel cannot be assigned in this state")
    parcel.courier_id = courier.id
    parcel.status = "assigned"
    db.add(ParcelEvent(parcel_id=parcel.id, actor_id=actor.subject, event_type="assigned"))
    write_audit(
        db,
        actor_id=actor.subject,
        action="parcel.assigned",
        entity_type="parcel",
        entity_id=parcel.id,
        request_id=request.state.request_id,
        details={"courier_id": courier.id},
    )
    db.commit()
    return row(parcel)


@admin.post("/parcels/{parcel_id}/status", dependencies=[Depends(fulfillment_guard)])
def parcel_status(
    parcel_id: str,
    payload: ParcelStatus,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[Actor, Depends(require_admin)],
):
    parcel = db.scalar(select(Parcel).where(Parcel.id == parcel_id).with_for_update())
    if parcel is None:
        raise HTTPException(404, "Parcel not found")
    transitions = {
        "created": {"cancelled"},
        "assigned": {"picked_up", "cancelled"},
        "picked_up": {"in_transit"},
        "in_transit": {"delivered"},
    }
    if payload.status not in transitions.get(parcel.status, set()):
        raise HTTPException(409, "Invalid parcel status transition")
    parcel.status = payload.status
    db.add(ParcelEvent(parcel_id=parcel.id, actor_id=actor.subject, event_type=payload.status))
    db.commit()
    return row(parcel)


@admin.post("/orders/{order_id}/status", dependencies=[Depends(fulfillment_guard)])
def order_status(
    order_id: str,
    payload: OrderStatus,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[Actor, Depends(require_admin)],
):
    if settings().app_env not in ("local","test"):
        raise HTTPException(409,"Use the reviewed commerce fulfillment workflow")
    order = db.scalar(select(GroceryOrder).where(GroceryOrder.id == order_id).with_for_update())
    if order is None:
        raise HTTPException(404, "Order not found")
    transitions = {
        "placed": "preparing",
        "preparing": "ready",
        "ready": "dispatched",
        "dispatched": "delivered",
    }
    if transitions.get(order.status) != payload.status:
        raise HTTPException(409, "Invalid order status transition")
    order.status = payload.status
    write_audit(
        db,
        actor_id=actor.subject,
        action="grocery.status_changed",
        entity_type="grocery_order",
        entity_id=order.id,
        request_id=request.state.request_id,
        details={"status": payload.status},
    )
    db.commit()
    return row(order)


class CourierEdit(BaseModel):
    model_config = ConfigDict(extra="forbid")
    actor_id: str = Field(min_length=1, max_length=128)
    transport_mode: Literal["walk", "bicycle", "motorcycle", "car", "van", "bus", "other"]
    status: Literal["pending", "approved", "suspended"] = "pending"


@admin.put("/couriers/{courier_id}")
def save_courier(
    courier_id: str,
    payload: CourierEdit,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[Actor, Depends(require_admin)],
):
    if len(courier_id) > 36:
        raise HTTPException(422, "Invalid courier ID")
    from sqlalchemy.exc import IntegrityError

    courier = db.scalar(
        select(DeliveryPartner).where(DeliveryPartner.id == courier_id).with_for_update()
    )
    if courier is None:
        courier = DeliveryPartner(id=courier_id)
        db.add(courier)
    elif courier.actor_id != payload.actor_id:
        raise HTTPException(409, "Courier identity cannot be changed")
    courier.actor_id = payload.actor_id
    courier.transport_mode = payload.transport_mode
    courier.status = payload.status
    courier.approved_by = actor.subject if payload.status == "approved" else None
    courier.approved_at = datetime.now(UTC) if payload.status == "approved" else None
    write_audit(
        db,
        actor_id=actor.subject,
        action="courier.saved",
        entity_type="courier",
        entity_id=courier_id,
        request_id=request.state.request_id,
        details={"status": payload.status},
    )
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(409, "Courier identity already registered") from error
    return row(courier)


router.include_router(admin)
