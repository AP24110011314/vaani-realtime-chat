/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { callApi } from '../api/callApi'
import { useSocket } from '../hooks/useSocket'
import { WebRtcPeer, classifyMediaError, getCallConstraints } from '../lib/webrtc'

export const CallContext = createContext({
  callState: 'idle',
  callId: null,
  conversationId: null,
  callType: 'AUDIO',
  isGroupCall: false,
  callTitle: null,
  peer: null,
  isCaller: false,
  isMuted: false,
  isCameraOff: false,
  quality: 'good',
  durationSec: 0,
  connectionState: 'new',
  mediaError: null,
  endNotice: null,
  localStream: null,
  remoteStream: null,
  remotePeers: [],
  startCall: async () => {},
  acceptIncomingCall: async () => {},
  declineIncomingCall: () => {},
  endCall: () => {},
  toggleMute: () => {},
  toggleCamera: () => {},
  flipCamera: async () => {},
  clearMediaError: () => {},
  clearEndNotice: () => {},
})

function worstQuality(qualities) {
  if (qualities.includes('poor')) return 'poor'
  if (qualities.includes('fair')) return 'fair'
  return 'good'
}

function startTitleRingtone(callerName) {
  const prevTitle = typeof document !== 'undefined' ? document.title : 'Vanni'
  let toggle = false
  const titleTimer = setInterval(() => {
    toggle = !toggle
    if (typeof document !== 'undefined') {
      document.title = toggle ? `📞 ${callerName || 'Incoming call'} · Vanni` : prevTitle
    }
  }, 900)

  let audioCtx = null
  let chimeTimer = null
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (AudioCtx) {
      audioCtx = new AudioCtx()
      const playTone = () => {
        if (!audioCtx || audioCtx.state === 'closed') return
        if (audioCtx.state === 'suspended') {
          audioCtx.resume().catch(() => {})
        }
        const now = audioCtx.currentTime
        const osc = audioCtx.createOscillator()
        const gain = audioCtx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(528, now)
        osc.frequency.setValueAtTime(660, now + 0.18)
        gain.gain.setValueAtTime(0.001, now)
        gain.gain.exponentialRampToValueAtTime(0.06, now + 0.04)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
        osc.connect(gain)
        gain.connect(audioCtx.destination)
        osc.start(now)
        osc.stop(now + 0.52)
      }
      playTone()
      chimeTimer = setInterval(playTone, 2000)
    }
  } catch {
    // Autoplay/audio optional
  }

  return () => {
    clearInterval(titleTimer)
    if (chimeTimer) clearInterval(chimeTimer)
    if (typeof document !== 'undefined') {
      document.title = 'Vanni'
    }
    if (audioCtx && audioCtx.state !== 'closed') {
      audioCtx.close().catch(() => {})
    }
  }
}

