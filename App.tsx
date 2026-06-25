import React, { useState, useEffect } from "react";
import {
  StatusBar,
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
} from "react-native";
import * as Notifications from "expo-notifications";
import { NavigationContainer, RouteProp } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { StackNavigationProp } from "@react-navigation/stack";

import { usePatrolState } from "./src/hooks/usePatrolState";
import { getStyles, getThemeColors } from "./src/theme/styles";
import { LoginView } from "./src/components/LoginView";
import { RegisterView } from "./src/components/RegisterView";
import { DashboardView } from "./src/components/DashboardView";
import { TopCommandHeader } from "./src/components/TopCommandHeader";
import { AnimatedSplashScreen } from "./src/components/AnimatedSplashScreen";
import { AccountScreen } from "./src/components/AccountScreen";

type RootStackParamList = {
  Main: undefined;
  Account: {
    personnelId: string;
    isDarkTheme: boolean;
  };
};

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  // Police Dark Tactical Theme is active by default to replicate native Android exactly
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [viewMode, setViewMode] = useState<"login" | "register">("login");

  const styles = getStyles(isDarkTheme);
  const colors = getThemeColors(isDarkTheme);

  const {
    personnel,
    schedule,
    logs,
    unsyncedCount,
    isShiftActive,
    isGpsEnabled,
    foregroundGranted,
    backgroundGranted,
    gpsLoading,
    isSyncing,
    autoSync,
    login,
    logout,
    toggleShift,
    syncLogsWithRemote,
    flushSyncedCache,
    openSystemSettings,
    triggerEmergencySOS,
    toggleAutoSync,
    is2FAEnabled,
    enable2FA,
    disable2FA,
    requestForegroundPermission,
    requestBackgroundPermission,
    enableGpsInline,
    registerUser,
  } = usePatrolState();

  // Listen for the system-level persistent notification's SOS button clicks
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        if (response.actionIdentifier === "sos-button") {
          // Trigger critical SOS sequence immediately
          triggerEmergencySOS();
        }
      },
    );
    return () => {
      subscription.remove();
    };
  }, [triggerEmergencySOS]);

  const handleToggleTheme = () => {
    setIsDarkTheme(!isDarkTheme);
  };

  if (showSplash) {
    return (
      <AnimatedSplashScreen
        onFinish={() => setShowSplash(false)}
        isDarkTheme={isDarkTheme}
      />
    );
  }

  // If there's no authenticated officer, render target credentials login or register view
  if (!personnel) {
    return (
      <NavigationContainer>
        <StatusBar
          barStyle={isDarkTheme ? "light-content" : "dark-content"}
          backgroundColor={colors.bgDark}
        />
        {viewMode === "register" ? (
          <RegisterView
            onRegister={registerUser}
            onBackToLogin={() => setViewMode("login")}
            isDarkTheme={isDarkTheme}
          />
        ) : (
          <LoginView
            isGpsEnabled={isGpsEnabled}
            foregroundGranted={foregroundGranted}
            backgroundGranted={backgroundGranted}
            gpsLoading={gpsLoading}
            onLogin={login}
            onOpenSettings={openSystemSettings}
            isDarkTheme={isDarkTheme}
            onToggleTheme={handleToggleTheme}
            onRequestForeground={requestForegroundPermission}
            onRequestBackground={requestBackgroundPermission}
            onEnableGpsInline={enableGpsInline}
            onGoToRegister={() => setViewMode("register")}
          />
        )}
      </NavigationContainer>
    );
  }

  // Once credentials verification is complete, render active tactical screen layout
  return (
    <NavigationContainer>
      <StatusBar
        barStyle={isDarkTheme ? "light-content" : "dark-content"}
        backgroundColor={colors.bgDark}
      />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="Main"
          component={() => (
            <MainApp
              isDarkTheme={isDarkTheme}
              handleToggleTheme={handleToggleTheme}
              logout={logout}
            />
          )}
        />
        <Stack.Screen name="Account" component={AccountScreenWrapper} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Main app component that contains the dashboard and tab navigation
function MainApp({
  isDarkTheme,
  handleToggleTheme,
  logout,
}: {
  isDarkTheme: boolean;
  handleToggleTheme: () => void;
  logout: () => void;
}) {
  const {
    personnel,
    schedule,
    isShiftActive,
    isGpsEnabled,
    foregroundGranted,
    backgroundGranted,
    unsyncedCount,
    logs,
    isSyncing,
    toggleShift,
    syncLogsWithRemote,
    flushSyncedCache,
    openSystemSettings,
    triggerEmergencySOS,
    autoSync,
    toggleAutoSync,
    is2FAEnabled,
    enable2FA,
    disable2FA,
    requestForegroundPermission,
    requestBackgroundPermission,
    enableGpsInline,
  } = usePatrolState();

  const styles = getStyles(isDarkTheme);
  const colors = getThemeColors(isDarkTheme);

  return (
    <>
      {/* Replicates TopCommandHeader inside native Compose */}
      <TopCommandHeader
        onLogout={logout}
        isDarkTheme={isDarkTheme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Persistent Red alert header active during shifts */}
      {isShiftActive && (
        <View style={styles.patrolNotificationBar}>
          <View style={styles.patrolNotificationInfo}>
            <Text style={styles.patrolNotificationTitle}>
              🚨 ACTIVE SHIFT PATROL ENGAGED
            </Text>
            <Text style={styles.patrolNotificationSub}>
              Background GPS active. Coordinates log to SQLite even when closed.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.patrolNotificationButtonSos}
            onPress={triggerEmergencySOS}
            activeOpacity={0.7}
          >
            <Text style={styles.patrolNotificationButtonSosText}>SOS</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Single-view dashboard wrapper that embeds tactical features, schedules, and security tools */}
      <DashboardView
        personnel={personnel}
        schedule={schedule}
        isShiftActive={isShiftActive}
        isGpsEnabled={isGpsEnabled}
        foregroundGranted={foregroundGranted}
        backgroundGranted={backgroundGranted}
        unsyncedCount={unsyncedCount}
        logs={logs}
        isSyncing={isSyncing}
        onToggleShift={toggleShift}
        onSync={syncLogsWithRemote}
        onClearCache={flushSyncedCache}
        onOpenSettings={openSystemSettings}
        onEmergencySOS={triggerEmergencySOS}
        autoSync={autoSync}
        onToggleAutoSync={toggleAutoSync}
        is2FAEnabled={is2FAEnabled}
        onEnable2FA={enable2FA}
        onDisable2FA={disable2FA}
        isDarkTheme={isDarkTheme}
        onRequestForeground={requestForegroundPermission}
        onRequestBackground={requestBackgroundPermission}
        onEnableGpsInline={enableGpsInline}
      />
    </>
  );
}

// Wrapper for AccountScreen to pass the required props
function AccountScreenWrapper({
  navigation,
  route,
}: {
  navigation: StackNavigationProp<RootStackParamList>;
  route: RouteProp<RootStackParamList, "Account">;
}) {
  const { personnelId, isDarkTheme } = route.params || {};

  return (
    <AccountScreen
      personnelId={personnelId}
      isDarkTheme={isDarkTheme}
      onClose={() => {
        // Navigate back to main app screen
        navigation.goBack();
      }}
    />
  );
}
