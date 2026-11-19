from datetime import UTC, datetime
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import func, select

from app.core.config import settings
from app.modules.commerce.models import CommerceEvent, ServiceSetting
from app.modules.commerce.schemas import PaymentSettings, PilotSettings
from app.modules.groceries.models import GroceryOrder
from app.modules.groceries.scheduling import provisional_deadline


def get_setting(db, key, model):
    row = db.get(ServiceSetting, key)
    return model.model_validate(row.value if row else {})


def event(db, actor, kind, identifier, action, details=None):
    db.add(
        CommerceEvent(
            entity_type=kind,
            entity_id=identifier,
            actor_id=actor.subject,
            event=action,
            details=details or {},
        )
    )


def require_live_orders():
    c = settings()
    if c.app_env not in ("local", "test") and (
        c.app_env == "preview" or not c.live_orders_enabled or not c.pilot_approved
    ):
        raise HTTPException(503, "Ordering is closed pending owner pilot approval")


def delivery(db, destination, lock=False):
    pilot = get_setting(db, "pilot", PilotSettings)
    deadline = provisional_deadline(datetime.now(UTC))
    zone = next(
        (
            z
            for z in pilot.zones
            if z.city.strip().casefold() == destination.city.strip().casefold()
            and z.area.strip().casefold() == destination.area.strip().casefold()
        ),
        None,
    )
    if zone is None and settings().app_env in ("local", "test") and not pilot.zones:
        return Decimal(0), deadline, False
    if (
        zone is None
        or not zone.active
        or not zone.preparation_ready
        or not zone.courier_ready
        or zone.capacity_per_slot < 1
    ):
        raise HTTPException(422, "Delivery coverage and capacity are not confirmed for this area")
    if lock:
        # Serialize slot admission through the existing pilot settings row.
        db.scalar(select(ServiceSetting).where(ServiceSetting.key == "pilot").with_for_update())
    used = db.scalar(
        select(func.count())
        .select_from(GroceryOrder)
        .where(
            GroceryOrder.delivery_deadline == deadline,
            GroceryOrder.status.notin_(["cancelled", "rejected", "failed"]),
            func.lower(GroceryOrder.destination["city"].as_string())
            == destination.city.strip().lower(),
            func.lower(GroceryOrder.destination["area"].as_string())
            == destination.area.strip().lower(),
        )
    )
    if used >= zone.capacity_per_slot:
        raise HTTPException(409, "This delivery slot is full; contact support for another slot")
    return zone.fee_bdt, deadline, True


def payment_destination(db, method):
    p = get_setting(db, "payments", PaymentSettings)
    if method == "cod":
        if not p.cod_enabled and settings().app_env not in ("local", "test"):
            raise HTTPException(422, "Cash on Delivery is not yet enabled")
        return {
            "method": "cod",
            "instructions": "Pay the courier after delivery. Payment is unpaid until collection.",
        }
    d = getattr(p, method, None)
    if d is None or not d.enabled or not d.verified:
        raise HTTPException(
            422, "This payment method is not enabled with verified receiving details"
        )
    return {"method": method, **d.model_dump(mode="json")}


def promotion_discount(db, code, subtotal):
    if not code:
        return Decimal(0)
    pilot = get_setting(db, "pilot", PilotSettings)
    p = next((p for p in pilot.promotions if p.code == code and p.enabled), None)
    if (
        p is None
        or (p.expires_at and p.expires_at <= datetime.now(UTC))
        or subtotal < p.minimum_subtotal_bdt
    ):
        raise HTTPException(422, "This offer is unavailable or its minimum spend is not met")
    return (subtotal * Decimal(p.percent) / 100).quantize(Decimal("0.01"))
