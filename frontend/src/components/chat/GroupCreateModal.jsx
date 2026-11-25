import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Search, Users, Loader2, Check } from 'lucide-react'
import { userApi } from '../../api/userApi'
import { conversationApi } from '../../api/conversationApi'
import UserAvatar from '../common/UserAvatar'

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

  const modal = (
    <div
      role="dialog"
      aria-modal="true"
      onClick={handleClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 glass-modal-backdrop"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md glass-strong rounded-3xl overflow-hidden flex flex-col max-h-[90vh] animate-modal-in"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--glass-border)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl accent-badge flex items-center justify-center shadow-xs">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">Create New Group</h3>
              <p className="text-[11px] text-ink-muted">At least 2 other members required</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-ink-muted hover:text-ink hover:bg-[var(--glass-bg-hover)] rounded-xl transition-colors focus-accent cursor-pointer"
            title="Close modal"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleCreate} className="p-5 flex-1 overflow-y-auto space-y-4">
          {error && (
            <div role="alert" className="p-3 rounded-2xl bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger-text)] text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-ink-muted mb-1.5">
              Group Name <span className="text-[var(--danger-text)]">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Design Team, Book Club"
              className="glass-input w-full rounded-2xl px-3.5 py-2 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-muted mb-1.5">
              Description (Optional)
            </label>
            <input
              type="text"
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this group about?"
              className="glass-input w-full rounded-2xl px-3.5 py-2 text-xs"
            />
          </div>

          {/* Selected Member Chips */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-ink-muted">
                Selected Members ({selectedMembers.length})
              </label>
              {selectedMembers.length < 2 && (
                <span className="text-[10px] font-medium text-[var(--warning-text)]">
                  Add {2 - selectedMembers.length} more
                </span>
              )}
            </div>

            {selectedMembers.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 p-2.5 glass-subtle rounded-2xl max-h-24 overflow-y-auto">
                {selectedMembers.map((m) => (
                  <span
                    key={m.id}
                    className="inline-flex items-center gap-1.5 bg-[var(--accent-soft-bg)] border border-[var(--accent-soft-border)] text-accent-text text-[11px] font-medium px-2.5 py-0.5 rounded-full"
                  >
                    <span>{m.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(m.id)}
                      className="hover:text-[var(--danger-text)] cursor-pointer"
                      aria-label={`Remove ${m.name}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-ink-subtle italic">No members selected yet.</p>
            )}
          </div>

          {/* Member Search */}
          <div>
            <label className="block text-xs font-semibold text-ink-muted mb-1.5">Add Members</label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-subtle pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search users by name or email..."
                className="glass-input w-full rounded-full pl-9 pr-8 py-2 text-xs"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-accent-text animate-spin" />
              )}
            </div>

            {/* Results list */}
            {searchResults.length > 0 && (
              <div className="mt-2 glass-subtle rounded-2xl overflow-hidden max-h-36 overflow-y-auto divide-y divide-[var(--glass-border)]">
                {searchResults.map((u) => {
                  const isSelected = selectedMembers.some((m) => m.id === u.id)
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleToggleMember(u)}
                      className={`w-full flex items-center justify-between p-2.5 text-left hover:bg-[var(--glass-bg-hover)] transition-colors cursor-pointer ${
                        isSelected ? 'bg-[var(--accent-soft-bg)]' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UserAvatar src={u.avatarUrl} name={u.name} seed={u.id || u.email} size="sm" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-ink truncate">{u.name}</p>
                          <p className="text-[10px] text-ink-muted truncate">{u.email || u.about}</p>
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-accent-text" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer Submit */}
          <div className="pt-3 flex justify-end gap-2 border-t border-[var(--glass-border)]">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-semibold btn-glass rounded-full cursor-pointer focus-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || selectedMembers.length < 2 || !title.trim()}
              className="flex items-center gap-1.5 px-5 py-2 btn-accent disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold rounded-full cursor-pointer focus-accent"
            >
              {isCreating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Create Group</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal
}
