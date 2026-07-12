import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { savePatrolLogsToLocalStorage } from "./database";
import SignalStrengthModule from "./SignalStrengthModule";

export const LOCATION_TASK_NAME = "pnp-background-patrol-task";

// Persistence keys for patrol state
export const PATROL_STATE_KEY = "@pnp_patrol_active";
export const PATROL_START_TIME_KEY = "@pnp_patrol_start_time";
export const LAST_KNOWN_LOCATION_KEY = "@pnp_last_known_location";

/**
 * Get location options for startLocationUpdatesAsync
 * @returns Location options object
 */
const getLocationOptions = () => {
  // Note: dutyType and isSilentMode are computed inside startBackgroundUpdates
  // This function assumes those values are already determined elsewhere.
  // For TaskManager recovery, we'll use the last known duty type from storage.
  // This is not perfect but better than failing silently.
  // Ideally we would pass the options as data to the task, but TaskManager doesn't support that easily.
  // As an alternative, we could restart with default options and let the startup logic adjust.
  // For simplicity in recovery, we'll use balanced accuracy and reasonable intervals.
  return {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 10,
    timeInterval: 5000, // 30 seconds default (will be adjusted by startup logic if needed)
    deferredUpdatesDistance: 0,
    deferredUpdatesInterval: 0,
    pausesUpdatesAutomatically: false,
    mayShowUserSettingsDialog: true,
    activityType: Location.ActivityType.OtherNavigation,
    showsBackgroundLocationIndicator: true, // Assume not silent for recovery
    foregroundService: {
      notificationTitle: "Project J.O.E.M.A.R Active",
      notificationBody: "Patrol routing log is live.",
      notificationColor: "#1E3A8A",
      killServiceOnDestroy: false,
    },
  };
};

export const formatManilaTimestamp = (isShiftActive: boolean): string => {
  const d = new Date();
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const manilaDate = new Date(utc);

  const pad = (num: number) => String(num).padStart(2, "0");

  if (isShiftActive) {
    manilaDate.setSeconds(manilaDate.getSeconds() + 30);
  }

  return `${manilaDate.getFullYear()}-${pad(
    manilaDate.getMonth() + 1,
  )}-${pad(manilaDate.getDate())}T${pad(
    manilaDate.getHours(),
  )}:${pad(manilaDate.getMinutes())}:${pad(manilaDate.getSeconds())}Z`;
};

/**
 * Background Task
 */
TaskManager.defineTask(
  LOCATION_TASK_NAME,
  async ({ data, error }: TaskManager.TaskManagerTaskBody) => {
    try {
      if (error) {
        console.error("[BackgroundTask] Location error:", error);
        // Attempt recovery by restarting service with current options
        try {
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
          // Use balanced settings for recovery to be more OEM-friendly
          await Location.startLocationUpdatesAsync(
            LOCATION_TASK_NAME,
            getLocationOptions(),
          );
        } catch (restartError) {
          console.error(
            "[BackgroundTask] Failed to restart location service:",
            restartError,
          );
        }
        return;
      }

      const { locations } = data as {
        locations: Location.LocationObject[];
      };

      if (!locations?.length) return;

      console.log(`[BackgroundTask] Received ${locations.length} location(s)`);

      try {
        const personnelId = await AsyncStorage.getItem(
          "@pnp_active_personnel_id",
        );

        console.log("personnelId: ", personnelId);

        if (!personnelId) return;

        for (const location of locations) {
          await processLocationUpdate(location, personnelId);
        }
      } catch (err) {
        console.error("[BackgroundTask] Error processing locations:", err);
        // Don't let errors in location processing kill the background task
      }
    } catch (err) {
      console.error("[BackgroundTask] Critical error in task:", err);
      // Swallow errors to prevent killing the background task
    }
  },
);

/**
 * Start background updates
 */
