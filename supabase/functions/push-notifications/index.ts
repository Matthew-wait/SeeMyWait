// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.23.0"


serve(async (req) => {
  try {
    const payload = await req.json();
    const { record } = payload; // This is the inserted wait_time_report
    
    if (!record) {
      return new Response(JSON.stringify({ error: "No record found" }), { status: 400 });
    }

    const { clinic_id, wait_time } = record;

    // Connect to Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? "";
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch clinic name
    const { data: clinic } = await supabase
      .from('clinics')
      .select('name')
      .eq('id', clinic_id)
      .single();

    if (!clinic) {
      return new Response(JSON.stringify({ error: "Clinic not found" }), { status: 404 });
    }

    // 2. Fetch all active push tokens
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('push_token');

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ message: "No active push tokens" }), { status: 200 });
    }

    const expoPushTokens = tokens.map(t => t.push_token);

    // 3. Construct notifications payload
    const messages = expoPushTokens.map(token => ({
      to: token,
      sound: 'default',
      title: 'Wait Time Updated! ⏱️',
      body: `${clinic.name} wait time has been updated to "${wait_time}".`,
      data: { clinicId: clinic_id },
    }));

    // 4. Send to Expo Push Service
    const response = await fetch('https://api.expo.dev/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    return new Response(JSON.stringify({ success: true, result }), { status: 200 });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
})
