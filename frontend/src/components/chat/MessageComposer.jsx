import { useState, useRef, useEffect } from 'react'
import { SendHorizonal } from 'lucide-react'

export default function MessageComposer({ onSendMessage, disabled }) {
  const [content, setContent] = useState('')
  const textareaRef = useRef(null)

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [content])

  const handleSend = () => {
    const trimmed = content.trim()
    if (!trimmed || disabled) return
    onSendMessage(trimmed)
    setContent('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="p-3 border-t border-slate-800 bg-slate-900/60 backdrop-blur">
      <div className="flex items-end gap-2 bg-slate-950/90 border border-slate-800 rounded-2xl p-1.5 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Press Enter to send, Shift+Enter for newline)"
          rows={1}
          disabled={disabled}
          className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none max-h-32 leading-relaxed"
        />

        <button
          onClick={handleSend}
          disabled={!content.trim() || disabled}
          className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white transition-all shadow-md shadow-indigo-600/20 flex-shrink-0"
          aria-label="Send message"
        >
          <SendHorizonal className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
