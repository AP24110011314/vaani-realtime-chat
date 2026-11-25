import { useState } from 'react'
import { FileText, Download, File, FileArchive } from 'lucide-react'
import { formatFileSize } from '../../lib/formatters'
import ImageLightbox from './ImageLightbox'

export default function AttachmentPreview({ attachments = [], isMine = false }) {
  const [activeImageIndex, setActiveImageIndex] = useState(null)

  if (!attachments || attachments.length === 0) return null

  const imageAttachments = attachments
    .filter((a) => a.mimeType && a.mimeType.startsWith('image/'))
    .map((a) => ({ src: a.url, alt: a.fileName }))

  const getFileIcon = (mimeType = '') => {
    if (mimeType.includes('pdf')) {
      return (
        <FileText
          className={`w-5 h-5 flex-shrink-0 ${isMine ? 'text-current' : 'text-[var(--danger-text)]'}`}
        />
      )
    }
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('compressed')) {
      return (
        <FileArchive
          className={`w-5 h-5 flex-shrink-0 ${isMine ? 'text-current' : 'text-[var(--warning-text)]'}`}
        />
      )
    }
    return (
      <File
        className={`w-5 h-5 flex-shrink-0 ${isMine ? 'text-current' : 'text-accent-text'}`}
      />
    )
  }

  return (
    <>
      <div className="flex flex-col gap-2 my-1.5">
        {attachments.map((att) => {
          const isImage = att.mimeType && att.mimeType.startsWith('image/')

          if (isImage) {
            const imgIdx = imageAttachments.findIndex((img) => img.src === att.url)
            return (
              <div key={att.id || att.url} className="relative group/att overflow-hidden rounded-2xl">
                <button
                  type="button"
                  onClick={() => setActiveImageIndex(imgIdx >= 0 ? imgIdx : 0)}
                  className="block cursor-pointer focus-accent rounded-2xl"
                >
                  <img
                    src={att.url}
                    alt={att.fileName || 'Attachment image'}
                    className="max-h-60 max-w-full rounded-2xl object-cover hover:scale-[1.02] transition-transform duration-200 border border-[var(--glass-border)]"
                    loading="lazy"
                  />
                </button>
              </div>
            )
          }

          // File Card
          return (
            <div
              key={att.id || att.url}
              className={`flex items-center justify-between gap-3 p-2.5 rounded-2xl border transition-colors ${
                isMine
                  ? 'bg-black/10 border-white/20 hover:bg-black/15'
                  : 'glass-subtle border-[var(--glass-border)] hover:bg-[var(--glass-bg-hover)] text-ink'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {getFileIcon(att.mimeType)}
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate max-w-[180px] sm:max-w-[240px]">
                    {att.fileName}
                  </p>
                  <p
                    className={`text-[10px] tabular-nums ${
                      isMine ? 'opacity-80' : 'text-ink-muted'
                    }`}
                  >
                    {formatFileSize(att.size)}
                  </p>
                </div>
              </div>

              <a
                href={att.url}
                download={att.fileName}
                target="_blank"
                rel="noreferrer"
                className={`p-1.5 rounded-xl transition-colors flex-shrink-0 focus-accent ${
                  isMine
                    ? 'bg-black/15 hover:bg-black/25 text-current'
                    : 'btn-glass text-ink'
                }`}
                title="Download file"
                aria-label="Download file"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
            </div>
          )
        })}
      </div>

      {activeImageIndex !== null && imageAttachments.length > 0 && (
        <ImageLightbox
          images={imageAttachments}
          currentIndex={activeImageIndex}
          onPrev={() => setActiveImageIndex((prev) => Math.max(0, prev - 1))}
          onNext={() => setActiveImageIndex((prev) => Math.min(imageAttachments.length - 1, prev + 1))}
          onClose={() => setActiveImageIndex(null)}
        />
      )}
    </>
  )
}
