import { Client } from '@stomp/stompjs'

/**
 * Creates and configures a STOMP WebSocket client instance.
 *
 * @param {Object} options
 * @param {Function} options.onConnect - Called when connection is established
 * @param {Function} options.onEvent - Called when an event arrives on /user/queue/events
 * @param {Function} options.onStatus - Called on connection status change
 * @param {Function} options.onError - Called on STOMP error
 * @returns {Client}
 */
export function createSocket({ onConnect, onEvent, onStatus, onError }) {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const wsPath = import.meta.env.VITE_WS_PATH || '/ws'
  const wsUrl = `${proto}://${window.location.host}${wsPath}`

  const client = new Client({
    brokerURL: wsUrl,
    reconnectDelay: 2000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    onConnect: () => {
      onStatus?.('connected')
      client.subscribe('/user/queue/events', (frame) => {
        try {
          const envelope = JSON.parse(frame.body)
          onEvent?.(envelope)
        } catch (e) {
          console.error('Failed to parse STOMP event payload:', e, frame.body)
        }
      })
      onConnect?.()
    },
    onDisconnect: () => {
      onStatus?.('disconnected')
    },
    onWebSocketClose: () => {
      onStatus?.('reconnecting')
    },
    onStompError: (frame) => {
      const msg = frame.headers?.message || 'STOMP error'
      console.warn('STOMP protocol error:', msg)
      onError?.(frame)
    },
    onWebSocketError: (event) => {
      console.warn('WebSocket connection error:', event)
      onStatus?.('reconnecting')
    },
  })

  return client
}
