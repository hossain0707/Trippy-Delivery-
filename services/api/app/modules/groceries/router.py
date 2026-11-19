import hashlib
import json
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import Actor, get_actor
from app.core.database import get_db
from app.modules.commerce.service import require_live_orders, delivery, payment_destination, event, promotion_discount
from app.modules.audit.models import write_audit
from app.modules.groceries.models import GroceryLine, GroceryOrder, Product
from app.modules.groceries.schemas import Checkout, OrderOut, ProductOut
from app.modules.groceries.scheduling import provisional_deadline
from app.modules.locations.service import ensure_city_active

router = APIRouter(prefix="/groceries", tags=["TRIPPY Groceries"])


@router.get("/products", response_model=list[ProductOut])
def products(db: Session = Depends(get_db), q:str=Query(default="",max_length=160), department:str=Query(default="",max_length=40), sort:str=Query(default="name",pattern="^(name|price)$")):
    from sqlalchemy import or_
    query=select(Product).where(Product.active.is_(True))
    if q:query=query.where(or_(Product.name_en.ilike("%"+q+"%"),Product.name_bn.ilike("%"+q+"%")))
    if department:query=query.where(Product.details['department'].as_string()==department)
    return db.scalars(query.order_by(Product.price_bdt if sort=='price' else Product.name_en).limit(500)).all()

@router.get("/products/{sku}", response_model=ProductOut)
def product_detail(sku:str,db:Session=Depends(get_db)):
    p=db.get(Product,sku)
    if p is None or not p.active:raise HTTPException(404,"Product not found")
    return p


