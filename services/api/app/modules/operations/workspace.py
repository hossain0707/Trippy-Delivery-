"""Owner-only, paginated operational views. No sample data or internal request hashes."""

from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.auth import require_admin
from app.core.database import get_db
from app.modules.commerce.models import CommerceEvent
from app.modules.couriers.models import DeliveryPartner
from app.modules.groceries.models import GroceryOrder, Product
from app.modules.operations.models import CustomerProfile
from app.modules.operations.router import row
from app.modules.parcels.models import Parcel, ParcelEvent

router = APIRouter(prefix="/admin/workspace", dependencies=[Depends(require_admin)])
DB = Annotated[Session, Depends(get_db)]


def order_summary(o, profile=None):
    return {
        "id": o.id,
        "order_number": o.order_number,
        "customer_name": profile.name if profile else o.destination.get("name", "Customer"),
        "area": o.destination.get("area", ""),
        "status": o.status,
        "payment_status": o.payment_status,
        "payment_method": o.payment_method,
        "amount_bdt": str(o.amount_bdt),
        "created_at": row(o)["created_at"],
        "quote_pending": o.checkout_data.get("quote_pending", False),
        "mode": o.checkout_data.get("mode", "legacy"),
    }


@router.get("/overview")
def overview(db: DB):
    live = GroceryOrder.status != "preview"

    def count(*conditions):
        return db.scalar(select(func.count()).select_from(GroceryOrder).where(live, *conditions))

    unpaid = db.scalar(
        select(func.coalesce(func.sum(GroceryOrder.amount_bdt), 0)).where(
            live,
            GroceryOrder.payment_method == "cod",
            GroceryOrder.payment_status == "unpaid",
            GroceryOrder.status.notin_(["cancelled", "rejected", "failed"]),
            func.coalesce(GroceryOrder.checkout_data["quote_pending"].as_boolean(), False).is_(
                False
            ),
        )
    )
    daily = []
    from zoneinfo import ZoneInfo

    today = datetime.now(ZoneInfo("Asia/Dhaka")).date()
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        start = datetime.combine(
            day, datetime.min.time(), tzinfo=ZoneInfo("Asia/Dhaka")
        ).astimezone(UTC)
        daily.append(
            {
                "day": day.isoformat(),
                "orders": count(
                    GroceryOrder.created_at >= start,
                    GroceryOrder.created_at < start + timedelta(days=1),
                ),
            }
        )
    recent = db.scalars(
        select(GroceryOrder).where(live).order_by(GroceryOrder.created_at.desc()).limit(6)
    ).all()
    return {
        "new_orders": count(GroceryOrder.status.in_(["placed", "requested", "pending_review"])),
        "preparing": count(GroceryOrder.status.in_(["confirmed", "preparing", "packed"])),
        "out_for_delivery": count(GroceryOrder.status.in_(["assigned", "out_for_delivery"])),
        "cod_to_collect_bdt": str(unpaid),
        "awaiting_final_price": count(
            GroceryOrder.checkout_data["quote_pending"].as_boolean().is_(True)
        ),
        "low_stock": db.scalar(
            select(func.count())
            .select_from(Product)
            .where(Product.active.is_(True), Product.stock_qty <= 0)
        ),
        "recent_orders": [order_summary(o) for o in recent],
        "daily": daily,
    }


