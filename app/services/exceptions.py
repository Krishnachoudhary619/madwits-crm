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
