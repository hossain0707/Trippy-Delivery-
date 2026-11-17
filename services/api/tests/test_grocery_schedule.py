from datetime import datetime
import pytest
from app.modules.groceries.scheduling import DHAKA, provisional_deadline


@pytest.mark.parametrize("hour,minute,delta,delivery_hour", [
    (12, 59, 0, 21),
    (13, 0, 1, 9),
    (20, 59, 1, 9),
    (21, 0, 1, 21),
])
def test_grocery_cutoffs(hour, minute, delta, delivery_hour):
    now = datetime(2026, 11, 17, hour, minute, tzinfo=DHAKA)
    deadline = provisional_deadline(now)
    assert (deadline.date() - now.date()).days == delta
    assert deadline.hour == delivery_hour


def test_naive_time_rejected():
    with pytest.raises(ValueError):
        provisional_deadline(datetime(2026, 11, 17, 9))
