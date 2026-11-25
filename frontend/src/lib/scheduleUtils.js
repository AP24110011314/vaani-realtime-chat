export function toLocalDateTimeInputValue(date) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromLocalDateTimeInput(value) {
  if (!value || typeof value !== 'string') return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

export function getSchedulePresets(now = new Date(), minLeadSeconds = 60) {
  const base = now instanceof Date ? now : new Date(now)
  const minMs = base.getTime() + minLeadSeconds * 1000
  const presets = []

  const inOneHour = new Date(base.getTime() + 60 * 60 * 1000)
  presets.push({ id: 'in-1h', label: 'In 1 hour', date: inOneHour })

  const tonight = new Date(base)
  tonight.setHours(18, 0, 0, 0)
  if (tonight.getTime() >= minMs) {
    presets.push({ id: 'tonight-6pm', label: 'Today 6:00 PM', date: tonight })
  }

  const tomorrow = new Date(base)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(9, 0, 0, 0)
  presets.push({ id: 'tomorrow-9am', label: 'Tomorrow 9:00 AM', date: tomorrow })

  const nextMonday = new Date(base)
  const day = nextMonday.getDay() // 0=Sun..6=Sat
  const daysUntilMonday = day === 0 ? 1 : 8 - day
  nextMonday.setDate(nextMonday.getDate() + daysUntilMonday)
  nextMonday.setHours(9, 0, 0, 0)
  presets.push({ id: 'next-mon-9am', label: 'Next Monday 9:00 AM', date: nextMonday })

  return presets
}

export function validateScheduleDate(date, minLeadSeconds = 60, maxDays = 365, now = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return 'Please choose a valid date and time.'
  }
  const diffMs = date.getTime() - now.getTime()
  if (diffMs < minLeadSeconds * 1000) {
    return `Must be at least ${minLeadSeconds >= 60 ? `${Math.ceil(minLeadSeconds / 60)} minute(s)` : `${minLeadSeconds} seconds`} in the future.`
  }
  if (diffMs > maxDays * 24 * 60 * 60 * 1000) {
    return `Cannot schedule more than ${maxDays} days ahead.`
  }
  return null
}

export function formatScheduledTime(isoOrDate) {
  if (!isoOrDate) return ''
  const date = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const isTomorrow =
    date.getFullYear() === tomorrow.getFullYear() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getDate() === tomorrow.getDate()

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return `Today, ${timeStr}`
  if (isTomorrow) return `Tomorrow, ${timeStr}`

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getLocalTimeZoneLabel() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time'
  } catch {
    return 'Local time'
  }
}
