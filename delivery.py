"""
Delivery provider architecture for M1lipStore.

Checkout code never talks to Nova Poshta / Ukrposhta / MIST directly — it
goes through DeliveryService, which picks the right Provider by id. Every
provider implements the same small interface (search_cities /
search_warehouses), so adding, removing, or swapping a carrier never touches
checkout code.

    Checkout -> DeliveryService -> Provider -> real carrier API

None of the three real carrier APIs are wired up yet — there are no API keys
configured, so every provider below is a clean stub that raises
DeliveryProviderNotConfigured instead of pretending to return real cities or
warehouses. This is intentional: fabricated addresses would end up on real
orders. Once you have credentials for a carrier:

  1. Set the matching environment variable (see each provider's `configured`
     property).
  2. Implement the two TODO'd methods on that provider using the real API —
     map its response into the small dict shapes documented on
     DeliveryProvider below.
  3. Nothing else needs to change: DeliveryService, the /api/delivery/*
     endpoints in main.py, and the checkout UI already call through the same
     interface and will start working with real data automatically.
"""
import os
from abc import ABC, abstractmethod


class DeliveryProviderNotConfigured(Exception):
    """Raised when a provider's API key/credentials aren't set yet.
    Endpoints turn this into a 503 with a clear, honest message instead of
    ever returning fake cities/warehouses."""

    def __init__(self, provider_label: str):
        self.provider_label = provider_label
        super().__init__(f"{provider_label} is not configured yet")


class DeliveryProviderError(Exception):
    """Raised when a real carrier API call fails (network error, bad
    response, rate limit, etc). Endpoints turn this into a 502 so the
    frontend can show a 'Повторити' retry button."""
    pass


class DeliveryProvider(ABC):
    """
    id/label identify the provider to the frontend and to orders.

    search_cities(query) -> list of {"ref": str, "name": str, "region": str}
        `ref` is the carrier's own unique id for that city/settlement —
        this is what gets stored on the order, never just the display name.

    search_warehouses(city_ref, query) -> list of
        {"ref": str, "name": str, "address": str, "type": "branch"|"postomat"|"pickup"}
        `ref` is again the carrier's unique id for that specific warehouse —
        required so an order can never point at a warehouse that doesn't
        exist.
    """
    id: str = ""
    label: str = ""

    @property
    @abstractmethod
    def configured(self) -> bool:
        ...

    @abstractmethod
    async def search_cities(self, query: str) -> list:
        ...

    @abstractmethod
    async def search_warehouses(self, city_ref: str, query: str = "") -> list:
        ...


class NovaPoshtaProvider(DeliveryProvider):
    id = "nova_poshta"
    label = "Нова Пошта"

    def __init__(self):
        self.api_key = os.environ.get("NOVA_POSHTA_API_KEY", "")

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    async def search_cities(self, query: str) -> list:
        if not self.configured:
            raise DeliveryProviderNotConfigured(self.label)
        # TODO: POST to https://api.novaposhta.ua/v2.0/json/ with
        # modelName=Address, calledMethod=getCities, methodProperties
        # {"FindByString": query}. Map each row to
        # {"ref": row["Ref"], "name": row["Description"], "region": row["AreaDescription"]}.
        raise DeliveryProviderNotConfigured(self.label)

    async def search_warehouses(self, city_ref: str, query: str = "") -> list:
        if not self.configured:
            raise DeliveryProviderNotConfigured(self.label)
        # TODO: modelName=Address, calledMethod=getWarehouses, methodProperties
        # {"CityRef": city_ref, "FindByString": query}. Map TypeOfWarehouse
        # containing "Поштомат" to type "postomat", everything else to "branch".
        raise DeliveryProviderNotConfigured(self.label)


class UkrposhtaProvider(DeliveryProvider):
    id = "ukrposhta"
    label = "Укрпошта"

    def __init__(self):
        self.api_key = os.environ.get("UKRPOSHTA_API_KEY", "")

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    async def search_cities(self, query: str) -> list:
        if not self.configured:
            raise DeliveryProviderNotConfigured(self.label)
        # TODO: call Ukrposhta's settlement/city-search endpoint with this
        # api_key, map to {"ref", "name", "region"}.
        raise DeliveryProviderNotConfigured(self.label)

    async def search_warehouses(self, city_ref: str, query: str = "") -> list:
        if not self.configured:
            raise DeliveryProviderNotConfigured(self.label)
        # TODO: call Ukrposhta's post-office search endpoint scoped to
        # city_ref, map to {"ref", "name", "address", "type": "branch"}.
        raise DeliveryProviderNotConfigured(self.label)


class MistProvider(DeliveryProvider):
    id = "mist"
    label = "MIST"

    def __init__(self):
        self.api_key = os.environ.get("MIST_API_KEY", "")

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    async def search_cities(self, query: str) -> list:
        if not self.configured:
            raise DeliveryProviderNotConfigured(self.label)
        # TODO: wire up once MIST API credentials exist.
        raise DeliveryProviderNotConfigured(self.label)

    async def search_warehouses(self, city_ref: str, query: str = "") -> list:
        if not self.configured:
            raise DeliveryProviderNotConfigured(self.label)
        raise DeliveryProviderNotConfigured(self.label)


class PickupProvider(DeliveryProvider):
    """Self-pickup from the shop's own point/warehouse — no external API.
    Set PICKUP_ADDRESS once you have a physical point; until then it stays
    unconfigured like the others, so it simply won't be offered at checkout."""
    id = "pickup"
    label = "Самовивіз"

    def __init__(self):
        self.address = os.environ.get("PICKUP_ADDRESS", "")

    @property
    def configured(self) -> bool:
        return bool(self.address)

    async def search_cities(self, query: str) -> list:
        return []

    async def search_warehouses(self, city_ref: str, query: str = "") -> list:
        if not self.configured:
            raise DeliveryProviderNotConfigured(self.label)
        return [{"ref": "pickup", "name": self.address, "address": self.address, "type": "pickup"}]


class DeliveryService:
    """Single entry point checkout code talks to. Looks up the right
    provider by id so callers never import a concrete provider class
    directly — this is the seam that keeps checkout carrier-agnostic."""

    def __init__(self):
        self._providers = {
            p.id: p for p in [
                NovaPoshtaProvider(),
                UkrposhtaProvider(),
                MistProvider(),
                PickupProvider(),
            ]
        }

    def list_providers(self) -> list:
        return [
            {"id": p.id, "name": p.label, "configured": p.configured}
            for p in self._providers.values()
        ]

    def get(self, provider_id: str) -> DeliveryProvider:
        provider = self._providers.get(provider_id)
        if not provider:
            raise KeyError(provider_id)
        return provider


# One shared instance — providers are stateless aside from reading their API
# key once at startup, so a single service can be imported wherever needed.
delivery_service = DeliveryService()