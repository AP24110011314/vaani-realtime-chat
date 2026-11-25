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
}
