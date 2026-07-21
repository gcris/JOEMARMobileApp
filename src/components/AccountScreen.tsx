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
} from "react-native";
import { getStyles, getThemeColors } from "../theme/styles";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { supabase } from "../services/supabase";
import { getPersonnelById, savePersonnel } from "../services/database";

// Fix: Removed the problematic import from '../../types'
// and replaced with proper navigation types
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { decode } from "base64-arraybuffer";

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
  const styles = getStyles(isDarkTheme);
  const colors = getThemeColors(isDarkTheme);

  const [personnel, setPersonnel] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form fields
  const [fullname, setFullname] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [viberNumber, setViberNumber] = useState<string>("");
  const [badgeNumber, setBadgeNumber] = useState<string>("");
  const [designation, setDesignation] = useState<string>("");
  const [rank, setRank] = useState<string>("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [oldPhotoUrl, setOldPhotoUrl] = useState<string | null>(null);
  const [isImagePickerVisible, setIsImagePickerVisible] =
    useState<boolean>(false);

  // Change Password fields
  const [currentPassword, setCurrentPassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmNewPassword, setConfirmNewPassword] = useState<string>("");
  const [showCurrentPassword, setShowCurrentPassword] =
    useState<boolean>(false);
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState<boolean>(false);
  const [showChangePassword, setShowChangePassword] = useState<boolean>(false);
  const [isChangingPassword, setIsChangingPassword] = useState<boolean>(false);
  // const { isSilentMode, toggleSilentMode } = usePatrolState();

  // Load personnel data
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
          setRank(personnelData.rank?.description || ""); // Add rank loading
          setPhotoUrl(personnelData.photo_url || null);
          setOldPhotoUrl(personnelData.photo_url || null);
        }
      } catch (error) {
        console.error("Error loading personnel:", error);
        Alert.alert("Error", "Failed to load personnel data");
      } finally {
        setIsLoading(false);
      }
    };

    if (personnelId) {
      loadPersonnel();
    }
  }, [personnelId]);

  const handleImagePress = async () => {
    // Request camera and media library permissions if needed
    if (Platform.OS !== "web") {
      const permissionStatus =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionStatus.status !== "granted") {
        Alert.alert(
          "Permission denied",
          "We need access to your photos to let you select a profile picture.",
        );
        return;
      }
    }

    // Launch image picker
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1], // Square aspect ratio for profile picture
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const localUri = result.assets[0].uri;
      setIsImagePickerVisible(true);

      // Upload the image to Supabase storage
      try {
        const resized = await manipulateAsync(
          localUri,
          [{ resize: { width: 800 } }],
          { compress: 0.7, format: SaveFormat.JPEG },
        );
        const base64Data = await FileSystem.readAsStringAsync(resized.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Generate a unique filename
        const arrayBuffer = decode(base64Data);
        const fileName = `${Date.now()}.jpg`;

        const { data, error } = await supabase.storage
          .from("personnel-photos")
          .upload(fileName, arrayBuffer, {
            contentType: "image/jpeg",
            upsert: true,
          });

        if (error) throw error;

        const { data: urlData } = await supabase.storage
          .from("personnel-photos")
          .getPublicUrl(data.path);

        if (oldPhotoUrl) {
          const urlParts = oldPhotoUrl.split("/personnel-photos/");
          if (urlParts.length > 1) {
            const oldStoragePath = urlParts[1];

            // Delete the old file from the storage bucket
            console.log(oldStoragePath);
            await supabase.storage
              .from("personnel-photos")
              .remove([oldStoragePath]);
          }
        }

        const photoUrl = urlData.publicUrl;

        // Update personnel record with photo URL
        const { error: dbError } = await supabase
          .from("personnel")
          .update({ photo_url: photoUrl })
          .eq("id", personnelId);

        if (dbError) throw dbError;

        // Update the photo URL
        setPhotoUrl(urlData.publicUrl);
        setOldPhotoUrl(urlData.publicUrl);

        await refreshPersonnel?.();
      } catch (uploadError) {
        console.error("Error uploading image:", uploadError);
        Alert.alert(
          "Error",
          "Failed to upload profile picture. Please try again.",
        );
      } finally {
        setIsImagePickerVisible(false);
      }
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      Alert.alert("Error", "Please fill in all password fields");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      Alert.alert("Error", "New password and confirmation do not match");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters long");
      return;
    }

    setIsChangingPassword(true);
    try {
      // Attempt to change password using Supabase auth
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw error;
      }

      Alert.alert("Success", "Password changed successfully");
      // Reset password fields
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setShowChangePassword(false);
    } catch (error) {
      console.error("Error changing password:", error);
      Alert.alert(
        "Error",
        "Failed to change password. Please check your current password and try again.",
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSave = async () => {
    if (!personnel) return;

    setIsSaving(true);
    try {
      // Prepare update data
      const updates = {
        fullname: fullname.trim(),
        phoneNumber: phoneNumber.trim(),
        viberNumber: viberNumber.trim(),
        badgeNumber: badgeNumber.trim(),
        designation: designation.trim(),
        photo_url: photoUrl, // This will be null if no photo selected, or the URL if a photo was uploaded
      };

      // Update in Supabase
      await savePersonnel({
        ...personnel,
        ...updates,
      });

      Alert.alert("Success", "Personnel information updated successfully");

      // Refresh personnel data to update the dashboard
      await refreshPersonnel?.();

      //onClose();
    } catch (error) {
      console.error("Error saving personnel:", error);
      Alert.alert("Error", "Failed to save personnel information");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator
          size="large"
          color={isDarkTheme ? colors.bgDark : colors.accentAmber}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { paddingHorizontal: 10, paddingTop: 5 }]}
      contentContainerStyle={{ paddingBottom: 30 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={{ marginBottom: 5 }}>
        <TouchableOpacity style={{ padding: 5 }} onPress={onClose}>
          <Ionicons
            name="chevron-back-outline"
            size={28}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
        <Text
          style={{
            fontSize: 24,
            fontWeight: "bold",
            textAlign: "center",
            color: colors.blackText,
            marginVertical: 10,
          }}
        >
          Account Settings
        </Text>
        <Text
          style={{
            fontSize: 14,
            textAlign: "center",
            color: colors.textSecondary,
            marginBottom: 5,
          }}
        >
          Edit your profile information
        </Text>
      </View>
      {/* Change Password Button */}
      <TouchableOpacity
        onPress={() => setShowChangePassword(true)}
        style={[styles.submitBtn, { marginHorizontal: 20, marginBottom: 10 }]}
      >
        <Text
          style={{
            fontSize: 22,
            fontWeight: "bold",
            color: isDarkTheme ? "#000000" : "#FFFFFF",
          }}
        >
          Change Password
        </Text>
      </TouchableOpacity>
      {/* Silent Mode Button */}
      {/* <TouchableOpacity
        onPress={toggleSilentMode}
        style={[styles.submitBtn, { marginHorizontal: 20, marginBottom: 10 }]}
      >
        <Text
          style={{
            fontSize: 22,
            fontWeight: "bold",
            color: isDarkTheme ? "#000000" : "#FFFFFF",
          }}
        > */}
      {/*isSilentMode ? "Disable Silent Mode" : "Enable Silent Mode"*/}
      {/* </Text>
      </TouchableOpacity> */}
      {/* Form Fields */}
      <View>
        {/* Profile Picture Section */}
        <View style={{ alignItems: "center" }}>
          {photoUrl ? (
            <Image
              source={{ uri: photoUrl }}
              style={{
                width: 100,
                height: 100,
                borderRadius: 50,
                borderWidth: 2,
                borderColor: colors.borderBlue,
              }}
            />
          ) : (
            <View
              style={{
                width: 100,
                height: 100,
                borderRadius: 50,
                backgroundColor: isDarkTheme ? "#1E293B" : "#F1F5F9",
                borderWidth: 2,
                borderColor: colors.borderBlue,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons
                name="person"
                size={50}
                color={isDarkTheme ? "white" : "black"}
              />
            </View>
          )}
          <TouchableOpacity
            onPress={handleImagePress}
            style={{
              marginTop: 10,
              paddingVertical: 5,
              paddingHorizontal: 15,
              backgroundColor: colors.accentAmber,
              borderRadius: 5,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: isDarkTheme ? "#000000" : "#FFFFFF",
              }}
            >
              Change Profile Photo
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: colors.blackText,
              marginBottom: 8,
            }}
          >
            Rank
          </Text>
          <TextInput
            style={[
              styles.input,
              { borderWidth: 1, borderColor: colors.borderBlue },
            ]}
            value={rank}
            onChangeText={setRank}
            placeholder="Enter your rank"
            editable={false} // Disabled/read-only
          />
        </View>

        {/* Full Name */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: colors.blackText,
              marginBottom: 8,
            }}
          >
            Full Name
          </Text>
          <TextInput
            style={[
              styles.input,
              { borderWidth: 1, borderColor: colors.borderBlue },
            ]}
            value={fullname}
            onChangeText={setFullname}
            placeholder="Enter your full name"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="words"
          />
        </View>

        {/* Badge Number */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: colors.blackText,
              marginBottom: 8,
            }}
          >
            Badge Number
          </Text>
          <TextInput
            style={[
              styles.input,
              { borderWidth: 1, borderColor: colors.borderBlue },
            ]}
            value={badgeNumber}
            onChangeText={setBadgeNumber}
            placeholder="Enter your badge number"
            placeholderTextColor={colors.textSecondary}
            keyboardType="phone-pad"
          />
        </View>

        {/* Designation */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: colors.blackText,
              marginBottom: 8,
            }}
          >
            Designation
          </Text>
          <TextInput
            style={[
              styles.input,
              { borderWidth: 1, borderColor: colors.borderBlue },
            ]}
            value={designation}
            onChangeText={setDesignation}
            placeholder="Enter your designation"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        {/* Phone Number */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: colors.blackText,
              marginBottom: 8,
            }}
          >
            Phone Number
          </Text>
          <TextInput
            style={[
              styles.input,
              { borderWidth: 1, borderColor: colors.borderBlue },
            ]}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="Enter your phone number"
            placeholderTextColor={colors.textSecondary}
            keyboardType="phone-pad"
          />
        </View>

        {/* Viber Number */}
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: colors.blackText,
              marginBottom: 8,
            }}
          >
            Viber Number
          </Text>
          <TextInput
            style={[
              styles.input,
              { borderWidth: 1, borderColor: colors.borderBlue },
            ]}
            value={viberNumber}
            onChangeText={setViberNumber}
            placeholder="Enter your Viber number"
            placeholderTextColor={colors.textSecondary}
            keyboardType="phone-pad"
          />
        </View>
      </View>
      {/* Save Button */}
      {/* FIXED: Changed from styles.buttonPrimary to styles.submitBtn (which exists) */}
      <TouchableOpacity
        style={[
          styles.submitBtn, // Changed from styles.buttonPrimary to styles.submitBtn
          { marginHorizontal: 20, marginBottom: 20 },
        ]}
        onPress={handleSave}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Text
            style={{
              fontSize: 20,
              fontWeight: "bold",
              color: isDarkTheme ? "#000000" : "#FFFFFF",
            }}
          >
            Save Changes
          </Text>
        )}
      </TouchableOpacity>
      {/* Cancel Button */}
      <TouchableOpacity style={{ marginHorizontal: 20 }} onPress={onClose}>
        <Text
          style={{
            fontSize: 20,
            color: !isDarkTheme ? "#000000" : "#FFFFFF",
            textAlign: "center",
            fontWeight: "600",
          }}
        >
          Cancel
        </Text>
      </TouchableOpacity>
      {/* Change Password Modal */}
      {showChangePassword && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <View
            style={{
              backgroundColor: isDarkTheme ? "#1E293B" : "#FFFFFF",
              padding: 24,
              borderRadius: 12,
              width: "100%",
              maxWidth: 400,
            }}
          >
            <Text
              style={{
                fontSize: 20,
                fontWeight: "bold",
                marginBottom: 24,
                color: isDarkTheme ? "#FFFFFF" : "#1E293B",
              }}
            >
              Change Password
            </Text>
            {/* Current Password */}
            <View style={{ marginBottom: 16 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  marginBottom: 8,
                  color: isDarkTheme ? "#FFFFFF" : "#1E293B",
                }}
              >
                Current Password
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <TextInput
                  style={[
                    styles.input,
                    { borderWidth: 1, borderColor: colors.borderBlue, flex: 1 },
                  ]}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter your current password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry={!showCurrentPassword}
                />
                <TouchableOpacity
                  style={[styles.inputPasswordToggle, { padding: 10 }]}
                  onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? (
                    <Ionicons
                      name="eye-off"
                      size={24}
                      color={isDarkTheme ? "#FFFFFF" : "#000000"}
                    />
                  ) : (
                    <Ionicons
                      name="eye"
                      size={24}
                      color={isDarkTheme ? "#FFFFFF" : "#000000"}
                    />
                  )}
                </TouchableOpacity>
              </View>
            </View>
            {/* New Password */}
            <View style={{ marginBottom: 16 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  marginBottom: 8,
                  color: isDarkTheme ? "#FFFFFF" : "#1E293B",
                }}
              >
                New Password
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <TextInput
                  style={[
                    styles.input,
                    { borderWidth: 1, borderColor: colors.borderBlue, flex: 1 },
                  ]}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter your new password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry={!showNewPassword}
                />
                <TouchableOpacity
                  style={[styles.inputPasswordToggle, { padding: 10 }]}
                  onPress={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? (
                    <Ionicons
                      name="eye-off"
                      size={24}
                      color={isDarkTheme ? "#FFFFFF" : "#000000"}
                    />
                  ) : (
                    <Ionicons
                      name="eye"
                      size={24}
                      color={isDarkTheme ? "#FFFFFF" : "#000000"}
                    />
                  )}
                </TouchableOpacity>
              </View>
            </View>
            {/* Confirm New Password */}
            <View style={{ marginBottom: 24 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  marginBottom: 8,
                  color: isDarkTheme ? "#FFFFFF" : "#1E293B",
                }}
              >
                Confirm New Password
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <TextInput
                  style={[
                    styles.input,
                    { borderWidth: 1, borderColor: colors.borderBlue, flex: 1 },
                  ]}
                  value={confirmNewPassword}
                  onChangeText={setConfirmNewPassword}
                  placeholder="Confirm your new password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry={!showConfirmPassword}
                />
                <TouchableOpacity
                  style={[styles.inputPasswordToggle, { padding: 10 }]}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <Ionicons
                      name="eye-off"
                      size={24}
                      color={isDarkTheme ? "#FFFFFF" : "#000000"}
                    />
                  ) : (
                    <Ionicons
                      name="eye"
                      size={24}
                      color={isDarkTheme ? "#FFFFFF" : "#000000"}
                    />
                  )}
                </TouchableOpacity>
              </View>
            </View>
            {/* Change Password Button */}
            <TouchableOpacity
              onPress={handleChangePassword}
              style={[
                styles.submitBtn,
                { marginHorizontal: 0, marginBottom: 16 },
              ]}
              disabled={isChangingPassword}
            >
              {isChangingPassword ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: "bold",
                    color: isDarkTheme ? "#000000" : "#FFFFFF",
                  }}
                >
                  Confirm
                </Text>
              )}
            </TouchableOpacity>
            {/* Cancel Button */}
            <TouchableOpacity
              onPress={() => setShowChangePassword(false)}
              style={{ marginHorizontal: 0 }}
            >
              <Text
                style={{
                  fontSize: 20,
                  color: !isDarkTheme ? "#000000" : "#FFFFFF",
                  textAlign: "center",
                  fontWeight: "600",
                }}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
};
