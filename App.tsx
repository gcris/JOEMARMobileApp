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
import * as Notifications from "expo-notifications";
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
import { registerNotificationLayouts } from "./src/services/BackgroundTracker";
import SosAlertModal from "./src/components/SosAlertModal";
import SOSNotification from "./src/services/SOSNotification";

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
  const processedNotificationIds = React.useRef<string[]>([]);
  const [viewMode, setViewMode] = useState<"login" | "register">("login");
  const [sosAlertData, setSosAlertData] = useState<{
    senderName: string;
    latitude: number;
    longitude: number;
    phone_number: string;
  } | null>(null);

  const styles = getStyles(isDarkTheme);
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
    triggerEmergencySOS,
    requestForegroundPermission,
    requestBackgroundPermission,
    requestNotificationPermissions,
    enableGpsInline,
    registerUser,
  } = patrolState;

  // Check notification permissions on app startup
  useEffect(() => {
    requestNotificationPermissions();
    registerNotificationLayouts();
  }, [requestNotificationPermissions, registerNotificationLayouts]);

  useEffect(() => {
    // Check for initial notification response (when app is launched from notification)
    const checkInitialNotification = async () => {
      try {
        const lastNotificationResponse =
          await Notifications.getLastNotificationResponseAsync();
        if (lastNotificationResponse) {
          const notification = lastNotificationResponse.notification;

          const notificationId = notification.request.identifier; // <-- Get unique ID

          // SKIP if we have already handled this exact notification
          if (processedNotificationIds.current.includes(notificationId)) {
            return;
          }

          const data = notification.request.content?.data;

          if (
            data?.type === "sos-incoming-alert" &&
            data.latitude &&
            data.longitude
          ) {
            processedNotificationIds.current.push(notificationId);

            SOSNotification.show({
              title: notification.request.content.title ?? "DISTRESS SIGNAL",
              body: notification.request.content.body ?? "",
              senderName: data.senderName,
              phone_number: data.phone_number,
              latitude: data.latitude,
              longitude: data.longitude,
            });

            setSosAlertData({
              senderName: data.senderName,
              latitude: data.latitude,
              longitude: data.longitude,
              phone_number: data.phone_number || "",
            });
          }
        }
      } catch (error) {
        console.warn("Failed to get initial notification response:", error);
      }
    };

    // Check for stored SOS alert data when app starts or returns to foreground (from background notifications)
    // const checkForStoredSosAlert = async () => {
    //   try {
    //     const storedData = await AsyncStorage.getItem("@pnp_sos_alert_data");
    //     if (storedData) {
    //       const parsedData = JSON.parse(storedData);
    //       // Validate that we have required latitude and longitude (same as notification handler)
    //       if (parsedData.latitude && parsedData.longitude) {
    //         setSosAlertData({
    //           ...parsedData,
    //           phone_number: parsedData.phone_number || "", // Ensure phone_number exists
    //         });
    //         // Clear the stored data after retrieving it
    //         await AsyncStorage.removeItem("@pnp_sos_alert_data");
    //       } else {
    //         // Invalid data - clear it out so we don't keep trying to show it
    //         await AsyncStorage.removeItem("@pnp_sos_alert_data");
    //         console.warn(
    //           "Stored SOS alert data missing required latitude/longitude, clearing from storage:",
    //           parsedData,
    //         );
    //       }
    //     }
    //   } catch (error) {
    //     console.warn(
    //       "Failed to retrieve SOS alert data from AsyncStorage:",
    //       error,
    //     );
    //   }
    // };

    // Run both checks on startup
    checkInitialNotification();
    // checkForStoredSosAlert();

    // Also listen for app state changes to check when coming to foreground (for background notifications)
    const appStateSubscription = AppState.addEventListener(
      "change",
      (state) => {
        if (state === "active") {
          checkInitialNotification(); // Only check AsyncStorage on foreground, not initial notification
        }
      },
    );

    // // Set up the notification response listener for future notifications
    // const notificationSubscription =
    //   Notifications.addNotificationResponseReceivedListener((response) => {
    //     // Handle SOS button from local notifications (in-app SOS)
    //     if (response.actionIdentifier === "sos-button") {
    //       triggerEmergencySOS();
    //     }

    //     // Handle SOS actions from remote notifications
    //     const notification = response.notification;
    //     const data = notification.request.content?.data;

    //     if (data?.type === "sos-incoming-alert") {
    //       // Store the SOS data to show in our modal
    //       if (data.latitude && data.longitude) {
    //         setSosAlertData({
    //           senderName: data.senderName,
    //           latitude: data.latitude,
    //           longitude: data.longitude,
    //           phone_number: data.phone_number || "",
    //         });
    //       }
    //     }
    //   });

    return () => {
      appStateSubscription.remove();
      // notificationSubscription.remove();
    };
  });

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
          <TouchableOpacity
            style={styles.patrolNotificationButtonSos}
            onPress={triggerEmergencySOS}
            activeOpacity={0.7}
          >
            <Text style={styles.patrolNotificationButtonSosText}>SOS</Text>
          </TouchableOpacity>
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
