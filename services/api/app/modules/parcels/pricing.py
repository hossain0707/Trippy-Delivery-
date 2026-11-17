from math import asin, ceil, cos, radians, sin, sqrt

from app.modules.parcels.schemas import ParcelRequest, QuoteOut

EARTH_RADIUS_KM = 6371.0088
ESTIMATED_ROAD_FACTOR = 1.35
VOLUMETRIC_DIVISOR_CM = 5000  # Configurable commercial policy later.


def aerial_distance(a_lat: float, a_lng: float, b_lat: float, b_lng: float) -> float:
    a = sin(radians(b_lat-a_lat)/2)**2 + cos(radians(a_lat))*cos(radians(b_lat))*sin(radians(b_lng-a_lng)/2)**2
    return EARTH_RADIUS_KM * 2 * asin(min(1.0, sqrt(a)))


def calculate_quote(payload: ParcelRequest) -> QuoteOut:
    p = payload.package
    road_estimate = max(1.0, aerial_distance(
        payload.sender.latitude, payload.sender.longitude,
        payload.recipient.latitude, payload.recipient.longitude) * ESTIMATED_ROAD_FACTOR)
    billable = max(p.weight_kg, p.length_cm * p.width_cm * p.height_cm / VOLUMETRIC_DIVISOR_CM)
    # Engineering placeholder, NOT an approved public tariff or real-time quote.
    amount = 40 + 12*ceil(road_estimate) + 15*max(0, ceil(billable)-1)
    if p.category == "fragile":
        amount += 30
    return QuoteOut(amount=amount, distance_km=round(road_estimate, 2),
                    billable_weight_kg=round(billable, 2))
