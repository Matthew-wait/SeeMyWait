import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock } from "lucide-react";

const TermsPage = () => {
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
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-sm text-white/30 mb-10">Last updated: March 13, 2026</p>

        <div className="space-y-8 text-sm leading-relaxed">
          <Section title="1. Acceptance of Terms">
            By accessing or using the SeeMyWait application ("Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
          </Section>

          <Section title="2. Description of Service">
            SeeMyWait provides real-time, crowd-sourced wait time information for healthcare doctor offices. Users can view estimated wait times and submit wait time reports based on their in-person experiences. The Service uses location verification to ensure the accuracy of reports.
          </Section>

          <Section title="3. User Conduct">
            You agree to:
            <ul className="list-disc pl-6 mt-2 space-y-1 text-white/50">
              <li>Provide accurate and truthful wait time reports only when physically present at a doctor office.</li>
              <li>Not attempt to manipulate, spam, or submit fraudulent reports.</li>
              <li>Not interfere with or disrupt the Service or its infrastructure.</li>
              <li>Not use the Service for any unlawful purpose.</li>
            </ul>
          </Section>

          <Section title="4. Location Data">
            The Service requires access to your device's location to verify proximity to doctor offices. Location data is used solely for report verification and is not stored beyond the scope of the reporting process. You may deny location access, but this will limit your ability to submit reports.
          </Section>

          <Section title="5. Accuracy Disclaimer">
            Wait time information is crowd-sourced and provided "as is." SeeMyWait does not guarantee the accuracy, completeness, or timeliness of any wait time data. Wait times may vary and should be used as estimates only. We are not responsible for decisions made based on this information.
          </Section>

          <Section title="6. Intellectual Property">
            All content, trademarks, and data on the Service are the property of SeeMyWait or its licensors. You may not reproduce, distribute, or create derivative works from any part of the Service without prior written consent.
          </Section>

          <Section title="7. Limitation of Liability">
            To the maximum extent permitted by law, SeeMyWait shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from or related to your use of the Service, including but not limited to delays in receiving medical care.
          </Section>

          <Section title="8. Modifications">
            We reserve the right to modify these Terms at any time. Continued use of the Service after changes constitutes acceptance of the updated Terms. We will notify users of material changes through the application.
          </Section>

          <Section title="9. Termination">
            We may suspend or terminate your access to the Service at our discretion, without notice, for conduct that we believe violates these Terms or is harmful to other users of the Service.
          </Section>

          <Section title="10. Contact">
            If you have any questions about these Terms of Service, please contact us at{" "}
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
            <button onClick={() => navigate("/privacy")} className="text-white/30 hover:text-white/60 transition-colors">Privacy Policy</button>
            <span className="text-white/10">·</span>
            <span className="text-white/40">Terms of Service</span>
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

export default TermsPage;
