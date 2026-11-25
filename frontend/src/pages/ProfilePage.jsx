import { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router'
import {
  ArrowLeft,
  Camera,
  Trash2,
  Lock,
  Save,
  KeyRound,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { userApi } from '../api/userApi'
import { authApi } from '../api/authApi'
import UserAvatar from '../components/common/UserAvatar'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, updateUser, logout } = useAuth()

  const [name, setName] = useState(user?.name || '')
  const [about, setAbout] = useState(user?.about || '')
  const [showLastSeen, setShowLastSeen] = useState(user?.showLastSeen ?? true)
  const [showReadReceipts, setShowReadReceipts] = useState(user?.showReadReceipts ?? true)

  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState('')
  const [profileError, setProfileError] = useState('')

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const avatarInputRef = useRef(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const [prevUser, setPrevUser] = useState(user)
  if (user && user !== prevUser) {
    setPrevUser(user)
    setName(user.name || '')
    setAbout(user.about || '')
    setShowLastSeen(user.showLastSeen ?? true)
    setShowReadReceipts(user.showReadReceipts ?? true)
  }

  const handleAvatarSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setAvatarError('')
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('Avatar must be 2 MB or smaller.')
      return
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      setAvatarError('Only JPEG, PNG, or WebP images are allowed.')
      return
    }

    setIsUploadingAvatar(true)
    try {
      const updatedUser = await userApi.uploadAvatar(file)
      updateUser(updatedUser)
      setProfileSuccess('Avatar updated successfully.')
      setTimeout(() => setProfileSuccess(''), 3000)
    } catch (err) {
      setAvatarError(err.response?.data?.message || 'Failed to upload avatar.')
    } finally {
      setIsUploadingAvatar(false)
      if (avatarInputRef.current) {
        avatarInputRef.current.value = ''
      }
    }
  }

  const handleAvatarDelete = async () => {
    if (!user?.avatarUrl) return

    setIsUploadingAvatar(true)
    setAvatarError('')
    try {
      const updatedUser = await userApi.deleteAvatar()
      updateUser(updatedUser)
      setProfileSuccess('Avatar removed.')
      setTimeout(() => setProfileSuccess(''), 3000)
    } catch (err) {
      setAvatarError(err.response?.data?.message || 'Failed to remove avatar.')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setProfileError('')
    setProfileSuccess('')

    const trimmedName = name.trim()
    if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 80) {
      setProfileError('Name must be between 2 and 80 characters.')
      return
    }

    if (about && about.trim().length > 200) {
      setProfileError('About must be 200 characters or fewer.')
      return
    }

    setIsSavingProfile(true)
    try {
      const updated = await userApi.updateMe({
        name: trimmedName,
        about: about ? about.trim() : '',
        showLastSeen,
        showReadReceipts,
      })
      updateUser(updated)
      setProfileSuccess('Profile saved successfully.')
      setTimeout(() => setProfileSuccess(''), 3000)
    } catch (err) {
      setProfileError(err.response?.data?.message || 'Failed to save profile.')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (!currentPassword) {
      setPasswordError('Current password is required.')
      return
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.')
      return
    }
    if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPasswordError('New password must contain at least one letter and one number.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.')
      return
    }

    setIsChangingPassword(true)
    try {
      await authApi.changePassword({ currentPassword, newPassword })
      setPasswordSuccess('Password changed successfully.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordSuccess(''), 4000)
    } catch (err) {
      setPasswordError(err.response?.data?.message || 'Failed to change password.')
    } finally {
      setIsChangingPassword(false)
    }
  }

  return (
    <div className="min-h-screen text-ink flex flex-col py-4 sm:py-6 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto w-full space-y-6">
        {/* Floating Glass Header */}
        <header className="glass rounded-3xl px-4 sm:px-5 py-3.5 sticky top-4 z-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/app"
              className="p-2 -ml-1 text-ink-muted hover:text-ink hover:bg-[var(--glass-bg-hover)] rounded-xl transition-colors focus-accent"
              title="Back to messages"
              aria-label="Back to messages"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-base sm:text-lg font-bold text-ink">Profile &amp; Settings</h1>
          </div>
          <button
            onClick={() => {
              logout()
              navigate('/login')
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-[var(--danger-text)] bg-[var(--danger-bg)] hover:brightness-105 border border-[var(--danger-border)] rounded-full transition-all cursor-pointer focus-accent"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log out</span>
          </button>
        </header>

        {/* Main Content */}
        <main className="space-y-6">
          {/* Profile Card */}
          <div className="glass rounded-3xl p-5 sm:p-7">
            <h2 className="text-sm font-bold text-ink mb-5">Personal Profile</h2>

            {profileSuccess && (
              <div className="mb-4 p-3 rounded-2xl bg-[var(--success-bg)] border border-[var(--success-border)] text-[var(--success-text)] text-xs flex items-center gap-2 animate-msg-in">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{profileSuccess}</span>
              </div>
            )}

            {profileError && (
              <div role="alert" className="mb-4 p-3 rounded-2xl bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger-text)] text-xs flex items-center gap-2 animate-msg-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            {/* Avatar Section */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 pb-6 border-b border-[var(--glass-border)]">
              <div className="relative group">
                <UserAvatar
                  src={user?.avatarUrl}
                  name={user?.name}
                  seed={user?.id || user?.email}
                  size="xl"
                  gradientRing={true}
                />
                {isUploadingAvatar && (
                  <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-accent-text animate-spin" />
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center sm:items-start gap-2">
                <span className="text-xs font-semibold text-ink">Profile Picture</span>
                <p className="text-[11px] text-ink-muted text-center sm:text-left">
                  Upload a JPEG, PNG, or WebP image under 2 MB.
                </p>

                <div className="flex items-center gap-2 mt-1">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleAvatarSelect}
                  />
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 btn-accent disabled:opacity-50 text-xs font-semibold rounded-full cursor-pointer focus-accent"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Change</span>
                  </button>

                  {user?.avatarUrl && (
                    <button
                      type="button"
                      onClick={handleAvatarDelete}
                      disabled={isUploadingAvatar}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 btn-glass hover:text-[var(--danger-text)] text-xs font-semibold rounded-full cursor-pointer focus-accent"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                {avatarError && (
                  <span role="alert" className="text-xs text-[var(--danger-text)] mt-1">{avatarError}</span>
                )}
              </div>
            </div>

            {/* Form Fields */}
            <form onSubmit={handleSaveProfile} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1.5 flex items-center gap-1.5">
                  <span>Email address</span>
                  <Lock className="w-3 h-3 text-ink-subtle" />
                </label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="glass-input w-full rounded-2xl px-3.5 py-2 text-xs text-ink-subtle opacity-75 cursor-not-allowed select-none"
                />
                <p className="text-[10px] text-ink-subtle mt-1">
                  Your email cannot be changed.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  required
                  className="glass-input w-full rounded-2xl px-3.5 py-2 text-xs"
                  placeholder="Your name"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-ink-muted">About</label>
                  <span className="text-[10px] text-ink-subtle tabular-nums">{about.length} / 200</span>
                </div>
                <textarea
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  maxLength={200}
                  rows={2}
                  className="glass-input w-full rounded-2xl px-3.5 py-2 text-xs resize-none"
                  placeholder="Say something about yourself..."
                />
              </div>

              {/* Privacy Toggles */}
              <div className="pt-2 space-y-3">
                <h3 className="text-xs font-bold text-ink-muted uppercase tracking-wider">Privacy Settings</h3>

                <label className="flex items-center justify-between p-3.5 rounded-2xl glass-subtle cursor-pointer hover:bg-[var(--glass-bg-hover)] transition-colors">
                  <div>
                    <span className="text-xs font-semibold text-ink block">Show Last Seen &amp; Online Status</span>
                    <span className="text-[11px] text-ink-muted block mt-0.5">
                      Allow conversation members to see when you are active.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={showLastSeen}
                    onChange={(e) => setShowLastSeen(e.target.checked)}
                    className="w-4 h-4 accent-[var(--accent-solid)] rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-2xl glass-subtle cursor-pointer hover:bg-[var(--glass-bg-hover)] transition-colors">
                  <div>
                    <span className="text-xs font-semibold text-ink block">Send Read Receipts</span>
                    <span className="text-[11px] text-ink-muted block mt-0.5">
                      Show others when you have read their messages.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={showReadReceipts}
                    onChange={(e) => setShowReadReceipts(e.target.checked)}
                    className="w-4 h-4 accent-[var(--accent-solid)] rounded cursor-pointer"
                  />
                </label>
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="inline-flex items-center gap-1.5 px-5 py-2 btn-accent disabled:opacity-50 text-xs font-semibold rounded-full cursor-pointer focus-accent"
                >
                  {isSavingProfile ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>

          {/* Change Password Card */}
          <div className="glass rounded-3xl p-5 sm:p-7">
            <div className="flex items-center gap-2 mb-5">
              <KeyRound className="w-4 h-4 text-accent-text" />
              <h2 className="text-sm font-bold text-ink">Change Password</h2>
            </div>

            {passwordSuccess && (
              <div className="mb-4 p-3 rounded-2xl bg-[var(--success-bg)] border border-[var(--success-border)] text-[var(--success-text)] text-xs flex items-center gap-2 animate-msg-in">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {passwordError && (
              <div role="alert" className="mb-4 p-3 rounded-2xl bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger-text)] text-xs flex items-center gap-2 animate-msg-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1.5">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="glass-input w-full rounded-2xl px-3.5 py-2 text-xs"
                  placeholder="Enter your current password"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1.5">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    className="glass-input w-full rounded-2xl px-3.5 py-2 text-xs"
                    placeholder="Min 8 chars, letter + number"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1.5">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    className="glass-input w-full rounded-2xl px-3.5 py-2 text-xs"
                    placeholder="Repeat new password"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="inline-flex items-center gap-1.5 px-5 py-2 btn-glass disabled:opacity-50 text-xs font-semibold rounded-full cursor-pointer focus-accent"
                >
                  {isChangingPassword ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                  <span>Update Password</span>
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  )
}
