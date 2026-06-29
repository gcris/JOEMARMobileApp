import { serve } from "std/http/server";
import { createClient } from "@supabase/supabase-js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

serve(async (req) => {
  try {
    // 1. Get the newly inserted row data from the database webhook payload
    const payload = await req.json();
    console.log(
      "📦 Incoming Webhook Payload Received:",
      JSON.stringify(payload),
    );

    // Supabase webhooks wrap the database row inside 'record'
    const record = payload.record;

    if (!record || !record.personnel_id) {
      console.log("⚠️ Missing record or personnel_id in payload structure.");
      return new Response(
        JSON.stringify({ message: "No actionable record found" }),
        { status: 200 },
      );
    }

    // 2. Initialize Supabase Admin Client using system environment keys
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 3. Fetch the sender's details to build a helpful alert message
    const { data: sender, error: senderError } = await supabaseAdmin
      .from("personnel")
      .select("phone_number, unit_id, fullname, rank:rank_id(rank_name)")
      .eq("id", record.personnel_id)
      .single();

    if (senderError) {
      console.error(
        "❌ Error fetching sender details from database:",
        senderError,
      );
    }

    const rankData = sender?.rank as unknown as { rank_name: string } | null;
    const rankPrefix = rankData?.rank_name || "Officer";

    const senderName = `${rankPrefix} ${sender?.fullname || "Unknown"}`;
    console.log(`📣 Extracted Sender Profile Name: ${senderName}`);

    // 4. Get push tokens for all OTHER personnel devices
    const { data: recipients, error: dbError } = await supabaseAdmin
      .from("personnel")
      .select("expo_push_token")
      .eq("unit_id", sender.unit_id)
      .neq("id", record.personnel_id) // 🔒 Skips the officer who sent the SOS
      .not("expo_push_token", "is", null);

    if (dbError) throw dbError;

    const tokens =
      recipients?.map((r) => r.expo_push_token).filter(Boolean) || [];

    console.log(
      `🎯 Recipient Token Pool Found: ${tokens.length} target devices.`,
    );

    if (tokens.length === 0) {
      console.log(
        "ℹ️ Request halted: 0 valid recipient tokens are registered in the database.",
      );
      return new Response("No target push tokens found.", { status: 200 });
    }

    // 5. Construct the Expo Push Notification Payload
    const messages = tokens.map((token) => ({
      to: token,
      title: "DISTRESS SIGNAL TRIGGERED",
      body: `${senderName} needs immediate assistance! Tap to view details.`,
      priority: "high",
      sound: "sos_alert.wav",
      channelId: "emergency-alerts-v4", // Matches your high-importance Android channel configuration
      _id: "@inppo/pnp-geo-tracker-rn",

      // 💡 NEW: Tells the phone to overlay the custom button category layout
      categoryId: "sos-actions",

      data: {
        type: "sos-incoming-alert",
        latitude: record.latitude, // Passed securely so the app's tap handler can read it
        longitude: record.longitude,
        senderName: senderName,
        phone_number: sender.phone_number,
      },
    }));

    // 6. Forward the payloads directly to Expo's Push servers
    console.log(
      `🚀 Dispatching push payloads over to Expo Gateway for ${tokens.length} recipients...`,
    );
    console.log("🚀 Sending to Expo:");
    console.log(JSON.stringify(messages, null, 2));
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(messages),
    });

    console.log(`📡 Expo API Response Code Status: ${response.status}`);
    const result = await response.json();
    console.log("📦 Expo Delivery Receipts:", JSON.stringify(result));

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("💥 Critical Function Failure:", error.message);

    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }
});
