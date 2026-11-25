import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { X, Users, Shield, UserMinus, UserPlus, LogOut, Edit2, Check, Loader2, Search } from 'lucide-react'
import { conversationApi } from '../../api/conversationApi'
import { userApi } from '../../api/userApi'
import { usePresence } from '../../hooks/usePresence'
import UserAvatar from '../common/UserAvatar'

export default function GroupInfoPanel({ conversation, currentUserId, onClose, onLeft }) {
  const queryClient = useQueryClient()
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [newTitle, setNewTitle] = useState(conversation.title || '')
  const [newDesc, setNewDesc] = useState(conversation.description || '')
  const [isSavingDetails, setIsSavingDetails] = useState(false)

  const [isAddingMember, setIsAddingMember] = useState(false)
  const [addSearchQuery, setAddSearchQuery] = useState('')
  const [addSearchResults, setAddSearchResults] = useState([])
  const [isSearchingUsers, setIsSearchingUsers] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [isLeaving, setIsLeaving] = useState(false)

  const isAdmin = conversation.myRole === 'ADMIN'
  const members = conversation.members || []

  const memberIds = members.map((m) => m.id)
  usePresence(memberIds)

  const handleSearchUsersToAdd = async (q) => {
    setAddSearchQuery(q)
    if (!q.trim() || q.trim().length < 2) {
      setAddSearchResults([])
      return
    }
    setIsSearchingUsers(true)
    try {
      const results = await userApi.search(q.trim())
      const existingIds = new Set(members.map((m) => m.id))
      setAddSearchResults(results.filter((u) => !existingIds.has(u.id)))
    } catch {
      setAddSearchResults([])
    } finally {
      setIsSearchingUsers(false)
    }
  }

  const handleAddMember = async (userId) => {
    setActionError(null)
    try {
      await conversationApi.addMembers(conversation.id, [userId])
      queryClient.invalidateQueries({ queryKey: ['conversation', String(conversation.id)] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      setIsAddingMember(false)
      setAddSearchQuery('')
      setAddSearchResults([])
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to add member')
    }
  }

  const handleRemoveMember = async (userId) => {
    setActionError(null)
    try {
      await conversationApi.removeMember(conversation.id, userId)
      queryClient.invalidateQueries({ queryKey: ['conversation', String(conversation.id)] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to remove member')
    }
  }

  const handleToggleRole = async (member) => {
    setActionError(null)
    const newRole = member.role === 'ADMIN' ? 'MEMBER' : 'ADMIN'
    try {
      await conversationApi.setRole(conversation.id, member.id, newRole)
      queryClient.invalidateQueries({ queryKey: ['conversation', String(conversation.id)] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to change member role')
    }
  }

  const handleSaveDetails = async (e) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    setIsSavingDetails(true)
    setActionError(null)
    try {
      await conversationApi.updateGroup(conversation.id, {
        title: newTitle.trim(),
        description: newDesc.trim() || null,
      })
      queryClient.invalidateQueries({ queryKey: ['conversation', String(conversation.id)] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      setIsEditingTitle(false)
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to update group details')
    } finally {
      setIsSavingDetails(false)
    }
  }

  const handleLeaveGroup = async () => {
    if (!window.confirm('Are you sure you want to leave this group?')) return
    setIsLeaving(true)
    setActionError(null)
    try {
      await conversationApi.leave(conversation.id)
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      onLeft?.()
      onClose()
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to leave group')
      setIsLeaving(false)
    }
  }

  return (
    <aside className="w-80 flex-shrink-0 h-full flex flex-col rounded-[24px] md:rounded-[28px] glass text-ink select-none overflow-hidden animate-modal-in">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-[var(--glass-border)] bg-[var(--glass-bg-subtle)] flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink flex items-center gap-2">
          <Users className="w-4 h-4 text-accent-text" />
          Group Info
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 text-ink-muted hover:text-ink hover:bg-[var(--glass-bg-hover)] rounded-xl transition-colors focus-accent cursor-pointer"
          title="Close group info"
          aria-label="Close group info"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Details */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {actionError && (
          <div role="alert" className="p-2.5 rounded-2xl bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger-text)] text-xs">
            {actionError}
          </div>
        )}

        {/* Group Header Info */}
        <div className="flex flex-col items-center text-center p-4 rounded-2xl glass-subtle">
          <div className="w-14 h-14 rounded-full accent-badge flex items-center justify-center text-xl font-bold shadow-md mb-2.5">
            {conversation.title ? conversation.title.charAt(0).toUpperCase() : <Users className="w-7 h-7" />}
          </div>

          {!isEditingTitle ? (
            <>
              <div className="flex items-center gap-1.5 justify-center max-w-full">
                <h4 className="text-sm font-bold text-ink truncate">{conversation.title}</h4>
                {isAdmin && (
                  <button
                    onClick={() => {
                      setNewTitle(conversation.title || '')
                      setNewDesc(conversation.description || '')
                      setIsEditingTitle(true)
                    }}
                    className="p-1 text-ink-muted hover:text-accent-text rounded-lg transition-colors focus-accent cursor-pointer"
                    title="Edit group details"
                    aria-label="Edit group details"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className="text-xs text-ink-muted mt-0.5 line-clamp-2">
                {conversation.description || 'No description'}
              </p>
              <span className="text-[11px] text-accent-text font-semibold mt-1.5 tabular-nums">
                {members.length} {members.length === 1 ? 'member' : 'members'}
              </span>
            </>
          ) : (
            <form onSubmit={handleSaveDetails} className="w-full space-y-2 text-left mt-2">
              <input
                type="text"
                required
                maxLength={100}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Group title"
                className="glass-input w-full rounded-xl px-2.5 py-1.5 text-xs"
              />
              <input
                type="text"
                maxLength={500}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Group description"
                className="glass-input w-full rounded-xl px-2.5 py-1.5 text-xs"
              />
              <div className="flex justify-end gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(false)}
                  className="px-3 py-1 text-[11px] btn-glass rounded-full cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingDetails || !newTitle.trim()}
                  className="px-3 py-1 btn-accent text-[11px] font-semibold rounded-full flex items-center gap-1 cursor-pointer"
                >
                  {isSavingDetails ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Save
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Add Member Button for Admins */}
        {isAdmin && (
          <div>
            {!isAddingMember ? (
              <button
                onClick={() => setIsAddingMember(true)}
                className="w-full py-2 px-3 bg-[var(--accent-soft-bg)] hover:brightness-105 border border-[var(--accent-soft-border)] text-accent-text rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer focus-accent"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Add Members
              </button>
            ) : (
              <div className="p-3 glass-subtle rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink">Add Member</span>
                  <button
                    onClick={() => setIsAddingMember(false)}
                    className="text-ink-muted hover:text-ink cursor-pointer"
                    aria-label="Close add member"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-subtle pointer-events-none" />
                  <input
                    type="text"
                    value={addSearchQuery}
                    onChange={(e) => handleSearchUsersToAdd(e.target.value)}
                    placeholder="Search by name/email..."
                    className="glass-input w-full rounded-full pl-8 pr-7 py-1.5 text-xs"
                  />
                  {isSearchingUsers && (
                    <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-accent-text animate-spin" />
                  )}
                </div>

                {addSearchResults.length > 0 && (
                  <div className="max-h-32 overflow-y-auto divide-y divide-[var(--glass-border)] rounded-xl glass-strong">
                    {addSearchResults.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleAddMember(u.id)}
                        className="w-full p-2 flex items-center justify-between text-left hover:bg-[var(--glass-bg-hover)] transition-colors cursor-pointer"
                      >
                        <span className="text-xs text-ink truncate">{u.name}</span>
                        <UserPlus className="w-3.5 h-3.5 text-accent-text flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Member List */}
        <div>
          <h5 className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-2 tabular-nums">
            Members ({members.length})
          </h5>
          <div className="space-y-2">
            {members.map((m) => {
              const isSelf = m.id === currentUserId
              const isMemberAdmin = m.role === 'ADMIN'

              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-2.5 rounded-2xl glass-subtle"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <UserAvatar
                      src={m.avatarUrl}
                      name={m.name}
                      seed={m.id || m.email}
                      size="sm"
                      isOnline={m.online}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-ink truncate">
                          {m.name} {isSelf && '(You)'}
                        </span>
                        {isMemberAdmin && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-[var(--warning-bg)] text-[var(--warning-text)] text-[9px] font-semibold border border-[var(--warning-border)]">
                            <Shield className="w-2.5 h-2.5" />
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-ink-muted truncate">{m.about || m.email}</p>
                    </div>
                  </div>

                  {isAdmin && !isSelf && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleToggleRole(m)}
                        className="p-1.5 text-ink-muted hover:text-[var(--warning-text)] rounded-xl hover:bg-[var(--glass-bg-hover)] transition-colors cursor-pointer focus-accent"
                        title={isMemberAdmin ? 'Demote to Member' : 'Make Admin'}
                        aria-label={isMemberAdmin ? 'Demote to Member' : 'Make Admin'}
                      >
                        <Shield className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRemoveMember(m.id)}
                        className="p-1.5 text-ink-muted hover:text-[var(--danger-text)] rounded-xl hover:bg-[var(--glass-bg-hover)] transition-colors cursor-pointer focus-accent"
                        title="Remove member"
                        aria-label="Remove member"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Leave Group Action */}
        <div className="pt-2 border-t border-[var(--glass-border)]">
          <button
            onClick={handleLeaveGroup}
            disabled={isLeaving}
            className="w-full py-2.5 px-3 bg-[var(--danger-bg)] hover:brightness-105 border border-[var(--danger-border)] text-[var(--danger-text)] rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer focus-accent"
          >
            {isLeaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
            Leave Group
          </button>
        </div>
      </div>
    </aside>
  )
}
