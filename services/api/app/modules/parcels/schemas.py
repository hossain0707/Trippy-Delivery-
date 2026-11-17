from typing import Literal
from pydantic import BaseModel, Field


class Address(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=8, max_length=20)
    address_line: str = Field(min_length=5, max_length=300)
    city: str = Field(min_length=2, max_length=80)
    latitude: float = Field(ge=20, le=27)
    longitude: float = Field(ge=88, le=93)


class Package(BaseModel):
    category: Literal["document", "general", "fragile"] = "general"
    weight_kg: float = Field(gt=0, le=30)
    length_cm: float = Field(gt=0, le=150)
    width_cm: float = Field(gt=0, le=150)
    height_cm: float = Field(gt=0, le=150)


class ParcelRequest(BaseModel):
    sender: Address
    recipient: Address
    package: Package


class QuoteOut(BaseModel):
    currency: str = "BDT"
    amount: int
    distance_km: float
    billable_weight_kg: float
    provisional: bool = True
    disclaimer: str = "Pilot tariff estimate; live road traffic, route capacity and courier availability not integrated."


class ParcelOut(BaseModel):
    id: str
    tracking_code: str
    status: str
    amount_bdt: int


class TrackingOut(BaseModel):
    tracking_code: str
    status: str
    history: list[str]
