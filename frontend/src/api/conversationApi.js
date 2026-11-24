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
  createGroup: async ({ title, description, memberIds }) => {
    const res = await http.post('/conversations/groups', {
      title,
      description,
      memberIds,
    })
    return res.data
  },
  updateGroup: async (id, { title, description }) => {
    const res = await http.patch(`/conversations/${id}`, {
      title,
      description,
    })
    return res.data
  },
  addMembers: async (id, userIds) => {
    const res = await http.post(`/conversations/${id}/members`, { userIds })
    return res.data
  },
  removeMember: async (id, userId) => {
    await http.delete(`/conversations/${id}/members/${userId}`)
  },
  leave: async (id) => {
    await http.post(`/conversations/${id}/leave`)
  },
  setRole: async (id, userId, role) => {
    const res = await http.patch(`/conversations/${id}/members/${userId}/role`, {
      role,
    })
    return res.data
  },
}
