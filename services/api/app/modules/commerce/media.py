"""Owner-managed real product photographs, stored in the existing database."""

import base64
import binascii
import hashlib
import io
import re
import warnings
from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.auth import Actor, require_admin
from app.core.database import get_db
from app.modules.commerce.models import ServiceSetting
from app.modules.commerce.service import event
from app.modules.groceries.models import Product

router = APIRouter()
DB = Annotated[Session, Depends(get_db)]
Owner = Annotated[Actor, Depends(require_admin)]
Variant = Literal["whole", "cleaned", "cut-only", "cut"]


class PhotoUpload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    image_base64: str = Field(min_length=4, max_length=2800000)
    real_photo_and_rights_confirmed: Literal[True]
    credit: str = Field(min_length=1, max_length=200, pattern=r"\S")
    source_url: str = Field(default="", max_length=500, pattern=r"^(|https://[^\s]+)$")


def normalize_photo(encoded):
    try:
        raw = base64.b64decode(encoded, validate=True)
        if len(raw) > 2_000_000:
            raise ValueError("File exceeds 2 MB")
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(raw)) as photo:
                if (
                    photo.format not in ("JPEG", "PNG", "WEBP")
                    or getattr(photo, "n_frames", 1) != 1
                ):
                    raise ValueError("Use a single JPEG, PNG or WebP photograph")
                if min(photo.size) < 400 or photo.width * photo.height > 16_000_000:
                    raise ValueError(
                        "Photo must be at least 400 pixels on both sides and at most 16 megapixels"
                    )
                photo = ImageOps.exif_transpose(photo).convert("RGBA")
                photo.thumbnail((1100, 825))
                canvas = Image.new("RGB", (1200, 900), "white")
                canvas.paste(photo, ((1200 - photo.width) // 2, (900 - photo.height) // 2), photo)
                result = io.BytesIO()
                canvas.save(result, "WEBP", quality=88, method=4)
                content = result.getvalue()
                if len(content) > 500_000:
                    raise ValueError("Photo is too complex; use a simpler product background")
                return content
    except (
        ValueError,
        binascii.Error,
        UnidentifiedImageError,
        OSError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ) as error:
        raise HTTPException(422, "Invalid product photo: " + str(error)) from error


@router.put("/admin/commerce/catalog/{sku}/photos/{variant}")
def upload_photo(sku: str, variant: Variant, payload: PhotoUpload, db: DB, actor: Owner):
    product = db.scalar(select(Product).where(Product.sku == sku).with_for_update())
    if product is None:
        raise HTTPException(404, "Product not found")
    if variant != "whole" and (
        product.category != "fresh"
        or product.sku in ("EGGS", "BEEF-MINCE", "JACKFRUIT-PODS")
        or product.details.get("department") in ("dairy", "bakery")
    ):
        raise HTTPException(422, "This product does not support that preparation photo")
    content = normalize_photo(payload.image_base64)
    digest = hashlib.sha256(content).hexdigest()[:40]
    key = "media:" + digest
    if db.get(ServiceSetting, key) is None:
        try:
            with db.begin_nested():
                db.add(
                    ServiceSetting(
                        key=key,
                        value={"content": base64.b64encode(content).decode(), "mime": "image/webp"},
                    )
                )
                db.flush()
        except IntegrityError:
            if db.get(ServiceSetting, key) is None:
                raise
    details = dict(product.details)
    variants = dict(details.get("photo_variants", {}))
    variants[variant] = {
        "image": "/api/v1/commerce/media/" + digest,
        "credit": payload.credit.strip(),
        "source_url": payload.source_url,
        "uploaded_at": datetime.now(UTC).isoformat(),
    }
    details["photo_variants"] = variants
    product.details = details
    event(
        db, actor, "product", sku, "real_photo_uploaded", {"variant": variant, "media_id": digest}
    )
    db.commit()
    return {"sku": sku, "details": details}


@router.get("/commerce/media/{media_id}")
def product_photo(media_id: str, request: Request, db: DB):
    if not re.fullmatch(r"[a-f0-9]{40}", media_id):
        raise HTTPException(404, "Photo not found")
    record = db.get(ServiceSetting, "media:" + media_id)
    if record is None:
        raise HTTPException(404, "Photo not found")
    headers = {
        "Cache-Control": "public, max-age=31536000, immutable",
        "ETag": '"' + media_id + '"',
        "X-Content-Type-Options": "nosniff",
    }
    if request.headers.get("if-none-match") == headers["ETag"]:
        return Response(status_code=304, headers=headers)
    return Response(
        base64.b64decode(record.value["content"]), media_type="image/webp", headers=headers
    )
