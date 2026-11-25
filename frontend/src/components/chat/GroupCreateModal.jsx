import { useState, useEffect } from 'react'
import { X, Search, Users, Loader2, Check } from 'lucide-react'
import { userApi } from '../../api/userApi'
import { conversationApi } from '../../api/conversationApi'

export default function GroupCreateModal({ isOpen, onClose, onCreated }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedMembers, setSelectedMembers] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState(null)

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setSearchQuery('')
    setSearchResults([])
    setSelectedMembers([])
    setError(null)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleSearchChange = (e) => {
    const val = e.target.value
    setSearchQuery(val)
    if (!val.trim() || val.trim().length < 2) {
      setSearchResults([])
      setIsSearching(false)
    } else {
      setIsSearching(true)
    }
  }

  // Search users as query changes
  useEffect(() => {
    const trimmed = searchQuery.trim()
    if (trimmed.length < 2) {
      return
    }

    let active = true

    const timer = setTimeout(async () => {
      try {
        const users = await userApi.search(trimmed)
        if (active) {
          setSearchResults(users)
        }
      } catch {
        if (active) {
          setSearchResults([])
        }
      } finally {
        if (active) {
          setIsSearching(false)
        }
      }
    }, 300)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [searchQuery])

  if (!isOpen) return null

  const handleToggleMember = (u) => {
    setError(null)
    if (selectedMembers.some((m) => m.id === u.id)) {
      setSelectedMembers((prev) => prev.filter((m) => m.id !== u.id))
    } else {
      setSelectedMembers((prev) => [...prev, u])
    }
  }

  const handleRemoveMember = (userId) => {
    setSelectedMembers((prev) => prev.filter((m) => m.id !== userId))
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Group name is required')
      return
    }
    if (selectedMembers.length < 2) {
      setError('Please select at least 2 members for the group')
      return
    }

    setIsCreating(true)
    setError(null)
    try {
      const newGroup = await conversationApi.createGroup({
        title: title.trim(),
        description: description.trim() || null,
        memberIds: selectedMembers.map((m) => m.id),
      })
      onCreated?.(newGroup)
      resetForm()
      onClose()
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to create group'
      setError(msg)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Create New Group</h3>
              <p className="text-[11px] text-slate-400">At least 2 other members required</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleCreate} className="p-4 flex-1 overflow-y-auto space-y-3.5">
          {error && (
            <div role="alert" className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Group Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Design Team, Book Club"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Description (Optional)
            </label>
            <input
              type="text"
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this group about?"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Selected Member Chips */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-300">
                Selected Members ({selectedMembers.length})
              </label>
              {selectedMembers.length < 2 && (
                <span className="text-[10px] text-amber-400">Add {2 - selectedMembers.length} more</span>
              )}
            </div>

            {selectedMembers.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-950/80 border border-slate-800 rounded-xl max-h-24 overflow-y-auto">
                {selectedMembers.map((m) => (
                  <span
                    key={m.id}
                    className="inline-flex items-center gap-1 bg-indigo-600/30 border border-indigo-500/40 text-indigo-200 text-[11px] px-2 py-0.5 rounded-full"
                  >
                    <span>{m.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(m.id)}
                      className="hover:text-rose-300"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 italic">No members selected yet.</p>
            )}
          </div>

          {/* Member Search */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Add Members</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search users by name or email..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-indigo-400 animate-spin" />
              )}
            </div>

            {/* Results list */}
            {searchResults.length > 0 && (
              <div className="mt-2 border border-slate-800 rounded-xl overflow-hidden max-h-36 overflow-y-auto divide-y divide-slate-800/60 bg-slate-950/60">
                {searchResults.map((u) => {
                  const isSelected = selectedMembers.some((m) => m.id === u.id)
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleToggleMember(u)}
                      className={`w-full flex items-center justify-between p-2 text-left hover:bg-slate-800/60 transition-colors ${
                        isSelected ? 'bg-indigo-950/40' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-indigo-600/30 text-indigo-300 flex items-center justify-center text-xs font-bold">
                          {u.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-200 truncate">{u.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{u.email || u.about}</p>
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-indigo-400" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer Submit */}
          <div className="pt-2 flex justify-end gap-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={handleClose}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || selectedMembers.length < 2 || !title.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
            >
              {isCreating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Create Group</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
