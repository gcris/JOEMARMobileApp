import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { insertPersonnelLog } from "./database";

// Configure how notifications should be handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Handle notification taps and action button presses to trigger auto-login
const notificationResponseSubscription =
  Notifications.addNotificationResponseReceivedListener((response) => {
    const { notification, actionIdentifier } = response;
    const data = notification.request.content?.data;

    // Check if this is our patrol notification tap requesting auto-login
    // (actionIdentifier will be null for notification taps, or the button ID for action presses)
    if (
      data &&
      data.type === "patrol-notification-tap" &&
      data.shouldAutoLogin
    ) {
      // Store a flag in AsyncStorage to indicate auto-login is requested from notification
      AsyncStorage.setItem("@pnp_auto_login_requested", "true").catch(() => {});
      // Note: Actual auto-login logic will be handled in the app's startup/check
    }

    // Handle SOS button press from notification
    if (actionIdentifier === "sos-button") {
      // The SOS button is configured with opensAppToForeground: true,
      // so the app will open to foreground and we can trigger SOS there
      // Actual SOS triggering logic would be handled in the app UI
    }
  });

export const LOCATION_TASK_NAME = "pnp-background-patrol-task";

//Format Manila/Asia Timestamp matching yyyy-MM-dd'T'HH:mm:ss'Z' In GMT+8
export const formatManilaTimestamp = (isShiftActive: boolean): string => {
  const d = new Date();

  // Convert UTC format to Manila local offset
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const manilaDate = new Date(utc); // +8 hours
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

// export const formatManilaTimestamp = (): string => {
//   return new Date().toISOString();
// };

// Define Background Task (Expo Task Manager requires defineTask at the root file scope)
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  console.log(
    `[${new Date().toISOString()}] TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {`,
  );
  if (error) {
    console.error("[Background GPS] Location task error:", error);
    return;
  }

  if (data) {
    console.log("[Background GPS] Data received:", JSON.stringify(data));
    const { locations } = data as any;
    if (!locations) {
      console.warn("[Background GPS] Locations is undefined in data");
      return;
    }

    if (!Array.isArray(locations)) {
      console.warn("[Background GPS] Locations is not an array:", locations);
      return;
    }

    if (locations.length === 0) {
      console.log("[Background GPS] Locations array is empty");
      return;
    }

    console.log(`[Background GPS] Received ${locations.length} location(s)`);
    const location = locations[0];
    const lat = location.coords.latitude;
    const lng = location.coords.longitude;
    const speed = location.coords.speed || 0.0;

    console.log(
      `[Background GPS] Lat: ${lat}, Lng: ${lng}, Speed: ${speed} m/s`,
    );

    let attempt = 0;
    const maxAttempts = 3;
    let success = false;
    while (attempt < maxAttempts && !success) {
      try {
        const personnelId = await AsyncStorage.getItem(
          "@pnp_active_personnel_id",
        );
        console.log(
          "[Background GPS] personnelId from AsyncStorage: ",
          personnelId,
        );
        if (personnelId) {
          const log = {
            id: "bg-" + Math.random().toString(36).substring(2, 11),
            personnelId: personnelId,
            latitude: lat,
            longitude: lng,
            speed: speed,
            networkSignal: 0, // Default signal strength when not available from GPS
            dutyType: "Foot Patrol",
            capturedAt: formatManilaTimestamp(false),
            isSynced: false, // Initially not synced
          };

          await insertPersonnelLog(log);
          console.log(
            `[Background GPS] Successfully logged live background coordinate`,
          );
          success = true;
        } else {
          console.warn(
            "[Background GPS] No personnel ID found in AsyncStorage, breaking retry loop",
          );
          // No personnel ID, break out of retry loop
          break;
        }
      } catch (e) {
        attempt++;
        console.warn(
          `[Background GPS] Attempt ${attempt} failed to insert log:`,
          e,
        );
        if (attempt < maxAttempts) {
          // Wait for 1 second before retrying
          await new Promise((resolve) => setTimeout(resolve, 2500));
        } else {
          console.warn(
            "[Background GPS] Failed to insert background log in task manager after 3 attempts",
            e,
          );
        }
      }
    }
  } else {
    console.log("[Background GPS] No data received");
  }
});

// Configure and request background location updates
export const startBackgroundUpdates = async (personnelId: string) => {
  const { status: foregroundStatus } =
    await Location.requestForegroundPermissionsAsync();
  if (foregroundStatus !== "granted") {
    throw new Error("Foreground location permission denied");
  }

  const { status: backgroundStatus } =
    await Location.requestBackgroundPermissionsAsync();
  if (backgroundStatus !== "granted") {
    throw new Error("Background location permission denied");
  }

  // Double check if system location provider is enabled (GPS toggle)
  const isGpsEnabled = await Location.hasServicesEnabledAsync();
  if (!isGpsEnabled) {
    throw new Error(
      "System GPS/Location is currently turned off. Please enable device location.",
    );
  }

  // Request notifications permission and register Category
  try {
    const { status: notifStatus } =
      await Notifications.requestPermissionsAsync();
    if (notifStatus === "granted") {
      await Notifications.setNotificationCategoryAsync("patrol-session", [
        {
          identifier: "sos-button",
          buttonTitle: "🚨 TRIGGER CRITICAL SOS",
          options: {
            opensAppToForeground: true,
          },
        },
      ]);
    }
  } catch (e) {
    console.warn("Failed to set notification category/permissions", e);
  }

  // Save personnel ID so background task can query it even when app is closed/minimized
  await AsyncStorage.setItem("@pnp_active_personnel_id", personnelId);
  await AsyncStorage.setItem("@pnp_shift_status", "ACTIVE");

  // Trigger our sticky/ongoing local notification containing the interactive SOS action
  try {
    await Notifications.dismissAllNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      identifier: "active-patrol-notif",
      content: {
        title: "PNP Active Patrol Status",
        body: "Your foot beat coordinates are logging in the background. Press below for critical assistance.",
        categoryIdentifier: "patrol-session",
        sticky: true,
        autoDismiss: false,
        color: "#EF4444",
        // Data to identify when notification is tapped for auto-login
        data: {
          type: "patrol-notification-tap",
          shouldAutoLogin: true,
        },
      },
      trigger: null,
    });
  } catch (e) {
    console.warn("Failed to display persistent patrol notification", e);
  }

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.BestForNavigation,
    activityType: Location.ActivityType.AutomotiveNavigation,
    timeInterval: 30000, // battery optimized: every 30 seconds4
    distanceInterval: 0,
    pausesUpdatesAutomatically: false, // Prevents the OS from pausing updates when stationary
    showsBackgroundLocationIndicator: true, // Keeps the background task channel highly prioritized
    foregroundService: {
      notificationTitle: "INPPO Patrol Tracker",
      notificationBody: "You are currently on patrolling.",
      notificationColor: "#1E3A8A",
    },
  });
};

export const stopBackgroundUpdates = async () => {
  await AsyncStorage.removeItem("@pnp_active_personnel_id");
  await AsyncStorage.setItem("@pnp_shift_status", "OFF_DUTY");

  // Clear persistent local system notifications
  try {
    await Notifications.dismissNotificationAsync("active-patrol-notif");
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
