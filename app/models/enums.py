from enum import StrEnum


class UserRole(StrEnum):
    ADMIN = "ADMIN"
    STAFF = "STAFF"


class LeadStatus(StrEnum):
    NEW_INQUIRY = "NEW_INQUIRY"
    QUOTATION_PREPARED = "QUOTATION_PREPARED"
    AWAITING_CONFIRMATION = "AWAITING_CONFIRMATION"
    CONFIRMED = "CONFIRMED"
    LOST = "LOST"
    CANCELLED = "CANCELLED"


LEAD_STATUS_VALUES = tuple(status.value for status in LeadStatus)
USER_ROLE_VALUES = tuple(role.value for role in UserRole)

# Same-status updates are allowed without appearing here. Reopening
# LOST/CANCELLED/CONFIRMED is not implemented (policy is unresolved).
LEAD_STATUS_TRANSITIONS: dict[LeadStatus, frozenset[LeadStatus]] = {
    LeadStatus.NEW_INQUIRY: frozenset(
        {
            LeadStatus.QUOTATION_PREPARED,
            LeadStatus.AWAITING_CONFIRMATION,
            LeadStatus.LOST,
            LeadStatus.CANCELLED,
        }
    ),
    LeadStatus.QUOTATION_PREPARED: frozenset(
        {
            LeadStatus.AWAITING_CONFIRMATION,
            LeadStatus.CONFIRMED,
            LeadStatus.LOST,
            LeadStatus.CANCELLED,
        }
    ),
    LeadStatus.AWAITING_CONFIRMATION: frozenset(
        {
            LeadStatus.QUOTATION_PREPARED,
            LeadStatus.CONFIRMED,
            LeadStatus.LOST,
            LeadStatus.CANCELLED,
        }
    ),
    LeadStatus.CONFIRMED: frozenset({LeadStatus.CANCELLED}),
    LeadStatus.LOST: frozenset(),
    LeadStatus.CANCELLED: frozenset(),
}

class PaymentStatus(StrEnum):
    UNPAID = "UNPAID"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    PAID = "PAID"


# Validated in the service layer. Not a closed database enum so additional
# configured methods can be added later without a schema change.
PAYMENT_METHODS = ("CASH", "UPI", "BANK_TRANSFER")
PAYMENT_STATUS_VALUES = tuple(status.value for status in PaymentStatus)