@router.post("/orders", response_model=OrderOut, status_code=201)
def checkout(payload: Checkout, request: Request,
             idempotency_key: str = Header(min_length=8, max_length=120),
             db: Session = Depends(get_db), actor: Actor = Depends(get_actor)):
    require_live_orders()
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
        return OrderOut(id=match.id, status=match.status, amount_bdt=match.amount_bdt,order_number=match.order_number,payment_method=match.payment_method,payment_status=match.payment_status,delivery_fee_bdt=match.delivery_fee_bdt,
                        delivery_deadline=match.delivery_deadline)
    locked = {}
    # Deterministic lock ordering prevents many checkout deadlock scenarios.
    for sku in sorted(skus):
        product = db.scalar(select(Product).where(Product.sku == sku, Product.active.is_(True)).with_for_update())
        if product is None:
            raise HTTPException(422, "Unavailable SKU: " + sku)
        locked[sku] = product
    # A concurrent request may have committed the same key while we waited for inventory locks.
    match = db.scalar(select(GroceryOrder).where(GroceryOrder.customer_id == actor.subject, GroceryOrder.idempotency_key == idempotency_key))
    if match:
        if match.request_hash != digest:raise HTTPException(409,"Idempotency key used for another cart")
        return OrderOut(id=match.id,status=match.status,amount_bdt=match.amount_bdt,delivery_deadline=match.delivery_deadline,order_number=match.order_number,payment_method=match.payment_method,payment_status=match.payment_status,delivery_fee_bdt=match.delivery_fee_bdt)
    shipping, deadline, confirmed = delivery(db,payload.destination,lock=True)
    payment_info = payment_destination(db,payload.payment_method)
    total = shipping
    lines = []
    for item in payload.items:
        product = locked[item.sku]
        if product.category != "fresh" and item.preparation != "none":
            raise HTTPException(422, "Only fresh groceries support preparation")
        if not product.price_approved or product.price_bdt <= 0:
            raise HTTPException(409, "Product price awaits owner approval: " + item.sku)
        options = product.details.get("preparation_options", [])
        selected = next((o for o in options if o["id"] == item.preparation and o.get("enabled", True)), None)
        if options and selected is None:
            raise HTTPException(422, "Preparation is unavailable for this product")
        minimum = Decimal(str(product.details.get("minimum_quantity", "0.001")))
        step = Decimal(str(product.details.get("quantity_step", "0.001")))
        if item.quantity < minimum or item.quantity % step != 0:
            raise HTTPException(422, "Invalid product quantity increment")
        if item.preparation == "custom" and not payload.preparation_notes.strip():
            raise HTTPException(422, "Custom preparation requires instructions")
        if product.stock_qty < item.quantity:
            raise HTTPException(409, "Insufficient stock: " + item.sku)
        product.stock_qty -= item.quantity
        fee = product.processing_fee_bdt if item.preparation in ("cleaned", "cut", "cut-only") else Decimal("0")
        if selected is not None:
            fee = Decimal(str(selected["fee_bdt"]))
        amount = ((product.price_bdt + fee) * item.quantity).quantize(Decimal("0.01"))
        total += amount
        lines.append(GroceryLine(sku=item.sku, quantity=item.quantity,
                                 preparation=item.preparation, amount_bdt=amount))
    discount=promotion_discount(db,payload.promo_code,total-shipping)
    total-=discount
    from uuid import uuid4
    order = GroceryOrder(order_number="TRG-"+uuid4().hex.upper(), payment_method=payload.payment_method,
                         payment_status="unpaid" if payload.payment_method=="cod" else "pending_verification",
                         delivery_fee_bdt=shipping, checkout_data={"promo_code":payload.promo_code,"discount_bdt":str(discount),"item_snapshots":[{"sku":item.sku,"name_en":locked[item.sku].name_en,"name_bn":locked[item.sku].name_bn,"unit":locked[item.sku].unit,"base_unit_price_bdt":str(locked[item.sku].price_bdt),"preparation":item.preparation} for item in payload.items],"instructions":payload.instructions,"preparation_notes":payload.preparation_notes,"payment_reference":payload.payment_reference,"payment_destination":payment_info,"slot_confirmed":confirmed},customer_id=actor.subject, idempotency_key=idempotency_key,
                         request_hash=digest, destination=payload.destination.model_dump(),
                         amount_bdt=total, status="placed",
                         delivery_deadline=deadline)
    try:
        db.add(order)
        db.flush()
        event(db,actor,"grocery_order",order.id,"submitted")
        for line in lines:
            line.order_id = order.id
            db.add(line)
        write_audit(db, actor_id=actor.subject, action="grocery.order_placed", entity_type="grocery_order",
                    entity_id=order.id, request_id=request.state.request_id, details={"items": len(lines)})
        db.commit()
    except IntegrityError:
        db.rollback()
        match = db.scalar(select(GroceryOrder).where(
            GroceryOrder.customer_id == actor.subject, GroceryOrder.idempotency_key == idempotency_key))
        if match and match.request_hash == digest:
            return OrderOut(id=match.id, status=match.status, amount_bdt=match.amount_bdt,order_number=match.order_number,payment_method=match.payment_method,payment_status=match.payment_status,delivery_fee_bdt=match.delivery_fee_bdt,
                            delivery_deadline=match.delivery_deadline)
        raise HTTPException(409, "Checkout conflict")
    return OrderOut(id=order.id, status=order.status, amount_bdt=order.amount_bdt,order_number=order.order_number,payment_method=order.payment_method,payment_status=order.payment_status,delivery_fee_bdt=order.delivery_fee_bdt,
                    delivery_deadline=order.delivery_deadline)


@router.post("/orders/{order_id}/cancel")
def cancel(order_id: str, request: Request, db: Session = Depends(get_db),
           actor: Actor = Depends(get_actor)):
    order = db.scalar(select(GroceryOrder).where(GroceryOrder.id == order_id).with_for_update())
    if order is None or (order.customer_id != actor.subject and "admin" not in actor.roles):
        raise HTTPException(404, "Order not found")
    if order.status == "cancelled":
        return {"status": "cancelled"}
    if order.status not in ("placed", "pending_review", "confirmed"):
        raise HTTPException(409, "Order can no longer be cancelled automatically")
    lines = db.scalars(select(GroceryLine).where(GroceryLine.order_id == order.id)
                       .order_by(GroceryLine.sku)).all()
    for line in lines:
        product = db.scalar(select(Product).where(Product.sku == line.sku).with_for_update())
        product.stock_qty += line.quantity
    order.status = "cancelled"
    if order.payment_status in ("paid", "test_paid"):
        order.payment_status = "refund_required"
    event(db,actor,"grocery_order",order.id,"cancelled")
    write_audit(db, actor_id=actor.subject, action="grocery.order_cancelled",
                entity_type="grocery_order", entity_id=order.id,
                request_id=request.state.request_id)
    db.commit()
    return {"status": "cancelled"}
