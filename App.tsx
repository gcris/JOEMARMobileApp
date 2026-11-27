import "react-native-gesture-handler";
import React, { useState, useEffect, useCallback } from "react";
import { StatusBar, View, Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer, RouteProp } from "@react-navigation/native";
import {
  createStackNavigator,
  StackNavigationProp,
} from "@react-navigation/stack";

import { usePatrolState } from "./src/hooks/usePatrolState";
import { getStyles, getThemeColors } from "./src/theme/styles";

import { LoginView } from "./src/components/LoginView";
import { RegisterView } from "./src/components/RegisterView";
import { RegisterWebview } from "./src/components/RegisterWebview";
import { DashboardView } from "./src/components/DashboardView";
import { TopCommandHeader } from "./src/components/TopCommandHeader";
import { AccountScreen } from "./src/components/AccountScreen";
import SosAlertModal from "./src/components/SosAlertModal";
import { ForgotPasswordScreen } from "./src/components/ForgotPasswordScreen";
import { AnimatedSplashScreen } from "./src/components/AnimatedSplashScreen";

// ============================================================
// TYPES
// ============================================================

type RootStackParamList = {
  Main: undefined;
  Account: {
    personnelId: string;
    isDarkTheme: boolean;
  };
};

const Stack = createStackNavigator<RootStackParamList>();

// ============================================================
// STORAGE
// ============================================================

const THEME_STORAGE_KEY = "@pnp_geo_tracker_theme";

// ============================================================
// APP
// ============================================================

