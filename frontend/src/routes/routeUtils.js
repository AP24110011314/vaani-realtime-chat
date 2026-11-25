export function getSafeNextPath(search) {
  const raw = new URLSearchParams(search || '').get('next')
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) {
    return raw
  }
  return '/app'
}
