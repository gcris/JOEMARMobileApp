import { useState, useEffect, useCallback } from "react";
import {
  Alert,
  Linking,
  NativeModules,
  NativeEventEmitter,
} from "react-native";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system";
import Constants from "expo-constants";

import FCMModule from "../services/FCM";
import SignalStrengthModule from "../services/SignalStrengthModule";

import { Personnel, Schedule } from "../types";

import {
  getPersonnelById,
  findCandidatePersonnel,
  getScheduleByPersonnel,
  insertPatrolLogs,
} from "../services/database";

import {
  supabase,
  supabaseAdmin,
  isSupabaseConfigured,
} from "../services/supabase";

import {
  enrollMFA,
  verifyMFAChallenge,
  checkMFAStatus,
  unenrollMFA,
} from "../services/supabaseMFA";

const { PatrolService } = NativeModules;

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

interface PatrolStatus {
  running: boolean;
  dutyType: string;
  personnelId: string;
  totalLocations: number;
  unsyncedLocations: number;
  syncedLocations: number;
  startedAt: number;
}

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

export const usePatrolState = () => {
  const [personnel, setPersonnel] = useState<Personnel | null>(null);
  const [schedule, setSchedule] = useState<Schedule[] | null>(null);

  const [patrolStatus, setPatrolStatus] = useState<PatrolStatus>({
    running: false,
    dutyType: "",
    personnelId: "",
    totalLocations: 0,
    unsyncedLocations: 0,
    syncedLocations: 0,
    startedAt: 0,
  });

  const [unsyncedCount, setUnsyncedCount] = useState(0);

  const [isShiftActive, setIsShiftActive] = useState(false);

  const [autoSync, setAutoSync] = useState(true);

  const [isSyncing, setIsSyncing] = useState(false);
  const [isPatrolStarting, setIsPatrolStarting] = useState(false);

  const [is2FAEnabled, setIs2FAEnabled] = useState(false);

  const [gpsLoading, setGpsLoading] = useState(false);

  const [isGpsEnabled, setIsGpsEnabled] = useState(false);

  const [foregroundGranted, setForegroundGranted] = useState<boolean | null>(
    null,
  );

  const [backgroundGranted, setBackgroundGranted] = useState<boolean | null>(
    null,
  );

  const [notificationGranted, setNotificationGranted] = useState<
    boolean | null
  >(null);

  const [activeDutyType, setActiveDutyType] = useState<string | null>(
    "Foot Patrol",
  );

  const [isWithinScheduledTime, setIsWithinScheduledTime] = useState(false);

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
    fcm_token: remoteProfile.fcm_token,
    phoneNumber: remoteProfile.phone_number,
    viberNumber: remoteProfile.viber_number,
  });

  const refreshPatrolStatus = useCallback(async () => {
    try {
      const status = await PatrolService.getPatrolStatus();

      setPatrolStatus(status);
      setIsShiftActive(status.running);
      setUnsyncedCount(status.unsyncedLocations);
      console.log("status.dutyType: ", status.dutyType);
      setActiveDutyType(status.dutyType);
    } catch (e) {
      console.warn(e);
    }
  }, []);

  const updateUnsyncedCounter = useCallback(async () => {
    try {
      const status = await PatrolService.getPatrolStatus();

      setUnsyncedCount(status.unsyncedLocations);
    } catch (e) {
      console.warn(e);
    }
  }, []);

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
      console.warn(e);
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
      console.warn(e);
      return false;
    }
  };

  const enableGpsInline = async () => {
    try {
      setGpsLoading(true);

      await Location.enableNetworkProviderAsync();

      const enabled = await checkLocationPermissionState();
      setIsGpsEnabled(enabled);
      setGpsLoading(false);

      return enabled;
    } catch (e) {
      setGpsLoading(false);
      console.warn(e);
      return false;
    }
  };

  const openSystemSettings = async () => {
    setGpsLoading(true);

    setTimeout(() => {
      setGpsLoading(false);
    }, 2000);

    if (Linking.openSettings) {
      await Linking.openSettings();
    } else {
      Alert.alert("Settings", "Unable to open system settings.");
    }
  };

  const emitter = new NativeEventEmitter(NativeModules.PatrolService);
  useEffect(() => {
    const subscription = emitter.addListener("PATROL_STOPPED", async () => {
      setIsPatrolStarting(true);
      // Wait until PatrolManager reports running
      let running = false;

      for (let i = 0; i < 20; i++) {
        const status = await PatrolService.getPatrolStatus();

        if (status.running) {
          running = true;
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      await updateUnsyncedCounter();
      setIsShiftActive(running);
      setIsPatrolStarting(running);
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    checkLocationPermissionState();

    refreshPatrolStatus();

    const interval = setInterval(() => {
      checkLocationPermissionState();
      refreshPatrolStatus();
    }, 15000);

    return () => clearInterval(interval);
  }, [checkLocationPermissionState, refreshPatrolStatus]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const auto = await AsyncStorage.getItem("@pnp_auto_sync");

        if (auto !== null) {
          setAutoSync(auto === "true");
        }
      } catch (e) {
        console.warn(e);
      }
    };

    loadSettings();
  }, []);

  useEffect(() => {
    if (!personnel) return;

    (async () => {
      const sched = await getScheduleByPersonnel(personnel.id);

      if (sched) {
        setSchedule(sched);
      }

      await refreshPatrolStatus();
    })();
  }, [personnel, refreshPatrolStatus]);

  useEffect(() => {
    const timer = setInterval(() => {
      refreshPatrolStatus();
    }, 15000);

    return () => clearInterval(timer);
  }, [refreshPatrolStatus]);

  const toggleAutoSync = async () => {
    try {
      const next = !autoSync;

      setAutoSync(next);

      await AsyncStorage.setItem("@pnp_auto_sync", String(next));
    } catch (e) {
      console.warn(e);
    }
  };

  const checkIfWithinScheduledTime = useCallback(() => {
    if (!schedule || schedule.length === 0) {
      setIsWithinScheduledTime(false);
      setActiveDutyType(null);
      return false;
    }

    const now = new Date();
    const today = now.toISOString().split("T")[0];

    let active = false;
    let duty: string | null = null;

    for (const item of schedule) {
      if (item.date !== today) continue;

      const [fh, fm] = item.timeFrom.split(":").map(Number);

      const [th, tm] = item.timeTo.split(":").map(Number);

      const start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        fh,
        fm,
      );

      const end = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        th,
        tm,
      );

      if (end <= start) {
        end.setDate(end.getDate() + 1);
      }

      if (now >= start && now < end) {
        active = true;
        duty = item.duty_type;
        break;
      }
    }

    setIsWithinScheduledTime(active);
    setActiveDutyType(duty);

    return active;
  }, [schedule]);

  const completeLogin = async (pUser: Personnel, emailInput: string) => {
    setPersonnel(pUser);

    const assignedSched = await getScheduleByPersonnel(pUser.id);

    if (assignedSched) {
      setSchedule(assignedSched);
    }

    await refreshPatrolStatus();

    try {
      const token = await FCMModule.getToken();

      await supabase
        .from("personnel")
        .update({
          fcm_token: token,
        })
        .eq("id", pUser.id);

      await AsyncStorage.setItem("@pnp_user_name", emailInput);
    } catch (err) {
      console.warn("Error: ", err);
    }
  };

  const login = async (
    emailInput: string,
    passwordInput: string,
    otpCode?: string,
  ): Promise<LoginResult> => {
    const email = emailInput.trim().toLowerCase();

    if (!email || !email.includes("@")) {
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
        message: "Supabase is not configured.",
      };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
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

      const { data: remoteProfile, error: profileErr } = await supabase
        .from("personnel")
        .select("*, rank(*), unit(*)")
        .eq("id", authUser.id)
        .maybeSingle();

      if (profileErr) {
        throw profileErr;
      }

      if (!remoteProfile) {
        return {
          status: "NOT_FOUND",
        };
      }

      const pUser = buildPersonnel(remoteProfile, authUser.email ?? email);

      if (!pUser.isApproved) {
        return {
          status: "PENDING_APPROVAL",
        };
      }

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId;

      if (!projectId) {
        throw new Error("EAS Project ID not found.");
      }

      const status = await checkMFAStatus(email);

      if (!status.isEnabled) {
        const enrollment = await enrollMFA(email);

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

      await completeLogin(pUser, emailInput);

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
      if (patrolStatus.running) {
        await PatrolService.stopService();
      }

      await supabase.auth.signOut();

      await AsyncStorage.multiRemove([
        PENDING_MFA_USER_ID_KEY,
        PENDING_MFA_PERSONNEL_KEY,
        "@pnp_user_name",
      ]);
    } catch (e) {
      console.warn(e);
    }

    setPersonnel(null);
    setSchedule(null);
    setIsShiftActive(false);

    setPatrolStatus({
      running: false,
      dutyType: "",
      personnelId: "",
      totalLocations: 0,
      unsyncedLocations: 0,
      syncedLocations: 0,
      startedAt: 0,
    });
  }, [patrolStatus.running]);

  const triggerEmergencySOS = async (): Promise<boolean> => {
    if (!personnel) {
      Alert.alert(
        "Authentication Error",
        "You must be logged in to send an SOS.",
      );
      return false;
    }

    const isSilent =
      activeDutyType === "Intel-Driven Operation" ||
      activeDutyType === "Special Laws";

    if (isSilent) {
      try {
        const signal = await SignalStrengthModule.getSignalStrength();

        const result = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
        });

        await insertPatrolLogs([
          {
            id: "", //crypto.randomUUID(),
            personnelId: personnel.id,
            personnel: {
              fullname: personnel.fullname,
              rank_name: personnel.rank?.rank_name ?? "",
            },
            latitude: result.coords.latitude,
            longitude: result.coords.longitude,
            speed: result.coords.speed ?? 0,
            networkSignal: signal.level,
            dutyType: activeDutyType,
            capturedAt: formatManilaTimestamp(true),
            isSynced: false,
          },
        ]);

        await updateUnsyncedCounter();

        return true;
      } catch (e) {
        console.error(e);
        return false;
      }
    }

    return new Promise<boolean>((resolve) => {
      Alert.alert(
        "DISTRESS SIGNAL",
        "This will immediately send an emergency alert with your live GPS location back to Headquarters.",
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => resolve(false),
          },
          {
            text: "Send",
            style: "destructive",
            onPress: async () => {
              try {
                const signal = await SignalStrengthModule.getSignalStrength();

                const location = await Location.getCurrentPositionAsync({
                  accuracy: Location.Accuracy.BestForNavigation,
                });

                await insertPatrolLogs([
                  {
                    id: "", //crypto.randomUUID(),
                    personnelId: personnel.id,
                    personnel: {
                      fullname: personnel.fullname,
                      rank_name: personnel.rank?.rank_name ?? "",
                    },
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    speed: location.coords.speed ?? 0,
                    networkSignal: signal.level,
                    dutyType: "EMERGENCY_SOS",
                    capturedAt: formatManilaTimestamp(true),
                    isSynced: false,
                  },
                ]);

                await updateUnsyncedCounter();

                Alert.alert(
                  "SOS Sent",
                  "Emergency signal transmitted successfully.",
                );

                resolve(true);
              } catch (e: any) {
                console.error(e);

                Alert.alert("SOS Failed", e.message ?? "Unable to send SOS.");

                resolve(false);
              }
            },
          },
        ],
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
    photoUri: string;
  }): Promise<{ success: boolean; message: string }> => {
    try {
      const token = await FCMModule.getToken();

      const candidate = await findCandidatePersonnel(
        registrationData.badge_number,
        registrationData.rank_id,
        registrationData.unit_id,
        registrationData.designation,
      );

      if (!candidate) {
        return {
          success: false,
          message: "Personnel record not found.",
        };
      }

      const { error: authError } = await supabaseAdmin.auth.admin.createUser({
        id: candidate.id,
        email: registrationData.email,
        password: registrationData.password ?? "",
        email_confirm: true,
      });

      if (authError) throw authError;

      if (registrationData.photoUri) {
        const resized = await manipulateAsync(
          registrationData.photoUri,
          [{ resize: { width: 800 } }],
          {
            compress: 0.7,
            format: SaveFormat.JPEG,
          },
        );

        const base64 = await FileSystem.readAsStringAsync(resized.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const fileName = `${Date.now()}.jpg`;

        const { data, error } = await supabase.storage
          .from("personnel-photos")
          .upload(fileName, decode(base64), {
            contentType: "image/jpeg",
            upsert: true,
          });

        if (error) throw error;

        const { data: url } = supabase.storage
          .from("personnel-photos")
          .getPublicUrl(data.path);

        await supabase
          .from("personnel")
          .update({
            photo_url: url.publicUrl,
            fcm_token: token,
          })
          .eq("id", candidate.id);
      }

      return {
        success: true,
        message: "Registration successful.",
      };
    } catch (e: any) {
      console.error(e);

      return {
        success: false,
        message: e.message,
      };
    }
  };

  const refreshPersonnel = useCallback(async () => {
    if (!personnel) return;

    const latest = await getPersonnelById(personnel.id);

    if (!latest) return;

    setPersonnel(latest);

    const sched = await getScheduleByPersonnel(latest.id);

    if (sched) {
      setSchedule(sched);
    }

    await refreshPatrolStatus();
  }, [personnel, refreshPatrolStatus]);

  const toggleShift = async () => {
    if (!personnel) return;

    const gpsOk = await checkLocationPermissionState();

    if (!gpsOk) {
      Alert.alert(
        "GPS Required",
        "CANNOT START PATROL: Please enable your system GPS / Location switch first.",
        [
          {
            text: "Turn on GPS in Settings",
            onPress: openSystemSettings,
          },
          {
            text: "Cancel",
            style: "cancel",
          },
        ],
      );

      return;
    }

    try {
      setIsPatrolStarting(true);
      const status = await PatrolService.getPatrolStatus();

      var stopped = false;
      if (status.running) {
        await PatrolService.stopService();
        stopped = true;
      } else {
        console.log(
          "activeDutyType: ",
          activeDutyType,
          "personnel.id: ",
          personnel.id,
        );
        await PatrolService.startPatrol(activeDutyType ?? "", personnel.id);
      }

      // Wait until PatrolManager reports running
      let running = false;

      for (let i = 0; i < 20; i++) {
        const status = await PatrolService.getPatrolStatus();

        if (status.running) {
          running = true;
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      Alert.alert(
        stopped ? "Patrol Stopped" : "Patrol Started",
        stopped
          ? "Your patrol has been stopped."
          : "Background patrol tracking is now active.",
      );

      await refreshPatrolStatus();
      setIsPatrolStarting(false);
    } catch (err: any) {
      Alert.alert(
        "Service Error",
        err.message ?? "Unable to control patrol service.",
      );
      setIsPatrolStarting(false);
    }
  };

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

  const syncLogsWithRemote = async (showPromptAndAlerts: boolean = true) => {
    if (isSyncing) return;
    setIsSyncing(true);

    try {
      var uploaded = await PatrolService.uploadUnsyncedLogs();

      Alert.alert(
        uploaded > 0 ? "Successfully uploaded" : "Up to Date",
        uploaded > 0
          ? "Your logs has been successfully uploaded to the database."
          : "No pending coordinate logs inside local storage cache require syncing.",
      );

      await refreshPatrolStatus();
      setIsSyncing(false);
    } catch (error) {
      setIsSyncing(false);
      console.error(error);
    }
  };

  return {
    personnel,
    schedule,
    unsyncedCount,
    patrolStatus,

    isGpsEnabled,
    foregroundGranted,
    backgroundGranted,
    gpsLoading,

    isSyncing,
    isPatrolStarting,
    autoSync,
    is2FAEnabled,

    login,
    logout,

    toggleShift,

    refreshPatrolStatus,
    syncLogsWithRemote,

    requestForegroundPermission,
    requestBackgroundPermission,

    enableGpsInline,
    openSystemSettings,

    toggleAutoSync,

    enable2FA,
    disable2FA,

    registerUser,
    refreshPersonnel,

    triggerEmergencySOS,

    activeDutyType,
    setActiveDutyType,
  };
};
