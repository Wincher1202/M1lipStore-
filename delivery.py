class DeliveryProviderNotConfigured(Exception):
    pass

class DeliveryProviderError(Exception):
    pass

class BaseDeliveryProvider:
    def __init__(self, provider_id: str, label: str, configured: bool = True):
        self.provider_id = provider_id
        self.label = label
        self.configured = configured

    async def search_cities(self, query: str):
        return []

    async def search_warehouses(self, city_ref: str, query: str = ""):
        return []

class DeliveryService:
    def __init__(self):
        self._providers = {
            "nova_poshta": BaseDeliveryProvider("nova_poshta", "Нова Пошта", True),
            "ukrposhta": BaseDeliveryProvider("ukrposhta", "Укрпошта", True),
            "mist": BaseDeliveryProvider("mist", "Meest Пошта", True),
        }

    def list_providers(self):
        return [{"id": k, "label": v.label, "configured": v.configured} for k, v in self._providers.items()]

    def get(self, provider_id: str):
        if provider_id not in self._providers:
            raise KeyError(provider_id)
        return self._providers[provider_id]

delivery_service = DeliveryService()
