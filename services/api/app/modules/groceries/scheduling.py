from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

DHAKA = ZoneInfo("Asia/Dhaka")


def provisional_deadline(now: datetime) -> datetime:
    """<13:00 => today 21:00; 13:00–<21:00 => tomorrow 09:00; >=21:00 => tomorrow 21:00."""
    if now.tzinfo is None:
        raise ValueError("Timezone-aware datetime required")
    local = now.astimezone(DHAKA)
    if local.time() < time(13, 0):
        delivery_date, cutoff = local.date(), time(21, 0)
    elif local.time() < time(21, 0):
        delivery_date, cutoff = local.date() + timedelta(days=1), time(9, 0)
    else:
        delivery_date, cutoff = local.date() + timedelta(days=1), time(21, 0)
    return datetime.combine(delivery_date, cutoff, DHAKA)
