import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Image,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Keyboard,
} from "react-native";
import { getStyles, getThemeColors } from "../theme/styles";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { supabase } from "../services/supabase";
import { getPersonnelById, savePersonnel } from "../services/database";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { decode } from "base64-arraybuffer";
import ChangePassword from "./ChangePassword";
import { CustomAlert, CustomAlertProps } from "../helper/CustomAlert";
type AlertOptions = Omit<CustomAlertProps, "visible"> & {
  visible: boolean;
};

interface AccountScreenProps {
  personnelId: string;
  isDarkTheme: boolean;
  onClose: () => void;
  refreshPersonnel?: () => Promise<void> | void;
}

export const AccountScreen = ({
  personnelId,
  isDarkTheme,
  onClose,
  refreshPersonnel,
}: AccountScreenProps) => {
  const colors = getThemeColors(isDarkTheme);

  const [personnel, setPersonnel] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Profile fields
  const [fullname, setFullname] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [viberNumber, setViberNumber] = useState("");
  const [badgeNumber, setBadgeNumber] = useState("");
  const [designation, setDesignation] = useState("");
  const [rank, setRank] = useState("");

  // Photo
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [oldPhotoUrl, setOldPhotoUrl] = useState<string | null>(null);
  const [isImagePickerVisible, setIsImagePickerVisible] = useState(false);

  const [showChangePassword, setShowChangePassword] = useState(false);

  const [focusedField, setFocusedField] = useState<string | null>(null);

  const theme = {
    background: isDarkTheme ? "#0B121F" : "#F8FAFC",
    card: isDarkTheme ? "#142035" : "#FFFFFF",
    cardSecondary: isDarkTheme ? "#1E293B" : "#F1F5F9",
    input: isDarkTheme ? "#0F172A" : "#F8FAFC",
    border: isDarkTheme ? "#263449" : "#E2E8F0",
    text: isDarkTheme ? "#F8FAFC" : "#0F172A",
    secondary: isDarkTheme ? "#94A3B8" : "#64748B",
    muted: isDarkTheme ? "#64748B" : "#94A3B8",
    primary: isDarkTheme ? "#FACC15" : "#1E3A8A",
    primaryText: isDarkTheme ? "#0B121F" : "#FFFFFF",
    success: "#10B981",
    danger: "#EF4444",
  };

  const [alertConfig, setAlertConfig] = useState<AlertOptions>({
    visible: false,
    title: "",
    onConfirm: () => {},
  });

  const handleShowAlert = (message: string) => {
    setAlertConfig({
      visible: true,
      title: "Account Settings",
      message: "Are you sure you want to log off from Duty Mode?",
      iconName: "log-out-outline",
      cancelText: "Cancel",
      confirmText: "End Duty",
      onConfirm: () => {
        setAlertConfig((prev) => ({ ...prev, visible: false }));
        // Execute shift end logic here
      },
      onCancel: () => {
        setAlertConfig((prev) => ({ ...prev, visible: false }));
      },
    });
  };

  // ---------------------------------------------------------------------------
  // LOAD PERSONNEL
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const loadPersonnel = async () => {
      try {
        setIsLoading(true);

        const personnelData = await getPersonnelById(personnelId);

        if (personnelData) {
          setPersonnel(personnelData);

          setFullname(personnelData.fullname || "");
          setPhoneNumber(personnelData.phoneNumber || "");
          setViberNumber(personnelData.viberNumber || "");
          setBadgeNumber(personnelData.badgeNumber || "");
          setDesignation(personnelData.designation || "");
          setRank(personnelData.rank?.description || "");

          setPhotoUrl(personnelData.photo_url || null);
          setOldPhotoUrl(personnelData.photo_url || null);
        }
      } catch (error) {
        console.error("Error loading personnel:", error);

        Alert.alert(
          "Unable to Load Profile",
          "We could not load your personnel information. Please try again.",
        );
      } finally {
        setIsLoading(false);
      }
    };

    if (personnelId) {
      loadPersonnel();
    }
  }, [personnelId]);

  // ---------------------------------------------------------------------------
  // PROFILE PHOTO
  // ---------------------------------------------------------------------------

  const handleImagePress = async () => {
    if (Platform.OS !== "web") {
      const permissionStatus =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionStatus.status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Please allow photo library access to change your profile picture.",
        );
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const localUri = result.assets[0].uri;

    setIsImagePickerVisible(true);

    try {
      const resized = await manipulateAsync(
        localUri,
        [{ resize: { width: 800 } }],
        {
          compress: 0.7,
          format: SaveFormat.JPEG,
        },
      );

      const base64Data = await FileSystem.readAsStringAsync(resized.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const arrayBuffer = decode(base64Data);

      const fileName = `${personnelId}/${Date.now()}.jpg`;

      const { data, error } = await supabase.storage
        .from("personnel-photos")
        .upload(fileName, arrayBuffer, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (error) {
        throw error;
      }

      const { data: urlData } = supabase.storage
        .from("personnel-photos")
        .getPublicUrl(data.path);

      const newPhotoUrl = urlData.publicUrl;

      // Delete old photo
      if (oldPhotoUrl) {
        try {
          const urlParts = oldPhotoUrl.split("/personnel-photos/");

          if (urlParts.length > 1) {
            const oldStoragePath = urlParts[1];

            await supabase.storage
              .from("personnel-photos")
              .remove([oldStoragePath]);
          }
        } catch (deleteError) {
          console.warn("Unable to delete old profile photo:", deleteError);
        }
      }

      // Update database
      const { error: dbError } = await supabase
        .from("personnel")
        .update({
          photo_url: newPhotoUrl,
        })
        .eq("id", personnelId);

      if (dbError) {
        throw dbError;
      }

      setPhotoUrl(newPhotoUrl);
      setOldPhotoUrl(newPhotoUrl);

      await refreshPersonnel?.();

      Alert.alert(
        "Profile Photo Updated",
        "Your profile picture has been successfully updated.",
      );
    } catch (uploadError) {
      console.error("Error uploading image:", uploadError);

      Alert.alert(
        "Upload Failed",
        "We could not update your profile picture. Please try again.",
      );
    } finally {
      setIsImagePickerVisible(false);
    }
  };

  // ---------------------------------------------------------------------------
  // SAVE PROFILE
  // ---------------------------------------------------------------------------

  const handleSave = async () => {
    if (!personnel) {
      return;
    }

    if (!fullname.trim()) {
      handleShowAlert("Please enter your full name before saving.");
      return;
    }

    setIsSaving(true);

    try {
      const updates = {
        fullname: fullname.trim(),
        phoneNumber: phoneNumber.trim(),
        viberNumber: viberNumber.trim(),
        badgeNumber: badgeNumber.trim(),
        designation: designation.trim(),
        photo_url: photoUrl,
      };

      await savePersonnel({
        ...personnel,
        ...updates,
      });

      await refreshPersonnel?.();

      Alert.alert(
        "Changes Saved",
        "Your personnel information has been updated successfully.",
      );
    } catch (error) {
      console.error("Error saving personnel:", error);

      Alert.alert(
        "Save Failed",
        "We could not save your changes. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // PROFILE FIELD
  // ---------------------------------------------------------------------------

  const ProfileField = ({
    label,
    icon,
    value,
    onChangeText,
    placeholder,
    editable = true,
    keyboardType,
    autoCapitalize,
  }: {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    value: string;
    onChangeText?: (value: string) => void;
    placeholder?: string;
    editable?: boolean;
    keyboardType?: any;
    autoCapitalize?: any;
  }) => {
    const fieldKey = label.toLowerCase();
    const focused = focusedField === fieldKey;

    return (
      <View style={{ marginBottom: 18 }}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: "700",
            color: theme.secondary,
            marginBottom: 7,
          }}
        >
          {label}
        </Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: editable ? theme.input : theme.cardSecondary,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: focused ? theme.primary : theme.border,
            minHeight: 52,
            paddingHorizontal: 14,
            opacity: editable ? 1 : 0.8,
          }}
        >
          <Ionicons
            name={icon}
            size={19}
            color={editable ? theme.primary : theme.muted}
            style={{ marginRight: 10 }}
          />

          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={theme.muted}
            editable={editable}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            onFocus={() => setFocusedField(fieldKey)}
            onBlur={() => setFocusedField(null)}
            style={{
              flex: 1,
              color: editable ? theme.text : theme.secondary,
              fontSize: 16,
              paddingVertical: 0,
            }}
          />

          {!editable && (
            <Ionicons
              name="lock-closed-outline"
              size={16}
              color={theme.muted}
            />
          )}
        </View>
      </View>
    );
  };

  // ---------------------------------------------------------------------------
  // LOADING
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={theme.primary} />

        <Text
          style={{
            marginTop: 14,
            color: theme.secondary,
            fontSize: 14,
          }}
        >
          Loading account...
        </Text>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // MAIN UI
  // ---------------------------------------------------------------------------

  return (
    <KeyboardAvoidingView
      style={{
        flex: 1,
        backgroundColor: theme.background,
      }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={{
          flex: 1,
          backgroundColor: theme.background,
        }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 40,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ================================================================ */}
        {/* HEADER */}
        {/* ================================================================ */}

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 18,
          }}
        >
          <TouchableOpacity
            onPress={onClose}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="chevron-back" size={23} color={theme.text} />
          </TouchableOpacity>

          <View
            style={{
              flex: 1,
              marginLeft: 13,
            }}
          >
            <Text
              style={{
                fontSize: 23,
                fontWeight: "800",
                color: theme.text,
              }}
            >
              My Account
            </Text>

            <Text
              style={{
                fontSize: 13,
                color: theme.secondary,
                marginTop: 2,
              }}
            >
              Manage your personnel profile
            </Text>
          </View>
        </View>

        {/* ================================================================ */}
        {/* PROFILE HEADER CARD */}
        {/* ================================================================ */}

        <View
          style={{
            backgroundColor: theme.card,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 20,
            marginBottom: 16,
            alignItems: "center",
          }}
        >
          {/* Profile Photo */}
          <View
            style={{
              position: "relative",
              marginBottom: 13,
            }}
          >
            {photoUrl ? (
              <Image
                source={{ uri: photoUrl }}
                style={{
                  width: 112,
                  height: 112,
                  borderRadius: 56,
                  borderWidth: 3,
                  borderColor: theme.primary,
                }}
              />
            ) : (
              <View
                style={{
                  width: 112,
                  height: 112,
                  borderRadius: 56,
                  backgroundColor: theme.cardSecondary,
                  borderWidth: 3,
                  borderColor: theme.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="person" size={54} color={theme.secondary} />
              </View>
            )}

            <TouchableOpacity
              onPress={handleImagePress}
              disabled={isImagePickerVisible}
              style={{
                position: "absolute",
                right: -2,
                bottom: 0,
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: theme.primary,
                borderWidth: 3,
                borderColor: theme.card,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isImagePickerVisible ? (
                <ActivityIndicator size="small" color={theme.primaryText} />
              ) : (
                <Ionicons name="camera" size={17} color={theme.primaryText} />
              )}
            </TouchableOpacity>
          </View>

          <Text
            style={{
              fontSize: 20,
              fontWeight: "800",
              color: theme.text,
              textAlign: "center",
            }}
          >
            {fullname || "Personnel"}
          </Text>

          <Text
            style={{
              fontSize: 14,
              color: theme.secondary,
              marginTop: 3,
              textAlign: "center",
            }}
          >
            {rank || "Rank not available"}
          </Text>

          {designation ? (
            <View
              style={{
                marginTop: 10,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
                backgroundColor: isDarkTheme
                  ? "rgba(250,204,21,0.10)"
                  : "#EFF6FF",
                borderWidth: 1,
                borderColor: isDarkTheme ? "rgba(250,204,21,0.25)" : "#DBEAFE",
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: theme.primary,
                }}
              >
                {designation}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={handleImagePress}
            disabled={isImagePickerVisible}
            style={{
              marginTop: 14,
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: theme.cardSecondary,
            }}
          >
            <Ionicons name="image-outline" size={17} color={theme.primary} />

            <Text
              style={{
                marginLeft: 7,
                color: theme.text,
                fontSize: 13,
                fontWeight: "700",
              }}
            >
              Change profile photo
            </Text>
          </TouchableOpacity>
        </View>

        {/* ================================================================ */}
        {/* PERSONAL INFORMATION */}
        {/* ================================================================ */}

        <View
          style={{
            backgroundColor: theme.card,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 18,
            marginBottom: 16,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 18,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: isDarkTheme
                  ? "rgba(250,204,21,0.12)"
                  : "#EFF6FF",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="person-outline" size={19} color={theme.primary} />
            </View>

            <View style={{ marginLeft: 10 }}>
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "800",
                  color: theme.text,
                }}
              >
                Personal Information
              </Text>

              <Text
                style={{
                  fontSize: 12,
                  color: theme.secondary,
                  marginTop: 2,
                }}
              >
                Update your contact details
              </Text>
            </View>
          </View>

          <ProfileField
            label="Rank"
            icon="shield-checkmark-outline"
            value={rank}
            editable={false}
          />

          <ProfileField
            label="Full Name"
            icon="person-outline"
            value={fullname}
            onChangeText={setFullname}
            placeholder="Enter your full name"
            autoCapitalize="words"
          />

          <ProfileField
            label="Badge Number"
            icon="card-outline"
            value={badgeNumber}
            onChangeText={setBadgeNumber}
            placeholder="Enter badge number"
            keyboardType="phone-pad"
          />

          <ProfileField
            label="Designation"
            icon="briefcase-outline"
            value={designation}
            onChangeText={setDesignation}
            placeholder="Enter designation"
          />

          <ProfileField
            label="Phone Number"
            icon="call-outline"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="Enter phone number"
            keyboardType="phone-pad"
          />

          <ProfileField
            label="Viber Number"
            icon="chatbubble-ellipses-outline"
            value={viberNumber}
            onChangeText={setViberNumber}
            placeholder="Enter Viber number"
            keyboardType="phone-pad"
          />
        </View>

        {/* ================================================================ */}
        {/* SECURITY */}
        {/* ================================================================ */}

        <View
          style={{
            backgroundColor: theme.card,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 18,
            marginBottom: 16,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: isDarkTheme
                  ? "rgba(16,185,129,0.12)"
                  : "#ECFDF5",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={19}
                color={theme.success}
              />
            </View>

            <View
              style={{
                flex: 1,
                marginLeft: 10,
              }}
            >
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "800",
                  color: theme.text,
                }}
              >
                Security
              </Text>

              <Text
                style={{
                  fontSize: 12,
                  color: theme.secondary,
                  marginTop: 2,
                }}
              >
                Manage your account credentials
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => setShowChangePassword(true)}
            activeOpacity={0.75}
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: theme.cardSecondary,
              borderRadius: 13,
              padding: 14,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: theme.card,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="key-outline" size={20} color={theme.primary} />
            </View>

            <View
              style={{
                flex: 1,
                marginLeft: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "700",
                  color: theme.text,
                }}
              >
                Change Password
              </Text>

              <Text
                style={{
                  fontSize: 12,
                  color: theme.secondary,
                  marginTop: 3,
                }}
              >
                Update your account password
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.secondary}
            />
          </TouchableOpacity>
        </View>

        {/* ================================================================ */}
        {/* SAVE */}
        {/* ================================================================ */}

        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.8}
          style={{
            height: 54,
            borderRadius: 13,
            backgroundColor: theme.primary,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            marginBottom: 12,
            opacity: isSaving ? 0.7 : 1,
          }}
        >
          {isSaving ? (
            <ActivityIndicator color={theme.primaryText} />
          ) : (
            <>
              <Ionicons
                name="save-outline"
                size={20}
                color={theme.primaryText}
              />

              <Text
                style={{
                  marginLeft: 8,
                  fontSize: 16,
                  fontWeight: "800",
                  color: theme.primaryText,
                }}
              >
                Save Changes
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* CANCEL */}
        <TouchableOpacity
          onPress={onClose}
          activeOpacity={0.7}
          style={{
            height: 48,
            borderRadius: 13,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.card,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: "700",
              color: theme.secondary,
            }}
          >
            Cancel
          </Text>
        </TouchableOpacity>

        {/* ================================================================ */}
        {/* CHANGE PASSWORD MODAL */}
        {/* ================================================================ */}

        <ChangePassword
          visible={showChangePassword}
          onClose={() => setShowChangePassword(false)}
          isDarkTheme={isDarkTheme}
          colors={colors}
          onSuccess={() => {
            // Optional:
            // refresh account data here if necessary
          }}
        />
      </ScrollView>
      <CustomAlert {...alertConfig} isDarkTheme={isDarkTheme} />
    </KeyboardAvoidingView>
  );
};
