import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { WebView } from "react-native-webview";
import Ionicons from "@expo/vector-icons/Ionicons";

const WEB_REGISTRATION_URL = "https://project-patrol.ilocosnorteppo.com/register?mode=mobile";

interface RegisterWebviewProps {
  isDarkTheme: boolean;
  onBackToLogin: () => void;
}

export const RegisterWebview = ({
  isDarkTheme,
  onBackToLogin,
}: RegisterWebviewProps) => {
  const webviewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBack = () => {
    if (canGoBack) {
      webviewRef.current?.goBack();
    } else {
      onBackToLogin();
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkTheme ? "#080F1C" : "#F1F5F9" }]}>
      <StatusBar
        barStyle={isDarkTheme ? "light-content" : "dark-content"}
        backgroundColor={isDarkTheme ? "#080F1C" : "#F1F5F9"}
      />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: isDarkTheme ? "#0B121F" : "#FFFFFF",
            borderColor: isDarkTheme ? "#1E293B" : "#E2E8F0",
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.backButton,
            {
              backgroundColor: isDarkTheme ? "#111C2D" : "#FFFFFF",
              borderColor: isDarkTheme ? "#263449" : "#E2E8F0",
            },
          ]}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color={isDarkTheme ? "#FACC15" : "#1E3A8A"}
          />
          <Text
            style={[
              styles.backText,
              { color: isDarkTheme ? "#F8FAFC" : "#0F172A" },
            ]}
          >
            {canGoBack ? "Back" : "Sign in"}
          </Text>
        </TouchableOpacity>

        <View style={styles.titleWrap}>
          <Ionicons
            name="person-add-outline"
            size={20}
            color={isDarkTheme ? "#FACC15" : "#1E3A8A"}
          />
          <Text
            style={[
              styles.title,
              { color: isDarkTheme ? "#F8FAFC" : "#0F172A" },
            ]}
          >
            Registration Portal
          </Text>
        </View>

        <View style={styles.rightSpacer} />
      </View>

      {error && (
        <View
          style={[
            styles.errorBar,
            { backgroundColor: isDarkTheme ? "#1E1B1B" : "#FEF2F2" },
          ]}
        >
          <Ionicons name="alert-circle" size={16} color="#EF4444" />
          <Text style={[styles.errorText, { color: isDarkTheme ? "#F8FAFC" : "#7F1D1D" }]}>
            {error}
          </Text>
        </View>
      )}

      <WebView
        ref={webviewRef}
        source={{ uri: WEB_REGISTRATION_URL }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator
              size="large"
              color={isDarkTheme ? "#FACC15" : "#1E3A8A"}
            />
            <Text
              style={[
                styles.loadingText,
                { color: isDarkTheme ? "#94A3B8" : "#64748B" },
              ]}
            >
              Loading registration portal...
            </Text>
          </View>
        )}
        onNavigationStateChange={(state) => {
          setCanGoBack(state.canGoBack);
        }}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          setError(nativeEvent.description || "Failed to load registration page.");
        }}
        onShouldStartLoadWithRequest={(request) => {
          // Keep navigation inside the portal; do not hand off to the browser.
          return true;
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  backText: {
    marginLeft: 5,
    fontSize: 15,
    fontWeight: "700",
  },
  titleWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 52,
  },
  title: {
    marginLeft: 6,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  rightSpacer: {
    width: 52,
  },
  errorBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  errorText: {
    marginLeft: 6,
    fontSize: 13,
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
});