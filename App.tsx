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

import { usePatrolState } from "./src/hooks/usePatrolState";
import { getStyles, getThemeColors } from "./src/theme/styles";
import { LoginView } from "./src/components/LoginView";
import { RegisterView } from "./src/components/RegisterView";
import { DashboardView } from "./src/components/DashboardView";
import { TopCommandHeader } from "./src/components/TopCommandHeader";
import { AnimatedSplashScreen } from "./src/components/AnimatedSplashScreen";
import { AccountScreen } from "./src/components/AccountScreen";
import SosAlertModal from "./src/components/SosAlertModal";
import { syncPendingPatrolLogs } from "./src/services/database";

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
  const [viewMode, setViewMode] = useState<"login" | "register">("login");
  const [sosAlertData, setSosAlertData] = useState<{
    senderName: string;
    latitude: number;
    longitude: number;
    phone_number: string;
  } | null>(null);

  const colors = getThemeColors(isDarkTheme);

  const patrolState = usePatrolState();

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

  useEffect(() => {
    syncPendingPatrolLogs();
  }, []);

  const handleToggleTheme = () => {
    setIsDarkTheme(!isDarkTheme);
  };

  const handleForgotPassword = () => {
    Alert.alert(
      "Feature coming soon",
      "Password reset functionality will be available in a future update.",
    );
  };

  if (showSplash) {
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
