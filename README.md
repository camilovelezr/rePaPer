# 📄 rePaPer

> Your docs, redefined, leave long reads behind. ✨

rePaPer is a blazingly fast document processor that turns your PDFs into beautifully summarized content. Think of it as your personal document whisperer, but cooler.

## 🚀 What's Cool About It?

- **Preview or Direct PDF** - Choose your own adventure: preview the markdown or go straight to PDF
- **Real-time Progress** - Watch the magic happen with our slick progress indicators
- **Dark Mode** - Because we're not savages
- **Drag & Drop** - Just yeet your files in there
- **Smart AI Models** - Pick your poison (they're all good)

## 🛠 Tech Stack

We've picked the crème de la crème:

- **Frontend**: React + TypeScript + Vite (because we're not here to wait)
- **Backend**: FastAPI + Python (async all the things!)
- **Styling**: Tailwind CSS (Utility-first for peak efficiency)
- **Container**: Docker (ship it like you mean it)

## 🏃‍♂️ Quick Start

### 🐳 With Docker (recommended)

```bash
# Clone this
git clone https://github.com/camilovelezr/rePaPer.git

# Fire it up
docker-compose up --build

# That's it. Seriously.
# Head to http://localhost:3000 and live your best life
```

### 🔧 Manual Setup (the hard way)

```bash
# Frontend
cd rePaPer
npm install
npm run dev

# Backend (in another terminal)
cd backend/repaper
pip install -e .
uvicorn repaper.api.app:app --reload
```

## 🌍 Environment Variables

Yeah, we've got some:

### Frontend (`./.env`)
```env
VITE_API_BASE_URL=http://localhost:8000  # Where the magic happens
```

### Backend (`./backend/repaper/.env`)
For the backend to work its magic, you'll need API keys for the LLM models. Create a `.env` file in the `backend/repaper` directory like this:

```env
# Get these from Anthropic and Google AI Studio respectively
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
```

## 📝 Production Build

```bash
# Build the thing
npm run build

# Files will be in 'dist' directory
# Deploy them wherever your heart desires
```

## 🤝 Contributing

Got ideas? We love ideas! Here's how to contribute:

1. Fork it
2. Branch it
3. Code it
4. Push it
5. PR it

Just keep it clean and write decent commit messages, okay?

## 📝 License

MIT - Go wild, just don't sue us.

## 💡 Why rePaPer?

Because reading entire documents is so 2023. Let AI do the heavy lifting while you focus on what matters - like deciding what to have for lunch.

---

Made with ☕️ and the ghost of "it works on my machine".
