FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app

# Copy only the necessary files
COPY pyproject.toml .
COPY uv.lock .
COPY src/ src/

# Install dependencies using uv
# RUN uv pip install .

# Expose the port the app runs on
EXPOSE 8000

# Command to run the app
CMD ["uv", "run", "src/main.py"] 