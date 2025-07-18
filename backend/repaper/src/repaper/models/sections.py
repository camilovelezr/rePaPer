"""Sections model."""

from pydantic import BaseModel, Field


class Section(BaseModel):
    pages: list[int] = Field(
        ..., description="The list of pages' indices that belong to the section"
    )
    title: str = Field(..., description="The title of the section")
    subsections: list[str] = Field(..., description="A list of subsections")
    instructions: str = Field(
        ...,
        description="Very specific instructions for the summarizing expert",
        example="Be sure to include the symptoms of urticaria in the section.",
    )


class Sections(BaseModel):
    title: str = Field(..., description="The title of the document")
    background: str = Field(
        ...,
        description="A background to be given to all experts. E.g: you are analyzing a document about ___ for ___...",
    )
    sections: list[Section] = Field(
        ...,
        description="A list of sections",
    )
    language: str = Field(
        default="English",
        description="The language that must be used for the final output",
    )
