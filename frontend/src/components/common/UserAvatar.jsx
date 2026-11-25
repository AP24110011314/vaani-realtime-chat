import { useState } from 'react'

const SIZE_CLASSES = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base font-semibold',
  xl: 'w-20 h-20 text-xl font-bold',
}

const DOT_SIZE = {
  xs: 'w-2 h-2',
  sm: 'w-2.5 h-2.5',
  md: 'w-3 h-3',
  lg: 'w-3.5 h-3.5',
  xl: 'w-4 h-4',
}

// Curated palette limited strictly to teal / sky / peach / mint / rose / amber (zero purple/indigo)
const AVATAR_GRADIENTS = [
  { background: 'linear-gradient(135deg, #0D9488 0%, #0284C7 100%)', color: '#FFFFFF' },
  { background: 'linear-gradient(135deg, #0E7490 0%, #059669 100%)', color: '#FFFFFF' },
  { background: 'linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)', color: '#FFFFFF' },
  { background: 'linear-gradient(135deg, #E11D48 0%, #EA580C 100%)', color: '#FFFFFF' },
  { background: 'linear-gradient(135deg, #D97706 0%, #E11D48 100%)', color: '#FFFFFF' },
  { background: 'linear-gradient(135deg, #0369A1 0%, #0D9488 100%)', color: '#FFFFFF' },
]

function pickAvatarGradient(seed) {
  const str = String(seed || 'Vanni')
  let hash = 0
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0
  }
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length]
}

export default function UserAvatar({
  src,
  name = 'User',
  seed,
  size = 'md',
  isOnline = false,
  gradientRing = false,
  className = '',
}) {
  const [hasError, setHasError] = useState(false)
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md
  const dotClass = DOT_SIZE[size] || DOT_SIZE.md

  const initial = name?.trim() ? name.trim().charAt(0).toUpperCase() : '?'

  const palette = pickAvatarGradient(seed ?? name)

  const avatarEl =
    src && !hasError ? (
      <img
        src={src}
        alt={name}
        onError={() => setHasError(true)}
        className={`${sizeClass} rounded-full object-cover shadow-sm`}
      />
    ) : (
      <div
        style={{ background: palette.background, color: palette.color }}
        className={`${sizeClass} rounded-full flex items-center justify-center font-bold shadow-inner select-none`}
      >
        {initial}
      </div>
    )

  return (
    <div className={`relative flex-shrink-0 inline-flex items-center justify-center ${className}`}>
      {gradientRing ? (
        <div className="p-[2px] rounded-full accent-ring shadow-sm">
          <div className="rounded-full p-[1.5px] bg-[var(--presence-ring-bg)]">{avatarEl}</div>
        </div>
      ) : (
        avatarEl
      )}

      {isOnline && (
        <span
          className={`absolute bottom-0 right-0 ${dotClass} bg-emerald-500 rounded-full border-2 border-[var(--presence-ring-bg)] animate-presence-pulse`}
          title="Online"
        />
      )}
    </div>
  )
}