export default function App() {
  // ----------------------------------------------------------
  // THEME
  // ----------------------------------------------------------

  // Default theme while AsyncStorage is being checked.
  // This value will be replaced by the saved preference.
  const [isDarkTheme, setIsDarkTheme] = useState(true);

  const [themeLoaded, setThemeLoaded] = useState(false);

  // ----------------------------------------------------------
  // SPLASH / INITIALIZATION
  // ----------------------------------------------------------

  const [showSplash, setShowSplash] = useState(true);

  const [viewMode, setViewMode] = useState<
    "login" | "register" | "registerwebview" | "forgotpassword"
  >("login");

  const [isInitializing, setIsInitializing] = useState(true);

  const [restoreAttempted, setRestoreAttempted] = useState(false);

  // ----------------------------------------------------------
  // SOS
  // ----------------------------------------------------------

  const [sosAlertData, setSosAlertData] = useState<{
    senderName: string;
    latitude: number;
    longitude: number;
    phone_number: string;
  } | null>(null);

  // ----------------------------------------------------------
  // PATROL STATE
  // ----------------------------------------------------------

  const patrolState = usePatrolState();

  const {
    personnel,
    isLoading,
    restoreSession,
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

  // ============================================================
  // LOAD SAVED THEME
  // ============================================================

  useEffect(() => {
    let mounted = true;

    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);

        if (!mounted) return;

        if (savedTheme === "dark") {
          setIsDarkTheme(true);
        } else if (savedTheme === "light") {
          setIsDarkTheme(false);
        } else {
          // No saved preference yet.
          // Keep the default dark theme.
          setIsDarkTheme(true);
        }
      } catch (error) {
        console.warn("Failed to load saved theme:", error);

        if (mounted) {
          // Safe fallback
          setIsDarkTheme(true);
        }
      } finally {
        if (mounted) {
          setThemeLoaded(true);
        }
      }
    };

    loadTheme();

    return () => {
      mounted = false;
    };
  }, []);

  // ============================================================
  // SAVE THEME
  // ============================================================

  useEffect(() => {
    // Do not save the initial default before the stored
    // preference has been loaded.
    if (!themeLoaded) {
      return;
    }

    const saveTheme = async () => {
      try {
        await AsyncStorage.setItem(
          THEME_STORAGE_KEY,
          isDarkTheme ? "dark" : "light",
        );
      } catch (error) {
        console.warn("Failed to save theme:", error);
      }
    };

    saveTheme();
  }, [isDarkTheme, themeLoaded]);

  // ============================================================
  // SESSION RESTORATION ON STARTUP
  // ============================================================
  // Runs once after theme loads. Waits for `isLoading` to settle so
  // `personnel` is populated before deciding whether to show LoginView.

  useEffect(() => {
    if (!themeLoaded) return;

    let mounted = true;

    const attempt = async () => {
      console.log("[App] Starting session restoration...");
      const result = await restoreSession();
      if (!mounted) return;
      console.log(`[App] restoreSession result: ${result}, isLoading:`, isLoading);
    };

    attempt();

    return () => {
      mounted = false;
    };
  }, [themeLoaded, restoreSession]);

  // Keep splash visible until session restoration finishes, preventing
  // a flash of LoginView before we know whether the user is logged in.

  useEffect(() => {
    if (themeLoaded && !isLoading) {
      setShowSplash(false);
    }
  }, [themeLoaded, isLoading]);

  // ============================================================
  // INITIALIZATION
  // ============================================================

  useEffect(() => {
    if (!themeLoaded) return;

    setIsInitializing(false);
    setRestoreAttempted(true);
  }, [themeLoaded]);

  // ============================================================
  // THEME TOGGLE
  // ============================================================

  const handleToggleTheme = useCallback(() => {
    setIsDarkTheme((previous) => !previous);
  }, []);

  // ============================================================
  // FORGOT PASSWORD
  // ============================================================

  const handleForgotPassword = useCallback(() => {
    setViewMode("forgotpassword");
  }, []);

  // ============================================================
  // THEME COLORS
  // ============================================================

  const colors = getThemeColors(isDarkTheme);

  // ============================================================
  // SPLASH SCREEN
  // ============================================================

  // Wait until the saved theme has been loaded before allowing
  // the main UI to render.
  //
  // This prevents:
  //
  // DARK -> LIGHT -> DARK
  //
  // flashing during startup.
  if (!themeLoaded || showSplash) {
    return (
      <AnimatedSplashScreen
        onFinish={() => setShowSplash(false)}
        isDarkTheme={isDarkTheme}
      />
    );
  }

  // ============================================================
  // LOGIN / REGISTER / FORGOT PASSWORD
  // ============================================================

  if (!personnel) {
    return (
      <NavigationContainer>
        <StatusBar
          barStyle={isDarkTheme ? "light-content" : "dark-content"}
          backgroundColor={colors.bgDark}
        />

        {/* ======================================================
            REGISTER
        ====================================================== */}

        {viewMode === "register" && (
          <RegisterView
            onRegister={registerUser}
            onBackToLogin={() => setViewMode("login")}
            isDarkTheme={isDarkTheme}
          />
        )}

        {/* ======================================================
            REGISTER WEBVIEW
        ====================================================== */}

        {viewMode === "registerwebview" && (
          <RegisterWebview
            isDarkTheme={isDarkTheme}
            onBackToLogin={() => setViewMode("login")}
          />
        )}

        {/* ======================================================
            FORGOT PASSWORD
        ====================================================== */}

        {viewMode === "forgotpassword" && (
          <ForgotPasswordScreen
            isDarkTheme={isDarkTheme}
            onToggleTheme={handleToggleTheme}
            onBack={() => setViewMode("login")}
          />
        )}

        {/* ======================================================
            LOGIN
        ====================================================== */}

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
            onGoToRegister={() => setViewMode("registerwebview")}
            onForgotPassword={handleForgotPassword}
          />
        )}

        {/* ======================================================
            SOS ALERT
        ====================================================== */}

        <SosAlertModal
          sosAlertData={sosAlertData}
          onClose={() => {
            setSosAlertData(null);
          }}
        />
      </NavigationContainer>
    );
  }

  // ============================================================
  // AUTHENTICATED APPLICATION
  // ============================================================

  return (
    <NavigationContainer>
      <StatusBar
        barStyle={isDarkTheme ? "light-content" : "dark-content"}
        backgroundColor={colors.bgDark}
      />

      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        {/* ====================================================
            MAIN
        ==================================================== */}

        <Stack.Screen name="Main">
          {(props) => (
            <MainApp
              {...props}
              isDarkTheme={isDarkTheme}
              handleToggleTheme={handleToggleTheme}
              logout={logout}
              patrolState={patrolState}
              sosAlertData={sosAlertData}
              onSosAlertClose={() => {
                setSosAlertData(null);
              }}
            />
          )}
        </Stack.Screen>

        {/* ====================================================
            ACCOUNT
        ==================================================== */}

        <Stack.Screen name="Account" component={AccountScreenWrapper} />
      </Stack.Navigator>

      {/* ======================================================
          GLOBAL SOS ALERT
      ====================================================== */}

      <SosAlertModal
        sosAlertData={sosAlertData}
        onClose={() => {
          setSosAlertData(null);
        }}
      />
    </NavigationContainer>
  );
}

