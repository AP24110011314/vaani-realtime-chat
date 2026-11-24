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
      <div
        role="status"
        aria-live="polite"
        className="bg-emerald-600/90 text-white text-xs font-medium px-4 py-1.5 flex items-center justify-center gap-2 shadow-xs transition-all animate-in fade-in slide-in-from-top-1"
      >
        <CheckCircle className="w-3.5 h-3.5" />
        <span>Back online</span>
      </div>
    )
  }

  if (status === 'reconnecting') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="bg-amber-600/90 text-amber-50 text-xs font-medium px-4 py-1.5 flex items-center justify-center gap-2 shadow-xs transition-all animate-in fade-in slide-in-from-top-1"
      >
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        <span>Reconnecting to server...</span>
      </div>
    )
  }

  if (status === 'offline' || status === 'disconnected') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="bg-rose-600/90 text-rose-50 text-xs font-medium px-4 py-1.5 flex items-center justify-center gap-2 shadow-xs transition-all animate-in fade-in slide-in-from-top-1"
      >
        <WifiOff className="w-3.5 h-3.5" />
        <span>Offline. Check your connection.</span>
      </div>
    )
  }

  return null
}
