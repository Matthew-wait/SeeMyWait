import { createHash, randomBytes } from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;
const SITE_URL = process.env.SITE_URL || "https://www.seemywait.com";
const FROM = process.env.RESET_FROM || "SeeMyWait <no-reply@seemywait.com>";
const COOLDOWN_MS = 60 * 1000;
const TOKEN_TTL_MS = 60 * 60 * 1000;

const sbHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" };
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const resetEmailHtml = (link) => `
<div style="font-family:Arial,sans-serif;color:#14211c;max-width:520px">
  <h2 style="margin:0 0 12px">Reset your admin password</h2>
  <p style="color:#57685f">Use the button below to choose a new password for the SeeMyWait admin dashboard. The link works once and expires in one hour.</p>
  <p><a href="${link}" style="display:inline-block;background:#0e7a54;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Choose a new password</a></p>
  <p style="color:#57685f;font-size:12px">If you did not ask for this, you can ignore this email. Your password stays the same.</p>
</div>`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Always answer the same way, so this endpoint does not reveal which emails are admins.
  const reply = () => res.status(200).json({ ok: true });

  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email.includes("@")) return reply();

  try {
    const lookup = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_user_id_by_email`, {
      method: "POST",
      headers: sbHeaders,
      body: JSON.stringify({ p_email: email }),
    });
    if (!lookup.ok) throw new Error(`lookup ${lookup.status}`);
    const userId = await lookup.json();
    if (!userId) return reply();

    // One email per minute per admin, so the resend button cannot be used to flood an inbox.
    const since = new Date(Date.now() - COOLDOWN_MS).toISOString();
    const recent = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_password_resets?user_id=eq.${userId}&created_at=gt.${encodeURIComponent(since)}&select=id&limit=1`,
      { headers: sbHeaders }
    ).then((r) => r.json());
    if (Array.isArray(recent) && recent.length) return reply();

    const token = randomBytes(32).toString("base64url");
    const insert = await fetch(`${SUPABASE_URL}/rest/v1/admin_password_resets`, {
      method: "POST",
      headers: { ...sbHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({
        user_id: userId,
        token_hash: sha256(token),
        expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
      }),
    });
    if (!insert.ok) throw new Error(`insert ${insert.status}`);

    const link = `${SITE_URL}/admin/reset?token=${token}`;
    const mail = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [email], subject: "Reset your SeeMyWait admin password", html: resetEmailHtml(link) }),
    });
    if (!mail.ok) throw new Error(`resend ${mail.status}`);

    return reply();
  } catch (err) {
    console.error("password reset request failed", err);
    return res.status(500).json({ error: "We could not send the email. Please try again in a minute." });
  }
}
