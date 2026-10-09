class ServiceError(Exception):
    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class UsernameTakenError(ServiceError):
    pass


class AdminAlreadyExistsError(ServiceError):
    pass


class LastAdminError(ServiceError):
    pass


class InactiveAttributionUserError(ServiceError):
    pass


class AttributionUserNotFoundError(ServiceError):
    pass


class DuplicateActiveNameError(ServiceError):
    pass


class IncompleteWorkflowError(ServiceError):
    pass


class SequenceConflictError(ServiceError):
    pass


class CustomerNotFoundError(ServiceError):
    pass


class CategoryNotFoundError(ServiceError):
    pass


class InactiveCustomerError(ServiceError):
    pass


class InactiveCategoryError(ServiceError):
    pass


class InvalidLifecycleTransitionError(ServiceError):
    pass


class InvalidStageTransitionError(ServiceError):
    pass


class StageConcurrencyError(ServiceError):
    pass


class QuotationRequiredError(ServiceError):
    pass


class PaymentNotAllowedError(ServiceError):
    pass


class OverpaymentError(ServiceError):
    pass


class InvalidPaymentMethodError(ServiceError):
    pass
