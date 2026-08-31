import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Personnel, Schedule } from "../types";
import { getStyles, getThemeColors } from "../theme/styles";
import Ionicons from "@expo/vector-icons/Ionicons";
import FontAwesome from "@expo/vector-icons/FontAwesome6";
import { PermissionView } from "../helper/PermissionView";
import { ScrollView } from "react-native-gesture-handler";
import { AccountScreen } from "./AccountScreen";

const DUTY_TYPES = [
  "Foot Patrol",
  "Mobile Patrol",
  "TMRU Patrol",
  "Bike Patrol",
  "Seaborne Patrol",
  "Checkpoint",
  "Special Event",
  "Simulation Exercise",
  "DODON",
  "Intel-Driven Operation",
  "Special Laws",
];

interface DashboardViewProps {
  personnel: Personnel | null;
  schedule: Schedule[] | null;
  isShiftActive: boolean;
  isGpsEnabled: boolean;
  unsyncedCount: number;
  isSyncing: boolean;
  isPatrolStarting: boolean;
  onToggleShift: () => void;
  onSync: () => void;
  onOpenSettings: () => void;
  onEmergencySOS: () => void;

  autoSync: boolean;
  is2FAEnabled: boolean;
  onEnable2FA: (
    secret: string,
    code: string,
    factorId?: string,
  ) => Promise<boolean>;
  onDisable2FA: () => Promise<void>;

  setActiveDutyType: (value: string) => void;

  isDarkTheme: boolean;
  foregroundGranted: boolean | null;
  backgroundGranted: boolean | null;
  onRequestForeground: () => Promise<boolean>;
  onRequestBackground: () => Promise<boolean>;
  onEnableGpsInline: () => Promise<boolean>;
  activeDutyType: string;
}

