import os
import json
from typing import Any, Dict

import google.generativeai as genai
from dotenv import load_dotenv

from .base import BaseProvider


class GeminiProvider(BaseProvider):
    async def initialize(self, config: Dict[str, Any]) -> None:
        load_dotenv()
        api_key = config.get("apiKey") or os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found")
        genai.configure(api_key=api_key)
        self.model_name = config.get("model", "gemini-2.5-pro")
        self.temperature = config.get("temperature", 0.25)
        self.max_tokens = config.get("maxTokens", 65536)
        self.timeout = config.get("timeout", 120)
        self._initialized = True

    async def generate_spec(self, context: Dict[str, Any]) -> Dict[str, Any]:
        topic = context.get("topic", "")
        task = context.get("task", "spec")

        # Support custom system prompt and user prompt
        system_prompt = context.get("system_prompt")
        user_prompt = context.get("prompt")

        if not system_prompt:
            system_prompt = f"""You are an expert educational video generator. You produce a JSON VideoSpec for Remotion-based educational animations.

Topic: {topic}
Task: {task}

Return ONLY valid JSON matching the VideoSpec schema. Include scenes, nodes, edges, beats, layout config, and all required fields. No markdown fences, no prose."""

        if not user_prompt:
            user_prompt = f"Generate a complete VideoSpec JSON for teaching: {topic}"

        model = genai.GenerativeModel(
            model_name=self.model_name,
            system_instruction=system_prompt,
            generation_config=genai.GenerationConfig(
                temperature=self.temperature,
                max_output_tokens=self.max_tokens,
                candidate_count=1,
            ),
        )

        response = model.generate_content(user_prompt)
        text = response.text.strip()

        # Clean markdown fences
        for fence in ("```json", "```typescript", "```ts", "```jsx", "```js", "```tsx", "```"):
            if text.startswith(fence):
                text = text.split("\n", 1)[1]
                break
        if text.endswith("```"):
            text = text.rsplit("```", 1)[0]

        text = text.strip()

        # If task is "component" or "fix", return the raw TSX string
        if task in ("component", "fix"):
            return text

        # Otherwise parse as JSON (VideoSpec)
        return json.loads(text)
