import { useEffect, useRef, useState } from 'react'
import { Trash2, SendHorizonal, Pause, Play, Loader2 } from 'lucide-react'
import { attachmentApi } from '../../api/attachmentApi'
import {
  MAX_VOICE_DURATION_MS,
  MIN_VOICE_DURATION_MS,
  encodeWaveformBase64,
  formatDurationClock,
  reduceWaveform,
  selectSupportedAudioMime,
} from '../../lib/voiceUtils'

const PREVIEW_THRESHOLD_MS = 5000

export default function VoiceRecorder({ onUploaded, onCancel, onError }) {
  const [status, setStatus] = useState('recording') // 'recording' | 'paused' | 'preview' | 'uploading'
  const [elapsedMs, setElapsedMs] = useState(0)
  const [liveBars, setLiveBars] = useState(() => new Array(32).fill(18))
  const [uploadProgress, setUploadProgress] = useState(0)
  const [previewPlaying, setPreviewPlaying] = useState(false)

  const streamRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const mimeChoiceRef = useRef(null)
  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const samplesRef = useRef([])
  const rafRef = useRef(null)
  const tickIntervalRef = useRef(null)
  const lastTickAtRef = useRef(0)
  const elapsedRef = useRef(0)
  const statusRef = useRef('recording')
  const shouldSendAfterStopRef = useRef(false)
  const userCancelledRef = useRef(false)
  const recordedBlobRef = useRef(null)
  const previewUrlRef = useRef(null)
  const previewAudioRef = useRef(null)

  const cleanupMedia = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current)
      tickIntervalRef.current = null
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause()
      previewAudioRef.current = null
    }
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop()
      } catch {
        // Ignore stop errors on cleanup
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
  }

  const uploadRecordedBlob = async (blob, durationMs) => {
    if (durationMs < MIN_VOICE_DURATION_MS) {
      cleanupMedia()
      onError?.('Recording too short (under 1 second) — discarded.')
      onCancel?.()
      return
    }

    setStatus('uploading')
    statusRef.current = 'uploading'
    const waveformBars = reduceWaveform(samplesRef.current, 64)
    const waveformBase64 = encodeWaveformBase64(waveformBars)
    const ext = mimeChoiceRef.current?.extension || 'webm'

    try {
      const dto = await attachmentApi.uploadVoice(
        blob,
        durationMs,
        waveformBase64,
        ext,
        (pct) => setUploadProgress(pct)
      )
      cleanupMedia()
      onUploaded?.(dto)
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to upload voice note.'
      cleanupMedia()
      onError?.(msg)
      onCancel?.()
    }
  }

  useEffect(() => {
    let effectCancelled = false
    userCancelledRef.current = false
    shouldSendAfterStopRef.current = false
    elapsedRef.current = 0
    chunksRef.current = []
    samplesRef.current = []
    statusRef.current = 'recording'

    const init = async () => {
      const mimeChoice = selectSupportedAudioMime()
      if (!mimeChoice) {
        onError?.('Voice recording is not supported in this browser.')
        onCancel?.()
        return
      }
      mimeChoiceRef.current = mimeChoice

      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch (err) {
        if (effectCancelled) return
        const name = err?.name || ''
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          onError?.('Microphone access denied. Allow microphone permissions in browser site settings and retry.')
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          onError?.('No microphone found. Connect a microphone and try again.')
        } else {
          onError?.('Could not access microphone.')
        }
        onCancel?.()
        return
      }

      if (effectCancelled) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      streamRef.current = stream

      // Web Audio Analyser for live waveform capture
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext
        if (AudioCtx) {
          const ctx = new AudioCtx()
          const source = ctx.createMediaStreamSource(stream)
          const analyser = ctx.createAnalyser()
          analyser.fftSize = 256
          source.connect(analyser)
          audioCtxRef.current = ctx
          analyserRef.current = analyser

          const freqData = new Uint8Array(analyser.frequencyBinCount)
          const sampleTick = () => {
            if (effectCancelled || userCancelledRef.current) return
            if (statusRef.current === 'recording' && analyserRef.current) {
              analyserRef.current.getByteFrequencyData(freqData)
              let sum = 0
              for (let i = 0; i < freqData.length; i++) {
                sum += freqData[i]
              }
              const avg = Math.min(255, Math.max(12, Math.round((sum / freqData.length) * 1.8)))
              samplesRef.current.push(avg)
              setLiveBars((prev) => [...prev.slice(1), avg])
            }
            rafRef.current = requestAnimationFrame(sampleTick)
          }
          rafRef.current = requestAnimationFrame(sampleTick)
        }
      } catch {
        // Fallback pulse samples if AudioContext unavailable
      }

      const recorder = new MediaRecorder(stream, { mimeType: mimeChoice.mimeType })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      recorder.onstop = () => {
        if (userCancelledRef.current || effectCancelled) return
        const blob = new Blob(chunksRef.current, { type: mimeChoice.mimeType })
        recordedBlobRef.current = blob
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop())
          streamRef.current = null
        }

        if (shouldSendAfterStopRef.current) {
          uploadRecordedBlob(blob, elapsedRef.current)
        } else {
          // Enter preview mode (long recording review or auto-stop at 5:00)
          const url = URL.createObjectURL(blob)
          previewUrlRef.current = url
          const audio = new Audio(url)
          audio.onended = () => setPreviewPlaying(false)
          previewAudioRef.current = audio
          setStatus('preview')
          statusRef.current = 'preview'
        }
      }

      recorder.start(250)
      lastTickAtRef.current = Date.now()
      tickIntervalRef.current = setInterval(() => {
        const now = Date.now()
        const delta = now - lastTickAtRef.current
        lastTickAtRef.current = now
        if (statusRef.current === 'recording') {
          elapsedRef.current += delta
          setElapsedMs(elapsedRef.current)
          if (!analyserRef.current) {
            const synthetic = Math.round(45 + (Math.sin(elapsedRef.current / 180) + 1) * 70)
            samplesRef.current.push(synthetic)
            setLiveBars((prev) => [...prev.slice(1), synthetic])
          }
          if (elapsedRef.current >= MAX_VOICE_DURATION_MS) {
            elapsedRef.current = MAX_VOICE_DURATION_MS
            setElapsedMs(MAX_VOICE_DURATION_MS)
            shouldSendAfterStopRef.current = false
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
              mediaRecorderRef.current.stop()
            }
          }
        }
      }, 150)
    }

    init()

    return () => {
      effectCancelled = true
      cleanupMedia()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCancel = () => {
    userCancelledRef.current = true
    cleanupMedia()
    onCancel?.()
  }

  const handlePauseOrResume = () => {
    const rec = mediaRecorderRef.current
    if (!rec) return

    if (status === 'recording') {
      if (typeof rec.pause === 'function' && rec.state === 'recording') {
        rec.pause()
      }
      statusRef.current = 'paused'
      setStatus('paused')
    } else if (status === 'paused') {
      if (typeof rec.resume === 'function' && rec.state === 'paused') {
        rec.resume()
      }
      lastTickAtRef.current = Date.now()
      statusRef.current = 'recording'
      setStatus('recording')
    }
  }

  const handleStopAndPreview = () => {
    const rec = mediaRecorderRef.current
    if (!rec || rec.state === 'inactive') return
    shouldSendAfterStopRef.current = false
    rec.stop()
  }

  const handleTogglePreviewPlay = () => {
    const audio = previewAudioRef.current
    if (!audio) return
    if (previewPlaying) {
      audio.pause()
      setPreviewPlaying(false)
    } else {
      audio.play().then(() => setPreviewPlaying(true)).catch(() => setPreviewPlaying(false))
    }
  }

  const handleSend = () => {
    if (status === 'uploading') return
    if (status === 'preview' && recordedBlobRef.current) {
      uploadRecordedBlob(recordedBlobRef.current, elapsedRef.current)
      return
    }
    if (elapsedRef.current < MIN_VOICE_DURATION_MS) {
      userCancelledRef.current = true
      cleanupMedia()
      onError?.('Recording too short (under 1 second) — discarded.')
      onCancel?.()
      return
    }
    shouldSendAfterStopRef.current = true
    const rec = mediaRecorderRef.current
    if (rec && rec.state !== 'inactive') {
      rec.stop()
    } else if (recordedBlobRef.current) {
      uploadRecordedBlob(recordedBlobRef.current, elapsedRef.current)
    }
  }

  return (
    <div
      role="region"
      aria-label="Voice message recorder"
      className="flex items-center gap-2 glass-strong rounded-[26px] p-1.5 pl-3 border-[var(--accent-soft-border)] animate-msg-in"
    >
      {/* Cancel / Trash */}
      <button
        type="button"
        onClick={handleCancel}
        disabled={status === 'uploading'}
        className="p-2 text-[var(--danger-text)] hover:bg-[var(--danger-bg)] rounded-full transition-colors cursor-pointer focus-accent disabled:opacity-40"
        title="Discard voice message"
        aria-label="Cancel voice recording"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {/* Recording Dot + Timer */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {status === 'recording' && (
          <span
            className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"
            aria-hidden="true"
          />
        )}
        <span className="text-xs font-bold tabular-nums text-ink min-w-[36px]">
          {formatDurationClock(elapsedMs)}
        </span>
      </div>

      {/* Live Waveform Bars or Upload Progress */}
      {status === 'uploading' ? (
        <div className="flex-1 flex items-center gap-2 px-2 text-xs text-accent-text font-medium">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Sending voice note{uploadProgress > 0 ? ` (${uploadProgress}%)` : '...'}</span>
        </div>
      ) : status === 'preview' ? (
        <div className="flex-1 flex items-center gap-2 px-1">
          <button
            type="button"
            onClick={handleTogglePreviewPlay}
            className="p-1.5 rounded-full glass-subtle text-accent-text hover:bg-[var(--glass-bg-hover)] cursor-pointer focus-accent"
            aria-label={previewPlaying ? 'Pause preview' : 'Play preview'}
          >
            {previewPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <span className="text-xs text-ink-muted truncate">Ready to send</span>
        </div>
      ) : (
        <div className="flex-1 h-7 flex items-center gap-[2px] overflow-hidden px-1" aria-hidden="true">
          {liveBars.map((val, i) => {
            const pct = Math.max(16, Math.round((val / 255) * 100))
            return (
              <span
                key={i}
                className="flex-1 rounded-full bg-[var(--accent-solid)] opacity-75 transition-all duration-75 min-w-[2px]"
                style={{ height: `${pct}%` }}
              />
            )
          })}
        </div>
      )}

      {/* Optional Review / Pause / Resume */}
      {(status === 'recording' || status === 'paused') && (
        <>
          <button
            type="button"
            onClick={handlePauseOrResume}
            className="p-2 text-ink-muted hover:text-ink hover:bg-[var(--glass-bg-hover)] rounded-full transition-colors cursor-pointer focus-accent"
            title={status === 'recording' ? 'Pause recording' : 'Resume recording'}
            aria-label={status === 'recording' ? 'Pause recording' : 'Resume recording'}
          >
            {status === 'recording' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          {elapsedMs >= PREVIEW_THRESHOLD_MS && (
            <button
              type="button"
              onClick={handleStopAndPreview}
              className="px-2.5 py-1 rounded-full btn-glass text-[11px] font-semibold cursor-pointer focus-accent"
              title="Preview before sending"
            >
              Preview
            </button>
          )}
        </>
      )}

      {/* Send Button */}
      <button
        type="button"
        onClick={handleSend}
        disabled={status === 'uploading'}
        className="w-10 h-10 rounded-full btn-accent flex items-center justify-center flex-shrink-0 cursor-pointer focus-accent disabled:opacity-50"
        title="Send voice message"
        aria-label="Send voice message"
      >
        <SendHorizonal className="w-4 h-4" />
      </button>
    </div>
  )
}
