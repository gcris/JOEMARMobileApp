import { supabase, isSupabaseConfigured } from "./supabase";
import { Personnel, Schedule, PersonnelLog } from "../types";
import NetInfo from "@react-native-community/netinfo";

const checkInternetBeforeAction = async (): Promise<boolean | null> => {
  const state = await NetInfo.fetch();

  return state.isConnected && state.isInternetReachable;
};

// ============================================================
// SHARED HELPERS
// ============================================================

/**
 * Local (device) calendar date as YYYY-MM-DD.
 *
 * NOTE: new Date().toISOString() is UTC, so between 00:00 and 08:00
 * in the Philippines it returns YESTERDAY's date.
 */
const getLocalDateString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

/**
 * Tiny in-memory cache for rarely-changing lookup tables
 * (ranks, units). Avoids refetching them on every screen visit.
 */
const LOOKUP_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const lookupCache = new Map<string, { expires: number; value: unknown }>();

const readLookupCache = <T>(key: string): T | null => {
  const entry = lookupCache.get(key);

  if (!entry) return null;

  if (Date.now() > entry.expires) {
    lookupCache.delete(key);
    return null;
  }

  return entry.value as T;
};

const writeLookupCache = (key: string, value: unknown) => {
  lookupCache.set(key, {
    expires: Date.now() + LOOKUP_CACHE_TTL_MS,
    value,
  });
};

// ============================================================
// PERSONNEL OPERATIONS
// ============================================================

/**
 * The old queries used select("*, ..., schedule_assignments(*)"), which
 * downloaded EVERY schedule assignment the officer ever had (the list
 * grows every day) and then threw it away. That embed is removed.
 *
 * Personnel columns stay as "*" because not every field mapPersonnel()
 * reads (e.g. email) is guaranteed to be a real column on this table.
 */
const PERSONNEL_WITH_RELATIONS =
  "*, rank(*), unit:unit!personnel_unit_id_fkey(*)";

const CANDIDATE_COLUMNS = "*";

const mapPersonnel = (data: any): Personnel => ({
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
});

