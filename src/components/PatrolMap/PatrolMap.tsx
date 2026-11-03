import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  MapView,
  Camera,
  CameraRef,
  ShapeSource,
  LineLayer,
  CircleLayer,
} from "@maplibre/maplibre-react-native";
import { Ionicons } from "@expo/vector-icons";
import { PersonnelLog } from "../../types";

// CartoDB Positron style — free, public, no API key required
const MAP_STYLE_URL =
  process.env.EXPO_PUBLIC_MAP_STYLE_URL ||
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

interface PatrolMapProps {
  logs: PersonnelLog[];
  isDarkTheme: boolean;
}

interface LogSession {
  id: string;
  dateKey: string;
  sessionNumber: number;
  logs: PersonnelLog[];
  startTime: string;
  endTime: string;
  dutyType?: string;
}

export const PatrolMap: React.FC<PatrolMapProps> = ({ logs, isDarkTheme }) => {
  const theme = useMemo(
    () => ({
      background: isDarkTheme ? "#080F1C" : "#F8FAFC",
      surface: isDarkTheme ? "#101B2D" : "#FFFFFF",
      textPrimary: isDarkTheme ? "#F8FAFC" : "#0F172A",
      textSecondary: isDarkTheme ? "#94A3B8" : "#64748B",
      blue: isDarkTheme ? "#60A5FA" : "#2563EB",
    }),
    [isDarkTheme],
  );

  const cameraRef = useRef<CameraRef>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<string>("all");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showSessionPicker, setShowSessionPicker] = useState(false);

  const formatTime = (date: string) => {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return "--:--";
    return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  };

  const formatDate = (date: string) => {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return "--";
    return parsed.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
  };

  const getDateKey = (date: string) => {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return "";
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const sortedLogs = useMemo(() => {
    return [...logs]
      .filter(
        (log) =>
          Number.isFinite(Number(log.latitude)) &&
          Number.isFinite(Number(log.longitude)) &&
          !Number.isNaN(new Date(log.capturedAt).getTime()),
      )
      .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());
  }, [logs]);

  const availableDates = useMemo(() => {
    const dateMap = new Map<string, PersonnelLog[]>();
    sortedLogs.forEach((log) => {
      const dateKey = getDateKey(log.capturedAt);
      if (!dateKey) return;
      if (!dateMap.has(dateKey)) dateMap.set(dateKey, []);
      dateMap.get(dateKey)!.push(log);
    });
    return Array.from(dateMap.entries())
      .map(([dateKey, dateLogs]) => ({ dateKey, logs: dateLogs }))
      .sort((a, b) => new Date(b.dateKey).getTime() - new Date(a.dateKey).getTime());
  }, [sortedLogs]);

  useEffect(() => {
    if (availableDates.length === 0) {
      setSelectedDate(null);
      return;
    }
    const exists = availableDates.some((item) => item.dateKey === selectedDate);
    if (!exists) {
      setSelectedDate(availableDates[0].dateKey);
    }
  }, [availableDates, selectedDate]);

  const dateLogs = useMemo(() => {
    if (!selectedDate) return [];
    return sortedLogs.filter((log) => getDateKey(log.capturedAt) === selectedDate);
  }, [sortedLogs, selectedDate]);

  const sessions = useMemo<LogSession[]>(() => {
    if (dateLogs.length === 0 || !selectedDate) return [];
    const result: LogSession[] = [];
    let currentSession: PersonnelLog[] = [];

    dateLogs.forEach((log, index) => {
      if (index === 0) {
        currentSession = [log];
        return;
      }
      const previousLog = dateLogs[index - 1];
      const previousTime = new Date(previousLog.capturedAt).getTime();
      const currentTime = new Date(log.capturedAt).getTime();
      const differenceMinutes = (currentTime - previousTime) / (1000 * 60);
      const dutyChanged = (previousLog.dutyType ?? "") !== (log.dutyType ?? "");

      if (differenceMinutes >= 10 || dutyChanged) {
        const sessionNumber = result.length + 1;
        result.push({
          id: `${selectedDate}-session-${sessionNumber}`,
          dateKey: selectedDate,
          sessionNumber,
          logs: currentSession,
          startTime: formatTime(currentSession[0].capturedAt),
          endTime: formatTime(currentSession[currentSession.length - 1].capturedAt),
          dutyType: currentSession[0].dutyType ?? "",
        });
        currentSession = [log];
      } else {
        currentSession.push(log);
      }
    });

    if (currentSession.length > 0) {
      const sessionNumber = result.length + 1;
      result.push({
        id: `${selectedDate}-session-${sessionNumber}`,
        dateKey: selectedDate,
        sessionNumber,
        logs: currentSession,
        startTime: formatTime(currentSession[0].capturedAt),
        endTime: formatTime(currentSession[currentSession.length - 1].capturedAt),
        dutyType: currentSession[0].dutyType ?? "",
      });
    }

    return result;
  }, [dateLogs, selectedDate]);

  const selectedLogs = useMemo(() => {
    if (selectedSession === "all") return dateLogs;
    const session = sessions.find((item) => item.id === selectedSession);
    return session?.logs ?? [];
  }, [dateLogs, selectedSession, sessions]);

  const MIN_SEGMENT_METERS = 5; // ignore GPS jitter while standing still

  const toRad = (degrees: number) => (degrees * Math.PI) / 180;

  const distanceKm = (
    a: { latitude: number; longitude: number },
    b: { latitude: number; longitude: number },
  ): number => {
    const R = 6371; // km
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);

    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.latitude)) *
        Math.cos(toRad(b.latitude)) *
        Math.sin(dLon / 2) ** 2;

    return 2 * R * Math.asin(Math.sqrt(h));
  };

  // Filter out GPS noise: remove points that are too close together
  const filteredLogs = useMemo(() => {
    if (selectedLogs.length < 2) return selectedLogs;

    const filtered: PersonnelLog[] = [selectedLogs[0]];
    let lastValidLog = selectedLogs[0];

    for (let i = 1; i < selectedLogs.length; i++) {
      const currentLog = selectedLogs[i];
      const segmentKm = distanceKm(
        { latitude: Number(lastValidLog.latitude), longitude: Number(lastValidLog.longitude) },
        { latitude: Number(currentLog.latitude), longitude: Number(currentLog.longitude) },
      );

      // Keep point if it's more than 5 meters away from last valid point
      if (segmentKm * 1000 >= MIN_SEGMENT_METERS) {
        filtered.push(currentLog);
        lastValidLog = currentLog;
      }
    }

    return filtered;
  }, [selectedLogs]);

  const formatDuration = (ms: number): string => {
    const totalMinutes = Math.round(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) return `${minutes}m`;
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  };

  const patrolStats = useMemo(() => {
    const activeSessions =
      selectedSession === "all"
        ? sessions
        : sessions.filter((session) => session.id === selectedSession);

    let km = 0;
    let durationMs = 0;

    activeSessions.forEach((session) => {
      const points = session.logs;

      for (let i = 1; i < points.length; i++) {
        const segmentKm = distanceKm(
          {
            latitude: Number(points[i - 1].latitude),
            longitude: Number(points[i - 1].longitude),
          },
          {
            latitude: Number(points[i].latitude),
            longitude: Number(points[i].longitude),
          },
        );

        if (segmentKm * 1000 >= MIN_SEGMENT_METERS) {
          km += segmentKm;
        }
      }

      if (points.length > 1) {
        durationMs +=
          new Date(points[points.length - 1].capturedAt).getTime() -
          new Date(points[0].capturedAt).getTime();
      }
    });

    return { km, durationMs };
  }, [sessions, selectedSession]);

  const routeFeature = useMemo(() => {
    const coordinates = filteredLogs.map((log) => [
      Number(log.longitude),
      Number(log.latitude),
    ]);
    return {
      type: "Feature" as const,
      geometry: { type: "LineString" as const, coordinates },
      properties: {},
    };
  }, [filteredLogs]);

  const startPointFeature = useMemo(() => {
    const log = filteredLogs[0];
    return log ? {
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [Number(log.longitude), Number(log.latitude)] },
      properties: {},
    } : null;
  }, [filteredLogs]);

  const lastPointFeature = useMemo(() => {
    const log = filteredLogs[filteredLogs.length - 1];
    return filteredLogs.length > 1 && log ? {
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [Number(log.longitude), Number(log.latitude)] },
      properties: {},
    } : null;
  }, [filteredLogs]);

  const styles = useMemo(() => getStyles(isDarkTheme), [isDarkTheme]);

  if (sortedLogs.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="map-outline" size={42} color="#64748B" />
          <Text style={styles.emptyTitle}>No Patrol Logs</Text>
          <Text style={styles.emptyText}>There are no GPS patrol logs available.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="calendar-outline" size={17} color="#2563EB" />
          <View style={styles.filterButtonTextContainer}>
            <Text style={styles.filterLabel}>DATE</Text>
            <Text style={styles.filterValue} numberOfLines={1}>
              {selectedDate
                ? formatDate(availableDates.find((d) => d.dateKey === selectedDate)?.logs[0].capturedAt || "")
                : "Select Date"}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={16} color="#64748B" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowSessionPicker(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="layers-outline" size={17} color="#2563EB" />
          <View style={styles.filterButtonTextContainer}>
            <Text style={styles.filterLabel}>SESSION</Text>
            <Text style={styles.filterValue} numberOfLines={1}>
              {selectedSession === "all"
                ? `All Sessions (${sessions.length})`
                : (() => {
                    const session = sessions.find((s) => s.id === selectedSession);
                    return session
                      ? `Session ${session.sessionNumber} · ${session.dutyType || ""}`
                      : "All Sessions";
                  })()}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={16} color="#64748B" />
        </TouchableOpacity>
      </View>

      <View style={styles.mapContainer}>
        <MapView
          style={StyleSheet.absoluteFillObject}
          mapStyle={MAP_STYLE_URL}
          logoEnabled={false}
        >
          <Camera
            ref={cameraRef}
            defaultSettings={{
              centerCoordinate: [120.5936, 18.1978],
              zoomLevel: 10,
            }}
          />

          {routeFeature.geometry.coordinates.length >= 2 && (
            <ShapeSource id="routeSource" shape={routeFeature}>
              <LineLayer
                id="routeLayer"
                style={{
                  lineColor: isDarkTheme ? "#60A5FA" : "#2563EB",
                  lineWidth: 5,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              />
            </ShapeSource>
          )}

          {startPointFeature && (
            <ShapeSource id="startPointSource" shape={startPointFeature}>
              <CircleLayer
                id="startPointLayer"
                style={{
                  circleColor: "#16A34A",
                  circleRadius: 8,
                  circleStrokeColor: "#FFFFFF",
                  circleStrokeWidth: 2,
                }}
              />
            </ShapeSource>
          )}

          {lastPointFeature && (
            <ShapeSource id="lastPointSource" shape={lastPointFeature}>
              <CircleLayer
                id="lastPointLayer"
                style={{
                  circleColor: "#DC2626",
                  circleRadius: 8,
                  circleStrokeColor: "#FFFFFF",
                  circleStrokeWidth: 2,
                }}
              />
            </ShapeSource>
          )}
        </MapView>

        <View style={styles.logCount}>
          <Ionicons name="location" size={14} color="#FFFFFF" />
          <Text style={styles.logCountText}>{selectedLogs.length.toLocaleString()} points</Text>
        </View>

        <View style={styles.sessionCount}>
          <Ionicons name="layers" size={13} color="#FFFFFF" />
          <Text style={styles.sessionCountText}>
            {selectedSession === "all" ? `${sessions.length} sessions` : "1 session"}
          </Text>
        </View>

        <View style={styles.patrolStatsCard}>
          <View style={styles.patrolStatBox}>
            <Ionicons name="speedometer-outline" size={20} color={theme.blue} />
            <View style={styles.patrolStatTextBox}>
              <Text style={styles.patrolStatLabel}>Kilometer Patrolled</Text>
              <Text style={styles.patrolStatValue}>{patrolStats.km.toFixed(2)} km</Text>
            </View>
          </View>

          <View style={styles.patrolStatDivider} />

          <View style={styles.patrolStatBox}>
            <Ionicons name="time-outline" size={20} color={theme.blue} />
            <View style={styles.patrolStatTextBox}>
              <Text style={styles.patrolStatLabel}>Hours Patrolled</Text>
              <Text style={styles.patrolStatValue}>{formatDuration(patrolStats.durationMs)}</Text>
            </View>
          </View>
        </View>
      </View>

      <Modal
        visible={showDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select Date</Text>
                <Text style={styles.modalSubtitle}>Choose the patrol date to display</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.modalClose}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {availableDates.map((item) => {
              const active = item.dateKey === selectedDate;
              return (
                <TouchableOpacity
                  key={item.dateKey}
                  style={[styles.optionRow, active && styles.optionRowActive]}
                  onPress={() => {
                    setSelectedDate(item.dateKey);
                    setSelectedSession("all");
                    setShowDatePicker(false);
                  }}
                >
                  <Ionicons
                    name={active ? "radio-button-on" : "radio-button-off"}
                    size={20}
                    color={active ? "#2563EB" : "#94A3B8"}
                  />
                  <View style={styles.optionContent}>
                    <Text style={[styles.optionTitle, active && styles.optionTitleActive]}>
                      {formatDate(item.logs[0].capturedAt)}
                    </Text>
                    <Text style={styles.optionSubtitle}>{item.logs.length.toLocaleString()} GPS points</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSessionPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSessionPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select Session</Text>
                <Text style={styles.modalSubtitle}>A new session starts after 10 minutes</Text>
              </View>
              <TouchableOpacity onPress={() => setShowSessionPicker(false)} style={styles.modalClose}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.optionRow, selectedSession === "all" && styles.optionRowActive]}
              onPress={() => {
                setSelectedSession("all");
                setShowSessionPicker(false);
              }}
            >
              <Ionicons
                name={selectedSession === "all" ? "radio-button-on" : "radio-button-off"}
                size={20}
                color={selectedSession === "all" ? "#2563EB" : "#94A3B8"}
              />
              <View style={styles.optionContent}>
                <Text
                  style={[
                    styles.optionTitle,
                    selectedSession === "all" && styles.optionTitleActive,
                  ]}
                >
                  All Sessions
                </Text>
              </View>
            </TouchableOpacity>

            {sessions.map((session) => {
              const active = session.id === selectedSession;
              return (
                <TouchableOpacity
                  key={session.id}
                  style={[styles.optionRow, active && styles.optionRowActive]}
                  onPress={() => {
                    setSelectedSession(session.id);
                    setShowSessionPicker(false);
                  }}
                >
                  <Ionicons
                    name={active ? "radio-button-on" : "radio-button-off"}
                    size={20}
                    color={active ? "#2563EB" : "#94A3B8"}
                  />
                  <View style={styles.optionContent}>
                    <Text style={[styles.optionTitle, active && styles.optionTitleActive]}>
                      Session {session.sessionNumber}
                    </Text>
                    <Text style={styles.optionSubtitle}>{session.dutyType || ""}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const getStyles = (isDarkTheme: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: isDarkTheme ? "#080F1C" : "#F8FAFC" },
    filterBar: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: isDarkTheme ? "#101B2D" : "#FFFFFF",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: isDarkTheme ? "#26354A" : "#E2E8F0",
      zIndex: 30,
    },
    filterButton: {
      flex: 1,
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 11,
      backgroundColor: isDarkTheme ? "#172235" : "#F8FAFC",
      borderWidth: 1,
      borderColor: isDarkTheme ? "#26354A" : "#E2E8F0",
    },
    filterButtonTextContainer: { flex: 1, marginLeft: 8, minWidth: 0 },
    filterLabel: {
      fontSize: 13,
      color: isDarkTheme ? "#64748B" : "#94A3B8",
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    filterValue: {
      marginTop: 2,
      fontSize: 15,
      color: isDarkTheme ? "#F8FAFC" : "#334155",
      fontWeight: "700",
    },
    mapContainer: { flex: 1 },
    logCount: {
      position: "absolute",
      top: 14,
      left: 14,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: "rgba(15, 23, 42, 0.88)",
    },
    sessionCount: {
      position: "absolute",
      top: 14,
      right: 14,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: "rgba(15, 23, 42, 0.88)",
    },
    patrolStatsCard: {
      position: "absolute",
      left: 14,
      right: 14,
      bottom: 78,
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 16,
      backgroundColor: isDarkTheme ? "rgba(16, 27, 45, 0.95)" : "rgba(255,255,255,0.96)",
      elevation: 6,
    },
    patrolStatBox: { flex: 1, flexDirection: "row", alignItems: "center" },
    patrolStatTextBox: { marginLeft: 10 },
    patrolStatLabel: {
      fontSize: 15,
      fontWeight: "800",
      letterSpacing: 0.5,
      color: isDarkTheme ? "#64748B" : "#94A3B8",
    },
    patrolStatValue: {
      marginTop: 2,
      fontSize: 18,
      fontWeight: "800",
      color: isDarkTheme ? "#F8FAFC" : "#0F172A",
    },
    patrolStatDivider: {
      width: 1,
      height: 34,
      marginHorizontal: 12,
      backgroundColor: isDarkTheme ? "#26354A" : "#E2E8F0",
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: isDarkTheme ? "rgba(0, 0, 0, 0.68)" : "rgba(15, 23, 42, 0.48)",
      justifyContent: "center",
      paddingHorizontal: 20,
    },
    modalCard: {
      backgroundColor: isDarkTheme ? "#101B2D" : "#FFFFFF",
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 16,
      maxHeight: "80%",
      shadowColor: "#000000",
      shadowOpacity: 0.2,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
      elevation: 15,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: isDarkTheme ? "#F8FAFC" : "#0F172A",
    },
    modalSubtitle: {
      marginTop: 3,
      fontSize: 15,
      color: isDarkTheme ? "#94A3B8" : "#64748B",
      fontWeight: "500",
    },
    modalClose: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDarkTheme ? "#172235" : "#F1F5F9",
    },
    optionRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 12,
      borderRadius: 12,
      marginTop: 5,
    },
    optionRowActive: { backgroundColor: isDarkTheme ? "#172B46" : "#EFF6FF" },
    optionContent: { flex: 1, marginLeft: 10, minWidth: 0 },
    optionTitle: {
      fontSize: 17,
      color: isDarkTheme ? "#E2E8F0" : "#334155",
      fontWeight: "700",
    },
    optionTitleActive: {
      color: isDarkTheme ? "#93C5FD" : "#1D4ED8",
      fontWeight: "800",
    },
    optionSubtitle: {
      marginTop: 3,
      fontSize: 14,
      color: isDarkTheme ? "#94A3B8" : "#64748B",
      fontWeight: "500",
    },
    logCountText: { marginLeft: 6, color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
    sessionCountText: { marginLeft: 5, color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
    emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
    emptyTitle: { marginTop: 18, fontSize: 19, fontWeight: "800", color: isDarkTheme ? "#F8FAFC" : "#0F172A" },
    emptyText: { marginTop: 8, textAlign: "center", fontSize: 13, color: isDarkTheme ? "#94A3B8" : "#64748B" },
  });
