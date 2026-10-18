import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from "react-native";

import Clipboard from "@react-native-clipboard/clipboard";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { getStyles } from "../theme/styles";

import { getOTPAuthUri, checkMFAStatus } from "../services/supabaseMFA";

import { LoginResult, usePatrolState } from "../hooks/usePatrolState";

// IMPORTANT:
// Change this import to wherever your Supabase client is located.
import { supabase } from "../services/supabase";

interface LoginViewProps {
  isGpsEnabled: boolean;
  gpsLoading: boolean;

  onLogin: (
    email: string,
    password: string,
    otpCode?: string,
  ) => Promise<LoginResult>;

  onOpenSettings: () => void;

  isDarkTheme: boolean;
  onToggleTheme: () => void;

  foregroundGranted: boolean | null;
  backgroundGranted: boolean | null;

  onRequestForeground: () => Promise<boolean>;
  onRequestBackground: () => Promise<boolean>;
  onEnableGpsInline: () => Promise<boolean>;

  onGoToRegister?: () => void;
  onForgotPassword?: () => void;
}

/* -------------------------------------------------------------------------- */
/*                               HELPER TYPES                                 */
/* -------------------------------------------------------------------------- */

type LoginStep =
  | "credentials"
  | "otp"
  | "mfaSetup"
  | "forgotEmail"
  | "forgotSent";

type InputProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  isDarkTheme: boolean;
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "number-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  rightElement?: React.ReactNode;
};

/* -------------------------------------------------------------------------- */
/*                            REUSABLE COMPONENTS                             */
/* -------------------------------------------------------------------------- */

