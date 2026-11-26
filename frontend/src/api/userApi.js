import http from './http'

export const userApi = {
  search: async (query, page = 0, size = 20) => {
    const res = await http.get('/users', {
      params: { query, page, size },
    })
    return res.data
  },
  get: async (id) => {
    const res = await http.get(`/users/${id}`)
    return res.data
  },
  getMe: async () => {
    const res = await http.get('/users/me')
    return res.data
  },
  updateMe: async (data) => {
    const res = await http.patch('/users/me', data)
    return res.data
  },
  setAiConsent: async (enabled) => {
    const res = await http.put('/users/me/ai-consent', { enabled })
    return res.data
  },
  uploadAvatar: async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await http.post('/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },
  deleteAvatar: async () => {
    const res = await http.delete('/users/me/avatar')
    return res.data
  },
  block: async (userId) => {
    await http.post(`/users/${userId}/block`)
  },
  unblock: async (userId) => {
    await http.delete(`/users/${userId}/block`)
  },
  getBlocked: async () => {
    const res = await http.get('/users/blocked')
    return res.data
  },
}