@router.get("/records/{collection}")
def records(
    collection: Literal["orders", "products", "parcels", "customers", "activity"],
    db: DB,
    q: str = Query("", max_length=160),
    status: str = Query("", max_length=40),
    page: int = Query(1, ge=1),
    archived: bool = False,
):
    model = {
        "orders": GroceryOrder,
        "products": Product,
        "parcels": Parcel,
        "customers": CustomerProfile,
        "activity": CommerceEvent,
    }[collection]
    query = select(model)
    if collection == "orders":
        if not archived:
            query = query.where(GroceryOrder.status != "preview")
        if q:
            query = query.where(
                or_(
                    GroceryOrder.order_number.ilike("%" + q + "%"),
                    GroceryOrder.destination["name"].as_string().ilike("%" + q + "%"),
                    GroceryOrder.destination["area"].as_string().ilike("%" + q + "%"),
                )
            )
    elif collection == "products":
        if q:
            query = query.where(
                or_(
                    Product.name_en.ilike("%" + q + "%"),
                    Product.name_bn.ilike("%" + q + "%"),
                    Product.sku.ilike("%" + q + "%"),
                )
            )
        if status:
            query = (
                query.where(Product.category == "dry")
                if status == "dry"
                else query.where(Product.details["department"].as_string() == status)
            )
    elif collection == "parcels":
        if q:
            query = query.where(
                or_(
                    Parcel.tracking_code.ilike("%" + q + "%"),
                    Parcel.recipient["name"].as_string().ilike("%" + q + "%"),
                    Parcel.recipient["area"].as_string().ilike("%" + q + "%"),
                )
            )
    elif collection == "customers":
        if q:
            query = query.where(
                or_(
                    CustomerProfile.name.ilike("%" + q + "%"),
                    CustomerProfile.email.ilike("%" + q + "%"),
                    CustomerProfile.phone.ilike("%" + q + "%"),
                )
            )
    elif q:
        query = query.where(CommerceEvent.event.ilike("%" + q.replace(" ", "_") + "%"))
    if status and collection in ("orders", "parcels"):
        query = query.where(model.status == status)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    sort = (
        Product.name_en
        if collection == "products"
        else CustomerProfile.updated_at.desc()
        if collection == "customers"
        else model.created_at.desc()
    )
    values = db.scalars(
        query.order_by(sort, *model.__table__.primary_key.columns).offset((page - 1) * 20).limit(20)
    ).all()
    if collection == "orders":
        items = [order_summary(o) for o in values]
    elif collection == "customers":
        items = [
            {
                "id": p.subject,
                "name": p.name,
                "email": (p.email[:2] + "***@" + p.email.split("@")[-1]) if p.email else "",
                "phone": ("•••• " + p.phone[-4:]) if p.phone else "",
                "area": p.checkout_defaults.get("area", ""),
                "order_count": db.scalar(
                    select(func.count())
                    .select_from(GroceryOrder)
                    .where(GroceryOrder.customer_id == p.subject, GroceryOrder.status != "preview")
                ),
            }
            for p in values
        ]
    elif collection == "activity":
        items = [
            {
                "id": e.id,
                "event": e.event,
                "entity_type": e.entity_type,
                "created_at": row(e)["created_at"],
            }
            for e in values
        ]
    elif collection == "parcels":
        items = [
            {
                k: row(p)[k]
                for k in (
                    "id",
                    "tracking_code",
                    "sender",
                    "recipient",
                    "status",
                    "amount_bdt",
                    "courier_id",
                    "created_at",
                    "package",
                )
            }
            for p in values
        ]
    else:
        items = [row(p) for p in values]
    return {"items": items, "total": total, "page": page, "page_size": 20}


@router.get("/customer")
def customer(db: DB, subject: str = Query(min_length=1, max_length=128)):
    p = db.get(CustomerProfile, subject)
    if p is None:
        raise HTTPException(404, "Customer not found")
    orders = db.scalars(
        select(GroceryOrder)
        .where(GroceryOrder.customer_id == subject, GroceryOrder.status != "preview")
        .order_by(GroceryOrder.created_at.desc())
        .limit(20)
    ).all()
    return {
        "name": p.name,
        "email": p.email,
        "phone": p.phone,
        "language": p.language,
        "checkout_defaults": p.checkout_defaults,
        "orders": [order_summary(o) for o in orders],
    }


@router.get("/parcel/{parcel_id}")
def parcel(db: DB, parcel_id: str):
    p = db.get(Parcel, parcel_id)
    if p is None:
        raise HTTPException(404, "Parcel not found")
    return {
        "tracking_code": p.tracking_code,
        "status": p.status,
        "sender": p.sender,
        "recipient": p.recipient,
        "package": p.package,
        "history": [
            {"id": e.id, "event": e.event_type, "created_at": e.occurred_at}
            for e in db.scalars(
                select(ParcelEvent)
                .where(ParcelEvent.parcel_id == p.id)
                .order_by(ParcelEvent.occurred_at)
            )
        ],
    }


@router.get("/couriers")
def couriers(db: DB):
    values = db.execute(
        select(DeliveryPartner, CustomerProfile.name)
        .outerjoin(CustomerProfile, DeliveryPartner.actor_id == CustomerProfile.subject)
        .order_by(DeliveryPartner.id)
        .limit(500)
    ).all()
    return [
        {
            "id": c.id,
            "name": name or "Delivery partner",
            "transport_mode": c.transport_mode,
            "status": c.status,
            "details": c.details,
        }
        for c, name in values
    ]
