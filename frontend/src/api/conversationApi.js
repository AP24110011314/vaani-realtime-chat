import http from './http'

export const conversationApi = {
  list: async (archived = false) => {
    const res = await http.get('/conversations', {
      params: { archived },
    })
    return res.data
  },
  get: async (id) => {
    const res = await http.get(`/conversations/${id}`)
    return res.data
  },
  createDirect: async (userId) => {
    const res = await http.post('/conversations/direct', { userId })
    return res.data
  },
}
