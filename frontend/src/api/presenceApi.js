import http from './http'

export const presenceApi = {
  get: async (userIds = []) => {
    if (!userIds || userIds.length === 0) return []
    const res = await http.get('/presence', {
      params: { userIds: userIds.join(',') },
    })
    return res.data
  },
}
