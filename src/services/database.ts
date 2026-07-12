import { supabase, isSupabaseConfigured } from "./supabase";
import { Personnel, Schedule, PersonnelLog } from "../types";
import * as SQLite from "expo-sqlite";
import NetInfo from "@react-native-community/netinfo";

const checkInternetBeforeAction = async (): Promise<boolean | null> => {
  const state = await NetInfo.fetch();

  return state.isConnected && state.isInternetReachable;
};

// Database setup
let db: SQLite.SQLiteDatabase | null = null;

const getDB = () => {
  if (!db) {
    db = SQLite.openDatabaseSync("patrol.db");
    // Initialize tables
    db.execSync(`
      CREATE TABLE IF NOT EXISTS patrol_logs (
        id TEXT PRIMARY KEY DEFAULT (uuid()),
        personnelId TEXT,
        latitude REAL,
        longitude REAL,
        speed REAL,
        networkSignal INTEGER,
        dutyType TEXT,
        capturedAt TEXT,
        isSynced INTEGER
      );
    `);
  }
  return db;
};

// --- Personnel Operations ---
export const getPersonnelByBadge = async (
  badgeNumber: string,
): Promise<Personnel | null> => {
  try {
    const { data, error } = await supabase
      .from("personnel")
      .select("*, rank(*), unit(*), schedule_assignments(*)")
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
      photo_url: data.photo_url, // Add photo URL
      fcm_token: data.fcm_token,
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
      .select("*, rank(*), unit(*), schedule_assignments(*)")
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
      photo_url: data.photo_url, // Add photo URL
      fcm_token: data.fcm_token,
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
      .select("*")
      .eq("badge_number", badgeNumber.toUpperCase())
      .eq("rank_id", rankId)
      .eq("unit_id", unitId)
      .ilike("designation", `%${designation}%`)
      .single();

    console.log(badgeNumber, rankId, unitId, designation);

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
      photo_url: data.photo_url, // Add photo URL
      fcm_token: data.fcm_token,
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
      .select("*, rank(*), unit(*), schedule_assignments(*)")
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
      photo_url: data.photo_url, // Add photo URL
      fcm_token: data.fcm_token,
    };
  } catch (error) {
    console.error("Error fetching personnel by id:", error);
    return null;
  }
};

