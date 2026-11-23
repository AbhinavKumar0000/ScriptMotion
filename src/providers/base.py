from abc import ABC, abstractmethod
from typing import Any, Dict


class BaseProvider(ABC):
    def __init__(self) -> None:
        self._initialized = False
        self.config: Dict[str, Any] = {}

    @abstractmethod
    async def initialize(self, config: Dict[str, Any]) -> None:
        self.config = config
        self._initialized = True

    @abstractmethod
    async def generate_spec(self, context: Dict[str, Any]) -> Dict[str, Any]:
        raise NotImplementedError

    @property
    def is_initialized(self) -> bool:
        return self._initialized


class ProviderRegistry:
    def __init__(self) -> None:
        self._providers: Dict[str, BaseProvider] = {}

    def register(self, provider: BaseProvider) -> None:
        name = provider.__class__.__name__.replace("Provider", "").lower()
        self._providers[name] = provider

    def get(self, name: str) -> BaseProvider | None:
        return self._providers.get(name.lower())
