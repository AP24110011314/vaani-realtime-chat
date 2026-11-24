import { useEffect } from 'react'
import { X, Download } from 'lucide-react'

export default function ImageLightbox({ src, alt = 'Image preview', onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!src) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative max-w-5xl max-h-[90vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top actions */}
        <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
          <a
            href={src}
            download={alt || 'download'}
            target="_blank"
            rel="noreferrer"
            className="p-2 bg-slate-900/80 hover:bg-slate-800 text-white rounded-full transition-colors border border-slate-700/60 shadow-lg"
            title="Download image"
            aria-label="Download image"
          >
            <Download className="w-5 h-5" />
          </a>
          <button
            onClick={onClose}
            className="p-2 bg-slate-900/80 hover:bg-slate-800 text-white rounded-full transition-colors border border-slate-700/60 shadow-lg"
            title="Close"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Full Image */}
        <img
          src={src}
          alt={alt}
          className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl border border-slate-800"
        />
        {alt && (
          <p className="mt-2 text-xs text-slate-300 font-medium truncate max-w-md bg-slate-900/80 px-3 py-1 rounded-full border border-slate-800">
            {alt}
          </p>
        )}
      </div>
    </div>
  )
}
