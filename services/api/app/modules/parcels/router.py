import hashlib
import json
import secrets

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import Actor, get_actor
from app.core.database import get_db
from app.modules.commerce.service import require_live_orders
from app.modules.audit.models import write_audit
from app.modules.locations.service import ensure_parcel_route
from app.modules.parcels.models import Parcel, ParcelEvent
from app.modules.parcels.pricing import calculate_quote
from app.modules.parcels.schemas import ParcelOut, ParcelRequest, QuoteOut, TrackingOut

router = APIRouter(prefix="/parcels", tags=["Parcel Delivery"])


@router.post("/quote", response_model=QuoteOut)
def quote(payload: ParcelRequest):
    # A quote is an estimate, not a promise of active coverage.
    return calculate_quote(payload)


@router.post("", response_model=ParcelOut, status_code=201)
def book(
    payload: ParcelRequest,
    request: Request,
    idempotency_key: str = Header(min_length=8, max_length=120),
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_actor),
):
    require_live_orders()
    ensure_parcel_route(payload.sender.city, payload.recipient.city)
    return create_parcel_record(payload, request, idempotency_key, db, actor, False)


@router.post("/requests", response_model=ParcelOut, status_code=201)
def request_pickup(
    payload: ParcelRequest,
    request: Request,
    idempotency_key: str = Header(min_length=8, max_length=120),
    db: Session = Depends(get_db),
    actor: Actor = Depends(get_actor),
):
    return create_parcel_record(payload, request, idempotency_key, db, actor, True)


def create_parcel_record(payload, request, idempotency_key, db, actor, request_only):
    digest = hashlib.sha256(json.dumps(payload.model_dump(), sort_keys=True).encode()).hexdigest()
    match = db.scalar(
        select(Parcel).where(
            Parcel.customer_id == actor.subject, Parcel.idempotency_key == idempotency_key
        )
    )
    if match:
        if match.request_hash != digest:
            raise HTTPException(409, "Idempotency key already used for a different booking")
        return ParcelOut(
            id=match.id,
            tracking_code=match.tracking_code,
            status=match.status,
            amount_bdt=match.amount_bdt,
        )
    price = calculate_quote(payload)
    parcel = Parcel(
        customer_id=actor.subject,
        idempotency_key=idempotency_key,
        request_hash=digest,
        tracking_code="TRP" + secrets.token_hex(7).upper(),
        sender=payload.sender.model_dump(),
        recipient=payload.recipient.model_dump(),
        package={
            **payload.package.model_dump(),
            "customer_type": payload.customer_type,
            "pickup_instructions": payload.pickup_instructions,
            "request_only": request_only,
            "payment_collected": False,
        },
        amount_bdt=price.amount,
        distance_km=price.distance_km,
        status="requested" if request_only else "created",
    )
    try:
        db.add(parcel)
        db.flush()
        db.add(
            ParcelEvent(
                parcel_id=parcel.id,
                actor_id=actor.subject,
                event_type="request_submitted" if request_only else "created",
            )
        )
        write_audit(
            db,
            actor_id=actor.subject,
            action="parcel.created",
            entity_type="parcel",
            entity_id=parcel.id,
            request_id=request.state.request_id,
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        match = db.scalar(
            select(Parcel).where(
                Parcel.customer_id == actor.subject, Parcel.idempotency_key == idempotency_key
            )
        )
        if match and match.request_hash == digest:
            return ParcelOut(
                id=match.id,
                tracking_code=match.tracking_code,
                status=match.status,
                amount_bdt=match.amount_bdt,
            )
        raise HTTPException(409, "Booking conflict")
    return ParcelOut(
        id=parcel.id,
        tracking_code=parcel.tracking_code,
        status=parcel.status,
        amount_bdt=parcel.amount_bdt,
    )


@router.get("/{tracking_code}", response_model=TrackingOut)
def tracking(tracking_code: str, db: Session = Depends(get_db), actor: Actor = Depends(get_actor)):
    parcel = db.scalar(select(Parcel).where(Parcel.tracking_code == tracking_code))
    if parcel is None or (parcel.customer_id != actor.subject and "admin" not in actor.roles):
        raise HTTPException(404, "Parcel not found")
    events = db.scalars(
        select(ParcelEvent)
        .where(ParcelEvent.parcel_id == parcel.id)
        .order_by(ParcelEvent.occurred_at)
    ).all()
    return TrackingOut(
        tracking_code=parcel.tracking_code,
        status=parcel.status,
        history=[event.event_type for event in events],
    )


from typing import Literal
from pydantic import BaseModel, Field
from app.core.auth import require_admin
from app.modules.couriers.models import DeliveryPartner


class PickupUpdate(BaseModel):
    status: Literal[
        "reviewing", "confirmed", "assigned", "picked_up", "in_transit", "delivered", "cancelled"
    ]
    courier_id: str | None = Field(default=None, max_length=36)
    note: str = Field(min_length=3, max_length=500)


@router.post("/requests/{parcel_id}/update")
def update_pickup_request(
    parcel_id: str,
    payload: PickupUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: Actor = Depends(require_admin),
):
    parcel = db.scalar(select(Parcel).where(Parcel.id == parcel_id).with_for_update())
    if parcel is None or not parcel.package.get("request_only"):
        raise HTTPException(404, "Pickup request not found")
    allowed = {
        "requested": {"reviewing", "confirmed", "cancelled"},
        "reviewing": {"confirmed", "cancelled"},
        "confirmed": {"assigned", "cancelled"},
        "assigned": {"picked_up", "cancelled"},
        "picked_up": {"in_transit"},
        "in_transit": {"delivered"},
    }
    if payload.status not in allowed.get(parcel.status, set()):
        raise HTTPException(409, "Invalid pickup update")
    if payload.status == "assigned":
        c = db.get(DeliveryPartner, payload.courier_id) if payload.courier_id else None
        if (
            c is None
            or c.status != "approved"
            or not all(
                c.details.get(k) for k in ("identity_verified", "documents_verified", "active")
            )
            or parcel.sender["city"].casefold()
            not in [v.casefold() for v in c.details.get("service_cities", [])]
        ):
            raise HTTPException(422, "Choose an active verified courier covering pickup city")
        parcel.courier_id = c.id
    parcel.status = payload.status
    db.add(ParcelEvent(parcel_id=parcel.id, actor_id=actor.subject, event_type=payload.status))
    write_audit(
        db,
        actor_id=actor.subject,
        action="parcel.request_updated",
        request_id=request.state.request_id,
        entity_type="parcel",
        entity_id=parcel.id,
        details={"note": payload.note, "status": payload.status},
    )
    db.commit()
    return {"status": parcel.status}
