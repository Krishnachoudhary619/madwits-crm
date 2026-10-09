from decimal import Decimal

import pytest

from app.core.money import as_money, as_rate
from app.models import PaymentStatus
from app.services.payment_service import derive_payment_status


def test_as_money_quantizes_decimal_not_float() -> None:
    assert as_money(Decimal("10.1")) == Decimal("10.10")
    assert as_money("20.20") == Decimal("20.20")
    assert as_money(None) == Decimal("0.00")
    with pytest.raises(TypeError):
        as_money(1.1)


def test_partial_payment_status_uses_decimal() -> None:
    due = as_money("100.00")
    first = as_money("33.33")
    second = as_money("33.33")
    third = as_money("33.34")
    paid = first + second
    assert derive_payment_status(due, paid) == PaymentStatus.PARTIALLY_PAID
    assert derive_payment_status(due, paid + third) == PaymentStatus.PAID
    assert derive_payment_status(due, Decimal("0.00")) == PaymentStatus.UNPAID


def test_conversion_rate_is_decimal() -> None:
    assert as_rate(1, 2) == Decimal("0.5000")
    assert as_rate(0, 0) == Decimal("0.0000")
    assert as_rate(1, 3) == Decimal("0.3333")
