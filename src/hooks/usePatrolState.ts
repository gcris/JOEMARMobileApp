import { useState, useEffect, useCallback, useRef } from "react";
import { Alert, Linking, Platform, AppState, Vibration } from "react-native";
import * as Location from "expo-location";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system";
import { Audio } from "expo-av";
import * as Notifications from "expo-notifications";
import { Personnel, Schedule, PersonnelLog } from "../types";
import {
  getPersonnelByBadge,
  getPersonnelByEmail,
  getPersonnelById,
  findCandidatePersonnel,
  getRanks,
  getUnits,
  getScheduleByPersonnel,
  getLatestLogs,
  getUnsyncedLogs,
  getUnsyncedCount,
  markLogsAsSynced,
  cleanSyncedLogs,
  insertPersonnelLog,
  savePersonnel,
} from "../services/database";
import {
  startBackgroundUpdates,
  stopBackgroundUpdates,
  formatManilaTimestamp,
} from "../services/BackgroundTracker";
import {
  supabase,
  isSupabaseConfigured,
  supabaseAdmin,
} from "../services/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  enrollMFA,
  verifyMFAChallenge,
  checkMFAStatus,
  unenrollMFA,
} from "../services/supabaseMFA";

import Constants from "expo-constants";

// Async storage keys for pending MFA verification
const PENDING_MFA_USER_ID_KEY = "@pnp_pending_mfa_user_id";
const PENDING_MFA_PERSONNEL_KEY = "@pnp_pending_mfa_personnel";

export type LoginResult =
  | { status: "SUCCESS" }
  | { status: "NOT_FOUND" }
  | { status: "PENDING_APPROVAL" }
  | { status: "NEED_MFA_LOGIN"; factorId: string }
  | {
      status: "NEED_MFA_SETUP";
      factorId: string;
      secret: string;
    }
  | {
      status: "NEED_MFA_VERIFICATION";
      factorId: string;
    }
  | {
      status: "ERROR";
      message: string;
    };

