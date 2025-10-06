from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse
from fastapi.middleware.cors import CORSMiddleware
import io
import asyncio
import json
from typing import Optional

from PyPDF2 import PdfReader, PdfWriter
from repaper.agents.sectioner import run_sectioner
from repaper.models import LLM_MODELS, LLM_MODEL_KEYS
from repaper.agents.summarizer import SummarizerDeps, summarizer
from repaper.agents.md_to_pdf import convert_markdown_to_pdf
from pydantic_ai import BinaryContent
from pydantic_ai.models import ModelSettings
from pydantic import BaseModel

import logfire

logfire.configure()
logfire.instrument_pydantic_ai()

app = FastAPI(
    title="RePaPer API",
    description="API for document summarization",
    # Disable automatic redirects for trailing slashes
    redirect_slashes=False,
)

logfire.instrument_fastapi(app)
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
        logfire.info("Analyzing document structure...")
        yield json.dumps(
            {"event": "progress", "data": "Analyzing document structure..."}
        )
        orchestration_result = await run_sectioner(pdf_content, instructions, model)
        logfire.debug("Orchestrator result", result=str(orchestration_result))
        total_sections = len(orchestration_result.output.sections)
        json_response = {
            "event": "progress",
            "data": f"Document divided into {total_sections} sections. Starting summarization...",
            "title": orchestration_result.output.title,  # Send title early
            "total_sections": total_sections,
        }
        logfire.debug(
            "Orchestrator progress JSON response",
            json_response=json.dumps(json_response),
        )
        yield json.dumps(json_response)
        await asyncio.sleep(0.1)  # Allow event to send

        complete_summary = f"{orchestration_result.output.title}\n\n"
        summarized_sections = 0

        # 2. Process each section
        with logfire.span("Summarizing sections") as span:
            try:
                for section in orchestration_result.output.sections:
                    span.message
                    json_response = {
                        "event": "progress",
                        "data": f"Summarizing section {summarized_sections}/{total_sections} (Pages: {', '.join(map(str, section.pages))})...",
                    }
                    logfire.debug(
                        "Section summary progress JSON response",
                        json_response=json.dumps(json_response),
                    )
                    yield json.dumps(json_response)
                    await asyncio.sleep(0.1)  # Allow event to send

                    # Extract pages for this section
                    section_pdf = extract_pdf_pages_from_bytes(
                        pdf_content, section.pages
                    )
                    logfire.info("Extracted section PDF")
                    if summarized_sections == 0:
                        deps_ = SummarizerDeps(
                            section=section,
                            background=orchestration_result.output.background,
                            language=orchestration_result.output.language,
                            previous_summary="null",
                        )
                    else:
                        deps_ = SummarizerDeps(
                            section=section,
                            background=orchestration_result.output.background,
                            language=orchestration_result.output.language,
                            previous_summary=complete_summary,
                        )

                    summary_result = await summarizer.run(
                        [
                            BinaryContent(
                                data=section_pdf,
                                media_type="application/pdf",
                            )
                        ],
                        deps=deps_,
                        model=LLM_MODELS.get(model),  # Use .get for safety
                    )

                    # Add to the complete summary
                    section_summary = summary_result.output + "\n\n"
                    complete_summary += section_summary
                    summarized_sections += 1

                    # Yield the summary part for this section
                    json_response = {
                        "event": "section_summary",
                        "data": section_summary,
                        "section_number": summarized_sections,
                        "total_sections": total_sections,
                    }
                    logfire.debug(
                        "Section summary JSON response",
                        json_response=json.dumps(json_response),
                    )
                    yield json.dumps(json_response)
                    await asyncio.sleep(0.1)  # Allow event to send
            except Exception as e:
                logfire.error("Error during summarization", error=str(e))
                yield json.dumps({"event": "error", "data": str(e)})

        # Add a longer delay to ensure all section summaries are sent
        await asyncio.sleep(0.5)  # Give time for all events to flush

        # 3. Send final complete signal (no data needed)
        json_response = {
            "event": "complete",
            "title": orchestration_result.output.title,  # Still send title
        }
        logfire.debug(
            "Final completion signal", json_response=json.dumps(json_response)
        )
        yield json.dumps(json_response)

    except Exception as e:
        logfire.error("Error during summarization", error=str(e))
        # Yield an error event
        error_message = f"An error occurred: {str(e)}"
        yield json.dumps({"event": "error", "data": error_message})
        # Optionally re-raise or log here


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
        logfire.info(
            "Reading uploaded PDF file", filename=file.filename, size=file.size
        )
        pdf_content = await file.read()

        # Return an EventSourceResponse with the generator
        return EventSourceResponse(
            summarize_generator(pdf_content, instructions, model)
        )

    except Exception as e:
        # This initial exception handling might be less likely to be hit
        # if file reading fails, but good practice.
        # The main error handling is inside the generator now.
        # We can't easily return an EventSourceResponse here if the initial read fails.
        logfire.error("Error before starting generator", error=str(e))
        # A standard HTTP error might be more appropriate in this specific case.
        raise HTTPException(
            status_code=500, detail=f"Failed to read file or start process: {str(e)}"
        )


