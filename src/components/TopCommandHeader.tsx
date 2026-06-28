import React from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { getStyles } from "../theme/styles";
import { isSupabaseConfigured } from "../services/supabase";
import Ionicons from "@expo/vector-icons/Ionicons";

interface TopCommandHeaderProps {
  onLogout: () => void;
  isDarkTheme: boolean;
  onToggleTheme: () => void;
}

export const TopCommandHeader = ({
  onLogout,
  isDarkTheme,
  onToggleTheme,
}: TopCommandHeaderProps) => {
  const styles = getStyles(isDarkTheme);
  const isCloud = isSupabaseConfigured();

  const handleLogoutPress = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Confirm", style: "destructive", onPress: onLogout },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <View style={styles.navbar}>
      <View style={styles.navLeading}>
        {/* Connection status indicator dot */}
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: isCloud ? "#10B981" : "#EAB308",
            marginRight: 10,
          }}
        />
        <View>
          <Text style={[styles.navTitle, { fontSize: 18, letterSpacing: 0.5 }]}>
            Project J.O.E.M.A.R v1.0
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {/* Raw high-contrast theme selection toggle button */}
        <TouchableOpacity
          onPress={onToggleTheme}
          style={{ paddingHorizontal: 12, paddingVertical: 6 }}
        >
          {isDarkTheme ? (
            <Ionicons name="sunny" size={25} color="white" />
          ) : (
            <Ionicons name="moon" size={25} color="black" />
          )}
        </TouchableOpacity>

        <View style={{ width: 8 }} />

        <TouchableOpacity
          style={styles.tabExit}
          onPress={handleLogoutPress}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out" size={20} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
};
