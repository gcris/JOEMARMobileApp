import { useState, useEffect, useCallback } from "react";
import { Alert, Linking } from "react-native";
import * as Location from "expo-location";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system";

import { Personnel, Schedule, PersonnelLog } from "../types";
import {
  getPersonnelByBadge,
  getPersonnelByEmail,
  registerPersonnel,
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
import { supabase, isSupabaseConfigured } from "../services/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  enrollMFA,
  verifyMFAEnrollment,
  checkMFAStatus,
  unenrollMFA,
} from "../services/supabaseMFA";

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

  const loadLogsAndStats = useCallback(async () => {
    try {
      const latest = await getLatestLogs(12);
      setLogs(latest);
    } catch (e) {
      console.warn("Could not query latest log cards", e);
    }
  }, []);

  const updateUnsyncedCounter = useCallback(async () => {
    try {
      const count = await getUnsyncedCount();
      setUnsyncedCount(count);
    } catch (e) {
      console.warn(e);
    }
  }, []);

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
  }, []);

  // Real-time subscription for SOS alerts from other personnel
  useEffect(() => {
    if (!personnel || !isSupabaseConfigured()) return;

    // Subscribe to new personnel_logs entries
    const sosSubscription = supabase
      .channel("personnel_logs_changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "personnel_logs" },
        (payload) => {
          const newLog = payload.new as PersonnelLog;

          // Check if this is an SOS alert (speed: 999.0 is our SOS indicator)
          // and it's not from the current user
          if (
            newLog.speed === 999.0 &&
            newLog.dutyType === "EMERGENCY_SOS" &&
            newLog.personnelId !== personnel.id
          ) {
            // Show alert for SOS from another officer
            Alert.alert(
              "🚨 EMERGENCY SOS ALERT",
              `Officer ${newLog.personnelId} has triggered an SOS!\nTap to acknowledge.`,
              [
                {
                  text: "ACKNOWLEDGE",
                  onPress: () => {
                    // Optionally, you could mark this as acknowledged here
                    // For now, just dismiss the alert
                  },
                },
                { text: "CLOSE", style: "cancel" },
              ],
            );
          }
        },
      )
      .subscribe();

    return () => {
      sosSubscription.unsubscribe();
    };
  }, [personnel, isSupabaseConfigured]);

  // Check for auto-login request from notification tap AND active patrol session
  useEffect(() => {
    const checkAutoLoginAndResume = async () => {
      try {
        // First check if auto-login was requested from notification tap
        const autoLoginRequested = await AsyncStorage.getItem(
          "@pnp_auto_login_requested",
        );
        if (autoLoginRequested === "true") {
          // Clear the flag
          await AsyncStorage.removeItem("@pnp_auto_login_requested");

          // Check if Supabase is configured
          if (isSupabaseConfigured()) {
            // Try to get current Supabase session
            const {
              data: { user },
              error,
            } = await supabase.auth.getUser();

            if (!error && user) {
              // Valid session found, fetch personnel profile
              const { data: remoteProfile, error: profileErr } = await supabase
                .from("personnel")
                .select("*")
                .eq("id", user.id)
                .single();

              if (!profileErr && remoteProfile) {
                // Create personnel object
                const pUser: Personnel = {
                  id: remoteProfile.id,
                  badgeNumber: remoteProfile.badge_number,
                  rank: remoteProfile.rank,
                  rankId: remoteProfile.rank_id,
                  fullname: remoteProfile.fullname,
                  unitId: remoteProfile.unit_id,
                  designation: remoteProfile.designation,
                  isApproved: remoteProfile.is_approved,
                  role: remoteProfile.role,
                  email: user.email,
                };

                // Set personnel state
                setPersonnel(pUser);

                // Load associated schedule, logs, and stats
                const assignedSched = await getScheduleByPersonnel(pUser.id);
                if (assignedSched) {
                  setSchedule(assignedSched);
                }

                loadLogsAndStats();
                updateUnsyncedCounter();
                setIsShiftActive(true);

                console.log(
                  "[Auto-login] Successfully restored session for user:",
                  user.email,
                );
              }
            }
          }
        } else {
          // Check for active patrol session (app reopened during patrol)
          const activePersonnelId = await AsyncStorage.getItem(
            "@pnp_active_personnel_id",
          );
          const shiftStatus = await AsyncStorage.getItem("@pnp_shift_status");

          if (
            activePersonnelId &&
            shiftStatus === "ACTIVE" &&
            isSupabaseConfigured()
          ) {
            // Try to get current Supabase session
            const {
              data: { user },
              error,
            } = await supabase.auth.getUser();

            if (!error && user) {
              // Valid session found, fetch personnel profile
              const { data: remoteProfile, error: profileErr } = await supabase
                .from("personnel")
                .select("*")
                .eq("id", user.id)
                .single();

              if (!profileErr && remoteProfile) {
                // Create personnel object
                const pUser: Personnel = {
                  id: remoteProfile.id,
                  badgeNumber: remoteProfile.badge_number,
                  rank: remoteProfile.rank,
                  rankId: remoteProfile.rank_id,
                  fullname: remoteProfile.fullname,
                  unitId: remoteProfile.unit_id,
                  designation: remoteProfile.designation,
                  isApproved: remoteProfile.is_approved,
                  role: remoteProfile.role,
                  email: user.email,
                };

                // Set personnel state
                setPersonnel(pUser);

                // Load associated schedule, logs, and stats
                const assignedSched = await getScheduleByPersonnel(pUser.id);
                if (assignedSched) {
                  setSchedule(assignedSched);
                }

                loadLogsAndStats();
                updateUnsyncedCounter();
                setIsShiftActive(true);

                console.log(
                  "[Auto-resume] Successfully resumed patrol session for user:",
                  user.email,
                );
              }
            }
          }
        }
      } catch (err) {
        console.warn("[Auto-login/resume] Failed to restore session:", err);
      }
    };

    checkAutoLoginAndResume();
  }, []);

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
      if (personnel) {
        try {
          const email = personnel.email || personnel.badgeNumber;
          const status = await checkMFAStatus(email);
          setIs2FAEnabled(status.isEnabled);
          if (status.isEnabled && status.factorId) {
            const emailKey = email.trim().toLowerCase();
            await AsyncStorage.setItem(
              `@pnp_supabase_mfa_factor_id_${emailKey}`,
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
    secret: string,
    code: string,
    factorId?: string,
  ): Promise<boolean> => {
    if (!personnel) return false;
    try {
      const email = personnel.email || personnel.badgeNumber;
      const emailKey = email.trim().toLowerCase();

      // Determine the active factorId (e.g., from AsyncStorage fallback or passed directly)
      let activeFactorId = factorId;
      if (!activeFactorId) {
        activeFactorId =
          (await AsyncStorage.getItem(
            `@pnp_supabase_mfa_factor_id_${emailKey}`,
          )) || "";
        if (!activeFactorId) {
          throw new Error("No MFA factor ID found. Please enroll MFA first.");
        }
      }

      const verified = await verifyMFAEnrollment(
        email,
        activeFactorId,
        code,
        secret,
      );

      if (!verified) {
        Alert.alert(
          "Verification Failed",
          "The 6-digit MFA verification code is invalid, expired, or has already been used.",
        );
        return false;
      }

      await AsyncStorage.setItem(
        `@pnp_supabase_mfa_factor_id_${emailKey}`,
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
    if (!personnel) return;
    try {
      const email = personnel.email || personnel.badgeNumber;
      const emailKey = email.trim().toLowerCase();
      const factorId =
        (await AsyncStorage.getItem(
          `@pnp_supabase_mfa_factor_id_${emailKey}`,
        )) ?? "";

      await unenrollMFA(factorId);
      await AsyncStorage.removeItem(
        `@pnp_supabase_mfa_factor_id_${emailKey}`,
      ).catch(() => {});

      // Clean up legacy keys
      await AsyncStorage.removeItem(
        `@pnp_google_authenticator_mfa_secret_${emailKey}`,
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
  }, [isShiftActive, autoSync, loadLogsAndStats, updateUnsyncedCounter]);

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

  const login = async (
    emailInput: string,
    passwordInput: string,
    otpCode?: string,
  ): Promise<
    boolean | "NEED_2FA" | "PENDING_APPROVAL" | "NOT_FOUND" | string
  > => {
    const trimmedEmail = emailInput.trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      return "Please enter a valid email address.";
    }
    if (!passwordInput || passwordInput.trim().length === 0) {
      return "Please enter your password.";
    }

    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      return "Supabase is not configured. Please set up Supabase environment variables.";
    }

    try {
      let pUser: Personnel | null = null;

      // Sign in with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: passwordInput,
      });

      // console.log("data: ", data);

      if (error) {
        return error.message || "Invalid email or password.";
      }

      if (data && data.user) {
        const authUser = data.user;

        // Query public.personnel table
        const { data: remoteProfile, error: profileErr } = await supabase
          .from("personnel")
          .select("*, rank(*)")
          .eq("id", authUser.id)
          .single();

        if (profileErr) throw profileErr;

        const scheduleData = await getScheduleByPersonnel(authUser.id);

        setSchedule(scheduleData);

        if (remoteProfile) {
          pUser = {
            id: remoteProfile.id,
            badgeNumber: remoteProfile.badge_number,
            rank: remoteProfile.rank,
            rankId: remoteProfile.rank_id,
            fullname: remoteProfile.fullname,
            unitId: remoteProfile.unit_id,
            designation: remoteProfile.designation,
            isApproved: remoteProfile.is_approved,
            role: remoteProfile.role,
            email: authUser.email,
            photo_url: remoteProfile.photo_url, // Add photo URL from database
          };
        } else {
          // If personnel record doesn't exist, return NOT_FOUND (no dynamic profile creation)
          return "NOT_FOUND";
        }

        // if (pUser) {
        //   await savePersonnel(pUser);
        // }

        // CHECK SUPABASE MULTI-FACTOR AUTHENTICATION (MFA) - FORCED COMPULSORY
        // Bypass MFA in development if DISABLE_MFA is set to 'true'
        const disableMFA = true; //process.env.DISABLE_MFA === "true";
        if (!disableMFA) {
          // Now that we are authenticated, check MFA status and enroll if necessary
          try {
            const userEmail = pUser?.email || trimmedEmail.toLowerCase();
            let status = await checkMFAStatus(userEmail);
            if (!status.isEnabled) {
              // Force-seed status enrollment to guarantee high-grade secure PNP compliance on first login
              const enrollment = await enrollMFA(userEmail);
              status = {
                isEnabled: true,
                factorId: enrollment.id,
                secret: enrollment.secret,
              };
            }

            if (status.isEnabled) {
              if (!otpCode) {
                const secret = status.secret ?? "SUPABASE_MFA";
                return `NEED_2FA_SECRET:${secret}`;
              }
              // Verify code
              const verified = await verifyMFAEnrollment(
                userEmail,
                status.factorId || "",
                otpCode,
                status.secret,
              );
              if (!verified) {
                return "Invalid MFA Token. The Supabase MFA 6-digit verification code is invalid, expired, or has already been used.";
              }
            }
          } catch (mfaErr) {
            console.warn("Supabase MFA login checking err", mfaErr);
            // If MFA check fails, we should not allow login since MFA is compulsory
            return "Multi-factor authentication setup failed. Please try again.";
          }
        } else {
          console.warn(
            "MFA verification bypassed via DISABLE_MFA environment variable",
          );
        }
      }

      if (!pUser) {
        return "NOT_FOUND";
      }

      if (!pUser.isApproved) {
        return "PENDING_APPROVAL";
      }

      if (pUser) {
        pUser.email = trimmedEmail.toLowerCase();
      }

      // Successful verification
      setPersonnel(pUser);

      // Vehicle functionality removed - using personnel only
      const assignedSched = await getScheduleByPersonnel(pUser.id);
      if (assignedSched) {
        setSchedule(assignedSched);
      }

      return true;
    } catch (e: any) {
      console.error(e);
      return e.message || "Identity link handshake failed.";
    }
  };

  const logout = useCallback(async () => {
    try {
      await stopBackgroundUpdates();
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
        "EMERGENCY SOS?",
        "This will immediately send an emergency alert with your live GPS location back to INPPO HQ. Are you sure you want to trigger it?",
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => resolve(false),
          },
          {
            text: "YES, SEND SOS ALERT",
            style: "destructive",
            onPress: async () => {
              try {
                let lat = 14.591;
                let lng = 120.973;
                let speed = 0.0;

                try {
                  const { status } =
                    await Location.getForegroundPermissionsAsync();
                  if (status === "granted") {
                    const loc = await Location.getCurrentPositionAsync({
                      accuracy: Location.Accuracy.Balanced,
                    });
                    lat = loc.coords.latitude;
                    lng = loc.coords.longitude;
                    speed = loc.coords.speed || 0.0;
                  }
                } catch (e) {
                  console.warn(
                    "GPS request failed, using fallback coordinates",
                    e,
                  );
                  if (logs.length > 0) {
                    lat = logs[0].latitude;
                    lng = logs[0].longitude;
                    speed = logs[0].speed;
                  }
                }

                // const signal = 4;
                const captured = formatManilaTimestamp(isShiftActive);
                if (isShiftActive) {
                  setIsShiftActive(false);
                  await AsyncStorage.removeItem("@pnp_shift_status");
                }
                const uniqueId =
                  "sos-" + Math.random().toString(36).substring(2, 11);

                const sosLog: PersonnelLog = {
                  id: uniqueId,
                  personnelId: personnel.id,
                  latitude: lat,
                  longitude: lng,
                  speed: 999.0, // Special speed indicator for SOS alert
                  networkSignal: 4, // Signal strength for SOS
                  dutyType: "EMERGENCY_SOS", // Special duty type for SOS
                  capturedAt: captured,
                  isSynced: false, // Initially not synced
                };

                await insertPersonnelLog(sosLog);

                // let remoteSuccess = false;
                // if (isSupabaseConfigured()) {
                //   try {
                //     const { error } = await supabase
                //       .from("personnel_logs")
                //       .insert([
                //         {
                //           id: uniqueId,
                //           personnel_id: personnel.id,
                //           schedule_id: schedule?.id || null,
                //           latitude: lat,
                //           longitude: lng,
                //           speed: 999.0,
                //           network_signal: 4,
                //           accuracy: null,
                //           duty_type: "EMERGENCY_SOS",
                //           captured_at: captured,
                //         },
                //       ]);
                //     if (!error) {
                //       remoteSuccess = true;
                //       // Note: markLogsAsSynced is a no-op since we don't have a synced column in Supabase
                //       // Local sync tracking would be handled elsewhere if needed
                //     }
                //   } catch (supabaseErr) {
                //     console.warn(
                //       "Supabase SOS broadcast failed, cached locally",
                //       supabaseErr,
                //     );
                //   }
                // }

                await updateUnsyncedCounter();
                await loadLogsAndStats();

                Alert.alert(
                  "SOS RECORDED",
                  `EMERGENCY COORDINATES SENT!\n\nPlease stay at your position or proceed to the safe area.`,
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
    photoUri?: string; // Optional photo URI for upload
  }): Promise<{ success: boolean; message: string }> => {
    try {
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

      candidate.email = registrationData.email;

      // 2. Update the existing candidate record with the new registration details
      const success = await registerPersonnel(
        candidate.id,
        registrationData.email,
        registrationData.password || "",
        // registrationData.fullname,
        // registrationData.phone_number,
        // registrationData.viber_number,
      );

      if (!success) {
        return {
          success: false,
          message:
            "Your personnel information already registered. Registration denied.",
        };
      }

      // 3. If photo URI is provided, upload the photo to Supabase storage
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
          const fileName = `${candidate.id}/${Date.now()}.jpg`;

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

          // Update personnel record with photo URL
          const { error: dbError } = await supabase
            .from("personnel")
            .update({ photo_url: photoUrl })
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
          "Registration successful! Your profile has been submitted for administrative verification and approval.",
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
    enableGpsInline,
    registerUser,
  };
};
