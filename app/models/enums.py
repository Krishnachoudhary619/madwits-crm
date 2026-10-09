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

# Validated in the service layer. Not a closed database enum so additional
# configured methods can be added later without a schema change.
PAYMENT_METHODS = ("CASH", "UPI", "BANK_TRANSFER")
