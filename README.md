# 📄 rePaPer

> Stop drowning in documents. Get the gist, fast. ✨

rePaPer transforms lengthy PDFs into concise, easy-to-digest summaries using powerful AI models. Upload your document, choose your preferred AI (or let us pick!), and get a summary delivered as Markdown or a downloadable PDF. Spend less time reading and more time understanding.

## 🚀 Core Features

-   **AI-Powered Summarization**: Leverages state-of-the-art LLMs (Anthropic Claude & Google Gemini) to extract key information.
-   **Flexible Output**: View summaries directly in the app (Markdown) or download them as neatly formatted PDFs.
-   **Model Selection**: Choose between different AI models to tailor the summarization style.
-   **Real-time Progress**: Track the summarization process with clear visual feedback.
-   **Sleek Interface**: Enjoy a clean, modern UI with Dark Mode support.
-   **Drag & Drop Upload**: Easily add your PDF files.

## 🛠 Tech Stack

-   **Frontend**: React, TypeScript, Vite, Tailwind CSS
-   **Backend**: FastAPI (Python 3), Pydantic, Langchain, Logfire (for logging)
-   **Containerization**: Docker, Docker Compose

## 🏃‍♂️ Quick Start

### 🐳 With Docker (Recommended)

The easiest way to get rePaPer running.

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/camilovelezr/rePaPer.git
    cd rePaPer
    ```

2.  **Set Up Environment Variables:**
    *   **Backend:** Copy the sample environment file and fill in your details:
        ```bash
        cd backend/repaper
        cp .env.sample .env
        # Now edit .env with your API keys (ANTHROPIC_API_KEY, GEMINI_API_KEY) and optionally LOGFIRE_TOKEN
        cd ../.. # Go back to the project root
        ```
    *   **Frontend:** Create a `.env` file inside the `frontend/` directory (`frontend/.env`). Set the API URL:
        ```dotenv
        # Make sure this points to your backend service
        VITE_API_BASE_URL=http://localhost:8000
        ```

3.  **Build and Run with Docker Compose:**
    ```bash
    docker-compose up --build -d
    ```

4.  **Access the App:**
    Open your browser and navigate to `http://localhost:5173` (or the port specified in your `docker-compose.yml` if different). The frontend defaults to port 5173 via Vite, while the backend runs on port 8000.

### 🔧 Manual Setup (If you enjoy pain)

Requires Node.js (v18+) and Python (v3.10+) installed.

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/camilovelezr/rePaPer.git
    cd rePaPer
    ```

2.  **Backend Setup:**
    *   Navigate to the backend service directory: `cd backend/repaper`
    *   Create and activate a virtual environment (recommended):
        ```bash
        python -m venv venv
        source venv/bin/activate # On Windows use `venv\Scripts\activate`
        ```
    *   Install dependencies: `pip install -r requirements.txt`
    *   Copy the sample environment file and fill it out:
        ```bash
        cp .env.sample .env
        # Now edit .env with your API keys and optional Logfire token
        ```
    *   Run the FastAPI server: `uvicorn repaper.main:app --reload --host 0.0.0.0 --port 8000`

3.  **Frontend Setup (in a separate terminal):**
    *   Navigate to the frontend directory: `cd ../../frontend`
    *   Install dependencies: `npm install`
    *   Create the `.env` file (`frontend/.env`) pointing to the backend (`VITE_API_BASE_URL=http://localhost:8000`).
    *   Start the development server: `npm run dev`

4.  **Access the App:**
    Open your browser to the URL provided by Vite (usually `http://localhost:5173`).

## 🌍 Environment Variables

Configuration is managed via `.env` files:

*   **`frontend/.env`**: Contains `VITE_API_BASE_URL` pointing to the backend.
*   **`backend/repaper/.env`**: Contains API keys (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) and optionally the `LOGFIRE_TOKEN`. Copy from `backend/repaper/.env.sample`.

## 📝 Production Build (Frontend)

To create an optimized frontend build:

1.  Navigate to the `frontend/` directory.
2.  Run the build command:
    ```bash
    npm run build
    ```
3.  The production-ready static files will be located in the `frontend/dist/` directory. Deploy these files to your preferred static hosting provider or serve them via a web server like Nginx.

## 🤝 Contributing

Contributions are welcome!

1.  Fork the repository.
2.  Create a new feature branch (`git checkout -b feature/your-amazing-feature`).
3.  Make your changes.
4.  Commit your changes (`git commit -m 'feat: Add some amazing feature'`). Use [Conventional Commits](https://www.conventionalcommits.org/).
5.  Push to the branch (`git push origin feature/your-amazing-feature`).
6.  Open a Pull Request.

Please ensure your code is well-formatted and includes tests where applicable.

## 📝 License

MIT - Go wild, just don't sue me.

## 💡 Why rePaPer?

Because reading entire documents is so 2023. Let AI do the heavy lifting while you focus on what matters - like deciding what to have for lunch.

---

Made with ☕️ and the ghost of "it works on my machine".
