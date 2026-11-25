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
  send: async (conversationId, { content, clientMessageId, replyToId, attachmentIds, type }) => {
    const res = await http.post(`/conversations/${conversationId}/messages`, {
      content,
      clientMessageId,
      replyToId,
      attachmentIds,
      ...(type ? { type } : {}),
    })
    return res.data
  },
  edit: async (id, content) => {
    const res = await http.patch(`/messages/${id}`, { content })
    return res.data
  },
  delete: async (id) => {
    await http.delete(`/messages/${id}`)
  },
  removePreviews: async (id) => {
    await http.delete(`/messages/${id}/previews`)
  },
  react: async (id, emoji) => {
    const res = await http.put(`/messages/${id}/reactions`, { emoji })
    return res.data
  },
}
