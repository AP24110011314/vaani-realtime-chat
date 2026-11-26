import { useState } from 'react'
import {
  Check,
  CheckCircle2,
  ClipboardCopy,
  ListChecks,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react'

export const AI_CONSENT_NOTICE =
  "Catch me up sends the text of the messages you missed in this chat to an AI service so it can write a summary. Other people's messages in this chat are included. Vanni does not keep the summary. You can turn this off at any time in Settings."

export const CATCH_UP_UNREAD_THRESHOLD = 15

function formatPlainSummary(data) {
  if (!data?.summary) return ''
  const lines = []
  if (data.summary.overview) lines.push(data.summary.overview)
  const addSection = (title, items, formatItem) => {
    if (!items || items.length === 0) return
    lines.push('', `${title}:`)
    items.forEach((item) => lines.push(`- ${formatItem(item)}`))
  }
  addSection('Key points', data.summary.keyPoints, (p) => p.text)
  addSection('Decisions', data.summary.decisions, (p) => p.text)
  addSection('Action items', data.summary.actionItems, (a) => `${a.who}: ${a.what}`)
  addSection('For you', data.summary.forYou, (p) => p.text)
  return lines.join('\n')
}

function JumpLinks({ messageIds = [], onJump }) {
  if (!messageIds || messageIds.length === 0 || !onJump) return null
  return (
    <span className="inline-flex flex-wrap gap-1 ml-1.5 align-middle">
      {messageIds.slice(0, 3).map((id, idx) => (
        <button
          key={id}
          type="button"
          onClick={() => onJump(id)}
          className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold glass-subtle hover:bg-[var(--glass-bg-hover)] text-accent-text transition-colors cursor-pointer focus-accent"
          aria-label={`Jump to message ${id}`}
        >
          Jump{messageIds.length > 1 ? ` ${idx + 1}` : ''}
        </button>
      ))}
    </span>
  )
}

export default function CatchUpPanel({
  isOpen,
  onClose,
  needsConsent,
  onEnableConsent,
  isSavingConsent,
  isLoading,
  error,
  data,
  unreadCount = 0,
  onRegenerate,
  onJumpToMessage,
}) {
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const handleCopy = async () => {
    const plain = formatPlainSummary(data)
    if (!plain || !navigator.clipboard?.writeText) return
    try {
      await navigator.clipboard.writeText(plain)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard write optional
    }
  }

  return (
    <aside
      aria-label="Catch me up summary"
      className="fixed inset-x-0 bottom-0 md:static md:w-80 lg:w-96 max-h-[82vh] md:max-h-none md:h-full z-40 rounded-t-[28px] md:rounded-[28px] glass-strong md:glass flex flex-col overflow-hidden shadow-2xl md:shadow-none animate-modal-in"
    >
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-[var(--glass-border)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-8 h-8 rounded-2xl accent-badge flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-ink truncate">Catch me up</h2>
            {data?.messageCount ? (
              <p className="text-[11px] text-ink-muted">
                Summary of {data.messageCount} messages
                {data.truncated ? ' (latest shown)' : ''}
              </p>
            ) : (
              <p className="text-[11px] text-ink-muted">AI conversation recap</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-full text-ink-muted hover:text-ink hover:bg-[var(--glass-bg-hover)] transition-colors cursor-pointer focus-accent"
          aria-label="Close Catch me up"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {needsConsent ? (
          <div className="glass-subtle rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-ink font-semibold text-xs">
              <ShieldCheck className="w-4 h-4 text-accent-text flex-shrink-0" />
              <span>Enable AI summaries?</span>
            </div>
            <p className="text-ink-muted leading-relaxed">{AI_CONSENT_NOTICE}</p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={isSavingConsent}
                onClick={onEnableConsent}
                className="px-4 py-2 rounded-full text-xs font-semibold btn-accent cursor-pointer focus-accent disabled:opacity-50"
              >
                {isSavingConsent ? 'Enabling...' : 'Enable & Catch me up'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-full text-xs font-semibold glass-subtle text-ink-muted hover:text-ink cursor-pointer focus-accent"
              >
                Not now
              </button>
            </div>
          </div>
        ) : isLoading ? (
          <div className="space-y-3 animate-pulse" role="status" aria-live="polite">
            <p className="text-xs font-medium text-accent-text">
              Reading {unreadCount > 0 ? `${unreadCount} missed ` : 'recent '}messages...
            </p>
            <div className="h-16 rounded-2xl glass-subtle" />
            <div className="h-24 rounded-2xl glass-subtle" />
            <div className="h-20 rounded-2xl glass-subtle" />
          </div>
        ) : error ? (
          <div role="alert" className="rounded-2xl p-4 bg-[var(--danger-bg)] text-[var(--danger-text)] space-y-2">
            <p className="font-semibold">Unable to generate summary</p>
            <p className="leading-relaxed opacity-90">{error}</p>
            {onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                className="px-3 py-1.5 rounded-full text-[11px] font-semibold glass-subtle text-ink cursor-pointer focus-accent"
              >
                Try again
              </button>
            )}
          </div>
        ) : data?.summary ? (
          <>
            {/* Overview */}
            <section className="glass-subtle rounded-2xl p-3.5 space-y-1.5">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">Overview</h3>
              <p className="text-xs text-ink leading-relaxed whitespace-pre-wrap break-words">
                {data.summary.overview}
              </p>
            </section>

            {/* For you */}
            {data.summary.forYou?.length > 0 && (
              <section className="rounded-2xl p-3.5 bg-[var(--accent-soft-bg)] border border-[var(--accent-soft-border)] space-y-2">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-accent-text flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>For you</span>
                </h3>
                <ul className="space-y-2">
                  {data.summary.forYou.map((item, idx) => (
                    <li key={idx} className="text-ink leading-relaxed break-words">
                      <span>{item.text}</span>
                      <JumpLinks messageIds={item.messageIds} onJump={onJumpToMessage} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Key points */}
            {data.summary.keyPoints?.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">Key points</h3>
                <ul className="space-y-2 list-disc list-inside text-ink">
                  {data.summary.keyPoints.map((item, idx) => (
                    <li key={idx} className="leading-relaxed break-words">
                      <span>{item.text}</span>
                      <JumpLinks messageIds={item.messageIds} onJump={onJumpToMessage} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Decisions */}
            {data.summary.decisions?.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Decisions</span>
                </h3>
                <ul className="space-y-2 text-ink">
                  {data.summary.decisions.map((item, idx) => (
                    <li key={idx} className="glass-subtle rounded-xl px-3 py-2 leading-relaxed break-words">
                      <span>{item.text}</span>
                      <JumpLinks messageIds={item.messageIds} onJump={onJumpToMessage} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Action items */}
            {data.summary.actionItems?.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle flex items-center gap-1.5">
                  <ListChecks className="w-3.5 h-3.5 text-accent-text" />
                  <span>Action items</span>
                </h3>
                <ul className="space-y-2">
                  {data.summary.actionItems.map((item, idx) => (
                    <li key={idx} className="glass-subtle rounded-xl px-3 py-2 space-y-1">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold accent-badge">
                        {item.who}
                      </span>
                      <p className="text-ink leading-relaxed break-words">
                        <span>{item.what}</span>
                        <JumpLinks messageIds={item.messageIds} onJump={onJumpToMessage} />
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : null}
      </div>

      {/* Footer */}
      {!needsConsent && (
        <div className="px-4 py-3 border-t border-[var(--glass-border)] space-y-2.5">
          <p className="text-[10px] text-ink-subtle text-center">
            AI-generated, may contain mistakes
          </p>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={!data?.summary}
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-full text-xs font-semibold glass-subtle hover:bg-[var(--glass-bg-hover)] text-ink flex items-center gap-1.5 cursor-pointer focus-accent disabled:opacity-40"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={onRegenerate}
              className="px-3 py-1.5 rounded-full text-xs font-semibold glass-subtle hover:bg-[var(--glass-bg-hover)] text-accent-text flex items-center gap-1.5 cursor-pointer focus-accent disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Regenerate</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-full text-xs font-semibold glass-subtle hover:bg-[var(--glass-bg-hover)] text-ink-muted hover:text-ink cursor-pointer focus-accent"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
