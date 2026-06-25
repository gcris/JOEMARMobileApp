import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { useClipboard } from "@react-native-clipboard/clipboard";
import { getStyles, getThemeColors } from "../theme/styles";
import { getOTPAuthUri } from "../services/totp";
import Ionicons from "@expo/vector-icons/Ionicons";

interface LoginViewProps {
  isGpsEnabled: boolean;
  gpsLoading: boolean;
  onLogin: (
    email: string,
    password: string,
    otpCode?: string,
  ) => Promise<
    boolean | "NEED_2FA" | "PENDING_APPROVAL" | "NOT_FOUND" | string
  >;
  onOpenSettings: () => void;
  isDarkTheme: boolean;
  onToggleTheme: () => void;
  foregroundGranted: boolean | null;
  backgroundGranted: boolean | null;
  onRequestForeground: () => Promise<boolean>;
  onRequestBackground: () => Promise<boolean>;
  onEnableGpsInline: () => Promise<boolean>;
  onGoToRegister?: () => void;
}

export const LoginView = ({
  isGpsEnabled,
  gpsLoading,
  onLogin,
  onOpenSettings,
  isDarkTheme,
  onToggleTheme,
  foregroundGranted,
  backgroundGranted,
  onRequestForeground,
  onRequestBackground,
  onEnableGpsInline,
  onGoToRegister,
}: LoginViewProps) => {
  const styles = getStyles(isDarkTheme);
  const colors = getThemeColors(isDarkTheme);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [otp, setOtp] = useState("");
  const [mfaSecret, setMfaSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingState, setPendingState] = useState(false);
  const [notFoundState, setNotFoundState] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const handleSubmit = async () => {
    setLoading(false);
    setErrorMessage(null);
    setPendingState(false);
    setNotFoundState(false);

    if (!email.trim()) {
      setErrorMessage(
        "Please enter your official email address or credentials.",
      );
      return;
    }
    if (!password.trim()) {
      setErrorMessage("Please enter your database secret password.");
      return;
    }

    setLoading(true);
    const res = await onLogin(email, password);
    setLoading(false);

    if (res === "NEED_2FA") {
      setStep("otp");
    } else if (typeof res === "string" && res.startsWith("NEED_2FA_SECRET:")) {
      const secretKey = res.split(":")[1];
      setMfaSecret(secretKey);
      setStep("otp");
    } else if (res === "PENDING_APPROVAL") {
      setPendingState(true);
    } else if (res === "NOT_FOUND") {
      setNotFoundState(true);
    } else if (typeof res === "string") {
      setErrorMessage(res);
    }
  };

  const handleVerifyOtp = async () => {
    const trimmedOtp = otp.trim();
    if (trimmedOtp.length !== 6) {
      Alert.alert(
        "Code Format Error",
        "Please provide the active 6-digit security token shown in Google Authenticator.",
      );
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    const res = await onLogin(email, password, trimmedOtp);
    setLoading(false);

    if (res === true) {
      // Login successful!
    } else if (typeof res === "string") {
      setErrorMessage(res);
      setStep("credentials");
      setOtp("");
    } else {
      setErrorMessage(
        "2FA Validation failing. Please verify your authenticator clocks.",
      );
      setStep("credentials");
      setOtp("");
    }
  };

  const emailBorderColor = emailFocused
    ? isDarkTheme
      ? "#FACC15"
      : "#1E3A8A"
    : isDarkTheme
      ? "#1E293B"
      : "#E2E8F0";

  const passwordBorderColor = passwordFocused
    ? isDarkTheme
      ? "#FACC15"
      : "#1E3A8A"
    : isDarkTheme
      ? "#1E293B"
      : "#E2E8F0";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.scrollContent,
        { position: "relative", minHeight: "100%", justifyContent: "center" },
      ]}
      keyboardShouldPersistTaps="handled"
    >
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
              ? "rgba(20,32,53,0.2)"
              : "rgba(148,163,184,0.2)",
          }}
        />
      </View>

      <View
        style={{ width: "100%", alignItems: "center", paddingVertical: 10 }}
      >
        {/* PNP Gold Emblem Representation */}
        <View
          style={{
            width: 90,
            height: 110,
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <Image
            source={require("../assets/logo.png")}
            style={{ width: 90, height: 110 }}
            resizeMode="contain"
          />
        </View>

        <Text
          style={[
            styles.pnpTitle,
            {
              color: isDarkTheme ? "#FACC15" : "#1E3A8A",
              fontWeight: "bold",
              fontSize: 22,
              textAlign: "center",
            },
          ]}
        >
          Ilocos Norte Police Provincial Office
        </Text>
        <Text
          style={{
            fontSize: 15,
            color: isDarkTheme ? "rgba(248,250,252,0.7)" : "rgba(15,23,42,0.7)",
            marginTop: 4,
            letterSpacing: 0.5,
            textAlign: "center",
          }}
        >
          Patrol Tracker v1.0
        </Text>

        <View style={{ height: 32 }} />

        {/* ACCESS SYSTEM STATUS PANEL */}
        {(foregroundGranted === false ||
          backgroundGranted === false ||
          !isGpsEnabled) && (
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
              INPPO Patrol Tracker requires active security clearances. Please
              grant these permissions below.
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
                  2. Background Location Access{" "}
                  {backgroundGranted ? "✅" : "❌"}
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
                    const gpsOn = await onEnableGpsInline();
                    if (!gpsOn) {
                      Alert.alert(
                        "Permission Fallback",
                        "Could not auto-enable device location. Please configure it via the device system settings.",
                        [
                          { text: "Open Settings", onPress: onOpenSettings },
                          { text: "Cancel", style: "cancel" },
                        ],
                      );
                    }
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
        )}

        {notFoundState && (
          <View
            style={{
              width: "100%",
              backgroundColor: isDarkTheme
                ? "rgba(20, 32, 53, 0.95)"
                : "rgba(255,255,255,0.95)",
              borderWidth: 1,
              borderColor: "#EF4444",
              borderRadius: 12,
              padding: 16,
              marginTop: 16,
              marginBottom: 16,
              alignItems: "center",
            }}
          >
            <Ionicons
              name="warning"
              size={25}
              color={isDarkTheme ? "yellow" : "gray"}
            />
            <Text
              style={{
                fontSize: 15,
                fontWeight: "bold",
                color: "#EF4444",
                marginTop: 8,
              }}
            >
              Email address or password are not match
            </Text>
          </View>
        )}

        {errorMessage &&
          errorMessage !== "NEED_2FA" &&
          !errorMessage.startsWith("NEED_2FA_SECRET:") && (
            <View
              style={{
                width: "100%",
                backgroundColor: isDarkTheme
                  ? "rgba(20, 32, 53, 0.95)"
                  : "rgba(255,255,255,0.95)",
                borderWidth: 1,
                borderColor: "#EF4444",
                borderRadius: 12,
                padding: 16,
                marginTop: 16,
                marginBottom: 16,
                alignItems: "center",
              }}
            >
              <Ionicons
                name="warning"
                size={25}
                color={isDarkTheme ? "yellow" : "gray"}
              />
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "bold",
                  color: "#EF4444",
                  marginTop: 8,
                }}
              >
                {errorMessage}
              </Text>
            </View>
          )}

        {pendingState && (
          <View
            style={{
              width: "100%",
              backgroundColor: isDarkTheme
                ? "rgba(20,32,53,0.95)"
                : "rgba(255,255,255,0.95)",
              borderWidth: 1,
              borderColor: "#1E3A8A",
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
              alignItems: "center",
            }}
          >
            <Ionicons
              name="lock-closed"
              size={32}
              color={isDarkTheme ? "yellow" : "#000000"}
            />
            <Text
              style={{
                fontSize: 16,
                color: isDarkTheme ? "#94A3B8" : "#000000",
                textAlign: "center",
                lineHeight: 16,
                marginTop: 6,
              }}
            >
              You are marked as PENDING APPROVAL. Please contact the
              administrator.
            </Text>
          </View>
        )}

        {step === "credentials" ? (
          <View
            style={[
              styles.formCard,
              {
                width: "100%",
                borderRadius: 16,
                padding: 24,
                borderWidth: 1,
                borderColor: isDarkTheme ? "#1E293B" : "#E2E8F0",
                backgroundColor: isDarkTheme ? "#142035" : "#FFFFFF",
              },
            ]}
          >
            <Text
              style={{
                fontSize: 20,
                fontWeight: "bold",
                letterSpacing: 1,
                textAlign: "left",
                color: isDarkTheme ? "#FFFFFF" : "#0F172A",
                paddingBottom: 20,
              }}
            >
              Welcome back!
            </Text>
            <Text
              style={{
                fontSize: 15,
                fontWeight: "bold",
                color: isDarkTheme
                  ? "rgba(248,250,252,0.7)"
                  : "rgba(15,23,42,0.7)",
                marginBottom: 6,
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
                borderColor: emailBorderColor,
                paddingHorizontal: 12,
                marginBottom: 16,
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
                onChangeText={(t) => {
                  setEmail(t);
                  setErrorMessage(null);
                  setPendingState(false);
                  setNotFoundState(false);
                }}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                placeholder="e.g. name@gmail.com"
                placeholderTextColor="rgba(148,163,184,0.6)"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Text
              style={{
                fontSize: 15,
                fontWeight: "bold",
                color: isDarkTheme
                  ? "rgba(248,250,252,0.7)"
                  : "rgba(15,23,42,0.7)",
                marginBottom: 6,
              }}
            >
              Secret Password
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
                borderColor: passwordBorderColor,
                paddingHorizontal: 12,
                marginBottom: 15,
                height: 52,
              }}
            >
              <Text style={{ fontSize: 16, marginRight: 8 }}>🔒</Text>
              <TextInput
                style={{
                  flex: 1,
                  color: isDarkTheme ? "#FFFFFF" : "#0F172A",
                  fontSize: 20,
                }}
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  setErrorMessage(null);
                  setPendingState(false);
                  setNotFoundState(false);
                }}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                placeholder="Secret Password"
                placeholderTextColor="rgba(148,163,184,0.6)"
                secureTextEntry={!passwordVisible}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => setPasswordVisible(!passwordVisible)}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "bold",
                    color: isDarkTheme ? "#FACC15" : "#1E3A8A",
                  }}
                >
                  {passwordVisible ? "HIDE" : "SHOW"}
                </Text>
              </TouchableOpacity>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 15,
              }}
            >
              <TouchableOpacity
                onPress={() => setRememberMe(!rememberMe)}
                style={{ paddingRight: 8 }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    borderWidth: 1.5,
                    borderColor: rememberMe
                      ? colors.accentAmber
                      : colors.borderBlue,
                    backgroundColor: rememberMe
                      ? colors.accentAmber
                      : "transparent",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  {rememberMe && (
                    <Ionicons
                      name="checkmark"
                      size={16}
                      color={isDarkTheme ? "#FFFFFF" : "#0B121F"}
                    />
                  )}
                </View>
              </TouchableOpacity>
              <Text
                style={{
                  fontSize: 20,
                  color: isDarkTheme
                    ? "rgba(248,250,252,0.7)"
                    : "rgba(15,23,42,0.7)",
                }}
              >
                Remember me
              </Text>
            </View>

            <TouchableOpacity
              style={{
                backgroundColor: isDarkTheme ? "#FACC15" : "#1E3A8A",
                borderRadius: 12,
                height: 50,
                justifyContent: "center",
                alignItems: "center",
              }}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator
                  color={isDarkTheme ? "#0B121F" : "#FFFFFF"}
                />
              ) : (
                <Text
                  style={{
                    color: isDarkTheme ? "#0B121F" : "#FFFFFF",
                    fontWeight: "bold",
                    fontSize: 20,
                  }}
                >
                  Sign in
                </Text>
              )}
            </TouchableOpacity>

            {onGoToRegister && (
              <TouchableOpacity
                style={{
                  marginTop: 18,
                  paddingVertical: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: isDarkTheme ? "#475569" : "#CBD5E1",
                  alignItems: "center",
                }}
                onPress={onGoToRegister}
              >
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "bold",
                    color: isDarkTheme ? "#3B82F6" : "#1D4ED8",
                  }}
                >
                  Not yet registered? Join the team now!
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View
            style={[
              styles.formCard,
              {
                width: "100%",
                borderRadius: 16,
                padding: 24,
                borderWidth: 1,
                borderColor: isDarkTheme ? "#1E293B" : "#E2E8F0",
                backgroundColor: isDarkTheme ? "#142035" : "#FFFFFF",
              },
            ]}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "bold",
                letterSpacing: 1,
                textAlign: "center",
                color: isDarkTheme ? "#FFFFFF" : "#0F172A",
              }}
            >
              👮 MFA SECURE CHALLENGE
            </Text>

            <View
              style={{
                backgroundColor: isDarkTheme ? "#1E293B" : "#DBEAFE",
                padding: 10,
                borderRadius: 6,
                marginVertical: 12,
                borderWidth: 1,
                borderColor: isDarkTheme ? "#334155" : "#BFDBFE",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: isDarkTheme ? "#FACC15" : "#1E3A8A",
                  fontSize: 11,
                  fontWeight: "bold",
                }}
              >
                🔐 GOOGLE AUTHENTICATOR IS ACTIVE
              </Text>
            </View>

            <Text
              style={{
                color: isDarkTheme ? "#94A3B8" : "#475569",
                fontSize: 12,
                textAlign: "center",
                lineHeight: 18,
                marginBottom: 16,
              }}
            >
              Your badge profile is protected with Two-Factor Identification.
              Enter the current 6-digit code from Google Authenticator to join
              active patrol shift status.
            </Text>

            {mfaSecret
              ? (() => {
                  const otpauthUri = getOTPAuthUri(
                    email || "patroller",
                    mfaSecret,
                  );
                  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(otpauthUri)}`;
                  return (
                    <View
                      style={{
                        backgroundColor: isDarkTheme ? "#0B121F" : "#F8FAFC",
                        padding: 16,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: isDarkTheme ? "#1E293B" : "#E2E8F0",
                        marginBottom: 16,
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: isDarkTheme ? "#FACC15" : "#1E3A8A",
                          fontSize: 10,
                          fontWeight: "900",
                          letterSpacing: 0.5,
                          marginBottom: 12,
                        }}
                      >
                        GOOGLE AUTHENTICATOR QR SETUP
                      </Text>

                      {/* QR Code Container with white background for perfect scanning */}
                      <View
                        style={{
                          backgroundColor: "#FFFFFF",
                          padding: 8,
                          borderRadius: 8,
                          marginBottom: 12,
                          borderWidth: 1,
                          borderColor: "#E2E8F0",
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.1,
                          shadowRadius: 4,
                          elevation: 1,
                        }}
                      >
                        <Image
                          source={{ uri: qrCodeUrl }}
                          style={{ width: 160, height: 160 }}
                          resizeMode="contain"
                        />
                      </View>

                      <Text
                        style={{
                          color: isDarkTheme ? "#FFFFFF" : "#0F172A",
                          fontSize: 11,
                          fontWeight: "bold",
                          fontFamily: "monospace",
                          letterSpacing: 1,
                          marginBottom: 4,
                        }}
                      >
                        Key: {mfaSecret}
                      </Text>
                      <Text
                        style={{
                          color: isDarkTheme ? "#94A3B8" : "#64748B",
                          fontSize: 9,
                          textAlign: "center",
                          marginBottom: 8,
                          paddingHorizontal: 10,
                        }}
                      >
                        Scan this QR code with your Google Authenticator app or
                        copy the setup key below manually.
                      </Text>

                      <TouchableOpacity
                        style={{
                          backgroundColor: isDarkTheme ? "#1E293B" : "#E2E8F0",
                          paddingVertical: 5,
                          paddingHorizontal: 12,
                          borderRadius: 4,
                          borderColor: isDarkTheme ? "#334155" : "#CBD5E1",
                          borderWidth: 1,
                        }}
                        onPress={() => {
                          useClipboard.apply(mfaSecret);
                          Alert.alert(
                            "Secret Copied",
                            "Google Authenticator secret copied to device clipboard. Standard key input type inside your device Authenticator app.",
                          );
                        }}
                      >
                        <Text
                          style={{
                            color: isDarkTheme ? "#FFFFFF" : "#0F172A",
                            fontSize: 10,
                            fontWeight: "bold",
                          }}
                        >
                          📋 COPY SETUP KEY
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })()
              : null}

            <Text
              style={{
                fontSize: 11,
                fontWeight: "bold",
                color: isDarkTheme
                  ? "rgba(248,250,252,0.7)"
                  : "rgba(15,23,42,0.7)",
                marginBottom: 6,
                textAlign: "center",
              }}
            >
              SIX-DIGIT SECURITY TOKEN
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  textAlign: "center",
                  fontSize: 24,
                  letterSpacing: 8,
                  fontWeight: "bold",
                  marginBottom: 16,
                },
              ]}
              value={otp}
              onChangeText={(v) =>
                setOtp(v.replace(/[^0-9]/g, "").substring(0, 6))
              }
              placeholder="000000"
              placeholderTextColor={isDarkTheme ? "#64748B" : "#94A3B8"}
              keyboardType="number-pad"
              maxLength={6}
            />

            <TouchableOpacity
              style={{
                backgroundColor: "#10B981",
                borderRadius: 12,
                height: 50,
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 12,
              }}
              onPress={handleVerifyOtp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text
                  style={{ color: "#FFFFFF", fontWeight: "bold", fontSize: 15 }}
                >
                  VERIFY & ACCESS SYSTEMS
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                alignItems: "center",
                paddingVertical: 12,
                borderWidth: 1,
                borderColor: isDarkTheme ? "#1E293B" : "#E2E8F0",
                borderRadius: 12,
              }}
              onPress={() => {
                setOtp("");
                setStep("credentials");
              }}
            >
              <Text
                style={{
                  color: isDarkTheme ? "#94A3B8" : "#475569",
                  fontSize: 13,
                  fontWeight: "bold",
                }}
              >
                ◀ GO BACK TO SHIELD HEADER
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
};
