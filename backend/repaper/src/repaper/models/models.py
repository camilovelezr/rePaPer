"""LLMs for rePaPer."""

LLM_MODELS = {
    "Gemini 2.5 Flash": "google-gla:gemini-2.5-flash",
    "Gemini 2.5 Pro": "google-gla:gemini-2.5-pro",
    "Claude 4 Sonnet": "anthropic:claude-4-sonnet-20250514",
    "Claude 4 Opus": "anthropic:claude-4-opus-latest",
    "Claude 3.5 Haiku": "anthropic:claude-opus-4-20250514",
    "GPT-4.1": "openai:gpt-4.1",
    "GPT-4.1-mini": "openai:gpt-4.1-mini",
    "GPT-4.1-nano": "openai:gpt-4.1-nano",
    "GPT-4o": "openai:gpt-4o-latest",
    "o4-mini": "openai:o4-mini",
}

LLM_MODEL_KEYS = list(LLM_MODELS.keys())
