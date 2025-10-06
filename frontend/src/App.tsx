import { useState, useRef, DragEvent, ChangeEvent, useEffect, useReducer } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import './App.css'
import { toast } from 'react-hot-toast'

interface ApiResponse {
  markdown: string;
  title: string;
  visible: boolean;
}

interface ProgressState {
  message: string;
  currentSection: number;
  totalSections: number;
  title?: string;
}

interface ErrorToast {
  message: string;
  visible: boolean;
}

// Sun icon component
const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
)

// Moon icon component
const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </svg>
)

// Chevron down icon component
const ChevronDownIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
  </svg>
)

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

const ActionButtons = ({ markdown, title }: { markdown: string, title: string }) => {
  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/markdown-to-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title,
          markdown: markdown,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate PDF');

      // Get filename from Content-Disposition header if present
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = title.replace(/\s+/g, '_') + '.pdf';
      if (contentDisposition) {
        const matches = /filename="([^"]*)"/.exec(contentDisposition);
        if (matches && matches[1]) {
          filename = matches[1];
        }
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('PDF downloaded successfully!');
    } catch (err) {
      toast.error('Failed to download PDF');
    }
  };

  const handleDownloadMarkdown = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/download-markdown`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title,
          markdown: markdown,
        }),
      });

      if (!response.ok) throw new Error('Failed to download markdown');

      // Get filename from Content-Disposition header if present
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = title.replace(/\s+/g, '_') + '.md';
      if (contentDisposition) {
        const matches = /filename="([^"]*)"/.exec(contentDisposition);
        if (matches && matches[1]) {
          filename = matches[1];
        }
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Markdown downloaded successfully!');
    } catch (err) {
      toast.error('Failed to download markdown');
    }
  };

  return (
    <div className="action-buttons-container">
      <button
        onClick={handleDownloadPDF}
        className="action-button action-button-primary"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span>Download PDF</span>
      </button>

      <button
        onClick={handleDownloadMarkdown}
        className="action-button action-button-secondary"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span>Download Markdown</span>
      </button>
    </div>
  );
};

const markdownComponents = {
  table: (props: React.HTMLProps<HTMLTableElement>) => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800" {...props} />
    </div>
  ),
  thead: (props: React.HTMLProps<HTMLTableSectionElement>) => (
    <thead className="bg-gray-50 dark:bg-gray-800" {...props} />
  ),
  th: (props: React.HTMLProps<HTMLTableCellElement>) => (
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" {...props} />
  ),
  td: (props: React.HTMLProps<HTMLTableCellElement>) => (
    <td className="px-6 py-4 whitespace-nowrap text-sm" {...props} />
  ),
  code: ({ className, children, ...props }: React.HTMLProps<HTMLElement>) => {
    const match = /language-(\w+)/.exec(className || '')
    return match ? (
      <SyntaxHighlighter
        // @ts-ignore - vscDarkPlus type is not properly exported but works fine
        style={vscDarkPlus}
        language={match[1]}
        PreTag="div"
        {...props}
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    ) : (
      <code className={className} {...props}>
        {children}
      </code>
    )
  }
}

// --- Reducer Logic --- START
type AppState = {
  isLoading: boolean;
  progress: ProgressState | null;
  accumulatedMarkdown: string;
  response: ApiResponse | null;
};

type AppAction =
  | { type: 'START_PROCESS' }
  | { type: 'SET_PROGRESS'; payload: { data: string; title?: string; total_sections?: number, section_number?: number } }
  | { type: 'ADD_PARTIAL_SUMMARY'; payload: string }
  | { type: 'SET_COMPLETE'; payload: { title: string } }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'RESET' } // Optional: Might be useful

const initialState: AppState = {
  isLoading: false,
  progress: null,
  accumulatedMarkdown: '',
  response: null,
};

function appReducer(state: AppState, action: AppAction): AppState {
  // Only log actions, not full payload details
  console.log('Reducer action:', action.type);

  const newState = (() => {
    switch (action.type) {
      case 'START_PROCESS':
        return {
          ...initialState,
          isLoading: true,
          progress: { message: 'Starting...', currentSection: 0, totalSections: 0 },
        };
      case 'SET_PROGRESS': {
        const { data, title, total_sections, section_number } = action.payload;
        const currentProgress = state.progress ?? { message: '', currentSection: 0, totalSections: 0 };
        const newProgress = { ...currentProgress };
        newProgress.message = data;
        if (title) newProgress.title = title;
        if (total_sections !== undefined) newProgress.totalSections = total_sections;
        if (section_number !== undefined) newProgress.currentSection = section_number;

        return { ...state, progress: newProgress };
      }
      case 'ADD_PARTIAL_SUMMARY':
        return {
          ...state,
          accumulatedMarkdown: state.accumulatedMarkdown + action.payload,
        };
      case 'SET_COMPLETE': {
        const finalMarkdown = state.accumulatedMarkdown;
        toast.success('Summary generated successfully!', { /* ... styles ... */ });
        return {
          ...state,
          isLoading: false,
          progress: null,
          response: {
            markdown: finalMarkdown,
            title: action.payload.title,
            visible: true
          },
        };
      }
      case 'SET_ERROR':
        return {
          ...state,
          isLoading: false,
          progress: null,
        };
      case 'RESET':
        return initialState;
      default:
        return state;
    }
  })();

  // Remove detailed progress logging
  return newState;
}
// --- Reducer Logic --- END

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [instructions, setInstructions] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<ErrorToast>({ message: '', visible: false })
  // --- useReducer Hook ---
  const [appState, dispatch] = useReducer(appReducer, initialState);
  const { isLoading, progress, response } = appState;

  // State to hold the latest parsed SSE event (still needed for effect trigger)
  const [lastEventData, setLastEventData] = useState<any>(null);

  const showError = (message: string) => {
    setError({ message, visible: true });
    setTimeout(() => setError({ message: '', visible: false }), 5000); // Hide after 5 seconds
  };

  // --- Effect to dispatch actions based on lastEventData --- START
  useEffect(() => {
    if (!lastEventData) return;

    const data = lastEventData;
    // Remove verbose event data logging

    try {
      switch (data.event) {
        case 'progress':
          dispatch({ type: 'SET_PROGRESS', payload: data });
          break;
        case 'section_summary':
          console.log(`Processing section ${data.section_number}/${data.total_sections}`);

          dispatch({
            type: 'SET_PROGRESS', payload: {
              data: `Processing section ${data.section_number}/${data.total_sections}...`,
              section_number: data.section_number,
              total_sections: data.total_sections
            }
          });
          dispatch({ type: 'ADD_PARTIAL_SUMMARY', payload: data.data });
          break;
        case 'complete':
          console.log('Summary complete');
          dispatch({ type: 'SET_COMPLETE', payload: { title: data.title } });
          break;
        case 'error':
          console.error('Error event:', data.data);
          showError(data.data || 'An error occurred during processing.');
          dispatch({ type: 'SET_ERROR', payload: data.data });
          break;
        default:
          console.warn('Unknown SSE event type:', data.event);
      }
    } catch (reducerError) {
      console.error("Error in event processing:", reducerError);
      showError('An internal error occurred processing the update.');
      dispatch({ type: 'SET_ERROR', payload: 'Internal processing error' });
    }

    // Always reset after processing to allow new events to be processed
    setLastEventData(null);
  }, [lastEventData]);
  // --- Effect to handle state updates based on lastEventData --- END

  // Fetch available models
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/models`)
        const modelList = await response.json()
        setModels(modelList)
        // Set default model
        const defaultModel = "Gemini 2.5 Pro"
        if (modelList.includes(defaultModel)) {
          setSelectedModel(defaultModel)
        } else if (modelList.length > 0) {
          setSelectedModel(modelList[0])
        }
      } catch (error) {
        console.error('Failed to fetch models:', error)
      }
    }
    fetchModels()
  }, [])

  // Initialize dark mode based on localStorage or system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'dark') {
      setDarkMode(true)
      document.documentElement.classList.add('dark')
    } else if (savedTheme === 'light') {
      setDarkMode(false)
      document.documentElement.classList.remove('dark')
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      // If no saved preference, check system preference
      setDarkMode(true)
      document.documentElement.classList.add('dark')
    }
  }, [])

  // Toggle dark mode
  const toggleDarkMode = () => {
    if (darkMode) {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    } else {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    }
    setDarkMode(!darkMode)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0])
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0])
    }
  }

  const handleButtonClick = async () => {
    // Reset state before starting new request
    dispatch({ type: 'START_PROCESS' });

    try {
      const formData = new FormData();
      if (file) {
        formData.append('file', file);
      }
      // Add instructions and selected model to the form data
      formData.append('instructions', instructions);
      formData.append('model', selectedModel);

      const response = await fetch(`${API_BASE_URL}/api/summarize`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      console.log('Connected to SSE stream');
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Unable to read response stream');
      }

      let buffer = '';
      let currentEventData = {};

      // Read the stream
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // Only log when stream ends, not content of buffer
          console.log('Stream ended');
          break;
        }

        // Convert the chunk to text and add to the buffer
        const chunk = new TextDecoder().decode(value);
        buffer += chunk;
        // Remove chunk logging

        // Process complete lines from the buffer
        while (buffer.includes('\n')) {
          const lineEndIndex = buffer.indexOf('\n');
          const line = buffer.slice(0, lineEndIndex).trim();
          buffer = buffer.slice(lineEndIndex + 1);

          // Remove line processing logs

          if (line.startsWith('data:')) {
            // Extract data content (after "data:")
            const dataContent = line.slice(5).trim();
            if (dataContent) {
              try {
                // Parse the JSON data
                const jsonData = JSON.parse(dataContent);
                Object.assign(currentEventData, jsonData);
                // Remove JSON data logging
              } catch (e) {
                console.error('Error parsing JSON:', e);
              }
            }
          } else if (line.startsWith('event:')) {
            // Extract and set event type (after "event:")
            const eventType = line.slice(6).trim();
            currentEventData = { ...currentEventData, event: eventType };
            // Remove event type logging
          } else if (line === '') {
            // Empty line marks the end of an event
            if (Object.keys(currentEventData).length > 0) {
              // Only log event type rather than full event data
              if ('event' in currentEventData && currentEventData.event) {
                console.log(`Received ${currentEventData.event} event`);
              }
              setLastEventData(currentEventData);
              // Reset for next event
              currentEventData = {};
            }
          }
        }
      }
    } catch (error) {
      console.error('Error during processing:', error);
      showError('Failed to process file: ' + (error instanceof Error ? error.message : String(error)));
      dispatch({ type: 'SET_ERROR', payload: 'Connection error' });
    }
  };

  const openFileSelector = () => {
    fileInputRef.current?.click()
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
  };

  // Add this function near other handlers
  const handleTextareaInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    // Reset height to auto to properly calculate new height
    textarea.style.height = 'auto';
    // Set new height based on scrollHeight
    textarea.style.height = `${textarea.scrollHeight}px`;
    setInstructions(textarea.value);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col items-center selection:bg-purple-100 dark:selection:bg-purple-900/30">
      {/* Error Toast */}
      {error.visible && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-slide-down">
          <div className="bg-red-500 text-white px-6 py-4 rounded-xl shadow-lg flex items-center space-x-3">
            <svg className="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium">{error.message}</span>
            <button
              onClick={() => setError({ message: '', visible: false })}
              className="ml-4 text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="fixed top-6 right-6 flex items-center gap-3">
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
            shadow-sm hover:shadow transition-all duration-200 cursor-pointer text-amber-500 dark:text-purple-500"
          aria-label="Toggle dark mode"
        >
          {darkMode ? <MoonIcon /> : <SunIcon />}
        </button>
      </div>

      <div className="w-full max-w-6xl mx-auto px-6 py-20 pb-24">
        <div className="text-center mb-20">
          <h1 className="text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-purple-500 tracking-tight mb-4">
            rePaPer
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 font-medium">
            Transform your documents with AI magic
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-0">
          {/* AI Model Selection */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">
              AI Model
            </h2>
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`
                    w-full h-16 bg-white dark:bg-gray-800/50
                    border-2 border-gray-200 dark:border-gray-700
                    rounded-2xl
                    flex items-center
                    text-left text-gray-900 dark:text-white
                    focus:outline-none focus:ring-2 focus:ring-purple-500/30 
                    focus:border-purple-500 dark:focus:border-purple-400
                    transition-all cursor-pointer
                    ${isDropdownOpen ? 'ring-2 ring-purple-500/30 border-purple-500' : ''}
                    ${models.length === 0 ? 'cursor-not-allowed opacity-75' : 'hover:border-purple-300 dark:hover:border-purple-500'}
                  `}
                disabled={models.length === 0}
              >
                <div className="flex-grow dropdown-text-padding min-w-0">
                  <span className="block truncate text-base font-medium">
                    {selectedModel || (models.length === 0 ? 'Loading...' : 'Select model')}
                  </span>
                </div>
                <div className="flex-shrink-0 pr-4">
                  <span className={`pointer-events-none transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}>
                    <ChevronDownIcon />
                  </span>
                </div>
              </button>

              {isDropdownOpen && models.length > 0 && (
                <div className="
                    absolute z-10 w-full mt-0.5 bg-white dark:bg-gray-800/95
                    border border-gray-200 dark:border-gray-700
                    rounded-xl shadow-xl backdrop-blur-sm
                    transform opacity-100 scale-100 transition-all duration-100 ease-out
                  ">
                  <div className="max-h-[600px] overflow-auto">
                    {models.map((model) => (
                      <button
                        key={model}
                        onClick={() => {
                          setSelectedModel(model)
                          setIsDropdownOpen(false)
                        }}
                        className={`
                            w-full h-14
                            flex items-center
                            ${selectedModel === model
                            ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400'
                            : 'text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800/90'
                          }
                            text-lg transition-colors cursor-pointer
                            border-b border-gray-100 dark:border-gray-700 last:border-0
                          `}
                      >
                        <div className="dropdown-text-padding">
                          <span>{model}</span>
                        </div>
                        <div className="pr-4"></div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">
              Instructions
            </h2>
            <textarea
              value={instructions}
              onChange={handleTextareaInput}
              placeholder="What do you want to do with this PDF?"
              className="w-full min-h-[200px] p-6 bg-white dark:bg-gray-800/50 border-2 border-gray-200 dark:border-gray-700 
              rounded-2xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 dark:focus:border-purple-400 
              transition-all resize-none text-gray-900 dark:text-white text-base leading-relaxed overflow-hidden
              placeholder:text-gray-400 dark:placeholder:text-gray-500"
              style={{ height: 'auto' }}
            />
          </div>

          {/* Document Upload */}
          <div className="space-y-3 flex flex-col">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">
              Document
            </h2>
            <div
              className={`
                flex-grow relative group border-2 border-dashed rounded-2xl cursor-pointer
                flex flex-col items-center justify-center min-h-[200px]
                transition-all duration-200
                ${isDragging
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10 scale-[1.02] shadow-lg'
                  : 'border-gray-300 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-gray-50 dark:hover:bg-gray-800/30'}
                ${file ? 'bg-purple-50/50 dark:bg-purple-500/5 border-purple-300 dark:border-purple-600' : 'bg-white/50 dark:bg-gray-800/20'}
              `}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={openFileSelector}
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf"
              />

              <div className="flex flex-col items-center justify-center w-full px-6 py-8">
                <div className="mb-4">
                  {file ? (
                    <div className="relative">
                      <div className="bg-purple-100 dark:bg-purple-900/30 rounded-full p-4">
                        <svg className="h-12 w-12 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <button
                        onClick={handleRemoveFile}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors shadow-md"
                        aria-label="Remove file"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div className="bg-gray-100 dark:bg-gray-700/50 rounded-full p-4">
                      <svg className="h-12 w-12 text-gray-400 dark:text-gray-500 group-hover:text-purple-500 dark:group-hover:text-purple-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                  )}
                </div>

                <div className="text-center space-y-2">
                  <p className="text-base text-gray-900 dark:text-white font-semibold">
                    {file ? file.name : 'Drop PDF here'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {file ? 'Click to change' : 'or click to browse'}
                  </p>
                </div>
              </div>

              {isDragging && (
                <div className="absolute inset-0 border-2 border-purple-500 rounded-2xl bg-purple-50 dark:bg-purple-500/5 pointer-events-none"></div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-center mt-32 mb-16">
          <button
            onClick={handleButtonClick}
            disabled={!file || !selectedModel || isLoading}
            className={`
              w-full h-12 rounded-2xl text-white font-bold text-2xl tracking-wide whitespace-nowrap
              transition-all duration-300 shadow-[0_20px_50px_-15px_rgba(139,92,246,0.55)]
              ${isLoading
                ? 'bg-gray-400 cursor-not-allowed opacity-70'
                : 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 hover:shadow-[0_25px_60px_-15px_rgba(139,92,246,0.7)] hover:scale-[1.02] focus:ring-4 focus:ring-purple-500/40 active:scale-[0.99] cursor-pointer'}
              disabled:hover:shadow-none
            `}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-3 whitespace-nowrap">
                <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              'rePaPer'
            )}
          </button>
        </div>

        {/* Progress updates */}
        {progress && (
          <div className="mt-24 space-y-6">
            <div className="progress-container">
              <div className="progress-header">
                <div className="progress-icon">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <p className="progress-message">{progress.message}</p>
              </div>

              {progress.totalSections > 0 && (
                <>
                  <div className="progress-bar-container">
                    <div
                      className="progress-bar"
                      style={{ width: `${(progress.currentSection / progress.totalSections) * 100}%` }}
                    />
                  </div>
                  <div className="progress-stats">
                    <span>Processing sections...</span>
                    <span className="section-count">
                      {progress.currentSection}/{progress.totalSections}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Final response - only show download buttons */}
        {response && (
          <div className="mt-16 max-w-4xl mx-auto">
            <div className="bg-white dark:bg-gray-800/50 rounded-2xl border-2 border-green-200 dark:border-green-800 p-8 mb-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-green-100 dark:bg-green-900/30 rounded-full p-3">
                  <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{response.title}</h2>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">Your document has been processed successfully!</p>
                </div>
              </div>
              <ActionButtons markdown={response.markdown} title={response.title} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
