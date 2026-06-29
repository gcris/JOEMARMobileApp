import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Switch,
  Clipboard,
  Alert,
  Image,
  TextInput,
  Linking,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Personnel, PersonnelLog, Schedule } from "../types";
import { getStyles, getThemeColors } from "../theme/styles";
import { enrollMFA } from "../services/supabaseMFA";
import Ionicons from "@expo/vector-icons/Ionicons";

interface DashboardViewProps {
  personnel: Personnel | null;
  schedule: Schedule[] | null;
  isShiftActive: boolean;
  isGpsEnabled: boolean;
  unsyncedCount: number;
  logs: PersonnelLog[];
  isSyncing: boolean;
  onToggleShift: () => void;
  onSync: () => void;
  onClearCache: () => void;
  onOpenSettings: () => void;
  onEmergencySOS: () => void;

  // Tactical Settings props passed directly down
  autoSync: boolean;
  onToggleAutoSync: () => void;
  is2FAEnabled: boolean;
  onEnable2FA: (
    secret: string,
    code: string,
    factorId?: string,
  ) => Promise<boolean>;
  onDisable2FA: () => Promise<void>;

  isDarkTheme: boolean;
  foregroundGranted: boolean | null;
  backgroundGranted: boolean | null;
  onRequestForeground: () => Promise<boolean>;
  onRequestBackground: () => Promise<boolean>;
  onEnableGpsInline: () => Promise<boolean>;
}

