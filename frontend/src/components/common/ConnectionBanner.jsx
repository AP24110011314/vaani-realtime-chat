import { useEffect, useState, useRef } from 'react'
import { useSocket } from '../../hooks/useSocket'
import { WifiOff, RefreshCw, CheckCircle } from 'lucide-react'

export default function ConnectionBanner() {
  const { status } = useSocket()
  const [showBackOnline, setShowBackOnline] = useState(false)
  const prevStatusRef = useRef(status)

  useEffect(() => {
    const prev = prevStatusRef.current
    if ((prev === 'reconnecting' || prev === 'disconnected' || prev === 'offline') && status === 'connected') {
      setShowBackOnline(true)
      const timer = setTimeout(() => {
        setShowBackOnline(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
    prevStatusRef.current = status
  }, [status])

  if (showBackOnline && status === 'connected') {
    return (
      <div className="flex justify-center pt-1">
        <div
          role="status"
          aria-live="polite"
          className="glass-strong rounded-full px-4 py-1 text-xs font-semibold text-[var(--success-text)] border-[var(--success-border)] flex items-center gap-2 animate-msg-in"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          <span>Back online</span>
        </div>
      </div>
    )
  }

  if (status === 'reconnecting') {
    return (
      <div className="flex justify-center pt-1">
        <div
          role="status"
          aria-live="polite"
          className="glass-strong rounded-full px-4 py-1 text-xs font-semibold text-[var(--warning-text)] border-[var(--warning-border)] flex items-center gap-2 animate-msg-in"
        >
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Reconnecting to server...</span>
        </div>
      </div>
    )
  }

  if (status === 'offline' || status === 'disconnected') {
    return (
      <div className="flex justify-center pt-1">
        <div
          role="status"
          aria-live="polite"
          className="glass-strong rounded-full px-4 py-1 text-xs font-semibold text-[var(--danger-text)] border-[var(--danger-border)] flex items-center gap-2 animate-msg-in"
        >
          <WifiOff className="w-3.5 h-3.5" />
          <span>Offline. Check your connection.</span>
        </div>
      </div>
    )
  }

  return null
}
