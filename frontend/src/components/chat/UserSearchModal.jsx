import { useState, useEffect } from 'react'
import { userApi } from '../../api/userApi'
import { Search, X, Loader2, User } from 'lucide-react'

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">New Conversation</h2>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-800">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email..."
              autoFocus
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-9 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto p-2 min-h-[220px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mb-2" />
              <span className="text-xs">Searching users...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-rose-400 text-sm px-4">
              {error}
            </div>
          ) : query.trim().length < 2 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500 text-center px-4">
              <Search className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-xs">Type at least 2 characters to search for users.</p>
            </div>
          ) : displayedResults.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              No users found matching &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className="space-y-1">
              {displayedResults.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSelect(user)}
                  disabled={isStartingChat}
                  className="w-full flex items-center gap-3.5 p-3 rounded-xl hover:bg-slate-800/80 transition-colors text-left group disabled:opacity-50"
                >
                  <div className="relative flex-shrink-0">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-sm font-semibold text-white">
                        {user.name ? user.name.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
                      </div>
                    )}
                    {user.online && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 group-hover:text-white truncate">
                      {user.name}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
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
}
