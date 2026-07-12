import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
} from "react-native";
import { getStyles, getThemeColors } from "../theme/styles";
import { supabase, isSupabaseConfigured } from "../services/supabase";

interface ForgotPasswordScreenProps {
  isDarkTheme: boolean;
  onToggleTheme: () => void;
  onBack?: () => void;
}

export const ForgotPasswordScreen = ({
  isDarkTheme,
  onToggleTheme,
  onBack,
}: ForgotPasswordScreenProps) => {
  const styles = getStyles(isDarkTheme);
  const colors = getThemeColors(isDarkTheme);
  const [email, setEmail] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const handleSendResetLink = async () => {
    if (!email.trim()) {
      Alert.alert("Error", "Please enter your email address");
      return;
    }

    if (!email.includes("@")) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    setIsSending(true);
    setMessage(null);

    try {
      // Check if Supabase is configured
      if (!isSupabaseConfigured()) {
        throw new Error("Supabase is not configured properly");
      }

      // Send password reset link using Supabase
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        // You can configure redirect URL if needed
        // redirectTo: `${window.location.origin}/update-password`
      });

      if (error) {
        throw error;
      }

      // Set success state
      setSent(true);
      setMessage(
        "Password reset link sent to your email. Please check your inbox.",
      );

      // In a real implementation, you would call your auth service here
      // const result = await authService.sendPasswordResetEmail(email);
      // if (result.success) { ... }
    } catch (error: any) {
      console.error("Error sending reset link:", error);
      let errorMessage = "Failed to send reset link. Please try again.";

      // Handle specific Supabase errors
      if (error.message) {
        if (error.message.includes("invalid email")) {
          errorMessage = "Please enter a valid email address";
        } else if (error.message.includes("user not found")) {
          // For security, don't reveal that the email doesn't exist
          errorMessage =
            "If the email exists in our system, you will receive a reset link";
        } else {
          errorMessage = `Error: ${error.message}`;
        }
      }

      setMessage(errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  const handleBackToLogin = () => {
    // Navigate back to login screen
    if (onBack) {
      onBack();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgDark }}>
      <StatusBar
        barStyle={isDarkTheme ? "light-content" : "dark-content"}
        backgroundColor={colors.bgDark}
      />

      {/* Floating Theme Switcher top right - matches Native Compose */}
      <TouchableOpacity
        onPress={onToggleTheme}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: isDarkTheme ? "#142035" : "#FFFFFF",
          borderWidth: 1,
          borderColor: isDarkTheme ? "#1E293B" : "#E2E8F0",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 99,
        }}
        activeOpacity={0.7}
      >
        <Text style={{ fontSize: 18 }}>{isDarkTheme ? "☀️" : "🌙"}</Text>
      </TouchableOpacity>

      {/* Aesthetic Radar Grid Lines in background - matches Native Compose Canvas */}
      <View
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          left: 0,
          bottom: 0,
          justifyContent: "center",
          alignItems: "center",
          zIndex: -1,
          opacity: 0.4,
        }}
        pointerEvents="none"
      >
        {/* Circle 1 */}
        <View
          style={{
            position: "absolute",
            width: 150,
            height: 150,
            borderRadius: 75,
            borderWidth: 1.5,
            borderColor: isDarkTheme ? "#142035" : "#94A3B8",
          }}
        />
        {/* Circle 2 */}
        <View
          style={{
            position: "absolute",
            width: 300,
            height: 300,
            borderRadius: 150,
            borderWidth: 1.2,
            borderColor: isDarkTheme ? "#142035" : "#94A3B8",
          }}
        />
        {/* Circle 3 */}
        <View
          style={{
            position: "absolute",
            width: 450,
            height: 450,
            borderRadius: 225,
            borderWidth: 1,
            borderColor: isDarkTheme ? "#142035" : "#94A3B8",
          }}
        />
        {/* Crosshairs */}
        <View
          style={{
            position: "absolute",
            width: "100%",
            height: 1,
            backgroundColor: isDarkTheme
              ? "rgba(20,32,53,0.2)"
              : "rgba(148,163,184,0.2)",
          }}
        />
        <View
          style={{
            position: "absolute",
            width: 1,
            height: "100%",
            backgroundColor: isDarkTheme
              ? "rgba(8, 9, 11, 0.2)"
              : "rgba(148,163,184,0.2)",
          }}
        />
      </View>

      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <View style={{ width: "90%", maxWidth: 400 }}>
          {!sent ? (
            <View>
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: "bold",
                  textAlign: "center",
                  color: isDarkTheme ? "#FACC15" : "#1E3A8A",
                  marginBottom: 20,
                }}
              >
                Forgot Password
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  textAlign: "center",
                  color: isDarkTheme ? "#94A3B8" : "#475569",
                  marginBottom: 24,
                }}
              >
                Enter your email address to receive a password reset link
              </Text>

              <View style={{ marginBottom: 20 }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: colors.blackText,
                    marginBottom: 8,
                  }}
                >
                  Email Address
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: isDarkTheme
                      ? "rgba(15,23,42,0.3)"
                      : "rgba(241,245,249,0.3)",
                    borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: colors.borderBlue,
                    paddingHorizontal: 12,
                    height: 52,
                  }}
                >
                  <Text style={{ fontSize: 16, marginRight: 8 }}>✉️</Text>
                  <TextInput
                    style={{
                      flex: 1,
                      color: isDarkTheme ? "#FFFFFF" : "#0F172A",
                      fontSize: 20,
                    }}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="e.g. name@gmail.com"
                    placeholderTextColor="rgba(148,163,184,0.6)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  { marginHorizontal: 20, marginBottom: 20 },
                ]}
                onPress={handleSendResetLink}
                disabled={isSending}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: "bold",
                      color: isDarkTheme ? "#000000" : "#FFFFFF",
                    }}
                  >
                    Send Reset Link
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: "bold",
                  textAlign: "center",
                  color: isDarkTheme ? "#FACC15" : "#1E3A8A",
                  marginBottom: 20,
                }}
              >
                Reset Link Sent
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  textAlign: "center",
                  color: isDarkTheme ? "#94A3B8" : "#475569",
                  marginBottom: 24,
                }}
              >
                {message ||
                  "Check your email for instructions to reset your password"}
              </Text>

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  { marginHorizontal: 20, marginBottom: 20 },
                ]}
                onPress={handleBackToLogin}
              >
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: "bold",
                    color: isDarkTheme ? "#000000" : "#FFFFFF",
                  }}
                >
                  Back to Login
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Back to Login link */}
          <View style={{ marginTop: 30, alignItems: "center" }}>
            <TouchableOpacity onPress={handleBackToLogin}>
              <Text
                style={{
                  fontSize: 16,
                  color: isDarkTheme ? "#94A3B8" : "#475569",
                  textDecorationLine: "underline",
                }}
              >
                Remember your password? Sign in
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};
