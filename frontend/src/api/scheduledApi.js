import http from './http'

export const scheduledApi = {
  create: async (conversationId, payload) => {
    const res = await http.post(`/conversations/${conversationId}/scheduled`, payload)
    return res.data
  },

  list: async ({ status = 'PENDING', conversationId } = {}) => {
    const params = { status }
    if (conversationId) {
      params.conversationId = conversationId
    }
    const res = await http.get('/scheduled', { params })
    return res.data
  },

  update: async (id, payload) => {
    const res = await http.patch(`/scheduled/${id}`, payload)
    return res.data
  },

  sendNow: async (id) => {
    const res = await http.post(`/scheduled/${id}/send-now`)
    return res.data
  },

  cancel: async (id) => {
    await http.delete(`/scheduled/${id}`)
  },
}
