import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { PersonnelLog } from "../types";

// ============================================================
// PROPS
// ============================================================

interface PersonnelLogMapScreenProps {
  logs: PersonnelLog[];
  isDarkTheme: boolean;
}

// ============================================================
// SESSION
// ============================================================

interface LogSession {
  id: string;
  dateKey: string;
  sessionNumber: number;
  logs: PersonnelLog[];
  startTime: string;
  endTime: string;
  dutyType?: string;
}

// ============================================================
// SCREEN
// ============================================================

export default function PersonnelLogMapScreen({
  logs,
  isDarkTheme,
}: PersonnelLogMapScreenProps) {
  const theme = useMemo(
    () => ({
      background: isDarkTheme ? "#080F1C" : "#F8FAFC",
      surface: isDarkTheme ? "#101B2D" : "#FFFFFF",
      surfaceSecondary: isDarkTheme ? "#172235" : "#F8FAFC",
      textPrimary: isDarkTheme ? "#F8FAFC" : "#0F172A",
      textSecondary: isDarkTheme ? "#94A3B8" : "#64748B",
      textMuted: isDarkTheme ? "#64748B" : "#94A3B8",
      border: isDarkTheme ? "#26354A" : "#E2E8F0",
      blue: isDarkTheme ? "#60A5FA" : "#2563EB",
      blueLight: isDarkTheme ? "#172B46" : "#EFF6FF",
      blueText: isDarkTheme ? "#93C5FD" : "#1D4ED8",
      iconBackground: isDarkTheme ? "#172B46" : "#EFF6FF",
      modalOverlay: isDarkTheme
        ? "rgba(0, 0, 0, 0.68)"
        : "rgba(15, 23, 42, 0.48)",
      modalClose: isDarkTheme ? "#172235" : "#F1F5F9",
    }),
    [isDarkTheme],
  );

  const mapRef = useRef<MapView | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapType, setMapType] = useState<"hybrid" | "standard">("hybrid");

  const [selectedLog, setSelectedLog] = useState<PersonnelLog | null>(null);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [selectedSession, setSelectedSession] = useState<string>("all");

  const [showDatePicker, setShowDatePicker] = useState(false);

  const [showSessionPicker, setShowSessionPicker] = useState(false);

  // ==========================================================
  // FORMAT TIME
  // ==========================================================

  const formatTime = (date: string) => {
    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return "--:--";
    }

    return parsed.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  // ==========================================================
  // FORMAT DATE
  // ==========================================================

  const formatDate = (date: string) => {
    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return "--";
    }

    return parsed.toLocaleDateString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // ==========================================================
  // DATE KEY
  // ==========================================================

  const getDateKey = (date: string) => {
    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return "";
    }

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  // ==========================================================
  // SORT ALL VALID LOGS
  // ==========================================================

  const sortedLogs = useMemo(() => {
    return [...logs]
      .filter(
        (log) =>
          Number.isFinite(Number(log.latitude)) &&
          Number.isFinite(Number(log.longitude)) &&
          !Number.isNaN(new Date(log.capturedAt).getTime()),
      )
      .sort(
        (a, b) =>
          new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime(),
      );
  }, [logs]);

  // ==========================================================
  // AVAILABLE DATES
  // ==========================================================

  const availableDates = useMemo(() => {
    const dateMap = new Map<string, PersonnelLog[]>();

    sortedLogs.forEach((log) => {
      const dateKey = getDateKey(log.capturedAt);

      if (!dateKey) {
        return;
      }

      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, []);
      }

      dateMap.get(dateKey)!.push(log);
    });

    return Array.from(dateMap.entries())
      .map(([dateKey, dateLogs]) => ({
        dateKey,
        logs: dateLogs,
      }))
      .sort((a, b) => {
        return new Date(b.dateKey).getTime() - new Date(a.dateKey).getTime();
      });
  }, [sortedLogs]);

  // ==========================================================
  // INITIAL DATE
  // ==========================================================

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

  // ==========================================================
  // LOGS FOR SELECTED DATE
  // ==========================================================

  const dateLogs = useMemo(() => {
    if (!selectedDate) {
      return [];
    }

    return sortedLogs.filter(
      (log) => getDateKey(log.capturedAt) === selectedDate,
    );
  }, [sortedLogs, selectedDate]);

  // ==========================================================
  // BUILD SESSIONS
  //
  // A new session starts when the gap between consecutive
  // logs is 10 minutes OR MORE.
  // ==========================================================

  const sessions = useMemo<LogSession[]>(() => {
    if (dateLogs.length === 0 || !selectedDate) {
      return [];
    }

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

      // 10 minutes or more, or a different duty type = new session
      if (differenceMinutes >= 10 || dutyChanged) {
        const sessionNumber = result.length + 1;

        result.push({
          id: `${selectedDate}-session-${sessionNumber}`,
          dateKey: selectedDate,
          sessionNumber,
          logs: currentSession,
          startTime: formatTime(currentSession[0].capturedAt),
          endTime: formatTime(
            currentSession[currentSession.length - 1].capturedAt,
          ),
          dutyType: currentSession[0].dutyType ?? "",
        });

        currentSession = [log];
      } else {
        currentSession.push(log);
      }
    });

    // Add final session
    if (currentSession.length > 0) {
      const sessionNumber = result.length + 1;

      result.push({
        id: `${selectedDate}-session-${sessionNumber}`,
        dateKey: selectedDate,
        sessionNumber,
        logs: currentSession,
        startTime: formatTime(currentSession[0].capturedAt),
        endTime: formatTime(
          currentSession[currentSession.length - 1].capturedAt,
        ),
        dutyType: currentSession[0].dutyType ?? "",
      });
    }

    return result;
  }, [dateLogs, selectedDate]);

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

  // ==========================================================
  // VALIDATE SELECTED SESSION
  // ==========================================================

  useEffect(() => {
    if (selectedSession === "all") {
      return;
    }

    const exists = sessions.some((session) => session.id === selectedSession);

    if (!exists) {
      setSelectedSession("all");
    }
  }, [sessions, selectedSession]);

  // ==========================================================
  // SELECTED LOGS
  // ==========================================================

  const selectedLogs = useMemo(() => {
    if (selectedSession === "all") {
      return dateLogs;
    }

    const session = sessions.find((item) => item.id === selectedSession);

    return session?.logs ?? [];
  }, [dateLogs, selectedSession, sessions]);

  // ==========================================================
  // CLEAR SELECTED LOG WHEN FILTER CHANGES
  // ==========================================================

  useEffect(() => {
    setSelectedLog(null);
  }, [selectedDate, selectedSession]);

  // ==========================================================
  // ROUTE COORDINATES
  // ==========================================================

  const routeCoordinates = useMemo(() => {
    return selectedLogs.map((log) => ({
      latitude: Number(log.latitude),
      longitude: Number(log.longitude),
    }));
  }, [selectedLogs]);

  // ==========================================================
  // FIRST / LAST LOG
  // ==========================================================

  const firstLog = selectedLogs[0] ?? null;

  const lastLog =
    selectedLogs.length > 0 ? selectedLogs[selectedLogs.length - 1] : null;

  // ==========================================================
  // SELECTED DATE LABEL
  // ==========================================================

  const selectedDateLabel = useMemo(() => {
    if (!selectedDate) {
      return "Select Date";
    }

    const item = availableDates.find((date) => date.dateKey === selectedDate);

    if (!item || item.logs.length === 0) {
      return selectedDate;
    }

    return formatDate(item.logs[0].capturedAt);
  }, [availableDates, selectedDate]);

  // ==========================================================
  // SELECTED SESSION LABEL
  // ==========================================================

  const selectedSessionLabel = useMemo(() => {
    if (selectedSession === "all") {
      return `All Sessions (${sessions.length})`;
    }

    const session = sessions.find((item) => item.id === selectedSession);

    if (!session) {
      return "All Sessions";
    }

    return `Session ${session.sessionNumber} · ${session.dutyType ?? ""}`;
  }, [selectedSession, sessions]);

  // ==========================================================
  // LEAFLET HTML
  // ==========================================================

  const styles = useMemo(() => getStyles(isDarkTheme), [isDarkTheme]);

  useEffect(() => {
    if (!mapReady || routeCoordinates.length === 0) {
      return;
    }

    const timer = setTimeout(() => {
      if (routeCoordinates.length === 1) {
        mapRef.current?.animateToRegion(
          {
            ...routeCoordinates[0],
            latitudeDelta: 0.004,
            longitudeDelta: 0.004,
          },
          400,
        );
        return;
      }

      mapRef.current?.fitToCoordinates(routeCoordinates, {
        edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
        animated: true,
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [mapReady, routeCoordinates]);

  // ==========================================================
  // EMPTY STATE
  // ==========================================================

  if (sortedLogs.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="map-outline" size={42} color="#64748B" />
          </View>

          <Text style={styles.emptyTitle}>No Patrol Logs</Text>

          <Text style={styles.emptyText}>
            There are no GPS patrol logs available for the selected personnel
            and date.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ==========================================================
  // NO LOGS FOR FILTER
  // ==========================================================

  if (selectedLogs.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        {/* FILTERS */}

        <View style={styles.filterBar}>
          {/* DATE */}

          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar-outline" size={17} color="#2563EB" />

            <View style={styles.filterButtonTextContainer}>
              <Text style={styles.filterLabel}>DATE</Text>

              <Text style={styles.filterValue} numberOfLines={1}>
                {selectedDateLabel}
              </Text>
            </View>

            <Ionicons name="chevron-down" size={16} color="#64748B" />
          </TouchableOpacity>

          {/* SESSION */}

          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowSessionPicker(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="layers-outline" size={17} color="#2563EB" />

            <View style={styles.filterButtonTextContainer}>
              <Text style={styles.filterLabel}>SESSION</Text>

              <Text style={styles.filterValue} numberOfLines={1}>
                {selectedSessionLabel}
              </Text>
            </View>

            <Ionicons name="chevron-down" size={16} color="#64748B" />
          </TouchableOpacity>
        </View>

        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="location-outline" size={42} color="#64748B" />
          </View>

          <Text style={styles.emptyTitle}>No Logs for Selection</Text>

          <Text style={styles.emptyText}>
            There are no GPS logs available for the selected date and session.
          </Text>
        </View>

        {/* DATE MODAL */}

        <Modal
          visible={showDatePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Date</Text>

                <TouchableOpacity
                  onPress={() => setShowDatePicker(false)}
                  style={styles.modalClose}
                >
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
                      <Text
                        style={[
                          styles.optionTitle,
                          active && styles.optionTitleActive,
                        ]}
                      >
                        {formatDate(item.logs[0].capturedAt)}
                      </Text>

                      <Text style={styles.optionSubtitle}>
                        {item.logs.length.toLocaleString()} GPS points
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Modal>

        {/* SESSION MODAL */}

        <Modal
          visible={showSessionPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSessionPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Session</Text>

                <TouchableOpacity
                  onPress={() => setShowSessionPicker(false)}
                  style={styles.modalClose}
                >
                  <Ionicons name="close" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.optionRow,
                  selectedSession === "all" && styles.optionRowActive,
                ]}
                onPress={() => {
                  setSelectedSession("all");
                  setShowSessionPicker(false);
                }}
              >
                <Ionicons
                  name={
                    selectedSession === "all"
                      ? "radio-button-on"
                      : "radio-button-off"
                  }
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
                      <Text
                        style={[
                          styles.optionTitle,
                          active && styles.optionTitleActive,
                        ]}
                      >
                        Session {session.sessionNumber}{" "}
                        {session.dutyType ? `· ${session.dutyType}` : ""}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // ==========================================================
  // SCREEN
  // ==========================================================

  return (
    <SafeAreaView style={styles.container}>
      {/* =====================================================
          FILTER BAR
          ===================================================== */}

      <View style={styles.filterBar}>
        {/* DATE */}

        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="calendar-outline" size={17} color="#2563EB" />

          <View style={styles.filterButtonTextContainer}>
            <Text style={styles.filterLabel}>DATE</Text>

            <Text style={styles.filterValue} numberOfLines={1}>
              {selectedDateLabel}
            </Text>
          </View>

          <Ionicons name="chevron-down" size={16} color="#64748B" />
        </TouchableOpacity>

        {/* SESSION */}

        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowSessionPicker(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="layers-outline" size={17} color="#2563EB" />

          <View style={styles.filterButtonTextContainer}>
            <Text style={styles.filterLabel}>SESSION</Text>

            <Text style={styles.filterValue} numberOfLines={1}>
              {selectedSessionLabel}
            </Text>
          </View>

          <Ionicons name="chevron-down" size={16} color="#64748B" />
        </TouchableOpacity>
      </View>

      {/* =====================================================
          MAP
          ===================================================== */}

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFillObject}
          mapType={mapType}
          onMapReady={() => setMapReady(true)}
          toolbarEnabled={false}
          rotateEnabled={false}
          userInterfaceStyle={isDarkTheme ? "dark" : "light"}
        >
          {routeCoordinates.length >= 2 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeColor={isDarkTheme ? "#60A5FA" : "#2563EB"}
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
            />
          )}

          {firstLog && (
            <Marker
              coordinate={{
                latitude: Number(firstLog.latitude),
                longitude: Number(firstLog.longitude),
              }}
              title="Patrol Start"
              description={`${formatTime(firstLog.capturedAt)}${
                firstLog.dutyType ? ` - ${firstLog.dutyType}` : ""
              }`}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={[styles.mapMarker, { backgroundColor: "#16A34A" }]}>
                <Ionicons name="play" size={16} color="#FFFFFF" />
              </View>
            </Marker>
          )}

          {lastLog && (
            <Marker
              coordinate={{
                latitude: Number(lastLog.latitude),
                longitude: Number(lastLog.longitude),
              }}
              title="Last Location"
              description={`${formatTime(lastLog.capturedAt)}-${lastLog.dutyType}`}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={[styles.mapMarker, { backgroundColor: "#DC2626" }]}>
                <Ionicons name="flag" size={16} color="#FFFFFF" />
              </View>
            </Marker>
          )}
        </MapView>

        {/* MAP TYPE + FIT BUTTONS */}
        <View style={styles.mapControls}>
          <TouchableOpacity
            style={styles.mapControlButton}
            activeOpacity={0.8}
            onPress={() =>
              setMapType((current) =>
                current === "hybrid" ? "standard" : "hybrid",
              )
            }
          >
            <Ionicons
              name={mapType === "hybrid" ? "map-outline" : "earth-outline"}
              size={20}
              color={isDarkTheme ? "#F8FAFC" : "#0F172A"}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mapControlButton}
            activeOpacity={0.8}
            onPress={() =>
              mapRef.current?.fitToCoordinates(routeCoordinates, {
                edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
                animated: true,
              })
            }
          >
            <Ionicons
              name="scan-outline"
              size={20}
              color={isDarkTheme ? "#F8FAFC" : "#0F172A"}
            />
          </TouchableOpacity>
        </View>

        {/* ===================================================
            LOG COUNT
            =================================================== */}

        <View style={styles.logCount}>
          <Ionicons name="location" size={14} color="#FFFFFF" />

          <Text style={styles.logCountText}>
            {selectedLogs.length.toLocaleString()}
            {" points"}
          </Text>
        </View>

        {/* ===================================================
            SESSION COUNT
            =================================================== */}

        <View style={styles.sessionCount}>
          <Ionicons name="layers" size={13} color="#FFFFFF" />

          <Text style={styles.sessionCountText}>
            {selectedSession === "all"
              ? `${sessions.length} sessions`
              : "1 session"}
          </Text>
        </View>

        <View style={styles.patrolStatsCard}>
          <View style={styles.patrolStatBox}>
            <Ionicons name="speedometer-outline" size={20} color={theme.blue} />
            <View style={styles.patrolStatTextBox}>
              <Text style={styles.patrolStatLabel}>Kilometer Patrolled</Text>
              <Text style={styles.patrolStatValue}>
                {patrolStats.km.toFixed(2)} km
              </Text>
            </View>
          </View>

          <View style={styles.patrolStatDivider} />

          <View style={styles.patrolStatBox}>
            <Ionicons name="time-outline" size={20} color={theme.blue} />
            <View style={styles.patrolStatTextBox}>
              <Text style={styles.patrolStatLabel}>Hours Patrolled</Text>
              <Text style={styles.patrolStatValue}>
                {formatDuration(patrolStats.durationMs)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* =====================================================
          DATE MODAL
          ===================================================== */}

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

                <Text style={styles.modalSubtitle}>
                  Choose the patrol date to display
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setShowDatePicker(false)}
                style={styles.modalClose}
              >
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
                    <Text
                      style={[
                        styles.optionTitle,
                        active && styles.optionTitleActive,
                      ]}
                    >
                      {formatDate(item.logs[0].capturedAt)}
                    </Text>

                    <Text style={styles.optionSubtitle}>
                      {item.logs.length.toLocaleString()} GPS points
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>

      {/* =====================================================
          SESSION MODAL
          ===================================================== */}

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

                <Text style={styles.modalSubtitle}>
                  A new session starts after 10 minutes
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setShowSessionPicker(false)}
                style={styles.modalClose}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* ALL SESSIONS */}

            <TouchableOpacity
              style={[
                styles.optionRow,
                selectedSession === "all" && styles.optionRowActive,
              ]}
              onPress={() => {
                setSelectedSession("all");
                setShowSessionPicker(false);
              }}
            >
              <Ionicons
                name={
                  selectedSession === "all"
                    ? "radio-button-on"
                    : "radio-button-off"
                }
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

            {/* SESSIONS */}

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
                    <Text
                      style={[
                        styles.optionTitle,
                        active && styles.optionTitleActive,
                      ]}
                    >
                      Session {session.sessionNumber}
                    </Text>

                    <Text style={styles.optionSubtitle}>
                      {session.dutyType ? `${session.dutyType}` : ""}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ============================================================
// STYLES
// ============================================================

const getStyles = (isDarkTheme: boolean) =>
  StyleSheet.create({
    // ==========================================================
    // CONTAINER
    // ==========================================================

    container: {
      flex: 1,
      backgroundColor: isDarkTheme ? "#080F1C" : "#F8FAFC",
    },

    // ==========================================================
    // HEADER
    // ==========================================================

    header: {
      height: 68,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",

      backgroundColor: isDarkTheme ? "#101B2D" : "#FFFFFF",

      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: isDarkTheme ? "#26354A" : "#E2E8F0",

      zIndex: 10,
    },

    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },

    headerIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",

      backgroundColor: isDarkTheme ? "#172B46" : "#EFF6FF",

      marginRight: 11,
    },

    headerTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: isDarkTheme ? "#F8FAFC" : "#0F172A",
    },

    headerSubtitle: {
      marginTop: 2,
      fontSize: 12,
      color: isDarkTheme ? "#94A3B8" : "#64748B",
      fontWeight: "500",
      maxWidth: 250,
    },

    fitButton: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",

      backgroundColor: isDarkTheme ? "#172B46" : "#EFF6FF",

      marginLeft: 10,
    },

    // ==========================================================
    // FILTER BAR
    // ==========================================================

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

    filterButtonTextContainer: {
      flex: 1,
      marginLeft: 8,
      minWidth: 0,
    },

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

    // ==========================================================
    // MAP
    // ==========================================================

    mapContainer: {
      flex: 1,
      overflow: "hidden",
    },

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

      elevation: 4,

      shadowColor: "#000000",
      shadowOpacity: 0.2,
      shadowRadius: 4,

      shadowOffset: {
        width: 0,
        height: 2,
      },
    },

    logCountText: {
      marginLeft: 6,
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "700",
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

      elevation: 4,

      shadowColor: "#000000",
      shadowOpacity: 0.2,
      shadowRadius: 4,

      shadowOffset: {
        width: 0,
        height: 2,
      },
    },

    sessionCountText: {
      marginLeft: 5,
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "700",
    },

    // ==========================================================
    // INFORMATION PANEL
    // ==========================================================

    infoPanel: {
      backgroundColor: isDarkTheme ? "#101B2D" : "#FFFFFF",

      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 16,

      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,

      marginTop: -18,
      zIndex: 20,

      shadowColor: "#000000",
      shadowOpacity: 0.12,
      shadowRadius: 10,

      shadowOffset: {
        width: 0,
        height: -4,
      },

      elevation: 10,
    },

    // ==========================================================
    // PERSONNEL
    // ==========================================================

    personnelRow: {
      flexDirection: "row",
      alignItems: "center",
    },

    personnelAvatar: {
      width: 42,
      height: 42,
      borderRadius: 13,

      alignItems: "center",
      justifyContent: "center",

      backgroundColor: isDarkTheme ? "#172B46" : "#EFF6FF",

      marginRight: 10,
    },

    personnelInfo: {
      flex: 1,
      minWidth: 0,
    },

    personnelName: {
      fontSize: 15,
      fontWeight: "800",
      color: isDarkTheme ? "#F8FAFC" : "#0F172A",
    },

    personnelDate: {
      marginTop: 2,
      fontSize: 11,
      color: isDarkTheme ? "#94A3B8" : "#64748B",
    },

    dutyBadge: {
      maxWidth: 130,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,

      backgroundColor: isDarkTheme ? "#172B46" : "#EFF6FF",

      marginLeft: 8,
    },

    dutyBadgeText: {
      color: isDarkTheme ? "#93C5FD" : "#1D4ED8",
      fontSize: 10,
      fontWeight: "800",
    },

    // ==========================================================
    // STATS
    // ==========================================================

    statsRow: {
      flexDirection: "row",
      marginTop: 15,
      paddingTop: 13,

      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: isDarkTheme ? "#26354A" : "#E2E8F0",
    },

    statItem: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      minWidth: 0,
    },

    statLabel: {
      fontSize: 9,
      color: isDarkTheme ? "#64748B" : "#94A3B8",
      fontWeight: "600",
    },

    statValue: {
      marginTop: 2,
      fontSize: 11,
      color: isDarkTheme ? "#F8FAFC" : "#334155",
      fontWeight: "700",
    },

    // ==========================================================
    // COORDINATES
    // ==========================================================

    coordinates: {
      marginTop: 12,
      paddingTop: 10,

      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: isDarkTheme ? "#26354A" : "#E2E8F0",

      flexDirection: "row",
      alignItems: "center",
    },

    coordinatesText: {
      flex: 1,
      marginLeft: 6,
      fontSize: 10,

      color: isDarkTheme ? "#94A3B8" : "#64748B",

      fontFamily: "monospace",
      marginRight: 8,
    },

    syncBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 7,
    },

    syncText: {
      fontSize: 9,
      fontWeight: "800",
    },

    // ==========================================================
    // EMPTY STATE
    // ==========================================================

    emptyContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 40,
    },

    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: 24,

      alignItems: "center",
      justifyContent: "center",

      backgroundColor: isDarkTheme ? "#172235" : "#E2E8F0",
    },

    emptyTitle: {
      marginTop: 18,
      fontSize: 19,
      fontWeight: "800",

      color: isDarkTheme ? "#F8FAFC" : "#0F172A",
    },

    emptyText: {
      marginTop: 8,
      textAlign: "center",
      fontSize: 13,
      lineHeight: 20,

      color: isDarkTheme ? "#94A3B8" : "#64748B",
    },

    // ==========================================================
    // MODAL
    // ==========================================================

    modalOverlay: {
      flex: 1,

      backgroundColor: isDarkTheme
        ? "rgba(0, 0, 0, 0.68)"
        : "rgba(15, 23, 42, 0.48)",

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

      shadowOffset: {
        width: 0,
        height: 8,
      },

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

    // ==========================================================
    // MODAL OPTIONS
    // ==========================================================

    optionRow: {
      flexDirection: "row",
      alignItems: "center",

      paddingHorizontal: 10,
      paddingVertical: 12,

      borderRadius: 12,
      marginTop: 5,
    },

    optionRowActive: {
      backgroundColor: isDarkTheme ? "#172B46" : "#EFF6FF",
    },

    optionContent: {
      flex: 1,
      marginLeft: 10,
      minWidth: 0,
    },

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

    mapMarker: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 3,
      borderColor: "#FFFFFF",
    },

    mapControls: {
      position: "absolute",
      right: 14,
      top: 62,
      gap: 8,
    },

    mapControlButton: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDarkTheme
        ? "rgba(16, 27, 45, 0.94)"
        : "rgba(255,255,255,0.95)",
      elevation: 4,
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
      backgroundColor: isDarkTheme
        ? "rgba(16, 27, 45, 0.95)"
        : "rgba(255,255,255,0.96)",
      elevation: 6,
      shadowColor: "#000000",
      shadowOpacity: 0.18,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },

    patrolStatBox: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
    },

    patrolStatTextBox: {
      marginLeft: 10,
    },

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
  });
