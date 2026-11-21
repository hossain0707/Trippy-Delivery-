from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_serializer, field_validator


class Recipient(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=8, max_length=20)
    address_line: str = Field(min_length=5, max_length=300)
    area: str = Field(default="", max_length=80)
    postal_code: str = Field(default="", max_length=10)
    city: str = Field(min_length=2, max_length=80)


class CartItem(BaseModel):
    preparation_weight_kg: Decimal | None = Field(default=None, gt=0, le=50, decimal_places=3)
    sku: str = Field(min_length=1, max_length=50)
    quantity: Decimal = Field(gt=0, le=50, decimal_places=3)
    preparation: Literal["none", "whole", "cleaned", "cut", "cut-only", "custom"] = "none"


class Checkout(BaseModel):
    delivery_distance_km: Decimal | None = Field(default=None, ge=0, le=500, decimal_places=2)
    expected_total_bdt: Decimal | None = Field(default=None, ge=0, decimal_places=2)
    promo_code: str = Field(default="",max_length=30,pattern=r"^[A-Z0-9-]*$")
    payment_method: Literal["cod", "bkash", "nagad", "rocket", "bank"] = "cod"
    payment_reference: str = Field(default="",max_length=120)
    instructions: str = Field(default="",max_length=1000)
    preparation_notes: str = Field(default="",max_length=500)
    destination: Recipient
    items: list[CartItem] = Field(min_length=1, max_length=50)


class ProductOut(BaseModel):
    sku: str
    name_en: str
    name_bn: str
    category: str
    unit: str
    price_bdt: Decimal
    processing_fee_bdt: Decimal
    stock_qty: Decimal
    active: bool
    price_approved: bool
    details: dict
    model_config = {"from_attributes": True}


class OrderOut(BaseModel):
    order_number: str | None = None
    payment_method: str = "cod"
    payment_status: str = "unpaid"
    delivery_fee_bdt: Decimal = Decimal("0")
    id: str
    status: str
    amount_bdt: Decimal
    delivery_deadline: datetime
    provisional_slot: bool = True

    @field_validator("delivery_deadline", mode="before")
    @classmethod
    def attach_delivery_timezone(cls,value):
        from zoneinfo import ZoneInfo
        if isinstance(value,datetime) and value.tzinfo is None:
            return value.replace(tzinfo=ZoneInfo("Asia/Dhaka"))
        return value

    @field_serializer("amount_bdt", when_used="json")
    def serialize_amount(self, value: Decimal) -> str:
        return str(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
