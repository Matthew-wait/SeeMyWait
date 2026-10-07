const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, accept, x-supabase-api-version",
  "Access-Control-Max-Age": "86400",
};

/**
 * `send-email` — Resend wrapper, shared by web + mobile.
 *
 * Two request shapes:
 *  1. Raw:    { to, subject, html }                       — caller supplies everything
 *  2. Action: { action, ...fields }                       — the function picks the
 *             recipient (ADMIN_EMAIL for admin notes, `to` for user replies) and
 *             builds the HTML, so no inbox address lives in client code.
 *
 * Actions: "clinic_suggestion", "feedback_admin", "feedback_thank_you", "landing_contact"
 *          (aliases accepted: "clinic_suggestion_created", "feedback_admin_notification")
 *
 * Secrets: RESEND_API_KEY, RESEND_FROM, ADMIN_EMAIL
 */

type Body = {
  to?: string;
  subject?: string;
  html?: string;
  action?: string;
  // action fields
  doctor_name?: string;
  specialty?: string;
  address?: string;
  phone?: string;
  clinic_type?: string;
  latitude?: string | number;
  longitude?: string | number;
  email?: string | null;
  message?: string;
  name?: string;
};

/** Fixed destination for the public landing page's contact form, independent of ADMIN_EMAIL. */
const LANDING_CONTACT_EMAIL = "seemywait@gmail.com";

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function shell(title: string, inner: string): string {
  const year = new Date().getFullYear();
  return `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;">
    <h2 style="margin:0 0 4px;font-size:18px;">${esc(title)}</h2>
    <p style="margin:0 0 16px;color:#64748b;font-size:13px;">SeeMyWait — Live Wait Times, Smarter Visits</p>
    ${inner}
    <p style="margin:20px 0 0;color:#94a3b8;font-size:11px;">SeeMyWait · ${year}</p>
  </div>`;
}

function row(label: string, value: unknown): string {
  return `<tr>
    <td style="padding:6px 0;color:#64748b;font-size:13px;width:150px;vertical-align:top;">${esc(label)}</td>
    <td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;">${esc(value) || "—"}</td>
  </tr>`;
}

function buildEmail(body: Body, adminEmail: string):
  | { to: string; subject: string; html: string }
  | { error: string; status: number } {
  const action = (body.action || "").trim();

  if (action === "clinic_suggestion" || action === "clinic_suggestion_created") {
    if (!adminEmail) return { error: "ADMIN_EMAIL not configured", status: 500 };
    const html = shell(
      "New Doctor Office Suggestion",
      `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        ${row("Name", body.doctor_name)}
        ${row("Address", body.address)}
        ${row("Type", body.clinic_type)}
        ${row("Specialty", body.specialty)}
        ${row("Phone", body.phone)}
        ${body.latitude != null ? row("Latitude", body.latitude) : ""}
        ${body.longitude != null ? row("Longitude", body.longitude) : ""}
      </table>`,
    );
    return { to: adminEmail, subject: "New Doctor Office Suggestion • SeeMyWait", html };
  }

  if (action === "feedback_admin" || action === "feedback_admin_notification") {
    if (!adminEmail) return { error: "ADMIN_EMAIL not configured", status: 500 };
    const html = shell(
      "New Feedback / Support Message",
      `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:12px;">
        ${row("From", body.email || "Not provided")}
      </table>
      <div style="padding:14px;background:#f8fbff;border:1px solid #dbe7f3;border-radius:10px;">
        <div style="font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;">Message</div>
        <div style="font-size:15px;line-height:1.7;">${esc(body.message).replace(/\n/g, "<br/>")}</div>
      </div>`,
    );
    return { to: adminEmail, subject: "New Support Message • SeeMyWait", html };
  }

  if (action === "landing_contact") {
    const html = shell(
      "New Message from the Website",
      `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:12px;">
        ${row("Name", body.name || "Not provided")}
        ${row("Email", body.email || "Not provided")}
      </table>
      <div style="padding:14px;background:#f8fbff;border:1px solid #dbe7f3;border-radius:10px;">
        <div style="font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;">Message</div>
        <div style="font-size:15px;line-height:1.7;">${esc(body.message).replace(/\n/g, "<br/>")}</div>
      </div>
      <p style="margin:14px 0 0;font-size:12px;color:#94a3b8;">Sent from the "Let's Connect" form on seemywait.com.</p>`,
    );
    return { to: LANDING_CONTACT_EMAIL, subject: "New Website Contact Message • SeeMyWait", html };
  }

  if (action === "feedback_thank_you") {
    const to = String(body.to || "").trim();
    if (!to) return { error: "feedback_thank_you needs `to`", status: 400 };
    return {
      to,
      subject: "We received your message • SeeMyWait",
      html: shell(
        "Thanks for contacting us",
        `<p style="font-size:15px;line-height:1.7;">We received your message and our team will review it shortly. You don't need to do anything else.</p>`,
      ),
    };
  }

  return { error: `Unknown action: ${action || "(none)"}`, status: 400 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed. Use POST." }, 405);

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFrom = Deno.env.get("RESEND_FROM");
    const adminEmail = (Deno.env.get("ADMIN_EMAIL") || "").trim();

    if (!resendApiKey || !resendFrom) {
      return json({ error: "Missing RESEND_API_KEY or RESEND_FROM environment variable." }, 500);
    }

    const body = (await req.json()) as Body;

    let to: string;
    let subject: string;
    let html: string;

    if (body.action) {
      const built = buildEmail(body, adminEmail);
      if ("error" in built) return json({ success: false, error: built.error }, built.status);
      ({ to, subject, html } = built);
    } else {
      to = String(body.to || "").trim();
      subject = String(body.subject || "").trim();
      html = String(body.html || "").trim();
      if (!to) return json({ error: "Required field: to (or action)." }, 400);
      if (!subject || !html) {
        return json({ error: "For raw emails, subject and html are required." }, 400);
      }
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: resendFrom, to: [to], subject, html }),
    });
    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      return json(
        { success: false, error: "Failed to send email via Resend.", details: resendData },
        resendResponse.status,
      );
    }
    return json({ success: true, message: "Email sent successfully.", data: resendData });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ success: false, error: message }, 500);
  }
});
