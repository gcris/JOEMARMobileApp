import { supabase, isSupabaseConfigured } from "./supabase";
import { Personnel, Schedule, PersonnelLog } from "../types";
import NetInfo from "@react-native-community/netinfo";

const checkInternetBeforeAction = async (): Promise<boolean | null> => {
  const state = await NetInfo.fetch();

  return state.isConnected && state.isInternetReachable;
};

// ============================================================
// PERSONNEL OPERATIONS
// ============================================================

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
      photo_url: data.photo_url,
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
      photo_url: data.photo_url,
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
): Promise<Personnel | null> => {
  try {
    const { data, error } = await supabase
      .from("personnel")
      .select("*")
      .eq("badge_number", badgeNumber.toUpperCase())
      .eq("rank_id", rankId)
      .eq("unit_id", unitId)
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
      photo_url: data.photo_url,
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
      photo_url: data.photo_url,
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
        rank_id: p.rankId,
        fullname: p.fullname,
        unit_id: p.unitId,
        designation: p.designation,
        phone_number: p.phoneNumber,
        viber_number: p.viberNumber,
        is_approved: p.isApproved ? 1 : 0,
        photo_url: p.photo_url,
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

// ============================================================
// RANKS AND UNITS
// ============================================================

export const getRanks = async (): Promise<
  {
    id: string;
    rankName: string;
  }[]
> => {
  try {
    const { data, error } = await supabase
      .from("rank")
      .select("*")
      .order("level", {
        ascending: true,
      });

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
  {
    id: string;
    unitName: string;
  }[]
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

// ============================================================
// SCHEDULE OPERATIONS
// ============================================================

export const getScheduleByPersonnel = async (
  personnelId: string,
): Promise<Schedule[] | null> => {
  try {
    const todayStr = new Date().toISOString().split("T")[0];

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
              sector_id,
              sector:sector_id (
                id,
                deployment,
                sector,
                unit_id,
                sector_details:sector_detail (
                  id,
                  brgy_id,
                  barangay:brgy_id (
                    id,
                    name
                  )
                )
              ),
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

    if (!data || data.length === 0) {
      return null;
    }

    return data.map((assignmentRow: any) => {
      const item = assignmentRow.patrol_schedule;

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

        sector_id: item.sector_id,

        sector: item.sector,

        duty_type: item.patrol_type,

        unitId: item.unit_id,

        personnelId: personnelId,

        personnel: assignedOfficers,
      };
    });
  } catch (error) {
    console.error("Error fetching schedule by personnel:", error);

    return null;
  }
};

// ============================================================
// PATROL LOGS
// ============================================================

/**
 * Insert patrol logs into Supabase.
 *
 * These logs are stored in the patrol_logs table.
 */
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

    if (error) {
      throw error;
    }

    console.log("Successfully saved patrol logs into Supabase");
  } catch (err) {
    console.error("[Database] Error inserting patrol logs:", err);

    throw err;
  }
};

/**
 * Get patrol logs.
 *
 * If personnelId is supplied, only logs belonging
 * to that personnel are returned.
 *
 * If personnelId is omitted, all logs allowed by
 * Supabase RLS are returned.
 */
export const getPatrolLogs = async (
  personnelId?: string,
): Promise<PersonnelLog[]> => {
  try {
    // ============================================================
    // FETCH ONLY YESTERDAY + TODAY
    // ============================================================

    const now = new Date();

    // Start of today
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );

    // Start of yesterday
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 10);

    // Start of tomorrow
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    // Convert to ISO so Supabase can compare against timestamptz
    const fromDate = yesterdayStart.toISOString();
    const toDate = tomorrowStart.toISOString();

    // ============================================================
    // PAGINATION
    // ============================================================
    //
    // 1000 is ONLY the page size.
    // It is NOT the maximum number of logs returned.
    //
    // Example:
    // Page 1 = records 0 - 999
    // Page 2 = records 1000 - 1999
    // Page 3 = records 2000 - 2999
    // etc.
    //
    // We continue until Supabase returns less than PAGE_SIZE.
    // ============================================================

    const PAGE_SIZE = 1000;

    const allLogs: PersonnelLog[] = [];

    let from = 0;

    while (true) {
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("patrol_logs")
        .select(
          `
            id,
            personnel_id,
            latitude,
            longitude,
            speed,
            network_signal,
            duty_type,
            captured_at,
            personnel (
              fullname,
              rank (
                rank_name
              )
            )
          `,
        )
        // ========================================================
        // ONLY YESTERDAY + TODAY
        // ========================================================
        .gte("captured_at", fromDate)
        .lt("captured_at", toDate)
        // ========================================================
        // NEWEST FIRST
        // ========================================================
        .order("captured_at", {
          ascending: false,
        })
        // ========================================================
        // FETCH THIS PAGE
        // ========================================================
        .range(from, to);

      // ==========================================================
      // FILTER BY PERSONNEL IF PROVIDED
      // ==========================================================

      if (personnelId) {
        query = query.eq("personnel_id", personnelId);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      // No more records
      if (!data || data.length === 0) {
        break;
      }

      // ==========================================================
      // CONVERT SUPABASE ROWS TO PersonnelLog
      // ==========================================================

      const pageLogs: PersonnelLog[] = data.map((row: any) => ({
        id: row.id,

        personnelId: row.personnel_id,

        personnel: row.personnel
          ? {
              fullname: row.personnel.fullname ?? "",

              rank_name: row.personnel.rank?.rank_name ?? "",
            }
          : undefined,

        latitude: Number(row.latitude),

        longitude: Number(row.longitude),

        speed: Number(row.speed ?? 0),

        networkSignal: Number(row.network_signal ?? 0),

        dutyType: row.duty_type ?? null,

        capturedAt: row.captured_at,

        // Logs retrieved from Supabase
        // are already synchronized.
        isSynced: true,
      }));

      // Add this page to the complete result
      allLogs.push(...pageLogs);

      // ==========================================================
      // IF LESS THAN PAGE SIZE, WE HAVE REACHED THE END
      // ==========================================================

      if (data.length < PAGE_SIZE) {
        break;
      }

      // Move to next page
      from += PAGE_SIZE;
    }

    console.log(
      `[Database] Patrol logs loaded: ${allLogs.length} ` +
        `(yesterday + today)`,
    );

    return allLogs;
  } catch (error) {
    console.error("[Database] Error fetching patrol logs:", error);

    return [];
  }
};
