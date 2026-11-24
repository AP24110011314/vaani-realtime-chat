import http from './http'

export const authApi = {
  register: async (data) => {
    const res = await http.post('/auth/register', data)
    return res.data
  },

  login: async (data) => {
    const res = await http.post('/auth/login', data)
    return res.data
  },

  logout: async () => {
    await http.post('/auth/logout')
  },

  logoutAll: async () => {
    await http.post('/auth/logout-all')
  },

  refresh: async () => {
    const res = await http.post('/auth/refresh')
    return res.data
  },

  changePassword: async (data) => {
    await http.post('/auth/change-password', data)
  },

  getMe: async () => {
    const res = await http.get('/users/me')
    return res.data
  },

  updateMe: async (data) => {
    const res = await http.patch('/users/me', data)
    return res.data
  },

  getCsrf: async () => {
    await http.get('/auth/csrf').catch(() => {})
  },
}
