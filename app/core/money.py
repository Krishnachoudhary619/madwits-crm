from decimal import ROUND_HALF_UP, Decimal

MONEY_QUANTUM = Decimal("0.01")
ZERO_MONEY = Decimal("0.00")
RATE_QUANTUM = Decimal("0.0000")


def as_money(value: Decimal | int | str | None) -> Decimal:
    if value is None:
        return ZERO_MONEY
    if isinstance(value, float):
        raise TypeError("Do not use float for money.")
    return Decimal(value).quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)


def as_rate(numerator: int, denominator: int) -> Decimal:
    if denominator == 0:
        return ZERO_MONEY.quantize(RATE_QUANTUM)
    return (Decimal(numerator) / Decimal(denominator)).quantize(
        RATE_QUANTUM, rounding=ROUND_HALF_UP
    )


def format_money(value: Decimal | None) -> str:
    return format(as_money(value), "f")
