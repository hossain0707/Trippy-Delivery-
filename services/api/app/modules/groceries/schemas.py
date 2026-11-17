from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_serializer


class Recipient(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=8, max_length=20)
    address_line: str = Field(min_length=5, max_length=300)
    city: str = Field(min_length=2, max_length=80)


class CartItem(BaseModel):
    sku: str = Field(min_length=1, max_length=50)
    quantity: Decimal = Field(gt=0, le=50, decimal_places=3)
    preparation: Literal["none", "whole", "cleaned", "cut"] = "none"


class Checkout(BaseModel):
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
    model_config = {"from_attributes": True}


class OrderOut(BaseModel):
    id: str
    status: str
    amount_bdt: Decimal
    delivery_deadline: datetime
    provisional_slot: bool = True

    @field_serializer("amount_bdt", when_used="json")
    def serialize_amount(self, value: Decimal) -> str:
        return str(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
