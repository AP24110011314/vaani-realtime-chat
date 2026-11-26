export function getCallConstraints(type = 'AUDIO', facingMode = 'user') {
  const audio = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  }
  if (type !== 'VIDEO') {
    return { audio, video: false }
  }
  return {
    audio,
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
      facingMode,
    },
  }
}

export function classifyMediaError(err) {
  const name = err?.name || ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return {
      code: 'PERMISSION_DENIED',
      message: 'Camera or microphone permission was denied. Allow access in your browser site settings.',
    }
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return {
      code: 'NOT_FOUND',
      message: 'No camera or microphone was detected on this device.',
    }
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return {
      code: 'DEVICE_BUSY',
      message: 'Your camera or microphone is already in use by another application.',
    }
  }
  return {
    code: 'MEDIA_ERROR',
    message: err?.message || 'Could not access microphone or camera.',
  }
}

export function formatCallDuration(seconds = 0) {
  const total = Math.max(0, Math.floor(seconds))
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`
}

export function computeQualityFromStats(statsReport) {
  if (!statsReport || typeof statsReport.forEach !== 'function') return 'good'
  let rttMs = null
  let lossRatio = 0

  statsReport.forEach((stat) => {
    if (stat.type === 'candidate-pair' && stat.state === 'succeeded' && stat.nominated) {
      if (typeof stat.currentRoundTripTime === 'number') {
        rttMs = stat.currentRoundTripTime * 1000
      }
    }
    if (stat.type === 'inbound-rtp' && (stat.packetsReceived || 0) > 10) {
      const lost = stat.packetsLost || 0
      const total = lost + stat.packetsReceived
      if (total > 0) {
        lossRatio = Math.max(lossRatio, lost / total)
      }
    }
  })

  if ((rttMs !== null && rttMs > 350) || lossRatio > 0.08) return 'poor'
  if ((rttMs !== null && rttMs > 150) || lossRatio > 0.02) return 'fair'
  return 'good'
}

export class WebRtcPeer {
  constructor({ iceServers = [], relayOnly = false, onIceCandidate, onRemoteStream, onConnectionStateChange }) {
    const PeerCtor = typeof RTCPeerConnection !== 'undefined' ? RTCPeerConnection : window.RTCPeerConnection
    this.pc = new PeerCtor({
      iceServers,
      iceTransportPolicy: relayOnly ? 'relay' : 'all',
    })
    this.remoteStream = typeof MediaStream !== 'undefined' ? new MediaStream() : null
    this.remoteDescriptionSet = false
    this.pendingCandidates = []
    this.closed = false

    this.pc.onicecandidate = (event) => {
      if (!this.closed && event.candidate && onIceCandidate) {
        onIceCandidate(event.candidate.toJSON ? event.candidate.toJSON() : event.candidate)
      }
    }

    this.pc.ontrack = (event) => {
      if (this.closed) return
      if (event.streams && event.streams[0]) {
        onRemoteStream?.(event.streams[0])
        return
      }
      if (this.remoteStream && event.track) {
        this.remoteStream.addTrack(event.track)
        onRemoteStream?.(this.remoteStream)
      }
    }

    this.pc.onconnectionstatechange = () => {
      if (!this.closed) {
        onConnectionStateChange?.(this.pc.connectionState)
      }
    }

    this.pc.oniceconnectionstatechange = () => {
      if (this.closed) return
      const iceState = this.pc.iceConnectionState
      if ((iceState === 'connected' || iceState === 'completed') && this.pc.connectionState !== 'connected') {
        onConnectionStateChange?.('connected')
      } else if (iceState === 'failed' && this.pc.connectionState !== 'failed') {
        onConnectionStateChange?.('failed')
      }
    }
  }

  addLocalStream(stream) {
    if (!stream || this.closed) return
    stream.getTracks().forEach((track) => {
      this.pc.addTrack(track, stream)
    })
  }

  async createOffer({ iceRestart = false } = {}) {
    const offer = await this.pc.createOffer({ iceRestart })
    await this.pc.setLocalDescription(offer)
    return this.pc.localDescription
  }

  async acceptOffer(offerPayload) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(offerPayload))
    this.remoteDescriptionSet = true
    await this.flushCandidates()
    const answer = await this.pc.createAnswer()
    await this.pc.setLocalDescription(answer)
    return this.pc.localDescription
  }

  async acceptAnswer(answerPayload) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(answerPayload))
    this.remoteDescriptionSet = true
    await this.flushCandidates()
  }

  async addCandidate(candidatePayload) {
    if (!candidatePayload || this.closed) return
    if (!this.remoteDescriptionSet) {
      this.pendingCandidates.push(candidatePayload)
      return
    }
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidatePayload))
    } catch {
      // Ignore late/stale candidate
    }
  }

  async flushCandidates() {
    while (this.pendingCandidates.length > 0 && !this.closed) {
      const next = this.pendingCandidates.shift()
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(next))
      } catch {
        // Ignore invalid queued candidate
      }
    }
  }

  async replaceVideoTrack(newTrack) {
    const sender = this.pc.getSenders().find((s) => s.track?.kind === 'video')
    if (sender && newTrack) {
      await sender.replaceTrack(newTrack)
    }
  }

  async getQuality() {
    if (this.closed || typeof this.pc.getStats !== 'function') return 'good'
    try {
      const stats = await this.pc.getStats()
      return computeQualityFromStats(stats)
    } catch {
      return 'good'
    }
  }

  close() {
    if (this.closed) return
    this.closed = true
    this.pendingCandidates = []
    this.pc.onicecandidate = null
    this.pc.ontrack = null
    this.pc.onconnectionstatechange = null
    this.pc.oniceconnectionstatechange = null
    try {
      this.pc.close()
    } catch {
      // Ignore close errors
    }
  }
}
