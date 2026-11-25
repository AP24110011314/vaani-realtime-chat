export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied'
  }
  return await Notification.requestPermission()
}

export function getNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied'
  }
  return Notification.permission
}

export function showDesktopNotification({ title, body, icon, onClick }) {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return
  }
  if (Notification.permission !== 'granted') {
    return
  }
  // Only show when the tab is hidden
  if (typeof document !== 'undefined' && document.visibilityState !== 'hidden') {
    return
  }

  try {
    const notification = new Notification(title || 'Vanni', {
      body: body || '',
      icon: icon || '/vite.svg',
    })

    notification.onclick = () => {
      window.focus()
      notification.close()
      if (onClick) onClick()
    }
  } catch {
    // Ignore notification errors
  }
}
