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
import { PersonnelLog } from "../types";

// CartoDB Positron style — free, public, no API key required
// Alternative: https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json
const MAP_STYLE_URL =
  process.env.EXPO_PUBLIC_MAP_STYLE_URL ||
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

interface PersonnelLogMapScreenProps {
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

export default function PersonnelLogMapScreen({
  logs,
  isDarkTheme,
}: PersonnelLogMapScreenProps) {
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

  const routeFeature = useMemo(() => {
    const coordinates = selectedLogs.map((log) => [
      Number(log.longitude),
      Number(log.latitude),
    ]);
    return {
      type: "Feature" as const,
      geometry: { type: "LineString" as const, coordinates },
      properties: {},
    };
  }, [selectedLogs]);

  const startPointFeature = useMemo(() => {
    const log = selectedLogs[0];
    return log ? {
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [Number(log.longitude), Number(log.latitude)] },
      properties: {},
    } : null;
  }, [selectedLogs]);

  const lastPointFeature = useMemo(() => {
    const log = selectedLogs[selectedLogs.length - 1];
    return selectedLogs.length > 1 && log ? {
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [Number(log.longitude), Number(log.latitude)] },
      properties: {},
    } : null;
  }, [selectedLogs]);

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
      </View>
    </SafeAreaView>
  );
}

const getStyles = (isDarkTheme: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDarkTheme ? "#080F1C" : "#F8FAFC" },
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
  logCountText: { marginLeft: 6, color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  emptyTitle: { marginTop: 18, fontSize: 19, fontWeight: "800", color: isDarkTheme ? "#F8FAFC" : "#0F172A" },
  emptyText: { marginTop: 8, textAlign: "center", fontSize: 13, color: isDarkTheme ? "#94A3B8" : "#64748B" },
});
