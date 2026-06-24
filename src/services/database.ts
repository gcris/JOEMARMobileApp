import { supabase, isSupabaseConfigured } from "./supabase";
import { Personnel, Schedule, PersonnelLog } from "../types";
import AsyncStorage from "@react-native-async-storage/async-storage";

// --- Personnel Operations ---
export const getPersonnelByBadge = async (
  badgeNumber: string,
): Promise<Personnel | null> => {
  try {
    const { data, error } = await supabase
      .from("personnel")
      .select(
        "*, rank(*), unit(*), patrol_schedule(*, schedule_assignments(*))",
      )
      .eq("badge_number", badgeNumber)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 means no rows returned
      throw error;
    }

    if (!data) return null;

    return {
      id: data.id,
      badgeNumber: data.badge_number,
      rank: data.rank,
      rankId: data.rank_id,
      fullname: data.fullname,
      unitId: data.unit_id,
      unit: data.unit,
      designation: data.designation,
      phoneNumber: data.phone_number,
      viberNumber: data.viber_number,
      isApproved: data.is_approved,
      role: data.role,
      email: data.email,
    };
  } catch (error) {
    console.error("Error fetching personnel by badge:", error);
    return null;
  }
};

export const getPersonnelByEmail = async (
  email: string,
): Promise<Personnel | null> => {
  try {
    const { data, error } = await supabase
      .from("personnel")
      .select(
        "*, rank(*), unit(*), patrol_schedule(*, schedule_assignments(*))",
      )
      .eq("email", email.toLowerCase())
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    if (!data) return null;

    return {
      id: data.id,
      badgeNumber: data.badge_number,
      rank: data.rank,
      rankId: data.rank_id,
      fullname: data.fullname,
      unitId: data.unit_id,
      unit: data.unit,
      designation: data.designation,
      phoneNumber: data.phone_number,
      viberNumber: data.viber_number,
      isApproved: data.is_approved,
      role: data.role,
      email: data.email,
    };
  } catch (error) {
    console.error("Error fetching personnel by email:", error);
    return null;
  }
};

export const findCandidatePersonnel = async (
  badgeNumber: string,
  rankId: string,
  unitId: string,
  designation: string,
): Promise<Personnel | null> => {
  try {
    const { data, error } = await supabase
      .from("personnel")
      .select(
        "*, rank(*), unit(*), patrol_schedule(*, schedule_assignments(*))",
      )
      .eq("badge_number", badgeNumber.toUpperCase())
      .eq("rank_id", rankId)
      .eq("unit_id", unitId)
      .ilike("designation", `%${designation}%`)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    if (!data) return null;

    return {
      id: data.id,
      badgeNumber: data.badge_number,
      rank: data.rank,
      rankId: data.rank_id,
      fullname: data.fullname,
      unitId: data.unit_id,
      unit: data.unit,
      designation: data.designation,
      phoneNumber: data.phone_number,
      viberNumber: data.viber_number,
      isApproved: data.is_approved,
      role: data.role,
      email: data.email,
    };
  } catch (error) {
    console.error("Error finding candidate personnel:", error);
    return null;
  }
};

export const getPersonnelById = async (
  id: string,
): Promise<Personnel | null> => {
  try {
    const { data, error } = await supabase
      .from("personnel")
      .select(
        "*, rank(*), unit(*), patrol_schedule(*, schedule_assignments(*))",
      )
      .eq("id", id)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    if (!data) return null;

    return {
      id: data.id,
      badgeNumber: data.badge_number,
      rank: data.rank,
      rankId: data.rank_id,
      fullname: data.fullname,
      unitId: data.unit_id,
      unit: data.unit,
      designation: data.designation,
      phoneNumber: data.phone_number,
      viberNumber: data.viber_number,
      isApproved: data.is_approved,
      role: data.role,
      email: data.email,
    };
  } catch (error) {
    console.error("Error fetching personnel by ID:", error);
    return null;
  }
};

export const savePersonnel = async (p: Personnel): Promise<void> => {
  try {
    const { error } = await supabase.from("personnel").upsert(
      {
        id: p.id,
        badge_number: p.badgeNumber,
        rank: p.rank,
        rank_id: p.rankId,
        fullname: p.fullname,
        unit_id: p.unitId,
        designation: p.designation,
        phone_number: p.phoneNumber,
        viber_number: p.viberNumber,
        is_approved: p.isApproved ? 1 : 0,
        role: p.role,
        email: p.email,
      },
      {
        onConflict: "id",
      },
    );

    if (error) throw error;
  } catch (error) {
    console.error("Error saving personnel:", error);
    throw error;
  }
};

