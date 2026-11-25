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

  // Notification status
  const [notificationStatus, setNotificationStatus] = useState(() => getNotificationPermission())
  const [notifMessage, setNotifMessage] = useState('')

  // Privacy states
  const [showLastSeen, setShowLastSeen] = useState(user?.showLastSeen ?? true)
  const [showReadReceipts, setShowReadReceipts] = useState(user?.showReadReceipts ?? true)
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false)
  const [privacySuccess, setPrivacySuccess] = useState('')
  const [privacyError, setPrivacyError] = useState('')

  // Blocked users
  const [blockedUsers, setBlockedUsers] = useState([])
  const [isLoadingBlocked, setIsLoadingBlocked] = useState(true)
  const [unblockingId, setUnblockingId] = useState(null)
  const [blockedError, setBlockedError] = useState('')

  // Logout all
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false)

  // Keep privacy state synced with user
  const [prevUser, setPrevUser] = useState(user)
  if (user && user !== prevUser) {
    setPrevUser(user)
    setShowLastSeen(user.showLastSeen ?? true)
    setShowReadReceipts(user.showReadReceipts ?? true)
  }

  // Load blocked users — setState only inside async callbacks
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

  // Handle Notification permission request
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

  // Handle Privacy toggles
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

  // Handle Unblock user
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

  // Handle Logout All
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center py-6 px-4 sm:px-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/app')}
              className="p-2 -ml-2 text-slate-400 hover:text-white hover:bg-slate-900 rounded-xl transition-colors"
              title="Back to chats"
              aria-label="Back to chats"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-white">Settings</h1>
          </div>
          <Link
            to="/profile"
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Edit Profile →
          </Link>
        </div>

        <div className="space-y-6">
          {/* 1. Theme Appearance */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <h2 className="text-sm font-bold text-slate-200 mb-1 flex items-center gap-2">
              <Sun className="w-4 h-4 text-amber-400" />
              <span>Theme Appearance</span>
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Choose your interface color mode. Active mode: <span className="font-semibold text-indigo-300 capitalize">{resolvedTheme}</span>
            </p>

            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all ${
                  theme === 'light'
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 shadow-sm'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Sun className="w-5 h-5 text-amber-400" />
                <span>Light</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all ${
                  theme === 'dark'
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 shadow-sm'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Moon className="w-5 h-5 text-indigo-400" />
                <span>Dark</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('system')}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all ${
                  theme === 'system'
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 shadow-sm'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Laptop className="w-5 h-5 text-slate-300" />
                <span>System</span>
              </button>
            </div>
          </section>

          {/* 2. Desktop Notifications */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-slate-200 mb-1 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-indigo-400" />
                  <span>Desktop Notifications</span>
                </h2>
                <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                  Get notified of new incoming messages when this browser tab is in the background or minimized. Muted chats will not trigger alerts.
                </p>
                <div className="mt-2 text-[11px] flex items-center gap-2">
                  <span className="text-slate-500">Status:</span>
                  <span
                    className={`font-semibold px-2 py-0.5 rounded-full capitalize ${
                      notificationStatus === 'granted'
                        ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800'
                        : notificationStatus === 'denied'
                        ? 'bg-rose-950/70 text-rose-300 border border-rose-800'
                        : 'bg-slate-800 text-slate-300'
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
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white text-xs font-semibold rounded-xl transition-all shadow-md flex-shrink-0"
              >
                {notificationStatus === 'granted' ? 'Enabled' : 'Enable notifications'}
              </button>
            </div>

            {notifMessage && (
              <p className="mt-3 text-xs text-indigo-300 animate-in fade-in">
                {notifMessage}
              </p>
            )}
          </section>

          {/* 3. Privacy Settings */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <h2 className="text-sm font-bold text-slate-200 mb-1 flex items-center gap-2">
              <Eye className="w-4 h-4 text-indigo-400" />
              <span>Privacy Settings</span>
            </h2>

            {privacySuccess && (
              <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{privacySuccess}</span>
              </div>
            )}
            {privacyError && (
              <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{privacyError}</span>
              </div>
            )}

            <div className="divide-y divide-slate-800/80">
              <div className="flex items-center justify-between py-3">
                <div className="pr-4">
                  <h3 className="text-xs font-semibold text-slate-200">Show Last Seen Status</h3>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Allow other users to see when you were last online. If disabled, you also won&apos;t see others&apos; last seen.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleLastSeen}
                  disabled={isSavingPrivacy}
                  className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 focus:outline-hidden ${
                    showLastSeen ? 'bg-indigo-600' : 'bg-slate-700'
                  }`}
                  aria-label="Toggle last seen"
                >
                  <span
                    className={`block w-4 h-4 bg-white rounded-full transition-transform absolute top-1 left-1 ${
                      showLastSeen ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between py-3">
                <div className="pr-4">
                  <h3 className="text-xs font-semibold text-slate-200">Show Read Receipts</h3>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Send blue tick read receipts when you view messages. If disabled, you won&apos;t see read receipts on messages you send.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleReadReceipts}
                  disabled={isSavingPrivacy}
                  className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 focus:outline-hidden ${
                    showReadReceipts ? 'bg-indigo-600' : 'bg-slate-700'
                  }`}
                  aria-label="Toggle read receipts"
                >
                  <span
                    className={`block w-4 h-4 bg-white rounded-full transition-transform absolute top-1 left-1 ${
                      showReadReceipts ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>

          {/* 4. Blocked Users */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <h2 className="text-sm font-bold text-slate-200 mb-1 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Blocked Users</span>
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Blocked contacts cannot message you or view your online presence.
            </p>

            {blockedError && (
              <p className="text-xs text-rose-400 mb-3">{blockedError}</p>
            )}

            {isLoadingBlocked ? (
              <div className="flex items-center justify-center p-4 text-xs text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin mr-2 text-indigo-400" />
                Loading blocked contacts...
              </div>
            ) : blockedUsers.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/60 text-center text-xs text-slate-500">
                You have not blocked any users.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80 max-h-56 overflow-y-auto pr-1">
                {blockedUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar src={u.avatarUrl} name={u.name} size="sm" />
                      <div className="min-w-0">
                        <span className="font-semibold text-xs text-slate-200 block truncate">
                          {u.name}
                        </span>
                        <span className="text-[11px] text-slate-400 block truncate">
                          {u.email}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnblock(u.id)}
                      disabled={unblockingId === u.id}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
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
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <h2 className="text-sm font-bold text-slate-200 mb-1 flex items-center gap-2">
              <LogOut className="w-4 h-4 text-rose-400" />
              <span>Account Sessions</span>
            </h2>
            <p className="text-xs text-slate-400">
              Manage your active sessions across browsers and devices.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleLogoutAll}
                disabled={isLoggingOutAll}
                className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/50 text-rose-300 hover:text-rose-200 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {isLoggingOutAll && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Log out all devices</span>
              </button>

              <button
                type="button"
                onClick={logout}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-colors text-center"
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
