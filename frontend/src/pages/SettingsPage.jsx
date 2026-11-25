import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router'
import {
  ArrowLeft,
  Sun,
  Moon,
  Laptop,
  Bell,
  Eye,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldAlert,
  LogOut,
  UserCheck,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../context/ThemeContext'
import { userApi } from '../api/userApi'
import { authApi } from '../api/authApi'
import {
  requestNotificationPermission,
  getNotificationPermission,
  showDesktopNotification,
} from '../lib/notifications'
import UserAvatar from '../components/common/UserAvatar'

export default function SettingsPage() {
  const navigate = useNavigate()
  const { user, updateUser, logout } = useAuth()
  const { theme, setTheme, resolvedTheme } = useTheme()

  const [notificationStatus, setNotificationStatus] = useState(() => getNotificationPermission())
  const [notifMessage, setNotifMessage] = useState('')

  const [showLastSeen, setShowLastSeen] = useState(user?.showLastSeen ?? true)
  const [showReadReceipts, setShowReadReceipts] = useState(user?.showReadReceipts ?? true)
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false)
  const [privacySuccess, setPrivacySuccess] = useState('')
  const [privacyError, setPrivacyError] = useState('')

  const [blockedUsers, setBlockedUsers] = useState([])
  const [isLoadingBlocked, setIsLoadingBlocked] = useState(true)
  const [unblockingId, setUnblockingId] = useState(null)
  const [blockedError, setBlockedError] = useState('')

  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false)

  const [prevUser, setPrevUser] = useState(user)
  if (user && user !== prevUser) {
    setPrevUser(user)
    setShowLastSeen(user.showLastSeen ?? true)
    setShowReadReceipts(user.showReadReceipts ?? true)
  }

  useEffect(() => {
    let cancelled = false
    userApi.getBlocked()
      .then((list) => {
        if (!cancelled) {
          setBlockedUsers(list || [])
          setIsLoadingBlocked(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBlockedError('Failed to load blocked users')
          setIsLoadingBlocked(false)
        }
      })
    return () => { cancelled = true }
  }, [])

  const handleEnableNotifications = async () => {
    const perm = await requestNotificationPermission()
    setNotificationStatus(perm)
    if (perm === 'granted') {
      setNotifMessage('Desktop notifications are now enabled!')
      showDesktopNotification({
        title: 'Vanni Notifications Enabled',
        body: 'You will receive desktop alerts when Vanni is in the background.',
      })
    } else if (perm === 'denied') {
      setNotifMessage('Notifications were denied in browser permissions.')
    }
    setTimeout(() => setNotifMessage(''), 4000)
  }

  const handleToggleLastSeen = async () => {
    const nextVal = !showLastSeen
    setShowLastSeen(nextVal)
    setIsSavingPrivacy(true)
    setPrivacySuccess('')
    setPrivacyError('')

    try {
      const updated = await authApi.updateMe({ showLastSeen: nextVal })
      updateUser(updated)
      setPrivacySuccess('Privacy setting updated.')
      setTimeout(() => setPrivacySuccess(''), 3000)
    } catch {
      setShowLastSeen(!nextVal)
      setPrivacyError('Failed to update privacy setting.')
    } finally {
      setIsSavingPrivacy(false)
    }
  }

  const handleToggleReadReceipts = async () => {
    const nextVal = !showReadReceipts
    setShowReadReceipts(nextVal)
    setIsSavingPrivacy(true)
    setPrivacySuccess('')
    setPrivacyError('')

    try {
      const updated = await authApi.updateMe({ showReadReceipts: nextVal })
      updateUser(updated)
      setPrivacySuccess('Privacy setting updated.')
      setTimeout(() => setPrivacySuccess(''), 3000)
    } catch {
      setShowReadReceipts(!nextVal)
      setPrivacyError('Failed to update privacy setting.')
    } finally {
      setIsSavingPrivacy(false)
    }
  }

  const handleUnblock = async (targetId) => {
    setUnblockingId(targetId)
    try {
      await userApi.unblock(targetId)
      setBlockedUsers((prev) => prev.filter((u) => u.id !== targetId))
    } catch {
      setBlockedError('Failed to unblock user')
    } finally {
      setUnblockingId(null)
    }
  }

  const handleLogoutAll = async () => {
    if (!window.confirm('Are you sure you want to log out from all devices?')) return
    setIsLoggingOutAll(true)
    try {
      await authApi.logoutAll()
      await logout()
      navigate('/login')
    } catch {
      setIsLoggingOutAll(false)
    }
  }

  return (
    <div className="min-h-screen text-ink flex flex-col items-center py-6 px-4 sm:px-6">
      <div className="w-full max-w-2xl space-y-6">
        {/* Floating Glass Header */}
        <header className="glass rounded-3xl px-4 sm:px-5 py-3.5 flex items-center justify-between sticky top-4 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/app')}
              className="p-2 -ml-1 text-ink-muted hover:text-ink hover:bg-[var(--glass-bg-hover)] rounded-xl transition-colors focus-accent cursor-pointer"
              title="Back to chats"
              aria-label="Back to chats"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg sm:text-xl font-bold text-ink">Settings</h1>
          </div>
          <Link
            to="/profile"
            className="text-xs font-semibold text-accent-text hover:underline transition-colors focus-accent rounded-lg px-2 py-1"
          >
            Edit Profile &rarr;
          </Link>
        </header>

        <div className="space-y-6">
          {/* 1. Theme Appearance with Visual Preview Tiles */}
          <section className="glass rounded-3xl p-5 sm:p-6">
            <h2 className="text-sm font-bold text-ink mb-1 flex items-center gap-2">
              <Sun className="w-4 h-4 text-accent-text" />
              <span>Theme Appearance</span>
            </h2>
            <p className="text-xs text-ink-muted mb-4">
              Choose your interface color mode. Active mode:{' '}
              <span className="font-semibold text-accent-text capitalize">
                {resolvedTheme === 'dark' ? 'Onyx (Dark)' : 'Pearl (Light)'}
              </span>
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Pearl Light Preview Tile */}
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex flex-col items-start gap-2.5 p-3.5 rounded-2xl border text-xs font-semibold transition-all cursor-pointer focus-accent ${
                  theme === 'light'
                    ? 'glass-strong border-[var(--accent-solid)] ring-2 ring-[var(--accent-glow)] text-ink'
                    : 'glass-subtle hover:bg-[var(--glass-bg-hover)] text-ink-muted hover:text-ink'
                }`}
              >
                <div
                  aria-hidden="true"
                  className="w-full h-14 rounded-xl p-2 flex flex-col justify-between overflow-hidden border border-black/10"
                  style={{
                    background:
                      'radial-gradient(circle at 20% 20%, #FFD9C7, transparent 60%), radial-gradient(circle at 80% 80%, #CDEFE3, #F4F1EB)',
                  }}
                >
                  <div className="w-10 h-2.5 rounded-full bg-white/80" />
                  <div
                    className="w-12 h-3 rounded-full self-end"
                    style={{ background: 'linear-gradient(135deg, #0F766E, #0E7490)' }}
                  />
                </div>
                <span className="flex items-center gap-1.5">
                  <Sun className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Light</span>
                </span>
              </button>

              {/* Onyx Dark Preview Tile */}
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex flex-col items-start gap-2.5 p-3.5 rounded-2xl border text-xs font-semibold transition-all cursor-pointer focus-accent ${
                  theme === 'dark'
                    ? 'glass-strong border-[var(--accent-solid)] ring-2 ring-[var(--accent-glow)] text-ink'
                    : 'glass-subtle hover:bg-[var(--glass-bg-hover)] text-ink-muted hover:text-ink'
                }`}
              >
                <div
                  aria-hidden="true"
                  className="w-full h-14 rounded-xl p-2 flex flex-col justify-between overflow-hidden border border-white/15"
                  style={{
                    background:
                      'radial-gradient(circle at 20% 20%, rgba(45,212,191,0.22), transparent 60%), #000000',
                  }}
                >
                  <div className="w-10 h-2.5 rounded-full bg-white/15" />
                  <div
                    className="w-12 h-3 rounded-full self-end"
                    style={{ background: 'linear-gradient(135deg, #2DD4BF, #38BDF8)' }}
                  />
                </div>
                <span className="flex items-center gap-1.5">
                  <Moon className="w-4 h-4 text-accent-text" />
                  <span>Dark</span>
                </span>
              </button>

              {/* System Auto Preview Tile */}
              <button
                type="button"
                onClick={() => setTheme('system')}
                className={`flex flex-col items-start gap-2.5 p-3.5 rounded-2xl border text-xs font-semibold transition-all cursor-pointer focus-accent ${
                  theme === 'system'
                    ? 'glass-strong border-[var(--accent-solid)] ring-2 ring-[var(--accent-glow)] text-ink'
                    : 'glass-subtle hover:bg-[var(--glass-bg-hover)] text-ink-muted hover:text-ink'
                }`}
              >
                <div
                  aria-hidden="true"
                  className="w-full h-14 rounded-xl overflow-hidden grid grid-cols-2 border border-[var(--glass-border)]"
                >
                  <div
                    className="p-1.5 flex items-center"
                    style={{ background: 'linear-gradient(135deg, #FFD9C7, #F4F1EB)' }}
                  >
                    <div className="w-full h-3 rounded-full bg-white/80" />
                  </div>
                  <div className="p-1.5 flex items-center justify-end bg-black">
                    <div
                      className="w-full h-3 rounded-full"
                      style={{ background: 'linear-gradient(135deg, #2DD4BF, #38BDF8)' }}
                    />
                  </div>
                </div>
                <span className="flex items-center gap-1.5">
                  <Laptop className="w-4 h-4 text-ink-muted" />
                  <span>System</span>
                </span>
              </button>
            </div>
          </section>

          {/* 2. Desktop Notifications */}
          <section className="glass rounded-3xl p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-ink mb-1 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-accent-text" />
                  <span>Desktop Notifications</span>
                </h2>
                <p className="text-xs text-ink-muted max-w-md leading-relaxed">
                  Get notified of new incoming messages when this browser tab is in the background or minimized. Muted chats will not trigger alerts.
                </p>
                <div className="mt-2.5 text-[11px] flex items-center gap-2">
                  <span className="text-ink-subtle">Status:</span>
                  <span
                    className={`font-semibold px-2.5 py-0.5 rounded-full capitalize ${
                      notificationStatus === 'granted'
                        ? 'bg-[var(--success-bg)] text-[var(--success-text)] border border-[var(--success-border)]'
                        : notificationStatus === 'denied'
                        ? 'bg-[var(--danger-bg)] text-[var(--danger-text)] border border-[var(--danger-border)]'
                        : 'glass-subtle text-ink-muted'
                    }`}
                  >
                    {notificationStatus}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleEnableNotifications}
                disabled={notificationStatus === 'granted'}
                className="px-4 py-2 btn-accent disabled:opacity-50 text-xs font-semibold rounded-full flex-shrink-0 cursor-pointer focus-accent"
              >
                {notificationStatus === 'granted' ? 'Enabled' : 'Enable notifications'}
              </button>
            </div>

            {notifMessage && (
              <p className="mt-3 text-xs text-accent-text animate-msg-in">
                {notifMessage}
              </p>
            )}
          </section>

          {/* 3. Privacy Settings */}
          <section className="glass rounded-3xl p-5 sm:p-6 space-y-4">
            <h2 className="text-sm font-bold text-ink mb-1 flex items-center gap-2">
              <Eye className="w-4 h-4 text-accent-text" />
              <span>Privacy Settings</span>
            </h2>

            {privacySuccess && (
              <div className="p-3 rounded-2xl bg-[var(--success-bg)] border border-[var(--success-border)] text-[var(--success-text)] text-xs flex items-center gap-2 animate-msg-in">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{privacySuccess}</span>
              </div>
            )}
            {privacyError && (
              <div role="alert" className="p-3 rounded-2xl bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger-text)] text-xs flex items-center gap-2 animate-msg-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{privacyError}</span>
              </div>
            )}

            <div className="divide-y divide-[var(--glass-border)]">
              <div className="flex items-center justify-between py-3.5">
                <div className="pr-4">
                  <h3 className="text-xs font-semibold text-ink">Show Last Seen Status</h3>
                  <p className="text-[11px] text-ink-muted leading-snug mt-0.5">
                    Allow other users to see when you were last online. If disabled, you also won&apos;t see others&apos; last seen.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleLastSeen}
                  disabled={isSavingPrivacy}
                  className={`w-12 h-6 rounded-full transition-all relative flex-shrink-0 focus-accent cursor-pointer ${
                    showLastSeen
                      ? 'accent-badge shadow-xs'
                      : 'glass-subtle'
                  }`}
                  aria-label="Toggle last seen"
                >
                  <span
                    className={`block w-4 h-4 rounded-full transition-transform absolute top-1 left-1 shadow-xs ${
                      showLastSeen
                        ? 'translate-x-6 bg-white dark:bg-[#031416]'
                        : 'translate-x-0 bg-[var(--text-secondary)]'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between py-3.5">
                <div className="pr-4">
                  <h3 className="text-xs font-semibold text-ink">Show Read Receipts</h3>
                  <p className="text-[11px] text-ink-muted leading-snug mt-0.5">
                    Send read receipts when you view messages. If disabled, you won&apos;t see read receipts on messages you send.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleReadReceipts}
                  disabled={isSavingPrivacy}
                  className={`w-12 h-6 rounded-full transition-all relative flex-shrink-0 focus-accent cursor-pointer ${
                    showReadReceipts
                      ? 'accent-badge shadow-xs'
                      : 'glass-subtle'
                  }`}
                  aria-label="Toggle read receipts"
                >
                  <span
                    className={`block w-4 h-4 rounded-full transition-transform absolute top-1 left-1 shadow-xs ${
                      showReadReceipts
                        ? 'translate-x-6 bg-white dark:bg-[#031416]'
                        : 'translate-x-0 bg-[var(--text-secondary)]'
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>

          {/* 4. Blocked Users */}
          <section className="glass rounded-3xl p-5 sm:p-6">
            <h2 className="text-sm font-bold text-ink mb-1 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[var(--danger-text)]" />
              <span>Blocked Users</span>
            </h2>
            <p className="text-xs text-ink-muted mb-4">
              Blocked contacts cannot message you or view your online presence.
            </p>

            {blockedError && (
              <p role="alert" className="text-xs text-[var(--danger-text)] mb-3">{blockedError}</p>
            )}

            {isLoadingBlocked ? (
              <div className="flex items-center justify-center p-4 text-xs text-ink-muted">
                <Loader2 className="w-4 h-4 animate-spin mr-2 text-accent-text" />
                Loading blocked contacts...
              </div>
            ) : blockedUsers.length === 0 ? (
              <div className="p-4 rounded-2xl glass-subtle text-center text-xs text-ink-subtle">
                You have not blocked any users.
              </div>
            ) : (
              <div className="divide-y divide-[var(--glass-border)] max-h-56 overflow-y-auto pr-1">
                {blockedUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar src={u.avatarUrl} name={u.name} seed={u.id || u.email} size="sm" />
                      <div className="min-w-0">
                        <span className="font-semibold text-xs text-ink block truncate">
                          {u.name}
                        </span>
                        <span className="text-[11px] text-ink-muted block truncate">
                          {u.email}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnblock(u.id)}
                      disabled={unblockingId === u.id}
                      className="px-3.5 py-1.5 btn-glass rounded-full text-xs font-semibold flex items-center gap-1 cursor-pointer focus-accent"
                    >
                      {unblockingId === u.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <UserCheck className="w-3.5 h-3.5" />
                      )}
                      <span>Unblock</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 5. Account Security & Sessions */}
          <section className="glass rounded-3xl p-5 sm:p-6 space-y-4">
            <h2 className="text-sm font-bold text-ink mb-1 flex items-center gap-2">
              <LogOut className="w-4 h-4 text-[var(--danger-text)]" />
              <span>Account Sessions</span>
            </h2>
            <p className="text-xs text-ink-muted">
              Manage your active sessions across browsers and devices.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleLogoutAll}
                disabled={isLoggingOutAll}
                className="px-4 py-2 bg-[var(--danger-bg)] hover:brightness-105 border border-[var(--danger-border)] text-[var(--danger-text)] rounded-full text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer focus-accent"
              >
                {isLoggingOutAll && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Log out all devices</span>
              </button>

              <button
                type="button"
                onClick={logout}
                className="px-4 py-2 btn-glass rounded-full text-xs font-semibold text-center cursor-pointer focus-accent"
              >
                Log out current device
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
