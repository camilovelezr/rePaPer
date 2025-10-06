"""Summarizer models."""

from pydantic import BaseModel
from pydantic_ai import Agent, RunContext
from pydantic_ai.models import ModelSettings
from pydantic_ai.usage import Usage
import logfire

from repaper.models.models import LLM_MODELS
from repaper.prompts import SUMMARIZER_PROMPT
from repaper.models.sections import Section

logfire.configure()
logfire.instrument_pydantic_ai()


class SummarizerDeps(BaseModel):
    section: Section
    background: str
    language: str
    previous_summary: str


summarizer = Agent(
    system_prompt=SUMMARIZER_PROMPT,
    deps_type=SummarizerDeps,
    output_type=str,
    instrument=True,
)


@summarizer.system_prompt
async def system_prompt(ctx: RunContext[SummarizerDeps]) -> str:
    return f"""
    <background>
    {ctx.deps.background}
    </background>
    <title>
    {ctx.deps.section.title}
    </title>
    <subsections>
    {ctx.deps.section.subsections}
    </subsections>
    <instructions>
    {ctx.deps.section.instructions}
    </instructions>
    <language>
    Output your response in {ctx.deps.language}. VERY IMPORTANT.
    </language>
    <previous_summary>
    {ctx.deps.previous_summary}
    </previous_summary>
    """
