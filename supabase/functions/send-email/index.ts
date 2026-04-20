const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, accept, x-supabase-api-version",
  "Access-Control-Max-Age": "86400",
};

type SendEmailBody = {
  to?: string;
  subject?: string;
  html?: string;
  templateId?: string;
  variables?: Record<string, string | number | boolean | null>;
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405);
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFrom = Deno.env.get("RESEND_FROM");

    if (!resendApiKey || !resendFrom) {
      return jsonResponse(
        { error: "Missing RESEND_API_KEY or RESEND_FROM environment variable." },
        500
      );
    }

    const body = (await req.json()) as SendEmailBody;
    const to = String(body?.to || "").trim();
    const subject = String(body?.subject || "").trim();
    const html = String(body?.html || "").trim();
    const templateId = String(body?.templateId || "").trim();
    const variables = body?.variables ?? {};
    const hasTemplate = Boolean(templateId);

    if (!to) {
      return jsonResponse(
        { error: "Invalid payload. Required field: to." },
        400
      );
    }

    if (!hasTemplate && (!subject || !html)) {
      return jsonResponse(
        { error: "For non-template emails, required fields are: subject, html." },
        400
      );
    }

    const resendPayload: Record<string, unknown> = {
      from: resendFrom,
      to: [to],
    };

    if (hasTemplate) {
      resendPayload.template = {
        id: templateId,
        variables,
      };
      if (subject) resendPayload.subject = subject;
    } else {
      resendPayload.subject = subject;
      resendPayload.html = html;
    }

    let resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendPayload),
    });

    let resendData = await resendResponse.json();

    // If template send fails and html is provided, fall back to classic HTML send.
    if (!resendResponse.ok && hasTemplate && html && subject) {
      const fallbackPayload = {
        from: resendFrom,
        to: [to],
        subject,
        html,
      };
      resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fallbackPayload),
      });
      resendData = await resendResponse.json();
    }

    if (!resendResponse.ok) {
      return jsonResponse(
        {
          success: false,
          error: "Failed to send email via Resend.",
          details: resendData,
        },
        resendResponse.status
      );
    }

    return jsonResponse({
      success: true,
      message: "Email sent successfully.",
      data: resendData,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
