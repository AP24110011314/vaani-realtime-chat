import { Link } from 'react-router'
import { ArrowLeft, Shield } from 'lucide-react'
import VanniLogo from '../components/common/VanniLogo'

const LAST_UPDATED = 'January 1, 2026'
const CONTACT_EMAIL = 'privacy@vanni.app'

function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="text-xl font-bold text-ink heading-tight mb-3">{title}</h2>
      <div className="text-sm text-ink-muted leading-relaxed space-y-3">{children}</div>
    </section>
  )
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen text-ink flex flex-col">

      {/* Nav */}
      <div className="sticky top-0 z-40 px-4 sm:px-6 pt-4 sm:pt-6">
        <header className="max-w-3xl mx-auto">
          <nav className="glass rounded-full px-5 py-3 flex items-center justify-between">
            <Link to="/" className="focus-accent rounded-xl">
              <VanniLogo size="md" />
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink transition-colors focus-accent rounded-full px-3 py-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Home
            </Link>
          </nav>
        </header>
      </div>

      <main className="flex-1 px-4 sm:px-6 py-12 max-w-3xl mx-auto w-full">

        {/* Page header */}
        <div className="glass-strong rounded-[28px] p-8 sm:p-10 mb-8 text-center animate-modal-in">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--accent-soft-bg)] border border-[var(--accent-soft-border)] text-accent-text mb-5">
            <Shield className="w-7 h-7" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-ink heading-tight mb-2">
            Privacy Policy
          </h1>
          <p className="text-sm text-ink-muted">
            Last updated: <strong className="text-ink">{LAST_UPDATED}</strong>
          </p>
          <p className="text-sm text-ink-muted mt-2 max-w-md mx-auto">
            Your privacy matters to us. This policy explains what data we collect,
            why we collect it, and how you can control it.
          </p>
        </div>

        {/* Content card */}
        <div className="glass rounded-[28px] p-8 sm:p-10 space-y-10">

          <Section id="overview" title="1. Overview">
            <p>
              Vanni (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;) operates a browser-based real-time
              messaging platform accessible at this website. This Privacy Policy describes how
              we collect, use, store, and protect your personal information when you use the
              Vanni service.
            </p>
            <p>
              By creating an account or using Vanni, you agree to the data practices described
              in this policy. If you do not agree, please do not use the service.
            </p>
          </Section>

          <Section id="data-collected" title="2. Data We Collect">
            <p>We collect only the minimum information necessary to provide the service:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-ink">Account data:</strong> Your display name, email
                address, and a BCrypt-hashed version of your password. We never store your
                password in plain text.
              </li>
              <li>
                <strong className="text-ink">Profile data:</strong> An optional &ldquo;about&rdquo;
                bio and a profile photo you choose to upload.
              </li>
              <li>
                <strong className="text-ink">Message data:</strong> Text messages, attachments
                (images, PDFs), and associated metadata (timestamps, read receipts) you send
                or receive within the platform.
              </li>
              <li>
                <strong className="text-ink">Presence data:</strong> Online/offline status and
                last-seen timestamps, subject to your privacy settings.
              </li>
              <li>
                <strong className="text-ink">Session data:</strong> HttpOnly, Secure JWT access
                and refresh tokens stored in cookies — never in localStorage or sessionStorage.
              </li>
              <li>
                <strong className="text-ink">Log data:</strong> Standard server access logs
                (IP address, browser user-agent, request path, timestamp) retained for up to
                30 days for security and debugging purposes.
              </li>
            </ul>
            <p>
              We do <strong className="text-ink">not</strong> collect payment information,
              sell your data to third parties, or run advertising on the platform.
            </p>
          </Section>

          <Section id="how-we-use" title="3. How We Use Your Data">
            <p>Your data is used exclusively to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Authenticate and maintain your session securely.</li>
              <li>Deliver messages and attachments to your recipients in real time.</li>
              <li>Show presence status and typing indicators (if enabled in your settings).</li>
              <li>Allow you to search for other users by name or email.</li>
              <li>Enforce security controls (rate limiting, CSRF protection, block lists).</li>
              <li>Debug and improve the service using anonymised log data.</li>
            </ul>
          </Section>

          <Section id="data-storage" title="4. Data Storage and Retention">
            <p>
              All data is stored in a MySQL database hosted within a private network. Access to
              the database is restricted to the backend application and authorised administrators.
            </p>
            <p>
              <strong className="text-ink">Retention periods:</strong>
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Account and profile data: retained for the life of your account.</li>
              <li>Messages and attachments: retained until you delete them or delete your account.</li>
              <li>Server logs: retained for up to 30 days then automatically purged.</li>
              <li>Revoked refresh tokens: retained for 7 days then purged.</li>
            </ul>
            <p>
              We do not transfer your data outside the jurisdiction in which the service operates
              unless required by law.
            </p>
          </Section>

          <Section id="cookies" title="5. Cookies and Tokens">
            <p>
              Vanni uses two HttpOnly, Secure, SameSite=Lax cookies to maintain your session:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-ink">access_token</strong> — a short-lived JWT
                (default: 15 minutes) used to authenticate API requests.
              </li>
              <li>
                <strong className="text-ink">refresh_token</strong> — a longer-lived token
                (default: 7 days) used to silently obtain a new access token.
              </li>
            </ul>
            <p>
              An anti-CSRF token (XSRF-TOKEN) is also set as a readable cookie so the browser
              can include it in state-changing requests. We do not use tracking cookies,
              advertising cookies, or third-party analytics cookies.
            </p>
          </Section>

          <Section id="sharing" title="6. Data Sharing">
            <p>
              We do not sell, rent, or trade your personal information. We may share data
              only in these limited circumstances:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-ink">With other users:</strong> Your display name,
                profile photo, and presence status are visible to users you communicate with
                (subject to your privacy settings).
              </li>
              <li>
                <strong className="text-ink">Legal requirements:</strong> If required by
                applicable law, court order, or governmental authority, we may disclose
                information to the extent required.
              </li>
              <li>
                <strong className="text-ink">Service providers:</strong> We may engage
                infrastructure providers (hosting, storage) who process data on our behalf
                under strict confidentiality agreements.
              </li>
            </ul>
          </Section>

          <Section id="your-rights" title="7. Your Rights">
            <p>Depending on your jurisdiction, you may have the following rights:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-ink">Access:</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong className="text-ink">Rectification:</strong> Correct inaccurate data via your profile settings.</li>
              <li><strong className="text-ink">Erasure:</strong> Request deletion of your account and associated data.</li>
              <li><strong className="text-ink">Portability:</strong> Request your message history in a machine-readable format.</li>
              <li><strong className="text-ink">Restriction:</strong> Ask us to stop processing your data in certain circumstances.</li>
              <li><strong className="text-ink">Objection:</strong> Object to processing based on legitimate interests.</li>
            </ul>
            <p>
              To exercise any of these rights, email us at{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-accent-text hover:underline focus-accent rounded"
              >
                {CONTACT_EMAIL}
              </a>
              . We will respond within 30 days.
            </p>
          </Section>

          <Section id="security" title="8. Security">
            <p>
              We implement industry-standard security measures including:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Passwords hashed with BCrypt (cost factor 12).</li>
              <li>All traffic encrypted via TLS.</li>
              <li>HttpOnly cookies to prevent XSS token theft.</li>
              <li>CSRF tokens on all state-changing requests.</li>
              <li>Rate limiting on authentication endpoints.</li>
              <li>Input validation and parameterised SQL queries to prevent injection.</li>
            </ul>
            <p>
              No system is 100% secure. If you discover a security vulnerability, please
              report it responsibly to <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent-text hover:underline focus-accent rounded">{CONTACT_EMAIL}</a>.
            </p>
          </Section>

          <Section id="children" title="9. Children">
            <p>
              Vanni is not directed at children under the age of 13 (or the applicable minimum
              age in your jurisdiction). We do not knowingly collect personal information from
              children. If you believe a child has provided us with personal data, please
              contact us and we will delete it promptly.
            </p>
          </Section>

          <Section id="changes" title="10. Changes to This Policy">
            <p>
              We may update this policy from time to time. When we do, we will update the
              &ldquo;Last updated&rdquo; date at the top of this page and, for material changes, notify
              you via the platform or email. Continued use of the service after changes are
              posted constitutes acceptance of the revised policy.
            </p>
          </Section>

          <Section id="contact" title="11. Contact Us">
            <p>
              Questions or concerns about this policy? Please reach out:
            </p>
            <div className="glass-subtle rounded-2xl p-5 mt-2 space-y-1">
              <p><strong className="text-ink">Vanni</strong></p>
              <p>
                Email:{' '}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-accent-text hover:underline focus-accent rounded"
                >
                  {CONTACT_EMAIL}
                </a>
              </p>
            </div>
          </Section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--glass-border)] px-4 sm:px-6 py-6">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-ink-muted">&copy; {new Date().getFullYear()} Vanni. All rights reserved.</p>
          <nav className="flex gap-5 text-xs text-ink-muted">
            <Link to="/" className="hover:text-ink transition-colors focus-accent rounded">Home</Link>
            <Link to="/terms" className="hover:text-ink transition-colors focus-accent rounded">Terms of Service</Link>
            <Link to="/login" className="hover:text-ink transition-colors focus-accent rounded">Sign In</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
