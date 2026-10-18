import React from "react";
import { ActivityIndicator, Text, View, TouchableOpacity } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

interface PermissionViewProps {
  foregroundGranted: boolean | null;
  backgroundGranted: boolean | null;
  isGpsEnabled: boolean;
  isDarkTheme: boolean;
  onRequestForeground: () => Promise<boolean>;
  onRequestBackground: () => Promise<boolean>;
  onEnableGpsInline: () => Promise<boolean>;
  onOpenSettings: () => void;
  gpsLoading: boolean;
}

export const PermissionView = ({
  foregroundGranted,
  backgroundGranted,
  isGpsEnabled,
  isDarkTheme,
  onRequestForeground,
  onRequestBackground,
  onEnableGpsInline,
  onOpenSettings,
  gpsLoading,
}: PermissionViewProps) => {
  const completedCount = [
    foregroundGranted,
    backgroundGranted,
    isGpsEnabled,
  ].filter(Boolean).length;

  const allReady = completedCount === 3;

  const colors = {
    background: isDarkTheme ? "#111C2E" : "#F8FAFC",
    card: isDarkTheme ? "#142035" : "#FFFFFF",
    cardSecondary: isDarkTheme ? "#0F192A" : "#F8FAFC",

    text: isDarkTheme ? "#F8FAFC" : "#0F172A",
    muted: isDarkTheme ? "#94A3B8" : "#64748B",

    border: isDarkTheme ? "#24344D" : "#E2E8F0",

    primary: isDarkTheme ? "#FACC15" : "#1E3A8A",
    primaryText: isDarkTheme ? "#0B121F" : "#FFFFFF",

    success: "#10B981",
    successBg: isDarkTheme ? "rgba(16,185,129,0.12)" : "#ECFDF5",

    warning: "#F59E0B",
    warningBg: isDarkTheme ? "rgba(245,158,11,0.12)" : "#FFFBEB",

    danger: "#EF4444",
    dangerBg: isDarkTheme ? "rgba(239,68,68,0.10)" : "#FEF2F2",
  };

  const PermissionStatusIcon = ({ enabled }: { enabled: boolean | null }) => {
    if (enabled) {
      return (
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: colors.successBg,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Ionicons name="checkmark" size={22} color={colors.success} />
        </View>
      );
    }

    return (
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: colors.warningBg,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Ionicons name="alert-outline" size={21} color={colors.warning} />
      </View>
    );
  };

  const EnableButton = ({
    onPress,
    loading = false,
  }: {
    onPress: () => void;
    loading?: boolean;
  }) => {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={loading}
        activeOpacity={0.75}
        style={{
          minWidth: 82,
          height: 38,
          paddingHorizontal: 14,
          borderRadius: 9,
          backgroundColor: colors.primary,
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "row",
        }}
      >
        {loading ? (
          <>
            <Text
              style={{
                color: colors.primaryText,
                fontSize: 16,
                fontWeight: "800",
                marginLeft: 6,
              }}
            >
              WAIT
            </Text>
          </>
        ) : (
          <>
            <Text
              style={{
                color: colors.primaryText,
                fontSize: 16,
                fontWeight: "800",
                letterSpacing: 0.5,
              }}
            >
              ENABLE
            </Text>
          </>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={{
        width: "100%",
        backgroundColor: colors.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: allReady ? colors.success : colors.border,
        marginBottom: 16,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 14,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flex: 1,
            }}
          >
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                backgroundColor: allReady ? colors.successBg : colors.warningBg,
                justifyContent: "center",
                alignItems: "center",
                marginRight: 11,
              }}
            >
              <Ionicons
                name={allReady ? "shield-checkmark" : "shield-outline"}
                size={23}
                color={allReady ? colors.success : colors.warning}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 20,
                  fontWeight: "800",
                  letterSpacing: 0.3,
                }}
              >
                System Readiness
              </Text>

              <Text
                style={{
                  color: colors.muted,
                  fontSize: 16,
                  marginTop: 2,
                }}
              >
                {allReady
                  ? "Your device is ready for patrol duty."
                  : "Complete the required device settings."}
              </Text>
            </View>
          </View>

          {/* Progress badge */}
          <View
            style={{
              backgroundColor: allReady ? colors.successBg : colors.warningBg,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 20,
              marginLeft: 8,
            }}
          >
            <Text
              style={{
                color: allReady ? colors.success : colors.warning,
                fontSize: 16,
                fontWeight: "800",
              }}
            >
              {completedCount}/3
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        <View
          style={{
            height: 5,
            backgroundColor: isDarkTheme ? "#24344D" : "#E2E8F0",
            borderRadius: 3,
            marginTop: 14,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${(completedCount / 3) * 100}%`,
              height: "100%",
              backgroundColor: allReady ? colors.success : colors.primary,
              borderRadius: 3,
            }}
          />
        </View>
      </View>

      {/* Permission list */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingHorizontal: 12,
          paddingVertical: 6,
        }}
      >
        {/* Foreground Location */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 11,
          }}
        >
          <PermissionStatusIcon enabled={foregroundGranted} />

          <View
            style={{
              flex: 1,
              marginLeft: 11,
              marginRight: 8,
            }}
          >
            <Text
              style={{
                color: colors.text,
                fontSize: 18,
                fontWeight: "700",
              }}
            >
              Location Access
            </Text>

            <Text
              style={{
                color: foregroundGranted ? colors.success : colors.muted,
                fontSize: 15,
                marginTop: 2,
              }}
            >
              {foregroundGranted
                ? "Permission granted"
                : "Required to track your patrol"}
            </Text>
          </View>

          {!foregroundGranted && (
            <EnableButton
              onPress={() => {
                void onRequestForeground();
              }}
            />
          )}
        </View>

        {/* Divider */}
        <View
          style={{
            height: 1,
            backgroundColor: colors.border,
            marginLeft: 49,
          }}
        />

        {/* Background Location */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 11,
          }}
        >
          <PermissionStatusIcon enabled={backgroundGranted} />

          <View
            style={{
              flex: 1,
              marginLeft: 11,
              marginRight: 8,
            }}
          >
            <Text
              style={{
                color: colors.text,
                fontSize: 18,
                fontWeight: "700",
              }}
            >
              Background Location
            </Text>

            <Text
              style={{
                color: backgroundGranted ? colors.success : colors.muted,
                fontSize: 15,
                marginTop: 2,
              }}
            >
              {backgroundGranted
                ? "Background tracking enabled"
                : foregroundGranted
                  ? "Required for continuous patrol tracking"
                  : "Complete Location Access first"}
            </Text>
          </View>

          {foregroundGranted && !backgroundGranted && (
            <EnableButton
              onPress={() => {
                void onRequestBackground();
              }}
            />
          )}
        </View>

        {/* Divider */}
        <View
          style={{
            height: 1,
            backgroundColor: colors.border,
            marginLeft: 49,
          }}
        />

        {/* GPS */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 11,
          }}
        >
          <PermissionStatusIcon enabled={isGpsEnabled} />

          <View
            style={{
              flex: 1,
              marginLeft: 11,
              marginRight: 8,
            }}
          >
            <Text
              style={{
                color: colors.text,
                fontSize: 18,
                fontWeight: "700",
              }}
            >
              Device Location / GPS
            </Text>

            <Text
              style={{
                color: isGpsEnabled ? colors.success : colors.muted,
                fontSize: 15,
                marginTop: 2,
              }}
            >
              {isGpsEnabled
                ? "GPS is currently active"
                : "Turn on GPS to determine your position"}
            </Text>
          </View>

          {!isGpsEnabled && (
            <EnableButton
              loading={gpsLoading}
              onPress={() => {
                void onEnableGpsInline();
              }}
            />
          )}
        </View>
      </View>

      {/* Bottom information */}
      {!allReady && (
        <View
          style={{
            backgroundColor: colors.cardSecondary,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingHorizontal: 16,
            paddingVertical: 11,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
            }}
          >
            <Ionicons
              name="information-circle-outline"
              size={20}
              color={colors.muted}
              style={{ marginTop: 1, marginRight: 7 }}
            />

            <Text
              style={{
                flex: 1,
                color: colors.muted,
                fontSize: 15,
                lineHeight: 16,
              }}
            >
              These settings are required for accurate patrol location recording
              and continuous GPS tracking.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};
