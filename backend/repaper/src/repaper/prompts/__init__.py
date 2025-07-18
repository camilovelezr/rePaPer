"""Prompts for rePaPer.

This module contains the prompts for the different agents in rePaPer.
"""

from pathlib import Path


SECTIONER_PROMPT = Path(__file__).parent.joinpath("sectioner.txt").read_text()


SUMMARIZER_PROMPT = Path(__file__).parent.joinpath("summarizer.txt").read_text()
