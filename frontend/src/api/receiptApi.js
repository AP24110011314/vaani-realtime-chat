import http from './http'

export const receiptApi = {
  markRead: async (conversationId, upToMessageId) => {
    const { data } = await http.post(`/conversations/${conversationId}/read`, {
      upToMessageId: upToMessageId || null,
    })
    return data
  },

  getReceipts: async (messageId) => {
    const { data } = await http.get(`/messages/${messageId}/receipts`)
    return data
  },
}
