from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.core.config import get_settings


def shop_zone() -> ZoneInfo:
    return ZoneInfo(get_settings().shop_timezone)


def shop_today() -> date:
    return datetime.now(shop_zone()).date()


def day_bounds(day: date, tz: ZoneInfo | None = None) -> tuple[datetime, datetime]:
    zone = tz or shop_zone()
    start = datetime.combine(day, time.min, tzinfo=zone)
    return start, start + timedelta(days=1)


def inclusive_period(
    from_date: date | None,
    to_date: date | None,
) -> tuple[datetime, datetime, date, date]:
    """Return [start, end) timestamps covering shop-local calendar dates."""
    today = shop_today()
    if from_date is None and to_date is None:
        start_day = today.replace(day=1)
        end_day = today
    elif from_date is None:
        start_day = end_day = to_date
    elif to_date is None:
        start_day = from_date
        end_day = today
    else:
        start_day, end_day = from_date, to_date
    if end_day < start_day:
        raise ValueError("to_date must be on or after from_date.")
    start, _ = day_bounds(start_day)
    _, end = day_bounds(end_day)
    return start, end, start_day, end_day