// --- Ranks and Units Operations ---
export const getRanks = async (): Promise<
  { id: string; rankName: string }[]
> => {
  try {
    const { data, error } = await supabase
      .from("rank")
      .select("id, rank_name")
      .order("rank_name");

    if (error) throw error;
    return (data || []).map((rank) => ({
      id: rank.id,
      rankName: rank.rank_name,
    }));
  } catch (error) {
    console.error("Error fetching ranks:", error);
    return [];
  }
};

export const getUnits = async (): Promise<
  { id: string; unitName: string }[]
> => {
  try {
    const { data, error } = await supabase
      .from("unit")
      .select("id, unit_name")
      .order("unit_name");

    if (error) throw error;
    return (data || []).map((unit) => ({
      id: unit.id,
      unitName: unit.unit_name,
    }));
  } catch (error) {
    console.error("Error fetching units:", error);
    return [];
  }
};

export const getUnitById = async (unitId: string): Promise<any> => {
  try {
    const { data, error } = await supabase
      .from("unit")
      .select("*")
      .eq("id", unitId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    return data;
  } catch (error) {
    console.error("Error fetching unit by ID:", error);
    return null;
  }
};

// --- Schedule Operations ---
export const getScheduleByPersonnel = async (
  personnelId: string,
): Promise<Schedule | null> => {
  try {
    const { data, error } = await supabase
      .from("patrol_schedule")
      .select("*, schedule_assignments (*)")
      .eq("schedule_assignments.personnel_id", personnelId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    if (!data) return null;

    return {
      id: data.id,
      date: data.date,
      timeFrom: data.time_from,
      timeTo: data.time_to,
      sector: data.sector,
      unitId: data.unit_id,
      personnelId: data.personnel_id,
    };
  } catch (error) {
    console.error("Error fetching schedule by personnel:", error);
    return null;
  }
};

// Local storage key for personnel logs
const LOCAL_LOGS_KEY = "@pnp_personnel_logs";

// --- Log Operations ---
export const insertPersonnelLog = async (log: PersonnelLog): Promise<void> => {
  // Try to insert into Supabase first if configured
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase.from("personnel_logs").insert({
        personnel_id: log.personnelId,
        latitude: log.latitude,
        longitude: log.longitude,
        speed: log.speed,
        network_signal: log.networkSignal,
        duty_type: log.dutyType,
        captured_at: log.capturedAt,
      });

      if (!error) {
        // Successfully inserted into Supabase, no need for local storage
        return;
      }

      // If Supabase fails, fall back to local storage
      console.warn("Failed to insert log into Supabase, falling back to local storage:", error);
    } catch (error) {
      console.warn("Failed to insert log into Supabase, falling back to local storage:", error);
    }
  }

  // Fall back to local storage
  try {
    // Get existing logs from local storage
    const existingLogsJson = await AsyncStorage.getItem(LOCAL_LOGS_KEY);
    const existingLogs: PersonnelLog[] = existingLogsJson ? JSON.parse(existingLogsJson) : [];

    // Add new log
    const updatedLogs = [...existingLogs, log];

    // Save back to local storage
    await AsyncStorage.setItem(LOCAL_LOGS_KEY, JSON.stringify(updatedLogs));
  } catch (error) {
    console.error("Error storing log in local storage:", error);
    throw error;
  }
};

export const getUnsyncedLogs = async (): Promise<PersonnelLog[]> => {
  try {
    // Get unsynced logs from local storage
    const localLogsJson = await AsyncStorage.getItem(LOCAL_LOGS_KEY);
    const localLogs: PersonnelLog[] = localLogsJson ? JSON.parse(localLogsJson) : [];

    // Filter to only unsynced logs from local storage
    const unsyncedLocalLogs = localLogs.filter(log => !log.isSynced);

    return unsyncedLocalLogs;
  } catch (error) {
    console.error("Error fetching unsynced logs:", error);
    return [];
  }
};

