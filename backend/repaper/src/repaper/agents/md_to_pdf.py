"""PDF generator from markdown with math support."""

import io
from pathlib import Path

import fitz  # PyMuPDF
from markdown_pdf import MarkdownPdf, Section


def convert_markdown_to_pdf(
    input_markdown: str | Path,
    title: str,
    output_file=None,
    toc_level=2,
    return_bytes=False,
):
    """
    Convert markdown to PDF using the markdown-pdf library.

    Args:
        input_markdown (str): Either path to markdown file or markdown string content
        title (str): Title for the PDF document
        output_file (str, optional): Path for the output PDF file.
                                    If None and return_bytes is False, uses the same name as input with .pdf extension.
        toc_level (int, optional): Maximum heading level to include in table of contents.
                                  Default is 2 (h1, h2).
        return_bytes (bool, optional): If True, returns the PDF as bytes instead of saving to file.

    Returns:
        str or bytes: Path to the generated PDF file or PDF content as bytes
    """

    # Create a PDF with table of contents from headings up to specified level
    pdf = MarkdownPdf(toc_level=toc_level)

    # Read the markdown content
    if isinstance(input_markdown, Path):
        # It's a file path
        with input_markdown.open("r") as f:
            md_content = f.read()
    else:
        # It's already markdown content
        md_content = input_markdown

    if title:
        md_content = f"# {title}\n\n{md_content}"
    else:
        md_content = f"# Summary\n\n{md_content}"

    # CSS styling
    css = """
    /* Global styles */
    * {
        background-color: transparent !important;
        -webkit-print-color-adjust: exact;
    }

    body {
        font-size: 12pt;
        line-height: 1.35;
        margin: 1.1cm;
        background-color: white !important;
    }

    /* Headings */
    h1, h2, h3, h4, h5, h6 {
        background-color: transparent !important;
        page-break-after: avoid;
        position: relative;
        z-index: 1;
        margin-top: 1.15em;
        margin-bottom: 0.52em;
    }

    h1 {
        font-size: 18pt;
        margin-top: 1.3em;
        margin-bottom: 0.8em;
    }

    h2 {
        font-size: 16pt;
        margin-top: 1.62em;
        margin-bottom: 0.81em;
    }

    h3, h4, h5, h6 {
        font-size: 14pt;
        margin-top: 1.35em;
        margin-bottom: 0.72em;
    }

    /* Container elements */
    section, div, article {
        background-color: transparent !important;
        margin-bottom: 1.35em;
    }

    /* Text elements */
    p {
        margin: 0.9em 0;
        line-height: 1.6;
    }

    /* Lists */
    ul, ol {
        margin-top: 0.9em;
        margin-bottom: 0.9em;
        padding-left: 2em;
    }

    li {
        margin: 0.45em 0;
        line-height: 1.4;
    }

    /* Tables */
    table {
        border-collapse: separate;
        border-spacing: 0;
        width: 100%;
        margin: 1.35em 0;
        font-size: 10pt;
        border: 1px solid #e2e8f0;
        border-radius: 6pt;
        overflow: hidden;
        page-break-inside: avoid;
    }

    th, td {
        padding: 8pt 12pt;
        text-align: left;
        border-bottom: 1px solid #e2e8f0;
        border-right: 1px solid #e2e8f0;
        vertical-align: top;
        line-height: 1.12;
    }

    th:last-child, td:last-child {
        border-right: none;
    }

    tr:last-child td {
        border-bottom: none;
    }

    th {
        background-color: #f8fafc;
        font-weight: bold;
        border-top: none;
        border-bottom: 2px solid #e2e8f0;
    }


    pre {
        background-color: #f5f5f5;
        padding: 0.9em;
        border-radius: 5pt;
        margin: 1.35em 0;
        font-size: 10pt;
        line-height: 1.4;
        overflow-x: auto;
        page-break-inside: avoid;
    }

    /* Images */
    img {
        max-width: 100%;
        height: auto;
        margin: 1.35em 0;
        page-break-inside: avoid;
    }

    /* Additional spacing controls */
    * + h1, * + h2, * + h3, * + h4, * + h5, * + h6 {
        margin-top: 1.2em;
    }

    table + p, pre + p, img + p {
        margin-top: 1.35em;
    }
    """

    # Add the content as a section with custom CSS
    pdf.add_section(Section(md_content, paper_size="Letter"), user_css=css)
    # pdf.add_section(Section(md_content, paper_size="Letter"))

    # Set metadata
    pdf.meta["title"] = title

    if return_bytes:
        # Return the PDF as bytes instead of saving to file
        pdf.writer.close()
        pdf.out_file.seek(0)
        doc = fitz.Story.add_pdf_links(pdf.out_file, pdf.hrefs)
        doc.set_metadata(pdf.meta)
        if pdf.toc_level > 0:
            doc.set_toc(pdf.toc)

        # Create a BytesIO object to store the PDF
        output_bytes = io.BytesIO()
        doc.save(output_bytes)
        doc.close()

        # Return bytes
        output_bytes.seek(0)
        return output_bytes.getvalue()
    else:
        # Set default output path if not provided
        if not output_file:
            output_file = "summary.pdf"

        # Save the PDF
        pdf.save(output_file)
        return output_file
