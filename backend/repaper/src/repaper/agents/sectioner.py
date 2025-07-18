"""Sectioner Agent."""

from io import BytesIO
from PyPDF2 import PdfReader, PdfWriter

from pydantic_ai import Agent, BinaryContent

import logfire

from repaper.prompts import SECTIONER_PROMPT
from repaper.models.sections import Sections
from repaper.models.models import LLM_MODELS

logfire.configure()
logfire.instrument_pydantic_ai()


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


sectioner = Agent(
    system_prompt=SECTIONER_PROMPT,
    output_type=Sections,
    instrument=True,
)


async def run_sectioner(pdf_bytes: bytes, instructions: str, model: str):
    logfire.debug(f"Running sectioner with model: {model}")
    res = await sectioner.run(
        [
            instructions,
            BinaryContent(data=pdf_bytes, media_type="application/pdf"),
        ],
        model=LLM_MODELS[model],
    )
    return res
