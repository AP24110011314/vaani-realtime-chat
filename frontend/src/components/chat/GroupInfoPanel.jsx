import { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import {
  X,
  Users,
  Shield,
  UserMinus,
  UserPlus,
  LogOut,
  Edit2,
  Check,
  Loader2,
  Search,
  Camera,
  Link2,
  Copy,
  Share2,
  QrCode,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { conversationApi } from '../../api/conversationApi'
import { inviteApi } from '../../api/inviteApi'
import { userApi } from '../../api/userApi'
import { usePresence } from '../../hooks/usePresence'
import UserAvatar from '../common/UserAvatar'

const EXPIRY_OPTIONS = [
  { label: '1 hour', value: '3600' },
  { label: '1 day', value: '86400' },
  { label: '7 days', value: '604800' },
  { label: '30 days', value: '2592000' },
  { label: 'Never expires', value: '' },
]

const MAX_USES_OPTIONS = [
  { label: 'Unlimited', value: '' },
  { label: '1 use', value: '1' },
  { label: '10 uses', value: '10' },
  { label: '100 uses', value: '100' },
]

export default function GroupInfoPanel({ conversation, currentUserId, onClose, onLeft }) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('members') // 'members' | 'invites' | 'requests'
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
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const avatarInputRef = useRef(null)

  // Invite creation state
  const [expirySec, setExpirySec] = useState('604800')
  const [maxUses, setMaxUses] = useState('')
  const [requiresApproval, setRequiresApproval] = useState(false)
  const [isCreatingInvite, setIsCreatingInvite] = useState(false)
  const [newlyCreatedInvite, setNewlyCreatedInvite] = useState(null)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [showQr, setShowQr] = useState(false)

  const isAdmin = conversation.myRole === 'ADMIN'
  const members = conversation.members || []
  const memberIds = members.map((m) => m.id)
  usePresence(memberIds)

  const { data: invites = [], isLoading: isLoadingInvites } = useQuery({
    queryKey: ['invites', String(conversation.id)],
    queryFn: () => inviteApi.list(conversation.id),
    enabled: Boolean(isAdmin && activeTab === 'invites'),
  })

  const { data: pendingRequests = [], isLoading: isLoadingRequests } = useQuery({
    queryKey: ['joinRequests', String(conversation.id)],
    queryFn: () => inviteApi.listRequests(conversation.id, 'PENDING'),
    enabled: Boolean(isAdmin),
  })

  const handleGroupAvatarSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setActionError(null)
    if (file.size > 2 * 1024 * 1024) {
      setActionError('Group avatar must be 2 MB or smaller.')
      return
    }
    setIsUploadingAvatar(true)
    try {
      await conversationApi.uploadAvatar(conversation.id, file)
      queryClient.invalidateQueries({ queryKey: ['conversation', String(conversation.id)] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to upload group avatar')
    } finally {
      setIsUploadingAvatar(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

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

  const handleCreateInvite = async (e) => {
    e.preventDefault()
    setIsCreatingInvite(true)
    setActionError(null)
    try {
      const created = await inviteApi.create(conversation.id, {
        expiresInSeconds: expirySec ? Number(expirySec) : null,
        maxUses: maxUses ? Number(maxUses) : null,
        requiresApproval,
      })
      setNewlyCreatedInvite(created)
      setShowQr(false)
      setCopiedUrl(false)
      queryClient.invalidateQueries({ queryKey: ['invites', String(conversation.id)] })
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to create invite link')
    } finally {
      setIsCreatingInvite(false)
    }
  }

  const handleRevokeInvite = async (inviteId) => {
    setActionError(null)
    try {
      await inviteApi.revoke(conversation.id, inviteId)
      if (newlyCreatedInvite?.id === inviteId) {
        setNewlyCreatedInvite(null)
      }
      queryClient.invalidateQueries({ queryKey: ['invites', String(conversation.id)] })
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to revoke invite link')
    }
  }

  const handleCopyInviteUrl = async () => {
    if (!newlyCreatedInvite?.url) return
    try {
      await navigator.clipboard?.writeText(newlyCreatedInvite.url)
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    } catch {
      // Clipboard fallback ignored
    }
  }

  const handleShareInviteUrl = async () => {
    if (!newlyCreatedInvite?.url || typeof navigator?.share !== 'function') return
    try {
      await navigator.share({
        title: `Join ${conversation.title} on Vanni`,
        url: newlyCreatedInvite.url,
      })
    } catch {
      // User dismissed share sheet
    }
  }

  const handleApproveRequest = async (reqId) => {
    setActionError(null)
    try {
      await inviteApi.approveRequest(conversation.id, reqId)
      queryClient.invalidateQueries({ queryKey: ['joinRequests', String(conversation.id)] })
      queryClient.invalidateQueries({ queryKey: ['conversation', String(conversation.id)] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to approve request')
    }
  }

  const handleRejectRequest = async (reqId) => {
    setActionError(null)
    try {
      await inviteApi.rejectRequest(conversation.id, reqId)
      queryClient.invalidateQueries({ queryKey: ['joinRequests', String(conversation.id)] })
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to reject request')
    }
  }

  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  return (
    <aside className="w-full md:w-80 flex-shrink-0 h-full flex flex-col rounded-[24px] md:rounded-[28px] glass text-ink select-none overflow-hidden animate-modal-in">
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
          <div className="relative mb-2.5">
            {conversation.avatarUrl ? (
              <img
                src={conversation.avatarUrl}
                alt={conversation.title}
                className="w-16 h-16 rounded-full object-cover shadow-md border border-[var(--glass-border)]"
              />
            ) : (
              <div className="w-16 h-16 rounded-full accent-badge flex items-center justify-center text-xl font-bold shadow-md">
                {conversation.title ? conversation.title.charAt(0).toUpperCase() : <Users className="w-7 h-7" />}
              </div>
            )}

            {isAdmin && (
              <>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleGroupAvatarSelect}
                />
                <button
                  type="button"
                  disabled={isUploadingAvatar}
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 p-1.5 rounded-full glass-strong text-ink hover:text-accent-text transition-colors shadow-sm cursor-pointer focus-accent"
                  title="Change group avatar"
                  aria-label="Change group avatar"
                >
                  {isUploadingAvatar ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5" />
                  )}
                </button>
              </>
            )}
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

        {/* Admin Section Tabs */}
        {isAdmin && (
          <div className="grid grid-cols-3 p-1 rounded-2xl glass-subtle text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('members')}
              className={`py-1.5 rounded-xl transition-colors cursor-pointer ${
                activeTab === 'members' ? 'glass-strong text-accent-text' : 'text-ink-muted hover:text-ink'
              }`}
            >
              Members
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('invites')}
              className={`py-1.5 rounded-xl transition-colors cursor-pointer ${
                activeTab === 'invites' ? 'glass-strong text-accent-text' : 'text-ink-muted hover:text-ink'
              }`}
            >
              Invites
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('requests')}
              className={`py-1.5 rounded-xl flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                activeTab === 'requests' ? 'glass-strong text-accent-text' : 'text-ink-muted hover:text-ink'
              }`}
            >
              <span>Requests</span>
              {pendingRequests.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold accent-badge tabular-nums">
                  {pendingRequests.length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Tab 1: Members */}
        {(!isAdmin || activeTab === 'members') && (
          <>
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
          </>
        )}

        {/* Tab 2: Invite Links (Admin) */}
        {isAdmin && activeTab === 'invites' && (
          <div className="space-y-4">
            <form onSubmit={handleCreateInvite} className="p-3.5 rounded-2xl glass-subtle space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-ink">
                <Link2 className="w-3.5 h-3.5 text-accent-text" />
                <span>Create Invite Link</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-ink-muted mb-1">Expires</label>
                  <select
                    value={expirySec}
                    onChange={(e) => setExpirySec(e.target.value)}
                    aria-label="Invite expiry"
                    className="glass-input w-full rounded-xl px-2 py-1.5 text-xs"
                  >
                    {EXPIRY_OPTIONS.map((opt) => (
                      <option key={opt.label} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-ink-muted mb-1">Max uses</label>
                  <select
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    aria-label="Invite max uses"
                    className="glass-input w-full rounded-xl px-2 py-1.5 text-xs"
                  >
                    {MAX_USES_OPTIONS.map((opt) => (
                      <option key={opt.label} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={requiresApproval}
                  onChange={(e) => setRequiresApproval(e.target.checked)}
                  className="accent-[var(--accent-solid)] rounded"
                />
                <span>Require admin approval</span>
              </label>

              <button
                type="submit"
                disabled={isCreatingInvite}
                className="w-full py-2 px-3 rounded-full btn-accent text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isCreatingInvite ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                <span>Create Invite Link</span>
              </button>
            </form>

            {/* One-time Created Invite Card */}
            {newlyCreatedInvite?.url && (
              <div className="p-3.5 rounded-2xl glass-strong border-[var(--accent-soft-border)] space-y-2.5 animate-msg-in">
                <p className="text-[11px] font-semibold text-accent-text">
                  Link created — copy it now (shown once)
                </p>
                <div className="p-2 rounded-xl glass-subtle text-[11px] font-mono break-all text-ink select-all">
                  {newlyCreatedInvite.url}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={handleCopyInviteUrl}
                    className="flex-1 py-1.5 px-2.5 rounded-full btn-accent text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {copiedUrl ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowQr((p) => !p)}
                    className="py-1.5 px-2.5 rounded-full btn-glass text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                    aria-label="Toggle QR code"
                  >
                    <QrCode className="w-3 h-3" />
                    <span>QR</span>
                  </button>
                  {canNativeShare && (
                    <button
                      type="button"
                      onClick={handleShareInviteUrl}
                      className="py-1.5 px-2.5 rounded-full btn-glass text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                      aria-label="Share invite link"
                    >
                      <Share2 className="w-3 h-3" />
                      <span>Share</span>
                    </button>
                  )}
                </div>

                {showQr && (
                  <div className="pt-2 flex justify-center">
                    <div className="p-3 rounded-2xl bg-white shadow-sm">
                      <QRCodeSVG value={newlyCreatedInvite.url} size={148} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Existing Invite Links List */}
            <div>
              <h5 className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-2">
                Group Invite Links
              </h5>
              {isLoadingInvites ? (
                <div className="py-4 flex justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-accent-text" />
                </div>
              ) : invites.length === 0 ? (
                <p className="text-xs text-ink-subtle text-center py-4">No invite links yet.</p>
              ) : (
                <div className="space-y-2">
                  {invites.map((inv) => (
                    <div key={inv.id} className="p-2.5 rounded-2xl glass-subtle flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-semibold text-ink">
                            .../join/{inv.codePrefix}...
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                              inv.status === 'ACTIVE'
                                ? 'bg-[var(--success-bg)] text-[var(--success-text)]'
                                : 'bg-[var(--danger-bg)] text-[var(--danger-text)]'
                            }`}
                          >
                            {inv.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-ink-muted mt-0.5 tabular-nums">
                          Uses: {inv.useCount}{inv.maxUses ? ` / ${inv.maxUses}` : ''}
                          {inv.requiresApproval ? ' · Approval' : ''}
                        </p>
                      </div>
                      {inv.status === 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() => handleRevokeInvite(inv.id)}
                          className="p-1.5 text-ink-muted hover:text-[var(--danger-text)] rounded-xl hover:bg-[var(--danger-bg)] transition-colors cursor-pointer"
                          title="Revoke invite link"
                          aria-label="Revoke invite link"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Pending Join Requests (Admin) */}
        {isAdmin && activeTab === 'requests' && (
          <div className="space-y-2">
            <h5 className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-2">
              Pending Requests ({pendingRequests.length})
            </h5>
            {isLoadingRequests ? (
              <div className="py-4 flex justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-accent-text" />
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="text-center py-6 space-y-1.5">
                <Clock className="w-6 h-6 text-ink-subtle mx-auto" />
                <p className="text-xs text-ink-subtle">No pending join requests</p>
              </div>
            ) : (
              pendingRequests.map((req) => (
                <div key={req.id} className="p-2.5 rounded-2xl glass-subtle flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <UserAvatar
                      src={req.user?.avatarUrl}
                      name={req.user?.name}
                      seed={req.user?.id || req.user?.name}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-ink truncate">{req.user?.name}</p>
                      <p className="text-[10px] text-ink-muted truncate">{req.user?.about || 'Wants to join'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleApproveRequest(req.id)}
                      className="p-1.5 rounded-xl text-[var(--success-text)] hover:bg-[var(--success-bg)] transition-colors cursor-pointer"
                      title="Approve request"
                      aria-label="Approve request"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectRequest(req.id)}
                      className="p-1.5 rounded-xl text-[var(--danger-text)] hover:bg-[var(--danger-bg)] transition-colors cursor-pointer"
                      title="Reject request"
                      aria-label="Reject request"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

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
