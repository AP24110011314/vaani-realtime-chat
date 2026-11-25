import http from './http'

export const inviteApi = {
  create: async (conversationId, { expiresInSeconds = null, maxUses = null, requiresApproval = false } = {}) => {
    const res = await http.post(`/conversations/${conversationId}/invites`, {
      expiresInSeconds,
      maxUses,
      requiresApproval,
    })
    return res.data
  },
  list: async (conversationId) => {
    const res = await http.get(`/conversations/${conversationId}/invites`)
    return res.data
  },
  revoke: async (conversationId, inviteId) => {
    await http.delete(`/conversations/${conversationId}/invites/${inviteId}`)
  },
  preview: async (code) => {
    const res = await http.get(`/invites/${encodeURIComponent(code)}`)
    return res.data
  },
  join: async (code) => {
    const res = await http.post(`/invites/${encodeURIComponent(code)}/join`)
    return res.data
  },
  listRequests: async (conversationId, status = 'PENDING') => {
    const res = await http.get(`/conversations/${conversationId}/join-requests`, {
      params: { status },
    })
    return res.data
  },
  approveRequest: async (conversationId, requestId) => {
    const res = await http.post(`/conversations/${conversationId}/join-requests/${requestId}/approve`)
    return res.data
  },
  rejectRequest: async (conversationId, requestId) => {
    const res = await http.post(`/conversations/${conversationId}/join-requests/${requestId}/reject`)
    return res.data
  },
}
