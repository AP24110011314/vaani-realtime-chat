import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Users, ShieldCheck, AlertCircle, CheckCircle2, ArrowRight, Clock } from 'lucide-react'
import { inviteApi } from '../api/inviteApi'
import VanniLogo from '../components/common/VanniLogo'
import Button from '../components/common/Button'
import Spinner from '../components/common/Spinner'

export default function JoinPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [joinError, setJoinError] = useState(null)
  const [joining, setJoining] = useState(false)
  const [requestSent, setRequestSent] = useState(false)

  const {
    data: preview,
    isLoading: loading,
    error: previewErr,
  } = useQuery({
    queryKey: ['invitePreview', code],
    queryFn: () => inviteApi.preview(code),
    enabled: Boolean(code),
    retry: false,
  })

  const previewErrorMessage = previewErr
    ? previewErr.response?.data?.message ||
      'This invite link is invalid, expired, or no longer active.'
    : null
  const error = joinError || previewErrorMessage

  const handleJoin = async () => {
    setJoining(true)
    setJoinError(null)
    try {
      const res = await inviteApi.join(code)
      if (res.status === 'PENDING') {
        setRequestSent(true)
      } else if (res.conversation?.id) {
        queryClient.invalidateQueries({ queryKey: ['conversations'] })
        navigate(`/app/c/${res.conversation.id}`, { replace: true })
      } else {
        navigate('/app', { replace: true })
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        'Unable to join this group with this invite link.'
      setJoinError(msg)
    } finally {
      setJoining(false)
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 text-ink">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <Link to="/app" className="focus-accent rounded-2xl">
            <VanniLogo size="lg" />
          </Link>
        </div>

        <div className="glass-strong rounded-[28px] p-7 sm:p-8 text-center animate-modal-in">
          {loading ? (
            <div className="py-8 flex flex-col items-center gap-3">
              <Spinner size="lg" />
              <p className="text-sm text-ink-muted">Checking invite link...</p>
            </div>
          ) : error && !preview ? (
            <div className="py-4 space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--danger-bg)] border border-[var(--danger-border)] flex items-center justify-center text-[var(--danger-text)]">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h1 className="text-xl font-bold text-ink heading-tight">Invite Unavailable</h1>
              <p className="text-sm text-ink-muted leading-relaxed">{error}</p>
              <Link to="/app" className="inline-block pt-2">
                <Button variant="secondary" className="rounded-full px-6">
                  Back to Vanni
                </Button>
              </Link>
            </div>
          ) : requestSent ? (
            <div className="py-4 space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--success-bg)] border border-[var(--success-border)] flex items-center justify-center text-[var(--success-text)]">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h1 className="text-xl font-bold text-ink heading-tight">Request Sent</h1>
              <p className="text-sm text-ink-muted leading-relaxed">
                Your request to join <strong className="text-ink">{preview?.title}</strong> has been sent to the group admins. You will be added once approved.
              </p>
              <Link to="/app" className="inline-block pt-2">
                <Button variant="secondary" className="rounded-full px-6">
                  Go to Chats
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Group Avatar */}
              <div className="flex justify-center">
                {preview?.avatarUrl ? (
                  <img
                    src={preview.avatarUrl}
                    alt={preview.title}
                    className="w-20 h-20 rounded-full object-cover shadow-md border border-[var(--glass-border)]"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full accent-badge flex items-center justify-center text-2xl font-bold shadow-md">
                    {preview?.title ? preview.title.charAt(0).toUpperCase() : <Users className="w-8 h-8" />}
                  </div>
                )}
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-accent-text mb-1">
                  Group Invite
                </p>
                <h1 className="text-2xl font-bold text-ink heading-tight">{preview?.title}</h1>
                {preview?.description && (
                  <p className="text-sm text-ink-muted mt-2 leading-relaxed">{preview.description}</p>
                )}
              </div>

              <div className="flex items-center justify-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full glass-subtle text-xs font-medium text-ink-muted tabular-nums">
                  <Users className="w-3.5 h-3.5 text-accent-text" />
                  {preview?.memberCount} {preview?.memberCount === 1 ? 'member' : 'members'}
                </span>
                {preview?.requiresApproval && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--warning-bg)] border border-[var(--warning-border)] text-xs font-semibold text-[var(--warning-text)]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Approval required
                  </span>
                )}
              </div>

              {error && (
                <div
                  role="alert"
                  className="p-3 rounded-2xl bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger-text)] text-xs flex items-center gap-2 text-left"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {preview?.alreadyMember ? (
                <Button
                  onClick={() => navigate(`/app/c/${preview.conversationId}`)}
                  className="w-full rounded-full gap-2"
                >
                  <span>Open Group</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleJoin}
                  loading={joining}
                  className="w-full rounded-full gap-2"
                >
                  {preview?.requiresApproval ? (
                    <>
                      <Clock className="w-4 h-4" />
                      <span>Request to Join</span>
                    </>
                  ) : (
                    <>
                      <span>Join Group</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              )}

              <div>
                <Link
                  to="/app"
                  className="text-xs text-ink-muted hover:text-ink transition-colors focus-accent rounded"
                >
                  Cancel and return to chats
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
