import http from './http'

export const attachmentApi = {
  upload: async (file, onUploadProgress, signal) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await http.post('/attachments', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      signal,
      onUploadProgress: (progressEvent) => {
        if (onUploadProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onUploadProgress(percent)
        }
      },
    })
    return res.data
  },

  uploadVoice: async (blob, durationMs, waveformBase64, extension = 'webm', onUploadProgress, signal) => {
    const formData = new FormData()
    const fileName = `voice-note.${extension}`
    formData.append('file', blob, fileName)
    formData.append('durationMs', String(Math.round(durationMs)))
    formData.append('waveform', waveformBase64)
    const res = await http.post('/attachments/voice', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      signal,
      onUploadProgress: (progressEvent) => {
        if (onUploadProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onUploadProgress(percent)
        }
      },
    })
    return res.data
  },
}
