import http from './http'

export const messageApi = {
  list: async (conversationId, { before, after, size = 30 } = {}) => {
    const params = { size }
    if (before) params.before = before
    if (after) params.after = after
    const res = await http.get(`/conversations/${conversationId}/messages`, {
      params,
    })
    return res.data
  },
  send: async (conversationId, { content, clientMessageId, replyToId, attachmentIds }) => {
    const res = await http.post(`/conversations/${conversationId}/messages`, {
      content,
      clientMessageId,
      replyToId,
      attachmentIds,
    })
    return res.data
  },
}
