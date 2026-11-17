from fastapi import HTTPException
from app.core.config import settings


def ensure_city_active(city: str):
    if city.strip().lower() not in settings().cities:
        raise HTTPException(422, "Delivery is not currently active in this city")


def ensure_parcel_route(pickup: str, destination: str):
    ensure_city_active(pickup)
    ensure_city_active(destination)
    if pickup.strip().lower() != destination.strip().lower():
        raise HTTPException(422, "Intercity delivery is not active yet")
