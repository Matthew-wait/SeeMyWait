import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock } from "lucide-react";

const PrivacyPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white/80">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0a0f1a]/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-4 sm:px-6">
          <button
            onClick={() => navigate("/")}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 transition-all hover:border-cyan-500/30 hover:text-cyan-400"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600">
              <Clock className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold text-white">SeeMyWait</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-20">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-sm text-white/30 mb-10">Last updated: March 13, 2026</p>

        <div className="space-y-8 text-sm leading-relaxed">
          <Section title="1. Information We Collect">
            <p className="mb-3">We collect the following types of information:</p>
            <ul className="list-disc pl-6 space-y-1 text-white/50">
              <li><strong className="text-white/70">Device Fingerprint:</strong> A unique identifier generated from your device to prevent duplicate or fraudulent reports. This is not linked to your personal identity.</li>
              <li><strong className="text-white/70">Location Data:</strong> Temporary geolocation data used solely to verify your proximity to a clinic when submitting a wait time report.</li>
              <li><strong className="text-white/70">Wait Time Reports:</strong> The wait time category you select and the clinic associated with your report.</li>
            </ul>
          </Section>

          <Section title="2. How We Use Your Information">
            <ul className="list-disc pl-6 space-y-1 text-white/50">
              <li>To display real-time, crowd-sourced wait time estimates for clinics.</li>
              <li>To verify that reports are submitted from valid locations near clinics.</li>
              <li>To prevent abuse, spam, and fraudulent reporting.</li>
              <li>To improve the accuracy and reliability of the Service.</li>
            </ul>
          </Section>

          <Section title="3. Information We Do NOT Collect">
            <ul className="list-disc pl-6 space-y-1 text-white/50">
              <li>We do not collect your name, email address, or phone number.</li>
              <li>We do not require account creation or login.</li>
              <li>We do not store your precise GPS coordinates after report verification.</li>
              <li>We do not collect any health or medical information.</li>
            </ul>
          </Section>

          <Section title="4. Data Retention">
            Wait time reports are retained to calculate aggregate wait time trends. Device fingerprints are used for cooldown enforcement and fraud detection. Location data is processed in real-time and not permanently stored.
          </Section>

          <Section title="5. Data Sharing">
            We do not sell, trade, or rent your information to third parties. We may share anonymized, aggregated data for research or analytical purposes. We may disclose information if required by law or to protect the rights and safety of our users.
          </Section>

          <Section title="6. Cookies & Local Storage">
            The Service may use local storage to save your preferences (such as theme settings and radius preferences). We do not use tracking cookies or third-party analytics trackers.
          </Section>

          <Section title="7. Security">
            We implement reasonable technical and organizational measures to protect the information we process. However, no electronic transmission or storage method is 100% secure, and we cannot guarantee absolute security.
          </Section>

          <Section title="8. Children's Privacy">
            The Service is not intended for children under the age of 13. We do not knowingly collect information from children under 13.
          </Section>

          <Section title="9. Changes to This Policy">
            We may update this Privacy Policy from time to time. We will notify users of any material changes through the application. Your continued use of the Service after changes constitutes acceptance of the updated policy.
          </Section>

          <Section title="10. Contact Us">
            If you have any questions about this Privacy Policy, please contact us at{" "}
            <a href="mailto:contact@seemywait.com" className="text-cyan-400 hover:text-cyan-300 transition-colors">
              contact@seemywait.com
            </a>.
          </Section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/20">© {new Date().getFullYear()} SeeMyWait. All rights reserved.</p>
          <div className="flex gap-4 text-xs">
            <span className="text-white/40">Privacy Policy</span>
            <span className="text-white/10">·</span>
            <button onClick={() => navigate("/terms")} className="text-white/30 hover:text-white/60 transition-colors">Terms of Service</button>
          </div>
        </div>
      </footer>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h2 className="text-lg font-semibold text-white mb-3">{title}</h2>
    <div className="text-white/50">{children}</div>
  </div>
);

export default PrivacyPage;
