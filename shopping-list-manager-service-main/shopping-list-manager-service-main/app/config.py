import os


class Settings:
    def __init__(self) -> None:
        self.auth_service_url = os.getenv("AUTH_SERVICE_URL", "http://auth-service:8000")
        self.io_service_url = os.getenv("IO_SERVICE_URL", "http://io-service:8000")
        self.items_service_url = os.getenv("ITEMS_SERVICE_URL", "http://items-service:8000")
        self.budget_service_url = os.getenv("BUDGET_SERVICE_URL", "http://budget-service:8000")
        self.notification_service_url = os.getenv("NOTIFICATION_SERVICE_URL", "http://notification-service:8000")


settings = Settings()
