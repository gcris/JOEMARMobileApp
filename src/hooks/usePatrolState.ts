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

import { Personnel, PersonnelLog, Schedule } from "../types";

import {
  getPersonnelById,
  findCandidatePersonnel,
  getScheduleByPersonnel,
  insertPatrolLogs,
  getPatrolLogs,
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

  return `${manilaDate.getFullYear()}-${pad(manilaDate.getMonth() + 1)}-${pad(
    manilaDate.getDate(),
  )}T${pad(manilaDate.getHours())}:${pad(manilaDate.getMinutes())}:${pad(
    manilaDate.getSeconds(),
  )}Z`;
};

export const usePatrolState = () => {
  // ============================================================
  // PERSONNEL / SCHEDULE
  // ============================================================

  const [personnel, setPersonnel] = useState<Personnel | null>(null);

  const [schedule, setSchedule] = useState<Schedule[] | null>(null);

  // ============================================================
  // LOCAL PERSONNEL LOGS
  // ============================================================

  const [personnelLogs, setPersonnelLogs] = useState<PersonnelLog[]>([]);

  // ============================================================
  // PATROL STATUS
  // ============================================================

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

  // ============================================================
  // GPS
  // ============================================================

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

  // ============================================================
  // DUTY
  // ============================================================

  const [activeDutyType, setActiveDutyType] = useState<string | null>(
    "Foot Patrolling",
  );

  const [isWithinScheduledTime, setIsWithinScheduledTime] = useState(false);

  // ============================================================
  // BUILD PERSONNEL
  // ============================================================

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

  // ============================================================
  // LOAD PERSONNEL LOGS
  // ============================================================

  const loadPersonnelLogs = useCallback(
    async (personnelId?: string) => {
      // typeof check: a click handler may pass an event object as the argument
      const id = typeof personnelId === "string" ? personnelId : personnel?.id;

      if (!id) {
        setPersonnelLogs([]);
        return;
      }

      try {
        const logs = await getPatrolLogs(id);
        setPersonnelLogs(Array.isArray(logs) ? logs : []);
      } catch (error) {
        console.error("Failed to load personnel logs:", error);
        setPersonnelLogs([]);
      }
    },
    [personnel?.id],
  );

  // ============================================================
  // REFRESH PATROL STATUS
  // ============================================================

  const refreshPatrolStatus = useCallback(async () => {
    try {
      const status = await PatrolService.getPatrolStatus();

      setPatrolStatus(status);
      setIsShiftActive(status.running);
      setUnsyncedCount(status.unsyncedLocations);
      // Only update when native side returns a non-empty duty type;
      // stopPatrol() leaves dutyType intact, so an empty value means
      // no change from the UI selection and should not overwrite it.
      if (status.dutyType) {
        setActiveDutyType(status.dutyType);
      }
    } catch (e) {
      console.warn(e);
    }
  }, []);

  // ============================================================
  // UPDATE UNSYNCED COUNTER
  // ============================================================

  const updateUnsyncedCounter = useCallback(async () => {
    try {
      const status = await PatrolService.getPatrolStatus();

      setUnsyncedCount(status.unsyncedLocations);
    } catch (e) {
      console.warn(e);
    }
  }, []);

  // ============================================================
  // LOCATION PERMISSION
  // ============================================================

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

  // ============================================================
  // PATROL SERVICE EVENTS
  // ============================================================

  const emitter = new NativeEventEmitter(NativeModules.PatrolService);

  useEffect(() => {
    const subscription = emitter.addListener("PATROL_STOPPED", async () => {
      setIsPatrolStarting(true);

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

      // Refresh recent logs whenever patrol
      // service reports a change.
      await loadPersonnelLogs();

      setIsShiftActive(running);
      setIsPatrolStarting(running);
    });

    return () => subscription.remove();
  }, [updateUnsyncedCounter, loadPersonnelLogs]);

  // ============================================================
  // INITIAL GPS / PATROL STATUS (also refreshes every 15 seconds)
  // ============================================================

  useEffect(() => {
    checkLocationPermissionState();

    refreshPatrolStatus();

    loadPersonnelLogs();

    const interval = setInterval(() => {
      checkLocationPermissionState();
      refreshPatrolStatus();
    }, 15000);

    return () => clearInterval(interval);
  }, [checkLocationPermissionState, refreshPatrolStatus, loadPersonnelLogs]);

  // ============================================================
  // SETTINGS
  // ============================================================

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

  // ============================================================
  // LOAD SCHEDULE WHEN PERSONNEL CHANGES
  // ============================================================

  useEffect(() => {
    if (!personnel) return;

    (async () => {
      const sched = await getScheduleByPersonnel(personnel.id);

      if (sched) {
        setSchedule(sched);
      }

      await refreshPatrolStatus();

      // Refresh logs for the currently
      // authenticated personnel.
      await loadPersonnelLogs();
    })();
  }, [personnel, refreshPatrolStatus, loadPersonnelLogs]);

  // (The duplicate "PATROL STATUS REFRESH" 15-second timer was removed:
  //  the effect above already refreshes the status every 15 seconds.)

  // ============================================================
  // CHECK SCHEDULED TIME
  // ============================================================

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

  // ============================================================
  // COMPLETE LOGIN
  // ============================================================

  const completeLogin = async (pUser: Personnel, emailInput: string) => {
    console.log("pUser: ", pUser);
    setPersonnel(pUser);

    const assignedSched = await getScheduleByPersonnel(pUser.id);

    if (assignedSched) {
      setSchedule(assignedSched);
    }

    await refreshPatrolStatus();

    // Load local patrol logs after login.
    await loadPersonnelLogs(pUser.id);

    try {
      const token = await FCMModule.getToken();

      await supabase
        .from("personnel")
        .update({
          fcm_token: token,
          is_online: true,
        })
        .eq("id", pUser.id);

      await AsyncStorage.setItem("@pnp_user_name", emailInput);
    } catch (err) {
      console.warn("Error: ", err);
    }
  };

  // ============================================================
  // LOGIN
  // ============================================================

  
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

      // Lookup personnel by the new relational link (personnel.user_id → auth.users.id).
      // Legacy accounts that predate this change may still have personnel.id == authUser.id
      // with a null user_id; fall back to that path so existing officers can still log in.
      let { data: remoteProfile, error: profileErr } = await supabase
        .from("personnel")
        .select("*, rank(*), unit:unit!personnel_unit_id_fkey(*)")
        .eq("user_id", authUser.id)
        .maybeSingle();

      // Fallback: legacy account where user_id was never populated — id matched auth UUID
      if (!remoteProfile) {
        const { data: legacyProfile } = await supabase
          .from("personnel")
          .select("*, rank(*), unit:unit!personnel_unit_id_fkey(*)")
          .eq("id", authUser.id)
          .maybeSingle();
        remoteProfile = legacyProfile;
      }

      if (profileErr) throw profileErr;

      if (!remoteProfile) {
        return { status: "NOT_FOUND" };
      }

      const pUser = buildPersonnel(remoteProfile, authUser.email ?? email);

      if (!pUser.isApproved) {
        return { status: "PENDING_APPROVAL" };
      }

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId;

      if (!projectId) {
        throw new Error("EAS Project ID not found.");
      }

      const status = await checkMFAStatus(email);

      // First-time setup or MFA was removed.
      if (!status.isEnabled) {
        await AsyncStorage.removeItem(`@pnp_supabase_mfa_factor_id_${pUser.id}`);

        const enrollment = await enrollMFA(email);

        await AsyncStorage.setItem(PENDING_MFA_USER_ID_KEY, pUser.id);

        await AsyncStorage.setItem(
          PENDING_MFA_PERSONNEL_KEY,
          JSON.stringify({
            id: pUser.id,
            email: pUser.email ?? email,
          }),
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

      // Existing MFA: require the authenticator code.
      if (!otpCode) {
        await AsyncStorage.setItem(PENDING_MFA_USER_ID_KEY, pUser.id);

        await AsyncStorage.setItem(
          PENDING_MFA_PERSONNEL_KEY,
          JSON.stringify({
            id: pUser.id,
            email: pUser.email ?? email,
          }),
        );

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

      console.log("MFA verified; completing login");

      await completeLogin(pUser, email);

      await AsyncStorage.multiRemove([
        PENDING_MFA_USER_ID_KEY,
        PENDING_MFA_PERSONNEL_KEY,
      ]);

      return { status: "SUCCESS" };
    } catch (e: unknown) {
      console.error("Login failed:", e);

      return {
        status: "ERROR",
        message: e instanceof Error ? e.message : "Authentication failed.",
      };
    }
  };


  // ============================================================
  // LOGOUT
  // ============================================================

  const logout = useCallback(async () => {
    try {
      if (patrolStatus.running) {
        await PatrolService.stopService();
      }

      await supabase
        .from("personnel")
        .update({
          is_online: false,
        })
        .eq("id", personnel?.id);

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
    setPersonnelLogs([]);
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

  // ============================================================
  // EMERGENCY SOS
  // ============================================================

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
            id: "",
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

        // Immediately make the new SOS
        // location available to Recent Logs.
        await loadPersonnelLogs();

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
                    id: "",
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

                await loadPersonnelLogs();

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

  // ============================================================
  // REGISTER USER
  // ============================================================

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
  }): Promise<{
    success: boolean;
    message: string;
  }> => {
    try {
      const token = await FCMModule.getToken();

      const candidate = await findCandidatePersonnel(
        registrationData.badge_number,
        registrationData.rank_id,
        registrationData.unit_id,
      );

      if (!candidate) {
        return {
          success: false,
          message: "Personnel record not found.",
        };
      }

      // Create an auth user with a freshly-generated Supabase UUID (do NOT reuse
      // candidate.id — it is the permanent operational ID and must stay unchanged).
      // Then link the personnel row via the new user_id column.
      const { data: createdAuth, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: registrationData.email,
        password: registrationData.password ?? "",
        email_confirm: true,
      });

      if (authError) throw authError;

      const newAuthUserId = createdAuth?.user?.id;
      if (newAuthUserId) {
        await supabase
          .from("personnel")
          .update({ user_id: newAuthUserId, email: registrationData.email })
          .eq("id", candidate.id);
      }

      if (registrationData.photoUri) {
        const resized = await manipulateAsync(
          registrationData.photoUri,
          [
            {
              resize: {
                width: 800,
              },
            },
          ],
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

  // ============================================================
  // REFRESH PERSONNEL
  // ============================================================

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
    await loadPersonnelLogs();
  }, [personnel, refreshPatrolStatus, loadPersonnelLogs]);

  // ============================================================
  // TOGGLE PATROL SHIFT
  // ============================================================

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

      let stopped = false;

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

        await PatrolService.startPatrol(
          activeDutyType ?? "Foot Patrolling",
          personnel.id,
        );
      }

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

      // Reload local logs after changing patrol state.
      await loadPersonnelLogs();

      setIsPatrolStarting(false);
    } catch (err: any) {
      Alert.alert(
        "Service Error",
        err.message ?? "Unable to control patrol service.",
      );

      setIsPatrolStarting(false);
    }
  };

  // ============================================================
  // ENABLE 2FA
  // ============================================================


const toPendingPersonnel = (pUser: Personnel): Personnel => ({
  id: pUser.id,
  badgeNumber: pUser.badgeNumber,
  rank: pUser.rank
    ? {
        id: pUser.rank.id,
        rank_name: pUser.rank.rank_name,
        description: pUser.rank.description,
      }
    : null,
  rankId: pUser.rankId,
  fullname: pUser.fullname,
  unitId: pUser.unitId,
  unit: pUser.unit
    ? {
        id: pUser.unit.id,
        unit_name: pUser.unit.unit_name,
      }
    : null,
  designation: pUser.designation,
  phoneNumber: pUser.phoneNumber,
  viberNumber: pUser.viberNumber,
  isApproved: pUser.isApproved,
  role: pUser.role,
  email: pUser.email,
  photo_url: pUser.photo_url,
  fcm_token: pUser.fcm_token,
});

  


  const enable2FA = async (
    user_id: string,
    code: string,
    factorId?: string,
  ): Promise<boolean> => {
    try {
      console.log("MFA STEP 1: Reading pending user");

      const pendingUserId = await AsyncStorage.getItem(PENDING_MFA_USER_ID_KEY);

      const userId = user_id || pendingUserId || personnel?.id || "";
      const storageKey = `@pnp_supabase_mfa_factor_id_${userId}`;

      console.log("enable2FA args:", {
        user_id,
        userId,
        factorId,
      });

      // Validate the authenticator code.
      if (!code || !/^\d{6}$/.test(code.trim())) {
        Alert.alert(
          "Invalid Code",
          "Enter the six-digit code from your authenticator app.",
        );
        return false;
      }

      // Find the MFA factor.
      console.log("MFA STEP 2: Reading saved factor");

      let activeFactorId =
        factorId || (await AsyncStorage.getItem(storageKey)) || "";

      if (!activeFactorId) {
        console.log("MFA STEP 2A: Looking up MFA factors");

        const { data, error } = await supabase.auth.mfa.listFactors();

        if (error) throw error;

        activeFactorId =
          (data?.all ?? []).find(
            (factor) =>
              factor.factor_type === "totp" && factor.status !== "verified",
          )?.id ?? "";
      }

      if (!activeFactorId) {
        throw new Error(
          "No MFA factor found. Please sign in again to restart setup.",
        );
      }

      // Verify the six-digit authenticator code.
      console.log("MFA STEP 3: Verifying factor", activeFactorId);

      const verified = await verifyMFAChallenge(activeFactorId, code.trim());

      if (!verified) {
        Alert.alert(
          "Verification Failed",
          "The MFA code could not be verified. Check the code and try again.",
        );
        return false;
      }

      console.log("MFA STEP 4: Verification successful");

      // Save the verified factor ID.
      console.log("MFA STEP 5: Saving factor ID");

      if (userId) {
        await AsyncStorage.setItem(storageKey, activeFactorId);
      }

      setIs2FAEnabled(true);

      // Read the compact pending-personnel reference.
      console.log("MFA STEP 6: Reading pending personnel reference");

      const pending = await AsyncStorage.getItem(PENDING_MFA_PERSONNEL_KEY);

      console.log("MFA DEBUG: Pending reference exists:", pending !== null);
      console.log("MFA DEBUG: Personnel already loaded:", !!personnel);

      let pendingEmail = "";

      if (pending) {
        let pendingUser: {
          id?: string;
          email?: string;
        };

        try {
          pendingUser = JSON.parse(pending);
        } catch {
          throw new Error(
            "The pending personnel reference is invalid. Please sign in again.",
          );
        }

        console.log("MFA DEBUG: Pending personnel ID exists:", !!pendingUser.id);

        if (!pendingUser.id) {
          throw new Error(
            "Pending login is missing the personnel ID. Please sign in again.",
          );
        }

        pendingEmail = pendingUser.email ?? "";

        if (!personnel) {
          // Retrieve the full personnel profile from Supabase.
          console.log("MFA STEP 7: Fetching personnel profile");

          const pUser = await getPersonnelById(pendingUser.id);

          if (!pUser) {
            throw new Error(
              "Unable to retrieve your personnel profile. Please sign in again.",
            );
          }

          console.log("MFA STEP 8: Completing login");

          await completeLogin(pUser, pendingEmail || pUser.email || "");
        } else {
          console.log(
            "MFA DEBUG: Personnel already loaded; skipping login recovery",
          );
        }
      } else if (!personnel) {
        // Keep pending-login keys intact so the issue can be diagnosed.
        throw new Error(
          "No pending personnel reference or loaded personnel profile was found. Please sign in again.",
        );
      } else {
        console.log(
          "MFA DEBUG: No pending reference needed; personnel is already loaded",
        );
      }

      // Clear pending keys only after profile recovery succeeds
      // or when a personnel profile is already available.
      console.log("MFA STEP 9: Clearing pending-login keys");

      await AsyncStorage.multiRemove([
        PENDING_MFA_USER_ID_KEY,
        PENDING_MFA_PERSONNEL_KEY,
      ]);

      console.log("MFA STEP 10: MFA setup completed");

      Alert.alert(
        "MFA Secured",
        "Multi-Factor Authentication has been verified and is now active for your officer profile.",
      );

      return true;
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "An error occurred while enabling MFA.";

      console.error("enable2FA failed:", message, e);

      Alert.alert("Setup Error", message);

      return false;
    }
  };



  // ============================================================
  // DISABLE 2FA
  // ============================================================

  const disable2FA = async () => {
    if (!personnel) return;

    try {
      const personnelIdKey = personnel.id;

      // Ask the server which factor is active instead of trusting phone storage
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;

      const factorId = (data?.all ?? []).find(
        (f) => f.factor_type === "totp" && f.status === "verified",
      )?.id;

      if (!factorId) {
        throw new Error("No active MFA factor found.");
      }

      await unenrollMFA(factorId);

      await AsyncStorage.removeItem(
        `@pnp_supabase_mfa_factor_id_${personnelIdKey}`,
      ).catch(() => {});

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
    } catch (e: any) {
      console.error(e);

      Alert.alert(
        "Disable Error",
        e?.message ??
          "An error occurred while disabling Supabase multi-factor authentication.",
      );
    }
  };

  // ============================================================
  // SYNC LOGS
  // ============================================================

  const syncLogsWithRemote = async (showPromptAndAlerts: boolean = true) => {
    if (isSyncing) return;

    setIsSyncing(true);

    try {
      const uploaded = await PatrolService.uploadUnsyncedLogs();

      if (showPromptAndAlerts) {
        Alert.alert(
          uploaded > 0 ? "Successfully uploaded" : "Up to Date",
          uploaded > 0
            ? "Your logs has been successfully uploaded to the database."
            : "No pending coordinate logs inside local storage cache require syncing.",
        );
      }

      await refreshPatrolStatus();

      // IMPORTANT:
      // Refresh the logs after synchronization too.
      await loadPersonnelLogs();

      setIsSyncing(false);
    } catch (error) {
      setIsSyncing(false);

      console.error(error);
    }
  };

  // ============================================================
  // RETURN
  // ============================================================

  return {
    // Personnel
    personnel,

    // Schedule
    schedule,

    // Personnel Logs
    personnelLogs,
    loadPersonnelLogs,

    // Patrol
    unsyncedCount,
    patrolStatus,
    isShiftActive,

    // GPS
    isGpsEnabled,
    foregroundGranted,
    backgroundGranted,
    notificationGranted,
    gpsLoading,

    // Sync
    isSyncing,
    isPatrolStarting,
    autoSync,

    // MFA
    is2FAEnabled,

    // Login / Logout
    login,
    logout,

    // Patrol controls
    toggleShift,
    refreshPatrolStatus,

    // Logs
    syncLogsWithRemote,

    // Permissions
    requestForegroundPermission,
    requestBackgroundPermission,

    // GPS controls
    enableGpsInline,
    openSystemSettings,

    // MFA controls
    enable2FA,
    disable2FA,

    // Registration
    registerUser,

    // Personnel
    refreshPersonnel,

    // SOS
    triggerEmergencySOS,

    // Duty
    activeDutyType,
    setActiveDutyType,

    // Schedule state
    isWithinScheduledTime,
    checkIfWithinScheduledTime,
  };
};
