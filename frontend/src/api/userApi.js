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
}
