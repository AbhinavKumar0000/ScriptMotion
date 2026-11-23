import os
import json
from typing import Any, Dict

from openai import OpenAI
from dotenv import load_dotenv

from .base import BaseProvider


class NVIDIAProvider(BaseProvider):
    async def initialize(self, config: Dict[str, Any]) -> None:
        load_dotenv()
        api_key = config.get("apiKey") or os.getenv("NVIDIA_API_KEY")
        if not api_key:
            raise ValueError("NVIDIA_API_KEY not found")
        self.client = OpenAI(
            base_url="https://integrate.api.nvidia.com/v1",
            api_key=api_key,
        )
        self.model_name = config.get("model", "nvidia/nemotron-3-ultra-550b-a55b")
        self.temperature = config.get("temperature", 0.25)
        self.max_tokens = config.get("maxTokens", 65536)
        self.timeout = config.get("timeout", 120)
        self._initialized = True

    async def generate_spec(self, context: Dict[str, Any]) -> Dict[str, Any]:
        topic = context.get("topic", "")
        task = context.get("task", "spec")

        system_prompt = context.get("system_prompt")
        user_prompt = context.get("prompt")

        if not system_prompt:
            system_prompt = f"""You are an expert educational video generator. You produce a JSON VideoSpec for Remotion-based educational animations.

Topic: {topic}
Task: {task}

Return ONLY valid JSON matching the VideoSpec schema. Include scenes, nodes, edges, beats, layout config, and all required fields. No markdown fences, no prose."""

        if not user_prompt:
            user_prompt = f"Generate a complete VideoSpec JSON for teaching: {topic}"

        response = self.client.chat.completions.create(
            model=self.model_name,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )

        text = response.choices[0].message.content.strip()

        for fence in ("```json", "```typescript", "```ts", "```jsx", "```js", "```tsx", "```"):
            if text.startswith(fence):
                text = text.split("\n", 1)[1]
                break
        if text.endswith("```"):
            text = text.rsplit("```", 1)[0]

        text = text.strip()

        if task in ("component", "fix"):
            return text

        return json.loads(text)
