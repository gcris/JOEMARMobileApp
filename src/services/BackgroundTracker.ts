import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { insertPersonnelLog } from "./database";
import SignalStrengthModule from "./SignalStrengthModule";

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

    await AsyncStorage.setItem("@pnp_auto_login_requested", "true");

    while (attempt < maxAttempts && !success) {
      try {
        const personnelId = await AsyncStorage.getItem(
          "@pnp_active_personnel_id",
        );
        if (personnelId) {
          const dutyType = await AsyncStorage.getItem("@pnp_duty_type");
          const signal = await SignalStrengthModule.getSignalStrength();
          
          const log = {
            id: "bg-" + Math.random().toString(36).substring(2, 11),
            personnelId: personnelId,
            latitude: lat,
            longitude: lng,
            speed: speed,
            networkSignal: signal.level,
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

  await AsyncStorage.setItem("@pnp_active_personnel_id", personnelId);
  await AsyncStorage.setItem("@pnp_shift_status", "ACTIVE");

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.BestForNavigation,
    activityType: Location.ActivityType.AutomotiveNavigation,
    timeInterval: 5000,
    distanceInterval: 0,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Project J.O.E.M.A.R Active",
      notificationBody: "Patrol routing log is live. Tap to view details.",
      notificationColor: "#1E3A8A",
      categoryIdentifier: "patrol-session",
    } as any,
  });
};

export const stopBackgroundUpdates = async () => {
  await AsyncStorage.removeItem("@pnp_active_personnel_id");
  await AsyncStorage.removeItem("@pnp_duty_type");
  await AsyncStorage.setItem("@pnp_shift_status", "OFF_DUTY");

  const started =
    await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (started) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
};
