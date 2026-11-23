import os
import json
from typing import Any, Dict

from anthropic import Anthropic
from dotenv import load_dotenv

from .base import BaseProvider


class ClaudeProvider(BaseProvider):
    async def initialize(self, config: Dict[str, Any]) -> None:
        load_dotenv()
        api_key = config.get("apiKey") or os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not found")
        self.client = Anthropic(api_key=api_key)
        self.model_name = config.get("model", "claude-sonnet-4-6")
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

        response = self.client.messages.create(
            model=self.model_name,
            max_tokens=self.max_tokens,
            temperature=self.temperature,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )

        text = response.content[0].text.strip()

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
