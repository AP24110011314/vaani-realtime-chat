import http from './http'

export const callApi = {
  getIceServers: async () => {
    const res = await http.get('/calls/ice-servers')
    return res.data
  },
}