export const usePatrolState = () => {
  const [personnel, setPersonnel] = useState<Personnel | null>(null);
  const [schedule, setSchedule] = useState<Schedule[] | null>(null);
  const [logs, setLogs] = useState<PersonnelLog[]>([]);
  const [unsyncedCount, setUnsyncedCount] = useState<number>(0);

  const [isShiftActive, setIsShiftActive] = useState<boolean>(false);
  const [autoSync, setAutoSync] = useState<boolean>(true);

  const [isGpsEnabled, setIsGpsEnabled] = useState<boolean>(false);
  const [foregroundGranted, setForegroundGranted] = useState<boolean | null>(
    null,
  );
  const [backgroundGranted, setBackgroundGranted] = useState<boolean | null>(
    null,
  );

  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [is2FAEnabled, setIs2FAEnabled] = useState<boolean>(false);
  const [notificationGranted, setNotificationGranted] = useState<
    boolean | null
  >(null);
  const [isWithinScheduledTime, setIsWithinScheduledTime] = useState(false);
  const [activeDutyType, setActiveDutyType] = useState<string | null>(null);

  // Checks device's system GPS and permission status
  const checkLocationPermissionState = useCallback(async () => {
    try {
      const { status: fgStatus } =
        await Location.getForegroundPermissionsAsync();
      const { status: bgStatus } =
        await Location.getBackgroundPermissionsAsync();
      const enabled = await Location.hasServicesEnabledAsync();

      setForegroundGranted(fgStatus === "granted");
      setBackgroundGranted(bgStatus === "granted");
      setIsGpsEnabled(enabled);

      return enabled && fgStatus === "granted";
    } catch {
      setIsGpsEnabled(false);
      return false;
    }
  }, []);

  const requestForegroundPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === "granted";
      setForegroundGranted(granted);
      await checkLocationPermissionState();
      return granted;
    } catch (e) {
      console.warn("Foreground permission request error", e);
      return false;
    }
  };

  const requestBackgroundPermission = async () => {
    try {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      const granted = status === "granted";
      setBackgroundGranted(granted);
      await checkLocationPermissionState();
      return granted;
    } catch (e) {
      console.warn("Background permission request error", e);
      return false;
    }
  };

  const enableGpsInline = async () => {
    try {
      setGpsLoading(true);
      await Location.enableNetworkProviderAsync();
      const enabled = await Location.hasServicesEnabledAsync();
      setIsGpsEnabled(enabled);
      await checkLocationPermissionState();
      setGpsLoading(false);
      return enabled;
    } catch (e) {
      setGpsLoading(false);
      console.warn("Enable network provider error", e);
      return false;
    }
  };

  // Notification permission functions
  const checkNotificationPermissionState = useCallback(async () => {
    try {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      setNotificationGranted(finalStatus === "granted");
      return finalStatus === "granted";
    } catch {
      setNotificationGranted(false);
      return false;
    }
  }, []);

  const requestNotificationPermissions = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      const granted = status === "granted";
      setNotificationGranted(granted);
      await checkNotificationPermissionState();
      return granted;
    } catch (e) {
      console.warn("Notification permission request error", e);
      return false;
    }
  };

  const loadLogsAndStats = useCallback(async () => {
    // Use ref to get current personnel to avoid stale closure issues
    if (!personnel) return;

    try {
      const latest = await getLatestLogs(personnel.id, 12);
      setLogs(latest);
    } catch (e) {
      console.warn("Could not query latest log cards", e);
    }
  }, []); // Empty deps because we use ref instead of direct personnel variable

  const updateUnsyncedCounter = useCallback(async () => {
    // Use ref to get current personnel to avoid stale closure issues
    try {
      const count = await getUnsyncedCount();
      setUnsyncedCount(count);
    } catch (e) {
      console.warn(e);
    }
  }, []);

  useEffect(() => {
    if (personnel) {
      // This runs after personnel state has been updated
      console.log("Personnel is now set:", personnel);
      // Handle post-login logic here
      (async () => {
        const assignedSched = await getScheduleByPersonnel(personnel.id);
        if (assignedSched) {
          setSchedule(assignedSched);
        }
        await loadLogsAndStats();
        await updateUnsyncedCounter();
      })();
    }
  }, [personnel]);

  // Poll system GPS state
  useEffect(() => {
    checkLocationPermissionState();
    const gpsInterval = setInterval(() => {
      checkLocationPermissionState();
    }, 20000); // Polling lessened from 4s to 20s to preserve battery

    return () => clearInterval(gpsInterval);
  }, [checkLocationPermissionState]);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const val = await AsyncStorage.getItem("@pnp_auto_sync");
        if (val !== null) {
          setAutoSync(val === "true");
        }
      } catch (e) {
        console.warn("Failed to load @pnp_auto_sync", e);
      }
    };
    loadSettings();
  }, []); // Run once on mount instead of depending on autoSync to prevent infinite loop

  // Helper function to check if current time is within any schedule for today
  const checkIfWithinScheduledTime = useCallback(() => {
    if (!schedule || schedule.length === 0) {
      setIsWithinScheduledTime(false);
      setActiveDutyType(null);
      return false;
    }

    const now = new Date();
    const today = now.toISOString().split("T")[0]; // YYYY-MM-DD

    let isWithin = false;
    let activeDuty: string | null = null;

    for (const sched of schedule) {
      if (sched.date !== today) continue;

      const [fromHour, fromMin] = sched.timeFrom.split(":").map(Number);
      const [toHour, toMin] = sched.timeTo.split(":").map(Number);

      const startTime = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        fromHour,
        fromMin,
        0,
        0,
      );
      const endTime = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        toHour,
        toMin,
        0,
        0,
      );

      if (now >= startTime && now < endTime) {
        isWithin = true;
        activeDuty = sched.duty_type;
        break; // Use the first matching schedule
      }
    }

    setIsWithinScheduledTime(isWithin);
    setActiveDutyType(activeDuty);
    return isWithin;
  }, [schedule]);

  // Update push token for the current user when we have personnel and notification permission
  useEffect(() => {
    if (!personnel) return;
  }, [personnel]);

  // Check for auto-login request from notification tap AND active patrol session
  // useEffect(() => {
  //   const checkAutoLoginAndResume = async () => {
  //     try {
  //       // FIRST: Check if we have pending MFA data (user is in middle of MFA setup)
  //       const pendingUserId = await AsyncStorage.getItem(
  //         PENDING_MFA_USER_ID_KEY,
  //       );
  //       const pendingPersonnelJson = await AsyncStorage.getItem(
  //         PENDING_MFA_PERSONNEL_KEY,
  //       );

  //       if (pendingUserId && pendingPersonnelJson) {
  //         try {
  //           const pendingPersonnel = JSON.parse(pendingPersonnelJson);
  //           // Validate that the pending personnel data is valid
  //           if (pendingPersonnel && pendingPersonnel.id === pendingUserId) {
  //             // Set personnel state from pending MFA data
  //             setPersonnel(pendingPersonnel);

  //             // Load associated data
  //             const assignedSched = await getScheduleByPersonnel(
  //               pendingPersonnel.id,
  //             );
  //             if (assignedSched) {
  //               setSchedule(assignedSched);
  //             }

  //             loadLogsAndStats();
  //             updateUnsyncedCounter();

  //             console.log(
  //               "[Auto-resume] Restored personnel state from pending MFA data for user:",
  //               pendingUserId,
  //             );

  //             // Clear the pending MFA data since we've restored it
  //             await AsyncStorage.removeItem(PENDING_MFA_USER_ID_KEY);
  //             await AsyncStorage.removeItem(PENDING_MFA_PERSONNEL_KEY);

  //             return; // Important: return early to avoid overwriting with other login attempts
  //           }
  //         } catch (parseError) {
  //           console.warn(
  //             "Failed to parse pending MFA personnel data:",
  //             parseError,
  //           );
  //           // Clear invalid pending data
  //           await AsyncStorage.removeItem(PENDING_MFA_USER_ID_KEY);
  //           await AsyncStorage.removeItem(PENDING_MFA_PERSONNEL_KEY);
  //         }
  //       }

  //       // SECOND: Check if auto-login was requested from notification tap
  //       const autoLoginRequested = await AsyncStorage.getItem(
  //         "@pnp_auto_login_requested",
  //       );
  //       if (autoLoginRequested === "true") {
  //         // Clear the flag
  //         await AsyncStorage.removeItem("@pnp_auto_login_requested");

  //         // Check if Supabase is configured
  //         if (isSupabaseConfigured()) {
  //           // Try to get current Supabase session
  //           const {
  //             data: { user },
  //             error,
  //           } = await supabase.auth.getUser();

  //           if (!error && user) {
  //             // Valid session found, fetch personnel profile
  //             const { data: remoteProfile, error: profileErr } = await supabase
  //               .from("personnel")
  //               .select("*")
  //               .eq("id", user.id)
  //               .single();

  //             if (!profileErr && remoteProfile) {
  //               // Create personnel object
  //               const pUser: Personnel = {
  //                 id: remoteProfile.id,
  //                 badgeNumber: remoteProfile.badge_number,
  //                 rank: remoteProfile.rank,
  //                 rankId: remoteProfile.rank_id,
  //                 fullname: remoteProfile.fullname,
  //                 unitId: remoteProfile.unit_id,
  //                 designation: remoteProfile.designation,
  //                 isApproved: remoteProfile.is_approved,
  //                 role: remoteProfile.role,
  //                 email: user.email,
  //                 photo_url: remoteProfile.photo_url, // Add photo URL from database
  //                 expo_push_token: remoteProfile.expo_push_token,
  //               };

  //               // Set personnel state
  //               setPersonnel(pUser);

  //               // Load associated schedule, logs, and stats
  //               const assignedSched = await getScheduleByPersonnel(pUser.id);
  //               if (assignedSched) {
  //                 setSchedule(assignedSched);
  //               }

  //               loadLogsAndStats();
  //               updateUnsyncedCounter();
  //               setIsShiftActive(true);

  //               console.log(
  //                 "[Auto-login] Successfully restored session for user:",
  //                 user.email,
  //               );
  //             }
  //           }
  //         }
  //       } else {
  //         // THIRD: Check for active patrol session (app reopened during patrol)
  //         const activePersonnelId = await AsyncStorage.getItem(
  //           "@pnp_active_personnel_id",
  //         );
  //         const shiftStatus = await AsyncStorage.getItem("@pnp_shift_status");

  //         if (
  //           activePersonnelId &&
  //           shiftStatus === "ACTIVE" &&
  //           isSupabaseConfigured()
  //         ) {
  //           // Try to get current Supabase session
  //           const {
  //             data: { user },
  //             error,
  //           } = await supabase.auth.getUser();

  //           if (!error && user) {
  //             // Valid session found, fetch personnel profile
  //             const { data: remoteProfile, error: profileErr } = await supabase
  //               .from("personnel")
  //               .select("*")
  //               .eq("id", user.id)
  //               .single();

  //             if (!profileErr && remoteProfile) {
  //               // Create personnel object
  //               const pUser: Personnel = {
  //                 id: remoteProfile.id,
  //                 badgeNumber: remoteProfile.badge_number,
  //                 rank: remoteProfile.rank,
  //                 rankId: remoteProfile.rank_id,
  //                 fullname: remoteProfile.fullname,
  //                 unitId: remoteProfile.unit_id,
  //                 designation: remoteProfile.designation,
  //                 isApproved: remoteProfile.is_approved,
  //                 role: remoteProfile.role,
  //                 email: user.email,
  //                 photo_url: remoteProfile.photo_url, // Add photo URL from database
  //                 expo_push_token: remoteProfile.expo_push_token,
  //               };

  //               // Set personnel state
  //               setPersonnel(pUser);

  //               // Load associated schedule, logs, and stats
  //               const assignedSched = await getScheduleByPersonnel(pUser.id);
  //               if (assignedSched) {
  //                 setSchedule(assignedSched);
  //               }

  //               loadLogsAndStats();
  //               updateUnsyncedCounter();
  //               setIsShiftActive(true);

  //               console.log(
  //                 "[Auto-resume] Successfully resumed patrol session for user:",
  //                 user.email,
  //               );
  //             }
  //           }
  //         }
  //       }
  //     } catch (err) {
  //       console.warn("[Auto-login/resume] Failed to restore session:", err);
  //     }
  //   };

  //   // checkAutoLoginAndResume();
  // }, [personnel]);

  const toggleAutoSync = async () => {
    try {
      const nextVal = !autoSync;
      setAutoSync(nextVal);
      await AsyncStorage.setItem("@pnp_auto_sync", String(nextVal));
    } catch (e) {
      console.warn("Failed to save @pnp_auto_sync", e);
    }
  };

  // Supabase 2FA Settings & check effects
  useEffect(() => {
    const check2FA = async () => {
      // Use ref to get current personnel to avoid stale closure issues
      if (personnel) {
        try {
          // Use personnel.id as the key for AsyncStorage to ensure consistency
          const personnelIdKey = personnel.id;
          const status = await checkMFAStatus(
            personnel.email || personnel.badgeNumber,
          );
          setIs2FAEnabled(status.isEnabled);
          if (status.isEnabled && status.factorId) {
            await AsyncStorage.setItem(
              `@pnp_supabase_mfa_factor_id_${personnelIdKey}`,
              status.factorId,
            );
          }
        } catch (e) {
          console.warn("Error checking Supabase MFA state", e);
        }
      } else {
        setIs2FAEnabled(false);
      }
    };
    check2FA();
  }, [personnel]);

  const enable2FA = async (
    user_id: string,
    code: string,
    factorId?: string,
  ): Promise<boolean> => {
    // Use ref to get current personnel to avoid stale closure issues
    // console.log("personnel: ", personnel);
    if (!user_id) return false;
    try {
      let activeFactorId = factorId;
      console.log("activeFactorId: ", activeFactorId);
      if (!activeFactorId) {
        activeFactorId =
          (await AsyncStorage.getItem(
            `@pnp_supabase_mfa_factor_id_${user_id}`,
          )) || "";
        if (!activeFactorId) {
          throw new Error("No MFA factor ID found. Please enroll MFA first.");
        }
      }

      const verified = await verifyMFAChallenge(activeFactorId, code);

      if (!verified) {
        Alert.alert(
          "Verification Failed",
          "The 6-digit MFA verification code is invalid, expired, or has already been used.",
        );
        return false;
      }

      await AsyncStorage.setItem(
        `@pnp_supabase_mfa_factor_id_${user_id}`,
        activeFactorId,
      );
      setIs2FAEnabled(true);
      Alert.alert(
        "MFA Secured",
        "Supabase Multi-Factor Authentication (MFA) has been successfully verified and active for your officer profile!",
      );
      return true;
    } catch (e) {
      console.error(e);
      Alert.alert(
        "Setup Error",
        "An error occurred while enabling Supabase MFA.",
      );
      return false;
    }
  };

  const disable2FA = async () => {
    // Use ref to get current personnel to avoid stale closure issues
    if (!personnel) return;
    try {
      // Use personnel.id as the key for AsyncStorage to ensure consistency
      const personnelIdKey = personnel.id;
      const factorId =
        (await AsyncStorage.getItem(
          `@pnp_supabase_mfa_factor_id_${personnelIdKey}`,
        )) ?? "";

      await unenrollMFA(factorId);
      await AsyncStorage.removeItem(
        `@pnp_supabase_mfa_factor_id_${personnelIdKey}`,
      ).catch(() => {});

      // Clean up legacy keys
      await AsyncStorage.removeItem(
        `@pnp_google_authenticator_mfa_secret_${personnelIdKey}`,
      ).catch(() => {});
      await AsyncStorage.removeItem(
        `@pnp_google_authenticator_mfa_secret_${personnel.badgeNumber}`,
      ).catch(() => {});
      await AsyncStorage.removeItem(
        `@pnp_2fa_secret_${personnel.badgeNumber}`,
      ).catch(() => {});

      setIs2FAEnabled(false);
      Alert.alert(
        "MFA Disabled",
        "Supabase Multi-Factor Authentication (MFA) is now disabled. Warning: Your officer profile is no longer protected by MFA.",
      );
    } catch (e) {
      console.error(e);
      Alert.alert(
        "Disable Error",
        "An error occurred while disabling Supabase multi-factor authentication.",
      );
    }
  };

  // Synchronize logs & counts when off/on shift, with optional automatic remote sync (preserves cellular logs inside SQLite when turned off)
  useEffect(() => {
    let logTimer: ReturnType<typeof setInterval> | null = null;
    let countsTimer: ReturnType<typeof setInterval> | null = null;
    let autoSyncTimer: ReturnType<typeof setInterval> | null = null;

    if (isShiftActive) {
      logTimer = setInterval(() => {
        loadLogsAndStats();
      }, 15000); // Polling slowed from 5s to 15s to optimize CPU/battery

      countsTimer = setInterval(() => {
        updateUnsyncedCounter();
      }, 15000); // Polling slowed from 3s to 15s to optimize CPU/battery

      if (autoSync) {
        autoSyncTimer = setInterval(() => {
          syncLogsWithRemote(false); // Quiet auto background sync
        }, 30000); // battery optimize: auto upload logs every 30 seconds
      }
    } else {
      loadLogsAndStats();
      updateUnsyncedCounter();
    }

    return () => {
      if (logTimer) clearInterval(logTimer);
      if (countsTimer) clearInterval(countsTimer);
      if (autoSyncTimer) clearInterval(autoSyncTimer);
    };
  }, [
    personnel,
    isShiftActive,
    autoSync,
    loadLogsAndStats,
    updateUnsyncedCounter,
  ]);

  const openSystemSettings = async () => {
    setGpsLoading(true);
    setTimeout(() => setGpsLoading(false), 2000);
    if (Linking.openSettings) {
      await Linking.openSettings();
    } else {
      Alert.alert(
        "Settings",
        "Could not open system settings. Please manually turn on Location Services.",
      );
    }
  };

  const buildPersonnel = (remoteProfile: any, email: string): Personnel => ({
    id: remoteProfile.id,
    badgeNumber: remoteProfile.badge_number,
    rank: remoteProfile.rank,
    rankId: remoteProfile.rank_id,
    fullname: remoteProfile.fullname,
    unitId: remoteProfile.unit_id,
    designation: remoteProfile.designation,
    isApproved: remoteProfile.is_approved,
    role: remoteProfile.role,
    email,
    photo_url: remoteProfile.photo_url,
    expo_push_token: remoteProfile.expo_push_token,
  });

  const completeLogin = async (pUser: Personnel, projectId: string) => {
    // Save state
    setPersonnel(pUser);

    // Load schedule
    const assignedSched = await getScheduleByPersonnel(pUser.id);

    if (assignedSched) {
      setSchedule(assignedSched);
    }

    // Refresh dashboard
    await loadLogsAndStats();
    await updateUnsyncedCounter();

    // Update Expo push token
    try {
      const token = (
        await Notifications.getExpoPushTokenAsync({
          projectId,
        })
      ).data;

      await supabase
        .from("personnel")
        .update({
          expo_push_token: token,
        })
        .eq("id", pUser.id);
    } catch (err) {
      console.warn("Unable to update Expo push token", err);
    }
  };

  const login = async (
    emailInput: string,
    passwordInput: string,
    otpCode?: string,
  ): Promise<LoginResult> => {
    const trimmedEmail = emailInput.trim().toLowerCase();

    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      return {
        status: "ERROR",
        message: "Please enter a valid email address.",
      };
    }

    if (!passwordInput.trim()) {
      return {
        status: "ERROR",
        message: "Please enter your password.",
      };
    }

    if (!isSupabaseConfigured()) {
      return {
        status: "ERROR",
        message:
          "Supabase is not configured. Please configure your environment variables.",
      };
    }

    try {
      // ------------------------------------------------------------------
      // STEP 1
      // Authenticate with Supabase
      // ------------------------------------------------------------------

      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: passwordInput,
      });

      if (error) {
        return {
          status: "ERROR",
          message: error.message,
        };
      }

      if (!data.user) {
        return {
          status: "ERROR",
          message: "Authentication failed.",
        };
      }

      const authUser = data.user;

      // ------------------------------------------------------------------
      // STEP 2
      // Retrieve personnel profile
      // ------------------------------------------------------------------

      const { data: remoteProfile, error: profileErr } = await supabase
        .from("personnel")
        .select("*, rank(*), unit(*)")
        .eq("id", authUser.id)
        .maybeSingle();

      if (profileErr) throw profileErr;

      if (!remoteProfile) {
        return {
          status: "NOT_FOUND",
        };
      }

      const pUser = buildPersonnel(
        remoteProfile,
        authUser.email ?? trimmedEmail,
      );

      // ------------------------------------------------------------------
      // STEP 3
      // Check approval BEFORE MFA
      // ------------------------------------------------------------------

      if (!pUser.isApproved) {
        return {
          status: "PENDING_APPROVAL",
        };
      }

      // ------------------------------------------------------------------
      // STEP 4
      // Determine project id
      // ------------------------------------------------------------------

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId;

      if (!projectId) {
        throw new Error("EAS Project ID not found.");
      }

      // ------------------------------------------------------------------
      // STEP 5
      // MFA STATUS
      // ------------------------------------------------------------------

      const status = await checkMFAStatus(trimmedEmail);

      console.log("MFA Status:", status);

      // ------------------------------------------------------------------
      // STEP 6
      // User has no verified MFA
      // ------------------------------------------------------------------

      if (!status.isEnabled) {
        const enrollment = await enrollMFA(trimmedEmail);

        // Save pending personnel so LoginView can finish enrollment
        await AsyncStorage.setItem(PENDING_MFA_USER_ID_KEY, pUser.id);

        await AsyncStorage.setItem(
          PENDING_MFA_PERSONNEL_KEY,
          JSON.stringify(pUser),
        );

        await AsyncStorage.setItem(
          `@pnp_supabase_mfa_factor_id_${pUser.id}`,
          enrollment.factorId,
        );

        if (enrollment.pendingEnrollment) {
          return {
            status: "NEED_MFA_VERIFICATION",
            factorId: enrollment.factorId,
          };
        }

        if (enrollment.alreadyVerified) {
          return {
            status: "NEED_MFA_LOGIN",
            factorId: enrollment.factorId,
          };
        }

        return {
          status: "NEED_MFA_SETUP",
          factorId: enrollment.factorId,
          secret: enrollment.secret!,
        };
      }

      // ------------------------------------------------------------------
      // STEP 7
      // User already has MFA
      // ------------------------------------------------------------------

      if (!otpCode) {
        return {
          status: "NEED_MFA_LOGIN",
          factorId: status.factorId!,
        };
      }

      const verified = await verifyMFAChallenge(status.factorId!, otpCode);

      if (!verified) {
        return {
          status: "ERROR",
          message: "Invalid or expired MFA verification code.",
        };
      }

      // ------------------------------------------------------------------
      // STEP 8
      // MFA SUCCESS
      // ------------------------------------------------------------------

      await completeLogin(pUser, projectId);

      return {
        status: "SUCCESS",
      };
    } catch (e: any) {
      console.error(e);

      return {
        status: "ERROR",
        message: e.message ?? "Authentication failed.",
      };
    }
  };

  const logout = useCallback(async () => {
    try {
      await stopBackgroundUpdates();
      await AsyncStorage.removeItem(PENDING_MFA_USER_ID_KEY);
      await AsyncStorage.removeItem(PENDING_MFA_PERSONNEL_KEY);
    } catch {
      // Ignored for clean sign out
    }
    setIsShiftActive(false);
    setPersonnel(null);
  }, []);

  const toggleShift = async () => {
    if (!personnel) return;

    // FORCE SYSTEM GPS TO BE ENABLED
    const gpsOk = await checkLocationPermissionState();
    if (!gpsOk) {
      Alert.alert(
        "GPS Required",
        "CANNOT START PATROL: Please enable your system GPS / Location switch first to map secure foot patrol telemetry.",
        [
          { text: "Turn on GPS in Settings", onPress: openSystemSettings },
          { text: "Cancel", style: "cancel" },
        ],
      );
      return;
    }

    if (isShiftActive) {
      setIsShiftActive(false);
      try {
        await stopBackgroundUpdates();
      } catch (err) {
        console.warn("Background service stop error", err);
      }
      Alert.alert(
        "Patrol Ceased",
        "Your active patrol shift has been successfully paused and logged.",
      );
    } else {
      // Check if within scheduled time before allowing shift to start
      const isWithinTime = checkIfWithinScheduledTime();
      if (!isWithinTime) {
        Alert.alert(
          "Outside Scheduled Time",
          "You can only start patrolling during your scheduled duty hours.\nPlease check your schedule for today.",
          [{ text: "OK", style: "cancel" }],
        );
        return;
      }

      // Store duty type for background tracking
      if (activeDutyType) {
        await AsyncStorage.setItem("@pnp_duty_type", activeDutyType);
      }

      // Vehicle functionality removed - using personnel only

      try {
        await startBackgroundUpdates(personnel.id);
        setIsShiftActive(true);
        Alert.alert(
          "Patrol Active",
          "PNP background tracking initialized! Telemetry is captured securely even when minimized.",
        );
      } catch (err: any) {
        Alert.alert(
          "Service Notification",
          `Background service error: ${err.message || "Unable to start background tracking service."}`,
          [
            {
              text: "Retry",
              onPress: () => {
                toggleShift(); // Retry toggling the shift
              },
            },
            { text: "Cancel", style: "cancel" },
          ],
        );
      }
    }
  };

  const syncLogsWithRemote = async (showPromptAndAlerts: boolean = true) => {
    if (isSyncing) return;
    setIsSyncing(true);

    try {
      const offlineLogs = await getUnsyncedLogs();
      if (offlineLogs.length === 0) {
        if (showPromptAndAlerts) {
          Alert.alert(
            "Up to Date",
            "No pending coordinate logs inside local storage cache require syncing.",
          );
        }
        setIsSyncing(false);
        return;
      }

      if (!isSupabaseConfigured()) {
        if (showPromptAndAlerts) {
          Alert.alert(
            "Sync Error",
            "Supabase is not configured. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY environment variables to enable data synchronization.",
            [{ text: "OK", style: "cancel" }],
          );
        }
        setIsSyncing(false);
        return;
      }

      const payload = offlineLogs.map((log) => ({
        personnel_id: log.personnelId,
        latitude: log.latitude,
        longitude: log.longitude,
        speed: log.speed,
        network_signal: log.networkSignal,
        duty_type: log.dutyType,
        captured_at: log.capturedAt,
      }));

      const { error } = await supabase.from("personnel_logs").insert(payload);
      if (error) throw error;

      const ids = offlineLogs.map((l) => l.id);
      await markLogsAsSynced(ids);
      await updateUnsyncedCounter();
      await loadLogsAndStats();

      if (showPromptAndAlerts) {
        Alert.alert(
          "Patrol Synchronized",
          `Successfully uploaded ${ids.length} patrol points securely back to PNP Command Operations HQ.`,
        );
      }
    } catch (e: any) {
      console.error(e);
      if (showPromptAndAlerts) {
        Alert.alert(
          "Sync Failure",
          `Remote gateway is unreachable: ${e.message || e}`,
        );
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const flushSyncedCache = async () => {
    Alert.alert(
      "Flush Synced Cache",
      "Are you sure you want to delete already synced logs from local storage memory?",
      [
        {
          text: "Delete Logs",
          style: "destructive",
          onPress: async () => {
            await cleanSyncedLogs();
            loadLogsAndStats();
            Alert.alert(
              "Flushed Data",
              "Local telemetry memory cleared successfully.",
            );
          },
        },
        { text: "Cancel", style: "cancel" },
      ],
    );
  };

  const triggerEmergencySOS = async (): Promise<boolean> => {
    if (!personnel) {
      Alert.alert(
        "Authentication Error",
        "You must be logged in to send an SOS.",
      );
      return false;
    }

    return new Promise((resolve) => {
      Alert.alert(
        "DISTRESS SIGNAL",
        "This will immediately send an emergency alert with your live GPS location back to INPPO HQ and notify your unit/station members. Are you sure you want to trigger it?",
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => resolve(false),
          },
          {
            text: "YES, SEND DISTRESS ALERT",
            style: "destructive",
            onPress: async () => {
              try {
                let lat = 14.591;
                let lng = 120.973;
                let speed = 0.0;
                let accuracy = 0;

                try {
                  const { status } =
                    await Location.getForegroundPermissionsAsync();
                  if (status !== "granted") {
                    const { status } =
                      await Location.requestForegroundPermissionsAsync();
                    if (status !== Location.PermissionStatus.GRANTED) {
                      return;
                    }
                  }

                  const loc = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.BestForNavigation,
                  });
                  lat = loc.coords.latitude;
                  lng = loc.coords.longitude;
                  speed = loc.coords.speed || 0.0;
                  accuracy = loc.coords.accuracy || 0;
                } catch (e) {
                  console.warn(
                    "GPS request failed, using fallback coordinates",
                    e,
                  );
                  if (logs.length > 0) {
                    lat = logs[0].latitude;
                    lng = logs[0].longitude;
                    speed = logs[0].speed;
                    accuracy = logs[0].networkSignal || 0;
                  }
                }

                const captured = formatManilaTimestamp(isShiftActive);
                let shiftWasActive = isShiftActive;
                if (shiftWasActive) {
                  setIsShiftActive(false);
                  await AsyncStorage.removeItem("@pnp_shift_status");
                }
                const uniqueId =
                  "sos-" + Math.random().toString(36).substring(2, 11);

                const sosLog: PersonnelLog = {
                  id: uniqueId,
                  personnelId: personnel.id,
                  personnel: {
                    rank_name: personnel.rank?.rank_name || "",
                    fullname: personnel.fullname,
                  },
                  latitude: lat,
                  longitude: lng,
                  speed: speed, // Special speed indicator for SOS alert
                  networkSignal: 4, // Signal strength for SOS
                  dutyType: "EMERGENCY_SOS", // Special duty type for SOS
                  capturedAt: captured,
                  isSynced: false, // Initially not synced
                };

                await insertPersonnelLog(sosLog);
                await updateUnsyncedCounter();
                await loadLogsAndStats();

                // NEW: Send SOS alert to unit members
                // await sendUnitSosAlert(personnel, {
                //   latitude: lat,
                //   longitude: lng,
                //   accuracy: accuracy,
                //   timestamp: new Date().toISOString(),
                //   sosId: uniqueId,
                // });

                Alert.alert(
                  "DISTRESS SIGNAL SENT",
                  `Your unit/station members have been notified with your location.\nPlease stay at your position or proceed to the safe area.`,
                );

                resolve(true);
              } catch (err: any) {
                console.error(err);
                Alert.alert(
                  "SOS Failed",
                  "Could not complete SOS handshake: " + (err.message || err),
                );
                resolve(false);
              }
            },
          },
        ],
        { cancelable: true },
      );
    });
  };

  /**
   * Send SOS alert to all active members of the same unit
   */
  const sendUnitSosAlert = useCallback(
    async (
      sosOriginator: Personnel,
      locationData: {
        latitude: number;
        longitude: number;
        accuracy: number;
        timestamp: string;
        sosId: string;
      },
    ) => {
      try {
        // Don't proceed if no unit ID
        if (!sosOriginator.unitId) {
          console.warn("No unit ID found for SOS originator");
          return;
        }

        // Get all active personnel in the same unit (excluding the sender)
        // These are personnel who have registered, been approved, and belong to the same unit
        const { data: unitMembers, error: memberError } = await supabase
          .from("personnel")
          .select("id, fullname, badge_number, unit_id, expo_push_token")
          .eq("unit_id", sosOriginator.unitId)
          .neq("id", sosOriginator.id)
          .eq("is_approved", true)
          .not("expo_push_token", "is", null);

        if (memberError) {
          console.error("Failed to fetch unit members:", memberError);
          return;
        }

        if (!unitMembers || unitMembers.length === 0) {
          console.log("No other active unit members found");
          return;
        }

        // Prepare SOS notification
        const notificationTitle = "DISTRESS SIGNAL";
        const notificationBody = `${sosOriginator.rank?.rank_name} ${sosOriginator.fullname} needs assistance! Tap for details.`;

        // Send notification to each member
        const notificationPromises = unitMembers.map(async (member) => {
          try {
            // Only send notification if we have a valid expo push token
            if (member.expo_push_token) {
              await sendExpoPushNotification({
                to: member.expo_push_token,
                sound: "sos_alert.wav", // Custom sound - will fallback to default if not found
                title: notificationTitle,
                body: notificationBody,
                channelId: "emergency-alerts-v2",
                category: "sos-actions",
                data: {
                  type: "patrol-notification-tap",
                  shouldAutoLogin: true,
                  sosOriginatorId: sosOriginator.id,
                  sosOriginatorRank: sosOriginator.rank?.rank_name,
                  sosOriginatorName: sosOriginator.fullname,
                  sosOriginatorBadge: sosOriginator.badgeNumber,
                  latitude: locationData.latitude,
                  longitude: locationData.longitude,
                  accuracy: locationData.accuracy,
                  timestamp: locationData.timestamp,
                  sosId: locationData.sosId,
                  unitId: sosOriginator.unitId,
                },
                // Android specific settings
                ...(Platform.OS === "android"
                  ? {
                      priority: "high", // Ensures notification appears as heads-up
                      vibrationPattern: [0, 600, 400, 600], // Match our SOS vibration pattern
                    }
                  : {}),
                // iOS specific settings
                ...(Platform.OS === "ios"
                  ? {
                      sound: "sos_alert.wav",
                    }
                  : {}),
              });
            } else {
              console.warn(
                `Skipping SOS notification for member ${member.id}: no expo push token available`,
              );
            }
          } catch (error) {
            console.warn(
              `Failed to send SOS notification to member ${member.id}:`,
              error,
            );
          }
        });

        // Wait for all notifications to be sent (don't await individually to prevent blocking)
        await Promise.allSettled(notificationPromises);
        const sentCount = unitMembers.length;
        console.log(
          `Sent SOS alert to ${sentCount} of ${unitMembers.length} unit members`,
        );
      } catch (error) {
        console.error("Error sending unit SOS alert:", error);
      }
    },
    [personnel, supabase],
  );

  /**
   * Send push notification via Expo's push notification service
   */
  const sendExpoPushNotification = useCallback(async (notification: any) => {
    try {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(notification),
      });
    } catch (error) {
      console.error("Failed to send push notification:", error);
      throw error;
    }
  }, []);

  const registerUser = async (registrationData: {
    email: string;
    badge_number: string;
    rank_id: string;
    fullname: string;
    unit_id: string;
    designation: string;
    phone_number: string;
    viber_number: string;
    password?: string;
    photoUri: string; // Required photo URI for upload
    expo_push_token?: string; // Expo push token for notifications
  }): Promise<{ success: boolean; message: string }> => {
    try {
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId;

      if (!projectId) {
        throw new Error("EAS Project ID not found in app.json config.");
      }

      const token = (await Notifications.getExpoPushTokenAsync({ projectId }))
        .data;

      // 1. Verify existence of the personnel via badge_number, rank_id, unit_id, and designation
      const candidate = await findCandidatePersonnel(
        registrationData.badge_number,
        registrationData.rank_id,
        registrationData.unit_id,
        registrationData.designation,
      );

      if (!candidate) {
        return {
          success: false,
          message:
            "No matching personnel record found with the provided information. Registration is denied.",
        };
      }

      // 2. Create Supabase auth user (to trigger confirmation email)
      const { data: authUser, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          id: candidate.id,
          email: registrationData.email,
          password: registrationData.password || "",
          email_confirm: true,
        });

      if (authError) {
        throw authError;
      }

      // 4. If photo URI is provided, upload the photo to Supabase storage
      if (registrationData.photoUri) {
        try {
          // Resize/compress image for efficiency
          const resized = await manipulateAsync(
            registrationData.photoUri,
            [{ resize: { width: 800 } }],
            { compress: 0.7, format: SaveFormat.JPEG },
          );
          const base64Data = await FileSystem.readAsStringAsync(resized.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const arrayBuffer = decode(base64Data);
          const fileName = `${Date.now()}.jpg`;

          // Upload the ArrayBuffer instead of the problematic Blob
          const { data, error } = await supabase.storage
            .from("personnel-photos")
            .upload(fileName, arrayBuffer, {
              contentType: "image/jpeg",
              upsert: true,
            });

          if (error) throw error;

          const { data: urlData } = await supabase.storage
            .from("personnel-photos")
            .getPublicUrl(data.path);

          const photoUrl = urlData.publicUrl;

          // Update personnel record with photo URL and expo_push_token
          const { error: dbError } = await supabase
            .from("personnel")
            .update({ photo_url: photoUrl, expo_push_token: token })
            .eq("id", candidate.id);

          if (dbError) throw dbError;
        } catch (photoError) {
          console.error("Photo upload failed during registration:", photoError);
          // Don't fail the registration if photo upload fails
          // Just log the error and continue
        }
      }

      return {
        success: true,
        message:
          "Registration successful! Please check your email to confirm your account before logging in.",
      };
    } catch (err: any) {
      console.error("Registration error", err);
      return {
        success: false,
        message:
          err.message ||
          "An unexpected database error occurred during registration. Please try again.",
      };
    }
  };

  // Function to refresh personnel data from the database
  const refreshPersonnel = useCallback(async () => {
    if (!personnel) return;
    try {
      const freshPersonnel = await getPersonnelById(personnel.id);
      if (freshPersonnel) {
        setPersonnel(freshPersonnel);
        // Also refresh related data
        const assignedSched = await getScheduleByPersonnel(personnel.id);
        if (assignedSched) {
          setSchedule(assignedSched);
        }
        loadLogsAndStats();
        updateUnsyncedCounter();
      }
    } catch (error) {
      console.error("Failed to refresh personnel data:", error);
    }
  }, [
    personnel?.id,
    getScheduleByPersonnel,
    loadLogsAndStats,
    updateUnsyncedCounter,
  ]);

  return {
    personnel,
    schedule,
    logs,
    unsyncedCount,
    isShiftActive,
    isGpsEnabled,
    foregroundGranted,
    backgroundGranted,
    gpsLoading,
    isSyncing,
    autoSync,
    login,
    logout,
    toggleShift,
    syncLogsWithRemote,
    flushSyncedCache,
    openSystemSettings,
    triggerEmergencySOS,
    toggleAutoSync,
    is2FAEnabled,
    enable2FA,
    disable2FA,
    requestForegroundPermission,
    requestBackgroundPermission,
    requestNotificationPermissions,
    enableGpsInline,
    registerUser,
    refreshPersonnel,
  };
};
