import "react-native-gesture-handler";
import React, { useState, useEffect } from "react";
import {
  StatusBar,
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  Modal,
  AppState,
  Alert,
} from "react-native";
import { NavigationContainer, RouteProp } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { StackNavigationProp } from "@react-navigation/stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { usePatrolState } from "./src/hooks/usePatrolState";
import { getStyles, getThemeColors } from "./src/theme/styles";
import { LoginView } from "./src/components/LoginView";
import { RegisterView } from "./src/components/RegisterView";
import { DashboardView } from "./src/components/DashboardView";
import { TopCommandHeader } from "./src/components/TopCommandHeader";
import { AnimatedSplashScreen } from "./src/components/AnimatedSplashScreen";
import { AccountScreen } from "./src/components/AccountScreen";
import SosAlertModal from "./src/components/SosAlertModal";
// import { syncPendingPatrolLogs } from "./src/services/database";
import { ForgotPasswordScreen } from "./src/components/ForgotPasswordScreen";

type RootStackParamList = {
  Main: undefined;
  Account: {
    personnelId: string;
    isDarkTheme: boolean;
  };
};

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [viewMode, setViewMode] = useState<
    "login" | "register" | "forgotpassword"
  >("login");
  const [sosAlertData, setSosAlertData] = useState<{
    senderName: string;
    latitude: number;
    longitude: number;
    phone_number: string;
  } | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [restoreAttempted, setRestoreAttempted] = useState(false);

  const colors = getThemeColors(isDarkTheme);

  const patrolState = usePatrolState();

  // Restore patrol state on app startup
  React.useEffect(() => {
    const restorePatrolState = async () => {
      if (restoreAttempted) return; // Prevent multiple restore attempts

      setRestoreAttempted(true);

      try {
        // Import BackgroundTracker here to avoid circular dependency issues
        const BackgroundTracker =
          await import("./src/services/BackgroundTracker");

        // Check if patrol should be active (survives process recreation)
        const patrolActive =
          (await AsyncStorage.getItem(BackgroundTracker.PATROL_STATE_KEY)) ===
          "true";

        console.log("[App] Patrol active from storage:", patrolActive);

        if (patrolActive) {
          // Restore UI state to match actual background service status
          const personnelId = await AsyncStorage.getItem(
            "@pnp_active_personnel_id",
          );
          const startTime = await AsyncStorage.getItem(
            BackgroundTracker.PATROL_START_TIME_KEY,
          );
          const lastLocationJson = await AsyncStorage.getItem(
            BackgroundTracker.LAST_KNOWN_LOCATION_KEY,
          );

          // Update patrol state if we have personnel ID
          if (personnelId) {
            console.log("[App] Restoring patrol for personnel:", personnelId);
            console.log("[App] Patrol started at:", startTime);
            console.log("[App] Last known location:", lastLocationJson);

            // Verify location tracking is still active
            const started = await Location.hasStartedLocationUpdatesAsync(
              BackgroundTracker.LOCATION_TASK_NAME,
            );

            if (!started) {
              // Restart tracking if it was interrupted by process kill
              console.log(
                "[App] Restarting location tracking after process restore",
              );
              await BackgroundTracker.startBackgroundUpdates();
            } else {
              console.log("[App] Location tracking already active");
            }
          }
        }
      } catch (error) {
        console.error("[App] Failed to restore patrol state:", error);
      } finally {
        // CRITICAL: Always finish initialization to hide splash screen
        setIsInitializing(false);
      }
    };

    // Start restoration after a brief delay to let other initializations complete
    const timer = setTimeout(restorePatrolState, 500);

    return () => clearTimeout(timer);
  }, [restoreAttempted]); // Only run once

  const {
    personnel,
    isGpsEnabled,
    foregroundGranted,
    backgroundGranted,
    gpsLoading,
    login,
    logout,
    openSystemSettings,
    requestForegroundPermission,
    requestBackgroundPermission,
    enableGpsInline,
    registerUser,
  } = patrolState;

  const handleToggleTheme = () => {
    setIsDarkTheme(!isDarkTheme);
  };

  const handleForgotPassword = () => {
    setViewMode("forgotpassword");
    // Alert.alert(
    //   "Feature coming soon",
    //   "Password reset functionality will be available in a future update.",
    // );
  };

  if (showSplash && isInitializing) {
    return (
      <AnimatedSplashScreen
        onFinish={() => setShowSplash(false)}
        isDarkTheme={isDarkTheme}
      />
    );
  }

  if (!personnel) {
    return (
      <NavigationContainer>
        <StatusBar
          barStyle={isDarkTheme ? "light-content" : "dark-content"}
          backgroundColor={colors.bgDark}
        />
        {viewMode === "register" && (
          <RegisterView
            onRegister={registerUser}
            onBackToLogin={() => setViewMode("login")}
            isDarkTheme={isDarkTheme}
          />
        )}
        {viewMode === "forgotpassword" && (
          <ForgotPasswordScreen
            isDarkTheme={isDarkTheme}
            onToggleTheme={handleToggleTheme}
            onBack={() => setViewMode("login")}
          />
        )}
        {viewMode === "login" && (
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
            onForgotPassword={handleForgotPassword}
          />
        )}
        {/* Show SOS alert modal even when not logged in */}
        <SosAlertModal
          sosAlertData={sosAlertData}
          onClose={() => {
            setSosAlertData(null);
            AsyncStorage.removeItem("@pnp_sos_alert_data").catch(() => {});
          }}
        />
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar
        barStyle={isDarkTheme ? "light-content" : "dark-content"}
        backgroundColor={colors.bgDark}
      />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main">
          {(props) => (
            <MainApp
              {...props}
              isDarkTheme={isDarkTheme}
              handleToggleTheme={handleToggleTheme}
              logout={logout}
              patrolState={patrolState} // <-- PASS THE ENTIRE STATE OBJECT HERE
              sosAlertData={sosAlertData}
              onSosAlertClose={() => {
                setSosAlertData(null);
                AsyncStorage.removeItem("@pnp_sos_alert_data").catch(() => {});
              }}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Account" component={AccountScreenWrapper} />
      </Stack.Navigator>
      {/* SOS Alert Modal */}
      <SosAlertModal
        sosAlertData={sosAlertData}
        onClose={() => {
          setSosAlertData(null);
          AsyncStorage.removeItem("@pnp_sos_alert_data").catch(() => {});
        }}
      />
    </NavigationContainer>
  );
}

// UPDATE MainApp TO ACCEPT patrolState AS A PROP
function MainApp({
  isDarkTheme,
  handleToggleTheme,
  logout,
  patrolState, // <-- Receive it here
  sosAlertData, // <-- Receive SOS alert data
  onSosAlertClose, // <-- Receive callback to close SOS alert
}: {
  isDarkTheme: boolean;
  handleToggleTheme: () => void;
  logout: () => void;
  patrolState: ReturnType<typeof usePatrolState>; // <-- Type it using ReturnType
  sosAlertData: {
    senderName: string;
    latitude: number;
    longitude: number;
    phone_number: string;
  } | null; // <-- SOS alert data
  onSosAlertClose: () => void; // <-- Callback to close SOS alert
}) {
  // DESTUCTURE FROM THE PROP, DO NOT CALL usePatrolState() AGAIN
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
    setActiveDutyType,
  } = patrolState;

  const styles = getStyles(isDarkTheme);
  const colors = getThemeColors(isDarkTheme);

  return (
    <>
      <TopCommandHeader
        onLogout={logout}
        isDarkTheme={isDarkTheme}
        onToggleTheme={handleToggleTheme}
      />

      {isShiftActive && (
        <View style={styles.patrolNotificationBar}>
          <View style={styles.patrolNotificationInfo}>
            <Text style={styles.patrolNotificationTitle}>
              ACTIVE SHIFT PATROL ENGAGED
            </Text>
            <Text style={styles.patrolNotificationSub}>
              Background GPS active. Coordinates log to local storage even when
              closed.
            </Text>
          </View>
          {/* <TouchableOpacity
            style={styles.patrolNotificationButtonSos}
            onPress={triggerEmergencySOS}
            activeOpacity={0.7}
          >
            <Text style={styles.patrolNotificationButtonSosText}>
              DISTRESS SIGNAL
            </Text>
          </TouchableOpacity> */}
        </View>
      )}

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
        setActiveDutyType={setActiveDutyType}
      />
    </>
  );
}

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
        navigation.goBack();
      }}
    />
  );
}
