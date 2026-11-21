"""Payment-independent order calculation and persisted preview checkouts."""

import hashlib
import json
from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.modules.commerce.models import ServiceSetting
from app.modules.commerce.schemas import PilotSettings
from app.modules.commerce.service import event, get_setting, promotion_discount
from app.modules.groceries.models import GroceryLine, GroceryOrder, Product
from app.modules.groceries.scheduling import provisional_deadline


def preparation_options(product, pilot):
    options = [dict(o) for o in product.details.get("preparation_options", [])]
    if product.category != "fresh":
        return []
    if not options:
        options = [
            {
                "id": "whole",
                "name_en": "Whole / Raw",
                "name_bn": "আস্ত / কাঁচা",
                "fee_bdt": "0",
                "enabled": True,
                "yield_percent": 100,
                "image": "",
                "notes": "",
            }
        ]
    eligible = any(o["id"] in ("cleaned", "cut", "cut-only") for o in options)
    # Existing enabled product-specific rates take precedence over the general tariff.
    for name, en, bn in [
        ("cleaned", "Cleaned", "পরিষ্কার"),
        ("cut-only", "Cut only", "শুধু কাটা"),
        ("cut", "Cut and cleaned", "কাটা ও পরিষ্কার"),
    ]:
        if eligible and not any(o["id"] == name for o in options):
            options.append(
                {
                    "id": name,
                    "name_en": en,
                    "name_bn": bn,
                    "fee_bdt": "0",
                    "enabled": False,
                    "yield_percent": 100,
                    "image": "",
                    "notes": "",
                }
            )
    for o in options:
        if o.get("name_en") == "As sold":
            raw = product.details.get("department") in ("vegetables", "fruit", "fish", "meat")
            o.update(
                name_en="Whole / unprepared" if raw else "Original pack",
                name_bn="আস্ত / অপ্রস্তুত" if raw else "মূল প্যাকেট",
            )
        if not o.get("enabled") and o["id"] in ("cleaned", "cut-only", "cut"):
            rate = getattr(pilot, "preparation_" + o["id"].replace("-", "_") + "_fee_bdt")
            if rate is not None:
                o.update(fee_bdt=str(rate), enabled=True, fee_unit="kg")
        # No generated preparation photos; keep only verified real product photos.
        if not product.details.get("images_approved"):
            o["image"] = ""
    return sorted(
        options, key=lambda o: ["whole", "cleaned", "cut-only", "cut", "custom"].index(o["id"])
    )


