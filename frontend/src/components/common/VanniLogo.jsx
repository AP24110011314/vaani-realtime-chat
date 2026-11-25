import { useId } from 'react'

export default function VanniLogo({
  size = 'md',
  showWordmark = true,
  className = '',
}) {
  const gradId = useId()
  const dimensions = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
  }

  const textSizes = {
    sm: 'text-[19px] leading-none',
    md: 'text-[22px] leading-none',
    lg: 'text-[28px] leading-none',
  }

  return (
    <span className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <span
        className={`${dimensions[size] || dimensions.md} rounded-2xl glass-strong flex items-center justify-center shrink-0 shadow-sm`}
      >
        <svg viewBox="0 0 32 32" className="w-[68%] h-[68%]" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id={gradId} x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="var(--accent-start)" />
              <stop offset="100%" stopColor="var(--accent-end)" />
            </linearGradient>
          </defs>
          <path
            d="M5 10.5C5 7.46243 7.46243 5 10.5 5H21.5C24.5376 5 27 7.46243 27 10.5V18.5C27 21.5376 24.5376 24 21.5 24H13.9L8.15 28.35C7.34 28.96 6.18 28.39 6.18 27.38V23.45C5.43 22.4 5 21.02 5 19.5V10.5Z"
            fill={`url(#${gradId})`}
          />
          <circle cx="12" cy="14.5" r="1.5" fill="var(--accent-ink)" />
          <circle cx="16" cy="14.5" r="1.5" fill="var(--accent-ink)" />
          <circle cx="20" cy="14.5" r="1.5" fill="var(--accent-ink)" />
        </svg>
      </span>
      {showWordmark && (
        <span
          className={`${textSizes[size] || textSizes.md} font-brand font-bold tracking-[-0.025em] text-ink`}
        >
          Vanni
        </span>
      )}
    </span>
  )
}
