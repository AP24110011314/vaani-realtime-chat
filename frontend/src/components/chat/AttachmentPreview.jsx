import { useState } from 'react'
import { FileText, Download, File, FileArchive } from 'lucide-react'
import { formatFileSize } from '../../lib/formatters'
import ImageLightbox from './ImageLightbox'

export default function AttachmentPreview({ attachments = [], isMine = false }) {
  const [activeLightboxImage, setActiveLightboxImage] = useState(null)

  if (!attachments || attachments.length === 0) return null

  const getFileIcon = (mimeType = '') => {
    if (mimeType.includes('pdf')) return <FileText className="w-5 h-5 text-rose-400 flex-shrink-0" />
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('compressed')) {
      return <FileArchive className="w-5 h-5 text-amber-400 flex-shrink-0" />
    }
    return <File className="w-5 h-5 text-indigo-400 flex-shrink-0" />
  }

  return (
    <>
      <div className="flex flex-col gap-2 my-1.5">
        {attachments.map((att) => {
          const isImage = att.mimeType && att.mimeType.startsWith('image/')

          if (isImage) {
            return (
              <div key={att.id || att.url} className="relative group/att overflow-hidden rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveLightboxImage({ src: att.url, alt: att.fileName })}
                  className="block cursor-pointer focus:outline-hidden"
                >
                  <img
                    src={att.url}
                    alt={att.fileName || 'Attachment image'}
                    className="max-h-60 max-w-full rounded-xl object-cover hover:scale-[1.02] transition-transform duration-200 border border-slate-700/50"
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
              className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-colors ${
                isMine
                  ? 'bg-indigo-700/40 border-indigo-500/50 hover:bg-indigo-700/60'
                  : 'bg-slate-900/60 border-slate-700/60 hover:bg-slate-900/80'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {getFileIcon(att.mimeType)}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-100 truncate max-w-[180px] sm:max-w-[240px]">
                    {att.fileName}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {formatFileSize(att.size)}
                  </p>
                </div>
              </div>

              <a
                href={att.url}
                download={att.fileName}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors flex-shrink-0"
                title="Download file"
                aria-label="Download file"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
            </div>
          )
        })}
      </div>

      {activeLightboxImage && (
        <ImageLightbox
          src={activeLightboxImage.src}
          alt={activeLightboxImage.alt}
          onClose={() => setActiveLightboxImage(null)}
        />
      )}
    </>
  )
}