def calculate(payload, db):
    pilot = get_setting(db, "pilot", PilotSettings)
    if len({i.sku for i in payload.items}) != len(payload.items):
        raise HTTPException(422, "Combine duplicate products")
    item_subtotal = preparation = Decimal(0)
    pending = []
    lines = []
    for item in payload.items:
        p = db.get(Product, item.sku)
        if p is None or not p.active:
            raise HTTPException(422, "Product unavailable: " + item.sku)
        minimum = Decimal(str(p.details.get("minimum_quantity", ".001")))
        step = Decimal(str(p.details.get("quantity_step", ".001")))
        if item.quantity < minimum or item.quantity % step:
            raise HTTPException(422, "Invalid quantity increment: " + item.sku)
        if p.category != "fresh" and item.preparation != "none":
            raise HTTPException(422, "Only fresh groceries support preparation")
        if p.category == "fresh" and item.preparation == "none":
            raise HTTPException(422, "Choose a preparation option")
        if item.preparation == "custom" and not payload.preparation_notes.strip():
            raise HTTPException(422, "Custom preparation requires instructions")
        options = preparation_options(p, pilot)
        option = next((o for o in options if o["id"] == item.preparation), None)
        if options and option is None:
            raise HTTPException(422, "Invalid preparation")
        priced = p.price_approved and p.price_bdt > 0
        if not priced:
            pending.append(p.name_en + ": product price is not set")
        if option and not option.get("enabled"):
            pending.append(p.name_en + ": preparation fee is not set")
        base = (p.price_bdt * item.quantity).quantize(Decimal(".01")) if priced else Decimal(0)
        preparation_quantity = item.quantity
        if option and option.get("fee_unit") == "kg" and p.unit != "kg":
            if item.preparation_weight_kg is None:
                pending.append(p.name_en + ": enter preparation weight in kg")
                preparation_quantity = Decimal(0)
            else:
                preparation_quantity = item.preparation_weight_kg
        fee = (
            (Decimal(str(option["fee_bdt"])) * preparation_quantity).quantize(Decimal(".01"))
            if option and option.get("enabled")
            else Decimal(0)
        )
        item_subtotal += base
        preparation += fee
        lines.append(
            {
                "sku": p.sku,
                "name_en": p.name_en,
                "name_bn": p.name_bn,
                "unit": p.unit,
                "quantity": str(item.quantity),
                "preparation": item.preparation,
                "preparation_weight_kg": str(preparation_quantity),
                "base_amount_bdt": str(base),
                "preparation_fee_bdt": str(fee),
                "amount_bdt": str(base + fee),
                "estimated_final_quantity": str(
                    item.quantity
                    * Decimal(str(option.get("yield_percent", 100) if option else 100))
                    / 100
                ),
            }
        )
    zone = next(
        (
            z
            for z in pilot.zones
            if z.city.casefold().strip() == payload.destination.city.casefold().strip()
            and z.area.casefold().strip() == payload.destination.area.casefold().strip()
        ),
        None,
    )
    shipping = zone.fee_bdt if zone else None
    distance = None
    base_area = pilot.delivery_base_area.strip().casefold()
    area = payload.destination.area.strip().casefold()
    # An explicit area tariff takes precedence. Distance is customer-entered for preview,
    # not a claim of automatic routing or a verified dispatch distance.
    if zone is None and payload.destination.city.casefold().strip() == "dhaka":
        if pilot.delivery_base_fee_bdt is not None:
            within_base = (
                area == base_area
                or area.startswith(base_area + " ")
                or (base_area == "uttara" and area.startswith("উত্তরা"))
            )
            if within_base:
                shipping = pilot.delivery_base_fee_bdt
            elif (
                payload.delivery_distance_km is not None
                and payload.delivery_distance_km > 0
                and pilot.delivery_per_km_bdt is not None
            ):
                distance = payload.delivery_distance_km
                shipping = (
                    pilot.delivery_base_fee_bdt + distance * pilot.delivery_per_km_bdt
                ).quantize(Decimal(".01"))
            else:
                pending.append(
                    "Enter the delivery distance from " + pilot.delivery_base_area + " in km"
                )
        else:
            shipping = pilot.dhaka_delivery_fee_bdt
    if shipping is None:
        pending.append("Delivery fee is not set for this area")
    subtotal = item_subtotal + preparation
    discount = promotion_discount(db, payload.promo_code, subtotal)
    return {
        "item_subtotal_bdt": str(item_subtotal),
        "preparation_fee_bdt": str(preparation),
        "subtotal_bdt": str(subtotal),
        "discount_bdt": str(discount),
        "delivery_fee_bdt": str(shipping) if shipping is not None else None,
        "total_bdt": str(subtotal + shipping - discount) if not pending else None,
        "known_subtotal_bdt": str(subtotal - discount),
        "lines": lines,
        "pending": pending,
        "delivery_deadline": provisional_deadline(datetime.now(UTC)),
        "slot_confirmed": False,
        "ordering_open": False,
        "preview": True,
        "payment_required": False,
        "delivery_distance_km": str(distance) if distance is not None else None,
        "distance_basis": "customer_entered_preview" if distance is not None else "area_tariff",
    }


def save_preview(payload, db, actor, key):
    digest = hashlib.sha256(
        json.dumps(payload.model_dump(mode="json"), sort_keys=True).encode()
    ).hexdigest()

    def existing():
        return db.scalar(
            select(GroceryOrder).where(
                GroceryOrder.customer_id == actor.subject, GroceryOrder.idempotency_key == key
            )
        )

    def result(o):
        if o.request_hash != digest:
            raise HTTPException(409, "Checkout key belongs to another basket")
        return {
            "id": o.id,
            "order_number": o.order_number,
            "status": o.status,
            "payment_status": o.payment_status,
        }

    prior = existing()
    if prior:
        return result(prior)
    review = calculate(payload, db)
    if review["pending"]:
        raise HTTPException(
            422, "Complete pricing before placing a preview order: " + "; ".join(review["pending"])
        )
    if payload.expected_total_bdt is None or payload.expected_total_bdt != Decimal(
        review["total_bdt"]
    ):
        raise HTTPException(
            409, "Prices changed or were not reviewed. Review the order again before saving."
        )
    # Save a calculated checkout, without reservations, dispatch, payments or quote approval.
    o = GroceryOrder(
        customer_id=actor.subject,
        order_number="TRP-" + uuid4().hex[:12].upper(),
        idempotency_key=key,
        request_hash=digest,
        destination=payload.destination.model_dump(),
        status="preview",
        payment_method="disabled",
        payment_status="disabled",
        amount_bdt=Decimal(review["total_bdt"]),
        delivery_fee_bdt=Decimal(review["delivery_fee_bdt"]),
        delivery_deadline=review["delivery_deadline"],
        checkout_data={
            "mode": "preview_checkout",
            "stock_reserved": False,
            "instructions": payload.instructions,
            "preparation_notes": payload.preparation_notes,
            "item_snapshots": review["lines"],
            "calculation": {k: v for k, v in review.items() if k != "delivery_deadline"},
        },
    )
    try:
        db.add(o)
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
        event(db, actor, "grocery_order", o.id, "preview_order_saved")
        cart = db.get(
            ServiceSetting, "cart:" + hashlib.sha256(actor.subject.encode()).hexdigest()[:40]
        )
        if cart:
            cart.value = {"items": []}
        db.commit()
    except IntegrityError:
        db.rollback()
        prior = existing()
        if prior:
            return result(prior)
        raise HTTPException(409, "Checkout changed; retry")
    return result(o)