export const DashboardView = ({
  personnel,
  schedule,
  isShiftActive,
  isGpsEnabled,
  unsyncedCount,
  logs,
  isSyncing,
  onToggleShift,
  onSync,
  onOpenSettings,
  onEmergencySOS,
  isDarkTheme,
  foregroundGranted,
  backgroundGranted,
  onRequestForeground,
  onRequestBackground,
  onEnableGpsInline,
}: DashboardViewProps) => {
  const styles = getStyles(isDarkTheme);
  const colors = getThemeColors(isDarkTheme);
  const navigation = useNavigation<any>();

  // Navigation state for bottom navigation bar: home, sos, account
  const [activeNav, setActiveNav] = useState<"home" | "sos" | "account">(
    "home",
  );

  const handlePhoneCall = (phoneNumber: string) => {
    if (!phoneNumber) return;
    // tel: protocol opens the device's native dialer automatically
    const url = `tel:${phoneNumber.replace(/\s+/g, "")}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Alert.alert("Error", "Phone calls are not supported on this device.");
        }
      })
      .catch((err) => console.error("Linking error:", err));
  };

  const handleViberCall = (viberNumber: string) => {
    if (!viberNumber) return;
    // Clean the number (remove spaces and the '+' symbol if present for the URI protocol)
    const cleanNumber = viberNumber.replace(/[\s+]+/g, "");
    // viber://contact?number= protocol launches the native Viber application
    const url = `viber://contact?number=%2B${cleanNumber}`;

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          // Fallback: If the app isn't installed, prompt them or open via web link
          Alert.alert(
            "Viber Not Found",
            "Viber app is not installed on this device. Redirecting to web...",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Open Web",
                onPress: () => Linking.openURL(`https://invite.viber.com/`),
              },
            ],
          );
        }
      })
      .catch((err) => console.error("Viber linking error:", err));
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.dashboardContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* ACCESS SYSTEM STATUS PANEL */}
        {(foregroundGranted === false ||
          backgroundGranted === false ||
          !isGpsEnabled) && (
          <View
            style={{
              backgroundColor: isDarkTheme ? "#1E293B" : "#F1F5F9",
              borderWidth: 1,
              borderColor: "#EF4444",
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
              // marginVertical: 12,
              // marginHorizontal: 16,
            }}
          >
            <Text
              style={{
                color: "#EF4444",
                fontWeight: "bold",
                fontSize: 20,
                textAlign: "center",
                marginBottom: 4,
              }}
            >
              PHONE PERMISSIONS
            </Text>
            <Text
              style={{
                color: isDarkTheme ? "#94A3B8" : "#475569",
                fontSize: 15,
                textAlign: "center",
                marginBottom: 12,
                lineHeight: 16,
              }}
            >
              INPPO Patrol Tracker requires active security clearances. Please
              grant these permissions below.
            </Text>

            {/* Foreground */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 5,
                borderBottomWidth: 1,
                borderColor: isDarkTheme
                  ? "rgba(255,255,255,0.05)"
                  : "rgba(0,0,0,0.05)",
              }}
            >
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: "bold",
                    color: isDarkTheme ? "#FFFFFF" : "#0F172A",
                  }}
                >
                  1. Location Access {foregroundGranted ? "✅" : "❌"}
                </Text>
              </View>
              {!foregroundGranted && (
                <TouchableOpacity
                  onPress={onRequestForeground}
                  style={{
                    backgroundColor: "#EF4444",
                    paddingVertical: 4,
                    paddingHorizontal: 10,
                    borderRadius: 5,
                  }}
                >
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontWeight: "bold",
                      fontSize: 15,
                    }}
                  >
                    ACTIVATE
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Background */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 5,
                borderBottomWidth: 1,
                borderColor: isDarkTheme
                  ? "rgba(255,255,255,0.05)"
                  : "rgba(0,0,0,0.05)",
              }}
            >
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: "bold",
                    color: isDarkTheme ? "#FFFFFF" : "#0F172A",
                  }}
                >
                  2. Background Location Access{" "}
                  {backgroundGranted ? "✅" : "❌"}
                </Text>
              </View>
              {foregroundGranted && !backgroundGranted && (
                <TouchableOpacity
                  onPress={onRequestBackground}
                  style={{
                    backgroundColor: "#EF4444",
                    paddingVertical: 4,
                    paddingHorizontal: 10,
                    borderRadius: 5,
                  }}
                >
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontWeight: "bold",
                      fontSize: 15,
                    }}
                  >
                    ENABLE
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* GPS Services */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 5,
              }}
            >
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: "bold",
                    color: isDarkTheme ? "#FFFFFF" : "#0F172A",
                  }}
                >
                  3. Enable Location {isGpsEnabled ? "✅" : "❌"}
                </Text>
              </View>
              {!isGpsEnabled && (
                <TouchableOpacity
                  onPress={async () => {
                    const resolved = await onEnableGpsInline();
                    if (!resolved) {
                      Alert.alert(
                        "GPS Action Required",
                        "Could not auto-toggle device location services. Please configure GPS via system settings.",
                        [
                          { text: "Open settings", onPress: onOpenSettings },
                          { text: "Cancel", style: "cancel" },
                        ],
                      );
                    }
                  }}
                  style={{
                    backgroundColor: "#EF4444",
                    paddingVertical: 4,
                    paddingHorizontal: 10,
                    borderRadius: 5,
                  }}
                >
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontWeight: "bold",
                      fontSize: 15,
                    }}
                  >
                    ENABLE
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* OFFICER PROFILE CARD */}
        <View
          style={[styles.card, { paddingVertical: 5, paddingHorizontal: 10 }]}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {/* Personnel Photo */}
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 6,
                backgroundColor: isDarkTheme ? "#1E293B" : "#F1F5F9",
                borderWidth: 1,
                borderColor: colors.borderBlue,
                justifyContent: "center",
                alignItems: "center",
                overflow: "hidden", // Important for circular clipping
              }}
            >
              {personnel?.photo_url ? (
                <Image
                  source={{ uri: personnel.photo_url }}
                  style={{ width: "100%", height: "100%", resizeMode: "cover" }}
                />
              ) : (
                <Ionicons
                  name="person"
                  size={45}
                  color={isDarkTheme ? "white" : "black"}
                />
              )}
            </View>
            <View style={{ marginLeft: 14, flex: 1 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  width: "100%",
                  flex: 1,
                }}
              >
                <View
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    flex: 1, // Takes available width
                  }}
                >
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.5}
                    style={{
                      fontSize: 22,
                      fontWeight: "bold",
                      color: colors.accentAmber,
                    }}
                  >
                    {personnel?.rank?.rank_name} {personnel?.fullname}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontFamily: "monospace",
                    color: colors.textSecondary,
                    marginLeft: 8,
                  }}
                >
                  {personnel?.badgeNumber}
                </Text>
                <Text
                  style={{
                    fontSize: 15,
                    fontFamily: "monospace",
                    color: colors.textSecondary,
                    marginLeft: 8,
                  }}
                >
                  {personnel?.designation}
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontFamily: "monospace",
                    color: colors.textSecondary,
                    marginLeft: 8,
                  }}
                >
                  {personnel?.phoneNumber || "No phone number"}
                </Text>
                <Text
                  style={{
                    fontSize: 15,
                    fontFamily: "monospace",
                    color: colors.textSecondary,
                    marginLeft: 8,
                  }}
                >
                  {personnel?.viberNumber || "No viber number"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* TAB VALUE 1: LIVE SHIFT RADAR SCREEN (MAP CANVAS, CONTROLS, LISTS) */}
        {activeNav === "home" && (
          <View style={{ width: "100%", marginBottom: 40 }}>
            {/* ACTIVE FORCE PATROL SHIFT CONTROL CARD */}
            <View
              style={[
                styles.card,
                styles.shiftCard,
                isShiftActive && styles.shiftCardActive,
              ]}
            >
              <Text style={styles.activeShiftLabel}>Patrol Tracker</Text>
              <Text style={styles.shiftDisclaimer}>
                When active, location coordinates are streamed and saved locally
                even when screen is closed or minimized.
              </Text>

              <TouchableOpacity
                style={[
                  styles.toggleShiftBtn,
                  isShiftActive
                    ? styles.toggleShiftBtnStop
                    : styles.toggleShiftBtnStart,
                ]}
                onPress={onToggleShift}
                activeOpacity={0.8}
              >
                <Text style={styles.toggleShiftBtnText}>
                  {isShiftActive ? "STOP PATROLLING" : "START PATROLLING"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* TELEMETRY MANUAL GATEWAY SYNC BAR */}
            <View style={styles.card}>
              <Text style={styles.cardHeading}>
                PENDING LOGS STORED IN YOUR PHONE
              </Text>
              <View style={styles.syncCountsRow}>
                <View style={styles.countWidget}>
                  <Text style={styles.countVal}>{unsyncedCount}</Text>
                  <Text style={styles.countTitle}>Pending logs</Text>
                </View>
              </View>

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.primaryActionBtn]}
                  onPress={onSync}
                  disabled={isSyncing}
                  activeOpacity={0.8}
                >
                  {isSyncing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.actionBtnText}>Sync Logs</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* TELEMETRY COORDINATES LOG STREAM FEED */}
            <View style={styles.card}>
              <Text style={styles.cardHeading}>RECENT GPS DATA</Text>
              {logs.length === 0 ? (
                <Text style={styles.emptyTableText}>
                  No path records active in database. Start shift patrol.
                </Text>
              ) : (
                logs.map((log, index) => {
                  const isSos = log.dutyType === "EMERGENCY_SOS";
                  const localTime =
                    log.capturedAt.split("T")[1]?.substring(0, 8) || "00:00:00";
                  return (
                    <View
                      key={log.id || index}
                      style={[
                        styles.logRow,
                        isSos && styles.logRowSos,
                        {
                          paddingHorizontal: isSos ? 8 : 0,
                          borderRadius: isSos ? 6 : 0,
                        },
                      ]}
                    >
                      <View style={styles.logLeft}>
                        <Text style={styles.logTimeSymbol}>
                          {isSos ? "🚨" : "📍"}
                        </Text>
                        <View>
                          <Text
                            style={[
                              styles.logCoords,
                              isSos && styles.logRowSosText,
                            ]}
                          >
                            {log.latitude.toFixed(5)},{" "}
                            {log.longitude.toFixed(5)}
                          </Text>
                          <Text style={styles.logCapturedText}>
                            {log.capturedAt.split("T")[0]}
                            {" at "}
                            {localTime}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.logRight}>
                        {/* <Text style={styles.logSignalText}>
                          📶 {log.networkSignal}/4
                        </Text> */}
                        <Text
                          style={[
                            styles.logSpeedText,
                            isSos && styles.logRowSosText,
                            { color: colors.blackText },
                          ]}
                        >
                          {isSos
                            ? "EMERGENCY"
                            : `${(log.speed * 3.6).toFixed(1)} km/h`}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            {/* CONSOLIDATED PNP ASSIGNED DUTY CONSOLE & INSTRUCTIONS */}
            <View style={styles.card}>
              <Text style={styles.cardHeading}>PATROL SCHEDULE</Text>
              {schedule && schedule.length > 0 ? (
                // Wrap the list in a container View
                <View style={{ gap: 16 }}>
                  {schedule.map((item, index) => (
                    <View
                      key={item.id || index} // Unique key identifier for the React fiber tree
                      style={{
                        gap: 10,
                        padding: 12,
                        backgroundColor: isDarkTheme ? "#1B2C24" : "#E6F4EA",
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: colors.borderBlue + "22", // Subtle transparent border
                      }}
                    >
                      {/* Sector Row */}
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: 12,
                        }}
                      >
                        <Text
                          style={{ fontSize: 18, color: colors.textPrimary }}
                        >
                          Sector:
                        </Text>
                        <Text
                          style={{
                            fontSize: 18,
                            fontWeight: "700",
                            color: colors.blackText,
                            flexShrink: 1,
                            textAlign: "right",
                          }}
                        >
                          {item.sector}
                        </Text>
                      </View>

                      {/* Duty Type Row */}
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: 12,
                        }}
                      >
                        <Text
                          style={{ fontSize: 18, color: colors.textPrimary }}
                        >
                          Duty Type:
                        </Text>
                        <Text
                          style={{
                            fontSize: 18,
                            fontWeight: "700",
                            color: colors.blackText,
                            flexShrink: 1,
                            textAlign: "right",
                          }}
                        >
                          {item.duty_type}
                        </Text>
                      </View>

                      {/* Force Scheduled Date Row */}
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          borderTopWidth: 0.5,
                          borderTopColor: colors.borderBlue,
                        }}
                      >
                        <Text
                          style={{ fontSize: 18, color: colors.textPrimary }}
                        >
                          Scheduled Date:
                        </Text>
                        <Text
                          style={{
                            fontSize: 18,
                            fontWeight: "bold",
                            color: colors.blackText,
                          }}
                        >
                          {new Date().toISOString().split("T")[0]}
                        </Text>
                      </View>

                      {/* Duration of Duty Row */}
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          borderTopWidth: 0.5,
                          borderTopColor: colors.borderBlue,
                        }}
                      >
                        <Text
                          style={{ fontSize: 18, color: colors.textPrimary }}
                        >
                          Duration of Duty:
                        </Text>
                        <Text
                          style={{
                            fontSize: 18,
                            fontWeight: "bold",
                            color: colors.blackText,
                          }}
                        >
                          {item.timeFrom}
                          {" to "}
                          {item.timeTo}
                        </Text>
                      </View>

                      {/* Assigned Personnel Row */}
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          borderTopWidth: 0.5,
                          borderTopColor: colors.borderBlue,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 18,
                            fontWeight: "bold",
                            color: colors.textPrimary,
                          }}
                        >
                          Assigned Personnel
                        </Text>
                      </View>
                      {item.personnel && item.personnel.length > 0 && (
                        <View
                          style={{
                            flexDirection: "column",
                            justifyContent: "space-between",
                            borderTopWidth: 0.5,
                            borderTopColor: colors.borderBlue,
                          }}
                        >
                          {item.personnel.map((pItem, pIndex) => (
                            <View
                              key={pIndex}
                              style={{
                                flexDirection: "column",
                                gap: 8,
                                borderTopWidth: 0.5,
                                borderTopColor: colors.borderBlue,
                              }}
                            >
                              {/* Row 1: Rank and Fullname */}
                              <View
                                style={{
                                  flexDirection: "row",
                                  justifyContent: "space-between",
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 18,
                                    fontWeight: "bold",
                                    color: colors.textPrimary,
                                  }}
                                >
                                  {pItem.rank_name} {pItem.fullname}
                                </Text>
                              </View>

                              {/* Row 2: Touch-Target Action Links */}
                              <View
                                style={{
                                  flexDirection: "row",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                              >
                                {/* Clickable Mobile Phone Action Link */}
                                <TouchableOpacity
                                  onPress={() =>
                                    handlePhoneCall(pItem.phone_number)
                                  }
                                  disabled={!pItem.phone_number}
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "center", // Vertically centers icon and text inside phone link
                                    gap: 6, // Adds perfect spacing between the call icon and the string
                                  }}
                                >
                                  <Ionicons
                                    name="call"
                                    size={20}
                                    color={colors.textPrimary}
                                  />
                                  <Text
                                    style={{
                                      fontSize: 20,
                                      color: colors.textPrimary,
                                      includeFontPadding: false, // Prevents native Android font layout offsets
                                    }}
                                  >
                                    {pItem.phone_number || "N/A"}
                                  </Text>
                                </TouchableOpacity>

                                {/* Clickable Viber Action Link */}
                                <TouchableOpacity
                                  onPress={() =>
                                    handleViberCall(pItem.viber_number)
                                  }
                                  disabled={!pItem.viber_number}
                                  activeOpacity={0.6}
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "center", // Vertically centers text inside Viber link
                                    gap: 4,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 13,
                                      color: pItem.viber_number
                                        ? "#7360F2"
                                        : colors.textSecondary,
                                      textAlign: "right",
                                      includeFontPadding: false,
                                    }}
                                  >
                                    <Ionicons
                                      name="chatbox"
                                      size={20}
                                      color="#7360F2"
                                    />
                                    <Text
                                      style={{
                                        fontSize: 20,
                                        color: "#7360F2",
                                        includeFontPadding: false, // Prevents native Android font layout offsets
                                      }}
                                    >
                                      {pItem.viber_number || "N/A"}
                                    </Text>
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              ) : (
                <View style={{ padding: 20, alignItems: "center" }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 20 }}>
                    No active duty schedules assigned.
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* TAB VALUE 2: SOS EMERGENCY SCREEN */}
        {activeNav === "sos" && (
          <View style={{ width: "100%", padding: 20 }}>
            {/* SOS EMERGENCY INTERFACE */}
            <View style={styles.sosCard}>
              <Text style={styles.sosWarningText}>EMERGENCY SOS ACTIVATED</Text>
              <Text style={styles.sosDesc}>
                Your emergency signal has been sent to INPPO PHQ with your
                real-time coordinates. Remain in place unless moving to a safer
                location.
              </Text>
              <View style={{ marginVertical: 30, alignItems: "center" }}>
                <Ionicons name="alert-circle" size={80} color="#EF4444" />
              </View>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "bold",
                  color: colors.blackText,
                  textAlign: "center",
                  marginBottom: 20,
                }}
              >
                EMERGENCY CONTACTS NOTIFIED
              </Text>
              <View
                style={{
                  backgroundColor: colors.surfaceBlue,
                  padding: 15,
                  borderRadius: 10,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    color: colors.textSecondary,
                    marginBottom: 8,
                  }}
                >
                  • INPPO Operations Center
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: colors.textSecondary,
                    marginBottom: 8,
                  }}
                >
                  • Designated Emergency Contact
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: colors.textSecondary,
                    marginBottom: 8,
                  }}
                >
                  • Unit Commander
                </Text>
              </View>
              <TouchableOpacity
                style={{
                  backgroundColor: "#10B981",
                  paddingVertical: 15,
                  borderRadius: 10,
                  alignItems: "center",
                  marginTop: 30,
                }}
                onPress={() => {
                  // Reset SOS state or provide option to cancel if needed
                  // For now, just return to home
                  setActiveNav("home");
                }}
              >
                <Text
                  style={{
                    color: isDarkTheme ? "#0B121F" : "#FFFFFF",
                    fontSize: 16,
                    fontWeight: "bold",
                  }}
                >
                  RETURN TO PATROL
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* BOTTOM NAVIGATION BAR */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 60,
          flexDirection: "row",
          justifyContent: "space-around",
          alignItems: "center",
          backgroundColor: colors.surfaceBlue,
          borderWidth: 1,
          borderColor: colors.borderBlue,
          paddingHorizontal: 16,
        }}
      >
        {/* HOME ICON */}
        <TouchableOpacity
          style={{
            padding: 8,
            backgroundColor:
              activeNav === "home"
                ? isDarkTheme
                  ? "#1E293B"
                  : "#E2E8F0"
                : "transparent",
            borderRadius: 50,
          }}
          onPress={() => setActiveNav("home")}
        >
          <Ionicons
            name="home"
            size={32}
            color={
              activeNav === "home"
                ? colors.blackText
                : isDarkTheme
                  ? "#FFFFFF"
                  : colors.textSecondary
            }
          />
        </TouchableOpacity>

        {/* SOS BUTTON */}
        <TouchableOpacity
          style={{
            backgroundColor: "#EF4444",
            width: 80,
            height: 80,
            borderRadius: 40,
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 30,
          }}
          onPress={() => onEmergencySOS()}
        >
          <Ionicons
            name="alert-circle"
            size={60}
            color={
              activeNav === "sos"
                ? colors.blackText
                : isDarkTheme
                  ? "#FFFFFF"
                  : colors.white
            }
          />
        </TouchableOpacity>

        {/* ACCOUNT ICON */}
        <TouchableOpacity
          style={{
            padding: 8,
            backgroundColor:
              activeNav === "account"
                ? isDarkTheme
                  ? "#1E293B"
                  : "#E2E8F0"
                : "transparent",
            borderRadius: 50,
          }}
          onPress={() => {
            if (personnel) {
              navigation.navigate("Account", {
                personnelId: personnel.id,
                isDarkTheme: isDarkTheme,
                onClose: () => {
                  // Navigate back to home tab when closing account screen
                  setActiveNav("home");
                },
              });
            } else {
              // Handle case where personnel data is not available
              console.warn(
                "Personnel data not available for account navigation",
              );
              Alert.alert(
                "Error",
                "Unable to load account information. Please try again later.",
              );
            }
          }}
        >
          <Ionicons
            name="person"
            size={32}
            color={
              activeNav === "account"
                ? colors.blackText
                : isDarkTheme
                  ? "#FFFFFF"
                  : colors.textSecondary
            }
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};
