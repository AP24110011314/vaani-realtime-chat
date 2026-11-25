import { Link } from 'react-router'
import { ArrowLeft, FileText } from 'lucide-react'
import VanniLogo from '../components/common/VanniLogo'

const LAST_UPDATED = 'January 1, 2026'
const CONTACT_EMAIL = 'legal@vanni.app'

function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="text-xl font-bold text-ink heading-tight mb-3">{title}</h2>
      <div className="text-sm text-ink-muted leading-relaxed space-y-3">{children}</div>
    </section>
  )
}

export default function TermsPage() {
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
            <FileText className="w-7 h-7" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-ink heading-tight mb-2">
            Terms of Service
          </h1>
          <p className="text-sm text-ink-muted">
            Last updated: <strong className="text-ink">{LAST_UPDATED}</strong>
          </p>
          <p className="text-sm text-ink-muted mt-2 max-w-md mx-auto">
            Please read these terms carefully before using Vanni. By creating an account
            you agree to be bound by them.
          </p>
        </div>

        {/* Content card */}
        <div className="glass rounded-[28px] p-8 sm:p-10 space-y-10">

          <Section id="acceptance" title="1. Acceptance of Terms">
            <p>
              These Terms of Service (&ldquo;Terms&rdquo;) constitute a legally binding agreement between
              you and Vanni (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;) governing your access to and use of the
              Vanni platform, website, and services (collectively, the &ldquo;Service&rdquo;).
            </p>
            <p>
              By registering for an account or accessing the Service, you confirm that you are
              at least 13 years old (or the minimum age required in your jurisdiction), that
              you have read and understood these Terms, and that you agree to be bound by them.
            </p>
            <p>
              If you do not agree to these Terms, do not use the Service.
            </p>
          </Section>

          <Section id="account" title="2. Your Account">
            <p>
              To use Vanni you must create an account with a valid email address and a secure
              password. You are responsible for:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Keeping your credentials confidential and not sharing them with anyone.</li>
              <li>All activity that occurs under your account.</li>
              <li>Notifying us immediately at <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent-text hover:underline focus-accent rounded">{CONTACT_EMAIL}</a> if you suspect unauthorised access.</li>
              <li>Providing accurate and truthful registration information.</li>
            </ul>
            <p>
              We reserve the right to suspend or terminate accounts that violate these Terms
              or that we reasonably believe have been compromised.
            </p>
          </Section>

          <Section id="acceptable-use" title="3. Acceptable Use">
            <p>
              You agree to use the Service only for lawful purposes and in accordance with
              these Terms. You must <strong className="text-ink">not</strong>:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Use the Service to transmit any content that is unlawful, harmful, threatening, abusive, harassing, defamatory, obscene, or otherwise objectionable.</li>
              <li>Impersonate any person or entity, or falsely represent your affiliation with any person or entity.</li>
              <li>Attempt to gain unauthorised access to any part of the Service or its infrastructure.</li>
              <li>Use automated tools (bots, scrapers, crawlers) to access the Service without our prior written consent.</li>
              <li>Upload malware, viruses, or any other malicious code.</li>
              <li>Engage in spamming, phishing, or any form of unsolicited commercial communication.</li>
              <li>Use the Service to violate the privacy rights of others, including collecting or harvesting personal data without consent.</li>
              <li>Circumvent or attempt to circumvent any security or rate-limiting measures.</li>
              <li>Reverse-engineer, decompile, or disassemble any part of the Service.</li>
            </ul>
            <p>
              We reserve the right, but have no obligation, to monitor user-generated content.
              We may remove content and suspend or terminate accounts at our discretion for
              violations of these Terms.
            </p>
          </Section>

          <Section id="content" title="4. User-Generated Content">
            <p>
              You retain ownership of the content you create and share on Vanni (messages,
              files, profile information). By submitting content to the Service, you grant
              Vanni a limited, non-exclusive, royalty-free licence to store, process, and
              transmit that content solely as necessary to operate the Service.
            </p>
            <p>
              You represent and warrant that:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>You own or have the necessary rights to the content you submit.</li>
              <li>Your content does not infringe the intellectual property, privacy, or other rights of any third party.</li>
              <li>Your content complies with all applicable laws.</li>
            </ul>
            <p>
              We do not claim ownership of your content and will not use it for any purpose
              beyond operating the Service.
            </p>
          </Section>

          <Section id="ip" title="5. Intellectual Property">
            <p>
              All elements of the Vanni platform — including its software, design, logo,
              trademarks, and documentation — are the exclusive property of Vanni and are
              protected by copyright, trademark, and other applicable intellectual property laws.
            </p>
            <p>
              Nothing in these Terms grants you a right to use the Vanni name, logo, or other
              branding without our prior written permission.
            </p>
          </Section>

          <Section id="privacy" title="6. Privacy">
            <p>
              Your use of the Service is also governed by our{' '}
              <Link to="/privacy" className="text-accent-text hover:underline focus-accent rounded">
                Privacy Policy
              </Link>
              , which is incorporated into these Terms by reference. By using the Service, you
              consent to the data practices described in that policy.
            </p>
          </Section>

          <Section id="availability" title="7. Service Availability and Modifications">
            <p>
              We strive to keep the Service available 24/7 but we do not guarantee uninterrupted
              or error-free operation. We may:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Modify, suspend, or discontinue any part of the Service at any time with or without notice.</li>
              <li>Perform maintenance that temporarily takes the Service offline.</li>
              <li>Change features, pricing, or these Terms with reasonable notice.</li>
            </ul>
            <p>
              Continued use of the Service after changes to the Terms constitutes your
              acceptance of the revised Terms.
            </p>
          </Section>

          <Section id="disclaimer" title="8. Disclaimer of Warranties">
            <p>
              THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND,
              EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR
              UNINTERRUPTED ACCESS.
            </p>
            <p>
              We do not warrant that the Service will meet your requirements, that it will be
              secure or error-free, or that any defects will be corrected.
            </p>
          </Section>

          <Section id="liability" title="9. Limitation of Liability">
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, VANNI AND ITS AFFILIATES,
              OFFICERS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
              SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA,
              GOODWILL, OR OTHER INTANGIBLE LOSSES, ARISING FROM:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Your access to or use of (or inability to access or use) the Service.</li>
              <li>Any content transmitted through the Service.</li>
              <li>Unauthorised access to or alteration of your transmissions or data.</li>
              <li>Any other matter relating to the Service.</li>
            </ul>
            <p>
              In jurisdictions that do not allow the exclusion or limitation of liability for
              consequential or incidental damages, our liability is limited to the greatest
              extent permitted by law.
            </p>
          </Section>

          <Section id="indemnification" title="10. Indemnification">
            <p>
              You agree to indemnify, defend, and hold harmless Vanni and its affiliates,
              officers, employees, and agents from and against any claims, liabilities, damages,
              losses, costs, and expenses (including reasonable legal fees) arising out of or
              relating to your use of the Service, your content, or your violation of these Terms.
            </p>
          </Section>

          <Section id="termination" title="11. Termination">
            <p>
              You may delete your account at any time through your account settings, which will
              result in the deletion of your personal data in accordance with our Privacy Policy.
            </p>
            <p>
              We may suspend or terminate your access to the Service immediately, without prior
              notice or liability, if we determine that you have violated these Terms or for any
              other reason at our sole discretion.
            </p>
            <p>
              Upon termination, your right to use the Service will immediately cease. Sections
              5 (Intellectual Property), 8 (Disclaimer), 9 (Limitation of Liability), and
              10 (Indemnification) survive any termination.
            </p>
          </Section>

          <Section id="governing-law" title="12. Governing Law and Disputes">
            <p>
              These Terms shall be governed by and construed in accordance with applicable law,
              without regard to its conflict-of-law provisions. Any dispute arising from these
              Terms or the Service shall be resolved through good-faith negotiation. If that
              fails, disputes shall be subject to binding arbitration or the exclusive
              jurisdiction of the courts in the applicable jurisdiction.
            </p>
          </Section>

          <Section id="contact" title="13. Contact Us">
            <p>
              Questions about these Terms? Reach out to our legal team:
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
            <Link to="/privacy" className="hover:text-ink transition-colors focus-accent rounded">Privacy Policy</Link>
            <Link to="/login" className="hover:text-ink transition-colors focus-accent rounded">Sign In</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