export function CallProvider({ children }) {
  const queryClient = useQueryClient()
  const socket = useSocket()
  const publishStomp = useCallback(
    (dest, body) => (typeof socket?.publishStomp === 'function' ? socket.publishStomp(dest, body) : false),
    [socket]
  )
  const subscribeCallEvents = socket?.subscribeCallEvents

  const [callState, setCallState] = useState('idle')
  const [callId, setCallId] = useState(null)
  const [conversationId, setConversationId] = useState(null)
  const [callType, setCallType] = useState('AUDIO')
  const [isGroupCall, setIsGroupCall] = useState(false)
  const [callTitle, setCallTitle] = useState(null)
  const [peer, setPeer] = useState(null)
  const [isCaller, setIsCaller] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [quality, setQuality] = useState('good')
  const [durationSec, setDurationSec] = useState(0)
  const [connectionState, setConnectionState] = useState('new')
  const [mediaError, setMediaError] = useState(null)
  const [endNotice, setEndNotice] = useState(null)
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [remotePeers, setRemotePeers] = useState([])

  const callStateRef = useRef('idle')
  const callIdRef = useRef(null)
  const isGroupCallRef = useRef(false)
  const peerRef = useRef(null)
  const isCallerRef = useRef(false)
  const isAcceptingRef = useRef(false)
  const facingModeRef = useRef('user')
  const localStreamRef = useRef(null)
  const iceDataRef = useRef(null)
  const peersMapRef = useRef(new Map())
  const pendingSignalsBySenderRef = useRef(new Map())
  const stopRingRef = useRef(null)
  const durationTimerRef = useRef(null)
  const qualityTimerRef = useRef(null)
  const noticeTimerRef = useRef(null)

  const syncRemotePeers = useCallback(() => {
    const entries = Array.from(peersMapRef.current.values()).map((entry) => ({
      user: entry.user,
      stream: entry.stream || null,
      connectionState: entry.connectionState || 'new',
      quality: entry.quality || 'good',
    }))
    setRemotePeers(entries)
    setRemoteStream(entries.find((e) => e.stream)?.stream || null)
  }, [])

  const stopTimersAndRing = useCallback(() => {
    if (stopRingRef.current) {
      stopRingRef.current()
      stopRingRef.current = null
    }
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current)
      durationTimerRef.current = null
    }
    if (qualityTimerRef.current) {
      clearInterval(qualityTimerRef.current)
      qualityTimerRef.current = null
    }
  }, [])

  const stopMediaAndPeers = useCallback(() => {
    stopTimersAndRing()
    peersMapRef.current.forEach((entry) => {
      entry.pc?.close()
    })
    peersMapRef.current.clear()
    pendingSignalsBySenderRef.current.clear()
    iceDataRef.current = null
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop())
      localStreamRef.current = null
    }
    setLocalStream(null)
    setRemoteStream(null)
    setRemotePeers([])
  }, [stopTimersAndRing])

  const resetToIdle = useCallback(
    (noticeText = null) => {
      stopMediaAndPeers()
      callStateRef.current = 'idle'
      callIdRef.current = null
      isGroupCallRef.current = false
      peerRef.current = null
      isCallerRef.current = false
      isAcceptingRef.current = false
      setCallState('idle')
      setCallId(null)
      setConversationId(null)
      setIsGroupCall(false)
      setCallTitle(null)
      setPeer(null)
      setIsCaller(false)
      setIsMuted(false)
      setIsCameraOff(false)
      setDurationSec(0)
      setQuality('good')
      setConnectionState('new')
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      if (noticeText) {
        if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
        setEndNotice(noticeText)
        noticeTimerRef.current = setTimeout(() => setEndNotice(null), 3500)
      }
    },
    [stopMediaAndPeers, queryClient]
  )

  const getCachedIceConfig = useCallback(async () => {
    if (iceDataRef.current) return iceDataRef.current
    let iceData = { iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }], relayOnly: false }
    try {
      iceData = await callApi.getIceServers()
    } catch {
      // Fallback to public STUN if endpoint unavailable
    }
    iceDataRef.current = iceData
    return iceData
  }, [])

  const evaluateOverallConnection = useCallback(
    (activeCallId) => {
      const states = Array.from(peersMapRef.current.values()).map((e) => e.connectionState)
      if (states.includes('connected')) {
        setConnectionState('connected')
        if (callStateRef.current !== 'connected') {
          callStateRef.current = 'connected'
          setCallState('connected')
          publishStomp('/app/call.state', { callId: activeCallId, state: 'CONNECTED' })
        }
        if (!durationTimerRef.current) {
          durationTimerRef.current = setInterval(() => {
            setDurationSec((s) => s + 1)
          }, 1000)
        }
        if (!qualityTimerRef.current) {
          qualityTimerRef.current = setInterval(async () => {
            const list = Array.from(peersMapRef.current.values())
            if (list.length === 0) return
            const qualities = await Promise.all(
              list.map(async (e) => {
                const q = e.pc ? await e.pc.getQuality() : 'good'
                e.quality = q
                return q
              })
            )
            setQuality(worstQuality(qualities))
            syncRemotePeers()
          }, 2000)
        }
      } else if (states.includes('disconnected')) {
        setConnectionState('disconnected')
        if (callStateRef.current === 'connected') {
          callStateRef.current = 'reconnecting'
          setCallState('reconnecting')
          publishStomp('/app/call.state', { callId: activeCallId, state: 'RECONNECTING' })
        }
      } else if (states.includes('connecting') || states.includes('new')) {
        setConnectionState('connecting')
      }
    },
    [publishStomp, syncRemotePeers]
  )

  const createPeerConnectionForUser = useCallback(
    async (activeCallId, peerKey, userObj, stream, sendOffer) => {
      const existing = peersMapRef.current.get(peerKey)
      if (existing?.pc) {
        existing.pc.close()
      }

      const iceData = await getCachedIceConfig()
      const numericTargetId = userObj?.id != null ? Number(userObj.id) : null
      const signalTargetField = isGroupCallRef.current && numericTargetId ? { targetUserId: numericTargetId } : {}

      const entry = {
        user: userObj || { name: 'Contact' },
        pc: null,
        stream: null,
        connectionState: 'new',
        quality: 'good',
      }
      peersMapRef.current.set(peerKey, entry)
      syncRemotePeers()

      const rtc = new WebRtcPeer({
        iceServers: iceData.iceServers || [],
        relayOnly: Boolean(iceData.relayOnly),
        onIceCandidate: (candidate) => {
          publishStomp('/app/call.signal', {
            callId: activeCallId,
            ...signalTargetField,
            kind: 'candidate',
            payload: candidate,
          })
        },
        onRemoteStream: (remote) => {
          entry.stream = remote
          syncRemotePeers()
        },
        onConnectionStateChange: async (connState) => {
          entry.connectionState = connState
          syncRemotePeers()
          if (connState === 'connected') {
            evaluateOverallConnection(activeCallId)
          } else if (connState === 'disconnected') {
            evaluateOverallConnection(activeCallId)
            if ((sendOffer || !isGroupCallRef.current && isCallerRef.current) && entry.pc) {
              try {
                const restartOffer = await entry.pc.createOffer({ iceRestart: true })
                publishStomp('/app/call.signal', {
                  callId: activeCallId,
                  ...signalTargetField,
                  kind: 'offer',
                  payload: restartOffer,
                })
              } catch {
                // Wait for peer recovery or failure
              }
            }
          } else if (connState === 'failed') {
            if (!isGroupCallRef.current) {
              publishStomp('/app/call.end', { callId: activeCallId })
              resetToIdle('Call connection failed')
            } else {
              entry.pc?.close()
              peersMapRef.current.delete(peerKey)
              syncRemotePeers()
              evaluateOverallConnection(activeCallId)
            }
          }
        },
      })

      if (stream) {
        rtc.addLocalStream(stream)
      }
      entry.pc = rtc

      if (sendOffer) {
        try {
          const offer = await rtc.createOffer()
          publishStomp('/app/call.signal', {
            callId: activeCallId,
            ...signalTargetField,
            kind: 'offer',
            payload: offer,
          })
        } catch {
          if (!isGroupCallRef.current) {
            publishStomp('/app/call.end', { callId: activeCallId })
            resetToIdle('Could not start media negotiation')
          }
        }
      }

      // Drain queued signals for this peer (plus any legacy 'direct' queue for 1:1)
      const queued = [
        ...(pendingSignalsBySenderRef.current.get(peerKey) || []),
        ...(!isGroupCallRef.current && peerKey !== 'direct'
          ? pendingSignalsBySenderRef.current.get('direct') || []
          : []),
      ]
      pendingSignalsBySenderRef.current.delete(peerKey)
      if (!isGroupCallRef.current) {
        pendingSignalsBySenderRef.current.delete('direct')
      }

      for (const sig of queued) {
        if (sig.kind === 'offer') {
          const answer = await rtc.acceptOffer(sig.payload)
          const replyTarget = sig.fromUserId != null && isGroupCallRef.current
            ? { targetUserId: Number(sig.fromUserId) }
            : signalTargetField
          publishStomp('/app/call.signal', {
            callId: activeCallId,
            ...replyTarget,
            kind: 'answer',
            payload: answer,
          })
        } else if (sig.kind === 'answer') {
          await rtc.acceptAnswer(sig.payload)
        } else if (sig.kind === 'candidate') {
          await rtc.addCandidate(sig.payload)
        }
      }

      return rtc
    },
    [evaluateOverallConnection, getCachedIceConfig, publishStomp, resetToIdle, syncRemotePeers]
  )

  const startCall = useCallback(
    async ({ conversationId: convId, peer: peerInfo, type = 'AUDIO', isGroup = false, groupTitle = null }) => {
      if (callStateRef.current !== 'idle') return
      setMediaError(null)
      setEndNotice(null)

      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia(getCallConstraints(type, facingModeRef.current))
      } catch (err) {
        const classified = classifyMediaError(err)
        setMediaError({
          ...classified,
          conversationId: convId,
          peer: peerInfo,
          isGroup,
          groupTitle,
          requestedType: type,
          mode: 'outgoing',
        })
        return
      }

      localStreamRef.current = stream
      setLocalStream(stream)
      facingModeRef.current = 'user'

      callStateRef.current = 'outgoing'
      isCallerRef.current = true
      isGroupCallRef.current = Boolean(isGroup)
      peerRef.current = peerInfo || { name: isGroup ? (groupTitle || 'Group call') : 'Contact' }
      setCallState('outgoing')
      setConversationId(convId)
      setCallType(type)
      setIsGroupCall(Boolean(isGroup))
      setCallTitle(isGroup ? (groupTitle || peerInfo?.name || 'Group call') : (peerInfo?.name || 'Contact'))
      setPeer(peerRef.current)
      setIsCaller(true)
      setIsMuted(false)
      setIsCameraOff(type !== 'VIDEO')

      const clientCallId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `call-${Date.now()}`

      const sent = publishStomp('/app/call.invite', {
        conversationId: Number(convId),
        type,
        clientCallId,
      })
      if (!sent) {
        resetToIdle('Connection lost. Please try again.')
      }
    },
    [publishStomp, resetToIdle]
  )

  const acceptIncomingCall = useCallback(
    async ({ audioOnlyFallback = false } = {}) => {
      const activeId = callIdRef.current
      if (!activeId || callStateRef.current !== 'incoming') return
      const targetType = audioOnlyFallback ? 'AUDIO' : callType
      setMediaError(null)
      isAcceptingRef.current = true

      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia(getCallConstraints(targetType, facingModeRef.current))
      } catch (err) {
        isAcceptingRef.current = false
        const classified = classifyMediaError(err)
        setMediaError({ ...classified, requestedType: callType, mode: 'incoming' })
        return
      }

      stopTimersAndRing()
      localStreamRef.current = stream
      setLocalStream(stream)
      setCallType(targetType)
      setIsMuted(false)
      setIsCameraOff(targetType !== 'VIDEO')
      callStateRef.current = 'connecting'
      setCallState('connecting')

      if (!isGroupCallRef.current) {
        const peerKey = peerRef.current?.id != null ? String(peerRef.current.id) : 'direct'
        await createPeerConnectionForUser(activeId, peerKey, peerRef.current, stream, false)
      }
      publishStomp('/app/call.accept', { callId: activeId })
    },
    [callType, createPeerConnectionForUser, publishStomp, stopTimersAndRing]
  )

  const declineIncomingCall = useCallback(() => {
    const activeId = callIdRef.current
    if (activeId) {
      publishStomp('/app/call.decline', { callId: activeId })
    }
    resetToIdle()
  }, [publishStomp, resetToIdle])

  const endCall = useCallback(() => {
    const activeId = callIdRef.current
    if (activeId) {
      const dest = callStateRef.current === 'outgoing' ? '/app/call.cancel' : '/app/call.end'
      publishStomp(dest, { callId: activeId })
    }
    resetToIdle()
  }, [publishStomp, resetToIdle])

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    setIsMuted((prev) => {
      const nextMuted = !prev
      stream.getAudioTracks().forEach((t) => { t.enabled = !nextMuted })
      return nextMuted
    })
  }, [])

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    setIsCameraOff((prev) => {
      const nextOff = !prev
      stream.getVideoTracks().forEach((t) => { t.enabled = !nextOff })
      return nextOff
    })
  }, [])

  const flipCamera = useCallback(async () => {
    const stream = localStreamRef.current
    if (!stream || callType !== 'VIDEO') return
    const nextMode = facingModeRef.current === 'user' ? 'environment' : 'user'
    try {
      const newVideoStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: nextMode },
      })
      const newTrack = newVideoStream.getVideoTracks()[0]
      if (!newTrack) return
      facingModeRef.current = nextMode
      const oldTrack = stream.getVideoTracks()[0]
      for (const entry of peersMapRef.current.values()) {
        if (entry.pc) {
          await entry.pc.replaceVideoTrack(newTrack)
        }
      }
      if (oldTrack) {
        stream.removeTrack(oldTrack)
        oldTrack.stop()
      }
      stream.addTrack(newTrack)
      setLocalStream(new MediaStream(stream.getTracks()))
    } catch {
      // Single camera device; ignore gracefully
    }
  }, [callType])

  // Subscribe to call.* WebSocket events
  useEffect(() => {
    if (typeof subscribeCallEvents !== 'function') return undefined
    return subscribeCallEvents(async (type, data) => {
      switch (type) {
        case 'call.ringing': {
          callIdRef.current = data?.callId || null
          setCallId(data?.callId || null)
          if (data?.isGroup) {
            isGroupCallRef.current = true
            setIsGroupCall(true)
            setCallTitle(data.conversationTitle || 'Group call')
          }
          break
        }
        case 'call.incoming': {
          if (callStateRef.current !== 'idle') {
            return
          }
          callIdRef.current = data.callId
          callStateRef.current = 'incoming'
          isCallerRef.current = false
          isAcceptingRef.current = false
          const isGroup = Boolean(data.isGroup)
          isGroupCallRef.current = isGroup
          peerRef.current = data.caller
          setCallId(data.callId)
          setConversationId(data.conversationId)
          setCallType(data.type || 'AUDIO')
          setIsGroupCall(isGroup)
          setCallTitle(isGroup ? (data.conversationTitle || 'Group call') : (data.caller?.name || 'Contact'))
          setPeer(data.caller)
          setIsCaller(false)
          setCallState('incoming')
          stopTimersAndRing()
          stopRingRef.current = startTitleRingtone(
            isGroup ? (data.conversationTitle || data.caller?.name) : data.caller?.name
          )
          break
        }
        case 'call.handled_elsewhere': {
          if (callIdRef.current === data?.callId && !isAcceptingRef.current) {
            resetToIdle('Answered on another tab')
          }
          break
        }
        case 'call.accepted': {
          if (callIdRef.current !== data?.callId) break
          callStateRef.current = 'connecting'
          setCallState('connecting')
          const peerKey = peerRef.current?.id != null ? String(peerRef.current.id) : 'direct'
          await createPeerConnectionForUser(data.callId, peerKey, peerRef.current, localStreamRef.current, true)
          break
        }
        case 'call.joined': {
          if (!localStreamRef.current) break
          callIdRef.current = data.callId
          setCallId(data.callId)
          isGroupCallRef.current = true
          setIsGroupCall(true)
          setConversationId(data.conversationId)
          if (data.conversationTitle) setCallTitle(data.conversationTitle)
          if (data.type) setCallType(data.type)
          callStateRef.current = 'connecting'
          setCallState('connecting')

          const peers = Array.isArray(data.peers) ? data.peers : []
          for (const remoteUser of peers) {
            if (remoteUser?.id != null) {
              await createPeerConnectionForUser(
                data.callId,
                String(remoteUser.id),
                remoteUser,
                localStreamRef.current,
                true
              )
            }
          }
          break
        }
        case 'call.participant_joined': {
          if (callIdRef.current !== data?.callId || !data?.user?.id) break
          if (callStateRef.current === 'outgoing') {
            callStateRef.current = 'connecting'
            setCallState('connecting')
          }
          await createPeerConnectionForUser(
            data.callId,
            String(data.user.id),
            data.user,
            localStreamRef.current,
            false
          )
          break
        }
        case 'call.participant_left': {
          if (callIdRef.current !== data?.callId || data?.userId == null) break
          const key = String(data.userId)
          const entry = peersMapRef.current.get(key)
          if (entry) {
            entry.pc?.close()
            peersMapRef.current.delete(key)
            syncRemotePeers()
            evaluateOverallConnection(data.callId)
          }
          break
        }
        case 'call.signal': {
          if (callIdRef.current !== data?.callId) break
          const fromKey = data.fromUserId != null ? String(data.fromUserId) : 'direct'
          let entry = peersMapRef.current.get(fromKey)
          if (!entry && !isGroupCallRef.current && peersMapRef.current.size === 1) {
            entry = Array.from(peersMapRef.current.values())[0]
          }
          if (!entry?.pc) {
            const list = pendingSignalsBySenderRef.current.get(fromKey) || []
            list.push({ kind: data.kind, payload: data.payload, fromUserId: data.fromUserId })
            pendingSignalsBySenderRef.current.set(fromKey, list)
            break
          }
          const rtc = entry.pc
          const replyTarget = isGroupCallRef.current && data.fromUserId != null
            ? { targetUserId: Number(data.fromUserId) }
            : {}
          if (data.kind === 'offer') {
            const answer = await rtc.acceptOffer(data.payload)
            publishStomp('/app/call.signal', {
              callId: data.callId,
              ...replyTarget,
              kind: 'answer',
              payload: answer,
            })
          } else if (data.kind === 'answer') {
            await rtc.acceptAnswer(data.payload)
          } else if (data.kind === 'candidate') {
            await rtc.addCandidate(data.payload)
          }
          break
        }
        case 'call.declined': {
          if (callIdRef.current === data?.callId) resetToIdle('Call declined')
          break
        }
        case 'call.cancelled': {
          if (callIdRef.current === data?.callId) resetToIdle('Call cancelled')
          break
        }
        case 'call.busy': {
          if (callIdRef.current === data?.callId || callStateRef.current === 'outgoing') {
            resetToIdle('User is busy on another call')
          }
          break
        }
        case 'call.missed': {
          if (callIdRef.current === data?.callId) resetToIdle('No answer')
          break
        }
        case 'call.ended': {
          if (callIdRef.current === data?.callId) resetToIdle('Call ended')
          break
        }
        case 'call.error': {
          if (callStateRef.current !== 'idle') {
            resetToIdle(data?.message || 'Call could not be completed')
          } else if (data?.message) {
            setEndNotice(data.message)
          }
          break
        }
        default:
          break
      }
    })
  }, [subscribeCallEvents, createPeerConnectionForUser, evaluateOverallConnection, publishStomp, resetToIdle, stopTimersAndRing, syncRemotePeers])

  // Clean up on page close/navigation unload or provider unmount
  useEffect(() => {
    const handleUnload = () => {
      if (callIdRef.current && callStateRef.current !== 'idle') {
        const dest = callStateRef.current === 'outgoing' ? '/app/call.cancel' : '/app/call.end'
        publishStomp(dest, { callId: callIdRef.current })
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
    window.addEventListener('pagehide', handleUnload)
    return () => {
      window.removeEventListener('pagehide', handleUnload)
      stopMediaAndPeers()
    }
  }, [publishStomp, stopMediaAndPeers])

  return (
    <CallContext.Provider
      value={{
        callState,
        callId,
        conversationId,
        callType,
        isGroupCall,
        callTitle,
        peer,
        isCaller,
        isMuted,
        isCameraOff,
        quality,
        durationSec,
        connectionState,
        mediaError,
        endNotice,
        localStream,
        remoteStream,
        remotePeers,
        startCall,
        acceptIncomingCall,
        declineIncomingCall,
        endCall,
        toggleMute,
        toggleCamera,
        flipCamera,
        clearMediaError: () => setMediaError(null),
        clearEndNotice: () => setEndNotice(null),
      }}
    >
      {children}
    </CallContext.Provider>
  )
}
