import hashlib
import json
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import Actor, get_actor
from app.core.database import get_db
from app.modules.audit.models import write_audit
from app.modules.groceries.models import GroceryLine, GroceryOrder, Product
from app.modules.groceries.schemas import Checkout, OrderOut, ProductOut
from app.modules.groceries.scheduling import provisional_deadline
from app.modules.locations.service import ensure_city_active

router = APIRouter(prefix="/groceries", tags=["TRIPPY Groceries"])


@router.get("/products", response_model=list[ProductOut])
def products(db: Session = Depends(get_db)):
    return db.scalars(select(Product).where(Product.active.is_(True))
                      .order_by(Product.name_en).limit(200)).all()


@router.post("/orders", response_model=OrderOut, status_code=201)
def checkout(payload: Checkout, request: Request,
             idempotency_key: str = Header(min_length=8, max_length=120),
             db: Session = Depends(get_db), actor: Actor = Depends(get_actor)):
    ensure_city_active(payload.destination.city)
    skus = {line.sku for line in payload.items}
    if len(skus) != len(payload.items):
        raise HTTPException(422, "Duplicate SKU. Combine quantities.")
    digest = hashlib.sha256(json.dumps(payload.model_dump(mode="json"), sort_keys=True).encode()).hexdigest()
    match = db.scalar(select(GroceryOrder).where(
        GroceryOrder.customer_id == actor.subject, GroceryOrder.idempotency_key == idempotency_key))
    if match:
        if match.request_hash != digest:
            raise HTTPException(409, "Idempotency key used for another cart")
        return OrderOut(id=match.id, status=match.status, amount_bdt=match.amount_bdt,
                        delivery_deadline=match.delivery_deadline)
    locked = {}
    # Deterministic lock ordering prevents many checkout deadlock scenarios.
    for sku in sorted(skus):
        product = db.scalar(select(Product).where(Product.sku == sku, Product.active.is_(True)).with_for_update())
        if product is None:
            raise HTTPException(422, "Unavailable SKU: " + sku)
        locked[sku] = product
    total = Decimal("0")
    lines = []
    for item in payload.items:
        product = locked[item.sku]
        if product.category != "fresh" and item.preparation != "none":
            raise HTTPException(422, "Only fresh groceries support preparation")
        if product.stock_qty < item.quantity:
            raise HTTPException(409, "Insufficient stock: " + item.sku)
        product.stock_qty -= item.quantity
        fee = product.processing_fee_bdt if item.preparation in ("cleaned", "cut", "cut-only") else Decimal("0")
        amount = (product.price_bdt + fee) * item.quantity
        total += amount
        lines.append(GroceryLine(sku=item.sku, quantity=item.quantity,
                                 preparation=item.preparation, amount_bdt=amount))
    order = GroceryOrder(customer_id=actor.subject, idempotency_key=idempotency_key,
                         request_hash=digest, destination=payload.destination.model_dump(),
                         amount_bdt=total, status="placed",
                         delivery_deadline=provisional_deadline(datetime.now(timezone.utc)))
    db.add(order)
    db.flush()
    for line in lines:
        line.order_id = order.id
        db.add(line)
    write_audit(db, actor_id=actor.subject, action="grocery.order_placed", entity_type="grocery_order",
                entity_id=order.id, request_id=request.state.request_id, details={"items": len(lines)})
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        match = db.scalar(select(GroceryOrder).where(
            GroceryOrder.customer_id == actor.subject, GroceryOrder.idempotency_key == idempotency_key))
        if match and match.request_hash == digest:
            return OrderOut(id=match.id, status=match.status, amount_bdt=match.amount_bdt,
                            delivery_deadline=match.delivery_deadline)
        raise HTTPException(409, "Checkout conflict")
    return OrderOut(id=order.id, status=order.status, amount_bdt=order.amount_bdt,
                    delivery_deadline=order.delivery_deadline)


@router.post("/orders/{order_id}/cancel")
def cancel(order_id: str, request: Request, db: Session = Depends(get_db),
           actor: Actor = Depends(get_actor)):
    order = db.scalar(select(GroceryOrder).where(GroceryOrder.id == order_id).with_for_update())
    if order is None or (order.customer_id != actor.subject and "admin" not in actor.roles):
        raise HTTPException(404, "Order not found")
    if order.status == "cancelled":
        return {"status": "cancelled"}
    if order.status != "placed":
        raise HTTPException(409, "Order can no longer be cancelled automatically")
    lines = db.scalars(select(GroceryLine).where(GroceryLine.order_id == order.id)
                       .order_by(GroceryLine.sku)).all()
    for line in lines:
        product = db.scalar(select(Product).where(Product.sku == line.sku).with_for_update())
        product.stock_qty += line.quantity
    order.status = "cancelled"
    write_audit(db, actor_id=actor.subject, action="grocery.order_cancelled",
                entity_type="grocery_order", entity_id=order.id,
                request_id=request.state.request_id)
    db.commit()
    return {"status": "cancelled"}
