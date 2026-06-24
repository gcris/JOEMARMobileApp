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
} from "react-native";
import { Personnel, PersonnelLog, Schedule } from "../types";
import { getStyles, getThemeColors } from "../theme/styles";
import { generateRandomSecret, getOTPAuthUri } from "../services/totp";
import { enrollMFA } from "../services/supabaseMFA";
import Ionicons from "@expo/vector-icons/Ionicons";

interface DashboardViewProps {
  personnel: Personnel | null;
  schedule: Schedule | null;
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
  onClearCache,
  onOpenSettings,
  onEmergencySOS,
  autoSync,
  onToggleAutoSync,
  is2FAEnabled,
  onEnable2FA,
  onDisable2FA,
  isDarkTheme,
  foregroundGranted,
  backgroundGranted,
  onRequestForeground,
  onRequestBackground,
  onEnableGpsInline,
}: DashboardViewProps) => {
  const styles = getStyles(isDarkTheme);
  const colors = getThemeColors(isDarkTheme);

  // Navigation state for bottom navigation bar: home, sos, account
  const [activeNav, setActiveNav] = useState<"home" | "sos" | "account">(
    "home",
  );

  // TOTP local setup states
  const [isSettingUp2FA, setIsSettingUp2FA] = useState(false);
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);

  const start2FASetup = async () => {
    setMfaLoading(true);
    try {
      const email = personnel?.email || "";
      const result = await enrollMFA(email);
      setMfaSecret(result.secret);
      setMfaFactorId(result.id);
      setMfaToken("");
      setIsSettingUp2FA(true);
    } catch (err) {
      console.warn("MFA Setup Initialization Error", err);
      Alert.alert(
        "Setup Error",
        "Failed to contact Supabase Auth to register dynamic MFA factors.",
      );
    } finally {
      setMfaLoading(false);
    }
  };

  const handleCopySecret = () => {
    Clipboard.setString(mfaSecret);
    Alert.alert(
      "Secret Copied",
      "Your Two-Factor setup key has been saved to device clipboard.",
    );
  };

  const handleEnable2FAConfirm = async () => {
    if (mfaToken.trim().length !== 6) {
      Alert.alert(
        "Verify Error",
        "Please enter a valid 6-digit verification code.",
      );
      return;
    }
    setMfaLoading(true);
    const success = await onEnable2FA(mfaSecret, mfaToken.trim(), mfaFactorId);
    setMfaLoading(false);
    if (success) {
      setIsSettingUp2FA(false);
      setMfaToken("");
    }
  };

  const handleDisable2FAConfirm = () => {
    Alert.alert(
      "Disable MFA Protection?",
      "Warning: Disabling Two-Factor Authorization decreases account safety. PNP guidelines suggest maintaining active authenticator link locks.",
      [
        {
          text: "Confirm Disable",
          style: "destructive",
          onPress: onDisable2FA,
        },
        { text: "Cancel", style: "cancel" },
      ],
    );
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
          style={[styles.card, { paddingVertical: 12, paddingHorizontal: 16 }]}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 6,
                backgroundColor: isDarkTheme ? "#1E293B" : "#F1F5F9",
                borderWidth: 1,
                borderColor: colors.borderBlue,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons
                name="person"
                size={45}
                color={isDarkTheme ? "white" : "black"}
              />
            </View>
            <View style={{ marginLeft: 14, flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                  }}
                >
                  <Text
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
                  const isSos = log.speed === 999.0;
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
              {schedule ? (
                <View style={{ gap: 10 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <Text style={{ fontSize: 16, color: colors.textSecondary }}>
                      Sector:
                    </Text>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "700", // Fixed TypeScript weight constraint
                        color: colors.blackText,
                        flexShrink: 1, // Allows the value to shrink and wrap instead of overflowing
                        textAlign: "right",
                      }}
                    >
                      {schedule?.sector}
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      borderTopWidth: 0.5,
                      borderTopColor: colors.borderBlue,
                      paddingTop: 8,
                    }}
                  >
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                      Duration of Duty:
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "bold",
                        color: colors.blackText,
                      }}
                    >
                      {schedule.date}
                      {" from "}
                      {schedule.timeFrom}
                      {" to "}
                      {schedule.timeTo}
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      borderTopWidth: 0.5,
                      borderTopColor: colors.borderBlue,
                      paddingTop: 8,
                    }}
                  >
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                      Force Scheduled Date:
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "bold",
                        color: colors.blackText,
                      }}
                    >
                      {new Date().toISOString().split("T")[0]}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.emptyTableText}>
                  No records of schedule. Contact your encoder.
                </Text>
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

        {/* TAB VALUE 2: FORCE TOOLS & SECURITY CONTROL SHIELD */}
        {activeNav === "account" && (
          <View style={{ width: "100%" }}>
            {/* SUPABASE MULTI-FACTOR AUTHENTICATION (MFA) CARD */}
            <View style={styles.card}>
              <Text style={styles.cardHeading}>
                🛡️ SUPABASE MULTI-FACTOR AUTHENTICATION (MFA)
              </Text>

              {is2FAEnabled && !isSettingUp2FA ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: isDarkTheme ? "#1B2C24" : "#E6F4EA",
                    padding: 12,
                    borderRadius: 8,
                    marginBottom: 14,
                  }}
                >
                  <Text style={{ fontSize: 28, marginRight: 12 }}>🛡️</Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "bold",
                        color: "#10B981",
                      }}
                    >
                      MFA IDENTIFICATION ENFORCED
                    </Text>
                    <Text
                      style={{ fontSize: 9.5, color: colors.textSecondary }}
                    >
                      Officer shield is protected by rotating Supabase MFA
                      tokens. Future identity joins will require authenticator
                      synchronizations.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={{
                      backgroundColor: "#EF4444",
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 4,
                    }}
                    onPress={handleDisable2FAConfirm}
                  >
                    <Text
                      style={{
                        color: "#FFFFFF",
                        fontSize: 9,
                        fontWeight: "bold",
                      }}
                    >
                      DISABLE
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : !isSettingUp2FA ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: isDarkTheme ? "#2d1b1b" : "#FEF2F2",
                    padding: 12,
                    borderRadius: 8,
                    marginBottom: 14,
                  }}
                >
                  <Text style={{ fontSize: 28, marginRight: 12 }}>🔓</Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "bold",
                        color: "#EF4444",
                      }}
                    >
                      MFA PROTECTION SUSPENDED
                    </Text>
                    <Text
                      style={{ fontSize: 9.5, color: colors.textSecondary }}
                    >
                      Identity linkage is relying on passwords only. Enable
                      Supabase MFA security keys to lock coordinate logs from
                      administrative modifications.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={{
                      backgroundColor: colors.accentAmber,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 4,
                    }}
                    onPress={start2FASetup}
                  >
                    <Text
                      style={{
                        color: isDarkTheme ? "#0B121F" : "#FFFFFF",
                        fontSize: 9,
                        fontWeight: "900",
                      }}
                    >
                      ACTIVATE
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* TWO FACTOR SETUP INLINE WORKFLOW */}
              {isSettingUp2FA && (
                <View
                  style={{
                    borderTopWidth: 0.5,
                    borderTopColor: colors.borderBlue,
                    paddingTop: 14,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "900",
                      color: colors.accentAmber,
                      marginBottom: 4,
                    }}
                  >
                    STEP 1: CONFIGURE SYSTEM KEY
                  </Text>
                  <Text
                    style={{
                      fontSize: 10.5,
                      color: colors.textSecondary,
                      marginBottom: 10,
                    }}
                  >
                    Open your Authenticator app (Google Authenticator, Microsoft
                    Authenticator, etc.) on your smartphone, tap "+", select
                    "Enter setup key".
                  </Text>

                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "900",
                      color: colors.accentAmber,
                      marginBottom: 4,
                    }}
                  >
                    STEP 2: DETAILS INTEGRATIONS
                  </Text>
                  <View
                    style={{
                      backgroundColor: isDarkTheme ? "#0F172A" : "#F8FAFC",
                      padding: 12,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: colors.borderBlue,
                      marginBottom: 10,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 9,
                        color: colors.textSecondary,
                        alignSelf: "flex-start",
                      }}
                    >
                      Account Reference:
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "bold",
                        color: colors.blackText,
                        marginBottom: 8,
                        alignSelf: "flex-start",
                      }}
                    >
                      PNP Patroller ({personnel?.badgeNumber || "0000"})
                    </Text>

                    {/* scan-ready QR code */}
                    <View
                      style={{
                        backgroundColor: "#FFFFFF",
                        padding: 8,
                        borderRadius: 8,
                        marginBottom: 10,
                        borderWidth: 1,
                        borderColor: "#E2E8F0",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Image
                        source={{
                          uri: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(getOTPAuthUri(personnel?.badgeNumber || "0000", mfaSecret))}`,
                        }}
                        style={{ width: 140, height: 140 }}
                        resizeMode="contain"
                      />
                    </View>

                    <Text
                      style={{
                        fontSize: 9,
                        color: colors.textSecondary,
                        alignSelf: "flex-start",
                      }}
                    >
                      Secret Private key:
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: "monospace",
                        fontWeight: "bold",
                        color: colors.accentAmber,
                        letterSpacing: 1,
                        alignSelf: "flex-start",
                      }}
                    >
                      {mfaSecret}
                    </Text>

                    <TouchableOpacity
                      style={{
                        backgroundColor: colors.borderBlue,
                        alignSelf: "flex-start",
                        paddingVertical: 4,
                        paddingHorizontal: 8,
                        borderRadius: 4,
                        marginTop: 8,
                      }}
                      onPress={handleCopySecret}
                    >
                      <Text
                        style={{
                          fontSize: 8.5,
                          fontWeight: "bold",
                          color: colors.blackText,
                        }}
                      >
                        📋 COPY KEY
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "900",
                      color: colors.accentAmber,
                      marginBottom: 4,
                    }}
                  >
                    STEP 3: SECURE TOKEN VERIFY
                  </Text>
                  <Text
                    style={{
                      fontSize: 10.5,
                      color: colors.textSecondary,
                      marginBottom: 6,
                    }}
                  >
                    Enter the 6-digit rotation code displayed in your
                    Authenticator app:
                  </Text>

                  <TextInput
                    style={[
                      styles.input,
                      {
                        textAlign: "center",
                        fontSize: 18,
                        letterSpacing: 4,
                        paddingVertical: 8,
                        marginBottom: 10,
                      },
                    ]}
                    value={mfaToken}
                    onChangeText={(v) => setMfaToken(v.replace(/[^0-9]/g, ""))}
                    placeholder="000000"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="number-pad"
                    maxLength={6}
                  />

                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        backgroundColor: "#10B981",
                        paddingVertical: 10,
                        borderRadius: 6,
                        alignItems: "center",
                      }}
                      onPress={handleEnable2FAConfirm}
                      disabled={mfaLoading}
                    >
                      {mfaLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text
                          style={{
                            color: "#FFFFFF",
                            fontSize: 11,
                            fontWeight: "bold",
                          }}
                        >
                          VERIFY PROTOCOLS
                        </Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        backgroundColor: colors.borderBlue,
                        paddingVertical: 10,
                        borderRadius: 6,
                        alignItems: "center",
                      }}
                      onPress={() => setIsSettingUp2FA(false)}
                    >
                      <Text
                        style={{
                          color: colors.blackText,
                          fontSize: 11,
                          fontWeight: "bold",
                        }}
                      >
                        CANCEL
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* SYSTEM AUTO SYNC OPTIONS AND TRASH TRIGGERS */}
            <View style={styles.card}>
              <Text style={styles.cardHeading}>
                COMMUNICATION PORT SETTINGS
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingVertical: 12,
                  borderBottomWidth: 0.5,
                  borderBottomColor: colors.borderBlue,
                }}
              >
                <View style={{ flex: 1, marginRight: 16 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "bold",
                      color: colors.blackText,
                    }}
                  >
                    AUTOMATIC HQ UPLINK CACHING
                  </Text>
                  <Text style={{ fontSize: 10, color: colors.textSecondary }}>
                    When connection is active, auto-upload coordinate streams to
                    Supabase servers every 60 seconds.
                  </Text>
                </View>
                <Switch
                  value={autoSync}
                  onValueChange={onToggleAutoSync}
                  trackColor={{ false: "#767577", true: "#10B981" }}
                  thumbColor={autoSync ? "#FFFFFF" : "#f4f3f4"}
                />
              </View>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingVertical: 12,
                }}
              >
                <View style={{ flex: 1, marginRight: 16 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "bold",
                      color: colors.blackText,
                    }}
                  >
                    FLUSH SYNCED ARCHIVES
                  </Text>
                  <Text style={{ fontSize: 10, color: colors.textSecondary }}>
                    Remove all synced coordinates logs permanently from local
                    Sqlite storage.
                  </Text>
                </View>
                <TouchableOpacity
                  style={{
                    backgroundColor: "#EF4444",
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderRadius: 6,
                  }}
                  onPress={onClearCache}
                >
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 10,
                      fontWeight: "bold",
                    }}
                  >
                    PURGE SYNCED
                  </Text>
                </TouchableOpacity>
              </View>
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
              // Navigate to AccountScreen with personnel ID
              // Note: This would need navigation prop passed down
              // For now, we'll just log or show alert

              console.log(
                "Navigate to AccountScreen for personnel:",
                personnel?.id,
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
