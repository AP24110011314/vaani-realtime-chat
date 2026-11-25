;(function () {
  try {
    var pref = localStorage.getItem('vanni_theme') || 'system'
    var isDark =
      pref === 'dark' ||
      (pref === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
    var root = document.documentElement
    root.style.colorScheme = isDark ? 'dark' : 'light'
    if (isDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  } catch {
    // Ignore storage access errors
  }
})()
