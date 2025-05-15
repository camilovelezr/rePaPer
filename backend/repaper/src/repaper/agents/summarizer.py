from io import BytesIO
from pydantic import BaseModel, Field
from PyPDF2 import PdfReader, PdfWriter

import logfire
from pydantic_ai import Agent, BinaryContent, RunContext

logfire.configure()
logfire.instrument_pydantic_ai()

LLM_MODELS = {
    "Gemini 2.5 Pro": "google-gla:gemini-2.5-pro-exp-03-25",
    "Gemini 2.5 Flash": "google-gla:gemini-2.5-flash-preview-04-17",
    "Gemini 2.5 Pro $": "google-gla:gemini-2.5-pro-preview-05-06",
    "Claude 3.7 Sonnet": "anthropic:claude-3-7-sonnet-latest",
    "Claude 3.5 Haiku": "anthropic:claude-3-5-haiku-latest",
    "Claude 3.5 Sonnet": "anthropic:claude-3-5-sonnet-latest",
    "GPT-4.1": "openai:gpt-4.1",
    "GPT-4.1-mini": "openai:gpt-4.1-mini",
    "GPT-4.1-nano": "openai:gpt-4.1-nano",
    "GPT-4o": "openai:gpt-4o-latest",
    "o4-mini": "openai:o4-mini",
}

LLM_MODEL_KEYS = list(LLM_MODELS.keys())


def extract_pdf_pages(pdf_path, page_numbers):
    """
    Extract specific pages from a PDF and return them as bytes.

    Args:
        pdf_path (str or Path): Path to the PDF file
        page_numbers (list): List of page numbers to extract (1-indexed)

    Returns:
        bytes: The extracted pages as PDF bytes
    """
    # Open the PDF file
    reader = PdfReader(pdf_path)

    # Create a writer for the output PDF
    writer = PdfWriter()

    # Get total page count to validate requested pages
    total_pages = len(reader.pages)

    # Add each requested page to the writer if it exists
    for page_num in page_numbers:
        # Convert 1-indexed to 0-indexed
        zero_indexed_page = page_num - 1

        # Skip invalid page numbers
        if 0 <= zero_indexed_page < total_pages:
            writer.add_page(reader.pages[zero_indexed_page])
        else:
            print(f"Warning: Page {page_num} is out of range (1-{total_pages})")

    # Write the output to a BytesIO object
    output_pdf = BytesIO()
    writer.write(output_pdf)

    # Get the bytes from the BytesIO object
    output_pdf.seek(0)
    return output_pdf.getvalue()


class Section(BaseModel):
    title: str = Field(description="The title of the section")
    subsections: list[str] = Field(description="A list of subsections")
    pages: list[int] = Field(description="The list of pages that belong to the section")
    instructions: str = Field(description="Instructions for the summarizing expert")


class Sections(BaseModel):
    title: str = Field(description="The title of the document")
    background: str = Field(
        description="A background to be given to all experts. E.g: you are analyzing a document about ___ for ___."
    )
    sections: list[Section] = Field(description="A list of sections")
    language: str = Field(
        default="English", description="The language that must be used for output"
    )


orchestrator_prompt = """
You are an expert linguist. You have decades of experience in reading PDFs,
and organizing all the sections it contains.
You are in charge of orchestrating a team of summarizing experts,
each expert must be provided with a section, instructions, and a set of PDF pages.
<goal>Create a list of sections and sub-sections for each section, where you
add specific instructions for the summarizing expert who will be assigned that
section. You must provide the number of the pages for each section in the documents (e.g 12-15).
You must also provide the language that must be used for output.
</goal>
<output_instructions>
Return a JSON with the following format (example values):
- title: <title of the document>
- background: "You are summarizing a document about X for a pediatrician"
- sections: [Section1, Section2, ...]
- language: "English" OR any other language (if not provided, default to English)

Each section has the following format:
- title: "Section X"
- subsections: [Subsection1, Subsection2, ...]
- pages: [1, 2, 3]
- instructions: "Be sure to include ... and ... in the summary"
</output_instructions>
If user adds specific instructions, or background about herself,
be sure to include it carefully in your object as you see fit.
The instructions are specific to how the final summary would be,
remember: YOU ARE NOT THE SUMMARIZING EXPERT, YOU ARE THE ORCHESTRATOR.
Your ONLY job is to return the JSON object with the sections and sub-sections, and the background
like 'You are summarizing a document about urticaria for a pediatrician' that will be given to the summarizing experts.
Clearly, the pages CAN overlap.
The first page of the document is 1.
You must only include pages that are relevant to a summary of the content of the document.
First read through the document, organize the sections and sub-sections, and then carefully
determine which pages are relevant to each section.
TO BE CLEAR: if user specifies an output language, you ONLY use that information
to determine the value of 'language', BUT your instructions and everything else MUST BE IN ENGLISH.
"""

orchestrator = Agent(
    system_prompt=orchestrator_prompt,
    output_type=Sections,
    instrument=True,
)


async def run_orchestrator(pdf_bytes: bytes, instructions: str, model: str):
    logfire.debug(f"Running orchestrator with model: {model}")
    res = await orchestrator.run(
        [
            instructions,
            BinaryContent(data=pdf_bytes, media_type="application/pdf"),
        ],
        model=LLM_MODELS[model],
    )
    return res


mini_summarizer_prompt = """
You are an expert in summarizing documents.
Your summaries are thorough and comprehensive.
But still, you must be concise.
<inputs>
- background: background about the document and your task, maybe your audience
- title: the title of the section you are summarizing
- subsections: the list of subsections you are going to summarize, ALL must be included
- instructions: specific instructions that you MUST follow
- language: the language you must use for your output
</inputs>
<goal>
Summarize the document, following the instructions and the background.
Making sure you are not missing any information.
</goal>
<output_instructions>
Format your response in markdown, github flavored. ONLY output the markdown, nothing else.
Be VERY THOROUGH.
</output_instructions>
Considerations:
- You are very thorough, you do not omit any information.
- Do not write 'The abstract says ...' or similar, instead just summarize the abstract or the section you are working on.
- The goal of the summary is not to be short, but to be comprehensive.
- Include tables (as markdown tables) if necessary.
- Include math equations (as INLINE latex equations) if necessary, ALWAYS enclose the equations in dollar signs.
- NEVER, AND I MEAN NEVER, include something that is NOT IN THE DOCUMENT.
- I REPEAT: DO NOT MAKE UP ANYTHING, DO NOT USE ANYTHING FROM YOUR KNOWLEDGE THAT IS NOT IN THE DOCUMENT.

Remember:
- Always enclose all latex equations in dollar signs.

Do not start your response with ```markdown, just output the markdown.
Do not start your response with something like "Here is the summary of the section <section title>".
"""


class MiniSummarizerDeps(BaseModel):
    section: Section
    background: str
    language: str


mini_summarizer = Agent(
    system_prompt=mini_summarizer_prompt,
    deps_type=MiniSummarizerDeps,
    output_type=str,
    instrument=True,
)


@mini_summarizer.system_prompt
async def system_prompt(ctx: RunContext[MiniSummarizerDeps]) -> str:
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
    """