export const getLatestLogs = async (limit = 100): Promise<PersonnelLog[]> => {
  try {
    // Get latest logs from Supabase
    const { data: supabaseData, error: supabaseError } = await supabase
      .from("personnel_logs")
      .select("*")
      .order("captured_at", { ascending: false })
      .limit(limit);

    if (supabaseError) throw supabaseError;

    // Convert Supabase logs to PersonnelLog format with isSynced = true
    const supabaseLogs: PersonnelLog[] = (supabaseData || []).map((log) => ({
      id: log.id,
      personnelId: log.personnel_id,
      scheduleId: log.schedule_id,
      latitude: log.latitude,
      longitude: log.longitude,
      speed: log.speed,
      networkSignal: log.network_signal,
      accuracy: log.accuracy,
      dutyType: log.duty_type,
      capturedAt: log.captured_at,
      isSynced: true, // Logs in Supabase are considered synced
    }));

    // Get logs from local storage
    const localLogsJson = await AsyncStorage.getItem(LOCAL_LOGS_KEY);
    const localLogs: PersonnelLog[] = localLogsJson ? JSON.parse(localLogsJson) : [];

    // Combine Supabase and local logs, then sort by capturedAt descending and limit
    const allLogs = [...supabaseLogs, ...localLogs];
    const sortedLogs = allLogs.sort(
      (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
    );

    return sortedLogs.slice(0, limit);
  } catch (error) {
    console.error("Error fetching latest logs:", error);
    return [];
  }
};

export const getUnsyncedCount = async (): Promise<number> => {
  try {
    // Get unsynced count from local storage
    const localLogsJson = await AsyncStorage.getItem(LOCAL_LOGS_KEY);
    const localLogs: PersonnelLog[] = localLogsJson ? JSON.parse(localLogsJson) : [];

    // Count unsynced logs from local storage
    const unsyncedCount = localLogs.filter(log => !log.isSynced).length;

    return unsyncedCount;
  } catch (error) {
    console.error("Error fetching unsynced count:", error);
    return 0;
  }
};

export const markLogsAsSynced = async (logIds: string[]): Promise<void> => {
  if (logIds.length === 0) return;

  try {
    // Get existing logs from local storage
    const existingLogsJson = await AsyncStorage.getItem(LOCAL_LOGS_KEY);
    const existingLogs: PersonnelLog[] = existingLogsJson ? JSON.parse(existingLogsJson) : [];

    // Mark specified logs as synced
    const updatedLogs = existingLogs.map(log =>
      logIds.includes(log.id) ? { ...log, isSynced: true } : log
    );

    // Save back to local storage
    await AsyncStorage.setItem(LOCAL_LOGS_KEY, JSON.stringify(updatedLogs));
  } catch (error) {
    console.error("Error marking logs as synced:", error);
    throw error;
  }
};

export const cleanSyncedLogs = async (): Promise<void> => {
  try {
    // Get existing logs from local storage
    const existingLogsJson = await AsyncStorage.getItem(LOCAL_LOGS_KEY);
    const existingLogs: PersonnelLog[] = existingLogsJson ? JSON.parse(existingLogsJson) : [];

    // Filter out synced logs (keep only unsynced ones)
    const unsyncedLogs = existingLogs.filter(log => !log.isSynced);

    // Save back to local storage (only unsynced logs remain)
    await AsyncStorage.setItem(LOCAL_LOGS_KEY, JSON.stringify(unsyncedLogs));
  } catch (error) {
    console.error("Error cleaning synced logs:", error);
    throw error;
  }
};

// --- Registration Function ---
export const registerPersonnel = async (
  id: string,
  email: string,
  fullname?: string,
  phoneNumber?: string,
  viberNumber?: string,
): Promise<void> => {
  try {
    // Note: password handling is done through Supabase Auth, not stored in public table
    // This function updates the public.personnel table with non-sensitive profile data
    const updates: any = {
      email: email.trim().toLowerCase(),
      fullname: fullname || "",
    };

    if (phoneNumber) updates.phone_number = phoneNumber;
    if (viberNumber) updates.viber_number = viberNumber;

    // Set isApproved to false (0) for new registrations pending approval
    updates.is_approved = false;

    const { error } = await supabase
      .from("personnel")
      .update(updates)
      .eq("id", id);

    if (error) throw error;
  } catch (error) {
    console.error("Error registering personnel:", error);
    throw error;
  }
};

// --- Database Initialization ---
export const initDatabase = async (): Promise<void> => {
  // With Supabase, we don't need to initialize a local database
  // The connection is handled by the supabase client
  // We can check if Supabase is configured
  if (!isSupabaseConfigured()) {
    console.warn("Supabase is not properly configured");
  }
  return Promise.resolve();
};
