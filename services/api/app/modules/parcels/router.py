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
    ensure_parcel_route(payload.sender.city, payload.recipient.city)
    return calculate_quote(payload)


@router.post("", response_model=ParcelOut, status_code=201)
def book(payload: ParcelRequest, request: Request,
         idempotency_key: str = Header(min_length=8, max_length=120),
         db: Session = Depends(get_db), actor: Actor = Depends(get_actor)):
    require_live_orders()
    ensure_parcel_route(payload.sender.city, payload.recipient.city)
    digest = hashlib.sha256(json.dumps(payload.model_dump(), sort_keys=True).encode()).hexdigest()
    match = db.scalar(select(Parcel).where(Parcel.customer_id == actor.subject,
                                            Parcel.idempotency_key == idempotency_key))
    if match:
        if match.request_hash != digest:
            raise HTTPException(409, "Idempotency key already used for a different booking")
        return ParcelOut(id=match.id, tracking_code=match.tracking_code,
                         status=match.status, amount_bdt=match.amount_bdt)
    price = calculate_quote(payload)
    parcel = Parcel(
        customer_id=actor.subject, idempotency_key=idempotency_key, request_hash=digest,
        tracking_code="TRP" + secrets.token_hex(7).upper(),
        sender=payload.sender.model_dump(), recipient=payload.recipient.model_dump(),
        package={**payload.package.model_dump(),"customer_type":payload.customer_type,"pickup_instructions":payload.pickup_instructions}, amount_bdt=price.amount,
        distance_km=price.distance_km, status="created")
    try:
        db.add(parcel)
        db.flush()
        db.add(ParcelEvent(parcel_id=parcel.id, actor_id=actor.subject, event_type="created"))
        write_audit(db, actor_id=actor.subject, action="parcel.created", entity_type="parcel",
                    entity_id=parcel.id, request_id=request.state.request_id)
        db.commit()
    except IntegrityError:
        db.rollback()
        match = db.scalar(select(Parcel).where(Parcel.customer_id == actor.subject,
                                                Parcel.idempotency_key == idempotency_key))
        if match and match.request_hash == digest:
            return ParcelOut(id=match.id, tracking_code=match.tracking_code,
                             status=match.status, amount_bdt=match.amount_bdt)
        raise HTTPException(409, "Booking conflict")
    return ParcelOut(id=parcel.id, tracking_code=parcel.tracking_code,
                     status=parcel.status, amount_bdt=parcel.amount_bdt)


@router.get("/{tracking_code}", response_model=TrackingOut)
def tracking(tracking_code: str, db: Session = Depends(get_db), actor: Actor = Depends(get_actor)):
    parcel = db.scalar(select(Parcel).where(Parcel.tracking_code == tracking_code))
    if parcel is None or (parcel.customer_id != actor.subject and "admin" not in actor.roles):
        raise HTTPException(404, "Parcel not found")
    events = db.scalars(select(ParcelEvent).where(ParcelEvent.parcel_id == parcel.id)
                        .order_by(ParcelEvent.occurred_at)).all()
    return TrackingOut(tracking_code=parcel.tracking_code, status=parcel.status,
                       history=[event.event_type for event in events])