export const DashboardView = ({
  personnel,
  schedule,
  isShiftActive,
  isGpsEnabled,
  unsyncedCount,
  isSyncing,
  isPatrolStarting,
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
  setActiveDutyType,
  activeDutyType,
}: DashboardViewProps) => {
  const themeStyles = getStyles(isDarkTheme);
  const colors = getThemeColors(isDarkTheme);
  const navigation = useNavigation<any>();

  const [activeNav, setActiveNav] = useState<"home" | "sos" | "account">(
    "home",
  );

  const [selectedDutyType, setSelectedDutyType] =
    useState<string>("Foot Patrol");

  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (activeDutyType) {
      setSelectedDutyType(activeDutyType);
    }
  }, [activeDutyType]);

  const handlePhoneCall = async (phoneNumber: string) => {
    if (!phoneNumber) return;

    const url = `tel:${phoneNumber.replace(/\s+/g, "")}`;

    try {
      const supported = await Linking.canOpenURL(url);

      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert(
          "Unable to Make Call",
          "Phone calls are not supported on this device.",
        );
      }
    } catch (error) {
      console.error("Phone linking error:", error);
    }
  };

  const handleViberCall = async (viberNumber: string) => {
    if (!viberNumber) return;

    const cleanNumber = viberNumber.replace(/[\s+]+/g, "");
    const url = `viber://contact?number=%2B${cleanNumber}`;

    try {
      const supported = await Linking.canOpenURL(url);

      if (supported) {
        await Linking.openURL(url);
        return;
      }

      Alert.alert(
        "Viber Not Found",
        "Viber does not appear to be installed on this device.",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "OK",
          },
        ],
      );
    } catch (error) {
      console.error("Viber linking error:", error);
    }
  };

  const confirmPatrolToggle = async () => {
    const action = isShiftActive ? "stop" : "start";

    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        `${action === "start" ? "Start" : "Stop"} Patrol`,
        isShiftActive
          ? "Are you sure you want to stop the current patrol?"
          : `Start ${selectedDutyType} and begin recording your patrol location?`,
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => resolve(false),
          },
          {
            text: action === "start" ? "Start Patrol" : "Stop Patrol",
            style: action === "stop" ? "destructive" : "default",
            onPress: () => resolve(true),
          },
        ],
      );
    });

    if (confirmed) {
      onToggleShift();
    }
  };

  const getScheduleDate = (item: Schedule) => {
    const possibleDate =
      (item as any).date ||
      (item as any).scheduled_date ||
      (item as any).schedule_date;

    if (possibleDate) {
      try {
        return new Date(possibleDate).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      } catch {
        return possibleDate;
      }
    }

    return new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <View
      style={[
        localStyles.root,
        {
          backgroundColor: isDarkTheme ? "#080F1C" : "#F1F5F9",
        },
      ]}
    >
      {/* ================================================================ */}
      {/* MAIN DASHBOARD SCROLL                                            */}
      {/* ================================================================ */}

      <ScrollView
        style={[
          themeStyles.container,
          {
            zIndex: 1,
          },
        ]}
        contentContainerStyle={[
          localStyles.scrollContent,
          {
            paddingBottom: 105,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={true}
        showsVerticalScrollIndicator={false}
      >
        {/* ================================================================ */}
        {/* HOME                                                              */}
        {/* ================================================================ */}

        {activeNav === "home" && (
          <View style={localStyles.mainContent}>
            {/* ------------------------------------------------------------ */}
            {/* PERMISSIONS                                                   */}
            {/* ------------------------------------------------------------ */}

            {(!foregroundGranted || !backgroundGranted || !isGpsEnabled) && (
              <PermissionView
                foregroundGranted={foregroundGranted}
                backgroundGranted={backgroundGranted}
                isGpsEnabled={isGpsEnabled}
                isDarkTheme={isDarkTheme}
                onRequestForeground={onRequestForeground}
                onRequestBackground={onRequestBackground}
                onEnableGpsInline={onEnableGpsInline}
                onOpenSettings={onOpenSettings}
                gpsLoading={false}
              />
            )}

            {/* ------------------------------------------------------------ */}
            {/* PATROL TRACKER                                                */}
            {/* ------------------------------------------------------------ */}

            <View
              style={[
                localStyles.trackerCard,
                {
                  backgroundColor: isDarkTheme ? "#101B2D" : "#FFFFFF",
                  borderColor: isShiftActive
                    ? "#22C55E"
                    : isDarkTheme
                      ? "#263449"
                      : "#E2E8F0",
                },
              ]}
            >
              <View style={localStyles.sectionHeader}>
                <View
                  style={[
                    localStyles.sectionIcon,
                    {
                      backgroundColor: isShiftActive
                        ? "rgba(34,197,94,0.12)"
                        : isDarkTheme
                          ? "#1E293B"
                          : "#EFF6FF",
                    },
                  ]}
                >
                  <Ionicons
                    name="navigate-outline"
                    size={22}
                    color={
                      isShiftActive
                        ? "#22C55E"
                        : isDarkTheme
                          ? "#FACC15"
                          : "#1E3A8A"
                    }
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      localStyles.sectionTitle,
                      {
                        color: isDarkTheme ? "#F8FAFC" : "#0F172A",
                      },
                    ]}
                  >
                    Patrol Tracker
                  </Text>

                  <Text
                    style={[
                      localStyles.sectionSubtitle,
                      {
                        color: colors.textSecondary,
                      },
                    ]}
                  >
                    {isShiftActive
                      ? "Location tracking is currently active."
                      : "Start a patrol to begin location tracking."}
                  </Text>
                </View>

                <View
                  style={[
                    localStyles.liveIndicator,
                    {
                      backgroundColor: isShiftActive
                        ? "rgba(34,197,94,0.12)"
                        : isDarkTheme
                          ? "#1E293B"
                          : "#F1F5F9",
                    },
                  ]}
                >
                  <View
                    style={[
                      localStyles.liveDot,
                      {
                        backgroundColor: isShiftActive ? "#22C55E" : "#64748B",
                      },
                    ]}
                  />

                  <Text
                    style={[
                      localStyles.liveText,
                      {
                        color: isShiftActive ? "#22C55E" : colors.textSecondary,
                      },
                    ]}
                  >
                    {isShiftActive ? "LIVE" : "READY"}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  localStyles.trackerNotice,
                  {
                    backgroundColor: isDarkTheme ? "#0F172A" : "#F8FAFC",
                    borderColor: isDarkTheme ? "#263449" : "#E2E8F0",
                  },
                ]}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color={colors.textSecondary}
                />

                <Text
                  style={[
                    localStyles.trackerNoticeText,
                    {
                      color: colors.textSecondary,
                    },
                  ]}
                >
                  When active, your coordinates are recorded locally and
                  tracking continues while the screen is minimized.
                </Text>
              </View>

              {/* ---------------------------------------------------------- */}
              {/* DUTY TYPE                                                    */}
              {/* ---------------------------------------------------------- */}

              <Text
                style={[
                  localStyles.inputLabel,
                  {
                    color: isDarkTheme ? "#CBD5E1" : "#334155",
                  },
                ]}
              >
                PATROL DUTY TYPE
              </Text>

              <View style={localStyles.dutyDropdownWrapper}>
                {/* SELECTED DUTY BUTTON */}

                <TouchableOpacity
                  onPress={() => setShowDropdown((previous) => !previous)}
                  disabled={isShiftActive}
                  activeOpacity={0.8}
                  style={[
                    localStyles.dutySelector,
                    {
                      backgroundColor: isDarkTheme ? "#0F172A" : "#F8FAFC",
                      borderColor: showDropdown
                        ? isDarkTheme
                          ? "#FACC15"
                          : "#1E3A8A"
                        : isDarkTheme
                          ? "#334155"
                          : "#CBD5E1",
                      opacity: isShiftActive ? 0.55 : 1,
                    },
                  ]}
                >
                  <View style={localStyles.dutySelectorLeft}>
                    <View
                      style={[
                        localStyles.dutyIcon,
                        {
                          backgroundColor: isDarkTheme ? "#1E293B" : "#EFF6FF",
                        },
                      ]}
                    >
                      <Ionicons
                        name="walk-outline"
                        size={19}
                        color={isDarkTheme ? "#FACC15" : "#1E3A8A"}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          localStyles.dutySmallText,
                          {
                            color: colors.textSecondary,
                          },
                        ]}
                      >
                        SELECTED DUTY
                      </Text>

                      <Text
                        numberOfLines={1}
                        style={[
                          localStyles.dutyValue,
                          {
                            color: isDarkTheme ? "#F8FAFC" : "#0F172A",
                          },
                        ]}
                      >
                        {selectedDutyType}
                      </Text>
                    </View>
                  </View>

                  <Ionicons
                    name={showDropdown ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>

                {/* DROPDOWN */}

                {showDropdown && !isShiftActive && (
                  <View
                    style={[
                      localStyles.dropdownMenu,
                      {
                        backgroundColor: isDarkTheme ? "#172235" : "#FFFFFF",
                        borderColor: isDarkTheme ? "#334155" : "#CBD5E1",
                      },
                    ]}
                  >
                    <ScrollView
                      nestedScrollEnabled={true}
                      scrollEnabled={true}
                      showsVerticalScrollIndicator={true}
                      keyboardShouldPersistTaps="handled"
                      bounces={false}
                      style={localStyles.dropdownScroll}
                      contentContainerStyle={localStyles.dropdownScrollContent}
                    >
                      {DUTY_TYPES.map((dutyType) => {
                        const selected = selectedDutyType === dutyType;

                        return (
                          <TouchableOpacity
                            key={dutyType}
                            onPress={() => {
                              setSelectedDutyType(dutyType);
                              setActiveDutyType(dutyType);
                              setShowDropdown(false);
                            }}
                            activeOpacity={0.75}
                            style={[
                              localStyles.dropdownItem,
                              {
                                backgroundColor: selected
                                  ? isDarkTheme
                                    ? "#263449"
                                    : "#EFF6FF"
                                  : "transparent",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                localStyles.dropdownItemText,
                                {
                                  color: selected
                                    ? isDarkTheme
                                      ? "#FACC15"
                                      : "#1E3A8A"
                                    : isDarkTheme
                                      ? "#E2E8F0"
                                      : "#334155",
                                },
                              ]}
                            >
                              {dutyType}
                            </Text>

                            {selected && (
                              <Ionicons
                                name="checkmark"
                                size={18}
                                color={isDarkTheme ? "#FACC15" : "#1E3A8A"}
                              />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* ---------------------------------------------------------- */}
              {/* START / STOP PATROL                                         */}
              {/* ---------------------------------------------------------- */}

              <TouchableOpacity
                style={[
                  localStyles.patrolButton,
                  {
                    backgroundColor: isShiftActive ? "#DC2626" : "#16A34A",
                    opacity: isPatrolStarting ? 0.7 : 1,
                  },
                ]}
                disabled={isPatrolStarting}
                activeOpacity={0.85}
                onPress={confirmPatrolToggle}
              >
                {isPatrolStarting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <View style={localStyles.patrolButtonIcon}>
                      <Ionicons
                        name={
                          isShiftActive
                            ? "stop-circle-outline"
                            : "play-circle-outline"
                        }
                        size={32}
                        color="#FFFFFF"
                      />
                    </View>

                    <View>
                      <Text style={localStyles.patrolButtonTitle}>
                        {isShiftActive ? "STOP PATROL" : "START PATROL"}
                      </Text>

                      <Text style={localStyles.patrolButtonSubtitle}>
                        {isShiftActive
                          ? "End current tracking session"
                          : `Begin ${selectedDutyType}`}
                      </Text>
                    </View>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* ============================================================ */}
            {/* SYNC CARD                                                     */}
            {/* ============================================================ */}

            <View
              style={[
                localStyles.syncCard,
                {
                  backgroundColor: isDarkTheme ? "#101B2D" : "#FFFFFF",
                  borderColor: isDarkTheme ? "#263449" : "#E2E8F0",
                },
              ]}
            >
              <View style={localStyles.sectionHeader}>
                <View
                  style={[
                    localStyles.sectionIcon,
                    {
                      backgroundColor: isDarkTheme ? "#1E293B" : "#EFF6FF",
                    },
                  ]}
                >
                  <Ionicons
                    name="cloud-upload-outline"
                    size={22}
                    color={isDarkTheme ? "#FACC15" : "#1E3A8A"}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      localStyles.sectionTitle,
                      {
                        color: isDarkTheme ? "#F8FAFC" : "#0F172A",
                      },
                    ]}
                  >
                    Data Synchronization
                  </Text>

                  <Text
                    style={[
                      localStyles.sectionSubtitle,
                      {
                        color: colors.textSecondary,
                      },
                    ]}
                  >
                    Patrol records waiting to upload
                  </Text>
                </View>
              </View>

              <View
                style={[
                  localStyles.syncStatus,
                  {
                    backgroundColor:
                      unsyncedCount > 0
                        ? isDarkTheme
                          ? "#291D0A"
                          : "#FFFBEB"
                        : isDarkTheme
                          ? "#10251B"
                          : "#F0FDF4",
                    borderColor: unsyncedCount > 0 ? "#F59E0B" : "#22C55E",
                  },
                ]}
              >
                <View>
                  <Text
                    style={[
                      localStyles.syncCount,
                      {
                        color: unsyncedCount > 0 ? "#F59E0B" : "#22C55E",
                      },
                    ]}
                  >
                    {unsyncedCount}
                  </Text>

                  <Text
                    style={[
                      localStyles.syncCountLabel,
                      {
                        color: colors.textSecondary,
                      },
                    ]}
                  >
                    {unsyncedCount === 1 ? "pending log" : "pending logs"}
                  </Text>
                </View>

                <View style={localStyles.syncStatusRight}>
                  <Ionicons
                    name={
                      unsyncedCount > 0
                        ? "cloud-upload-outline"
                        : "cloud-done-outline"
                    }
                    size={25}
                    color={unsyncedCount > 0 ? "#F59E0B" : "#22C55E"}
                  />

                  <Text
                    style={[
                      localStyles.syncStatusText,
                      {
                        color: unsyncedCount > 0 ? "#F59E0B" : "#22C55E",
                      },
                    ]}
                  >
                    {unsyncedCount > 0 ? "WAITING TO SYNC" : "ALL SYNCED"}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  localStyles.syncButton,
                  {
                    backgroundColor:
                      unsyncedCount > 0
                        ? isDarkTheme
                          ? "#FACC15"
                          : "#1E3A8A"
                        : isDarkTheme
                          ? "#1E293B"
                          : "#F1F5F9",
                    borderColor: isDarkTheme ? "#334155" : "#E2E8F0",
                    opacity: isSyncing || unsyncedCount === 0 ? 0.65 : 1,
                  },
                ]}
                onPress={onSync}
                disabled={isSyncing || unsyncedCount === 0}
                activeOpacity={0.8}
              >
                {isSyncing ? (
                  <ActivityIndicator
                    size="small"
                    color={isDarkTheme ? "#0B121F" : "#FFFFFF"}
                  />
                ) : (
                  <>
                    <Ionicons
                      name="sync-outline"
                      size={20}
                      color={
                        unsyncedCount > 0
                          ? isDarkTheme
                            ? "#0B121F"
                            : "#FFFFFF"
                          : colors.textSecondary
                      }
                    />

                    <Text
                      style={[
                        localStyles.syncButtonText,
                        {
                          color:
                            unsyncedCount > 0
                              ? isDarkTheme
                                ? "#0B121F"
                                : "#FFFFFF"
                              : colors.textSecondary,
                        },
                      ]}
                    >
                      {unsyncedCount > 0
                        ? "SYNC PATROL LOGS"
                        : "NOTHING TO SYNC"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* ============================================================ */}
            {/* PATROL SCHEDULE                                               */}
            {/* ============================================================ */}

            <View
              style={[
                localStyles.scheduleCard,
                {
                  backgroundColor: isDarkTheme ? "#101B2D" : "#FFFFFF",
                  borderColor: isDarkTheme ? "#263449" : "#E2E8F0",
                },
              ]}
            >
              <View style={localStyles.sectionHeader}>
                <View
                  style={[
                    localStyles.sectionIcon,
                    {
                      backgroundColor: isDarkTheme ? "#1E293B" : "#EFF6FF",
                    },
                  ]}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={22}
                    color={isDarkTheme ? "#FACC15" : "#1E3A8A"}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      localStyles.sectionTitle,
                      {
                        color: isDarkTheme ? "#F8FAFC" : "#0F172A",
                      },
                    ]}
                  >
                    Patrol Schedule
                  </Text>

                  <Text
                    style={[
                      localStyles.sectionSubtitle,
                      {
                        color: colors.textSecondary,
                      },
                    ]}
                  >
                    Your assigned duties and personnel
                  </Text>
                </View>

                <View
                  style={[
                    localStyles.scheduleCount,
                    {
                      backgroundColor: isDarkTheme ? "#1E293B" : "#EFF6FF",
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "900",
                      color: isDarkTheme ? "#FACC15" : "#1E3A8A",
                    }}
                  >
                    {schedule?.length || 0}
                  </Text>
                </View>
              </View>

              {schedule && schedule.length > 0 ? (
                <View style={{ marginTop: 4 }}>
                  {schedule.map((item, index) => (
                    <View
                      key={item.id || index}
                      style={[
                        localStyles.scheduleItem,
                        {
                          backgroundColor: isDarkTheme ? "#172235" : "#F8FAFC",
                          borderColor: isDarkTheme ? "#334155" : "#E2E8F0",
                        },
                      ]}
                    >
                      {/* Schedule Header */}

                      <View style={localStyles.scheduleItemHeader}>
                        <View
                          style={[
                            localStyles.scheduleNumber,
                            {
                              backgroundColor: isDarkTheme
                                ? "#263449"
                                : "#E0E7FF",
                            },
                          ]}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "900",
                              color: isDarkTheme ? "#FACC15" : "#1E3A8A",
                            }}
                          >
                            {index + 1}
                          </Text>
                        </View>

                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text
                            style={[
                              localStyles.scheduleDuty,
                              {
                                color: isDarkTheme ? "#F8FAFC" : "#0F172A",
                              },
                            ]}
                          >
                            {item.duty_type || "Assigned Duty"}
                          </Text>

                          <View style={localStyles.scheduleSectorRow}>
                            <Ionicons
                              name="location-outline"
                              size={14}
                              color={colors.textSecondary}
                            />

                            <Text
                              numberOfLines={1}
                              style={[
                                localStyles.scheduleSector,
                                {
                                  color: colors.textSecondary,
                                },
                              ]}
                            >
                              {item.sector || "No sector specified"}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Date / Time */}

                      <View
                        style={[
                          localStyles.scheduleInfoGrid,
                          {
                            borderTopColor: isDarkTheme ? "#334155" : "#E2E8F0",
                            borderBottomColor: isDarkTheme
                              ? "#334155"
                              : "#E2E8F0",
                          },
                        ]}
                      >
                        <View style={localStyles.scheduleInfo}>
                          <Ionicons
                            name="calendar-outline"
                            size={17}
                            color={isDarkTheme ? "#FACC15" : "#1E3A8A"}
                          />

                          <View style={{ marginLeft: 8 }}>
                            <Text
                              style={[
                                localStyles.scheduleInfoLabel,
                                {
                                  color: colors.textSecondary,
                                },
                              ]}
                            >
                              DATE
                            </Text>

                            <Text
                              style={[
                                localStyles.scheduleInfoValue,
                                {
                                  color: isDarkTheme ? "#F8FAFC" : "#0F172A",
                                },
                              ]}
                            >
                              {getScheduleDate(item)}
                            </Text>
                          </View>
                        </View>

                        <View style={localStyles.scheduleInfo}>
                          <Ionicons
                            name="time-outline"
                            size={17}
                            color={isDarkTheme ? "#FACC15" : "#1E3A8A"}
                          />

                          <View style={{ marginLeft: 8 }}>
                            <Text
                              style={[
                                localStyles.scheduleInfoLabel,
                                {
                                  color: colors.textSecondary,
                                },
                              ]}
                            >
                              DUTY HOURS
                            </Text>

                            <Text
                              style={[
                                localStyles.scheduleInfoValue,
                                {
                                  color: isDarkTheme ? "#F8FAFC" : "#0F172A",
                                },
                              ]}
                            >
                              {item.timeFrom || "--"} – {item.timeTo || "--"}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Personnel */}

                      <View style={{ marginTop: 14 }}>
                        <View style={localStyles.assignedHeader}>
                          <Ionicons
                            name="people-outline"
                            size={17}
                            color={isDarkTheme ? "#FACC15" : "#1E3A8A"}
                          />

                          <Text
                            style={[
                              localStyles.assignedHeaderText,
                              {
                                color: isDarkTheme ? "#F8FAFC" : "#0F172A",
                              },
                            ]}
                          >
                            ASSIGNED PERSONNEL
                          </Text>

                          <View
                            style={[
                              localStyles.personnelCount,
                              {
                                backgroundColor: isDarkTheme
                                  ? "#263449"
                                  : "#E2E8F0",
                              },
                            ]}
                          >
                            <Text
                              style={{
                                fontSize: 16,
                                fontWeight: "900",
                                color: colors.textSecondary,
                              }}
                            >
                              {item.personnel?.length || 0}
                            </Text>
                          </View>
                        </View>

                        {item.personnel && item.personnel.length > 0 ? (
                          <View style={{ marginTop: 9 }}>
                            {item.personnel.map((pItem, pIndex) => (
                              <View
                                key={pIndex}
                                style={[
                                  localStyles.personnelRow,
                                  {
                                    backgroundColor: isDarkTheme
                                      ? "#0F172A"
                                      : "#FFFFFF",
                                    borderColor: isDarkTheme
                                      ? "#334155"
                                      : "#E2E8F0",
                                  },
                                ]}
                              >
                                <View
                                  style={[
                                    localStyles.personnelAvatar,
                                    {
                                      backgroundColor: isDarkTheme
                                        ? "#263449"
                                        : "#EFF6FF",
                                    },
                                  ]}
                                >
                                  <Ionicons
                                    name="person-outline"
                                    size={19}
                                    color={isDarkTheme ? "#FACC15" : "#1E3A8A"}
                                  />
                                </View>

                                <View
                                  style={{
                                    flex: 1,
                                    marginLeft: 10,
                                  }}
                                >
                                  <Text
                                    numberOfLines={2}
                                    style={[
                                      localStyles.personnelName,
                                      {
                                        color: isDarkTheme
                                          ? "#F8FAFC"
                                          : "#0F172A",
                                      },
                                    ]}
                                  >
                                    {pItem.rank_name || ""}{" "}
                                    {pItem.fullname || "Unknown"}
                                  </Text>

                                  <View style={localStyles.personnelActions}>
                                    <TouchableOpacity
                                      onPress={() =>
                                        handlePhoneCall(pItem.phone_number)
                                      }
                                      disabled={!pItem.phone_number}
                                      activeOpacity={0.75}
                                      style={[
                                        localStyles.smallContactButton,
                                        {
                                          backgroundColor: isDarkTheme
                                            ? "#172235"
                                            : "#F1F5F9",
                                          opacity: pItem.phone_number
                                            ? 1
                                            : 0.45,
                                        },
                                      ]}
                                    >
                                      <Ionicons
                                        name="call-outline"
                                        size={15}
                                        color="#22C55E"
                                      />

                                      <Text
                                        numberOfLines={1}
                                        style={[
                                          localStyles.smallContactText,
                                          {
                                            color: colors.textSecondary,
                                          },
                                        ]}
                                      >
                                        {pItem.phone_number || "No phone"}
                                      </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                      onPress={() =>
                                        handleViberCall(pItem.viber_number)
                                      }
                                      disabled={!pItem.viber_number}
                                      activeOpacity={0.75}
                                      style={[
                                        localStyles.smallContactButton,
                                        {
                                          backgroundColor: isDarkTheme
                                            ? "#172235"
                                            : "#F1F5F9",
                                          opacity: pItem.viber_number
                                            ? 1
                                            : 0.45,
                                        },
                                      ]}
                                    >
                                      <FontAwesome
                                        name="viber"
                                        size={15}
                                        color="#7360F2"
                                      />

                                      <Text
                                        numberOfLines={1}
                                        style={[
                                          localStyles.smallContactText,
                                          {
                                            color: colors.textSecondary,
                                          },
                                        ]}
                                      >
                                        {pItem.viber_number || "No Viber"}
                                      </Text>
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <View
                            style={[
                              localStyles.emptyPersonnel,
                              {
                                backgroundColor: isDarkTheme
                                  ? "#0F172A"
                                  : "#F8FAFC",
                              },
                            ]}
                          >
                            <Ionicons
                              name="people-outline"
                              size={22}
                              color={colors.textSecondary}
                            />

                            <Text
                              style={{
                                marginTop: 6,
                                fontSize: 13,
                                color: colors.textSecondary,
                              }}
                            >
                              No personnel assigned
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View
                  style={[
                    localStyles.emptySchedule,
                    {
                      backgroundColor: isDarkTheme ? "#0F172A" : "#F8FAFC",
                    },
                  ]}
                >
                  <View
                    style={[
                      localStyles.emptyScheduleIcon,
                      {
                        backgroundColor: isDarkTheme ? "#1E293B" : "#E2E8F0",
                      },
                    ]}
                  >
                    <Ionicons
                      name="calendar-clear-outline"
                      size={30}
                      color={colors.textSecondary}
                    />
                  </View>

                  <Text
                    style={[
                      localStyles.emptyScheduleTitle,
                      {
                        color: isDarkTheme ? "#F8FAFC" : "#0F172A",
                      },
                    ]}
                  >
                    No Active Schedule
                  </Text>

                  <Text
                    style={[
                      localStyles.emptyScheduleText,
                      {
                        color: colors.textSecondary,
                      },
                    ]}
                  >
                    No patrol duty has been assigned to you at this time.
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ================================================================ */}
        {/* SOS SCREEN                                                        */}
        {/* ================================================================ */}

        {activeNav === "sos" && (
          <View style={localStyles.sosContainer}>
            <View
              style={[
                localStyles.sosCard,
                {
                  backgroundColor: isDarkTheme ? "#241014" : "#FFFFFF",
                  borderColor: "#EF4444",
                },
              ]}
            >
              <View style={localStyles.sosHeader}>
                <View
                  style={[
                    localStyles.sosIconCircle,
                    {
                      backgroundColor: "rgba(239,68,68,0.14)",
                    },
                  ]}
                >
                  <Ionicons name="alert-circle" size={48} color="#EF4444" />
                </View>

                <Text
                  style={[
                    localStyles.sosTitle,
                    {
                      color: "#EF4444",
                    },
                  ]}
                >
                  EMERGENCY SOS
                </Text>

                <Text
                  style={[
                    localStyles.sosSubtitle,
                    {
                      color: colors.textSecondary,
                    },
                  ]}
                >
                  Emergency communication interface
                </Text>
              </View>

              <View
                style={[
                  localStyles.sosWarning,
                  {
                    backgroundColor: isDarkTheme ? "#30151A" : "#FEF2F2",
                    borderColor: "#FCA5A5",
                  },
                ]}
              >
                <Ionicons name="warning-outline" size={21} color="#EF4444" />

                <Text
                  style={[
                    localStyles.sosWarningText,
                    {
                      color: isDarkTheme ? "#FECACA" : "#991B1B",
                    },
                  ]}
                >
                  Your emergency signal has been sent with your current location
                  coordinates. Remain in a safe location unless movement is
                  necessary.
                </Text>
              </View>

              <View style={localStyles.sosStatus}>
                <View
                  style={[
                    localStyles.sosStatusIcon,
                    {
                      backgroundColor: "#DCFCE7",
                    },
                  ]}
                >
                  <Ionicons name="checkmark" size={22} color="#16A34A" />
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      localStyles.sosStatusTitle,
                      {
                        color: isDarkTheme ? "#F8FAFC" : "#0F172A",
                      },
                    ]}
                  >
                    EMERGENCY CONTACTS NOTIFIED
                  </Text>

                  <Text
                    style={[
                      localStyles.sosStatusText,
                      {
                        color: colors.textSecondary,
                      },
                    ]}
                  >
                    Your emergency notification has been processed.
                  </Text>
                </View>
              </View>

              <View
                style={[
                  localStyles.sosContacts,
                  {
                    backgroundColor: isDarkTheme ? "#0F172A" : "#F8FAFC",
                    borderColor: isDarkTheme ? "#263449" : "#E2E8F0",
                  },
                ]}
              >
                {[
                  "INPPO Operations Center",
                  "Designated Emergency Contact",
                  "Unit Commander",
                ].map((contact) => (
                  <View key={contact} style={localStyles.sosContactRow}>
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color="#22C55E"
                    />

                    <Text
                      style={[
                        localStyles.sosContactText,
                        {
                          color: isDarkTheme ? "#CBD5E1" : "#475569",
                        },
                      ]}
                    >
                      {contact}
                    </Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={localStyles.returnButton}
                activeOpacity={0.85}
                onPress={() => setActiveNav("home")}
              >
                <Ionicons name="arrow-back-outline" size={20} color="#FFFFFF" />

                <Text style={localStyles.returnButtonText}>
                  RETURN TO DASHBOARD
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {activeNav === "account" && personnel && (
          <AccountScreen
            isDarkTheme={isDarkTheme}
            personnelId={personnel?.id}
            onClose={() => setActiveNav("home")}
          />
        )}
      </ScrollView>
      {/* ================================================================ */}
      {/* BOTTOM NAVIGATION                                                 */}
      {/* ================================================================ */}

      <View
        style={[
          localStyles.bottomNav,
          {
            backgroundColor: isDarkTheme ? "#101B2D" : "#FFFFFF",
            borderTopColor: isDarkTheme ? "#263449" : "#E2E8F0",
          },
        ]}
      >
        {/* HOME */}

        <TouchableOpacity
          onPress={() => setActiveNav("home")}
          activeOpacity={0.8}
          style={localStyles.navItem}
        >
          <View
            style={[
              localStyles.navIconContainer,
              {
                backgroundColor:
                  activeNav === "home"
                    ? isDarkTheme
                      ? "#263449"
                      : "#EFF6FF"
                    : "transparent",
              },
            ]}
          >
            <Ionicons
              name={activeNav === "home" ? "home" : "home-outline"}
              size={24}
              color={
                activeNav === "home"
                  ? isDarkTheme
                    ? "#FACC15"
                    : "#1E3A8A"
                  : colors.textSecondary
              }
            />
          </View>

          <Text
            style={[
              localStyles.navLabel,
              {
                color:
                  activeNav === "home"
                    ? isDarkTheme
                      ? "#FACC15"
                      : "#1E3A8A"
                    : colors.textSecondary,
              },
            ]}
          >
            Home
          </Text>
        </TouchableOpacity>

        {/* SOS */}

        <TouchableOpacity
          onPress={() => {
            setActiveNav("sos");
            onEmergencySOS();
          }}
          activeOpacity={0.85}
          style={localStyles.sosNavWrapper}
        >
          <View style={localStyles.sosNavButton}>
            <Ionicons name="alert-circle" size={42} color="#FFFFFF" />
          </View>

          <Text style={localStyles.sosNavLabel}>SOS</Text>
        </TouchableOpacity>

        {/* ACCOUNT */}

        <TouchableOpacity
          onPress={() => {
            if (!personnel) {
              Alert.alert(
                "Account Unavailable",
                "Unable to load account information. Please try again later.",
              );
              return;
            }

            setActiveNav("account");
          }}
          activeOpacity={0.8}
          style={localStyles.navItem}
        >
          <View
            style={[
              localStyles.navIconContainer,
              {
                backgroundColor:
                  activeNav === "account"
                    ? isDarkTheme
                      ? "#263449"
                      : "#EFF6FF"
                    : "transparent",
              },
            ]}
          >
            <Ionicons
              name={activeNav === "account" ? "person" : "person-outline"}
              size={24}
              color={
                activeNav === "account"
                  ? isDarkTheme
                    ? "#FACC15"
                    : "#1E3A8A"
                  : colors.textSecondary
              }
            />
          </View>

          <Text
            style={[
              localStyles.navLabel,
              {
                color:
                  activeNav === "account"
                    ? isDarkTheme
                      ? "#FACC15"
                      : "#1E3A8A"
                    : colors.textSecondary,
              },
            ]}
          >
            Account
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

/* ========================================================================= */
/* STYLES                                                                    */
/* ========================================================================= */

const localStyles = StyleSheet.create({
  root: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    zIndex: 1,
  },

  mainContent: {
    width: "100%",
  },

  /* --------------------------------------------------------------------- */
  /* PROFILE                                                               */
  /* --------------------------------------------------------------------- */

  profileCard: {
    width: "100%",
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },

  profileTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  profilePhoto: {
    width: 68,
    height: 68,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },

  profileImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },

  profileInfo: {
    flex: 1,
    marginLeft: 12,
  },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginBottom: 4,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 5,
  },

  statusPillText: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  profileName: {
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 24,
  },

  profileMeta: {
    fontSize: 17,
    fontWeight: "600",
    marginTop: 2,
  },

  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },

  profileDivider: {
    height: 1,
    marginVertical: 12,
  },

  profileDetails: {
    flexDirection: "row",
    gap: 12,
  },

  profileDetailItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  detailLabel: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.7,
    marginBottom: 1,
  },

  detailValue: {
    fontSize: 17,
    fontWeight: "700",
  },

  /* --------------------------------------------------------------------- */
  /* SHARED CARDS                                                          */
  /* --------------------------------------------------------------------- */

  trackerCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 17,
    marginBottom: 14,

    overflow: "visible",

    zIndex: 100,
    elevation: 10,
  },

  dutyDropdownWrapper: {
    position: "relative",

    zIndex: 1000,
    elevation: 1000,
  },

  syncCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 17,
    marginBottom: 14,
  },

  scheduleCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 17,
    marginBottom: 20,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },

  sectionIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 11,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
  },

  sectionSubtitle: {
    fontSize: 17,
    lineHeight: 17,
    marginTop: 2,
  },

  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },

  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },

  liveText: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.6,
  },

  /* --------------------------------------------------------------------- */
  /* TRACKER                                                               */
  /* --------------------------------------------------------------------- */

  trackerNotice: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    padding: 11,
    marginBottom: 17,
  },

  trackerNoticeText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 16,
    marginLeft: 8,
  },

  inputLabel: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 7,
  },

  dutySelector: {
    minHeight: 62,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 12,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    zIndex: 1001,
    elevation: 1001,
  },

  dutySelectorLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  dutyIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },

  dutySmallText: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 2,
  },

  dutyValue: {
    fontSize: 16,
    fontWeight: "800",
  },

  /* --------------------------------------------------------------------- */
  /* DUTY DROPDOWN                                                         */
  /* --------------------------------------------------------------------- */

  dropdownMenu: {
    position: "absolute",

    top: 66,
    left: 0,
    right: 0,

    height: 280,

    borderRadius: 14,
    borderWidth: 1,

    zIndex: 9999,
    elevation: 9999,

    shadowOffset: {
      width: 0,
      height: 5,
    },

    shadowOpacity: 0.18,
    shadowRadius: 12,
  },

  dropdownScroll: {
    flex: 1,
  },

  dropdownScrollContent: {
    paddingVertical: 4,
  },

  dropdownItem: {
    minHeight: 50,
    paddingHorizontal: 14,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  dropdownItemText: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
  },

  /* --------------------------------------------------------------------- */
  /* PATROL BUTTON                                                         */
  /* --------------------------------------------------------------------- */

  patrolButton: {
    minHeight: 70,
    borderRadius: 16,

    // Reduced from 16 to improve spacing
    // between duty selector and button.
    marginTop: 12,

    paddingHorizontal: 18,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  patrolButtonIcon: {
    marginRight: 11,
  },

  patrolButtonTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0.6,
  },

  patrolButtonSubtitle: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 2,
  },

  /* --------------------------------------------------------------------- */
  /* SYNC                                                                  */
  /* --------------------------------------------------------------------- */

  syncStatus: {
    minHeight: 82,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 11,
  },

  syncCount: {
    fontSize: 27,
    fontWeight: "900",
    lineHeight: 29,
  },

  syncCountLabel: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 1,
  },

  syncStatusRight: {
    alignItems: "flex-end",
  },

  syncStatusText: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.6,
    marginTop: 4,
  },

  syncButton: {
    height: 49,
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },

  syncButtonText: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.4,
    marginLeft: 7,
  },

  /* --------------------------------------------------------------------- */
  /* SCHEDULE                                                              */
  /* --------------------------------------------------------------------- */

  scheduleCount: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },

  scheduleItem: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 13,
    marginBottom: 11,
  },

  scheduleItemHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  scheduleNumber: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },

  scheduleDuty: {
    fontSize: 15,
    fontWeight: "900",
  },

  scheduleSectorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },

  scheduleSector: {
    fontSize: 16,
    marginLeft: 3,
    flexShrink: 1,
  },

  scheduleInfoGrid: {
    flexDirection: "row",
    marginTop: 13,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    gap: 12,
  },

  scheduleInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  scheduleInfoLabel: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.7,
  },

  scheduleInfoValue: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 2,
  },

  assignedHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  assignedHeaderText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.7,
    marginLeft: 6,
  },

  personnelCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 7,
  },

  personnelRow: {
    minHeight: 74,
    borderRadius: 12,
    borderWidth: 1,
    padding: 9,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 7,
  },

  personnelAvatar: {
    width: 38,
    height: 38,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },

  personnelName: {
    fontSize: 13,
    fontWeight: "800",
  },

  personnelActions: {
    flexDirection: "row",
    gap: 6,
    marginTop: 7,
  },

  smallContactButton: {
    minHeight: 28,
    maxWidth: "49%",
    borderRadius: 8,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
  },

  smallContactText: {
    fontSize: 9,
    fontWeight: "600",
    marginLeft: 5,
    flexShrink: 1,
  },

  emptyPersonnel: {
    minHeight: 80,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 9,
  },

  emptySchedule: {
    minHeight: 190,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  emptyScheduleIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 11,
  },

  emptyScheduleTitle: {
    fontSize: 16,
    fontWeight: "900",
  },

  emptyScheduleText: {
    fontSize: 17,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 5,
    maxWidth: 280,
  },

  /* --------------------------------------------------------------------- */
  /* SOS                                                                   */
  /* --------------------------------------------------------------------- */

  sosContainer: {
    width: "100%",
    paddingBottom: 20,
  },

  sosCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },

  sosHeader: {
    alignItems: "center",
    marginBottom: 20,
  },

  sosIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },

  sosTitle: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.7,
  },

  sosSubtitle: {
    fontSize: 17,
    marginTop: 4,
  },

  sosWarning: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 13,
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },

  sosWarningText: {
    flex: 1,
    fontSize: 17,
    lineHeight: 18,
    marginLeft: 9,
  },

  sosStatus: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },

  sosStatusIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 11,
  },

  sosStatusTitle: {
    fontSize: 17,
    fontWeight: "900",
  },

  sosStatusText: {
    fontSize: 16,
    marginTop: 3,
  },

  sosContacts: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 13,
  },

  sosContactRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },

  sosContactText: {
    fontSize: 17,
    marginLeft: 8,
  },

  returnButton: {
    height: 52,
    borderRadius: 13,
    backgroundColor: "#16A34A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },

  returnButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.5,
    marginLeft: 7,
  },

  /* --------------------------------------------------------------------- */
  /* BOTTOM NAV                                                           */
  /* --------------------------------------------------------------------- */

  bottomNav: {
    position: "absolute",

    left: 0,
    right: 0,
    bottom: 0,

    height: 76,

    borderTopWidth: 1,

    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",

    paddingHorizontal: 28,

    elevation: 20,

    shadowOffset: {
      width: 0,
      height: -3,
    },

    shadowOpacity: 0.12,
    shadowRadius: 8,

    zIndex: 9999,
  },

  navItem: {
    width: 80,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
  },

  navIconContainer: {
    width: 42,
    height: 34,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  navLabel: {
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2,
  },

  sosNavWrapper: {
    width: 90,
    height: 90,
    alignItems: "center",
    justifyContent: "flex-start",
    marginTop: -35,
  },

  sosNavButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 5,
    borderColor: "#FFFFFF",
    elevation: 8,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 7,
  },

  sosNavLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#EF4444",
    marginTop: 2,
  },

  /* --------------------------------------------------------------------- */
  /* CONTACT                                                               */
  /* --------------------------------------------------------------------- */

  contactButton: {
    minHeight: 52,
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  contactLabel: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.6,
  },

  contactValue: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 2,
  },
});
