from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator


class Preparation(BaseModel):
    id: Literal["whole", "cleaned", "cut", "cut-only", "custom"]
    name_en: str = Field(min_length=1, max_length=80)
    name_bn: str = Field(min_length=1, max_length=80)
    fee_bdt: Decimal = Field(ge=0, le=10000, decimal_places=2)
    enabled: bool = True
    yield_percent: int = Field(default=100, ge=1, le=100)
    image: str = Field(default="", max_length=300, pattern=r"^(|/[^/].*)$")
    notes: str = Field(default="", max_length=500)


class MarketPrice(BaseModel):
    model_config = ConfigDict(extra="forbid")
    amount_bdt: Decimal = Field(gt=0, le=100000, decimal_places=2)
    unit: str = Field(min_length=1, max_length=20)
    source_url: str = Field(max_length=300, pattern=r"^https://chaldal\.com/[a-z0-9-]+$")
    source_name: str = Field(min_length=1, max_length=100)
    checked_on: date
    basis: str = Field(min_length=1, max_length=300)


class CatalogContent(BaseModel):
    model_config = ConfigDict(extra="forbid")
    department: str = Field(default="pantry", min_length=1, max_length=40)
    description_en: str = Field(default="", max_length=1500)
    description_bn: str = Field(default="", max_length=1500)
    image: str = Field(default="", max_length=300, pattern=r"^(|/[^/].*)$")
    seasonal: bool = False
    season: str = Field(default="", max_length=150)
    packaging: str = Field(default="", max_length=150)
    variants: list[str] = Field(default_factory=list, max_length=30)
    preparation_options: list[Preparation] = Field(default_factory=list, max_length=5)
    minimum_quantity: Decimal = Field(default=Decimal(1), gt=0, le=50, decimal_places=3)
    quantity_step: Decimal = Field(default=Decimal(1), gt=0, le=50, decimal_places=3)
    catalog_version: str = Field(default="", max_length=30)
    images_approved: bool = False
    market_price: MarketPrice | None = None

    @model_validator(mode="after")
    def unique_options(self):
        if len({p.id for p in self.preparation_options}) != len(self.preparation_options):
            raise ValueError("Preparation IDs must be unique")
        return self


class PaymentDestination(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enabled: bool = False
    verified: bool = False
    receiving_number: str = Field(default="", max_length=30, pattern=r"^[+0-9 -]*$")
    bank_name: str = Field(default="", max_length=120)
    account_name: str = Field(default="", max_length=120)
    account_number: str = Field(default="", max_length=60, pattern=r"^[0-9 -]*$")
    branch: str = Field(default="", max_length=120)
    routing: str = Field(default="", max_length=30)
    instructions: str = Field(default="", max_length=1000)


class PaymentSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")
    cod_enabled: bool = False
    bkash: PaymentDestination = Field(default_factory=PaymentDestination)
    nagad: PaymentDestination = Field(default_factory=PaymentDestination)
    rocket: PaymentDestination = Field(default_factory=PaymentDestination)
    bank: PaymentDestination = Field(default_factory=PaymentDestination)

    @model_validator(mode="after")
    def verified_destinations(self):
        for name in ["bkash", "nagad", "rocket", "bank"]:
            d = getattr(self, name)
            number = d.account_number if name == "bank" else d.receiving_number
            if d.enabled and (
                not d.verified
                or not number
                or set(number.replace(" ", "").replace("-", "").replace("+", "")) <= {"0"}
            ):
                raise ValueError(
                    "Enabled transfer methods require verified, genuine receiving details"
                )
            if d.enabled and name == "bank" and not all([d.bank_name, d.account_name, d.branch]):
                raise ValueError("Bank name, account name and branch are required")
        return self


class DeliveryZone(BaseModel):
    city: str = Field(min_length=2, max_length=80)
    area: str = Field(min_length=2, max_length=80)
    fee_bdt: Decimal = Field(ge=0, le=5000, decimal_places=2)
    active: bool = False
    capacity_per_slot: int = Field(default=0, ge=0, le=10000)
    preparation_ready: bool = False
    courier_ready: bool = False


class Promotion(BaseModel):
    code: str = Field(pattern=r"^[A-Z0-9-]{3,30}$")
    percent: int = Field(ge=1, le=50)
    minimum_subtotal_bdt: Decimal = Field(default=Decimal(0), ge=0, le=100000)
    enabled: bool = False
    expires_at: AwareDatetime | None = None


class PilotSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")
    promotions: list[Promotion] = Field(default_factory=list, max_length=30)
    zones: list[DeliveryZone] = Field(default_factory=list, max_length=100)
    contact_phone: str = Field(default="", max_length=30)
    support_email: str = Field(default="", max_length=150)
    banner_en: str = Field(
        default="Our Dhaka market is getting ready. Ordering opens after owner approval.",
        max_length=300,
    )
    banner_bn: str = Field(
        default="ঢাকায় আমাদের বাজার প্রস্তুত হচ্ছে। অনুমোদনের পরে অর্ডার চালু হবে।", max_length=300
    )

    @model_validator(mode="after")
    def unique_zones(self):
        keys = [(z.city.strip().lower(), z.area.strip().lower()) for z in self.zones]
        if len(keys) != len(set(keys)):
            raise ValueError("Duplicate delivery zone")
        return self
