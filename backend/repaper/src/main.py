import uvicorn
from repaper.api.app import app

if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",  # Listen on all network interfaces
        port=8000,
        reload=False,  # Disable reload in production
        workers=1,  # Single worker for simplicity, adjust based on needs
    )
