import { createHash } from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;

const sbHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" };
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = String(req.body?.token || "");
  const password = String(req.body?.password || "");
  if (!token) return res.status(400).json({ error: "This link is invalid." });
  if (password.length < 8) return res.status(400).json({ error: "Use at least 8 characters." });

  try {
    const now = new Date().toISOString();
    const rows = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_password_resets?token_hash=eq.${sha256(token)}&used_at=is.null&expires_at=gt.${encodeURIComponent(now)}&select=id,user_id&limit=1`,
      { headers: sbHeaders }
    ).then((r) => r.json());
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "This link is invalid or has expired. Request a new one." });
    }
    const { user_id } = rows[0];

    const update = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user_id}`, {
      method: "PUT",
      headers: sbHeaders,
      body: JSON.stringify({ password }),
    });
    if (!update.ok) throw new Error(`password update ${update.status}`);

    // Single use: retire every outstanding link for this admin.
    await fetch(`${SUPABASE_URL}/rest/v1/admin_password_resets?user_id=eq.${user_id}&used_at=is.null`, {
      method: "PATCH",
      headers: { ...sbHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ used_at: now }),
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("password reset confirm failed", err);
    return res.status(500).json({ error: "We could not save the password. Please try again." });
  }
}
