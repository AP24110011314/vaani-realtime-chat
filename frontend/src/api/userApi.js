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
}
