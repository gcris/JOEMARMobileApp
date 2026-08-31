import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Type definitions for component props
export interface CustomAlertProps {
  visible: boolean;
  title: string;
  message?: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  isDarkTheme?: boolean;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

export const CustomAlert: React.FC<CustomAlertProps> = ({
  visible,
  title,
  message,
  iconName = "alert-circle-outline",
  iconColor,
  isDarkTheme = true,
  confirmText = "OK",
  cancelText,
  onConfirm,
  onCancel,
}) => {
  const theme = {
    bg: isDarkTheme ? "#172235" : "#FFFFFF",
    cardBg: isDarkTheme ? "#0F172A" : "#F8FAFC",
    border: isDarkTheme ? "#334155" : "#E2E8F0",
    textPrimary: isDarkTheme ? "#F8FAFC" : "#0F172A",
    textSecondary: isDarkTheme ? "#94A3B8" : "#64748B",
    primaryBtn: isDarkTheme ? "#FACC15" : "#1E3A8A",
    primaryBtnText: isDarkTheme ? "#0F172A" : "#FFFFFF",
    cancelBtnBg: isDarkTheme ? "#1E293B" : "#F1F5F9",
  };

  const activeIconColor = iconColor || (isDarkTheme ? "#FACC15" : "#1E3A8A");

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel || onConfirm}
    >
      <TouchableWithoutFeedback onPress={onCancel || onConfirm}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.alertContainer,
                { backgroundColor: theme.bg, borderColor: theme.border },
              ]}
            >
              {/* Header Icon */}
              <View
                style={[styles.iconWrapper, { backgroundColor: theme.cardBg }]}
              >
                <Ionicons name={iconName} size={28} color={activeIconColor} />
              </View>

              {/* Text Content */}
              <Text style={[styles.title, { color: theme.textPrimary }]}>
                {title}
              </Text>
              {message ? (
                <Text style={[styles.message, { color: theme.textSecondary }]}>
                  {message}
                </Text>
              ) : null}

              {/* Action Buttons */}
              <View style={styles.buttonGroup}>
                {cancelText && (
                  <TouchableOpacity
                    style={[
                      styles.button,
                      { backgroundColor: theme.cancelBtnBg },
                    ]}
                    onPress={onCancel}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[styles.buttonText, { color: theme.textPrimary }]}
                    >
                      {cancelText}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.primaryButton,
                    { backgroundColor: theme.primaryBtn },
                  ]}
                  onPress={onConfirm}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      { color: theme.primaryBtnText, fontWeight: "700" },
                    ]}
                  >
                    {confirmText}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  alertContainer: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
  },
  iconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  buttonGroup: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButton: {
    elevation: 2,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
