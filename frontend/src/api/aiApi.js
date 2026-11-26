import http from './http'

export const aiApi = {
  catchUp: async (conversationId, { fromMessageId, force } = {}) => {
    const body = {}
    if (fromMessageId != null) body.fromMessageId = fromMessageId
    if (force) body.force = true
    const res = await http.post(`/conversations/${conversationId}/catch-up`, body)
    return res.data
  },
}
