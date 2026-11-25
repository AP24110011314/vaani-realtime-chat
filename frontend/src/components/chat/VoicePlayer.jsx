import { useEffect, useMemo, useRef, useState } from 'react'
import { Play, Pause } from 'lucide-react'
import { formatDurationClock, reduceWaveform } from '../../lib/voiceUtils'

const SPEED_STEPS = [1, 1.5, 2]
const FALLBACK_BARS = Array.from({ length: 64 }, (_, i) => 55 + Math.round(Math.sin(i * 0.45) * 40))

// Global singleton handle so only one voice message plays at a time
let currentActiveController = null

export default function VoicePlayer({ attachment, isMine = false, disabled = false }) {
  const audioRef = useRef(null)
  const controllerRef = useRef(null)
  const urlRef = useRef(attachment?.url)

  const durationMs = attachment?.durationMs || 0
  const initialDurationSec = durationMs > 0 ? durationMs / 1000 : 0

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [durationSec, setDurationSec] = useState(initialDurationSec)
  const [speedIndex, setSpeedIndex] = useState(0)

  const speed = SPEED_STEPS[speedIndex]
  const rawBars =
    Array.isArray(attachment?.waveform) && attachment.waveform.length === 64
      ? attachment.waveform
      : FALLBACK_BARS
  const bars = useMemo(() => reduceWaveform(rawBars, 36), [rawBars])

  useEffect(() => {
    urlRef.current = attachment?.url
    if (!attachment?.url) return

    const audio = new Audio(attachment.url)
    audio.preload = 'metadata'
    audioRef.current = audio

    const controller = {
      pause: () => {
        audio.pause()
        setIsPlaying(false)
      },
    }
    controllerRef.current = controller

    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDurationSec(audio.duration)
      }
    }
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0)
    }
    const onEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
      if (currentActiveController === controller) {
        currentActiveController = null
      }
    }
    const onPause = () => {
      setIsPlaying(false)
    }
    const onPlay = () => {
      setIsPlaying(true)
    }

    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('play', onPlay)

    return () => {
      audio.pause()
      if (currentActiveController === controller) {
        currentActiveController = null
      }
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('play', onPlay)
      audioRef.current = null
    }
  }, [attachment?.url])

  const togglePlay = async () => {
    const audio = audioRef.current
    if (!audio || disabled) return

    if (isPlaying) {
      audio.pause()
      if (currentActiveController === controllerRef.current) {
        currentActiveController = null
      }
      return
    }

    if (currentActiveController && currentActiveController !== controllerRef.current) {
      currentActiveController.pause()
    }
    currentActiveController = controllerRef.current
    audio.playbackRate = speed
    try {
      await audio.play()
      setIsPlaying(true)
    } catch {
      setIsPlaying(false)
    }
  }

  const cycleSpeed = () => {
    const nextIdx = (speedIndex + 1) % SPEED_STEPS.length
    setSpeedIndex(nextIdx)
    if (audioRef.current) {
      audioRef.current.playbackRate = SPEED_STEPS[nextIdx]
    }
  }

  const seekToRatio = (ratio) => {
    const clamped = Math.max(0, Math.min(1, ratio))
    const total = durationSec > 0 ? durationSec : initialDurationSec
    const target = clamped * total
    setCurrentTime(target)
    if (audioRef.current && Number.isFinite(target)) {
      audioRef.current.currentTime = target
    }
  }

  const handleWaveformPointer = (e) => {
    if (disabled) return
    const rect = e.currentTarget.getBoundingClientRect()
    if (!rect.width) return
    const ratio = (e.clientX - rect.left) / rect.width
    seekToRatio(ratio)
  }

  const handleSliderKeyDown = (e) => {
    if (disabled) return
    const total = durationSec > 0 ? durationSec : initialDurationSec
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      togglePlay()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      const next = Math.min(total, currentTime + 5)
      if (total > 0) seekToRatio(next / total)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const next = Math.max(0, currentTime - 5)
      if (total > 0) seekToRatio(next / total)
    }
  }

  const totalSec = durationSec > 0 ? durationSec : initialDurationSec
  const progressRatio = totalSec > 0 ? Math.min(1, currentTime / totalSec) : 0
  const activeBarsCount = Math.round(progressRatio * bars.length)
  const displayClock =
    isPlaying || currentTime > 0
      ? `${formatDurationClock(currentTime * 1000)} / ${formatDurationClock(totalSec * 1000)}`
      : formatDurationClock(totalSec * 1000)

  return (
    <div className="flex items-center gap-2.5 w-[224px] sm:w-64 max-w-full py-0.5 select-none">
      {/* Play / Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        disabled={disabled}
        aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
        title={isPlaying ? 'Pause' : 'Play'}
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-transform active:scale-95 cursor-pointer focus-accent disabled:opacity-50 ${
          isMine
            ? 'bg-white/20 hover:bg-white/30 text-current'
            : 'btn-accent'
        }`}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current translate-x-[1px]" />
        )}
      </button>

      {/* Waveform Scrubber + Time */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div
          role="slider"
          tabIndex={0}
          aria-label="Voice message progress"
          aria-valuemin={0}
          aria-valuemax={Math.max(1, Math.round(totalSec))}
          aria-valuenow={Math.round(currentTime)}
          aria-valuetext={`${Math.round(currentTime)} of ${Math.round(totalSec)} seconds`}
          onClick={handleWaveformPointer}
          onKeyDown={handleSliderKeyDown}
          className="h-7 w-full overflow-hidden flex items-center gap-[2px] cursor-pointer focus-accent rounded-md"
        >
          {bars.map((amp, idx) => {
            const pct = Math.max(16, Math.round(((Number(amp) || 0) / 255) * 100))
            const played = idx < activeBarsCount
            return (
              <span
                key={idx}
                className="flex-1 rounded-full transition-colors duration-75 min-w-[1px]"
                style={{
                  height: `${pct}%`,
                  backgroundColor: isMine
                    ? played
                      ? 'currentColor'
                      : 'color-mix(in srgb, currentColor 35%, transparent)'
                    : played
                    ? 'var(--accent-solid)'
                    : 'color-mix(in srgb, var(--text-primary) 22%, transparent)',
                }}
              />
            )
          })}
        </div>

        <div className="flex items-center justify-between gap-2 text-[10px] tabular-nums">
          <span className={isMine ? 'opacity-85' : 'text-ink-muted'}>{displayClock}</span>
          <button
            type="button"
            onClick={cycleSpeed}
            aria-label={`Playback speed ${speed}x`}
            title="Change playback speed"
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold transition-colors cursor-pointer focus-accent ${
              isMine
                ? 'bg-black/15 hover:bg-black/25 text-current'
                : 'glass-subtle text-ink hover:text-accent-text'
            }`}
          >
            {speed}x
          </button>
        </div>
      </div>
    </div>
  )
}
