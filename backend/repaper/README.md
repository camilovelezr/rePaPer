# rePaPer Backend Service

This directory contains the FastAPI backend service for rePaPer.

## Setup

Refer to the main project [README.md](../../README.md) for setup instructions (both Docker and manual).

## Environment Variables

Configuration for the backend is managed through environment variables. A sample configuration file is provided in `.env.sample`.

To configure the service, copy the `.env.sample` file to `.env` in this directory (`backend/repaper/.env`) and fill in the required values:

```bash
cp .env.sample .env
```

Then, edit the `.env` file with your actual API keys:

```dotenv
# API Keys (required for using each AI model)
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# Optional: Logfire Configuration (if used)
# LOGFIRE_TOKEN=your_logfire_token_here
```

*   `ANTHROPIC_API_KEY`: Your API key from Anthropic for Claude models.
*   `GEMINI_API_KEY`: Your API key from Google AI Studio for Gemini models.
*   `LOGFIRE_TOKEN` (Optional): If you have integrated Logfire, provide your token here to enable sending logs.

## Logging

This service uses [Logfire](https://logfire.pydantic.dev/) for enhanced logging and observability.

If a `LOGFIRE_TOKEN` is provided in the `.env` file, logs will be automatically sent to your Logfire dashboard.

Check the Logfire documentation for details on how to view and analyze your application logs.

## API

The API is built using FastAPI. While running, you can access the interactive API documentation (Swagger UI) at `http://localhost:8000/docs`.
