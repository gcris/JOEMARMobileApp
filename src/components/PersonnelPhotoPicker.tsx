import React, { useState } from "react";
import {
  View,
  Button,
  Image,
  ActivityIndicator,
  Text,
  StyleSheet,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { supabase } from "../services/supabase";

interface Props {
  personnelId: string;
  onPhotoUpdate?: (url: string) => void; // Called after photo is uploaded
  onPhotoSelected?: (uri: string) => void; // Callback when photo is selected but not yet uploaded
  uploadAfterSelect?: boolean; // If true, uploads immediately after selection
}

export const PersonnelPhotoPicker: React.FC<Props> = ({
  personnelId,
  onPhotoUpdate,
  onPhotoSelected,
  uploadAfterSelect = false,
}) => {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    // Request permissions if needed
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      alert("Permission to access camera roll is required!");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);

      // Notify parent that a photo was selected
      if (onPhotoSelected) {
        onPhotoSelected(result.assets[0].uri);
      }

      // If uploadAfterSelect is true, upload immediately after selection
      if (uploadAfterSelect) {
        await uploadPhoto();
      }
    }
  };

  const uploadPhoto = async () => {
    if (!imageUri) return;

    setUploading(true);
    try {
      // Resize/compress image for efficiency
      const resized = await manipulateAsync(
        imageUri,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: SaveFormat.JPEG },
      );

      // Convert URI to Blob using fetch
      const response = await fetch(resized.uri);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const blob = await response.blob();

      const fileName = `${personnelId}/${Date.now()}.jpg`;
      const { data, error } = await supabase.storage
        .from("personnel-photos")
        .upload(fileName, blob, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (error) throw error;

      const { data: urlData } = await supabase.storage
        .from("personnel-photos")
        .getPublicUrl(data.path);

      const photoUrl = urlData.publicUrl;

      // Update personnel record
      const { error: dbError } = await supabase
        .from("personnel")
        .update({ photo_url: photoUrl })
        .eq("id", personnelId);

      if (dbError) throw dbError;

      onPhotoUpdate?.(photoUrl);
    } catch (err) {
      console.error("Photo upload failed:", err);
      alert("Failed to upload photo. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.imagePreview} />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text style={styles.placeholderText}>No Photo</Text>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <Button title="Change Photo" onPress={pickImage} disabled={uploading} />
        {uploading && <ActivityIndicator size="small" color="#fff" />}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginVertical: 16,
  },
  imagePreview: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 12,
  },
  imagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  placeholderText: {
    color: "#fff",
    fontSize: 20,
  },
  buttonContainer: {
    width: "100%",
    alignItems: "center",
  },
});
