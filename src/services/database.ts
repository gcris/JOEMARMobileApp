import { supabase, isSupabaseConfigured } from "./supabase";
import { Personnel, Schedule, PersonnelLog } from "../types";
import NetInfo from "@react-native-community/netinfo";

const checkInternetBeforeAction = async (): Promise<boolean | null> => {
  const state = await NetInfo.fetch();

  return state.isConnected && state.isInternetReachable;
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
