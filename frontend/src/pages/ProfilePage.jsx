import { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router'
import { ArrowLeft, Camera, Trash2, Lock, Save, KeyRound, LogOut, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { userApi } from '../api/userApi'
import { authApi } from '../api/authApi'
import UserAvatar from '../components/common/UserAvatar'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, updateUser, logout } = useAuth()

  // Profile fields state
  const [name, setName] = useState(user?.name || '')
  const [about, setAbout] = useState(user?.about || '')
  const [showLastSeen, setShowLastSeen] = useState(user?.showLastSeen ?? true)
  const [showReadReceipts, setShowReadReceipts] = useState(user?.showReadReceipts ?? true)

  // Status & Feedback
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState('')
  const [profileError, setProfileError] = useState('')

  // Avatar state
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const avatarInputRef = useRef(null)

  // Password state
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

  // Handle Avatar Upload
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

  // Handle Avatar Delete
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

  // Handle Profile Save
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

  // Handle Password Change
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-20 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/app"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              aria-label="Back to messages"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-base font-bold text-white">Profile & Settings</h1>
          </div>
          <button
            onClick={() => {
              logout()
              navigate('/login')
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:text-white hover:bg-rose-950/60 border border-rose-900/60 rounded-xl transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log out</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Profile Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
          <h2 className="text-sm font-bold text-white mb-4">Personal Profile</h2>

          {profileSuccess && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-950/70 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{profileSuccess}</span>
            </div>
          )}

          {profileError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{profileError}</span>
            </div>
          )}

          {/* Avatar Section */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 pb-6 border-b border-slate-800/80">
            <div className="relative group">
              <UserAvatar
                src={user?.avatarUrl}
                name={user?.name}
                size="xl"
                className="ring-2 ring-indigo-500/50 ring-offset-2 ring-offset-slate-900"
              />
              {isUploadingAvatar && (
                <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                </div>
              )}
            </div>

            <div className="flex flex-col items-center sm:items-start gap-2">
              <span className="text-xs font-semibold text-slate-300">Profile Picture</span>
              <p className="text-[11px] text-slate-400 text-center sm:text-left">
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Change</span>
                </button>

                {user?.avatarUrl && (
                  <button
                    type="button"
                    onClick={handleAvatarDelete}
                    disabled={isUploadingAvatar}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700/60 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              {avatarError && (
                <span className="text-xs text-rose-400 mt-1">{avatarError}</span>
              )}
            </div>
          </div>

          {/* Form Fields */}
          <form onSubmit={handleSaveProfile} className="mt-6 space-y-4">
            {/* Email (Read-only) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <span>Email address</span>
                <Lock className="w-3 h-3 text-slate-500" />
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full bg-slate-950/50 border border-slate-800/80 rounded-xl px-3.5 py-2 text-xs text-slate-400 cursor-not-allowed select-none"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Your email cannot be changed.
              </p>
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                placeholder="Your name"
              />
            </div>

            {/* About / Bio */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">About</label>
                <span className="text-[10px] text-slate-500">{about.length} / 200</span>
              </div>
              <textarea
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                maxLength={200}
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors resize-none"
                placeholder="Say something about yourself..."
              />
            </div>

            {/* Privacy Toggles */}
            <div className="pt-2 space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Privacy Settings</h3>

              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 cursor-pointer hover:bg-slate-950 transition-colors">
                <div>
                  <span className="text-xs font-medium text-slate-200 block">Show Last Seen & Online Status</span>
                  <span className="text-[10px] text-slate-500 block">
                    Allow conversation members to see when you are active.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={showLastSeen}
                  onChange={(e) => setShowLastSeen(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 cursor-pointer hover:bg-slate-950 transition-colors">
                <div>
                  <span className="text-xs font-medium text-slate-200 block">Send Read Receipts</span>
                  <span className="text-[10px] text-slate-500 block">
                    Show others when you have read their messages.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={showReadReceipts}
                  onChange={(e) => setShowReadReceipts(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </label>
            </div>

            {/* Save Button */}
            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                disabled={isSavingProfile}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition-all"
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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-bold text-white">Change Password</h2>
          </div>

          {passwordSuccess && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-950/70 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{passwordSuccess}</span>
            </div>
          )}

          {passwordError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                placeholder="Enter your current password"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  placeholder="Min 8 chars, letter + number"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  placeholder="Repeat new password"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isChangingPassword}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl border border-slate-700/80 transition-colors"
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
  )
}