export const savePersonnel = async (p: Personnel): Promise<void> => {
  try {
    const { error } = await supabase.from("personnel").upsert(
      {
        id: p.id,
        badge_number: p.badgeNumber,
        // rank: p.rank,
        rank_id: p.rankId,
        fullname: p.fullname,
        unit_id: p.unitId,
        designation: p.designation,
        phone_number: p.phoneNumber,
        viber_number: p.viberNumber,
        is_approved: p.isApproved ? 1 : 0,
        // role: p.role,
        // email: p.email,
        photo_url: p.photo_url, // Add photo URL
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
      .select("*")
      .order("level", { ascending: true });

    if (error) throw error;
    return (data || []).map((rank) => ({
      id: rank.id,
      rankName: rank.rank_name + " (" + rank.description + ")",
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
      .eq("level", 1)
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
): Promise<Schedule[] | null> => {
  try {
    const todayStr = new Date().toISOString().split("T")[0];

    // 1. Query from assignments, force inner join filtering on today's date
    const { data, error } = await supabase
      .from("schedule_assignments")
      .select(
        `
        id,
        personnel_id,
        patrol_schedule!inner (
          id,
          date,
          time_from,
          time_to,
          sector,
          patrol_type,
          unit_id,
          schedule_assignments (
            personnel (
              fullname,
              phone_number,
              viber_number,
              rank (
                rank_name
              )
            )
          )
        )
      `,
      )
      .eq("personnel_id", personnelId)
      .eq("patrol_schedule.date", todayStr)
      .order("time_from", {
        foreignTable: "patrol_schedule",
        ascending: false,
      });

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    if (!data || data.length === 0) return null;

    // 2. Map through the matching assignments and extract the complete parent schedule
    return data.map((assignmentRow: any) => {
      const item = assignmentRow.patrol_schedule;

      // 3. Extract ALL personnel assigned to this schedule, not just the filter target
      const assignedOfficers = (item.schedule_assignments || []).map(
        (assignment: any) => ({
          rank_name: assignment.personnel?.rank?.rank_name || "Unranked",
          fullname: assignment.personnel?.fullname || "Unknown Personnel",
          phone_number: assignment.personnel?.phone_number,
          viber_number: assignment.personnel?.viber_number,
        }),
      );

      return {
        id: item.id,
        date: item.date,
        timeFrom: item.time_from,
        timeTo: item.time_to,
        sector: item.sector,
        duty_type: item.patrol_type,
        unitId: item.unit_id,
        personnelId: personnelId,
        personnel: assignedOfficers, // Clean array containing the entire shift team
      };
    });
  } catch (error) {
    console.error("Error fetching schedule by personnel:", error);
    return null;
  }
};

// --- Patrol Log Operations (SQLite) ---
export const savePatrolLogsToLocalStorage = async (
  log: PersonnelLog,
): Promise<void> => {
  try {
    // If Supabase is configured and we are online, try to save to Supabase first
    const networkConneted = await checkInternetBeforeAction();
    if (isSupabaseConfigured() && networkConneted) {
      await insertPatrolLogs([log]);

      return;
    }

    // Fallback to local SQLite storage
    const db = getDB();
    console.log(log.id);
    const result = db.runSync(
      `
      INSERT INTO patrol_logs (
        id, personnelId, latitude, longitude, speed, networkSignal, dutyType, capturedAt, isSynced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
      [
        log.id,
        log.personnelId,
        Number(log.latitude) ?? 0,
        Number(log.longitude) ?? 0,
        log.speed,
        log.networkSignal,
        log.dutyType,
        log.capturedAt,
        log.isSynced,
      ],
    );

    console.log(result);
  } catch (err) {
    console.error("[Database] Error saving patrol log to local storage:", err);
  }
};

export const syncPendingPatrolLogs = async (): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    console.log("[Database] Supabase not configured, skipping sync");
    return false;
  }

  try {
    const db = getDB();
    const logs = await db.getAllAsync<PersonnelLog>(
      "SELECT * FROM patrol_logs WHERE isSynced = 0;",
    );

    if (logs.length === 0) {
      console.log("[Database] No pending logs to sync");
      return true;
    }

    console.log(`[Database] Syncing ${logs.length} patrol logs to Supabase`);

    // Attempt to insert all logs into Supabase
    await insertPatrolLogs(logs);

    // Mark logs as synced in SQLite
    const ids = logs.map((log) => log.id);
    const placeholders = ids.map(() => "?").join(",");
    let updateSql = `UPDATE patrol_logs SET isSynced = 1 WHERE id IN (${placeholders});`;

    await db.runAsync(updateSql, ids);

    updateSql = `DELETE FROM patrol_logs WHERE isSynced = 1;`;

    await db.runAsync(updateSql);

    console.log(
      `[Database] Successfully synced and marked ${logs.length} logs as synced`,
    );
    return true;
  } catch (err) {
    console.error("[Database] Error syncing patrol logs:", err);
    return false;
  }
};

export const getUnsyncedLogs = async (): Promise<PersonnelLog[]> => {
  try {
    const db = getDB();
    return await db.getAllAsync<PersonnelLog>(
      "SELECT * FROM patrol_logs WHERE isSynced = 0;",
    );
  } catch (err) {
    console.error("[Database] Error getting unsynced logs:", err);
    return [];
  }
};

export const getLatestLogs = async (
  personnelId: string,
  limit: number = 100,
): Promise<PersonnelLog[]> => {
  try {
    // Get logs from Supabase (if configured and online)
    let supabaseLogs: PersonnelLog[] = [];
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from("patrol_logs")
          .select("*")
          .eq("personnel_id", personnelId)
          .order("captured_at", { ascending: false })
          .limit(limit);

        if (!error && data) {
          supabaseLogs = data as PersonnelLog[];
        }
      } catch (error) {
        console.warn("Error fetching logs from Supabase:", error);
      }
    }

    // Get logs from local SQLite
    const db = getDB();
    const localLogs = await db.getAllAsync<PersonnelLog>(
      "SELECT * FROM patrol_logs WHERE personnelId = ? ORDER BY capturedAt DESC LIMIT ?",
      [personnelId, limit],
    );

    // Combine and deduplicate by id (prefer Supabase version if exists)
    const combinedMap = new Map<string, PersonnelLog>();
    localLogs.forEach((log) => {
      combinedMap.set(log.id, log);
    });
    supabaseLogs.forEach((log) => {
      combinedMap.set(log.id, log); // Supabase version overwrites local
    });

    const combinedLogs = Array.from(combinedMap.values());
    // Sort by capturedAt descending
    combinedLogs.sort(
      (a, b) =>
        new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
    );

    return combinedLogs;
  } catch (err) {
    console.error("[Database] Error getting latest logs:", err);
    return [];
  }
};

export const getUnsyncedCount = async (): Promise<number> => {
  try {
    const db = getDB();
    const result = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM patrol_logs WHERE isSynced = 0;",
    );
    return result?.count ?? 0;
  } catch (err) {
    console.error("[Database] Error getting unsynced count:", err);
    return 0;
  }
};

export const markLogsAsSynced = async (ids: string[]): Promise<void> => {
  try {
    if (ids.length === 0) return;

    const db = getDB();
    const placeholders = ids.map(() => "?").join(",");
    const sql = `UPDATE patrol_logs SET isSynced = 1 WHERE id IN (${placeholders});`;

    await db.runAsync(sql, ids);
  } catch (err) {
    console.error("[Database] Error marking logs as synced:", err);
  }
};

export const cleanSyncedLogs = async (): Promise<void> => {
  try {
    const db = getDB();
    await db.execAsync("DELETE FROM patrol_logs WHERE isSynced = 1;");
  } catch (err) {
    console.error("[Database] Error cleaning synced logs:", err);
  }
};

// Insert multiple patrol logs into local SQLite storage
export const insertPatrolLogs = async (logs: PersonnelLog[]): Promise<void> => {
  try {
    const payload = logs.map((log) => ({
      personnel_id: log.personnelId,
      latitude: log.latitude,
      longitude: log.longitude,
      speed: log.speed,
      network_signal: log.networkSignal,
      duty_type: log.dutyType,
      captured_at: log.capturedAt,
    }));

    const { error } = await supabase.from("patrol_logs").insert(payload);
    if (!error) {
      console.log("Successfully saved into the supabase");
    }
  } catch (err) {
    console.error("[Database] Error inserting patrol logs 2:", err);
    throw err;
  }
};

// --- Database Initialization ---
export const initDatabase = async (): Promise<void> => {
  // Initialize SQLite database for patrol logs
  try {
    getDB(); // This will initialize the database if not already done
    console.log("[Database] SQLite database initialized for patrol logs");
  } catch (error) {
    console.error("[Database] Error initializing SQLite database:", error);
  }

  // With Supabase, we don't need to initialize a local database for other operations
  // The connection is handled by the supabase client
  // We can check if Supabase is configured
  if (!isSupabaseConfigured()) {
    console.warn("Supabase is not properly configured");
  }
  return Promise.resolve();
};
