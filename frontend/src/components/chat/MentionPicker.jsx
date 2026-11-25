import { Users } from 'lucide-react'
import UserAvatar from '../common/UserAvatar'

/**
 * Floating glass popover above MessageComposer for picking @mentions in groups.
 */
export default function MentionPicker({
  isOpen,
  items = [],
  activeIndex = 0,
  onSelect,
  isLoading = false,
}) {
  if (!isOpen) return null

  return (
    <div
      role="listbox"
      aria-label="Mention suggestions"
      className="absolute bottom-full left-0 right-0 sm:right-auto sm:w-80 mb-2 glass-strong rounded-2xl overflow-hidden z-30 animate-modal-in"
    >
      {isLoading && items.length === 0 ? (
        <div className="px-3.5 py-2.5 text-xs text-ink-muted">Loading members...</div>
      ) : items.length === 0 ? (
        <div className="px-3.5 py-2.5 text-xs text-ink-subtle">No matching group members</div>
      ) : (
        <div className="max-h-60 overflow-y-auto py-1 divide-y divide-[var(--glass-border)]">
          {items.map((item, idx) => {
            const isSelected = idx === activeIndex
            const isAll = item.id === 'all'
            return (
              <button
                key={String(item.id)}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onSelect?.(item)
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--accent-soft-bg)] text-ink'
                    : 'hover:bg-[var(--glass-bg-hover)] text-ink'
                }`}
              >
                {isAll ? (
                  <span className="w-7 h-7 rounded-full accent-badge flex items-center justify-center shrink-0">
                    <Users className="w-3.5 h-3.5" />
                  </span>
                ) : (
                  <UserAvatar
                    src={item.avatarUrl}
                    name={item.name}
                    seed={item.id || item.name}
                    size="sm"
                    isOnline={item.online}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-ink truncate">
                      {isAll ? '@all' : item.name}
                    </span>
                    {isAll && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[var(--accent-soft-bg)] text-accent-text font-semibold">
                        Notify everyone
                      </span>
                    )}
                  </div>
                  {item.about && !isAll && (
                    <p className="text-[10px] text-ink-muted truncate">{item.about}</p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
