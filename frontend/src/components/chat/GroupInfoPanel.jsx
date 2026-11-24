import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { X, Users, Shield, UserMinus, UserPlus, LogOut, Edit2, Check, Loader2, Search } from 'lucide-react'
import { conversationApi } from '../../api/conversationApi'
import { userApi } from '../../api/userApi'
import { usePresence } from '../../hooks/usePresence'

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

  // Collect user IDs for presence
  const memberIds = members.map((m) => m.id)
  usePresence(memberIds)

  // Handle member search for adding to group
  const handleSearchUsersToAdd = async (q) => {
    setAddSearchQuery(q)
    if (!q.trim() || q.trim().length < 2) {
      setAddSearchResults([])
      return
    }
    setIsSearchingUsers(true)
    try {
      const results = await userApi.search(q.trim())
      // Filter out existing members
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
    <div className="w-80 h-full flex flex-col bg-slate-900 border-l border-slate-800 text-slate-100 select-none overflow-hidden animate-in slide-in-from-right-4">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-400" />
          Group Info
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Details */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {actionError && (
          <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
            {actionError}
          </div>
        )}

        {/* Group Header Info */}
        <div className="flex flex-col items-center text-center p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-xl font-bold text-white shadow-lg mb-2">
            {conversation.title ? conversation.title.charAt(0).toUpperCase() : <Users className="w-7 h-7" />}
          </div>

          {!isEditingTitle ? (
            <>
              <div className="flex items-center gap-1.5 justify-center max-w-full">
                <h4 className="text-sm font-bold text-white truncate">{conversation.title}</h4>
                {isAdmin && (
                  <button
                    onClick={() => {
                      setNewTitle(conversation.title || '')
                      setNewDesc(conversation.description || '')
                      setIsEditingTitle(true)
                    }}
                    className="text-slate-400 hover:text-indigo-400"
                    title="Edit group details"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                {conversation.description || 'No description'}
              </p>
              <span className="text-[11px] text-indigo-400 font-medium mt-1">
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
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
              />
              <input
                type="text"
                maxLength={500}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Group description"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
              />
              <div className="flex justify-end gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(false)}
                  className="px-2.5 py-1 text-[11px] text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingDetails || !newTitle.trim()}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold rounded-lg flex items-center gap-1"
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
                className="w-full py-2 px-3 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Add Members
              </button>
            ) : (
              <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300">Add Member</span>
                  <button onClick={() => setIsAddingMember(false)} className="text-slate-400 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={addSearchQuery}
                    onChange={(e) => handleSearchUsersToAdd(e.target.value)}
                    placeholder="Search by name/email..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  {isSearchingUsers && (
                    <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-indigo-400 animate-spin" />
                  )}
                </div>

                {addSearchResults.length > 0 && (
                  <div className="max-h-32 overflow-y-auto divide-y divide-slate-800/60 rounded-lg border border-slate-800 bg-slate-900/60">
                    {addSearchResults.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleAddMember(u.id)}
                        className="w-full p-2 flex items-center justify-between text-left hover:bg-slate-800/60 transition-colors"
                      >
                        <span className="text-xs text-slate-200 truncate">{u.name}</span>
                        <UserPlus className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
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
          <h5 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Members ({members.length})
          </h5>
          <div className="space-y-1.5">
            {members.map((m) => {
              const isSelf = m.id === currentUserId
              const isMemberAdmin = m.role === 'ADMIN'

              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-950/40 border border-slate-800/60"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-slate-800 text-slate-200 flex items-center justify-center text-xs font-bold">
                        {m.name ? m.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      {m.online && (
                        <span
                          className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-slate-900"
                          title="Online"
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-200 truncate">
                          {m.name} {isSelf && '(You)'}
                        </span>
                        {isMemberAdmin && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[9px] font-semibold border border-amber-500/30">
                            <Shield className="w-2.5 h-2.5" />
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">{m.about || m.email}</p>
                    </div>
                  </div>

                  {/* Admin controls for other members */}
                  {isAdmin && !isSelf && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleToggleRole(m)}
                        className="p-1 text-slate-400 hover:text-amber-300 rounded hover:bg-slate-800"
                        title={isMemberAdmin ? 'Demote to Member' : 'Make Admin'}
                      >
                        <Shield className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRemoveMember(m.id)}
                        className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800"
                        title="Remove member"
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
        <div className="pt-2 border-t border-slate-800">
          <button
            onClick={handleLeaveGroup}
            disabled={isLeaving}
            className="w-full py-2 px-3 bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {isLeaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
            Leave Group
          </button>
        </div>
      </div>
    </div>
  )
}
