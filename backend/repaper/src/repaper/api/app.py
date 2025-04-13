from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.responses import StreamingResponse, JSONResponse
from sse_starlette.sse import EventSourceResponse
from fastapi.middleware.cors import CORSMiddleware
import io
import asyncio
import json
from typing import Optional

from repaper.agents.summarizer import (
    run_orchestrator,
    mini_summarizer,
    MiniSummarizerDeps,
    LLM_MODEL_KEYS,
    LLM_MODELS,
)
from repaper.agents.md_to_pdf import convert_markdown_to_pdf
from pydantic_ai import BinaryContent
from pydantic import BaseModel

app = FastAPI(
    title="RePaPer API",
    description="API for document summarization",
    # Disable automatic redirects for trailing slashes
    redirect_slashes=False,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


async def summarize_generator(
    pdf_content: bytes, instructions: str, model: Optional[str]
):
    """Async generator for summarization process, yielding progress updates."""
    try:
        # 1. Run Orchestrator
        yield json.dumps(
            {"event": "progress", "data": "Analyzing document structure..."}
        )
        orchestration_result = await run_orchestrator(pdf_content, instructions, model)
        total_sections = len(orchestration_result.data.sections)
        yield json.dumps(
            {
                "event": "progress",
                "data": f"Document divided into {total_sections} sections. Starting summarization...",
                "title": orchestration_result.data.title,  # Send title early
            }
        )
        await asyncio.sleep(0.1)  # Allow event to send

        complete_summary = f"{orchestration_result.data.title}\n\n"
        summarized_sections = 0

        # 2. Process each section
        for section in orchestration_result.data.sections:
            summarized_sections += 1
            yield json.dumps(
                {
                    "event": "progress",
                    "data": f"Summarizing section {summarized_sections}/{total_sections} (Pages: {', '.join(map(str, section.pages))})...",
                }
            )
            await asyncio.sleep(0.1)  # Allow event to send

            # Extract pages for this section
            section_pdf = extract_pdf_pages_from_bytes(pdf_content, section.pages)

            summary_result = await mini_summarizer.run(
                [
                    BinaryContent(
                        data=section_pdf,
                        media_type="application/pdf",
                    )
                ],
                deps=MiniSummarizerDeps(
                    section=section,
                    background=orchestration_result.data.background,
                    language=orchestration_result.data.language,
                ),
                model=LLM_MODELS.get(model),  # Use .get for safety
            )

            # Add to the complete summary
            section_summary = summary_result.data + "\n\n"
            complete_summary += section_summary

            # Yield the summary part for this section
            yield json.dumps(
                {
                    "event": "section_summary",
                    "data": section_summary,
                    "section_number": summarized_sections,
                    "total_sections": total_sections,
                }
            )
            await asyncio.sleep(0.1)  # Allow event to send

        # 3. Send final complete summary
        yield json.dumps(
            {
                "event": "complete",
                "data": complete_summary,
                "title": orchestration_result.data.title,
            }
        )

    except Exception as e:
        # Yield an error event
        error_message = f"An error occurred: {str(e)}"
        yield json.dumps({"event": "error", "data": error_message})
        # Optionally re-raise or log here
        print(f"Error during summarization: {e}")  # Log error


@app.get("/api/models")
async def get_models():
    return LLM_MODEL_KEYS


@app.post("/api/summarize")
async def summarize_pdf(
    file: UploadFile = File(...),
    instructions: str = Form(...),
    model: Optional[str] = Form(None),
) -> EventSourceResponse:
    """
    Endpoint to summarize a PDF document using Server-Sent Events (SSE).

    Streams progress updates and the final summary.
    Events:
        - {"event": "progress", "data": "Status message..."}
        - {"event": "section_summary", "data": "Markdown summary for section...", "section_number": N, "total_sections": M}
        - {"event": "complete", "data": "Full markdown summary", "title": "Document Title"}
        - {"event": "error", "data": "Error message..."}
    """
    try:
        # Read the uploaded PDF file
        pdf_content = await file.read()

        # Return an EventSourceResponse with the generator
        return EventSourceResponse(
            summarize_generator(pdf_content, instructions, model)
        )

    except Exception as e:
        # This initial exception handling might be less likely to be hit
        # if file reading fails, but good practice.
        # The main error handling is inside the generator now.
        print(f"Error before starting generator: {e}")
        # We can't easily return an EventSourceResponse here if the initial read fails.
        # A standard HTTP error might be more appropriate in this specific case.
        raise HTTPException(
            status_code=500, detail=f"Failed to read file or start process: {str(e)}"
        )


class MarkdownToPdfRequest(BaseModel):
    markdown: str
    title: Optional[str]


@app.post("/api/markdown-to-pdf")
async def markdown_to_pdf(request: MarkdownToPdfRequest):
    """Convert markdown to PDF."""
    try:
        print(f"Converting markdown to PDF: {request.title}")
        pdf_bytes = convert_markdown_to_pdf(
            title=request.title, input_markdown=request.markdown, return_bytes=True
        )
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="document.pdf"'},
        )
    except Exception as e:
        # print(f"PDF generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/summarize-to-pdf")
async def summarize_to_pdf(
    file: UploadFile = File(...),
    instructions: str = Form(...),
    model: Optional[str] = Form(None),
):
    """
    Endpoint to summarize a PDF document and return the result as a PDF.

    Args:
        file: The PDF file to summarize
        instructions: User instructions for the summarizer
        model: LLM model to use for summarization
        language: Output language for the summary

    Returns:
        PDF file with the summary as a download
    """
    try:
        # Read the uploaded PDF file
        pdf_content = await file.read()

        # Use the orchestrator to create sections
        orchestration_result = await run_orchestrator(pdf_content, instructions, model)

        # Prepare for summarizing each section with proper h1 header
        complete_summary = f"# {orchestration_result.data.title}\n\n"

        # Process each section
        for section in orchestration_result.data.sections:
            # Extract pages for this section
            section_pdf = extract_pdf_pages_from_bytes(pdf_content, section.pages)

            # Summarize this section
            summary_result = await mini_summarizer.run(
                [
                    BinaryContent(
                        data=section_pdf,
                        media_type="application/pdf",
                    )
                ],
                deps=MiniSummarizerDeps(
                    section=section,
                    background=orchestration_result.data.background,
                    language=orchestration_result.data.language,
                ),
                model=LLM_MODELS.get(model),
            )

            # Add to the complete summary
            complete_summary += summary_result.data + "\n\n"

        # Convert markdown to PDF bytes
        title = orchestration_result.data.title
        pdf_bytes = convert_markdown_to_pdf(complete_summary, title, return_bytes=True)

        # Return the PDF as a downloadable file
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{title.replace(" ", "_")}.pdf"'
            },
        )

    except Exception as e:
        print(f"Error during summarization: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def extract_pdf_pages_from_bytes(pdf_bytes, page_numbers):
    """
    Extract specific pages from PDF bytes and return them as bytes.

    Args:
        pdf_bytes (bytes): The PDF file as bytes
        page_numbers (list): List of page numbers to extract (1-indexed)

    Returns:
        bytes: The extracted pages as PDF bytes
    """
    from PyPDF2 import PdfReader, PdfWriter

    # Create a BytesIO object from the bytes
    pdf_io = io.BytesIO(pdf_bytes)

    # Open the PDF file
    reader = PdfReader(pdf_io)

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

    # Write the output to a BytesIO object
    output_pdf = io.BytesIO()
    writer.write(output_pdf)

    # Get the bytes from the BytesIO object
    output_pdf.seek(0)
    return output_pdf.getvalue()
