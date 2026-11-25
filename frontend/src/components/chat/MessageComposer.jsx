import { useState, useRef, useEffect, useCallback } from 'react'
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
} from 'lucide-react'
import { attachmentApi } from '../../api/attachmentApi'
import { formatFileSize } from '../../lib/formatters'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const BLOCKED_EXTENSIONS = new Set([
  'exe', 'sh', 'bat', 'cmd', 'js', 'html', 'htm', 'svg', 'vbs', 'jar', 'ps1', 'py', 'bin', 'msi', 'dll', 'so', 'dylib', 'com',
])

const EMOJI_LIST = [
  '😀', '😂', '🤣', '😊', '😍', '🥰', '😎', '🤔', '🤫',
  '👍', '👎', '❤️', '🔥', '🎉', '🚀', '🙏', '👏', '💯',
  '✨', '👋', '🙌', '👀', '💡', '✅',
]

export default function MessageComposer({
  onSendMessage,
  onKeyStroke,
  onStopTyping,
  disabled,
  replyTo,
  onCancelReply,
  editingMessage,
  onCancelEdit,
  onSaveEdit,
}) {
  const [content, setContent] = useState('')
  const [attachments, setAttachments] = useState([]) // Array of { tempId, file, progress, error, dto }
  const [isDragging, setIsDragging] = useState(false)
  const [composerError, setComposerError] = useState(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  const dragCounterRef = useRef(0)

  // Populate content if editing message
  const [prevEditingMessage, setPrevEditingMessage] = useState(editingMessage)
  if (editingMessage !== prevEditingMessage) {
    setPrevEditingMessage(editingMessage)
    setContent(editingMessage?.content || '')
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

    setAttachments((prev) => [...prev, initialItem])

    try {
      const dto = await attachmentApi.upload(file, (progress) => {
        setAttachments((prev) =>
          prev.map((item) => (item.tempId === tempId ? { ...item, progress } : item))
        )
      })

      setAttachments((prev) =>
        prev.map((item) =>
          item.tempId === tempId
            ? { ...item, isUploading: false, progress: 100, dto }
            : item
        )
      )
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to upload'
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
    const uploadedDtos = attachments.map((a) => a.dto).filter(Boolean)
    const attachmentIds = uploadedDtos.map((d) => d.id)

    if (editingMessage) {
      if (trimmed) {
        onSaveEdit?.(editingMessage.id, trimmed)
        setContent('')
      }
      return
    }

    if (!trimmed && attachmentIds.length === 0) return

    if (replyTo?.id) {
      onSendMessage(trimmed, attachmentIds, replyTo.id)
    } else {
      onSendMessage(trimmed, attachmentIds)
    }

    setContent('')
    setAttachments([])
    onStopTyping?.()
    if (replyTo) onCancelReply?.()

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.focus()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    } else if (e.key === 'Escape') {
      if (editingMessage) onCancelEdit?.()
      else if (replyTo) onCancelReply?.()
      else if (showEmojiPicker) setShowEmojiPicker(false)
    }
  }

  const handleChange = (e) => {
    setContent(e.target.value)
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
  const canSend =
    !disabled &&
    !isUploadingAny &&
    (Boolean(content.trim()) || attachments.some((a) => a.dto))

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`p-3 border-t border-slate-800 bg-slate-900/60 backdrop-blur relative transition-colors ${
        isDragging ? 'bg-indigo-950/40 border-indigo-500' : ''
      }`}
    >
      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-indigo-950/80 backdrop-blur-xs flex items-center justify-center border-2 border-dashed border-indigo-400 rounded-t-xl z-20 pointer-events-none">
          <p className="text-sm font-semibold text-indigo-200">Drop files here to upload</p>
        </div>
      )}

      {/* Editing Message Banner */}
      {editingMessage && (
        <div className="mb-2 p-2 px-3 rounded-xl bg-amber-950/60 border border-amber-700/60 text-xs flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2 min-w-0">
            <Pencil className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <div className="min-w-0">
              <span className="font-semibold text-amber-300 block">Editing message</span>
              <span className="text-slate-400 truncate block text-[11px]">
                {editingMessage.content}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelEdit}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-amber-900/40 transition-colors"
            title="Cancel editing"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Reply Preview Banner */}
      {replyTo && !editingMessage && (
        <div className="mb-2 p-2 px-3 rounded-xl bg-indigo-950/60 border border-indigo-700/60 text-xs flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2 min-w-0">
            <Reply className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <div className="min-w-0">
              <span className="font-semibold text-indigo-300 block">
                Replying to {replyTo.sender?.name || replyTo.senderName || 'message'}
              </span>
              <span className="text-slate-400 truncate block text-[11px]">
                {replyTo.snippet || replyTo.content || 'Attachment'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-indigo-900/40 transition-colors"
            title="Cancel reply"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Error banner */}
      {composerError && (
        <div className="mb-2 p-2 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{composerError}</span>
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
                className={`flex items-center gap-2 p-1.5 pr-2 rounded-xl border text-xs max-w-[200px] sm:max-w-[240px] shadow-xs ${
                  att.error
                    ? 'bg-rose-950/60 border-rose-800 text-rose-200'
                    : 'bg-slate-900/80 border-slate-700/70 text-slate-200'
                }`}
              >
                {/* Thumbnail or File Icon */}
                {isImage && att.previewUrl ? (
                  <img
                    src={att.previewUrl}
                    alt={att.name}
                    className="w-8 h-8 rounded-lg object-cover flex-shrink-0 border border-slate-700"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                    {att.name.endsWith('.pdf') ? (
                      <FileText className="w-4 h-4 text-rose-400" />
                    ) : att.name.endsWith('.zip') ? (
                      <FileArchive className="w-4 h-4 text-amber-400" />
                    ) : (
                      <File className="w-4 h-4 text-indigo-400" />
                    )}
                  </div>
                )}

                {/* Details & Progress */}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-[11px] leading-tight">
                    {att.name}
                  </p>
                  <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                    {att.isUploading ? (
                      <span className="text-indigo-400 font-medium">Uploading {att.progress}%</span>
                    ) : att.error ? (
                      <span className="text-rose-400 truncate block">{att.error}</span>
                    ) : (
                      formatFileSize(att.size)
                    )}
                  </p>
                </div>

                {/* Status / Cancel Button */}
                {att.isUploading ? (
                  <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin flex-shrink-0" />
                ) : (
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(att.tempId)}
                    className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0"
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

      {/* Input container */}
      <div className="flex items-end gap-2 bg-slate-950/90 border border-slate-800 rounded-2xl p-1.5 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all relative">
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
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 disabled:opacity-40 rounded-xl transition-colors flex-shrink-0 mb-0.5"
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
            className="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800/80 disabled:opacity-40 rounded-xl transition-colors"
            title="Insert emoji"
            aria-label="Insert emoji"
          >
            <Smile className="w-4 h-4" />
          </button>

          {showEmojiPicker && (
            <div className="absolute bottom-full mb-2 left-0 w-64 p-2 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-30 grid grid-cols-6 gap-1">
              {EMOJI_LIST.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleInsertEmoji(emoji)}
                  className="p-1.5 text-base hover:bg-slate-800 rounded-lg hover:scale-125 transition-transform flex items-center justify-center"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={editingMessage ? 'Edit your message...' : 'Type a message... (Press Enter to send, Shift+Enter for newline)'}
          rows={1}
          disabled={disabled}
          className="flex-1 bg-transparent px-2 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none max-h-32 leading-relaxed"
        />

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className={`p-2.5 rounded-xl transition-all shadow-md flex-shrink-0 ${
            editingMessage
              ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20'
              : 'bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white shadow-indigo-600/20'
          }`}
          aria-label={editingMessage ? 'Save edit' : 'Send message'}
          title={editingMessage ? 'Save edit' : 'Send message'}
        >
          <SendHorizonal className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
