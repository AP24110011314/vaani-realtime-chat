import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  SendHorizonal,
  Paperclip,
  X,
  File,
  FileText,
  FileArchive,
  Loader2,
  AlertCircle,
  Smile,
  Reply,
  Pencil,
  AtSign,
  Mic,
  Clock,
} from 'lucide-react'
import { attachmentApi } from '../../api/attachmentApi'
import { conversationApi } from '../../api/conversationApi'
import { formatFileSize } from '../../lib/formatters'
import { isVoiceRecordingSupported } from '../../lib/voiceUtils'
import MentionPicker from './MentionPicker'
import VoiceRecorder from './VoiceRecorder'
import ScheduleModal from './ScheduleModal'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_MESSAGE_LENGTH = 4000
const BLOCKED_EXTENSIONS = new Set([
  'exe', 'sh', 'bat', 'cmd', 'js', 'html', 'htm', 'svg', 'vbs', 'jar', 'ps1', 'py', 'bin', 'msi', 'dll', 'so', 'dylib', 'com',
])

const EMOJI_LIST = [
  '😀', '😂', '🤣', '😊', '😍', '🥰', '😎', '🤔', '🤫',
  '👍', '👎', '❤️', '🔥', '🎉', '🚀', '🙏', '👏', '💯',
  '✨', '👋', '🙌', '👀', '💡', '✅',
]

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Hydrate raw <@id> tokens into readable @Name text when editing a message.
 */
function hydrateMentionsForEdit(rawContent, mentions = []) {
  if (!rawContent) return { text: '', map: new Map() }
  const map = new Map()
  const byId = new Map((mentions || []).map((m) => [String(m.userId), m.name]))
  const text = rawContent.replace(/<@(\d+|all)>/g, (full, token) => {
    if (token === 'all') {
      return '@all'
    }
    const name = byId.get(token)
    if (!name) return full
    map.set(name, Number(token))
    return `@${name}`
  })
  return { text, map }
}

/**
 * Convert selected @Name mentions back to <@id> / <@all> wire tokens before send/edit.
 */
function encodeMentionsForWire(text, mentionMap, allowAll) {
  if (!text) return text
  let out = text
  if (allowAll) {
    out = out.replace(/(^|\s)@all(?=$|[\s.,!?;:)\]}])/g, '$1<@all>')
  }
  if (mentionMap && mentionMap.size > 0) {
    const entries = Array.from(mentionMap.entries()).sort((a, b) => b[0].length - a[0].length)
    for (const [name, id] of entries) {
      const pattern = new RegExp(`(^|\\s)@${escapeRegExp(name)}(?=$|[\\s.,!?;:)\\]}])`, 'g')
      out = out.replace(pattern, `$1<@${id}>`)
    }
  }
  return out
}