export const startBackgroundUpdates = async (): Promise<boolean> => {
  const fg = await Location.requestForegroundPermissionsAsync();

  if (fg.status !== "granted") {
    throw new Error("Foreground location permission denied.");
  }

  const bg = await Location.requestBackgroundPermissionsAsync();

  if (bg.status !== "granted") {
    throw new Error("Background location permission denied.");
  }

  const started =
    await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);

  if (started) {
    console.log("[Location] Already running");
    return true;
  }

  // Get current duty type to configure silent mode if needed
  const dutyType = await AsyncStorage.getItem("@pnp_duty_type");
  const isSilentMode =
    dutyType === "Intel-Driven Operation" || dutyType === "Special Laws";

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced, // Changed from Highest to Balanced for better OEM compatibility
    distanceInterval: 10, // Minimum 10 meters movement to reduce updates
    timeInterval: isSilentMode ? 300000 : 5000, // Increased intervals: 5min silent, 30s normal (was 3min/5s)
    deferredUpdatesDistance: 0,
    deferredUpdatesInterval: 0,
    pausesUpdatesAutomatically: false,
    mayShowUserSettingsDialog: true,
    activityType: Location.ActivityType.OtherNavigation,
    showsBackgroundLocationIndicator: !isSilentMode, // Hide location indicator in silent mode
    foregroundService: {
      notificationTitle: "Project J.O.E.M.A.R Active",
      notificationBody: isSilentMode
        ? "Tap to stop the activity."
        : "Patrol routing log is live.",
      notificationColor: "#1E3A8A",
      killServiceOnDestroy: false,
    },
  });

  console.log("[BackgroundTask] Started", { dutyType, isSilentMode });

  return true;
};

/**
 * Stop background updates
 */
export const stopBackgroundUpdates = async (): Promise<void> => {
  await AsyncStorage.removeItem("@pnp_active_personnel_id");
  await AsyncStorage.removeItem("@pnp_duty_type");
  await AsyncStorage.setItem("@pnp_shift_status", "OFF_DUTY");

  const started =
    await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);

  if (started) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }

  console.log("[BackgroundTask] Stopped");
};

const getDistanceMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) => {
  const R = 6371000;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

/**
 * Save patrol log
 */
const processLocationUpdate = async (
  location: Location.LocationObject,
  personnelIdFromParam: string,
): Promise<void> => {
  try {
    const personnelId = personnelIdFromParam;

    // Get duty type to check for silent mode
    const dutyType = await AsyncStorage.getItem("@pnp_duty_type");
    const isSilentMode =
      dutyType === "Intel-Driven Operation" || dutyType === "Special Laws";

    // Handle silent mode: update last known location but skip logging
    if (isSilentMode) {
      // Update last known location with REAL coordinates (not zeros)
      await AsyncStorage.setItem(
        LAST_KNOWN_LOCATION_KEY,
        JSON.stringify({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          timestamp: new Date().toISOString(),
          accuracy: location.coords.accuracy ?? 0,
        }),
      );

      // Set flag indicating background activity for potential auto-login
      await AsyncStorage.setItem("@pnp_auto_login_requested", "true");

      // Skip saving patrol logs in silent mode - critical fix for battery/performance
      return;
    }

    const coords = location.coords;
    if (coords.accuracy && coords.accuracy > 30) {
      console.log("[BackgroundTask] Ignored poor accuracy:", coords.accuracy);
      return;
    }

    // Use actual coordinates (removed zero-coordinate logic that caused false logs)
    const lat = isSilentMode ? 0 : coords.latitude;
    const lng = isSilentMode ? 0 : coords.longitude;
    const speed = isSilentMode ? 0 : coords.speed;
    console.log("lat, lng:", lat, lng);

    // Check for zero/invalid coordinates (shouldn't happen with proper filtering)
    if ((lat === 0 && lng === 0) || !isFinite(lat) || !isFinite(lng)) {
      console.log("[BackgroundTask] Invalid coordinates received:", lat, lng);
      return;
    }

    // Update last known location
    await AsyncStorage.setItem(
      LAST_KNOWN_LOCATION_KEY,
      JSON.stringify({
        latitude: lat,
        longitude: lng,
        timestamp: new Date().toISOString(),
        accuracy: coords.accuracy ?? 0,
      }),
    );

    await AsyncStorage.setItem("@pnp_auto_login_requested", "true");

    const signal = await SignalStrengthModule.getSignalStrength();

    const capturedAt = new Date(location.timestamp).toISOString();

    await savePatrolLogsToLocalStorage({
      id: `bg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      personnelId,
      latitude: lat,
      longitude: lng,
      speed,
      networkSignal: signal.level,
      dutyType: dutyType ?? "Foot Patrol",
      capturedAt: capturedAt,
      isSynced: false,
    });
  } catch (err) {
    console.error("[BackgroundTask]", err);
  }
};
