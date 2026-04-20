const APP_NAME = "SeeMyWait";
const APP_TAGLINE = "Live Wait Times, Smarter Visits";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function row(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:8px 0; color:#64748b; font-size:13px; width:160px; vertical-align:top;">
        ${escapeHtml(label)}
      </td>
      <td style="padding:8px 0; color:#0f172a; font-size:14px; font-weight:600;">
        ${escapeHtml(value)}
      </td>
    </tr>
  `;
}

function baseTemplate(title: string, intro: string, contentHtml: string): string {
  const year = new Date().getFullYear();
  return `
  <div style="margin:0; padding:0; background:#edf3f9; font-family:Inter,Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#edf3f9; padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px; background:#ffffff; border-radius:20px; overflow:hidden; border:1px solid #d6e2ee; box-shadow:0 8px 28px rgba(15,23,42,0.08);">
            <tr>
              <td style="height:6px; background:linear-gradient(90deg,#06b6d4 0%,#2563eb 60%,#1d4ed8 100%);"></td>
            </tr>
            <tr>
              <td style="padding:28px 28px 20px; background:#f6fbff; border-bottom:1px solid #dbe7f3;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="text-align:center;">
                  <tr>
                    <td style="vertical-align:middle; text-align:center; padding:0; line-height:1;">
                      <div style="display:inline-flex; align-items:center; gap:10px; margin:0 auto;">
                        <span style="display:inline-flex; height:34px; width:34px; border-radius:10px; background:linear-gradient(135deg,#06b6d4 0%,#2563eb 100%); color:#ffffff; text-align:center; line-height:34px; font-size:14px; font-weight:700;">⏱</span>
                        <span style="font-size:30px; color:#0f172a; font-weight:700; letter-spacing:0.2px; line-height:1;">${APP_NAME}</span>
                      </div>
                      <div style="margin-top:7px; font-size:13px; color:#64748b;">${APP_TAGLINE}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 28px 26px;">
                <h1 style="margin:0 0 8px; color:#0f172a; font-size:30px; line-height:1.25; text-align:center; font-weight:500;">${escapeHtml(title)}</h1>
                <p style="margin:0 0 20px; color:#64748b; font-size:18px; line-height:1.5; text-align:center;">${escapeHtml(intro)}</p>
                ${contentHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px; background:#f8fbff; border-top:1px solid #dbe7f3; color:#64748b; font-size:12px; text-align:center; line-height:1.5;">
                ${APP_NAME} Support | contact@seemywait.com | ${year}<br />
                <span style="color:#94a3b8;">You're receiving this because of activity in your SeeMyWait app usage.</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
  `;
}

export function buildSupportTicketAdminEmail(email: string, message: string): string {
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br />");
  return baseTemplate(
    "New Support Ticket",
    "A new support request was submitted from the app settings page.",
    `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; margin-bottom:14px;">
        ${row("From email", email || "Not provided")}
      </table>
      <div style="padding:16px; background:#f8fbff; border:1px solid #dbe7f3; border-radius:12px;">
        <div style="font-size:13px; color:#64748b; margin-bottom:8px; font-weight:600;">Message</div>
        <div style="font-size:15px; color:#0f172a; line-height:1.7;">${safeMessage}</div>
      </div>
    `
  );
}

export function buildSupportThankYouEmail(message: string): string {
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br />");
  return baseTemplate(
    "Thanks for contacting us",
    "We received your message and our team will review it shortly.",
    `
      <div style="padding:16px; background:#f8fbff; border:1px solid #dbe7f3; border-radius:12px;">
        <div style="font-size:13px; color:#64748b; margin-bottom:8px; font-weight:600;">Your message</div>
        <div style="font-size:15px; color:#0f172a; line-height:1.7;">${safeMessage}</div>
      </div>
      <p style="margin:18px 0 0; color:#64748b; font-size:13px; text-align:center;">Thank you for helping us improve SeeMyWait.</p>
      <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:18px; margin-left:auto; margin-right:auto;">
        <tr>
          <td style="border-radius:9999px; background:linear-gradient(135deg,#06b6d4 0%,#2563eb 100%); box-shadow:0 6px 16px rgba(37,99,235,0.25);">
            <a href="https://seemywait.com/app" style="display:inline-block; padding:10px 20px; color:#ffffff; font-size:13px; font-weight:700; text-decoration:none;">
              Open SeeMyWait
            </a>
          </td>
        </tr>
      </table>
    `
  );
}

export function buildClinicSuggestionAdminEmail(payload: {
  name: string;
  address: string;
  type: string;
  specialty: string;
  phone: string;
  latitude: string;
  longitude: string;
}): string {
  return baseTemplate(
    "New Clinic Suggestion",
    "A user submitted a new doctor/clinic request.",
    `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        ${row("Name", payload.name)}
        ${row("Address", payload.address)}
        ${row("Type", payload.type)}
        ${row("Specialty", payload.specialty)}
        ${row("Phone", payload.phone)}
        ${row("Latitude", payload.latitude)}
        ${row("Longitude", payload.longitude)}
      </table>
    `
  );
}
