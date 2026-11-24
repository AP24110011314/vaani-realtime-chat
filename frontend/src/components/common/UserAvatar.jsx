import { useState } from 'react'

const SIZE_CLASSES = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base font-semibold',
  xl: 'w-20 h-20 text-xl font-bold',
}

const DOT_SIZE = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2.5 h-2.5',
  md: 'w-3 h-3',
  lg: 'w-3.5 h-3.5',
  xl: 'w-4 h-4',
}

export default function UserAvatar({
  src,
  name = 'User',
  size = 'md',
  isOnline = false,
  className = '',
}) {
  const [hasError, setHasError] = useState(false)
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md
  const dotClass = DOT_SIZE[size] || DOT_SIZE.md

  const initial = name?.trim() ? name.trim().charAt(0).toUpperCase() : '?'

  return (
    <div className={`relative flex-shrink-0 inline-block ${className}`}>
      {src && !hasError ? (
        <img
          src={src}
          alt={name}
          onError={() => setHasError(true)}
          className={`${sizeClass} rounded-full object-cover shadow-sm bg-slate-800`}
        />
      ) : (
        <div
          className={`${sizeClass} rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center font-bold text-white shadow-inner select-none`}
        >
          {initial}
        </div>
      )}

      {isOnline && (
        <span
          className={`absolute bottom-0 right-0 ${dotClass} bg-emerald-500 rounded-full border-2 border-slate-900`}
          title="Online"
        />
      )}
    </div>
  )
}
