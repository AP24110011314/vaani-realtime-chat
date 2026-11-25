import { useState } from 'react'
import { ExternalLink } from 'lucide-react'

export default function LinkPreviewCard({ preview, isMine = false }) {
  const [imgFailed, setImgFailed] = useState(false)
  if (!preview) return null

  const targetHref = preview.finalUrl || preview.url
  const hasImage = Boolean(preview.imageUrl) && !imgFailed
  const ratio =
    preview.imageWidth && preview.imageHeight
      ? `${preview.imageWidth} / ${preview.imageHeight}`
      : '16 / 9'

  return (
    <a
      href={targetHref}
      target="_blank"
      rel="noopener noreferrer nofollow"
      onClick={(e) => e.stopPropagation()}
      className={`mt-2 block rounded-2xl overflow-hidden border transition-all hover:brightness-105 focus-accent ${
        isMine
          ? 'bg-black/15 border-white/20 text-current'
          : 'glass-subtle border-[var(--glass-border)] text-ink'
      }`}
    >
      {hasImage && (
        <div
          className="w-full max-h-44 overflow-hidden bg-black/10"
          style={{ aspectRatio: ratio }}
        >
          <img
            src={preview.imageUrl}
            alt={preview.title || preview.siteName || 'Link preview image'}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="p-2.5 space-y-0.5 text-left">
        {preview.siteName && (
          <div className="flex items-center justify-between gap-1.5 text-[10px] font-semibold uppercase tracking-wider opacity-75">
            <span className="truncate">{preview.siteName}</span>
            <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
          </div>
        )}
        {preview.title && (
          <p className="text-xs font-bold leading-snug line-clamp-2">
            {preview.title}
          </p>
        )}
        {preview.description && (
          <p className="text-[11px] leading-snug line-clamp-2 opacity-80">
            {preview.description}
          </p>
        )}
      </div>
    </a>
  )
}
