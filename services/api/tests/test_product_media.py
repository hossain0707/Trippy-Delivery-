import base64
import io

import pytest
from PIL import Image
from test_operations import owner

from app.core.auth import Actor, get_actor
from app.main import app
from app.modules.commerce.models import ServiceSetting
from app.modules.groceries.models import Product


def photo_payload():
    output = io.BytesIO()
    Image.new("RGB", (600, 450), "green").save(output, "JPEG")
    return {
        "image_base64": base64.b64encode(output.getvalue()).decode(),
        "real_photo_and_rights_confirmed": True,
        "credit": "Test photographer",
    }


def test_only_owner_can_upload_product_photographs(client):
    browser, _ = client
    response = browser.put("/api/v1/admin/commerce/catalog/ROHU/photos/whole", json=photo_payload())
    assert response.status_code == 403


def test_photo_persists_across_sessions_and_separates_preparations(client):
    browser, factory = client
    owner()
    response = browser.put("/api/v1/admin/commerce/catalog/ROHU/photos/cut", json=photo_payload())
    assert response.status_code == 200, response.text
    path = response.json()["details"]["photo_variants"]["cut"]["image"]
    first = browser.get(path)
    assert first.status_code == 200 and first.headers["content-type"] == "image/webp"
    with Image.open(io.BytesIO(first.content)) as im:
        assert im.size == (1200, 900)
        assert not im.getexif()
    with factory() as db:
        assert db.get(Product, "ROHU").details["photo_variants"]["cut"]["image"] == path
        assert "whole" not in db.get(Product, "ROHU").details["photo_variants"]
        assert db.get(ServiceSetting, "media:" + path.rsplit("/", 1)[1]) is not None
    app.dependency_overrides[get_actor] = lambda: Actor("viewer", frozenset({"customer"}))
    assert browser.get(path).content == first.content
    assert browser.get(path, headers={"If-None-Match": first.headers["etag"]}).status_code == 304


@pytest.mark.parametrize(
    "change",
    [
        {"image_base64": "invalid"},
        {"real_photo_and_rights_confirmed": False},
        {"image_base64": base64.b64encode(b"<svg>not a photo</svg>").decode()},
    ],
)
def test_invalid_photos_and_missing_rights_are_rejected(client, change):
    browser, _ = client
    owner()
    assert (
        browser.put(
            "/api/v1/admin/commerce/catalog/ROHU/photos/whole", json={**photo_payload(), **change}
        ).status_code
        == 422
    )


def test_dry_items_cannot_have_cut_photos_and_unknown_files_are_not_found(client):
    browser, _ = client
    owner()
    assert (
        browser.put(
            "/api/v1/admin/commerce/catalog/RICE/photos/cut", json=photo_payload()
        ).status_code
        == 422
    )
    assert browser.get("/api/v1/commerce/media/" + "0" * 40).status_code == 404
    assert browser.get("/api/v1/commerce/media/not-an-id").status_code == 404
