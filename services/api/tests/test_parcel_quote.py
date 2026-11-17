from app.modules.parcels.pricing import calculate_quote
from app.modules.parcels.schemas import Address, Package, ParcelRequest


def test_volumetric_weight_affects_price():
    addr = Address(name="Test", phone="01700000000", address_line="Example street 11",
                   city="Dhaka", latitude=23.8, longitude=90.37)
    normal = ParcelRequest(sender=addr, recipient=addr,
        package=Package(weight_kg=1, length_cm=10, width_cm=10, height_cm=10))
    bulky = ParcelRequest(sender=addr, recipient=addr,
        package=Package(weight_kg=1, length_cm=80, width_cm=50, height_cm=40))
    assert calculate_quote(bulky).amount > calculate_quote(normal).amount
    assert calculate_quote(bulky).provisional
