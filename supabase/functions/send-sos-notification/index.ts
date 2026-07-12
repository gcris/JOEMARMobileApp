import { serve } from "std/http/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleAuth } from "npm:google-auth-library";

const PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID")!;
const CLIENT_EMAIL = Deno.env.get("FIREBASE_CLIENT_EMAIL")!;
const PRIVATE_KEY = Deno.env.get("FIREBASE_PRIVATE_KEY")!.replace(/\\n/g, "\n");

const auth = new GoogleAuth({
  credentials: {
    client_email: CLIENT_EMAIL,
    private_key: PRIVATE_KEY,
  },
  projectId: PROJECT_ID,
  scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
});

async function getAccessToken() {
  const client = await auth.getClient();

  const token = await client.getAccessToken();

  if (!token.token) {
    throw new Error("Unable to obtain Google OAuth token.");
  }

  return token.token;
}

async function sendFCM(
  accessToken: string,
  fcmToken: string,
  title: string,
  body: string,
  data: Record<string, string>,
) {
  const payload = {
    message: {
      token: fcmToken,

      priority: "high",

      android: {
        priority: "high",
      },

      data: {
        title,
        body,
        type: "sos-incoming-alert",
        senderName: data.senderName,
        phone_number: data.phone_number ?? "",
        latitude: String(data.latitude),
        longitude: String(data.longitude),
      },
    },
  };

  console.log("========== ABOUT TO SEND ==========");
  console.log(JSON.stringify(payload, null, 2));
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  const result = await response.text();

  console.log("FCM Response:");
  console.log(result);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}\n${result}`);
  }

  return result;
}

serve(async (req) => {
  try {
    // 1. Get the payload from patrol_logs

    const payload = await req.json();
    const record = payload.record;

    if (record.duty_type !== "EMERGENCY_SOS") {
      return new Response(
        JSON.stringify({
          success: true,
          remarks: "Not an SOS event.",
        }),
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    const accessToken = await getAccessToken();

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
      .select("fcm_token")
      .eq("unit_id", sender.unit_id)
      .neq("id", record.personnel_id) // 🔒 Skips the officer who sent the SOS
      .not("fcm_token", "is", null);

    if (dbError) throw dbError;

    const tokens = recipients?.map((r) => r.fcm_token).filter(Boolean) || [];

    if (tokens.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          remarks: "No FCM recipients.",
        }),
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    for (const token of tokens) {
      await sendFCM(
        accessToken,
        token,
        "DISTRESS SIGNAL",
        `${senderName} needs immediate assistance!`,
        {
          type: "sos-incoming-alert",
          senderName,
          latitude: String(record.latitude),
          longitude: String(record.longitude),
          phone_number: sender.phone_number ?? "",
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        remarks: "Sent all to receivers.",
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (e) {
    console.error(e);

    return new Response(
      JSON.stringify({
        success: false,
        error: String(e),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
});
