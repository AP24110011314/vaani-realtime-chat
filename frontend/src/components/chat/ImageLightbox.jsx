import { useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Download, ChevronLeft, ChevronRight } from 'lucide-react'

export default function ImageLightbox({
  src,
  alt = 'Image preview',
  images = [],
  currentIndex = 0,
  onClose,
  onPrev,
  onNext,
}) {
  const hasMultiple = images && images.length > 1
  const currentItem = images && images.length > 0 ? images[currentIndex] : null
  const currentSrc = currentItem?.src || (typeof currentItem === 'string' ? currentItem : src)
  const currentAlt = currentItem?.alt || alt

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        onClose?.()
      } else if (e.key === 'ArrowLeft' && hasMultiple && onPrev) {
        onPrev()
      } else if (e.key === 'ArrowRight' && hasMultiple && onNext) {
        onNext()
      }
    },
    [onClose, onPrev, onNext, hasMultiple]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!currentSrc) return null

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 select-none animate-modal-in"
      onClick={onClose}
    >
      <div
        className="relative max-w-5xl max-h-[90vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top actions & Counter */}
        <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
          {hasMultiple && (
            <span className="px-3 py-1 bg-black/65 text-[#F5F5F7] text-xs font-semibold rounded-full border border-white/15 backdrop-blur-md tabular-nums">
              {currentIndex + 1} / {images.length}
            </span>
          )}
          <a
            href={currentSrc}
            download={currentAlt || 'download'}
            target="_blank"
            rel="noreferrer"
            className="p-2 bg-black/65 hover:bg-black/80 text-[#F5F5F7] rounded-full transition-colors border border-white/15 backdrop-blur-md focus-accent"
            title="Download image"
            aria-label="Download image"
          >
            <Download className="w-5 h-5" />
          </a>
          <button
            onClick={onClose}
            className="p-2 bg-black/65 hover:bg-black/80 text-[#F5F5F7] rounded-full transition-colors border border-white/15 backdrop-blur-md focus-accent cursor-pointer"
            title="Close"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Previous Image Button */}
        {hasMultiple && currentIndex > 0 && (
          <button
            onClick={onPrev}
            className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 bg-black/65 hover:bg-black/80 text-[#F5F5F7] rounded-full transition-colors border border-white/15 backdrop-blur-md z-10 focus-accent cursor-pointer"
            title="Previous image (Left arrow)"
            aria-label="Previous image"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Next Image Button */}
        {hasMultiple && currentIndex < images.length - 1 && (
          <button
            onClick={onNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 bg-black/65 hover:bg-black/80 text-[#F5F5F7] rounded-full transition-colors border border-white/15 backdrop-blur-md z-10 focus-accent cursor-pointer"
            title="Next image (Right arrow)"
            aria-label="Next image"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* Full Image */}
        <img
          src={currentSrc}
          alt={currentAlt}
          className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl border border-white/10"
        />
        {currentAlt && (
          <p className="mt-3 text-xs text-[#F5F5F7] font-medium truncate max-w-md bg-black/65 px-3.5 py-1 rounded-full border border-white/15 backdrop-blur-md">
            {currentAlt}
          </p>
        )}
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal
}
