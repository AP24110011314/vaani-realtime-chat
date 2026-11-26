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

  const callStateRef = useRef('idle')
  const callIdRef = useRef(null)
  const isCallerRef = useRef(false)
  const isAcceptingRef = useRef(false)
  const facingModeRef = useRef('user')
  const localStreamRef = useRef(null)
  const rtcPeerRef = useRef(null)
  const pendingSignalQueueRef = useRef([])
  const stopRingRef = useRef(null)
  const durationTimerRef = useRef(null)
  const qualityTimerRef = useRef(null)
  const noticeTimerRef = useRef(null)

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

  const stopMediaAndPeer = useCallback(() => {
    stopTimersAndRing()
    if (rtcPeerRef.current) {
      rtcPeerRef.current.close()
      rtcPeerRef.current = null
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop())
      localStreamRef.current = null
    }
    pendingSignalQueueRef.current = []
    setLocalStream(null)
    setRemoteStream(null)
  }, [stopTimersAndRing])

  const resetToIdle = useCallback(
    (noticeText = null) => {
      stopMediaAndPeer()
      callStateRef.current = 'idle'
      callIdRef.current = null
      isCallerRef.current = false
      isAcceptingRef.current = false
      setCallState('idle')
      setCallId(null)
      setConversationId(null)
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
    [stopMediaAndPeer, queryClient]
  )

  const initRtcPeer = useCallback(
    async (activeCallId, stream) => {
      let iceData = { iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }], relayOnly: false }
      try {
        iceData = await callApi.getIceServers()
      } catch {
        // Fallback to public STUN if endpoint unavailable
      }

      const rtc = new WebRtcPeer({
        iceServers: iceData.iceServers || [],
        relayOnly: Boolean(iceData.relayOnly),
        onIceCandidate: (candidate) => {
          publishStomp('/app/call.signal', {
            callId: activeCallId,
            kind: 'candidate',
            payload: candidate,
          })
        },
        onRemoteStream: (remote) => {
          setRemoteStream(remote)
        },
        onConnectionStateChange: async (connState) => {
          setConnectionState(connState)
          if (connState === 'connected') {
            callStateRef.current = 'connected'
            setCallState('connected')
            publishStomp('/app/call.state', { callId: activeCallId, state: 'CONNECTED' })

            if (!durationTimerRef.current) {
              durationTimerRef.current = setInterval(() => {
                setDurationSec((s) => s + 1)
              }, 1000)
            }
            if (!qualityTimerRef.current) {
              qualityTimerRef.current = setInterval(async () => {
                if (rtcPeerRef.current) {
                  const q = await rtcPeerRef.current.getQuality()
                  setQuality(q)
                }
              }, 2000)
            }
          } else if (connState === 'disconnected') {
            callStateRef.current = 'reconnecting'
            setCallState('reconnecting')
            publishStomp('/app/call.state', { callId: activeCallId, state: 'RECONNECTING' })
            if (isCallerRef.current && rtcPeerRef.current) {
              try {
                const restartOffer = await rtcPeerRef.current.createOffer({ iceRestart: true })
                publishStomp('/app/call.signal', {
                  callId: activeCallId,
                  kind: 'offer',
                  payload: restartOffer,
                })
              } catch {
                // Wait for peer recovery or failure
              }
            }
          } else if (connState === 'failed') {
            publishStomp('/app/call.end', { callId: activeCallId })
            resetToIdle('Call connection failed')
          }
        },
      })

      if (stream) {
        rtc.addLocalStream(stream)
      }
      rtcPeerRef.current = rtc

      // Drain queued signals (offer or early ICE candidates)
      const queued = [...pendingSignalQueueRef.current]
      pendingSignalQueueRef.current = []
      for (const sig of queued) {
        if (sig.kind === 'offer') {
          const answer = await rtc.acceptOffer(sig.payload)
          publishStomp('/app/call.signal', { callId: activeCallId, kind: 'answer', payload: answer })
        } else if (sig.kind === 'answer') {
          await rtc.acceptAnswer(sig.payload)
        } else if (sig.kind === 'candidate') {
          await rtc.addCandidate(sig.payload)
        }
      }

      return rtc
    },
    [publishStomp, resetToIdle]
  )

  const startCall = useCallback(
    async ({ conversationId: convId, peer: peerInfo, type = 'AUDIO' }) => {
      if (callStateRef.current !== 'idle') return
      setMediaError(null)
      setEndNotice(null)

      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia(getCallConstraints(type, facingModeRef.current))
      } catch (err) {
        const classified = classifyMediaError(err)
        setMediaError({ ...classified, conversationId: convId, peer: peerInfo, requestedType: type, mode: 'outgoing' })
        return
      }

      localStreamRef.current = stream
      setLocalStream(stream)
      facingModeRef.current = 'user'

      callStateRef.current = 'outgoing'
      isCallerRef.current = true
      setCallState('outgoing')
      setConversationId(convId)
      setCallType(type)
      setPeer(peerInfo || { name: 'Contact' })
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

      await initRtcPeer(activeId, stream)
      publishStomp('/app/call.accept', { callId: activeId })
    },
    [callType, initRtcPeer, publishStomp, stopTimersAndRing]
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
      if (rtcPeerRef.current) {
        await rtcPeerRef.current.replaceVideoTrack(newTrack)
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
          setCallId(data.callId)
          setConversationId(data.conversationId)
          setCallType(data.type || 'AUDIO')
          setPeer(data.caller)
          setIsCaller(false)
          setCallState('incoming')
          stopTimersAndRing()
          stopRingRef.current = startTitleRingtone(data.caller?.name)
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
          const rtc = await initRtcPeer(data.callId, localStreamRef.current)
          try {
            const offer = await rtc.createOffer()
            publishStomp('/app/call.signal', {
              callId: data.callId,
              kind: 'offer',
              payload: offer,
            })
          } catch {
            publishStomp('/app/call.end', { callId: data.callId })
            resetToIdle('Could not start media negotiation')
          }
          break
        }
        case 'call.signal': {
          if (callIdRef.current !== data?.callId) break
          const rtc = rtcPeerRef.current
          if (!rtc) {
            pendingSignalQueueRef.current.push({ kind: data.kind, payload: data.payload })
            break
          }
          if (data.kind === 'offer') {
            const answer = await rtc.acceptOffer(data.payload)
            publishStomp('/app/call.signal', {
              callId: data.callId,
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
  }, [subscribeCallEvents, initRtcPeer, publishStomp, resetToIdle, stopTimersAndRing])

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
      stopMediaAndPeer()
    }
  }, [publishStomp, stopMediaAndPeer])

  return (
    <CallContext.Provider
      value={{
        callState,
        callId,
        conversationId,
        callType,
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
