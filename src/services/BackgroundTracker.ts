import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { insertPersonnelLog } from "./database";
import { Linking, Platform, Vibration } from "react-native";

// Configure how notifications should be handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// 2. 🚨 CRITICAL ANDROID FIX: Synchronize Category Registration at Startup
export async function registerNotificationLayouts() {
  try {
    // Register action category layouts for incoming SOS signals
    await Notifications.setNotificationCategoryAsync("sos-actions", [
      {
        identifier: "get-directions-action",
        buttonTitle: "Get Direction",
        options: { opensAppToForeground: true },
      },
      {
        identifier: "close-action",
        buttonTitle: "Close",
        options: { opensAppToForeground: false },
      },
    ]);
    console.log(
      "✅ Custom notification category 'sos-actions' registered successfully.",
    );

    // Setup high importance system channels for Android
    if (Platform.OS === "android") {
      const existing = await Notifications.getNotificationChannelAsync(
        "emergency-alerts-v4",
      );

      if (!existing) {
        await Notifications.setNotificationChannelAsync("emergency-alerts-v4", {
          name: "DISTRESS SIGNAL",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#FF0000",
          sound: "sos_alert.wav",
          enableVibrate: true,
        });
      }
    }
  } catch (e) {
    console.warn("❌ Failed to initialize notification layouts:", e);
  }
}

// Run registration immediately upon module import
registerNotificationLayouts();

// ⚡ GLOBAL LISTENER FOR BACKGROUND NOTIFICATION ACTIONS
Notifications.addNotificationResponseReceivedListener(async (response) => {
  const { notification, actionIdentifier } = response;
  const data = notification.request.content?.data;

  console.log(
    "Received notification:",
    JSON.stringify(notification.request.content, null, 2),
  );

  if (!data) return;

  // ─── CASE 1: INCOMING SOS ALERTS FROM TEAMMATES ───
  if (data.type === "sos-incoming-alert") {
    const { latitude, longitude, senderName, phone_number } = data;

    // Store the SOS data in AsyncStorage for the App to display in modal
    try {
      await AsyncStorage.setItem(
        "@pnp_sos_alert_data",
        JSON.stringify({
          latitude,
          longitude,
          senderName: senderName,
          phone_number: phone_number,
        }),
      );
    } catch (e) {
      console.warn("Failed to store SOS alert data in AsyncStorage:", e);
    }

    // Handle Button Choices
    if (actionIdentifier === "get-directions-action") {
      const mapUrl =
        Platform.OS === "ios"
          ? `https://maps.apple.com/?daddr=${latitude},${longitude}`
          : `google.navigation:q=${latitude},${longitude}`;

      Linking.openURL(mapUrl).catch((err) => console.error(err));
    }

    if (actionIdentifier === "close-action") {
      Notifications.dismissNotificationAsync(notification.request.identifier);
    }
  }

  // // ─── CASE 2: ACTIVE PATROL NOTIFICATION TAP (AUTO-LOGIN REQUEST) ───
  // if (data.type === "patrol-notification-tap" && data.shouldAutoLogin) {
  //   try {
  //     console.log("ACTIVE PATROL NOTIFICATION TAP (AUTO-LOGIN REQUEST) ───");
  //     await AsyncStorage.setItem(
  //       "@pnp_sos_notification_data",
  //       JSON.stringify(data),
  //     );
  //   } catch (e) {
  //     console.warn("Failed to store notification metadata in AsyncStorage:", e);
  //   }
  // }
  // Note: "sos-button" is handled strictly in App.tsx now to prevent conflicts
});

export const LOCATION_TASK_NAME = "pnp-background-patrol-task";

export const formatManilaTimestamp = (isShiftActive: boolean): string => {
  const d = new Date();
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const manilaDate = new Date(utc);
  const pad = (num: number) => String(num).padStart(2, "0");

  if (isShiftActive) {
    manilaDate.setSeconds(manilaDate.getSeconds() + 30);
  }

  const yyyy = manilaDate.getFullYear();
  const MM = pad(manilaDate.getMonth() + 1);
  const dd = pad(manilaDate.getDate());
  const HH = pad(manilaDate.getHours());
  const mm = pad(manilaDate.getMinutes());
  const ss = pad(manilaDate.getSeconds());

  return `${yyyy}-${MM}-${dd}T${HH}:${mm}:${ss}Z`;
};

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("[Background GPS] Location task error:", error);
    return;
  }

  if (data) {
    const { locations } = data as any;
    if (!locations || !Array.isArray(locations) || locations.length === 0)
      return;

    const location = locations[0];
    const lat = location.coords.latitude;
    const lng = location.coords.longitude;
    const speed = location.coords.speed || 0.0;

    let attempt = 0;
    const maxAttempts = 3;
    let success = false;

    while (attempt < maxAttempts && !success) {
      try {
        const personnelId = await AsyncStorage.getItem(
          "@pnp_active_personnel_id",
        );
        if (personnelId) {
          const dutyType = await AsyncStorage.getItem("@pnp_duty_type");
          const log = {
            id: "bg-" + Math.random().toString(36).substring(2, 11),
            personnelId: personnelId,
            latitude: lat,
            longitude: lng,
            speed: speed,
            networkSignal: 0,
            dutyType: dutyType || "Foot Patrol",
            capturedAt: formatManilaTimestamp(false),
            isSynced: false,
          };

          await insertPersonnelLog(log);
          success = true;
        } else {
          break;
        }
      } catch (e) {
        attempt++;
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 2500));
        }
      }
    }
  }
});

export const startBackgroundUpdates = async (personnelId: string) => {
  const { status: foregroundStatus } =
    await Location.requestForegroundPermissionsAsync();
  if (foregroundStatus !== "granted")
    throw new Error("Foreground location permission denied");

  const { status: backgroundStatus } =
    await Location.requestBackgroundPermissionsAsync();
  if (backgroundStatus !== "granted")
    throw new Error("Background location permission denied");

  const isGpsEnabled = await Location.hasServicesEnabledAsync();
  if (!isGpsEnabled) throw new Error("System GPS is turned off.");

  try {
    const { status: notifStatus } =
      await Notifications.requestPermissionsAsync();
    if (notifStatus === "granted") {
      await Notifications.setNotificationCategoryAsync("patrol-session", [
        {
          identifier: "sos-button",
          buttonTitle: "SEND DISTRESS SIGNAL",
          options: { opensAppToForeground: true },
        },
      ]);
    }
  } catch (e) {
    console.warn("Failed to set notification category", e);
  }

  await AsyncStorage.setItem("@pnp_active_personnel_id", personnelId);
  await AsyncStorage.setItem("@pnp_shift_status", "ACTIVE");

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.BestForNavigation,
    activityType: Location.ActivityType.AutomotiveNavigation,
    timeInterval: 30000,
    distanceInterval: 0,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Project J.O.E.M.A.R. Active",
      notificationBody:
        "Patrol routing log is live. Pull down to access SOS button.",
      notificationColor: "#1E3A8A",
      categoryIdentifier: "patrol-session",
    } as any,
  });
};

export const stopBackgroundUpdates = async () => {
  await AsyncStorage.removeItem("@pnp_active_personnel_id");
  await AsyncStorage.removeItem("@pnp_duty_type");
  await AsyncStorage.setItem("@pnp_shift_status", "OFF_DUTY");

  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch (e) {
    console.warn("Failed to clear persistent local notifications", e);
  }

  const started =
    await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (started) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
};
