import { serve } from "std/http/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleAuth } from "npm:google-auth-library";

// ============================================================
// 1. ENVIRONMENT VARIABLES
// ============================================================

const PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID");
const CLIENT_EMAIL = Deno.env.get("FIREBASE_CLIENT_EMAIL");
const PRIVATE_KEY = Deno.env.get("FIREBASE_PRIVATE_KEY")?.replace(/\\n/g, "\n");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (
  !PROJECT_ID ||
  !CLIENT_EMAIL ||
  !PRIVATE_KEY ||
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY
) {
  throw new Error("Missing required environment variables.");
}

// ============================================================
// 2. FIREBASE AUTHENTICATION
// ============================================================

const auth = new GoogleAuth({
  credentials: {
    client_email: CLIENT_EMAIL,
    private_key: PRIVATE_KEY,
  },
  projectId: PROJECT_ID,
  scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
});

async function getAccessToken(): Promise<string> {
  const client = await auth.getClient();
  const token = await client.getAccessToken();

  if (!token.token) {
    throw new Error("Unable to obtain Google OAuth token.");
  }

  return token.token;
}

// ============================================================
// 3. SUPABASE ADMIN CLIENT
// ============================================================

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ============================================================
// 4. SEND FIREBASE CLOUD MESSAGING NOTIFICATION
// ============================================================

async function sendFCM(
  accessToken: string,
  fcmToken: string,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<string> {
  const payload = {
    message: {
      token: fcmToken,
      android: {
        priority: "high",
      },
      data: {
        title,
        body,
        type: "sos-incoming-alert",
        senderName: data.senderName ?? "",
        phone_number: data.phone_number ?? "",
        latitude: data.latitude ?? "",
        longitude: data.longitude ?? "",
      },
    },
  };

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

  if (!response.ok) {
    console.error(`FCM request failed with HTTP ${response.status}:`, result);

    throw new Error(`FCM HTTP ${response.status}: ${result}`);
  }

  console.log("FCM notification accepted by Firebase.");

  return result;
}

// ============================================================
// 5. EDGE FUNCTION HANDLER
// ============================================================

serve(async (req: Request): Promise<Response> => {
  try {
    // Accept POST requests only.
    if (req.method !== "POST") {
      return Response.json(
        { success: false, error: "Method not allowed." },
        { status: 405 },
      );
    }

    // --------------------------------------------------------
    // A. Validate incoming webhook payload
    // --------------------------------------------------------

    let payload: any;

    try {
      payload = await req.json();
    } catch {
      return Response.json(
        { success: false, error: "Invalid JSON payload." },
        { status: 400 },
      );
    }

    const record = payload?.record;

    if (!record || !record.personnel_id) {
      return Response.json(
        {
          success: false,
          error: "Missing record or personnel_id.",
        },
        { status: 400 },
      );
    }

    // Ignore other patrol log events.
    if (record.duty_type !== "EMERGENCY_SOS") {
      return Response.json({
        success: true,
        remarks: "Not an SOS event.",
      });
    }

    console.log("Incoming SOS event:", {
      personnel_id: record.personnel_id,
      duty_type: record.duty_type,
    });

    // --------------------------------------------------------
    // B. Fetch the SOS sender's personnel details
    // --------------------------------------------------------

    const { data: sender, error: senderError } = await supabaseAdmin
      .from("personnel")
      .select("id, phone_number, unit_id, fullname, rank:rank_id(rank_name)")
      .eq("id", record.personnel_id)
      .maybeSingle();

    if (senderError) {
      console.error("Failed to fetch SOS sender:", senderError);

      return Response.json(
        {
          success: false,
          error: "Unable to fetch SOS sender.",
        },
        { status: 500 },
      );
    }

    if (!sender) {
      return Response.json(
        {
          success: false,
          error: "SOS sender was not found.",
        },
        { status: 404 },
      );
    }

    if (!sender.unit_id) {
      console.error("SOS sender has no assigned unit.");

      return Response.json(
        {
          success: false,
          error: "SOS sender has no assigned unit.",
        },
        { status: 400 },
      );
    }

    // --------------------------------------------------------
    // C. Build sender display name
    // --------------------------------------------------------

    const rankData = sender.rank as { rank_name: string } | null;

    const rankPrefix = rankData?.rank_name || "Officer";
    const senderName = `${rankPrefix} ${sender.fullname || "Unknown"}`;

    console.log("SOS sender:", senderName);
    console.log("SOS sender unit:", sender.unit_id);

    // --------------------------------------------------------
    // D. Find eligible recipients IN THE SAME UNIT ONLY
    // --------------------------------------------------------

    const { data: recipients, error: recipientsError } = await supabaseAdmin
      .from("personnel")
      .select("id, fcm_token")
      .eq("unit_id", sender.unit_id)
      .neq("id", record.personnel_id)
      .eq("is_approved", true)
      .eq("is_blocked", false)
      .not("fcm_token", "is", null);

    if (recipientsError) {
      console.error("Failed to fetch SOS recipients:", recipientsError);

      throw recipientsError;
    }

    // Remove empty and duplicate tokens.
    const tokens = [
      ...new Set(
        (recipients ?? [])
          .map((recipient) => recipient.fcm_token)
          .filter(
            (token): token is string =>
              typeof token === "string" && token.trim().length > 0,
          ),
      ),
    ];

    console.log("Eligible recipient token count:", tokens.length);

    if (tokens.length === 0) {
      return Response.json({
        success: true,
        remarks: "No eligible FCM recipients in the sender's unit.",
        recipientCount: 0,
      });
    }

    // --------------------------------------------------------
    // E. Obtain Firebase token and send notifications
    // --------------------------------------------------------

    const accessToken = await getAccessToken();

    const notificationData: Record<string, string> = {
      senderName,
      phone_number: sender.phone_number ?? "",
      latitude: record.latitude == null ? "" : String(record.latitude),
      longitude: record.longitude == null ? "" : String(record.longitude),
    };

    let sentCount = 0;
    const failedTokens: string[] = [];

    // Send individually so one failure doesn't stop the others.
    for (const token of tokens) {
      try {
        await sendFCM(
          accessToken,
          token,
          "DISTRESS SIGNAL",
          `${senderName} needs immediate assistance!`,
          notificationData,
        );

        sentCount++;
      } catch (error) {
        console.error("Failed to send SOS to an FCM token:", error);
        failedTokens.push(token);
      }
    }

    // --------------------------------------------------------
    // F. Return send results
    // --------------------------------------------------------

    console.log("SOS push notification results:", {
      unit_id: sender.unit_id,
      eligibleTokens: tokens.length,
      sentCount,
      failedCount: failedTokens.length,
    });

    return Response.json({
      success: failedTokens.length === 0,
      remarks:
        failedTokens.length === 0
          ? "SOS notifications sent successfully."
          : "SOS notifications sent with some failures.",
      recipientCount: tokens.length,
      sentCount,
      failedCount: failedTokens.length,
    });
  } catch (error) {
    console.error("SOS Edge Function error:", error);

    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});
