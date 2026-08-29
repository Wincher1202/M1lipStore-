"""Delivery provider adapters for M1lipStore.

Only real carrier data is accepted by checkout. No manual/fake branches are
allowed. Configure the carrier credentials in environment variables.
"""
import os
import httpx
from abc import ABC, abstractmethod


class DeliveryProviderNotConfigured(Exception):
    def __init__(self, provider_label: str):
        self.provider_label = provider_label
        super().__init__(f"{provider_label} is not configured")


class DeliveryProviderError(Exception):
    pass


class DeliveryProvider(ABC):
    id = ""
    label = ""

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
    url = "https://api.novaposhta.ua/v2.0/json/"

    def __init__(self):
        self.api_key = os.environ.get("NOVA_POSHTA_API_KEY", "").strip()

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    async def _call(self, model: str, method: str, props: dict):
        if not self.configured:
            raise DeliveryProviderNotConfigured(self.label)
        payload = {
            "apiKey": self.api_key,
            "modelName": model,
            "calledMethod": method,
            "methodProperties": props,
        }
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.post(self.url, json=payload)
                r.raise_for_status()
                data = r.json()
        except Exception as exc:
            raise DeliveryProviderError(str(exc)) from exc
        if not data.get("success"):
            errors = data.get("errors") or data.get("warnings") or ["Nova Poshta API error"]
            raise DeliveryProviderError("; ".join(map(str, errors)))
        return data.get("data") or []

    async def search_cities(self, query: str) -> list:
        rows = await self._call("Address", "getCities", {"FindByString": query, "Page": 1})
        result = []
        for row in rows[:30]:
            result.append({
                "ref": str(row.get("Ref", "")),
                "name": row.get("Description", ""),
                "region": row.get("AreaDescription", ""),
            })
        return [x for x in result if x["ref"] and x["name"]]

    async def search_warehouses(self, city_ref: str, query: str = "") -> list:
        rows = await self._call("Address", "getWarehouses", {
            "CityRef": city_ref,
            "FindByString": query,
            "Limit": 100,
            "Page": 1,
        })
        result = []
        q = query.strip().lower()
        for row in rows:
            name = row.get("Description", "")
            address = row.get("ShortAddress", "") or row.get("Description", "")
            typ = row.get("TypeOfWarehouse", "") or ""
            item_type = "postomat" if "поштомат" in typ.lower() or "postomat" in typ.lower() else "branch"
            if q and q not in name.lower() and q not in str(row.get("Number", "")).lower():
                continue
            result.append({
                "ref": str(row.get("Ref", "")),
                "name": name,
                "address": address,
                "type": item_type,
            })
        return [x for x in result if x["ref"] and x["name"]][:100]


class UkrposhtaProvider(DeliveryProvider):
    id = "ukrposhta"
    label = "Укрпошта"

    def __init__(self):
        # Ukrposhta's current API requires account credentials/token.
        self.token = os.environ.get("UKRPOSHTA_TOKEN", "").strip()
        self.base_url = os.environ.get("UKRPOSHTA_API_URL", "https://www.ukrposhta.ua")

    @property
    def configured(self) -> bool:
        return bool(self.token)

    async def search_cities(self, query: str) -> list:
        # The Address Classifier is an authenticated Ukrposhta API. Keep this
        # adapter explicit rather than fabricating a branch list if credentials
        # are missing or the account has not enabled the classifier.
        raise DeliveryProviderNotConfigured(self.label)

    async def search_warehouses(self, city_ref: str, query: str = "") -> list:
        raise DeliveryProviderNotConfigured(self.label)


class MistProvider(DeliveryProvider):
    id = "mist"
    label = "MIST"

    def __init__(self):
        self.api_key = os.environ.get("MIST_API_KEY", "").strip()

    @property
    def configured(self) -> bool:
        # Meest states that its API integration is available to clients with
        # a contract; credentials/endpoints are supplied by the account manager.
        return bool(self.api_key)

    async def search_cities(self, query: str) -> list:
        raise DeliveryProviderNotConfigured(self.label)

    async def search_warehouses(self, city_ref: str, query: str = "") -> list:
        raise DeliveryProviderNotConfigured(self.label)


class DeliveryService:
    def __init__(self):
        self._providers = {
            p.id: p for p in [NovaPoshtaProvider(), UkrposhtaProvider(), MistProvider()]
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


delivery_service = DeliveryService()