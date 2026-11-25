import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { userApi } from '../../api/userApi'
import { Search, X, Loader2, SearchX } from 'lucide-react'
import UserAvatar from '../common/UserAvatar'

export default function UserSearchModal({ isOpen, onClose, onSelectUser }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isStartingChat, setIsStartingChat] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isOpen) return
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      return
    }

    let active = true
    const timer = setTimeout(async () => {
      setIsLoading(true)
      setError(null)
      try {
        const users = await userApi.search(trimmed)
        if (active) setResults(users)
      } catch (err) {
        if (active) setError(err.response?.data?.message || 'Failed to search users')
      } finally {
        if (active) setIsLoading(false)
      }
    }, 300)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [query, isOpen])

  if (!isOpen) return null

  const handleClose = () => {
    setQuery('')
    setResults([])
    setError(null)
    onClose()
  }

  const handleSelect = async (user) => {
    try {
      setIsStartingChat(true)
      await onSelectUser(user)
      handleClose()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start conversation')
    } finally {
      setIsStartingChat(false)
    }
  }

  const displayedResults = query.trim().length >= 2 ? results : []

  const modal = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="New Conversation"
      onClick={handleClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 glass-modal-backdrop"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-strong rounded-3xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh] animate-modal-in"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[var(--glass-border)] flex items-center justify-between">
          <h2 className="text-base font-bold text-ink">New Conversation</h2>
          <button
            onClick={handleClose}
            className="text-ink-muted hover:text-ink p-1.5 rounded-xl hover:bg-[var(--glass-bg-hover)] transition-colors focus-accent cursor-pointer"
            title="Close"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pill Search Input Bar */}
        <div className="p-4 border-b border-[var(--glass-border)]">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email..."
              autoFocus
              className="glass-input w-full rounded-full pl-10 pr-9 py-2.5 text-sm"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink p-1 rounded-full focus-accent cursor-pointer"
                title="Clear search"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto p-2.5 min-h-[240px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-ink-muted">
              <Loader2 className="w-6 h-6 animate-spin text-accent-text mb-2" />
              <span className="text-xs">Searching users...</span>
            </div>
          ) : error ? (
            <div role="alert" className="text-center py-8 text-[var(--danger-text)] text-sm px-4">
              {error}
            </div>
          ) : query.trim().length < 2 ? (
            <div className="flex flex-col items-center justify-center py-12 text-ink-muted text-center px-4">
              <div className="w-12 h-12 rounded-2xl glass-subtle flex items-center justify-center text-accent-text mb-3">
                <Search className="w-5 h-5" />
              </div>
              <p className="text-xs font-medium text-ink">Find someone on Vanni</p>
              <p className="text-[11px] text-ink-subtle mt-1">
                Type at least 2 characters to search for users.
              </p>
            </div>
          ) : displayedResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-ink-muted text-center px-4">
              <div className="w-12 h-12 rounded-2xl glass-subtle flex items-center justify-center text-ink-subtle mb-3">
                <SearchX className="w-5 h-5" />
              </div>
              <p className="text-xs">
                No users found matching &ldquo;{query}&rdquo;
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {displayedResults.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSelect(user)}
                  disabled={isStartingChat}
                  className="w-full flex items-center gap-3.5 p-3 rounded-2xl glass-row-hover transition-all text-left group disabled:opacity-50 focus-accent cursor-pointer"
                >
                  <UserAvatar
                    src={user.avatarUrl}
                    name={user.name}
                    seed={user.id || user.email}
                    size="md"
                    isOnline={user.online}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">
                      {user.name}
                    </p>
                    <p className="text-xs text-ink-muted truncate">
                      {user.about || 'Available'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal
}
