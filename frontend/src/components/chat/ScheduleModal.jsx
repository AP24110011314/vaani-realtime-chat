import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { CalendarClock, Clock, Send, X } from 'lucide-react'
import {
  formatScheduledTime,
  fromLocalDateTimeInput,
  getLocalTimeZoneLabel,
  getSchedulePresets,
  toLocalDateTimeInputValue,
  validateScheduleDate,
} from '../../lib/scheduleUtils'

export default function ScheduleModal({
  isOpen,
  onClose,
  onConfirm,
  initialDate = null,
  previewText = '',
  attachmentCount = 0,
  confirmLabel = 'Schedule message',
  minLeadSeconds = 60,
  isSubmitting = false,
  error: externalError = null,
}) {
  const [selectedInput, setSelectedInput] = useState(() => {
    const base = initialDate ? new Date(initialDate) : new Date(Date.now() + 60 * 60 * 1000)
    return toLocalDateTimeInputValue(base)
  })
  const [localError, setLocalError] = useState(null)

  const presets = useMemo(() => getSchedulePresets(new Date(), minLeadSeconds), [minLeadSeconds])
  const tzLabel = useMemo(() => getLocalTimeZoneLabel(), [])
  const parsedDate = useMemo(() => fromLocalDateTimeInput(selectedInput), [selectedInput])

  if (!isOpen || typeof document === 'undefined') return null

  const handleSubmit = (e) => {
    e.preventDefault()
    const validationErr = validateScheduleDate(parsedDate, minLeadSeconds)
    if (validationErr) {
      setLocalError(validationErr)
      return
    }
    setLocalError(null)
    onConfirm?.(parsedDate.toISOString())
  }

  const displayError = localError || externalError

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center glass-modal-backdrop p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Schedule message"
        className="w-full max-w-md glass-strong rounded-3xl p-5 sm:p-6 shadow-2xl animate-modal-in space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-2xl accent-badge flex items-center justify-center flex-shrink-0">
              <CalendarClock className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-base font-bold text-ink">Schedule message</h2>
              <p className="text-[11px] text-ink-muted">Timezone: {tzLabel}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-ink-muted hover:text-ink hover:bg-[var(--glass-bg-hover)] rounded-full transition-colors cursor-pointer focus-accent"
            aria-label="Close schedule modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {(previewText || attachmentCount > 0) && (
          <div className="glass-subtle rounded-2xl px-3.5 py-2.5 text-xs text-ink-muted space-y-1">
            {previewText && (
              <p className="text-ink line-clamp-2 break-words">{previewText}</p>
            )}
            {attachmentCount > 0 && (
              <p className="text-[11px] font-medium text-accent-text">
                {attachmentCount} attachment{attachmentCount > 1 ? 's' : ''} included
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
              Quick picks
            </span>
            <div className="grid grid-cols-2 gap-2">
              {presets.map((preset) => {
                const presetVal = toLocalDateTimeInputValue(preset.date)
                const isSelected = selectedInput === presetVal
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setSelectedInput(presetVal)
                      setLocalError(null)
                    }}
                    className={`px-3 py-2 rounded-2xl text-xs font-medium text-left transition-all cursor-pointer focus-accent ${
                      isSelected
                        ? 'glass-strong border-[var(--accent-soft-border)] text-accent-text'
                        : 'glass-subtle hover:bg-[var(--glass-bg-hover)] text-ink'
                    }`}
                  >
                    <div className="font-semibold">{preset.label}</div>
                    <div className="text-[10px] text-ink-subtle">{formatScheduledTime(preset.date)}</div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="schedule-datetime-input" className="block text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
              Custom date &amp; time
            </label>
            <div className="relative flex items-center">
              <Clock className="w-4 h-4 text-ink-subtle absolute left-3.5 pointer-events-none" />
              <input
                id="schedule-datetime-input"
                type="datetime-local"
                value={selectedInput}
                onChange={(e) => {
                  setSelectedInput(e.target.value)
                  setLocalError(null)
                }}
                className="glass-input w-full rounded-2xl pl-10 pr-3.5 py-2.5 text-sm text-ink"
              />
            </div>
            {parsedDate && !Number.isNaN(parsedDate.getTime()) && (
              <p className="text-[11px] text-ink-muted">
                Will send on <span className="font-semibold text-ink">{formatScheduledTime(parsedDate)}</span>
              </p>
            )}
          </div>

          {displayError && (
            <p role="alert" className="text-xs text-[var(--danger-text)] bg-[var(--danger-bg)] px-3 py-2 rounded-xl">
              {displayError}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs font-semibold glass-subtle hover:bg-[var(--glass-bg-hover)] text-ink-muted hover:text-ink transition-colors cursor-pointer focus-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-full text-xs font-semibold btn-accent flex items-center gap-1.5 cursor-pointer focus-accent disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Scheduling...' : confirmLabel}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
