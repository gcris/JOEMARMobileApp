import { Alert, Text, View, TouchableOpacity } from "react-native";

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
  return (
    <View
      style={{
        width: "100%",
        backgroundColor: isDarkTheme ? "#1E293B" : "#F1F5F9",
        borderWidth: 1,
        borderColor: "#EF4444",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <Text
        style={{
          color: "#EF4444",
          fontWeight: "bold",
          fontSize: 20,
          textAlign: "center",
          marginBottom: 8,
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
        INPPO Patrol Tracker requires active security clearances. Please grant
        these permissions below.
      </Text>

      {/* Foreground GPS */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 6,
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
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 6,
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

      {/* Background Location */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 6,
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
            2. Background Location Access {backgroundGranted ? "✅" : "❌"}
          </Text>
        </View>
        {foregroundGranted && !backgroundGranted && (
          <TouchableOpacity
            onPress={onRequestBackground}
            style={{
              backgroundColor: "#EF4444",
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 6,
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

      {/* System GPS */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 6,
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
              // 1. Trigger the system prompt to turn on GPS
              await onEnableGpsInline();

              // 2. Introduce a brief delay (e.g., 500ms) to let the hardware state update
              await new Promise((resolve) => setTimeout(resolve, 1000));

              // 3. Re-check your actual state variable (e.g., isGpsEnabled)
              //   if (!flag) {
              //     Alert.alert(
              //       "Permission Fallback",
              //       "Could not auto-enable device location. Please configure it via the device system settings.",
              //       [
              //         { text: "Open Settings", onPress: onOpenSettings },
              //         { text: "Cancel", style: "cancel" },
              //       ],
              //     );
              //   }
            }}
            disabled={gpsLoading}
            style={{
              backgroundColor: "#EF4444",
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 6,
            }}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontWeight: "bold",
                fontSize: 15,
              }}
            >
              {gpsLoading ? "Initializing..." : "ENABLE"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};
