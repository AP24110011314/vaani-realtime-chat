import http from './http'

export const searchApi = {
  searchMessages: async (q, { conversationId, page = 0, size = 20 } = {}) => {
    const params = { q, page, size }
    if (conversationId) {
      params.conversationId = conversationId
    }
    const res = await http.get('/search/messages', { params })
    return res.data
  },
}