export const getPersonnelByBadge = async (
  badgeNumber: string,
): Promise<Personnel | null> => {
  try {
    const { data, error } = await supabase
      .from("personnel")
      .select(PERSONNEL_WITH_RELATIONS)
      .eq("badge_number", badgeNumber)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    if (!data) return null;

    return mapPersonnel(data);
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
      .select(PERSONNEL_WITH_RELATIONS)
      .eq("email", email.toLowerCase())
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    if (!data) return null;

    return mapPersonnel(data);
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
      .select(CANDIDATE_COLUMNS)
      .eq("badge_number", badgeNumber.toUpperCase())
      .eq("rank_id", rankId)
      .eq("unit_id", unitId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    if (!data) return null;

    return mapPersonnel(data);
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
      .select(PERSONNEL_WITH_RELATIONS)
      .eq("id", id)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    if (!data) return null;

    return mapPersonnel(data);
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

type RankOption = { id: string; rankName: string };
type UnitOption = { id: string; unitName: string };

export const getRanks = async (): Promise<RankOption[]> => {
  const cached = readLookupCache<RankOption[]>("ranks");

  if (cached) return cached;

  try {
    const { data, error } = await supabase
      .from("rank")
      .select("id, rank_name, description")
      .order("level", {
        ascending: true,
      });

    if (error) throw error;

    const ranks = (data || []).map((rank) => ({
      id: rank.id,
      rankName: rank.rank_name + " (" + rank.description + ")",
    }));

    writeLookupCache("ranks", ranks);

    return ranks;
  } catch (error) {
    console.error("Error fetching ranks:", error);

    return [];
  }
};

export const getUnits = async (): Promise<UnitOption[]> => {
  const cached = readLookupCache<UnitOption[]>("units");

  if (cached) return cached;

  try {
    const { data, error } = await supabase
      .from("unit")
      .select("id, unit_name")
      .eq("level", 1)
      .order("unit_name");

    if (error) throw error;

    const units = (data || []).map((unit) => ({
      id: unit.id,
      unitName: unit.unit_name,
    }));

    writeLookupCache("units", units);

    return units;
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
    // Device-local date (NOT UTC) so early-morning shifts in the
    // Philippines don't load yesterday's schedule.
    const todayStr = getLocalDateString();

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
      .eq("patrol_schedule.date", todayStr);

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    if (!data || data.length === 0) {
      return null;
    }

    // Latest shift first. (Ordering by an embedded to-one resource in the
    // query does not sort the parent rows, so sort here instead.)
    const rows = [...(data as any[])].sort((a, b) =>
      String(b.patrol_schedule?.time_from ?? "").localeCompare(
        String(a.patrol_schedule?.time_from ?? ""),
      ),
    );

    return rows.map((assignmentRow: any) => {
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

const LOG_PAGE_SIZE = 1000;
const LOG_MAX_PARALLEL_PAGES = 4;

const LOG_COLUMNS =
  "id, personnel_id, latitude, longitude, speed, network_signal, " +
  "duty_type, captured_at";

/**
 * Get this personnel's patrol logs for yesterday + today.
 *
 * Speed-ups compared with the previous version:
 *  - The personnel name / rank is fetched ONCE instead of being embedded
 *    in every single log row (thousands of identical copies).
 *  - Page 1 also returns the total count, so the remaining pages are
 *    fetched in parallel instead of one after another.
 *  - A stable secondary sort (id) keeps pages from skipping/duplicating
 *    rows that share the same captured_at.
 */
export const getPatrolLogs = async (
  personnelId?: string,
): Promise<PersonnelLog[]> => {
  if (!personnelId) return [];

  try {
    // ============================================================
    // ONLY YESTERDAY + TODAY (device-local days)
    // ============================================================

    const now = new Date();

    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 10);

    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const fromDate = yesterdayStart.toISOString();
    const toDate = tomorrowStart.toISOString();

    const buildPageQuery = (
      from: number,
      to: number,
      withCount: boolean,
    ): any =>
      supabase
        .from("patrol_logs")
        .select(LOG_COLUMNS, withCount ? { count: "exact" } : undefined)
        .eq("personnel_id", personnelId)
        .gte("captured_at", fromDate)
        .lt("captured_at", toDate)
        .order("captured_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to);

    // ============================================================
    // PAGE 1 (+ total count) AND PERSONNEL INFO, IN PARALLEL
    // ============================================================

    const [firstRes, personnelRes]: any[] = await Promise.all([
      buildPageQuery(0, LOG_PAGE_SIZE - 1, true),
      supabase
        .from("personnel")
        .select("fullname, rank(rank_name)")
        .eq("id", personnelId)
        .maybeSingle(),
    ]);

    if (firstRes.error) {
      throw firstRes.error;
    }

    // Name/rank are nice-to-have; ignore a failure here.
    const personRow: any = personnelRes?.data;

    const personnelInfo = personRow
      ? {
          fullname: personRow.fullname ?? "",
          rank_name: personRow.rank?.rank_name ?? "",
        }
      : undefined;

    const rows: any[] = [...(firstRes.data ?? [])];

    // ============================================================
    // REMAINING PAGES
    // ============================================================

    if (rows.length === LOG_PAGE_SIZE) {
      const total: number | null =
        typeof firstRes.count === "number" ? firstRes.count : null;

      if (total !== null) {
        // We know how many pages exist: fetch them in parallel batches.
        const offsets: number[] = [];

        for (
          let offset = LOG_PAGE_SIZE;
          offset < total;
          offset += LOG_PAGE_SIZE
        ) {
          offsets.push(offset);
        }

        for (let i = 0; i < offsets.length; i += LOG_MAX_PARALLEL_PAGES) {
          const batch = offsets.slice(i, i + LOG_MAX_PARALLEL_PAGES);

          const results: any[] = await Promise.all(
            batch.map((offset) =>
              buildPageQuery(offset, offset + LOG_PAGE_SIZE - 1, false),
            ),
          );

          for (const result of results) {
            if (result.error) {
              throw result.error;
            }

            rows.push(...(result.data ?? []));
          }
        }
      } else {
        // Count unavailable: fall back to sequential paging.
        let from = LOG_PAGE_SIZE;

        while (true) {
          const result: any = await buildPageQuery(
            from,
            from + LOG_PAGE_SIZE - 1,
            false,
          );

          if (result.error) {
            throw result.error;
          }

          const pageRows: any[] = result.data ?? [];

          rows.push(...pageRows);

          if (pageRows.length < LOG_PAGE_SIZE) {
            break;
          }

          from += LOG_PAGE_SIZE;
        }
      }
    }

    // ============================================================
    // CONVERT SUPABASE ROWS TO PersonnelLog
    // (de-duplicate by id in case new logs arrived between pages)
    // ============================================================

    const unique = new Map<string, PersonnelLog>();

    for (const row of rows) {
      if (unique.has(row.id)) continue;

      unique.set(row.id, {
        id: row.id,

        personnelId: row.personnel_id,

        personnel: personnelInfo,

        latitude: Number(row.latitude),

        longitude: Number(row.longitude),

        speed: Number(row.speed ?? 0),

        networkSignal: Number(row.network_signal ?? 0),

        dutyType: row.duty_type ?? null,

        capturedAt: row.captured_at,

        // Logs retrieved from Supabase
        // are already synchronized.
        isSynced: true,
      });
    }

    const allLogs = Array.from(unique.values());

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
