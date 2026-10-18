import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { supabase } from "../services/supabase";

interface ChangePasswordProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  isDarkTheme: boolean;
  colors: {
    accentAmber: string;
    borderBlue: string;
    textSecondary: string;
  };
}

const ChangePassword = ({
  visible,
  onClose,
  onSuccess,
  isDarkTheme,
  colors,
}: ChangePasswordProps) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isChangingPassword, setIsChangingPassword] = useState(false);

  /*
   * Reset all fields whenever the modal is opened.
   */
  useEffect(() => {
    if (visible) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");

      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);

      setIsChangingPassword(false);
    }
  }, [visible]);

  const closeModal = () => {
    if (isChangingPassword) {
      return;
    }

    Keyboard.dismiss();

    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");

    onClose();
  };

  const handleChangePassword = async () => {
    Keyboard.dismiss();

    const current = currentPassword;
    const newPass = newPassword;
    const confirmPass = confirmNewPassword;

    /*
     * ---------------------------------------------------------------
     * VALIDATION
     * ---------------------------------------------------------------
     */

    if (!current) {
      Alert.alert(
        "Current Password Required",
        "Please enter your current password.",
      );
      return;
    }

    if (!newPass) {
      Alert.alert("New Password Required", "Please enter your new password.");
      return;
    }

    if (newPass.length < 6) {
      Alert.alert(
        "Invalid Password",
        "Your new password must be at least 6 characters long.",
      );
      return;
    }

    if (!confirmPass) {
      Alert.alert("Confirm Password", "Please confirm your new password.");
      return;
    }

    if (newPass !== confirmPass) {
      Alert.alert(
        "Passwords Do Not Match",
        "The new password and confirmation password do not match.",
      );
      return;
    }

    /*
     * Prevent using exactly the same password.
     */
    if (current === newPass) {
      Alert.alert(
        "Invalid Password",
        "Your new password must be different from your current password.",
      );
      return;
    }

    setIsChangingPassword(true);

    try {
      /*
       * ---------------------------------------------------------------
       * GET CURRENT USER
       * ---------------------------------------------------------------
       */

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error("No authenticated user was found.");
      }

      /*
       * ---------------------------------------------------------------
       * UPDATE PASSWORD
       * ---------------------------------------------------------------
       *
       * Secure Password Change requires the current password.
       *
       * This is the important part:
       *
       * current_password: current
       * password: newPass
       *
       * Do NOT use:
       *
       * supabase.auth.updateUser({
       *   password: newPass
       * })
       *
       * because your Supabase project requires the current password.
       */

      const { error } = await supabase.auth.updateUser({
        password: newPass,
        current_password: current,
      });

      if (error) {
        console.error("Supabase password update error:", error);

        /*
         * Convert common Supabase errors into user-friendly messages.
         */
        const message = error.message?.toLowerCase() ?? "";

        if (
          message.includes("current password") ||
          message.includes("password is incorrect") ||
          message.includes("invalid login credentials")
        ) {
          Alert.alert(
            "Incorrect Current Password",
            "The current password you entered is incorrect.",
          );
        } else if (message.includes("password") && message.includes("weak")) {
          Alert.alert("Weak Password", "Please choose a stronger password.");
        } else {
          Alert.alert(
            "Password Change Failed",
            error.message || "Unable to change your password.",
          );
        }

        return;
      }

      /*
       * ---------------------------------------------------------------
       * SUCCESS
       * ---------------------------------------------------------------
       */

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");

      Keyboard.dismiss();

      Alert.alert(
        "Password Changed",
        "Your password has been changed successfully.",
        [
          {
            text: "OK",
            onPress: () => {
              onClose();
              onSuccess?.();
            },
          },
        ],
      );
    } catch (error: any) {
      console.error("Change password error:", error);

      Alert.alert(
        "Password Change Failed",
        error?.message || "Unable to change your password. Please try again.",
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  const passwordIsValid = newPassword.length >= 6;
  const passwordsMatch =
    newPassword.length > 0 &&
    confirmNewPassword.length > 0 &&
    newPassword === confirmNewPassword;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={closeModal}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.55)",
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 420,
            maxHeight: "90%",
            backgroundColor: isDarkTheme ? "#1E293B" : "#FFFFFF",
            borderRadius: 20,
            overflow: "hidden",

            elevation: 10,
            shadowColor: "#000",
            shadowOffset: {
              width: 0,
              height: 5,
            },
            shadowOpacity: 0.25,
            shadowRadius: 10,
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              padding: 24,
            }}
          >
            {/* ========================================================= */}
            {/* HEADER                                                     */}
            {/* ========================================================= */}

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 24,
              }}
            >
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  backgroundColor: isDarkTheme
                    ? "rgba(245,158,11,0.15)"
                    : "#FEF3C7",
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: 14,
                }}
              >
                <Ionicons
                  name="lock-closed"
                  size={23}
                  color={colors.accentAmber}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 21,
                    fontWeight: "700",
                    color: isDarkTheme ? "#FFFFFF" : "#0F172A",
                  }}
                >
                  Change Password
                </Text>

                <Text
                  style={{
                    fontSize: 16,
                    marginTop: 3,
                    color: colors.textSecondary,
                  }}
                >
                  Create a new password for your account
                </Text>
              </View>

              <TouchableOpacity
                onPress={closeModal}
                disabled={isChangingPassword}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: isDarkTheme ? "#334155" : "#F1F5F9",
                }}
              >
                <Ionicons
                  name="close"
                  size={22}
                  color={isDarkTheme ? "#FFFFFF" : "#475569"}
                />
              </TouchableOpacity>
            </View>

            {/* ========================================================= */}
            {/* CURRENT PASSWORD                                           */}
            {/* ========================================================= */}

            <View style={{ marginBottom: 16 }}>
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "600",
                  marginBottom: 7,
                  color: isDarkTheme ? "#FFFFFF" : "#1E293B",
                }}
              >
                Current Password
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.borderBlue,
                  borderRadius: 10,
                  backgroundColor: isDarkTheme ? "#0F172A" : "#FFFFFF",
                }}
              >
                <Ionicons
                  name="key-outline"
                  size={20}
                  color={colors.textSecondary}
                  style={{ marginLeft: 12 }}
                />

                <TextInput
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter current password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry={!showCurrentPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  autoComplete="password"
                  returnKeyType="next"
                  editable={!isChangingPassword}
                  style={{
                    flex: 1,
                    height: 50,
                    paddingHorizontal: 12,
                    color: isDarkTheme ? "#FFFFFF" : "#0F172A",
                    fontSize: 20,
                  }}
                />

                <TouchableOpacity
                  onPress={() => setShowCurrentPassword((prev) => !prev)}
                  disabled={isChangingPassword}
                  style={{
                    paddingHorizontal: 12,
                    height: 50,
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name={showCurrentPassword ? "eye-off" : "eye"}
                    size={22}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* ========================================================= */}
            {/* NEW PASSWORD                                               */}
            {/* ========================================================= */}

            <View style={{ marginBottom: 16 }}>
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "600",
                  marginBottom: 7,
                  color: isDarkTheme ? "#FFFFFF" : "#1E293B",
                }}
              >
                New Password
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor:
                    newPassword.length > 0
                      ? passwordIsValid
                        ? "#22C55E"
                        : "#EF4444"
                      : colors.borderBlue,
                  borderRadius: 10,
                  backgroundColor: isDarkTheme ? "#0F172A" : "#FFFFFF",
                }}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={colors.textSecondary}
                  style={{ marginLeft: 12 }}
                />

                <TextInput
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry={!showNewPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="newPassword"
                  autoComplete="new-password"
                  returnKeyType="next"
                  editable={!isChangingPassword}
                  style={{
                    flex: 1,
                    height: 50,
                    paddingHorizontal: 12,
                    color: isDarkTheme ? "#FFFFFF" : "#0F172A",
                    fontSize: 20,
                  }}
                />

                <TouchableOpacity
                  onPress={() => setShowNewPassword((prev) => !prev)}
                  disabled={isChangingPassword}
                  style={{
                    paddingHorizontal: 12,
                    height: 50,
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name={showNewPassword ? "eye-off" : "eye"}
                    size={22}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* ========================================================= */}
            {/* CONFIRM PASSWORD                                           */}
            {/* ========================================================= */}

            <View style={{ marginBottom: 22 }}>
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "600",
                  marginBottom: 7,
                  color: isDarkTheme ? "#FFFFFF" : "#1E293B",
                }}
              >
                Confirm New Password
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor:
                    confirmNewPassword.length > 0
                      ? passwordsMatch
                        ? "#22C55E"
                        : "#EF4444"
                      : colors.borderBlue,
                  borderRadius: 10,
                  backgroundColor: isDarkTheme ? "#0F172A" : "#FFFFFF",
                }}
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={20}
                  color={colors.textSecondary}
                  style={{ marginLeft: 12 }}
                />

                <TextInput
                  value={confirmNewPassword}
                  onChangeText={setConfirmNewPassword}
                  placeholder="Confirm new password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="newPassword"
                  autoComplete="new-password"
                  returnKeyType="done"
                  editable={!isChangingPassword}
                  onSubmitEditing={handleChangePassword}
                  style={{
                    flex: 1,
                    height: 50,
                    paddingHorizontal: 12,
                    color: isDarkTheme ? "#FFFFFF" : "#0F172A",
                    fontSize: 20,
                  }}
                />

                <TouchableOpacity
                  onPress={() => setShowConfirmPassword((prev) => !prev)}
                  disabled={isChangingPassword}
                  style={{
                    paddingHorizontal: 12,
                    height: 50,
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name={showConfirmPassword ? "eye-off" : "eye"}
                    size={22}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* ========================================================= */}
            {/* PASSWORD REQUIREMENTS                                       */}
            {/* ========================================================= */}

            <View
              style={{
                backgroundColor: isDarkTheme ? "#0F172A" : "#F8FAFC",
                borderRadius: 10,
                padding: 12,
                marginBottom: 20,
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: isDarkTheme ? "#CBD5E1" : "#475569",
                  marginBottom: 7,
                }}
              >
                Password requirements
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                <Ionicons
                  name={
                    passwordIsValid ? "checkmark-circle" : "ellipse-outline"
                  }
                  size={16}
                  color={passwordIsValid ? "#22C55E" : colors.textSecondary}
                />

                <Text
                  style={{
                    marginLeft: 6,
                    fontSize: 16,
                    color: colors.textSecondary,
                  }}
                >
                  At least 6 characters
                </Text>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <Ionicons
                  name={passwordsMatch ? "checkmark-circle" : "ellipse-outline"}
                  size={16}
                  color={passwordsMatch ? "#22C55E" : colors.textSecondary}
                />

                <Text
                  style={{
                    marginLeft: 6,
                    fontSize: 16,
                    color: colors.textSecondary,
                  }}
                >
                  Passwords match
                </Text>
              </View>
            </View>

            {/* ========================================================= */}
            {/* CHANGE PASSWORD BUTTON                                     */}
            {/* ========================================================= */}

            <TouchableOpacity
              onPress={handleChangePassword}
              disabled={isChangingPassword}
              activeOpacity={0.8}
              style={{
                height: 52,
                borderRadius: 10,
                backgroundColor: colors.accentAmber,
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 10,
                opacity: isChangingPassword ? 0.7 : 1,
              }}
            >
              {isChangingPassword ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <ActivityIndicator
                    size="small"
                    color={isDarkTheme ? "#000000" : "#FFFFFF"}
                  />

                  <Text
                    style={{
                      marginLeft: 8,
                      fontSize: 16,
                      fontWeight: "700",
                      color: isDarkTheme ? "#000000" : "#FFFFFF",
                    }}
                  >
                    Changing Password...
                  </Text>
                </View>
              ) : (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <Ionicons
                    name="save-outline"
                    size={20}
                    color={isDarkTheme ? "#000000" : "#FFFFFF"}
                  />

                  <Text
                    style={{
                      fontSize: 17,
                      fontWeight: "700",
                      marginLeft: 8,
                      color: isDarkTheme ? "#000000" : "#FFFFFF",
                    }}
                  >
                    Change Password
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* ========================================================= */}
            {/* CANCEL                                                     */}
            {/* ========================================================= */}

            <TouchableOpacity
              onPress={closeModal}
              disabled={isChangingPassword}
              style={{
                height: 45,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "600",
                  color: colors.textSecondary,
                }}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default ChangePassword;
