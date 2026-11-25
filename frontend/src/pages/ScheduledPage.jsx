import { useState, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock,
  Edit3,
  Loader2,
  MessageSquare,
  Paperclip,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react'
import { scheduledApi } from '../api/scheduledApi'
import {
  formatScheduledTime,
  fromLocalDateTimeInput,
  getLocalTimeZoneLabel,
  toLocalDateTimeInputValue,
  validateScheduleDate,
} from '../lib/scheduleUtils'

const STATUS_TABS = [
  { id: 'PENDING', label: 'Pending' },
  { id: 'SENT', label: 'Sent' },
  { id: 'FAILED', label: 'Failed' },
  { id: 'ALL', label: 'All' },
]

function statusBadgeClass(status) {
  switch (status) {
    case 'SENT':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
    case 'FAILED':
      return 'bg-[var(--danger-bg)] text-[var(--danger-text)] border border-[var(--danger-text)]/25'
    case 'CANCELLED':
      return 'glass-subtle text-ink-subtle'
    default:
      return 'accent-badge'
  }
}

export default function ScheduledPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [editingId, setEditingId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [editDateTime, setEditDateTime] = useState('')
  const [editError, setEditError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState(null)

  const conversationFilter = searchParams.get('conversationId') || undefined
  const tzLabel = useMemo(() => getLocalTimeZoneLabel(), [])

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['scheduled', statusFilter, conversationFilter || null],
    queryFn: () => scheduledApi.list({ status: statusFilter, conversationId: conversationFilter }),
  })

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['scheduled'] })
    queryClient.invalidateQueries({ queryKey: ['conversations'] })
  }

  const handleStartEdit = (item) => {
    setEditingId(item.id)
    setEditContent(item.content || '')
    setEditDateTime(toLocalDateTimeInputValue(item.scheduledFor))
    setEditError(null)
    setActionError(null)
  }

  const handleSaveEdit = async (item) => {
    const trimmed = editContent.trim()
    if (!trimmed && (!item.attachments || item.attachments.length === 0)) {
      setEditError('Message content cannot be blank without attachments.')
      return
    }
    const parsed = fromLocalDateTimeInput(editDateTime)
    const dateErr = validateScheduleDate(parsed, 10)
    if (dateErr) {
      setEditError(dateErr)
      return
    }

    setBusyId(item.id)
    setEditError(null)
    try {
      await scheduledApi.update(item.id, {
        content: trimmed,
        scheduledFor: parsed.toISOString(),
      })
      setEditingId(null)
      refreshAll()
    } catch (err) {
      setEditError(err.response?.data?.message || 'Could not update scheduled message.')
    } finally {
      setBusyId(null)
    }
  }

  const handleSendNow = async (item) => {
    setBusyId(item.id)
    setActionError(null)
    try {
      await scheduledApi.sendNow(item.id)
      refreshAll()
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to deliver message immediately.')
      refreshAll()
    } finally {
      setBusyId(null)
    }
  }

  const handleCancel = async (item) => {
    setBusyId(item.id)
    setActionError(null)
    try {
      await scheduledApi.cancel(item.id)
      if (editingId === item.id) setEditingId(null)
      refreshAll()
    } catch (err) {
      setActionError(err.response?.data?.message || 'Could not cancel scheduled message.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="min-h-screen text-ink flex flex-col items-center py-6 px-4 sm:px-6">
      <div className="w-full max-w-3xl space-y-5">
        <header className="glass rounded-3xl px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 sticky top-4 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate(conversationFilter ? `/app/c/${conversationFilter}` : '/app')}
              className="p-2 -ml-1 text-ink-muted hover:text-ink hover:bg-[var(--glass-bg-hover)] rounded-xl transition-colors focus-accent cursor-pointer"
              aria-label="Back to chats"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-lg font-bold text-ink truncate flex items-center gap-1.5 sm:gap-2">
                <CalendarClock className="w-4 h-4 text-accent-text flex-shrink-0" />
                <span className="truncate">Scheduled Messages</span>
              </h1>
              <p className="text-[11px] text-ink-muted truncate">{tzLabel}</p>
            </div>
          </div>
          {conversationFilter && (
            <button
              type="button"
              onClick={() => setSearchParams({})}
              className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold glass-subtle hover:bg-[var(--glass-bg-hover)] text-accent-text cursor-pointer focus-accent flex-shrink-0"
            >
              All chats
            </button>
          )}
        </header>

        {/* Status filter tabs */}
        <div className="glass rounded-2xl p-1 grid grid-cols-4 gap-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer focus-accent ${
                statusFilter === tab.id
                  ? 'glass-strong text-accent-text shadow-xs'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {actionError && (
          <div role="alert" className="glass rounded-2xl px-4 py-3 text-xs text-[var(--danger-text)] bg-[var(--danger-bg)]">
            {actionError}
          </div>
        )}

        {isLoading ? (
          <div className="glass rounded-3xl p-10 flex items-center justify-center gap-2 text-xs text-ink-muted">
            <Loader2 className="w-4 h-4 animate-spin text-accent-text" />
            <span>Loading scheduled messages...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="glass rounded-3xl p-10 text-center space-y-2.5">
            <Clock className="w-9 h-9 text-accent-text/70 mx-auto" />
            <h2 className="text-sm font-semibold text-ink">No {statusFilter.toLowerCase()} scheduled messages</h2>
            <p className="text-xs text-ink-muted max-w-sm mx-auto">
              Use the clock button next to Send inside any chat to schedule a message for later.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const isEditing = editingId === item.id
              const isBusy = busyId === item.id

              return (
                <article
                  key={item.id}
                  className="glass rounded-3xl p-4 sm:p-5 space-y-3 transition-all"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Link
                        to={`/app/c/${item.conversationId}`}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-ink hover:text-accent-text truncate focus-accent rounded-lg"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-accent-text flex-shrink-0" />
                        <span className="truncate">{item.conversationTitle || 'Conversation'}</span>
                      </Link>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusBadgeClass(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-ink-muted flex items-center gap-1">
                      {item.status === 'SENT' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      ) : item.status === 'FAILED' ? (
                        <XCircle className="w-3.5 h-3.5 text-[var(--danger-text)]" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-accent-text" />
                      )}
                      <span>{formatScheduledTime(item.scheduledFor)}</span>
                    </span>
                  </div>

                  {isEditing ? (
                    <div className="space-y-3 pt-1">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={3}
                        maxLength={4000}
                        aria-label="Edit scheduled message text"
                        className="glass-input w-full rounded-2xl px-3.5 py-2.5 text-sm text-ink resize-none"
                      />
                      <input
                        type="datetime-local"
                        value={editDateTime}
                        onChange={(e) => setEditDateTime(e.target.value)}
                        aria-label="Edit scheduled delivery time"
                        className="glass-input w-full sm:w-auto rounded-2xl px-3.5 py-2 text-xs text-ink"
                      />
                      {editError && (
                        <p role="alert" className="text-xs text-[var(--danger-text)]">
                          {editError}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleSaveEdit(item)}
                          className="px-4 py-1.5 rounded-full text-xs font-semibold btn-accent cursor-pointer focus-accent disabled:opacity-50"
                        >
                          {isBusy ? 'Saving...' : 'Save changes'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-3.5 py-1.5 rounded-full text-xs font-semibold glass-subtle text-ink-muted hover:text-ink cursor-pointer focus-accent"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {item.content && (
                        <p className="text-sm text-ink whitespace-pre-wrap break-words leading-relaxed">
                          {item.content}
                        </p>
                      )}
                      {item.attachments && item.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {item.attachments.map((att) => (
                            <span
                              key={att.id}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full glass-subtle text-[11px] text-ink-muted"
                            >
                              <Paperclip className="w-3 h-3 text-accent-text" />
                              <span className="truncate max-w-[180px]">{att.fileName}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {item.status === 'FAILED' && item.failureReason && (
                    <div className="rounded-2xl px-3 py-2 text-xs bg-[var(--danger-bg)] text-[var(--danger-text)]">
                      Failure reason: {item.failureReason}
                    </div>
                  )}

                  {item.status === 'PENDING' && !isEditing && (
                    <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-[var(--glass-border)]">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleSendNow(item)}
                        className="px-3.5 py-1.5 rounded-full text-xs font-semibold btn-accent flex items-center gap-1.5 cursor-pointer focus-accent disabled:opacity-50"
                      >
                        <Send className="w-3 h-3" />
                        <span>Send now</span>
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleStartEdit(item)}
                        className="px-3.5 py-1.5 rounded-full text-xs font-semibold glass-subtle hover:bg-[var(--glass-bg-hover)] text-ink flex items-center gap-1.5 cursor-pointer focus-accent disabled:opacity-50"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleCancel(item)}
                        className="px-3.5 py-1.5 rounded-full text-xs font-semibold glass-subtle hover:bg-[var(--danger-bg)] text-[var(--danger-text)] flex items-center gap-1.5 cursor-pointer focus-accent disabled:opacity-50"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Cancel</span>
                      </button>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