const Field = ({
  icon,
  label,
  value,
  placeholder,
  onChangeText,
  isDarkTheme,
  focused,
  onFocus,
  onBlur,
  secureTextEntry = false,
  keyboardType = "default",
  autoCapitalize = "none",
  rightElement,
}: InputProps) => {
  return (
    <View style={styles.fieldWrapper}>
      <Text
        style={[
          styles.fieldLabel,
          {
            color: isDarkTheme ? "#CBD5E1" : "#334155",
          },
        ]}
      >
        {label}
      </Text>

      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: isDarkTheme ? "#0F172A" : "#F8FAFC",
            borderColor: focused
              ? isDarkTheme
                ? "#FACC15"
                : "#1E3A8A"
              : isDarkTheme
                ? "#334155"
                : "#CBD5E1",
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={21}
          color={focused ? (isDarkTheme ? "#FACC15" : "#1E3A8A") : "#64748B"}
          style={styles.inputIcon}
        />

        <TextInput
          style={[
            styles.textInput,
            {
              color: isDarkTheme ? "#F8FAFC" : "#0F172A",
            },
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={isDarkTheme ? "#64748B" : "#94A3B8"}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          onFocus={onFocus}
          onBlur={onBlur}
        />

        {rightElement}
      </View>
    </View>
  );
};

const PrimaryButton = ({
  title,
  loading,
  onPress,
  isDarkTheme,
  icon,
  disabled = false,
}: {
  title: string;
  loading?: boolean;
  onPress: () => void;
  isDarkTheme: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.primaryButton,
        {
          backgroundColor: isDarkTheme ? "#FACC15" : "#1E3A8A",
          opacity: disabled ? 0.65 : 1,
        },
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator
          color={isDarkTheme ? "#0B121F" : "#FFFFFF"}
          size="small"
        />
      ) : (
        <>
          {icon && (
            <Ionicons
              name={icon}
              size={20}
              color={isDarkTheme ? "#0B121F" : "#FFFFFF"}
              style={{ marginRight: 8 }}
            />
          )}

          <Text
            style={[
              styles.primaryButtonText,
              {
                color: isDarkTheme ? "#0B121F" : "#FFFFFF",
              },
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const SecondaryButton = ({
  title,
  onPress,
  isDarkTheme,
  icon,
}: {
  title: string;
  onPress: () => void;
  isDarkTheme: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.secondaryButton,
        {
          borderColor: isDarkTheme ? "#334155" : "#CBD5E1",
          backgroundColor: isDarkTheme ? "#111C2D" : "#FFFFFF",
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={18}
          color={isDarkTheme ? "#94A3B8" : "#475569"}
          style={{ marginRight: 8 }}
        />
      )}

      <Text
        style={[
          styles.secondaryButtonText,
          {
            color: isDarkTheme ? "#CBD5E1" : "#475569",
          },
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
};

const StatusMessage = ({
  type,
  title,
  message,
  isDarkTheme,
}: {
  type: "error" | "warning" | "info" | "success";
  title?: string;
  message: string;
  isDarkTheme: boolean;
}) => {
  const config = {
    error: {
      icon: "alert-circle" as keyof typeof Ionicons.glyphMap,
      color: "#EF4444",
    },
    warning: {
      icon: "warning" as keyof typeof Ionicons.glyphMap,
      color: "#F59E0B",
    },
    info: {
      icon: "information-circle" as keyof typeof Ionicons.glyphMap,
      color: "#3B82F6",
    },
    success: {
      icon: "checkmark-circle" as keyof typeof Ionicons.glyphMap,
      color: "#10B981",
    },
  };

  const current = config[type];

  return (
    <View
      style={[
        styles.statusBox,
        {
          backgroundColor: isDarkTheme ? "#111C2D" : "#FFFFFF",
          borderColor: current.color,
        },
      ]}
    >
      <View
        style={[
          styles.statusIconCircle,
          {
            backgroundColor: `${current.color}18`,
          },
        ]}
      >
        <Ionicons name={current.icon} size={22} color={current.color} />
      </View>

      <View style={{ flex: 1 }}>
        {title && (
          <Text
            style={[
              styles.statusTitle,
              {
                color: current.color,
              },
            ]}
          >
            {title}
          </Text>
        )}

        <Text
          style={[
            styles.statusMessage,
            {
              color: isDarkTheme ? "#CBD5E1" : "#475569",
            },
          ]}
        >
          {message}
        </Text>
      </View>
    </View>
  );
};

const ScreenHeader = ({
  icon,
  title,
  subtitle,
  isDarkTheme,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  isDarkTheme: boolean;
}) => {
  return (
    <View style={styles.screenHeader}>
      <View
        style={[
          styles.screenHeaderIcon,
          {
            backgroundColor: isDarkTheme ? "#1E293B" : "#EFF6FF",
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={27}
          color={isDarkTheme ? "#FACC15" : "#1E3A8A"}
        />
      </View>

      <Text
        style={[
          styles.screenHeaderTitle,
          {
            color: isDarkTheme ? "#F8FAFC" : "#0F172A",
          },
        ]}
      >
        {title}
      </Text>

      <Text
        style={[
          styles.screenHeaderSubtitle,
          {
            color: isDarkTheme ? "#94A3B8" : "#64748B",
          },
        ]}
      >
        {subtitle}
      </Text>
    </View>
  );
};

/* -------------------------------------------------------------------------- */
/*                                MAIN VIEW                                   */
/* -------------------------------------------------------------------------- */

export const LoginView = ({
  gpsLoading,
  onLogin,
  onOpenSettings,
  isDarkTheme,
  onToggleTheme,
  onForgotPassword,
}: LoginViewProps) => {
  const { enable2FA } = usePatrolState();

  const stylesFromTheme = getStyles(isDarkTheme);

  /* ------------------------------------------------------------------------ */
  /*                                STATE                                     */
  /* ------------------------------------------------------------------------ */

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [passwordVisible, setPasswordVisible] = useState(false);

  const [step, setStep] = useState<LoginStep>("credentials");

  const [otp, setOtp] = useState("");

  const [loading, setLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [pendingState, setPendingState] = useState(false);

  const [notFoundState, setNotFoundState] = useState(false);

  const [emailFocused, setEmailFocused] = useState(false);

  const [passwordFocused, setPasswordFocused] = useState(false);

  /* ------------------------------------------------------------------------ */
  /*                         FORGOT PASSWORD STATE                             */
  /* ------------------------------------------------------------------------ */

  const [forgotEmail, setForgotEmail] = useState("");

  const [forgotErrorMessage, setForgotErrorMessage] = useState<string | null>(
    null,
  );

  const [forgotSuccessMessage, setForgotSuccessMessage] = useState<
    string | null
  >(null);

  /* ------------------------------------------------------------------------ */
  /*                              MFA SETUP                                    */
  /* ------------------------------------------------------------------------ */

  const [mfaSetupSecret, setMfaSetupSecret] = useState("");

  const [mfaSetupCode, setMfaSetupCode] = useState("");

  const [mfaSetupLoading, setMfaSetupLoading] = useState(false);

  const [mfaFactorId, setMfaFactorId] = useState("");

  /* ------------------------------------------------------------------------ */
  /*                          WEB RESET PASSWORD URL                           */
  /* ------------------------------------------------------------------------ */

  /*
   * IMPORTANT:
   *
   * This must point to your WEB React application's password reset page.
   *
   * Example:
   * https://ilocosnorteppo.com
   *
   * The web page should receive the Supabase recovery session and
   * allow the user to create the new password there.
   */

  const WEB_RESET_PASSWORD_URL = "https://ilocosnorteppo.com";

  /* ------------------------------------------------------------------------ */
  /*                            LOAD SAVED EMAIL                                */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    const loadSavedEmail = async () => {
      try {
        const savedEmail = await AsyncStorage.getItem("@pnp_user_name");

        if (savedEmail) {
          setEmail(savedEmail);
        }
      } catch (error) {
        console.error("Failed to load saved email:", error);
      }
    };

    loadSavedEmail();
  }, []);

  /* ------------------------------------------------------------------------ */
  /*                           CLEAR LOGIN ERRORS                               */
  /* ------------------------------------------------------------------------ */

  const clearLoginMessages = () => {
    setErrorMessage(null);
    setPendingState(false);
    setNotFoundState(false);
  };

  /* ------------------------------------------------------------------------ */
  /*                              LOGIN                                         */
  /* ------------------------------------------------------------------------ */

  const handleSubmit = async () => {
    clearLoginMessages();

    if (!email.trim()) {
      setErrorMessage("Please enter your official email address.");
      return;
    }

    if (!password.trim()) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      const res = await onLogin(email.trim(), password);

      console.log("Login result:", res);

      switch (res.status) {
        case "SUCCESS":
          break;

        case "NOT_FOUND":
          setNotFoundState(true);
          break;

        case "PENDING_APPROVAL":
          setPendingState(true);
          break;

        case "NEED_MFA_LOGIN":
          setMfaFactorId(res.factorId);
          setStep("otp");
          break;

        case "NEED_MFA_SETUP":
          setMfaSetupSecret(res.secret);
          setMfaSetupCode("");
          setStep("mfaSetup");
          break;

        case "NEED_MFA_VERIFICATION":
          setMfaFactorId(res.factorId);
          setStep("otp");
          break;

        case "ERROR":
          setErrorMessage(res.message);
          break;
      }
    } catch (error) {
      console.error("Login error:", error);

      setErrorMessage("Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /*                              OTP LOGIN                                    */
  /* ------------------------------------------------------------------------ */

  const handleVerifyOtp = async () => {
    const trimmedOtp = otp.trim();

    if (trimmedOtp.length !== 6) {
      Alert.alert(
        "Invalid Security Code",
        "Please enter the current 6-digit code from Google Authenticator.",
      );
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const loginResult = await onLogin(email.trim(), password, trimmedOtp);

      if (loginResult.status === "SUCCESS") {
        setEmail("");
        setPassword("");
        setOtp("");
        setMfaFactorId("");
        setMfaSetupSecret("");
        setStep("credentials");
        return;
      }

      if (loginResult.status === "ERROR") {
        setErrorMessage(loginResult.message);
        setOtp("");
        return;
      }

      setErrorMessage("Unable to complete MFA verification.");
      setOtp("");
    } catch (error) {
      console.error("MFA verification error:", error);

      setErrorMessage("Failed to verify the security code.");
      setOtp("");
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /*                           MFA SETUP                                       */
  /* ------------------------------------------------------------------------ */

  const verifyMfaSetup = async () => {
    const code = mfaSetupCode.trim();

    if (code.length !== 6) {
      Alert.alert(
        "Invalid Security Code",
        "Please enter the 6-digit Google Authenticator code.",
      );
      return;
    }

    setMfaSetupLoading(true);

    try {
      const status = await checkMFAStatus(email.trim());

      const isVerified = await enable2FA(email.trim(), code, status.factorId);

      if (!isVerified) {
        Alert.alert(
          "Verification Failed",
          "The security code is incorrect or has expired.",
        );

        setMfaSetupCode("");
        return;
      }

      const loginResult = await onLogin(email.trim(), password, code);

      if (loginResult.status === "SUCCESS") {
        setEmail("");
        setPassword("");
        setOtp("");
        setMfaSetupCode("");
        setMfaSetupSecret("");
        setMfaFactorId("");
        setStep("credentials");
      } else if (loginResult.status === "ERROR") {
        setErrorMessage(loginResult.message);

        setEmail("");
        setPassword("");
        setOtp("");
        setMfaSetupCode("");
        setMfaSetupSecret("");
        setMfaFactorId("");

        setStep("credentials");
      } else {
        Alert.alert(
          "Login Error",
          "MFA was activated, but the login could not be completed.",
        );
      }
    } catch (error) {
      console.error("MFA setup verification error:", error);

      Alert.alert(
        "Verification Error",
        "Failed to verify your Google Authenticator code.",
      );

      setMfaSetupCode("");
    } finally {
      setMfaSetupLoading(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /*                         FORGOT PASSWORD EMAIL                             */
  /* ------------------------------------------------------------------------ */

  const handleForgotPasswordSubmit = async () => {
    const targetEmail = forgotEmail.trim().toLowerCase();

    if (!targetEmail) {
      setForgotErrorMessage("Please enter your email address.");
      return;
    }

    setLoading(true);
    setForgotErrorMessage(null);
    setForgotSuccessMessage(null);

    try {
      /*
       * We intentionally DO NOT call:
       *
       *   checkMFAStatus()
       *   verifyMFAChallenge()
       *
       * here.
       *
       * Supabase MFA challenge/verify requires an authenticated
       * session. It cannot be used as an anonymous forgot-password
       * verification endpoint.
       *
       * Instead, Supabase sends a secure password recovery link
       * to the user's email.
       */

      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: WEB_RESET_PASSWORD_URL,
      });

      if (error) {
        console.error("Supabase password reset email error:", error);

        /*
         * Do not expose whether the email exists in your database.
         */
        setForgotSuccessMessage(
          "If an account exists for this email address, a password reset link has been sent. Please check your inbox.",
        );

        setStep("forgotSent");

        return;
      }

      setForgotSuccessMessage(
        "A password reset link has been sent to your email address. Please open the email and follow the instructions to create a new password.",
      );

      setStep("forgotSent");
    } catch (error) {
      console.error("Forgot password request error:", error);

      /*
       * Keep the response generic so we do not reveal
       * whether an account exists.
       */
      setForgotSuccessMessage(
        "If an account exists for this email address, a password reset link has been sent. Please check your inbox.",
      );

      setStep("forgotSent");
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /*                         OPEN RESET WEBSITE                                */
  /* ------------------------------------------------------------------------ */

  const handleOpenResetWebsite = async () => {
    try {
      const supported = await Linking.canOpenURL(WEB_RESET_PASSWORD_URL);

      if (supported) {
        await Linking.openURL(WEB_RESET_PASSWORD_URL);
      } else {
        Alert.alert(
          "Unable to Open Website",
          "The password reset website could not be opened.",
        );
      }
    } catch (error) {
      console.error("Failed to open reset password website:", error);

      Alert.alert(
        "Unable to Open Website",
        "Please check your internet connection and try again.",
      );
    }
  };

  /* ------------------------------------------------------------------------ */
  /*                              RESET LOGIN                                  */
  /* ------------------------------------------------------------------------ */

  const backToLogin = () => {
    setStep("credentials");

    setOtp("");

    setMfaSetupCode("");
    setMfaSetupSecret("");
    setMfaFactorId("");

    setForgotEmail("");

    setForgotErrorMessage(null);
    setForgotSuccessMessage(null);
  };

  /* ------------------------------------------------------------------------ */
  /*                              QR CODE                                       */
  /* ------------------------------------------------------------------------ */

  const getQRCodeUrl = () => {
    if (!mfaSetupSecret) {
      return "";
    }

    const otpauthUri = getOTPAuthUri(email || "patroller", mfaSetupSecret);

    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
      otpauthUri,
    )}`;
  };

  /* ------------------------------------------------------------------------ */
  /*                           WEB REGISTRATION                                */
  /* ------------------------------------------------------------------------ */

  const WEB_REGISTRATION_URL = "https://ilocosnorteppo.com/register";

  const handleWebRegistration = async () => {
    try {
      const supported = await Linking.canOpenURL(WEB_REGISTRATION_URL);

      if (supported) {
        await Linking.openURL(WEB_REGISTRATION_URL);
      } else {
        Alert.alert(
          "Unable to Open Registration",
          "The registration page could not be opened. Please try again.",
        );
      }
    } catch (error) {
      console.error("Failed to open registration page:", error);

      Alert.alert(
        "Unable to Open Registration",
        "Please check your internet connection and try again.",
      );
    }
  };

  /* ------------------------------------------------------------------------ */
  /*                              RENDER                                       */
  /* ------------------------------------------------------------------------ */

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={[
          stylesFromTheme.container,
          {
            backgroundColor: isDarkTheme ? "#080F1C" : "#F1F5F9",
          },
        ]}
        contentContainerStyle={styles.pageContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ---------------------------------------------------------------- */}
        {/* BACKGROUND DECORATION                                            */}
        {/* ---------------------------------------------------------------- */}

        <View
          pointerEvents="none"
          style={[
            styles.backgroundCircle,
            {
              borderColor: isDarkTheme
                ? "rgba(250,204,21,0.04)"
                : "rgba(30,58,138,0.05)",
            },
          ]}
        />

        <View
          pointerEvents="none"
          style={[
            styles.backgroundCircleLarge,
            {
              borderColor: isDarkTheme
                ? "rgba(250,204,21,0.035)"
                : "rgba(30,58,138,0.04)",
            },
          ]}
        />

        {/* ---------------------------------------------------------------- */}
        {/* TOP BAR                                                         */}
        {/* ---------------------------------------------------------------- */}

        <View style={styles.topBar}>
          <View />

          <TouchableOpacity
            onPress={onToggleTheme}
            style={[
              styles.themeButton,
              {
                backgroundColor: isDarkTheme ? "#111C2D" : "#FFFFFF",
                borderColor: isDarkTheme ? "#263449" : "#E2E8F0",
              },
            ]}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isDarkTheme ? "sunny" : "moon"}
              size={21}
              color={isDarkTheme ? "#FACC15" : "#1E3A8A"}
            />
          </TouchableOpacity>
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* HEADER                                                           */}
        {/* ---------------------------------------------------------------- */}

        <View style={styles.header}>
          <View style={styles.logoWrapper}>
            <Image
              source={require("../assets/signin-logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <Text
            style={[
              styles.organizationTitle,
              {
                color: isDarkTheme ? "#FACC15" : "#1E3A8A",
              },
            ]}
          >
            ILOCOS NORTE
          </Text>

          <Text
            style={[
              styles.organizationSubtitle,
              {
                color: isDarkTheme ? "#F8FAFC" : "#0F172A",
              },
            ]}
          >
            POLICE PROVINCIAL OFFICE
          </Text>

          <View style={styles.versionRow}>
            <View
              style={[
                styles.versionLine,
                {
                  backgroundColor: isDarkTheme ? "#FACC15" : "#1E3A8A",
                },
              ]}
            />

            <Text
              style={[
                styles.versionText,
                {
                  color: isDarkTheme ? "#94A3B8" : "#64748B",
                },
              ]}
            >
              PROJECT P.A.T.R.O.L • v1.0
            </Text>

            <View
              style={[
                styles.versionLine,
                {
                  backgroundColor: isDarkTheme ? "#FACC15" : "#1E3A8A",
                },
              ]}
            />
          </View>
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* LOGIN STATUS                                                     */}
        {/* ---------------------------------------------------------------- */}

        <View style={styles.fullWidthSection}>
          {notFoundState && (
            <StatusMessage
              type="error"
              title="SIGN-IN FAILED"
              message="The email address or password does not match our records."
              isDarkTheme={isDarkTheme}
            />
          )}

          {errorMessage &&
            errorMessage !== "NEED_2FA" &&
            !errorMessage.startsWith("NEED_2FA_SECRET:") && (
              <StatusMessage
                type="error"
                title="SIGN-IN ERROR"
                message={errorMessage}
                isDarkTheme={isDarkTheme}
              />
            )}

          {pendingState && (
            <StatusMessage
              type="warning"
              title="ACCOUNT PENDING APPROVAL"
              message="Your account is currently marked as pending approval. Please contact the administrator."
              isDarkTheme={isDarkTheme}
            />
          )}
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* MAIN CARD                                                        */}
        {/* ---------------------------------------------------------------- */}

        <View
          style={[
            styles.loginCard,
            {
              backgroundColor: isDarkTheme ? "#101B2D" : "#FFFFFF",
              borderColor: isDarkTheme ? "#263449" : "#E2E8F0",
            },
          ]}
        >
          {/* ============================================================ */}
          {/* CREDENTIALS                                                   */}
          {/* ============================================================ */}

          {step === "credentials" && (
            <>
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.cardHeaderIcon,
                    {
                      backgroundColor: isDarkTheme ? "#1E293B" : "#EFF6FF",
                    },
                  ]}
                >
                  <Ionicons
                    name="shield-checkmark"
                    size={25}
                    color={isDarkTheme ? "#FACC15" : "#1E3A8A"}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.cardTitle,
                      {
                        color: isDarkTheme ? "#F8FAFC" : "#0F172A",
                      },
                    ]}
                  >
                    Welcome Back
                  </Text>

                  <Text
                    style={[
                      styles.cardSubtitle,
                      {
                        color: isDarkTheme ? "#94A3B8" : "#64748B",
                      },
                    ]}
                  >
                    Sign in to access your secure patrol account.
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <Field
                icon="mail-outline"
                label="Email Address"
                value={email}
                placeholder="name@example.com"
                onChangeText={(text) => {
                  setEmail(text);
                  clearLoginMessages();
                }}
                isDarkTheme={isDarkTheme}
                focused={emailFocused}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                keyboardType="email-address"
              />

              <Field
                icon="lock-closed-outline"
                label="Password"
                value={password}
                placeholder="Enter your password"
                onChangeText={(text) => {
                  setPassword(text);
                  clearLoginMessages();
                }}
                isDarkTheme={isDarkTheme}
                focused={passwordFocused}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                secureTextEntry={!passwordVisible}
                rightElement={
                  <TouchableOpacity
                    onPress={() => setPasswordVisible(!passwordVisible)}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={passwordVisible ? "eye-off-outline" : "eye-outline"}
                      size={21}
                      color={isDarkTheme ? "#94A3B8" : "#64748B"}
                    />
                  </TouchableOpacity>
                }
              />

              <View style={styles.forgotRow}>
                <View />

                <TouchableOpacity
                  onPress={() => {
                    if (onForgotPassword) {
                      setForgotEmail(email);

                      setForgotErrorMessage(null);
                      setForgotSuccessMessage(null);

                      setStep("forgotEmail");
                    }
                  }}
                  disabled={!onForgotPassword}
                >
                  <Text
                    style={[
                      styles.forgotText,
                      {
                        color: isDarkTheme ? "#FACC15" : "#1E3A8A",
                      },
                    ]}
                  >
                    Forgot Password?
                  </Text>
                </TouchableOpacity>
              </View>

              <PrimaryButton
                title="SIGN IN"
                icon="log-in-outline"
                loading={loading}
                onPress={handleSubmit}
                isDarkTheme={isDarkTheme}
                disabled={loading}
              />

              <TouchableOpacity
                style={{
                  marginTop: 18,
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: isDarkTheme ? "#475569" : "#CBD5E1",
                  alignItems: "center",
                }}
                onPress={handleWebRegistration}
                activeOpacity={0.7}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name="person-add-outline"
                    size={20}
                    color={isDarkTheme ? "#FACC15" : "#1E3A8A"}
                    style={{ marginRight: 8 }}
                  />

                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "700",
                      color: isDarkTheme ? "#FACC15" : "#1E3A8A",
                    }}
                  >
                    Not yet registered?
                  </Text>
                </View>

                <Text
                  style={{
                    marginTop: 4,
                    fontSize: 16,
                    color: isDarkTheme ? "#94A3B8" : "#64748B",
                    textAlign: "center",
                  }}
                >
                  Register using the web portal
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* ============================================================ */}
          {/* OTP LOGIN                                                     */}
          {/* ============================================================ */}

          {step === "otp" && (
            <>
              <ScreenHeader
                icon="shield-checkmark-outline"
                title="SECURITY VERIFICATION"
                subtitle="Two-factor authentication is required to continue."
                isDarkTheme={isDarkTheme}
              />

              <View
                style={[
                  styles.securityNotice,
                  {
                    backgroundColor: isDarkTheme ? "#172235" : "#EFF6FF",
                    borderColor: isDarkTheme ? "#334155" : "#BFDBFE",
                  },
                ]}
              >
                <Ionicons
                  name="phone-portrait-outline"
                  size={22}
                  color={isDarkTheme ? "#FACC15" : "#1E3A8A"}
                />

                <Text
                  style={[
                    styles.securityNoticeText,
                    {
                      color: isDarkTheme ? "#CBD5E1" : "#475569",
                    },
                  ]}
                >
                  Open Google Authenticator and enter the current 6-digit
                  security code.
                </Text>
              </View>

              <Text
                style={[
                  styles.otpLabel,
                  {
                    color: isDarkTheme ? "#CBD5E1" : "#475569",
                  },
                ]}
              >
                AUTHENTICATION CODE
              </Text>

              <View
                style={[
                  styles.otpInputContainer,
                  {
                    backgroundColor: isDarkTheme ? "#0B1220" : "#F8FAFC",
                    borderColor:
                      otp.length === 6
                        ? "#10B981"
                        : isDarkTheme
                          ? "#334155"
                          : "#CBD5E1",
                  },
                ]}
              >
                <TextInput
                  style={[
                    styles.otpInput,
                    {
                      color: isDarkTheme ? "#F8FAFC" : "#0F172A",
                    },
                  ]}
                  value={otp}
                  onChangeText={(value) =>
                    setOtp(value.replace(/[^0-9]/g, "").substring(0, 6))
                  }
                  placeholder="000000"
                  placeholderTextColor={isDarkTheme ? "#475569" : "#CBD5E1"}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                />
              </View>

              <View style={styles.otpStatusRow}>
                <Ionicons
                  name={
                    otp.length === 6 ? "checkmark-circle" : "ellipse-outline"
                  }
                  size={17}
                  color={
                    otp.length === 6
                      ? "#10B981"
                      : isDarkTheme
                        ? "#64748B"
                        : "#94A3B8"
                  }
                />

                <Text
                  style={{
                    marginLeft: 6,
                    fontSize: 13,
                    color: isDarkTheme ? "#94A3B8" : "#64748B",
                  }}
                >
                  {otp.length}/6 digits entered
                </Text>
              </View>

              <PrimaryButton
                title="VERIFY CODE"
                icon="checkmark-circle-outline"
                loading={loading}
                onPress={handleVerifyOtp}
                isDarkTheme={isDarkTheme}
                disabled={loading}
              />

              <SecondaryButton
                title="Cancel and return to sign in"
                icon="arrow-back-outline"
                onPress={backToLogin}
                isDarkTheme={isDarkTheme}
              />
            </>
          )}

          {/* ============================================================ */}
          {/* MFA SETUP                                                     */}
          {/* ============================================================ */}

          {step === "mfaSetup" && (
            <>
              <ScreenHeader
                icon="shield-outline"
                title="SECURE YOUR ACCOUNT"
                subtitle="Set up Google Authenticator to protect your account."
                isDarkTheme={isDarkTheme}
              />

              <View
                style={[
                  styles.setupStepBadge,
                  {
                    backgroundColor: isDarkTheme ? "#1E293B" : "#EFF6FF",
                  },
                ]}
              >
                <Text
                  style={{
                    color: isDarkTheme ? "#FACC15" : "#1E3A8A",
                    fontWeight: "800",
                    fontSize: 12,
                    letterSpacing: 1,
                  }}
                >
                  STEP 1 • SCAN QR CODE
                </Text>
              </View>

              <Text
                style={[
                  styles.setupDescription,
                  {
                    color: isDarkTheme ? "#94A3B8" : "#64748B",
                  },
                ]}
              >
                Open Google Authenticator and scan the QR code below. If you
                cannot scan it, use the setup key manually.
              </Text>

              {mfaSetupSecret ? (
                <>
                  <View
                    style={[
                      styles.qrWrapper,
                      {
                        backgroundColor: "#FFFFFF",
                        borderColor: isDarkTheme ? "#334155" : "#E2E8F0",
                      },
                    ]}
                  >
                    <Image
                      source={{
                        uri: getQRCodeUrl(),
                      }}
                      style={styles.qrCode}
                      resizeMode="contain"
                    />
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.copyKeyButton,
                      {
                        backgroundColor: isDarkTheme ? "#1E293B" : "#F1F5F9",
                        borderColor: isDarkTheme ? "#334155" : "#CBD5E1",
                      },
                    ]}
                    onPress={() => {
                      Clipboard.setString(mfaSetupSecret);

                      Alert.alert(
                        "Setup Key Copied",
                        "The Google Authenticator setup key has been copied to your clipboard.",
                      );
                    }}
                  >
                    <Ionicons
                      name="copy-outline"
                      size={18}
                      color={isDarkTheme ? "#FACC15" : "#1E3A8A"}
                    />

                    <Text
                      style={{
                        marginLeft: 7,
                        fontWeight: "800",
                        color: isDarkTheme ? "#F8FAFC" : "#0F172A",
                      }}
                    >
                      COPY SETUP KEY
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.loadingSetup}>
                  <ActivityIndicator
                    size="large"
                    color={isDarkTheme ? "#FACC15" : "#1E3A8A"}
                  />

                  <Text
                    style={{
                      marginTop: 12,
                      color: isDarkTheme ? "#94A3B8" : "#64748B",
                    }}
                  >
                    Preparing secure authentication...
                  </Text>
                </View>
              )}

              <View style={styles.setupStepBadge}>
                <Text
                  style={{
                    color: isDarkTheme ? "#FACC15" : "#1E3A8A",
                    fontWeight: "800",
                    fontSize: 12,
                    letterSpacing: 1,
                  }}
                >
                  STEP 2 • VERIFY CODE
                </Text>
              </View>

              <Text
                style={[
                  styles.setupDescription,
                  {
                    color: isDarkTheme ? "#94A3B8" : "#64748B",
                  },
                ]}
              >
                Enter the 6-digit code currently displayed in Google
                Authenticator.
              </Text>

              <View
                style={[
                  styles.otpInputContainer,
                  {
                    backgroundColor: isDarkTheme ? "#0B1220" : "#F8FAFC",
                    borderColor:
                      mfaSetupCode.length === 6
                        ? "#10B981"
                        : isDarkTheme
                          ? "#334155"
                          : "#CBD5E1",
                  },
                ]}
              >
                <TextInput
                  style={[
                    styles.otpInput,
                    {
                      color: isDarkTheme ? "#F8FAFC" : "#0F172A",
                    },
                  ]}
                  value={mfaSetupCode}
                  onChangeText={(value) =>
                    setMfaSetupCode(
                      value.replace(/[^0-9]/g, "").substring(0, 6),
                    )
                  }
                  placeholder="000000"
                  placeholderTextColor={isDarkTheme ? "#475569" : "#CBD5E1"}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>

              <PrimaryButton
                title="ACTIVATE MFA"
                icon="shield-checkmark-outline"
                loading={mfaSetupLoading}
                onPress={verifyMfaSetup}
                isDarkTheme={isDarkTheme}
                disabled={mfaSetupLoading}
              />

              <SecondaryButton
                title="Return to sign in"
                icon="arrow-back-outline"
                onPress={backToLogin}
                isDarkTheme={isDarkTheme}
              />
            </>
          )}

          {/* ============================================================ */}
          {/* FORGOT EMAIL                                                   */}
          {/* ============================================================ */}

          {step === "forgotEmail" && (
            <>
              <ScreenHeader
                icon="key-outline"
                title="RESET PASSWORD"
                subtitle="We'll send a secure password reset link to your email."
                isDarkTheme={isDarkTheme}
              />

              {forgotSuccessMessage && (
                <StatusMessage
                  type="info"
                  message={forgotSuccessMessage}
                  isDarkTheme={isDarkTheme}
                />
              )}

              {forgotErrorMessage && (
                <StatusMessage
                  type="error"
                  message={forgotErrorMessage}
                  isDarkTheme={isDarkTheme}
                />
              )}

              <View
                style={[
                  styles.securityNotice,
                  {
                    backgroundColor: isDarkTheme ? "#172235" : "#EFF6FF",
                    borderColor: isDarkTheme ? "#334155" : "#BFDBFE",
                  },
                ]}
              >
                <Ionicons
                  name="mail-outline"
                  size={22}
                  color={isDarkTheme ? "#FACC15" : "#1E3A8A"}
                />

                <Text
                  style={[
                    styles.securityNoticeText,
                    {
                      color: isDarkTheme ? "#CBD5E1" : "#475569",
                    },
                  ]}
                >
                  Enter your registered email address. A secure password reset
                  link will be sent to your inbox.
                </Text>
              </View>

              <Field
                icon="mail-outline"
                label="Email Address"
                value={forgotEmail}
                placeholder="name@example.com"
                onChangeText={(text) => {
                  setForgotEmail(text);

                  setForgotErrorMessage(null);
                  setForgotSuccessMessage(null);
                }}
                isDarkTheme={isDarkTheme}
                focused={emailFocused}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                keyboardType="email-address"
              />

              <PrimaryButton
                title="SEND RESET LINK"
                icon="mail-outline"
                loading={loading}
                onPress={handleForgotPasswordSubmit}
                isDarkTheme={isDarkTheme}
                disabled={loading}
              />

              <SecondaryButton
                title="Return to sign in"
                icon="arrow-back-outline"
                onPress={backToLogin}
                isDarkTheme={isDarkTheme}
              />
            </>
          )}

          {/* ============================================================ */}
          {/* RESET EMAIL SENT                                              */}
          {/* ============================================================ */}

          {step === "forgotSent" && (
            <>
              <ScreenHeader
                icon="mail-open-outline"
                title="CHECK YOUR EMAIL"
                subtitle="Your password reset instructions are on their way."
                isDarkTheme={isDarkTheme}
              />

              {forgotSuccessMessage && (
                <StatusMessage
                  type="success"
                  title="RESET LINK SENT"
                  message={forgotSuccessMessage}
                  isDarkTheme={isDarkTheme}
                />
              )}

              <View
                style={[
                  styles.emailSentBox,
                  {
                    backgroundColor: isDarkTheme ? "#111C2D" : "#F8FAFC",
                    borderColor: isDarkTheme ? "#334155" : "#E2E8F0",
                  },
                ]}
              >
                <View
                  style={[
                    styles.emailSentIcon,
                    {
                      backgroundColor: isDarkTheme ? "#1E293B" : "#EFF6FF",
                    },
                  ]}
                >
                  <Ionicons
                    name="mail-outline"
                    size={30}
                    color={isDarkTheme ? "#FACC15" : "#1E3A8A"}
                  />
                </View>

                <Text
                  style={[
                    styles.emailSentTitle,
                    {
                      color: isDarkTheme ? "#F8FAFC" : "#0F172A",
                    },
                  ]}
                >
                  Password reset email sent
                </Text>

                <Text
                  style={[
                    styles.emailSentDescription,
                    {
                      color: isDarkTheme ? "#94A3B8" : "#64748B",
                    },
                  ]}
                >
                  Check your inbox and follow the password reset link. You will
                  create your new password through the secure web portal.
                </Text>

                <Text
                  style={[
                    styles.emailSentEmail,
                    {
                      color: isDarkTheme ? "#FACC15" : "#1E3A8A",
                    },
                  ]}
                >
                  {forgotEmail}
                </Text>
              </View>

              <View
                style={[
                  styles.securityNotice,
                  {
                    backgroundColor: isDarkTheme ? "#172235" : "#EFF6FF",
                    borderColor: isDarkTheme ? "#334155" : "#BFDBFE",
                  },
                ]}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={22}
                  color={isDarkTheme ? "#FACC15" : "#1E3A8A"}
                />

                <Text
                  style={[
                    styles.securityNoticeText,
                    {
                      color: isDarkTheme ? "#CBD5E1" : "#475569",
                    },
                  ]}
                >
                  If you don't see the email, check your spam or junk folder.
                  The reset link may also take a few moments to arrive.
                </Text>
              </View>

              <PrimaryButton
                title="OPEN RESET WEBSITE"
                icon="open-outline"
                onPress={handleOpenResetWebsite}
                isDarkTheme={isDarkTheme}
              />

              <SecondaryButton
                title="Return to sign in"
                icon="arrow-back-outline"
                onPress={backToLogin}
                isDarkTheme={isDarkTheme}
              />
            </>
          )}
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* FOOTER                                                           */}
        {/* ---------------------------------------------------------------- */}

        <View style={styles.footer}>
          <View style={styles.footerSecurity}>
            <Ionicons
              name="shield-checkmark-outline"
              size={15}
              color={isDarkTheme ? "#64748B" : "#94A3B8"}
            />

            <Text
              style={[
                styles.footerText,
                {
                  color: isDarkTheme ? "#64748B" : "#94A3B8",
                },
              ]}
            >
              SECURE AUTHENTICATED ACCESS
            </Text>
          </View>

          <Text
            style={[
              styles.footerText,
              {
                color: isDarkTheme ? "#475569" : "#CBD5E1",
              },
            ]}
          >
            Project P.A.T.R.O.L
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

/* -------------------------------------------------------------------------- */
/*                                  STYLES                                    */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  pageContent: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 30,
  },

  topBar: {
    width: "100%",
    maxWidth: 520,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  themeButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  header: {
    width: "100%",
    maxWidth: 520,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 22,
  },

  logoWrapper: {
    width: 92,
    height: 105,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 7,
  },

  logo: {
    width: 88,
    height: 102,
  },

  organizationTitle: {
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: 1.8,
    textAlign: "center",
  },

  organizationSubtitle: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1.2,
    textAlign: "center",
    marginTop: 2,
  },

  versionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 11,
  },

  versionLine: {
    width: 22,
    height: 1,
    marginHorizontal: 8,
    opacity: 0.7,
  },

  versionText: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 1,
  },

  fullWidthSection: {
    width: "100%",
    maxWidth: 520,
    marginBottom: 12,
  },

  loginCard: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 20,
    borderWidth: 1,
    padding: 22,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 17,
  },

  cardHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 13,
  },

  cardTitle: {
    fontSize: 23,
    fontWeight: "900",
    letterSpacing: 0.3,
  },

  cardSubtitle: {
    fontSize: 15,
    lineHeight: 18,
    marginTop: 3,
  },

  divider: {
    height: 1,
    backgroundColor: "#334155",
    opacity: 0.25,
    marginBottom: 20,
  },

  fieldWrapper: {
    marginBottom: 16,
  },

  fieldLabel: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 7,
    letterSpacing: 0.2,
  },

  inputContainer: {
    height: 54,
    borderRadius: 13,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },

  inputIcon: {
    marginRight: 10,
  },

  textInput: {
    flex: 1,
    height: "100%",
    fontSize: 18,
    paddingVertical: 0,
  },

  eyeButton: {
    paddingLeft: 10,
    paddingVertical: 8,
  },

  forgotRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: -4,
    marginBottom: 20,
  },

  forgotText: {
    fontSize: 15,
    fontWeight: "800",
  },

  primaryButton: {
    height: 54,
    borderRadius: 13,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },

  primaryButtonText: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  secondaryButton: {
    height: 50,
    borderRadius: 13,
    borderWidth: 1,
    marginTop: 11,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },

  secondaryButtonText: {
    fontSize: 18,
    fontWeight: "700",
  },

  statusBox: {
    width: "100%",
    borderRadius: 13,
    borderWidth: 1,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },

  statusIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 11,
  },

  statusTitle: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.6,
    marginBottom: 3,
  },

  statusMessage: {
    fontSize: 13,
    lineHeight: 18,
  },

  screenHeader: {
    alignItems: "center",
    marginBottom: 20,
  },

  screenHeaderIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 11,
  },

  screenHeaderTitle: {
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.8,
    textAlign: "center",
  },

  screenHeaderSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 5,
    maxWidth: 380,
  },

  securityNotice: {
    borderRadius: 13,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },

  securityNoticeText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    lineHeight: 18,
  },

  otpLabel: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    textAlign: "center",
    marginBottom: 8,
    color: "#64748B",
  },

  otpInputContainer: {
    height: 72,
    borderRadius: 15,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },

  otpInput: {
    width: "100%",
    textAlign: "center",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 8,
    padding: 0,
  },

  otpStatusRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },

  setupStepBadge: {
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    marginBottom: 10,
  },

  setupDescription: {
    textAlign: "center",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },

  qrWrapper: {
    alignSelf: "center",
    padding: 10,
    borderRadius: 15,
    borderWidth: 1,
    marginBottom: 12,
  },

  qrCode: {
    width: 230,
    height: 230,
  },

  copyKeyButton: {
    alignSelf: "center",
    minHeight: 43,
    paddingHorizontal: 16,
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },

  loadingSetup: {
    height: 180,
    justifyContent: "center",
    alignItems: "center",
  },

  emailSentBox: {
    borderRadius: 15,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    marginBottom: 18,
  },

  emailSentIcon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 13,
  },

  emailSentTitle: {
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 8,
  },

  emailSentDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },

  emailSentEmail: {
    fontSize: 15,
    fontWeight: "800",
    marginTop: 10,
    textAlign: "center",
  },

  footer: {
    width: "100%",
    maxWidth: 520,
    alignItems: "center",
    marginTop: 20,
  },

  footerSecurity: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },

  footerText: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1,
    paddingLeft: 5,
  },

  backgroundCircle: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 1,
    top: 170,
    alignSelf: "center",
  },

  backgroundCircleLarge: {
    position: "absolute",
    width: 500,
    height: 500,
    borderRadius: 250,
    borderWidth: 1,
    top: 60,
    alignSelf: "center",
  },
});
