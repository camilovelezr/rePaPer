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
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      toast.success('Copied to clipboard!');
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

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
    } catch (err) {
      toast.error('Failed to download PDF');
    }
  };

  return (
    <div className="flex items-center space-x-4">
      <button
        onClick={handleDownloadPDF}
        className="flex items-center"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span>Download PDF</span>
      </button>

      <button
        onClick={handleCopy}
        className="flex items-center"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <span>Copy to Clipboard</span>
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
  partialSummaries: string[];
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
  partialSummaries: [],
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
          partialSummaries: [...state.partialSummaries, action.payload],
        };
      case 'SET_COMPLETE': {
        const finalMarkdown = state.partialSummaries.join('');
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
  const [previewMode, setPreviewMode] = useState(true)

  // --- useReducer Hook ---
  const [appState, dispatch] = useReducer(appReducer, initialState);
  const { isLoading, progress, partialSummaries, response } = appState;

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

  // Initialize preview mode based on localStorage
  useEffect(() => {
    const savedPreviewMode = localStorage.getItem('previewMode')
    if (savedPreviewMode === 'false') {
      setPreviewMode(false)
    }
  }, [])

  // Toggle preview mode and save to localStorage
  const togglePreviewMode = () => {
    const newPreviewMode = !previewMode
    setPreviewMode(newPreviewMode)
    localStorage.setItem('previewMode', String(newPreviewMode))
  }

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

      <div className="w-full max-w-5xl mx-auto px-6 py-16 pb-24">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-purple-500 tracking-tight">
            rePaPer
          </h1>
          <p className="mt-3 text-base text-gray-500 dark:text-gray-400">
            Transform your documents instantly
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-12 pb-16 input-sections">
          <div className="flex-1 space-y-8">
            <div>
              <h2 className="text-base font-medium text-gray-900 dark:text-white mb-3">
                Choose AI Model
              </h2>
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className={`
                    w-full h-14 bg-white dark:bg-gray-900
                    border border-gray-200 dark:border-gray-800
                    rounded-xl
                    flex items-center
                    text-left text-gray-900 dark:text-white
                    focus:outline-none focus:ring-2 focus:ring-purple-500/20 
                    focus:border-purple-500 dark:focus:border-purple-500
                    transition-all cursor-pointer
                    ${isDropdownOpen ? 'ring-2 ring-purple-500/20 border-purple-500' : ''}
                    ${models.length === 0 ? 'cursor-not-allowed opacity-75' : 'hover:border-gray-300 dark:hover:border-gray-700'}
                  `}
                  disabled={models.length === 0}
                >
                  <div className="flex-grow dropdown-text-padding min-w-0">
                    <span className="block truncate text-lg">
                      {selectedModel || (models.length === 0 ? 'Loading models...' : 'Select a model')}
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

            <div className="flex-1 flex flex-col">
              <h2 className="text-base font-medium text-gray-900 dark:text-white mb-3">
                Enter Instructions
              </h2>
              <textarea
                value={instructions}
                onChange={handleTextareaInput}
                placeholder="What do you want to do with this PDF?"
                className="flex-1 min-h-[200px] p-8 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 
                rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 dark:focus:border-purple-500 
                transition-shadow resize-none text-gray-900 dark:text-white text-lg leading-relaxed overflow-hidden
                placeholder:text-gray-500 dark:placeholder:text-gray-400"
                style={{ height: 'auto' }}
              />
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            <h2 className="text-base font-medium text-gray-900 dark:text-white mb-3">
              Upload Document
            </h2>
            <div
              className={`
                flex-1 relative group border-2 border-dashed rounded-2xl cursor-pointer
                flex flex-col items-center justify-center min-h-[350px]
                ${isDragging
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/5 scale-[1.02]'
                  : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'}
                ${file ? 'bg-purple-50/50 dark:bg-purple-500/5' : ''}
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

              <div className="flex flex-col items-center justify-center w-full px-6">
                <div className="mb-6">
                  {file ? (
                    <div className="relative">
                      <svg className="mx-auto h-16 w-16 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <button
                        onClick={handleRemoveFile}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                        aria-label="Remove file"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <svg className="mx-auto h-16 w-16 text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  )}
                </div>

                <div className="text-center space-y-3">
                  <p className="text-xl text-gray-900 dark:text-white font-medium">
                    {file ? file.name : 'Drop your PDF here'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {file ? 'Click to change file' : 'or click to browse'}
                  </p>
                </div>
              </div>

              {isDragging && (
                <div className="absolute inset-0 border-2 border-purple-500 rounded-2xl bg-purple-50 dark:bg-purple-500/5 pointer-events-none"></div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-24 flex flex-col items-center gap-8 mb-24">
          {/* Mode Selector */}
          <div className="relative w-full max-w-[280px] h-12">
            <div className="absolute inset-0 bg-gray-100 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/50 rounded-full"></div>

            {/* Sliding Background */}
            <div
              className={`
                absolute inset-y-1 w-[50%] rounded-full
                transform transition-all duration-500 ease-out-expo
                ${previewMode ? 'left-1' : 'left-[calc(50%-1px)]'}
                bg-gradient-to-r from-purple-600 to-purple-500
                shadow-[0_2px_8px_-1px_rgba(168,85,247,0.6)] dark:shadow-[0_0_12px_rgba(168,85,247,0.35)]
              `}
            />

            {/* Buttons Container */}
            <div className="relative h-full flex">
              <button
                onClick={() => !previewMode && togglePreviewMode()}
                className="flex-1 group relative focus:outline-none mode-selector-btn"
              >
                <div className={`
                  flex items-center justify-center gap-2 h-full
                  transition-all duration-300 rounded-full
                  ${previewMode
                    ? 'text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                  }
                `}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                  <span className={`text-sm font-medium transition-all duration-300 ${previewMode ? 'opacity-100' : 'opacity-80'}`}>
                    Live Preview
                  </span>
                </div>

                {/* Live Preview tooltip */}
                <div className="mode-tooltip">
                  <div className="mode-tooltip-content">
                    Watch the transformation happen live
                    <div className="mode-tooltip-arrow"></div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => previewMode && togglePreviewMode()}
                className="flex-1 group relative focus:outline-none mode-selector-btn"
              >
                <div className={`
                  flex items-center justify-center gap-2 h-full
                  transition-all duration-300 rounded-full
                  ${!previewMode
                    ? 'text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                  }
                `}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  <span className={`text-sm font-medium transition-all duration-300 ${!previewMode ? 'opacity-100' : 'opacity-80'}`}>
                    Quick PDF
                  </span>
                </div>

                {/* Quick PDF tooltip */}
                <div className="mode-tooltip">
                  <div className="mode-tooltip-content">
                    Skip preview, get PDF instantly
                    <div className="mode-tooltip-arrow"></div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Main Action Button */}
          <button
            onClick={handleButtonClick}
            disabled={!file || !selectedModel || isLoading}
            className={`
              w-full px-6 h-16 rounded-xl text-white font-medium text-xl
              transition-all duration-200
              ${isLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 focus:ring-4 focus:ring-purple-500/20 active:scale-[0.98] cursor-pointer'}
            `}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white opacity-75" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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

        {/* Partial summaries */}
        {partialSummaries.length > 0 && !response && (
          <div className="mt-16 prose prose-purple dark:prose-invert max-w-none">
            <h2 className="text-3xl font-semibold text-gray-900 dark:text-white mb-8">
              {progress?.title || 'Processing Sections...'}
            </h2>
            {partialSummaries.map((summary, index) => (
              <div key={index} className="mb-8 animate-fade-in bg-white dark:bg-gray-800/50 rounded-xl p-8 border border-gray-100 dark:border-gray-800">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {summary}
                </ReactMarkdown>
              </div>
            ))}
          </div>
        )}

        {/* Final response */}
        {response && (
          <div className="mt-16 prose prose-purple dark:prose-invert max-w-none">
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-8">{response.title}</h1>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {response.markdown}
            </ReactMarkdown>
            <ActionButtons markdown={response.markdown} title={response.title} />
          </div>
        )}
      </div>
    </div>
  )
}

export default App
