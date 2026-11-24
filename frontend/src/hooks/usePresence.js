import { useEffect, useMemo } from 'react'
import { useSocket } from './useSocket'

export function usePresence(userIdOrIds) {
  const socketContext = useSocket()
  const presenceMap = socketContext?.presenceMap || {}
  const fetchPresence = socketContext?.fetchPresence

  const userIds = useMemo(() => {
    if (!userIdOrIds) return []
    if (Array.isArray(userIdOrIds)) return userIdOrIds.filter(Boolean)
    return [userIdOrIds]
  }, [userIdOrIds])

  useEffect(() => {
    if (userIds.length > 0 && fetchPresence) {
      fetchPresence(userIds)
    }
  }, [userIds, fetchPresence])

  if (Array.isArray(userIdOrIds)) {
    return userIds.map((id) => presenceMap[id] || { online: false, lastSeenAt: null })
  }

  if (!userIdOrIds) {
    return { online: false, lastSeenAt: null }
  }

  return presenceMap[userIdOrIds] || { online: false, lastSeenAt: null }
}
