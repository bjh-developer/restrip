"use client";
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-warm-beige py-16 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="font-display text-5xl md:text-6xl font-bold text-soft-black mb-4">
            Privacy Policy
          </h1>
          <p className="font-body text-grey">
            Effective date: March 19, 2026 &nbsp;|&nbsp; Last updated: March 19,
            2026
          </p>
        </div>

        {/* Detailed Policy */}
        <div className="bg-white rounded-lg shadow-card p-8 md:p-12 space-y-8 font-body text-grey leading-relaxed">
          <section>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-soft-black mb-4">
              1. Introduction
            </h2>
            <p className="mb-4">
              Welcome to ReStrip. ReStrip (“we”, “us”, or “our”) is operated by
              Bek Joon Hao (“the Operator”), an individual based in Singapore.
              We operate the website restrip.app and any related mobile or
              desktop applications (collectively, the “Service”).
            </p>
            <p className="mb-4">
              This Privacy Policy explains how we collect, use, disclose, and
              protect your personal data in accordance with Singapore’s Personal
              Data Protection Act 2012 (No. 26 of 2012) (“PDPA”), as amended,
              and any regulations or advisory guidelines issued by the Personal
              Data Protection Commission (“PDPC”).
            </p>
            <p>
              By using our Service, you acknowledge that you have read and
              understood this Privacy Policy. If you do not agree, please
              discontinue use of the Service.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-soft-black mb-4">
              2. Definitions
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Personal Data</strong> means data, whether true or not,
                about an individual who can be identified from that data, or
                from that data and other information to which we have or are
                likely to have access.
              </li>
              <li>
                <strong>Processing</strong> means any operation performed on
                personal data, including collection, use, disclosure, storage,
                transfer, or deletion.
              </li>
              <li>
                <strong>Data Protection Officer (DPO)</strong> means the
                individual designated by ReStrip to oversee data protection
                compliance.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-soft-black mb-4">
              3. Personal Data We Collect
            </h2>
            <p className="mb-4">
              We collect personal data that you voluntarily provide to us and
              data that is automatically generated when you use the Service.
            </p>
            <h3 className="font-display text-xl font-semibold text-soft-black mb-2 mt-6">
              3.1 Data you provide
            </h3>
            <ul className="list-disc pl-5 mb-4 space-y-2">
              <li>
                <strong>Account information:</strong> name, email address, and
                password (managed via Clerk Authentication).
              </li>
              <li>
                <strong>Photo strips and images:</strong> photo booth strips you
                upload or that are delivered to you through the Service.
              </li>
              <li>
                <strong>Communications:</strong> messages or queries you send to
                us by email or through any support channel.
              </li>
            </ul>
            <h3 className="font-display text-xl font-semibold text-soft-black mb-2 mt-6">
              3.2 Data collected automatically
            </h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Device and usage data:</strong> IP address, browser
                type, operating system, and pages visited, collected via
                Cloudflare and Vercel analytics.
              </li>
              <li>
                <strong>Cookies and similar technologies:</strong> session
                identifiers and preference cookies. See Section 10 for details.
              </li>
              <li>
                <strong>Log data:</strong> server logs generated when our RunPod
                inference service processes your uploaded images.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-soft-black mb-4">
              4. Why We Collect Your Personal Data
            </h2>
            <p className="mb-4">
              We collect and use personal data only for the purposes described
              below, which we consider necessary to provide the Service or which
              you have consented to:
            </p>
            <ul className="list-disc pl-5 mb-4 space-y-2">
              <li>
                <strong>Account creation and management:</strong> to register
                your account, authenticate your identity, and maintain your
                profile.
              </li>
              <li>
                <strong>Service delivery:</strong> to receive, process, and
                deliver photo strip memories to you via email (powered by
                Resend) and through the in-app scrapbook editor.
              </li>
              <li>
                <strong>Image processing:</strong> to run our photo strip
                detection and cropping pipeline on images you upload.
              </li>
              <li>
                <strong>Customer support:</strong> to respond to your inquiries
                and resolve issues.
              </li>
              <li>
                <strong>Service improvement:</strong> to analyse aggregated
                usage patterns and improve the performance and features of the
                Service. This analysis uses anonymised or aggregated data
                wherever possible.
              </li>
              <li>
                <strong>Security and fraud prevention:</strong> to detect,
                investigate, and prevent fraudulent transactions, abuse, and
                other illegal activities.
              </li>
              <li>
                <strong>Legal compliance:</strong> to comply with applicable
                laws, regulations, and legal processes in Singapore.
              </li>
            </ul>
            <p>
              We will not use your personal data for any purpose not listed
              above without first notifying you and, where required, obtaining
              your consent.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-soft-black mb-4">
              5. Disclosure of Personal Data to Third Parties
            </h2>
            <p className="mb-4">
              We share personal data only to the extent necessary to operate the
              Service. Our current third-party service providers include:
            </p>
            <ul className="list-disc pl-5 mb-4 space-y-2">
              <li>
                <strong>Clerk (US):</strong> identity and authentication
                management.
              </li>
              <li>
                <strong>Supabase (US):</strong> database hosting and storage
                (PostgreSQL).
              </li>
              <li>
                <strong>Vercel (US):</strong> web hosting and edge network.
              </li>
              <li>
                <strong>Cloudflare (US):</strong> content delivery network and
                DDoS protection.
              </li>
              <li>
                <strong>RunPod (US):</strong> serverless GPU compute for image
                processing.
              </li>
              <li>
                <strong>Resend (US):</strong> transactional email delivery.
              </li>
            </ul>
            <p className="mb-4">
              Each of these providers acts as a data processor on our behalf. We
              have assessed or will assess each provider to ensure they maintain
              appropriate data protection standards comparable to those required
              under the PDPA, including through contractual safeguards.
            </p>
            <p className="mb-4">
              We do not sell, rent, or trade your personal data to any third
              party for their own marketing purposes.
            </p>
            <p>
              We may disclose personal data if required to do so by law, court
              order, or a government authority in Singapore, or if we reasonably
              believe disclosure is necessary to protect the rights, property,
              or safety of ReStrip, our users, or the public.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-soft-black mb-4">
              6. Transfer of Personal Data Outside Singapore
            </h2>
            <p className="mb-4">
              As our service providers are located outside Singapore (primarily
              in the United States), your personal data will be transferred to,
              stored in, and processed in countries outside Singapore. When we
              transfer personal data internationally, we take steps to ensure
              that the recipient provides a standard of protection comparable to
              that under the PDPA. These steps may include:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                Entering into binding contractual arrangements with the
                recipient that require them to maintain adequate data protection
                standards;
              </li>
              <li>
                Ensuring the recipient is subject to laws or regulations that
                provide comparable protection to the PDPA; or
              </li>
              <li>Obtaining your consent to the transfer.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-soft-black mb-4">
              7. Retention of Personal Data
            </h2>
            <p className="mb-4">
              We retain personal data only for as long as it is necessary to
              fulfil the purposes for which it was collected, or as required by
              applicable law. Our general retention periods are:
            </p>
            <ul className="list-disc pl-5 mb-4 space-y-2">
              <li>
                <strong>Account data:</strong> for the duration of your account.
              </li>
              <li>
                <strong>Photo strips and uploaded images:</strong> as specified
                in the Service settings or until you delete them. If no explicit
                retention preference is set, images are retained for an
                indefinite time after delivery.
              </li>
            </ul>
            <p>
              When personal data is no longer required, we will delete or
              anonymise it securely.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-soft-black mb-4">
              8. Protection of Personal Data
            </h2>
            <p className="mb-4">
              We implement reasonable technical and organisational security
              measures to protect your personal data against unauthorised
              access, disclosure, alteration, or destruction. These measures
              include:
            </p>
            <ul className="list-disc pl-5 mb-4 space-y-2">
              <li>AES-256-GCM encryption for sensitive data at rest.</li>
              <li>
                Row-Level Security (RLS) on our Supabase/PostgreSQL database,
                ensuring users can only access their own data.
              </li>
              <li>HTTPS/TLS encryption for all data in transit.</li>
              <li>
                Access controls limiting personal data access to authorised
                personnel only.
              </li>
              <li>Regular review of our security practices.</li>
            </ul>
            <p>
              While we take reasonable steps to protect your personal data, no
              method of transmission over the internet or electronic storage is
              100% secure. We cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-soft-black mb-4">
              9. Your Rights Under the PDPA
            </h2>
            <p className="mb-4">
              Subject to certain exceptions under the PDPA, you have the
              following rights in respect of your personal data held by us:
            </p>
            <h3 className="font-display text-xl font-semibold text-soft-black mb-2 mt-6">
              9.1 Right of Access
            </h3>
            <p className="mb-4">
              You may request access to the personal data we hold about you and
              information about how it has been used or disclosed in the past
              year. We will respond to your request within 30 calendar days of
              receipt, or notify you if more time is required.
            </p>
            <h3 className="font-display text-xl font-semibold text-soft-black mb-2 mt-6">
              9.2 Right of Correction
            </h3>
            <p className="mb-4">
              If you believe that any personal data we hold about you is
              inaccurate, incomplete, or misleading, you may request that we
              correct it. We will correct the data as soon as practicable.
            </p>
            <h3 className="font-display text-xl font-semibold text-soft-black mb-2 mt-6">
              9.3 Withdrawal of Consent
            </h3>
            <p className="mb-4">
              Where you have given consent to our processing of your personal
              data (for example, for marketing communications), you may withdraw
              that consent at any time. Withdrawal of consent will not affect
              the lawfulness of processing carried out before the withdrawal.
              Please note that withdrawing consent for certain purposes may
              affect our ability to provide the Service to you.
            </p>
            <p>
              To exercise any of the above rights, please contact our DPO at the
              details in Section 12. We may need to verify your identity before
              processing your request.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-soft-black mb-4">
              10. Cookies and Tracking Technologies
            </h2>
            <p className="mb-4">
              We use cookies and similar technologies on restrip.app. Cookies
              are small text files stored on your device that help us provide
              and improve the Service.
            </p>
            <h3 className="font-display text-xl font-semibold text-soft-black mb-2 mt-6">
              10.1 Types of cookies we use
            </h3>
            <ul className="list-disc pl-5 mb-4 space-y-2">
              <li>
                <strong>Strictly necessary cookies:</strong> required for the
                Service to function (e.g. authentication session cookies). These
                cannot be turned off.
              </li>
              <li>
                <strong>Analytics cookies:</strong> help us understand how users
                interact with the Service. We use aggregated, anonymised data
                for this purpose.
              </li>
              <li>
                <strong>Preference cookies:</strong> remember your settings and
                preferences.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-soft-black mb-4">
              11. Children’s Personal Data
            </h2>
            <p className="mb-4">
              The Service is not directed at children under the age of 13. We do
              not knowingly collect personal data from children under 13 without
              verified parental consent. If we become aware that we have
              inadvertently collected personal data from a child under 13
              without appropriate consent, we will take steps to delete that
              data promptly.
            </p>
            <p>
              Users aged 13 to 17 may use the Service, but we encourage parents
              and guardians to be involved in their use of the Service. In
              accordance with the PDPC’s Children’s Personal Data Guidelines, we
              take additional care to present information in a clear and
              age-appropriate manner for young users.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-soft-black mb-4">
              12. Data Breach Notification
            </h2>
            <p className="mb-4">
              In the event of a data breach involving your personal data that is
              likely to result in significant harm to you or is of a significant
              scale, we will:
            </p>
            <ul className="list-disc pl-5 mb-4 space-y-2">
              <li>
                Notify the PDPC as soon as practicable, and in any case within 3
                calendar days of assessing that the breach is notifiable, in
                accordance with the PDPA’s Mandatory Data Breach Notification
                requirement.
              </li>
              <li>
                Notify affected individuals as soon as practicable where the
                breach is likely to result in significant harm to them.
              </li>
            </ul>
            <p>
              We maintain internal incident response procedures to detect,
              assess, and respond to data breaches.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-soft-black mb-4">
              13. Contact Our Data Protection Officer
            </h2>
            <p className="mb-4">
              If you have any questions about this Privacy Policy, wish to
              exercise your data protection rights, or wish to make a complaint
              about how we have handled your personal data, please contact our
              DPO:
            </p>
            <ul className="mb-4 space-y-1">
              <li>
                <strong>Operated by:</strong> Bek Joon Hao
              </li>
              <li>
                <strong>Email:</strong> privacy@restrip.app
              </li>
            </ul>
            <p>
              We will acknowledge your request within 5 business days and
              respond substantively within 30 calendar days. If you are not
              satisfied with our response, you may lodge a complaint with the
              PDPC at{" "}
              <a
                href="https://www.pdpc.gov.sg"
                className="text-blush-pink hover:text-soft-black transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                www.pdpc.gov.sg
              </a>
              .
            </p>
          </section>

          <section className="pb-4">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-soft-black mb-4">
              14. Updates to This Privacy Policy
            </h2>
            <p className="mb-4">
              We may update this Privacy Policy from time to time to reflect
              changes in our practices, the Service, or applicable law. When we
              make material changes, we will notify you by:
            </p>
            <ul className="list-disc pl-5 mb-4 space-y-2">
              <li>
                Posting the updated Privacy Policy on restrip.app with a revised
                effective date; and
              </li>
              <li>
                Sending you an email notification if the change materially
                affects your rights or how we process your personal data.
              </li>
            </ul>
            <p>
              Your continued use of the Service after the effective date of any
              update constitutes your acceptance of the revised Privacy Policy.
              We encourage you to review this page periodically.
            </p>
          </section>

          <div className="pt-8 border-t border-mist-grey text-sm text-center">
            <p className="font-semibold text-soft-black mb-2">
              ReStrip &middot; restrip.app &middot; privacy@restrip.app
            </p>
          </div>
        </div>

        {/* Back Link */}
        <div className="mt-16 text-center">
          <Link
            href="/"
            className="inline-block bg-blush-pink text-soft-black rounded-lg px-8 py-3 font-body font-semibold hover:shadow-lg transition-all hover:bg-yellow-cream"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
