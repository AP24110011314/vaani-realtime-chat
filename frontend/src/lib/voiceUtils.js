const MIME_CANDIDATES = [
  { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
  { mimeType: 'audio/webm', extension: 'webm' },
  { mimeType: 'audio/mp4', extension: 'm4a' },
  { mimeType: 'audio/ogg;codecs=opus', extension: 'ogg' },
]

export const MAX_VOICE_DURATION_MS = 300_000
export const MIN_VOICE_DURATION_MS = 1_000
export const WAVEFORM_BAR_COUNT = 64

/**
 * Pick the first browser-supported MediaRecorder audio MIME type.
 */
export function selectSupportedAudioMime(recorderClass = typeof MediaRecorder !== 'undefined' ? MediaRecorder : null) {
  if (!recorderClass || typeof recorderClass.isTypeSupported !== 'function') {
    return null
  }
  for (const candidate of MIME_CANDIDATES) {
    try {
      if (recorderClass.isTypeSupported(candidate.mimeType)) {
        return candidate
      }
    } catch {
      // Ignore probe error
    }
  }
  return null
}

/**
 * Check if browser supports voice note recording cleanly.
 */
export function isVoiceRecordingSupported() {
  return (
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined' &&
    Boolean(selectSupportedAudioMime())
  )
}

/**
 * Reduce an array of arbitrary amplitude samples (0-255) into exactly 64 bars (0-255).
 */
export function reduceWaveform(samples, barCount = WAVEFORM_BAR_COUNT) {
  const result = new Array(barCount).fill(0)
  if (!samples || samples.length === 0) {
    return result
  }

  const len = samples.length
  if (len <= barCount) {
    for (let i = 0; i < barCount; i++) {
      const idx = Math.min(len - 1, Math.floor((i * len) / barCount))
      const val = Math.round(Number(samples[idx]) || 0)
      result[i] = Math.max(0, Math.min(255, val))
    }
    return result
  }

  const bucketSize = len / barCount
  for (let i = 0; i < barCount; i++) {
    const start = Math.floor(i * bucketSize)
    const end = Math.max(start + 1, Math.floor((i + 1) * bucketSize))
    let peak = 0
    for (let j = start; j < end && j < len; j++) {
      const v = Number(samples[j]) || 0
      if (v > peak) peak = v
    }
    result[i] = Math.max(0, Math.min(255, Math.round(peak)))
  }
  return result
}

/**
 * Encode a 64-int [0-255] array into a 64-byte Base64 string.
 */
export function encodeWaveformBase64(bars) {
  const normalized = reduceWaveform(bars, WAVEFORM_BAR_COUNT)
  let binary = ''
  for (let i = 0; i < normalized.length; i++) {
    binary += String.fromCharCode(normalized[i] & 0xff)
  }
  return btoa(binary)
}

/**
 * Format milliseconds into M:SS (e.g. 42000 -> "0:42", 125000 -> "2:05").
 */
export function formatDurationClock(ms) {
  const totalSec = Math.max(0, Math.round((Number(ms) || 0) / 1000))
  const mins = Math.floor(totalSec / 60)
  const secs = totalSec % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}