class MarkdownToPdfRequest(BaseModel):
    markdown: str
    title: Optional[str]


class MarkdownDownloadRequest(BaseModel):
    markdown: str
    title: Optional[str]


@app.post("/api/markdown-to-pdf")
async def markdown_to_pdf(request: MarkdownToPdfRequest):
    """Convert markdown to PDF."""
    try:
        logfire.info("Converting markdown to PDF", title=request.title)
        pdf_bytes = convert_markdown_to_pdf(
            title=request.title, input_markdown=request.markdown, return_bytes=True
        )
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="document.pdf"'},
        )
    except Exception as e:
        logfire.error("PDF generation error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/download-markdown")
async def download_markdown(request: MarkdownDownloadRequest):
    """Download markdown as .md file."""
    try:
        logfire.info("Downloading markdown", title=request.title)
        filename = (
            f"{request.title.replace(' ', '_')}.md" if request.title else "document.md"
        )

        return StreamingResponse(
            io.BytesIO(request.markdown.encode("utf-8")),
            media_type="text/markdown",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        logfire.error("Markdown download error", error=str(e))
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
        logfire.info("Starting summarize_to_pdf")
        # Read the uploaded PDF file
        pdf_content = await file.read()

        # Use the orchestrator to create sections
        orchestration_result = await run_orchestrator(pdf_content, instructions, model)
        # Prepare for summarizing each section with proper h1 header
        complete_summary = f"# {orchestration_result.output.title}\n\n"

        # Process each section
        for section in orchestration_result.output.sections:
            logfire.info("Summarizing section", section=str(section))
            # Extract pages for this section
            section_pdf = extract_pdf_pages_from_bytes(pdf_content, section.pages)
            logfire.info("Extracted section PDF", size=len(section_pdf))
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
                    background=orchestration_result.output.background,
                    language=orchestration_result.output.language,
                ),
                model=LLM_MODELS.get(model),
                model_settings=ModelSettings(
                    temperature=1 if model == "o4-mini" else 0.25,
                ),
            )

            # Add to the complete summary
            logfire.info("Summary result", output=summary_result.output)
            complete_summary += summary_result.output + "\n\n"
        # Convert markdown to PDF bytes
        title = orchestration_result.output.title
        pdf_bytes = convert_markdown_to_pdf(complete_summary, title, return_bytes=True)
        logfire.info("PDF bytes", size=len(pdf_bytes))
        # Return the PDF as a downloadable file
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{title.replace(" ", "_")}.pdf"'
            },
        )

    except Exception as e:
        logfire.error("Error during summarization", error=str(e))
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
    logfire.info("Extracting pages from PDF", size=len(pdf_bytes))
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