export default function MessageComposer({
  onSendMessage,
  onScheduleMessage,
  onKeyStroke,
  onStopTyping,
  disabled,
  replyTo,
  onCancelReply,
  editingMessage,
  onCancelEdit,
  onSaveEdit,
  conversationId,
  isGroup = false,
  isGroupAdmin = false,
  groupMembers = [],
  currentUserId,
}) {
  const [content, setContent] = useState('')
  const [attachments, setAttachments] = useState([]) // Array of { tempId, file, progress, error, dto }
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [isScheduling, setIsScheduling] = useState(false)
  const [scheduleError, setScheduleError] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [composerError, setComposerError] = useState(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isRecordingVoice, setIsRecordingVoice] = useState(false)
  const voiceSupported = isVoiceRecordingSupported()

  // Mention picker state
  const [mentionTrigger, setMentionTrigger] = useState(null) // { start, end, query }
  const [remoteMembers, setRemoteMembers] = useState(null)
  const [isLoadingMentions, setIsLoadingMentions] = useState(false)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [selectedMentionsMap, setSelectedMentionsMap] = useState(() => new Map())

  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  const dragCounterRef = useRef(0)
  const abortControllersRef = useRef(new Map())

  // Populate content & mention map if editing message
  const [prevEditingMessage, setPrevEditingMessage] = useState(editingMessage)
  if (editingMessage !== prevEditingMessage) {
    setPrevEditingMessage(editingMessage)
    const { text, map } = hydrateMentionsForEdit(editingMessage?.content || '', editingMessage?.mentions)
    setContent(text)
    setSelectedMentionsMap(map)
    setMentionTrigger(null)
  }

  useEffect(() => {
    if (editingMessage && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [editingMessage])

  // Focus textarea when replying
  useEffect(() => {
    if (replyTo && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [replyTo])

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [content])

  // Clear temporary error after 4s
  useEffect(() => {
    if (composerError) {
      const timer = setTimeout(() => setComposerError(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [composerError])

  // Fetch mentionable members from backend when trigger is active
  useEffect(() => {
    if (!isGroup || !mentionTrigger || !conversationId) {
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      setIsLoadingMentions(true)
      try {
        const list = await conversationApi.getMentionable(conversationId, mentionTrigger.query)
        if (!cancelled) {
          setRemoteMembers(Array.isArray(list) ? list : [])
        }
      } catch {
        if (!cancelled) setRemoteMembers(null)
      } finally {
        if (!cancelled) setIsLoadingMentions(false)
      }
    }, 100)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [isGroup, mentionTrigger, conversationId])

  const mentionSuggestions = useMemo(() => {
    if (!isGroup || !mentionTrigger) return []
    const q = mentionTrigger.query.toLowerCase()
    const baseMembers = Array.isArray(remoteMembers)
      ? remoteMembers
      : (groupMembers || []).filter(
          (m) => m.id !== currentUserId && (!q || m.name?.toLowerCase().startsWith(q))
        )
    const list = baseMembers.slice(0, 8)
    if (isGroupAdmin && ('all'.startsWith(q) || q === '')) {
      return [{ id: 'all', name: 'all' }, ...list].slice(0, 8)
    }
    return list
  }, [isGroup, mentionTrigger, remoteMembers, groupMembers, currentUserId, isGroupAdmin])

  const activeMentionChips = useMemo(() => {
    if (!isGroup || !content) return []
    const chips = []
    for (const [name, id] of selectedMentionsMap.entries()) {
      const pattern = new RegExp(`(^|\\s)@${escapeRegExp(name)}(?=$|[\\s.,!?;:)\\]}])`)
      if (pattern.test(content)) {
        chips.push({ id, name })
      }
    }
    if (isGroupAdmin && /(^|\s)@all(?=$|[\s.,!?;:)\]}])/.test(content)) {
      chips.unshift({ id: 'all', name: 'all' })
    }
    return chips
  }, [isGroup, content, selectedMentionsMap, isGroupAdmin])

  const updateMentionTrigger = useCallback(
    (text, cursorPos) => {
      if (!isGroup) {
        setMentionTrigger(null)
        return
      }
      const pos = typeof cursorPos === 'number' ? cursorPos : text.length
      const beforeCursor = text.slice(0, pos)
      const match = beforeCursor.match(/(?:^|\s)@([^\s@]{0,30})$/)
      if (match) {
        const atIdx = beforeCursor.lastIndexOf('@')
        setMentionTrigger({ start: atIdx, end: pos, query: match[1] })
        setMentionIndex(0)
        setRemoteMembers(null)
      } else {
        setMentionTrigger(null)
      }
    },
    [isGroup]
  )

  const handleSelectMention = useCallback(
    (item) => {
      if (!mentionTrigger) return
      const label = item.id === 'all' ? 'all' : item.name
      const before = content.slice(0, mentionTrigger.start)
      const after = content.slice(mentionTrigger.end)
      const insertion = `@${label} `
      const nextContent = `${before}${insertion}${after}`
      const nextCursor = before.length + insertion.length

      if (item.id !== 'all') {
        setSelectedMentionsMap((prev) => {
          const next = new Map(prev)
          next.set(item.name, item.id)
          return next
        })
      }

      setContent(nextContent)
      setMentionTrigger(null)
      setRemoteMembers(null)

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = nextCursor
          textareaRef.current.selectionEnd = nextCursor
          textareaRef.current.focus()
        }
      }, 0)
    },
    [mentionTrigger, content]
  )

  const handleUploadFile = useCallback(async (file) => {
    if (file.size > MAX_FILE_SIZE) {
      setComposerError(`"${file.name}" exceeds the 10 MB file limit.`)
      return
    }

    const parts = file.name.split('.')
    const ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
    if (BLOCKED_EXTENSIONS.has(ext)) {
      setComposerError(`File type ".${ext}" is not permitted for upload.`)
      return
    }

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const isImage = file.type.startsWith('image/')
    const previewUrl = isImage ? URL.createObjectURL(file) : null

    const initialItem = {
      tempId,
      file,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      previewUrl,
      progress: 0,
      isUploading: true,
      error: null,
      dto: null,
    }

    const controller = new AbortController()
    abortControllersRef.current.set(tempId, controller)
    setAttachments((prev) => [...prev, initialItem])

    try {
      const dto = await attachmentApi.upload(
        file,
        (progress) => {
          setAttachments((prev) =>
            prev.map((item) => (item.tempId === tempId ? { ...item, progress } : item))
          )
        },
        controller.signal
      )

      abortControllersRef.current.delete(tempId)
      setAttachments((prev) =>
        prev.map((item) =>
          item.tempId === tempId
            ? { ...item, isUploading: false, progress: 100, dto }
            : item
        )
      )
    } catch (err) {
      abortControllersRef.current.delete(tempId)
      if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError' || err?.name === 'AbortError') {
        return
      }
      const errorMsg = err.response?.data?.message || 'Failed to upload'
      setComposerError(errorMsg)
      setAttachments((prev) =>
        prev.map((item) =>
          item.tempId === tempId
            ? { ...item, isUploading: false, error: errorMsg }
            : item
        )
      )
    }
  }, [])

  const handleFilesSelected = (fileList) => {
    if (!fileList || fileList.length === 0) return
    Array.from(fileList).forEach(handleUploadFile)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemoveAttachment = (tempId) => {
    const controller = abortControllersRef.current.get(tempId)
    if (controller) {
      controller.abort()
      abortControllersRef.current.delete(tempId)
    }
    setAttachments((prev) => {
      const item = prev.find((a) => a.tempId === tempId)
      if (item && item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl)
      }
      return prev.filter((a) => a.tempId !== tempId)
    })
  }

  const handleInsertEmoji = (emoji) => {
    const textarea = textareaRef.current
    if (textarea) {
      const start = textarea.selectionStart || 0
      const end = textarea.selectionEnd || 0
      const newContent = content.substring(0, start) + emoji + content.substring(end)
      setContent(newContent)
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + emoji.length
        textarea.focus()
      }, 0)
    } else {
      setContent((prev) => prev + emoji)
    }
    setShowEmojiPicker(false)
  }

  const handleSend = () => {
    const trimmed = content.trim()
    const wireContent = isGroup
      ? encodeMentionsForWire(trimmed, selectedMentionsMap, isGroupAdmin)
      : trimmed
    const uploadedDtos = attachments.map((a) => a.dto).filter(Boolean)
    const attachmentIds = uploadedDtos.map((d) => d.id)

    if (wireContent.length > MAX_MESSAGE_LENGTH) {
      setComposerError('Message exceeds the 4,000-character limit.')
      return
    }

    if (editingMessage) {
      if (wireContent) {
        onSaveEdit?.(editingMessage.id, wireContent)
        setContent('')
        setSelectedMentionsMap(new Map())
      }
      return
    }

    if (!wireContent && attachmentIds.length === 0) return

    if (replyTo?.id) {
      onSendMessage(wireContent, attachmentIds, replyTo.id)
    } else {
      onSendMessage(wireContent, attachmentIds)
    }

    setContent('')
    setAttachments([])
    setSelectedMentionsMap(new Map())
    setMentionTrigger(null)
    onStopTyping?.()
    if (replyTo) onCancelReply?.()

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.focus()
    }
  }

  const handleConfirmSchedule = async (scheduledForIso, modalMessage) => {
    if (!onScheduleMessage) return
    const rawText = typeof modalMessage === 'string' ? modalMessage : content
    const trimmed = rawText.trim()
    const wireContent = isGroup
      ? encodeMentionsForWire(trimmed, selectedMentionsMap, isGroupAdmin)
      : trimmed
    const attachmentIds = attachments.map((a) => a.dto).filter(Boolean).map((d) => d.id)

    if (!wireContent && attachmentIds.length === 0) return

    setIsScheduling(true)
    setScheduleError(null)
    try {
      await onScheduleMessage({
        content: wireContent,
        attachmentIds,
        replyToId: replyTo?.id || null,
        scheduledFor: scheduledForIso,
      })
      setShowScheduleModal(false)
      setContent('')
      setAttachments([])
      setSelectedMentionsMap(new Map())
      setMentionTrigger(null)
      onStopTyping?.()
      if (replyTo) onCancelReply?.()
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } catch (err) {
      setScheduleError(err.response?.data?.message || 'Could not schedule message.')
    } finally {
      setIsScheduling(false)
    }
  }

  const handleKeyDown = (e) => {
    if (mentionTrigger && mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIndex((prev) => (prev + 1) % mentionSuggestions.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIndex((prev) => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        handleSelectMention(mentionSuggestions[mentionIndex] || mentionSuggestions[0])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMentionTrigger(null)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    } else if (e.key === 'Escape') {
      if (mentionTrigger) setMentionTrigger(null)
      else if (editingMessage) onCancelEdit?.()
      else if (replyTo) onCancelReply?.()
      else if (showEmojiPicker) setShowEmojiPicker(false)
    }
  }

  const handleChange = (e) => {
    const val = e.target.value
    setContent(val)
    updateMentionTrigger(val, e.target.selectionStart)
    if (composerError && val.trim().length <= MAX_MESSAGE_LENGTH && composerError.includes('4,000-character')) {
      setComposerError(null)
    }
    if (!editingMessage) {
      onKeyStroke?.()
    }
  }

  const handlePaste = (e) => {
    const clipboardFiles = e.clipboardData?.files
    if (clipboardFiles && clipboardFiles.length > 0) {
      e.preventDefault()
      Array.from(clipboardFiles).forEach(handleUploadFile)
    }
  }

  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current += 1
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current -= 1
    if (dragCounterRef.current === 0) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    dragCounterRef.current = 0
    const droppedFiles = e.dataTransfer?.files
    if (droppedFiles && droppedFiles.length > 0) {
      handleFilesSelected(droppedFiles)
    }
  }

  const isUploadingAny = attachments.some((a) => a.isUploading)
  const showMicButton =
    voiceSupported &&
    content.length === 0 &&
    attachments.length === 0 &&
    !editingMessage
  const canSend =
    !disabled &&
    !isUploadingAny &&
    (Boolean(content.trim()) || attachments.some((a) => a.dto))

  const handleVoiceUploaded = (dto) => {
    setIsRecordingVoice(false)
    setComposerError(null)
    onStopTyping?.()
    onSendMessage?.({
      content: '',
      attachmentIds: [dto.id],
      attachments: [dto],
      replyToId: replyTo?.id || null,
      type: 'VOICE',
    })
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`px-3 sm:px-4 pb-3 pt-1.5 relative transition-colors ${
        isDragging ? 'bg-[var(--accent-soft-bg)]' : ''
      }`}
    >
      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div className="absolute inset-2 glass-strong flex items-center justify-center border-2 border-dashed border-[var(--accent-solid)] rounded-3xl z-20 pointer-events-none">
          <p className="text-sm font-semibold text-accent-text">Drop files here to upload</p>
        </div>
      )}

      {/* Editing Message Banner */}
      {editingMessage && (
        <div className="mb-2 p-2.5 px-3.5 rounded-2xl glass-strong border-[var(--warning-border)] text-xs flex items-center justify-between gap-2 animate-msg-in">
          <div className="flex items-center gap-2 min-w-0">
            <Pencil className="w-4 h-4 text-[var(--warning-text)] flex-shrink-0" />
            <div className="min-w-0">
              <span className="font-semibold text-[var(--warning-text)] block">Editing message</span>
              <span className="text-ink-muted truncate block text-[11px]">
                {editingMessage.previewText || editingMessage.content}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelEdit}
            className="p-1 text-ink-muted hover:text-ink rounded-xl hover:bg-[var(--glass-bg-hover)] transition-colors focus-accent cursor-pointer"
            title="Cancel editing"
            aria-label="Cancel editing"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Reply Preview Banner */}
      {replyTo && !editingMessage && (
        <div className="mb-2 p-2.5 px-3.5 rounded-2xl glass-strong border-[var(--accent-soft-border)] text-xs flex items-center justify-between gap-2 animate-msg-in">
          <div className="flex items-center gap-2 min-w-0">
            <Reply className="w-4 h-4 text-accent-text flex-shrink-0" />
            <div className="min-w-0">
              <span className="font-semibold text-accent-text block">
                Replying to {replyTo.sender?.name || replyTo.senderName || 'message'}
              </span>
              <span className="text-ink-muted truncate block text-[11px]">
                {replyTo.snippet || replyTo.previewText || replyTo.content || 'Attachment'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="p-1 text-ink-muted hover:text-ink rounded-xl hover:bg-[var(--glass-bg-hover)] transition-colors focus-accent cursor-pointer"
            title="Cancel reply"
            aria-label="Cancel reply"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Error banner */}
      {composerError && (
        <div role="alert" className="mb-2 p-2.5 px-3.5 rounded-2xl glass-strong border-[var(--danger-border)] text-[var(--danger-text)] text-xs flex items-center gap-2 animate-msg-in">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{composerError}</span>
        </div>
      )}

      {/* Active Mention Chips Indicator */}
      {activeMentionChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-1.5 px-1">
          <span className="text-[10px] font-semibold text-ink-subtle flex items-center gap-1">
            <AtSign className="w-3 h-3 text-accent-text" />
            Mentioning:
          </span>
          {activeMentionChips.map((chip) => (
            <span
              key={String(chip.id)}
              className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--accent-soft-bg)] text-accent-text border border-[var(--accent-soft-border)]"
            >
              @{chip.name}
            </span>
          ))}
        </div>
      )}

      {/* Attachment Chips Preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 p-1 max-h-36 overflow-y-auto">
          {attachments.map((att) => {
            const isImage = att.mimeType && att.mimeType.startsWith('image/')
            return (
              <div
                key={att.tempId}
                className={`flex items-center gap-2 p-1.5 pr-2 rounded-2xl text-xs max-w-[200px] sm:max-w-[240px] glass-subtle ${
                  att.error
                    ? 'border-[var(--danger-border)] text-[var(--danger-text)]'
                    : 'text-ink'
                }`}
              >
                {isImage && att.previewUrl ? (
                  <img
                    src={att.previewUrl}
                    alt={att.name}
                    className="w-8 h-8 rounded-xl object-cover flex-shrink-0 border border-[var(--glass-border)]"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-xl glass-strong flex items-center justify-center flex-shrink-0">
                    {att.name.endsWith('.pdf') ? (
                      <FileText className="w-4 h-4 text-[var(--danger-text)]" />
                    ) : att.name.endsWith('.zip') ? (
                      <FileArchive className="w-4 h-4 text-[var(--warning-text)]" />
                    ) : (
                      <File className="w-4 h-4 text-accent-text" />
                    )}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-[11px] leading-tight">
                    {att.name}
                  </p>
                  <p className="text-[10px] text-ink-muted leading-tight mt-0.5 tabular-nums">
                    {att.isUploading ? (
                      <span className="text-accent-text font-medium">Uploading {att.progress}%</span>
                    ) : att.error ? (
                      <span className="text-[var(--danger-text)] truncate block">{att.error}</span>
                    ) : (
                      formatFileSize(att.size)
                    )}
                  </p>
                </div>

                {att.isUploading ? (
                  <Loader2 className="w-3.5 h-3.5 text-accent-text animate-spin flex-shrink-0" />
                ) : (
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(att.tempId)}
                    className="p-1 text-ink-muted hover:text-ink hover:bg-[var(--glass-bg-hover)] rounded-lg transition-colors flex-shrink-0 focus-accent cursor-pointer"
                    title="Remove attachment"
                    aria-label="Remove attachment"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Floating Glass Pill Composer OR Inline Voice Recorder */}
      {isRecordingVoice ? (
        <VoiceRecorder
          onUploaded={handleVoiceUploaded}
          onCancel={() => setIsRecordingVoice(false)}
          onError={(msg) => setComposerError(msg)}
        />
      ) : (
      <div className="flex items-end gap-1.5 glass-strong rounded-[26px] p-1.5 pl-2.5 focus-within:border-[var(--accent-solid)] focus-within:ring-2 focus-within:ring-[var(--accent-glow)] transition-all relative">
        {/* Mention Picker Popover */}
        <MentionPicker
          isOpen={Boolean(isGroup && mentionTrigger)}
          items={mentionSuggestions}
          activeIndex={mentionIndex}
          onSelect={handleSelectMention}
          isLoading={isLoadingMentions}
        />

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFilesSelected(e.target.files)}
        />

        {/* Paperclip Attach Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploadingAny || Boolean(editingMessage)}
          className="p-2 text-ink-muted hover:text-ink hover:bg-[var(--glass-bg-hover)] disabled:opacity-40 rounded-full transition-colors flex-shrink-0 mb-0.5 focus-accent cursor-pointer"
          title="Attach files (images, PDFs, documents up to 10MB)"
          aria-label="Attach files"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        {/* Emoji Picker Button & Popover */}
        <div className="relative flex-shrink-0 mb-0.5">
          <button
            type="button"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            disabled={disabled}
            className="p-2 text-ink-muted hover:text-ink hover:bg-[var(--glass-bg-hover)] disabled:opacity-40 rounded-full transition-colors focus-accent cursor-pointer"
            title="Insert emoji"
            aria-label="Insert emoji"
          >
            <Smile className="w-4 h-4" />
          </button>

          {showEmojiPicker && (
            <div className="absolute bottom-full mb-3 left-0 w-64 p-2.5 glass-strong rounded-3xl z-30 grid grid-cols-6 gap-1 animate-modal-in">
              {EMOJI_LIST.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleInsertEmoji(emoji)}
                  className="p-1.5 text-base hover:bg-[var(--glass-bg-hover)] rounded-xl hover:scale-125 transition-transform flex items-center justify-center cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Auto-growing Text Area (15px message text) */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={
            editingMessage
              ? 'Edit your message...'
              : isGroup
              ? 'Message... (@ to mention)'
              : 'Type a message...'
          }
          title="Press Enter to send, Shift+Enter for newline"
          rows={1}
          disabled={disabled}
          className="flex-1 bg-transparent px-2 py-2 text-[15px] text-ink placeholder-[var(--text-muted-token)] focus:outline-none resize-none max-h-32 leading-snug"
        />

        {/* Character counter near 4000 limit */}
        {content.length >= 3500 && (
          <span
            className={`text-[10px] font-semibold tabular-nums px-1.5 flex-shrink-0 mb-2.5 ${
              content.trim().length > MAX_MESSAGE_LENGTH ? 'text-[var(--danger-text)]' : 'text-ink-subtle'
            }`}
          >
            {content.trim().length}/{MAX_MESSAGE_LENGTH}
          </span>
        )}

        {/* Schedule Button + Mic (when empty & supported) or Circular Gradient Send Button */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!editingMessage && onScheduleMessage && (
            <button
              type="button"
              onClick={() => {
                setScheduleError(null)
                setShowScheduleModal(true)
              }}
              disabled={disabled || isUploadingAny}
              className="w-9 h-9 rounded-full flex items-center justify-center glass-subtle hover:bg-[var(--glass-bg-hover)] text-ink-muted hover:text-accent-text disabled:opacity-40 transition-all focus-accent cursor-pointer"
              aria-label="Schedule message"
              title="Schedule message for later"
            >
              <Clock className="w-4 h-4" />
            </button>
          )}
          {showMicButton ? (
            <button
              type="button"
              onClick={() => {
                setComposerError(null)
                setIsRecordingVoice(true)
              }}
              disabled={disabled}
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 btn-accent transition-all duration-150 focus-accent cursor-pointer disabled:opacity-45"
              aria-label="Record voice message"
              title="Record voice message"
            >
              <Mic className="w-4 h-4" />
            </button>
          ) : (
            <span
              className="flex-shrink-0"
              title={
                !voiceSupported && content.length === 0 && attachments.length === 0
                  ? 'Voice recording is not supported in this browser'
                  : undefined
              }
            >
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-150 focus-accent cursor-pointer ${
                  editingMessage
                    ? 'bg-amber-500 hover:bg-amber-400 text-[#15151C] shadow-md scale-100'
                    : canSend
                    ? 'btn-accent scale-100 opacity-100'
                    : 'glass-subtle text-ink-subtle opacity-45 scale-90 cursor-not-allowed'
                }`}
                aria-label={editingMessage ? 'Save edit' : 'Send message'}
                title={editingMessage ? 'Save edit' : 'Send message'}
              >
                <SendHorizonal className="w-4 h-4" />
              </button>
            </span>
          )}
        </div>
      </div>
      )}

      {showScheduleModal && (
        <ScheduleModal
          isOpen={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          onConfirm={handleConfirmSchedule}
          previewText={content.trim()}
          allowMessageInput={content.trim().length === 0}
          attachmentCount={attachments.filter((a) => a.dto).length}
          minLeadSeconds={5}
          isSubmitting={isScheduling}
          error={scheduleError}
        />
      )}
    </div>
  )
}