// ============================================================
// MAIN APP
// ============================================================

function MainApp({
  isDarkTheme,
  handleToggleTheme,
  logout,
  patrolState,
  sosAlertData,
  onSosAlertClose,
}: {
  isDarkTheme: boolean;
  handleToggleTheme: () => void;
  logout: () => void;
  patrolState: ReturnType<typeof usePatrolState>;
  sosAlertData: {
    senderName: string;
    latitude: number;
    longitude: number;
    phone_number: string;
  } | null;
  onSosAlertClose: () => void;
}) {
  // ----------------------------------------------------------
  // PATROL STATE
  // ----------------------------------------------------------

  const {
    personnel,
    schedule,
    personnelLogs,
    patrolStatus,
    isGpsEnabled,
    foregroundGranted,
    backgroundGranted,
    unsyncedCount,
    isSyncing,
    isPatrolStarting,
    toggleShift,
    syncLogsWithRemote,
    openSystemSettings,
    triggerEmergencySOS,
    autoSync,
    is2FAEnabled,
    enable2FA,
    disable2FA,
    requestForegroundPermission,
    requestBackgroundPermission,
    enableGpsInline,
    setActiveDutyType,
    activeDutyType,
  } = patrolState;

  // ----------------------------------------------------------
  // THEME
  // ----------------------------------------------------------

  const styles = getStyles(isDarkTheme);
  const colors = getThemeColors(isDarkTheme);

  // ----------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------

  return (
    <>
      {/* ======================================================
          COMMAND HEADER
      ====================================================== */}

      <TopCommandHeader
        onLogout={logout}
        isDarkTheme={isDarkTheme}
        onToggleTheme={handleToggleTheme}
        patrolStatus={patrolStatus}
      />

      {/* ======================================================
          ACTIVE PATROL NOTIFICATION
      ====================================================== */}

      {patrolStatus.running && (
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
        </View>
      )}

      {/* ======================================================
          DASHBOARD
      ====================================================== */}

      <DashboardView
        personnel={personnel}
        schedule={schedule}
        personnelLogs={personnelLogs}
        isShiftActive={patrolStatus.running}
        isGpsEnabled={isGpsEnabled}
        foregroundGranted={foregroundGranted}
        backgroundGranted={backgroundGranted}
        unsyncedCount={unsyncedCount}
        isSyncing={isSyncing}
        isPatrolStarting={isPatrolStarting}
        onToggleShift={toggleShift}
        onSync={syncLogsWithRemote}
        onOpenSettings={openSystemSettings}
        onEmergencySOS={triggerEmergencySOS}
        autoSync={autoSync}
        is2FAEnabled={is2FAEnabled}
        onEnable2FA={enable2FA}
        onDisable2FA={disable2FA}
        isDarkTheme={isDarkTheme}
        onRequestForeground={requestForegroundPermission}
        onRequestBackground={requestBackgroundPermission}
        onEnableGpsInline={enableGpsInline}
        setActiveDutyType={setActiveDutyType}
        activeDutyType={activeDutyType!}
      />
    </>
  );
}

// ============================================================
// ACCOUNT SCREEN WRAPPER
// ============================================================

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
