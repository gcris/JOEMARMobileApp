import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as FileSystem from "expo-file-system";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { Ionicons } from "@expo/vector-icons";
import { captureRef } from "react-native-view-shot";
import piexif from "piexifjs";
import { supabase } from "../services/supabase";

const MAX_PHOTOS = 3;
const MAX_IMAGE_SIZE = 1280;
const IMAGE_QUALITY = 0.9;

const STAMP_TEXT = "#FFFFFF";
const STAMP_ACCENT = "#FACC15";

interface PatrolSummaryScreenProps {
  isDarkTheme: boolean;

  personnelId: string;
  unitId: string;

  personnelName?: string;
  personnelRank?: string;
}

interface SelectedPhoto {
  id: string;
  uri: string;
  width?: number;
  height?: number;

  latitude?: number;
  longitude?: number;
  accuracy?: number;

  capturedAt?: string;
}

interface PatrolSummaryRecord {
  id: string;
  personnel_id: string | null;
  summary: string | null;
  submitted_at: string | null;
  unit_id: string | null;
  photos: {
    id: string;
    photo_path: string;
    photo_order: number | null;
  }[];
}

interface GpsLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

/**
 * Convert decimal degrees to EXIF DMS.
 */
const decimalToDms = (
  decimal: number,
): [[number, number], [number, number], [number, number]] => {
  const absolute = Math.abs(decimal);

  const degrees = Math.floor(absolute);

  const minutesFloat = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesFloat);

  const seconds = (minutesFloat - minutes) * 60;

  return [
    [degrees, 1],
    [minutes, 1],
    [Math.round(seconds * 10000), 10000],
  ];
};

/**
 * Get the current phone GPS location.
 */
const getCurrentPhotoLocation = async (): Promise<GpsLocation | null> => {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();

    if (permission.status !== Location.PermissionStatus.GRANTED) {
      Alert.alert(
        "Location Permission Required",
        "Location permission is required to embed GPS information in patrol photos.",
      );

      return null;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    const latitude = location.coords.latitude;
    const longitude = location.coords.longitude;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error("Invalid GPS coordinates.");
    }

    return {
      latitude,
      longitude,
      accuracy:
        typeof location.coords.accuracy === "number"
          ? location.coords.accuracy
          : undefined,
    };
  } catch (error) {
    console.error("GPS acquisition error:", error);

    Alert.alert(
      "Unable to Get GPS",
      "The current GPS location could not be obtained. Please make sure Location is enabled and try again.",
    );

    return null;
  }
};

/**
 * Add GPS information to the final JPEG EXIF.
 *
 * IMPORTANT:
 * This runs AFTER the visible patrol stamp has already
 * been rendered into the JPEG.
 */
const embedGpsIntoJpeg = async (
  uri: string,
  latitude: number,
  longitude: number,
): Promise<string> => {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const jpegData = `data:image/jpeg;base64,${base64}`;

    let exifObj: any;

    try {
      exifObj = piexif.load(jpegData);
    } catch {
      exifObj = {
        "0th": {},
        Exif: {},
        GPS: {},
        Interop: {},
        "1st": {},
        thumbnail: null,
      };
    }

    exifObj.GPS = exifObj.GPS || {};

    exifObj.GPS[piexif.GPSIFD.GPSLatitudeRef] = latitude >= 0 ? "N" : "S";

    exifObj.GPS[piexif.GPSIFD.GPSLatitude] = decimalToDms(latitude);

    exifObj.GPS[piexif.GPSIFD.GPSLongitudeRef] = longitude >= 0 ? "E" : "W";

    exifObj.GPS[piexif.GPSIFD.GPSLongitude] = decimalToDms(longitude);

    exifObj.GPS[piexif.GPSIFD.GPSVersionID] = [2, 3, 0, 0];

    const exifBytes = piexif.dump(exifObj);

    const newJpegData = piexif.insert(exifBytes, jpegData);

    const outputUri =
      `${FileSystem.cacheDirectory}` +
      `patrol-gps-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

    const outputBase64 = newJpegData.split(",")[1];

    await FileSystem.writeAsStringAsync(outputUri, outputBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return outputUri;
  } catch (error) {
    console.error("Failed to embed GPS EXIF:", error);

    throw new Error("Unable to embed GPS information into the patrol photo.");
  }
};

/**
 * Format GPS for the visible patrol stamp.
 */
const formatCoordinate = (value: number): string => {
  return value.toFixed(6);
};

/**
 * Format date/time for the visible stamp.
 */
const formatStampDate = (
  isoDate: string,
): {
  date: string;
  time: string;
} => {
  const date = new Date(isoDate);

  return {
    date: date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }),

    time: date.toLocaleTimeString("en-PH", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }),
  };
};

const truncateSummary = (text: string | null | undefined, maxLength = 100) => {
  if (!text) return "";

  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
};

export default function PatrolSummaryScreen({
  isDarkTheme,
  personnelId,
  unitId,
  personnelName,
  personnelRank,
}: PatrolSummaryScreenProps) {
  const theme = useMemo(
    () => ({
      background: isDarkTheme ? "#080F1C" : "#F8FAFC",

      surface: isDarkTheme ? "#101B2D" : "#FFFFFF",

      surfaceSecondary: isDarkTheme ? "#172235" : "#F8FAFC",

      textPrimary: isDarkTheme ? "#F8FAFC" : "#0F172A",

      textSecondary: isDarkTheme ? "#94A3B8" : "#64748B",

      textMuted: isDarkTheme ? "#64748B" : "#94A3B8",

      border: isDarkTheme ? "#26354A" : "#E2E8F0",

      blue: isDarkTheme ? "#60A5FA" : "#2563EB",

      blueLight: isDarkTheme ? "#172B46" : "#EFF6FF",

      blueText: isDarkTheme ? "#93C5FD" : "#1D4ED8",

      green: isDarkTheme ? "#4ADE80" : "#16A34A",

      greenLight: isDarkTheme ? "#123322" : "#F0FDF4",

      red: isDarkTheme ? "#F87171" : "#DC2626",

      redLight: isDarkTheme ? "#35191D" : "#FEF2F2",

      orange: isDarkTheme ? "#FBBF24" : "#D97706",

      orangeLight: isDarkTheme ? "#352A12" : "#FFFBEB",

      iconBackground: isDarkTheme ? "#172B46" : "#EFF6FF",

      inputBackground: isDarkTheme ? "#0D1727" : "#FFFFFF",

      modalOverlay: isDarkTheme
        ? "rgba(0, 0, 0, 0.72)"
        : "rgba(15, 23, 42, 0.48)",
    }),
    [isDarkTheme],
  );

  const styles = useMemo(() => getStyles(isDarkTheme), [isDarkTheme]);

  const [summary, setSummary] = useState("");

  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const [permissionDenied, setPermissionDenied] = useState(false);

  const [recentSummaries, setRecentSummaries] = useState<PatrolSummaryRecord[]>(
    [],
  );

  const [isLoadingSummaries, setIsLoadingSummaries] = useState(false);

  const [selectedSummary, setSelectedSummary] =
    useState<PatrolSummaryRecord | null>(null);

  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(
    null,
  );

  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  const [isLoadingPhotoUrls, setIsLoadingPhotoUrls] = useState(false);

  const [isAddSummaryModalVisible, setIsAddSummaryModalVisible] =
    useState(false);

  /**
   * Hidden image/stamp composition view.
   *
   * This is rendered only when a photo is being prepared.
   */
  const stampViewRef = useRef<View>(null);
  const stampImageLoadResolver = useRef<(() => void) | null>(null);

  const MAPBOX_API_KEY = process.env.MAPBOX_API_KEY ?? "";
  const stampLoadResolver = useRef<(() => void) | null>(null);
  const stampLoadsPending = useRef(0);

  const [stampPhoto, setStampPhoto] = useState<{
    uri: string;
    mapUri: string | null;
    width: number;
    height: number;
    latitude: number;
    longitude: number;
    accuracy?: number;
    capturedAt: string;
  } | null>(null);

  useEffect(() => {
    loadRecentSummaries();
  }, [personnelId]);

  const loadRecentSummaries = async () => {
    if (!personnelId) {
      setRecentSummaries([]);
      return;
    }

    try {
      setIsLoadingSummaries(true);

      const now = new Date();

      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        0,
        0,
        0,
        0,
      );

      const yesterdayStart = new Date(todayStart);

      yesterdayStart.setDate(yesterdayStart.getDate() - 1);

      const tomorrowStart = new Date(todayStart);

      tomorrowStart.setDate(tomorrowStart.getDate() + 1);

      const { data, error } = await supabase
        .from("patrol_summaries")
        .select(
          `
              id,
              personnel_id,
              summary,
              submitted_at,
              unit_id,
              patrol_summary_photos (
                id,
                photo_path,
                photo_order
              )
            `,
        )
        .eq("personnel_id", personnelId)
        .gte("submitted_at", yesterdayStart.toISOString())
        .lt("submitted_at", tomorrowStart.toISOString())
        .order("submitted_at", {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      const mapped: PatrolSummaryRecord[] = (data ?? []).map((item: any) => ({
        id: item.id,
        personnel_id: item.personnel_id,
        summary: item.summary,
        submitted_at: item.submitted_at,
        unit_id: item.unit_id,

        photos: (item.patrol_summary_photos ?? []).sort(
          (a: any, b: any) => (a.photo_order ?? 999) - (b.photo_order ?? 999),
        ),
      }));

      setRecentSummaries(mapped);
    } catch (error) {
      console.error("Failed to load patrol summaries:", error);

      setRecentSummaries([]);
    } finally {
      setIsLoadingSummaries(false);
    }
  };

  const loadPhotoUrls = async (summary: PatrolSummaryRecord) => {
    if (!summary.photos.length) {
      setPhotoUrls({});
      return;
    }

    try {
      setIsLoadingPhotoUrls(true);

      const entries = await Promise.all(
        summary.photos.map(async (photo) => {
          const { data, error } = await supabase.storage
            .from("patrol-summary-proofs")
            .createSignedUrl(photo.photo_path, 60 * 60);

          if (error || !data?.signedUrl) {
            console.error(
              "Failed to create signed URL:",
              photo.photo_path,
              error,
            );

            return [photo.id, ""] as const;
          }

          return [photo.id, data.signedUrl] as const;
        }),
      );

      setPhotoUrls(Object.fromEntries(entries));
    } catch (error) {
      console.error("Failed to load patrol summary photos:", error);

      setPhotoUrls({});
    } finally {
      setIsLoadingPhotoUrls(false);
    }
  };

  const openSummary = async (summary: PatrolSummaryRecord) => {
    setSelectedSummary(summary);
    setSelectedPhotoIndex(null);
    setPhotoUrls({});

    if (summary.photos.length > 0) {
      await loadPhotoUrls(summary);
    }
  };

  // ============================================================
  // Pick Photos
  // ============================================================

  const pickPhotos = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert(
        "Maximum Photos",
        `You can upload a maximum of ${MAX_PHOTOS} photos.`,
      );

      return;
    }

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setPermissionDenied(true);

        Alert.alert(
          "Photo Permission Required",
          "Please allow photo access so you can attach patrol photos.",
        );

        return;
      }

      /**
       * Get the current location when the
       * gallery selection is made.
       *
       * This is NOT the historical location
       * where the original gallery photo was taken.
       */
      const gps = await getCurrentPhotoLocation();

      if (!gps) {
        return;
      }

      const remaining = MAX_PHOTOS - photos.length;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,

        allowsMultipleSelection: remaining > 1,

        selectionLimit: remaining,

        quality: 1,

        exif: false,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const capturedAt = new Date().toISOString();

      const newPhotos: SelectedPhoto[] = [];

      for (const asset of result.assets) {
        if (photos.length + newPhotos.length >= MAX_PHOTOS) {
          break;
        }

        newPhotos.push({
          id: `${Date.now()}-` + `${Math.random().toString(36).slice(2)}`,

          uri: asset.uri,

          width: asset.width,

          height: asset.height,

          latitude: gps.latitude,

          longitude: gps.longitude,

          accuracy: gps.accuracy,

          capturedAt,
        });
      }

      setPhotos((current) => [...current, ...newPhotos]);
    } catch (error) {
      console.error("Photo picker error:", error);

      Alert.alert(
        "Unable to Select Photos",
        "An error occurred while selecting the photos.",
      );
    }
  };

  // ============================================================
  // Take Photo
  // ============================================================

  const takePhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert(
        "Maximum Photos",
        `You can upload a maximum of ${MAX_PHOTOS} photos.`,
      );

      return;
    }

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Camera Permission Required",
          "Please allow camera access so you can take a patrol photo.",
        );

        return;
      }

      /**
       * Get GPS immediately before
       * opening the camera.
       */
      const gps = await getCurrentPhotoLocation();

      if (!gps) {
        return;
      }

      const capturedAt = new Date().toISOString();

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,

        quality: 1,

        exif: false,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];

      setPhotos((current) => {
        if (current.length >= MAX_PHOTOS) {
          return current;
        }

        return [
          ...current,
          {
            id: `${Date.now()}-` + `${Math.random().toString(36).slice(2)}`,

            uri: asset.uri,

            width: asset.width,

            height: asset.height,

            latitude: gps.latitude,

            longitude: gps.longitude,

            accuracy: gps.accuracy,

            capturedAt,
          },
        ];
      });
    } catch (error) {
      console.error("Camera error:", error);

      Alert.alert(
        "Unable to Take Photo",
        "An error occurred while opening the camera.",
      );
    }
  };

  // ============================================================
  // Optimize Image
  // ============================================================

  const optimizePhoto = async (
    uri: string,
    width?: number,
    height?: number,
  ) => {
    try {
      const actions: any[] = [];

      if (width && height) {
        const longestSide = Math.max(width, height);

        if (longestSide > MAX_IMAGE_SIZE) {
          if (width >= height) {
            actions.push({
              resize: {
                width: MAX_IMAGE_SIZE,
              },
            });
          } else {
            actions.push({
              resize: {
                height: MAX_IMAGE_SIZE,
              },
            });
          }
        }
      }

      const result = await manipulateAsync(uri, actions, {
        compress: IMAGE_QUALITY,

        format: SaveFormat.JPEG,

        base64: false,
      });

      return {
        uri: result.uri,
        width: result.width,
        height: result.height,
      };
    } catch (error) {
      console.error("Image optimization error:", error);

      return {
        uri,
        width: width ?? 1280,
        height: height ?? 1280,
      };
    }
  };

  // ============================================================
  // URI -> ArrayBuffer
  // ============================================================

  const uriToArrayBuffer = async (uri: string): Promise<ArrayBuffer> => {
    const response = await fetch(uri);

    if (!response.ok) {
      throw new Error("Unable to read optimized image.");
    }

    return await response.arrayBuffer();
  };

  // ============================================================
  // Wait for stamp view
  // ============================================================

  const waitForNextRender = async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
  };

  // ============================================================
  // Render Visible Patrol Stamp
  // ============================================================

  const downloadStaticMap = async (
    latitude: number,
    longitude: number,
  ): Promise<string | null> => {
    if (!MAPBOX_API_KEY) {
      console.warn("Mapbox token is missing.");
      return null;
    }

    try {
      // Mapbox order is longitude,latitude (the reverse of Google)
      const pin = `pin-l+ef4444(${longitude},${latitude})`;

      const url =
        `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/` +
        `${pin}/${longitude},${latitude},17,0/400x400@2x` +
        `?access_token=${MAPBOX_API_KEY}`;

      const dest =
        `${FileSystem.cacheDirectory}` +
        `patrol-map-${Date.now()}-${Math.random().toString(36).slice(2)}.png`;

      const result = await FileSystem.downloadAsync(url, dest);

      if (result.status !== 200) {
        const body = await FileSystem.readAsStringAsync(result.uri);
        console.error("Mapbox static map error:", result.status, body);
        await FileSystem.deleteAsync(result.uri, { idempotent: true });
        return null;
      }

      return result.uri;
    } catch (error) {
      console.error("Static map download failed:", error);
      return null; // stamp still renders, just without the map
    }
  };

  const handleStampImageSettled = () => {
    stampLoadsPending.current -= 1;
    if (stampLoadsPending.current <= 0) {
      stampLoadResolver.current?.();
    }
  };

  const renderPatrolStamp = async (
    photo: SelectedPhoto,
    optimizedUri: string,
    optimizedWidth: number,
    optimizedHeight: number,
  ): Promise<string> => {
    if (
      typeof photo.latitude !== "number" ||
      typeof photo.longitude !== "number"
    ) {
      throw new Error("GPS coordinates are missing for this photo.");
    }
    if (!photo.capturedAt) {
      throw new Error("Photo capture time is missing.");
    }

    const mapUri = await downloadStaticMap(photo.latitude, photo.longitude);

    // photo + (map if available)
    stampLoadsPending.current = mapUri ? 2 : 1;

    const imagesLoaded = new Promise<void>((resolve) => {
      stampLoadResolver.current = resolve;
    });

    setStampPhoto({
      uri: optimizedUri,
      mapUri,
      width: optimizedWidth,
      height: optimizedHeight,
      latitude: photo.latitude,
      longitude: photo.longitude,
      accuracy: photo.accuracy,
      capturedAt: photo.capturedAt,
    });

    try {
      await Promise.race([
        imagesLoaded,
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error("Stamp images timed out.")), 5000),
        ),
      ]);

      await waitForNextRender();
      await new Promise((resolve) => setTimeout(resolve, 150));

      if (!stampViewRef.current) {
        throw new Error("Patrol photo stamp view is not ready.");
      }

      return await captureRef(stampViewRef, {
        format: "jpg",
        quality: IMAGE_QUALITY,
        width: optimizedWidth,
        height: optimizedHeight,
        result: "tmpfile",
      });
    } finally {
      stampLoadResolver.current = null;
      setStampPhoto(null);
    }
  };

  // ============================================================
  // Create final stamped + GPS photo
  // ============================================================

  const preparePhotoForUpload = async (
    photo: SelectedPhoto,
  ): Promise<string> => {
    if (
      typeof photo.latitude !== "number" ||
      typeof photo.longitude !== "number"
    ) {
      throw new Error(
        "GPS coordinates are unavailable for one of the selected photos.",
      );
    }

    const optimized = await optimizePhoto(photo.uri, photo.width, photo.height);

    /**
     * First render the visible patrol
     * stamp directly into the image.
     */
    const stampedUri = await renderPatrolStamp(
      photo,
      optimized.uri,
      optimized.width,
      optimized.height,
    );

    /**
     * Then add GPS EXIF to the
     * already stamped JPEG.
     */
    const finalUri = await embedGpsIntoJpeg(
      stampedUri,
      photo.latitude,
      photo.longitude,
    );

    return finalUri;
  };

  // ============================================================
  // Validate
  // ============================================================

  const validateForm = () => {
    if (!personnelId) {
      Alert.alert(
        "Personnel Not Found",
        "Your personnel account could not be identified. Please log in again.",
      );

      return false;
    }

    if (!unitId) {
      Alert.alert(
        "Unit Not Found",
        "Your assigned unit could not be identified.",
      );

      return false;
    }

    if (!summary.trim() && photos.length === 0) {
      Alert.alert(
        "Patrol Summary Required",
        "Please enter your patrol notes or attach at least one patrol photo.",
      );

      return false;
    }

    if (summary.trim().length > 5000) {
      Alert.alert(
        "Summary Too Long",
        "Please limit the patrol summary to 5,000 characters.",
      );

      return false;
    }

    /**
     * Every attached photo must have GPS.
     */
    for (const photo of photos) {
      if (
        typeof photo.latitude !== "number" ||
        typeof photo.longitude !== "number"
      ) {
        Alert.alert(
          "GPS Information Required",
          "One or more patrol photos do not have GPS information. Please remove them and add the photos again.",
        );

        return false;
      }
    }

    return true;
  };

  // ============================================================
  // Submit
  // ============================================================

  const submitSummary = async () => {
    if (isSubmitting) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    Alert.alert(
      "Submit Patrol Summary",
      "Are you sure you want to submit this patrol summary?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Submit",
          onPress: performSubmit,
        },
      ],
    );
  };

  // ============================================================
  // Actual Submit
  // ============================================================

  const performSubmit = async () => {
    if (!personnelId || !unitId) {
      return;
    }

    setIsSubmitting(true);

    const uploadedPaths: string[] = [];

    let summaryId: string | null = null;

    try {
      // ------------------------------------------------------
      // 1. Create summary
      // ------------------------------------------------------

      const { data: summaryData, error: summaryError } = await supabase
        .from("patrol_summaries")
        .insert({
          personnel_id: personnelId,

          summary: summary.trim() || null,

          submitted_at: new Date().toISOString(),

          unit_id: unitId,
        })
        .select("id")
        .single();

      if (summaryError) {
        throw summaryError;
      }

      if (!summaryData?.id) {
        throw new Error("The patrol summary ID was not returned.");
      }

      summaryId = summaryData.id;

      // ------------------------------------------------------
      // 2. Prepare + upload photos
      // ------------------------------------------------------

      for (let index = 0; index < photos.length; index++) {
        const photo = photos[index];

        /**
         * This does:
         *
         * original photo
         *      ↓
         * optimize
         *      ↓
         * visible patrol stamp
         *      ↓
         * GPS EXIF
         *      ↓
         * final JPEG
         */
        const finalPhotoUri = await preparePhotoForUpload(photo);

        const imageBuffer = await uriToArrayBuffer(finalPhotoUri);

        const photoOrder = index + 1;

        const filePath =
          `${personnelId}/` +
          `${summaryId}/` +
          `photo-${photoOrder}-${Date.now()}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from("patrol-summary-proofs")
          .upload(filePath, imageBuffer, {
            contentType: "image/jpeg",

            upsert: false,
          });

        if (uploadError) {
          throw uploadError;
        }

        uploadedPaths.push(filePath);

        // ----------------------------------------------------
        // 3. Save photo metadata
        //
        // NOTE:
        // GPS is intentionally NOT stored here.
        // It remains inside the JPEG EXIF.
        // ----------------------------------------------------

        const { error: photoRecordError } = await supabase
          .from("patrol_summary_photos")
          .insert({
            photo_path: filePath,

            photo_order: photoOrder,

            summary_id: summaryId,
          });

        if (photoRecordError) {
          throw photoRecordError;
        }
      }

      // ------------------------------------------------------
      // 4. Success
      // ------------------------------------------------------

      setSummary("");

      setPhotos([]);

      await loadRecentSummaries();

      setIsAddSummaryModalVisible(false);

      Alert.alert(
        "Patrol Summary Submitted",
        "Your patrol summary has been successfully submitted with GPS-stamped patrol photos.",
      );
    } catch (error: any) {
      console.error("Patrol summary submission error:", error);

      // ------------------------------------------------------
      // Cleanup uploaded files
      // ------------------------------------------------------

      if (uploadedPaths.length > 0) {
        try {
          await supabase.storage
            .from("patrol-summary-proofs")
            .remove(uploadedPaths);
        } catch (cleanupError) {
          console.error("Photo cleanup error:", cleanupError);
        }
      }

      // ------------------------------------------------------
      // Cleanup database summary
      // ------------------------------------------------------

      if (summaryId) {
        try {
          await supabase.from("patrol_summaries").delete().eq("id", summaryId);
        } catch (cleanupError) {
          console.error("Summary cleanup error:", cleanupError);
        }
      }

      Alert.alert(
        "Submission Failed",
        error?.message ||
          "Unable to submit your patrol summary. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================================
  // Render
  // ============================================================

  const renderStampView = () => {
    if (!stampPhoto) return null;

    const { date, time } = formatStampDate(stampPhoto.capturedAt);

    const personnelLine = [personnelRank?.trim(), personnelName?.trim()]
      .filter(Boolean)
      .join(" ");

    // Bar takes ~25% of the height, capped relative to width
    const barHeight = Math.round(
      Math.min(stampPhoto.height * 0.32, stampPhoto.width * 0.32),
    );

    const u = barHeight / 240; // scale unit for everything inside the bar
    const inset = Math.round(14 * u);
    const mapSize = barHeight - inset * 2;

    const titleSize = Math.round(32 * u);
    const lineSize = Math.round(32 * u); // personnel, date/time
    const gpsSize = Math.round(30 * u); // coordinates (was 22)
    const iconSize = Math.round(26 * u);
    const rowGap = Math.round(8 * u);

    return (
      <View
        ref={stampViewRef}
        collapsable={false}
        style={[
          styles.stampCapture,
          { width: stampPhoto.width, height: stampPhoto.height },
        ]}
      >
        <Image
          source={{ uri: stampPhoto.uri }}
          style={[
            styles.stampBackgroundImage,
            { width: stampPhoto.width, height: stampPhoto.height },
          ]}
          resizeMode="stretch"
          fadeDuration={0}
          onLoadEnd={handleStampImageSettled}
        />

        {/* FULL-WIDTH BOTTOM BAR */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: barHeight,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: inset,
            backgroundColor: "rgba(0,0,0,0.62)",
            borderTopWidth: Math.max(2, Math.round(2 * u)),
            borderTopColor: "rgba(255,255,255,0.25)",
          }}
        >
          {/* MAP */}
          {stampPhoto.mapUri ? (
            <Image
              source={{ uri: stampPhoto.mapUri }}
              style={{
                width: mapSize,
                height: mapSize,
                borderRadius: Math.round(10 * u),
                borderWidth: Math.max(2, Math.round(2 * u)),
                borderColor: "rgba(255,255,255,0.6)",
                marginRight: inset,
              }}
              resizeMode="cover"
              fadeDuration={0}
              onLoadEnd={handleStampImageSettled}
            />
          ) : null}

          {/* TEXT COLUMN */}
          <View style={{ flex: 1, justifyContent: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ marginLeft: Math.round(8 * u), flex: 1 }}>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={{
                    color: STAMP_TEXT,
                    fontSize: titleSize,
                    fontWeight: "900",
                    letterSpacing: 1,
                  }}
                >
                  Project PATROL
                </Text>
              </View>
            </View>

            <View
              style={{
                height: Math.max(1, Math.round(2 * u)),
                backgroundColor: "rgba(255,255,255,0.2)",
                marginVertical: Math.round(8 * u),
              }}
            />

            {personnelLine ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: rowGap,
                }}
              >
                <Ionicons
                  name="person-outline"
                  size={iconSize}
                  color="#D1D5DB"
                />
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={{
                    flex: 1,
                    color: "#E5E7EB",
                    fontSize: lineSize,
                    fontWeight: "600",
                    marginLeft: Math.round(8 * u),
                  }}
                >
                  {personnelLine}
                </Text>
              </View>
            ) : null}

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: rowGap,
              }}
            >
              <Ionicons
                name="calendar-outline"
                size={iconSize}
                color="#D1D5DB"
              />
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{
                  flex: 1,
                  color: "#E5E7EB",
                  fontSize: lineSize,
                  fontWeight: "600",
                  marginLeft: Math.round(8 * u),
                }}
              >
                {date} • {time}
              </Text>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: rowGap,
              }}
            >
              <Ionicons
                name="navigate-outline"
                size={iconSize}
                color={STAMP_ACCENT}
              />
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{
                  flex: 1,
                  color: STAMP_TEXT,
                  fontSize: gpsSize,
                  fontWeight: "800",
                  marginLeft: Math.round(8 * u),
                }}
              >
                {formatCoordinate(stampPhoto.latitude)}°{" "}
                {stampPhoto.latitude >= 0 ? "N" : "S"}
                {"  |  "}
                {formatCoordinate(stampPhoto.longitude)}°{" "}
                {stampPhoto.longitude >= 0 ? "E" : "W"}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
        },
      ]}
    >
      {/* ========================================================
          HIDDEN PHOTO STAMP COMPOSITION VIEW
          ======================================================== */}

      <View pointerEvents="none" style={styles.hiddenStampContainer}>
        {renderStampView()}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            setSummary("");
            setPhotos([]);
            setIsAddSummaryModalVisible(true);
          }}
          style={[
            styles.addSummaryButton,
            {
              backgroundColor: theme.blue,
            },
          ]}
        >
          <View style={styles.addSummaryButtonIcon}>
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </View>

          <View
            style={{
              flex: 1,
            }}
          >
            <Text style={styles.addSummaryButtonTitle}>Add Patrol Summary</Text>

            <Text style={styles.addSummaryButtonSubtitle}>
              Submit your report and patrol photos
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.recentSection}>
          <View style={styles.recentSectionHeader}>
            <View
              style={{
                flex: 1,
              }}
            >
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    color: theme.textPrimary,
                  },
                ]}
              >
                My Recent Patrol Summaries
              </Text>

              <Text
                style={[
                  styles.sectionSubtitle,
                  {
                    color: theme.textSecondary,
                  },
                ]}
              >
                Submitted within the last 2 days
              </Text>
            </View>
          </View>

          {isLoadingSummaries ? (
            <View
              style={[
                styles.loadingCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
              ]}
            >
              <ActivityIndicator size="small" color={theme.blue} />

              <Text
                style={[
                  styles.loadingText,
                  {
                    color: theme.textSecondary,
                  },
                ]}
              >
                Loading patrol summaries...
              </Text>
            </View>
          ) : recentSummaries.length === 0 ? (
            <View
              style={[
                styles.emptyCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
              ]}
            >
              <View
                style={[
                  styles.emptyIcon,
                  {
                    backgroundColor: theme.surfaceSecondary,
                  },
                ]}
              >
                <Ionicons
                  name="document-text-outline"
                  size={25}
                  color={theme.textMuted}
                />
              </View>

              <Text
                style={[
                  styles.emptyTitle,
                  {
                    color: theme.textPrimary,
                  },
                ]}
              >
                No Patrol Summaries
              </Text>

              <Text
                style={[
                  styles.emptyText,
                  {
                    color: theme.textSecondary,
                  },
                ]}
              >
                You have not submitted a patrol summary within the last two
                days.
              </Text>
            </View>
          ) : (
            <View style={styles.summaryList}>
              {recentSummaries.map((item) => {
                const submittedDate = item.submitted_at
                  ? new Date(item.submitted_at)
                  : null;

                const dateLabel = submittedDate
                  ? submittedDate.toLocaleDateString("en-PH", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "Unknown date";

                const timeLabel = submittedDate
                  ? submittedDate.toLocaleTimeString("en-PH", {
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "";

                const isToday =
                  submittedDate &&
                  submittedDate.toDateString() === new Date().toDateString();

                return (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.85}
                    onPress={() => openSummary(item)}
                    style={[
                      styles.summaryCard,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <View style={styles.summaryTopRow}>
                      <View style={styles.summaryDateContainer}>
                        <View
                          style={[
                            styles.summaryDateIcon,
                            {
                              backgroundColor: theme.blueLight,
                            },
                          ]}
                        >
                          <Ionicons
                            name="calendar-outline"
                            size={18}
                            color={theme.blue}
                          />
                        </View>

                        <View>
                          <Text
                            style={[
                              styles.summaryDate,
                              {
                                color: theme.textPrimary,
                              },
                            ]}
                          >
                            {isToday ? "Today" : dateLabel}
                          </Text>

                          {isToday && (
                            <Text
                              style={[
                                styles.summaryDateSubtext,
                                {
                                  color: theme.textSecondary,
                                },
                              ]}
                            >
                              {dateLabel}
                            </Text>
                          )}
                        </View>
                      </View>

                      <View style={styles.summaryTime}>
                        <Ionicons
                          name="time-outline"
                          size={15}
                          color={theme.textSecondary}
                        />

                        <Text
                          style={[
                            styles.summaryTimeText,
                            {
                              color: theme.textSecondary,
                            },
                          ]}
                        >
                          {timeLabel}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.summaryDivider,
                        {
                          backgroundColor: theme.border,
                        },
                      ]}
                    />

                    <Text
                      style={[
                        styles.summaryContent,
                        {
                          color: item.summary
                            ? theme.textPrimary
                            : theme.textMuted,
                        },
                      ]}
                    >
                      {truncateSummary(
                        item.summary || "No written summary provided.",
                      )}
                    </Text>

                    {item.photos.length > 0 && (
                      <View style={styles.submittedPhotosRow}>
                        <View style={styles.submittedPhotoLabel}>
                          <Ionicons
                            name="images-outline"
                            size={16}
                            color={theme.textSecondary}
                          />

                          <Text
                            style={[
                              styles.submittedPhotoText,
                              {
                                color: theme.textSecondary,
                              },
                            ]}
                          >
                            {item.photos.length}{" "}
                            {item.photos.length === 1 ? "photo" : "photos"}{" "}
                            attached
                          </Text>
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ========================================================
          PREVIEW PHOTO
          ======================================================== */}

      <Modal
        visible={!!previewPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewPhoto(null)}
      >
        <View style={styles.previewOverlay}>
          <Pressable
            style={styles.previewClose}
            onPress={() => setPreviewPhoto(null)}
          >
            <Ionicons name="close" size={27} color="#FFFFFF" />
          </Pressable>

          {previewPhoto && (
            <Image
              source={{
                uri: previewPhoto,
              }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* ========================================================
          SUMMARY DETAIL
          ======================================================== */}

      <Modal
        visible={selectedSummary !== null}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          setSelectedSummary(null);
          setSelectedPhotoIndex(null);
        }}
      >
        <View
          style={[
            styles.detailModal,
            {
              backgroundColor: theme.background,
            },
          ]}
        >
          <View
            style={[
              styles.detailHeader,
              {
                backgroundColor: theme.surface,
                borderBottomColor: theme.border,
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                setSelectedSummary(null);
                setSelectedPhotoIndex(null);
              }}
              style={[
                styles.detailBackButton,
                {
                  backgroundColor: theme.surfaceSecondary,
                },
              ]}
            >
              <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
            </TouchableOpacity>

            <View style={styles.detailHeaderText}>
              <Text
                style={[
                  styles.detailHeaderTitle,
                  {
                    color: theme.textPrimary,
                  },
                ]}
              >
                Patrol Summary
              </Text>

              <Text
                style={[
                  styles.detailHeaderSubtitle,
                  {
                    color: theme.textSecondary,
                  },
                ]}
              >
                Submitted patrol report
              </Text>
            </View>
          </View>

          <ScrollView
            style={styles.detailScroll}
            contentContainerStyle={styles.detailContent}
            showsVerticalScrollIndicator={false}
          >
            {selectedSummary && (
              <>
                <View
                  style={[
                    styles.detailInfoCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.detailInfoIcon,
                      {
                        backgroundColor: theme.blueLight,
                      },
                    ]}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={20}
                      color={theme.blue}
                    />
                  </View>

                  <View style={styles.detailInfoText}>
                    <Text
                      style={[
                        styles.detailInfoValue,
                        {
                          color: theme.textPrimary,
                        },
                      ]}
                    >
                      {selectedSummary.submitted_at
                        ? new Date(
                            selectedSummary.submitted_at,
                          ).toLocaleDateString("en-PH", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })
                        : "Unknown date"}
                    </Text>

                    {selectedSummary.submitted_at && (
                      <Text
                        style={[
                          styles.detailInfoTime,
                          {
                            color: theme.textSecondary,
                          },
                        ]}
                      >
                        {new Date(
                          selectedSummary.submitted_at,
                        ).toLocaleTimeString("en-PH", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </Text>
                    )}
                  </View>
                </View>

                <View
                  style={[
                    styles.detailSection,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <View style={styles.detailSectionHeader}>
                    <View
                      style={[
                        styles.detailSectionIcon,
                        {
                          backgroundColor: theme.blueLight,
                        },
                      ]}
                    >
                      <Ionicons
                        name="document-text-outline"
                        size={18}
                        color={theme.blue}
                      />
                    </View>

                    <Text
                      style={[
                        styles.detailSectionTitle,
                        {
                          color: theme.textPrimary,
                        },
                      ]}
                    >
                      Patrol Notes
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.detailSummaryText,
                      {
                        color: theme.textPrimary,
                      },
                    ]}
                  >
                    {selectedSummary.summary?.trim() ||
                      "No patrol notes were provided."}
                  </Text>
                </View>

                <View
                  style={[
                    styles.detailSection,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <View style={styles.detailSectionHeader}>
                    <View
                      style={[
                        styles.detailSectionIcon,
                        {
                          backgroundColor: theme.blueLight,
                        },
                      ]}
                    >
                      <Ionicons
                        name="images-outline"
                        size={18}
                        color={theme.blue}
                      />
                    </View>

                    <View
                      style={{
                        flex: 1,
                      }}
                    >
                      <Text
                        style={[
                          styles.detailSectionTitle,
                          {
                            color: theme.textPrimary,
                          },
                        ]}
                      >
                        Patrol Photos
                      </Text>

                      <Text
                        style={[
                          styles.detailPhotoCount,
                          {
                            color: theme.textSecondary,
                          },
                        ]}
                      >
                        {selectedSummary.photos.length}{" "}
                        {selectedSummary.photos.length === 1
                          ? "photo"
                          : "photos"}
                      </Text>
                    </View>
                  </View>

                  {isLoadingPhotoUrls ? (
                    <View style={styles.detailPhotoLoading}>
                      <ActivityIndicator size="small" color={theme.blue} />

                      <Text
                        style={[
                          styles.detailPhotoLoadingText,
                          {
                            color: theme.textSecondary,
                          },
                        ]}
                      >
                        Loading photos...
                      </Text>
                    </View>
                  ) : selectedSummary.photos.length === 0 ? (
                    <View
                      style={[
                        styles.noPhotosBox,
                        {
                          backgroundColor: theme.surfaceSecondary,
                        },
                      ]}
                    >
                      <Ionicons
                        name="image-outline"
                        size={28}
                        color={theme.textMuted}
                      />

                      <Text
                        style={[
                          styles.noPhotosText,
                          {
                            color: theme.textSecondary,
                          },
                        ]}
                      >
                        No photos attached
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.detailPhotoGrid}>
                      {selectedSummary.photos.map((photo, index) => {
                        const url = photoUrls[photo.id];

                        return (
                          <TouchableOpacity
                            key={photo.id}
                            activeOpacity={0.85}
                            disabled={!url}
                            onPress={() => setSelectedPhotoIndex(index)}
                            style={styles.detailPhotoWrapper}
                          >
                            {url ? (
                              <Image
                                source={{
                                  uri: url,
                                }}
                                style={styles.detailPhoto}
                                resizeMode="cover"
                              />
                            ) : (
                              <View
                                style={[
                                  styles.detailPhotoPlaceholder,
                                  {
                                    backgroundColor: theme.surfaceSecondary,
                                  },
                                ]}
                              >
                                <Ionicons
                                  name="image-outline"
                                  size={28}
                                  color={theme.textMuted}
                                />
                              </View>
                            )}

                            {url && (
                              <View style={styles.photoExpandIcon}>
                                <Ionicons
                                  name="expand-outline"
                                  size={16}
                                  color="#FFFFFF"
                                />
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>

                <View
                  style={[
                    styles.detailSubmittedBadge,
                    {
                      backgroundColor: isDarkTheme ? "#12301F" : "#ECFDF5",
                    },
                  ]}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#16A34A" />

                  <Text
                    style={[
                      styles.detailSubmittedText,
                      {
                        color: isDarkTheme ? "#86EFAC" : "#15803D",
                      },
                    ]}
                  >
                    Patrol summary submitted successfully
                  </Text>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ========================================================
          FULL SCREEN PHOTO
          ======================================================== */}

      <Modal
        visible={selectedPhotoIndex !== null}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setSelectedPhotoIndex(null)}
      >
        <View style={styles.photoViewer}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setSelectedPhotoIndex(null)}
            style={styles.photoViewerClose}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>

          {selectedSummary &&
            selectedPhotoIndex !== null &&
            selectedSummary.photos[selectedPhotoIndex] &&
            photoUrls[selectedSummary.photos[selectedPhotoIndex].id] && (
              <>
                <Image
                  source={{
                    uri: photoUrls[
                      selectedSummary.photos[selectedPhotoIndex].id
                    ],
                  }}
                  style={styles.fullScreenPhoto}
                  resizeMode="contain"
                />

                <View style={styles.photoViewerFooter}>
                  <Text style={styles.photoViewerCounter}>
                    {selectedPhotoIndex + 1} / {selectedSummary.photos.length}
                  </Text>
                </View>

                {selectedPhotoIndex > 0 && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() =>
                      setSelectedPhotoIndex(selectedPhotoIndex - 1)
                    }
                    style={[styles.photoNavButton, styles.photoNavLeft]}
                  >
                    <Ionicons name="chevron-back" size={30} color="#FFFFFF" />
                  </TouchableOpacity>
                )}

                {selectedPhotoIndex < selectedSummary.photos.length - 1 && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() =>
                      setSelectedPhotoIndex(selectedPhotoIndex + 1)
                    }
                    style={[styles.photoNavButton, styles.photoNavRight]}
                  >
                    <Ionicons
                      name="chevron-forward"
                      size={30}
                      color="#FFFFFF"
                    />
                  </TouchableOpacity>
                )}
              </>
            )}
        </View>
      </Modal>

      {/* ========================================================
          ADD SUMMARY
          ======================================================== */}

      <Modal
        visible={isAddSummaryModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (!isSubmitting) {
            setIsAddSummaryModalVisible(false);
          }
        }}
      >
        <View
          style={[
            styles.addSummaryModal,
            {
              backgroundColor: theme.background,
            },
          ]}
        >
          <View
            style={[
              styles.addSummaryHeader,
              {
                backgroundColor: theme.surface,
                borderBottomColor: theme.border,
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.7}
              disabled={isSubmitting}
              onPress={() => setIsAddSummaryModalVisible(false)}
              style={[
                styles.addSummaryCloseButton,
                {
                  backgroundColor: theme.surfaceSecondary,
                },
              ]}
            >
              <Ionicons name="close" size={22} color={theme.textPrimary} />
            </TouchableOpacity>

            <View style={styles.addSummaryHeaderText}>
              <Text
                style={[
                  styles.addSummaryTitle,
                  {
                    color: theme.textPrimary,
                  },
                ]}
              >
                Add Patrol Summary
              </Text>

              <Text
                style={[
                  styles.addSummarySubtitle,
                  {
                    color: theme.textSecondary,
                  },
                ]}
              >
                Submit your report after completing your duty
              </Text>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.addSummaryContent}
          >
            {/* --------------------------------------------------
                PATROL NOTES
                -------------------------------------------------- */}

            <View style={styles.formSection}>
              <View style={styles.formLabelRow}>
                <Ionicons
                  name="document-text-outline"
                  size={17}
                  color={theme.blue}
                />

                <Text
                  style={[
                    styles.formLabel,
                    {
                      color: theme.textPrimary,
                    },
                  ]}
                >
                  Patrol Notes
                </Text>
              </View>

              <Text
                style={[
                  styles.formHint,
                  {
                    color: theme.textSecondary,
                  },
                ]}
              >
                Describe the activities, incidents, observations, or other
                relevant information during your patrol.
              </Text>

              <TextInput
                value={summary}
                onChangeText={(text) => setSummary(text.slice(0, 5000))}
                multiline
                textAlignVertical="top"
                placeholder="Enter your patrol summary..."
                placeholderTextColor={theme.textMuted}
                style={[
                  styles.summaryInput,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    color: theme.textPrimary,
                  },
                ]}
              />

              <Text
                style={[
                  styles.characterCount,
                  {
                    color: theme.textMuted,
                  },
                ]}
              >
                {summary.length}/5000
              </Text>
            </View>

            {/* --------------------------------------------------
                PATROL PHOTOS
                -------------------------------------------------- */}

            <View style={styles.formSection}>
              <View style={styles.formLabelRow}>
                <Ionicons name="images-outline" size={17} color={theme.blue} />

                <Text
                  style={[
                    styles.formLabel,
                    {
                      color: theme.textPrimary,
                    },
                  ]}
                >
                  Patrol Photos
                </Text>

                <Text
                  style={[
                    styles.photoLimit,
                    {
                      color: theme.textSecondary,
                    },
                  ]}
                >
                  {photos.length}/3
                </Text>
              </View>

              <Text
                style={[
                  styles.formHint,
                  {
                    color: theme.textSecondary,
                  },
                ]}
              >
                Up to 3 photos. Each photo is automatically optimized,
                GPS-stamped, and GPS information is embedded in the JPEG EXIF.
              </Text>

              {photos.length > 0 && (
                <View style={styles.photoPreviewRow}>
                  {photos.map((photo, index) => (
                    <View
                      key={`${photo.uri}-${index}`}
                      style={styles.photoPreviewWrapper}
                    >
                      <Image
                        source={{
                          uri: photo.uri,
                        }}
                        style={styles.photoPreview}
                      />

                      <View style={styles.gpsPreviewBadge}>
                        <Ionicons name="location" size={10} color="#FFFFFF" />

                        <Text style={styles.gpsPreviewText}>GPS</Text>
                      </View>

                      <TouchableOpacity
                        activeOpacity={0.8}
                        disabled={isSubmitting}
                        onPress={() => {
                          setPhotos((current) =>
                            current.filter(
                              (_, photoIndex) => photoIndex !== index,
                            ),
                          );
                        }}
                        style={styles.removePhotoButton}
                      >
                        <Ionicons name="close" size={14} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {photos.length < 3 && (
                <View style={styles.photoActions}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    disabled={isSubmitting}
                    onPress={pickPhotos}
                    style={[
                      styles.photoActionButton,
                      {
                        backgroundColor: theme.blueLight,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name="images-outline"
                      size={21}
                      color={theme.blue}
                    />

                    <Text
                      style={[
                        styles.photoActionText,
                        {
                          color: theme.blueText,
                        },
                      ]}
                    >
                      Gallery
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    disabled={isSubmitting}
                    onPress={takePhoto}
                    style={[
                      styles.photoActionButton,
                      {
                        backgroundColor: theme.blueLight,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name="camera-outline"
                      size={21}
                      color={theme.blue}
                    />

                    <Text
                      style={[
                        styles.photoActionText,
                        {
                          color: theme.blueText,
                        },
                      ]}
                    >
                      Camera
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* --------------------------------------------------
                GPS NOTICE
                -------------------------------------------------- */}

            <View
              style={[
                styles.gpsNotice,
                {
                  backgroundColor: isDarkTheme ? "#172B1E" : "#F0FDF4",

                  borderColor: isDarkTheme ? "#285536" : "#BBF7D0",
                },
              ]}
            >
              <Ionicons name="location" size={18} color={theme.green} />

              <Text
                style={[
                  styles.gpsNoticeText,
                  {
                    color: isDarkTheme ? "#BBF7D0" : "#166534",
                  },
                ]}
              >
                Patrol photos include a visible GPS stamp and embedded GPS EXIF
                metadata. Coordinates are not stored separately in the database.
              </Text>
            </View>

            {/* --------------------------------------------------
                SUBMIT
                -------------------------------------------------- */}

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={isSubmitting}
              onPress={submitSummary}
              style={[
                styles.submitButton,
                {
                  backgroundColor: isSubmitting ? theme.textMuted : theme.blue,
                },
              ]}
            >
              {isSubmitting ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />

                  <Text style={styles.submitButtonText}>
                    Preparing GPS-stamped photos...
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={21}
                    color="#FFFFFF"
                  />

                  <Text style={styles.submitButtonText}>
                    Submit Patrol Summary
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <View
              style={{
                height: 30,
              }}
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ================================================================
// Styles
// ================================================================

const getStyles = (isDarkTheme: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },

    scrollView: {
      flex: 1,
    },

    contentContainer: {
      paddingHorizontal: 16,
      paddingTop: 18,
      paddingBottom: 35,
    },

    // ------------------------------------------------------------
    // Hidden stamp composition
    // ------------------------------------------------------------

    hiddenStampContainer: {
      position: "absolute",
      left: 0,
      top: 0,
      opacity: 1,
      zIndex: -1,
    },

    stampCapture: {
      position: "relative",
      overflow: "hidden",
      backgroundColor: "#000000",
    },

    stampBackgroundImage: {
      position: "absolute",
      left: 0,
      top: 0,
    },

    // ------------------------------------------------------------
    // Patrol photo stamp
    // ------------------------------------------------------------

    photoStamp: {
      position: "absolute",
      left: 18,
      bottom: 18,

      minWidth: 330,

      paddingHorizontal: 14,
      paddingVertical: 10,

      borderRadius: 9,

      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.18)",

      shadowColor: "#000000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.45,
      shadowRadius: 5,

      elevation: 8,
    },

    photoStampHeader: {
      flexDirection: "row",
      alignItems: "center",
    },

    photoStampBadge: {
      width: 30,
      height: 30,
      borderRadius: 8,

      backgroundColor: "rgba(250,204,21,0.16)",

      alignItems: "center",
      justifyContent: "center",

      marginRight: 9,
    },

    photoStampHeaderText: {
      flex: 1,
    },

    photoStampTitle: {
      color: STAMP_TEXT,

      fontSize: 16,
      fontWeight: "900",

      letterSpacing: 0.6,
    },

    photoStampSubtitle: {
      color: "rgba(255,255,255,0.72)",

      fontSize: 8,
      fontWeight: "700",

      letterSpacing: 0.7,

      marginTop: 1,
    },

    photoStampDivider: {
      height: 1,

      backgroundColor: "rgba(255,255,255,0.18)",

      marginVertical: 7,
    },

    photoStampRow: {
      flexDirection: "row",
      alignItems: "center",

      minHeight: 17,
    },

    photoStampText: {
      color: "#E5E7EB",

      fontSize: 10,
      fontWeight: "600",

      marginLeft: 5,
    },

    photoStampGpsText: {
      color: STAMP_TEXT,

      fontSize: 10,
      fontWeight: "800",

      marginLeft: 5,
      letterSpacing: 0.2,
    },

    photoStampSeparator: {
      color: "rgba(255,255,255,0.45)",

      fontSize: 10,
      marginHorizontal: 7,
    },

    photoStampPersonnelRow: {
      flexDirection: "row",
      alignItems: "center",

      marginTop: 3,
    },

    photoStampPersonnel: {
      color: "#D1D5DB",

      fontSize: 9,
      fontWeight: "600",

      marginLeft: 5,

      maxWidth: 285,
    },

    // ------------------------------------------------------------
    // Existing UI
    // ------------------------------------------------------------

    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 18,
    },

    headerIcon: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDarkTheme ? "#172B46" : "#EFF6FF",
      marginRight: 12,
    },

    headerTextContainer: {
      flex: 1,
    },

    headerTitle: {
      fontSize: 23,
      fontWeight: "800",
      letterSpacing: -0.3,
    },

    headerSubtitle: {
      fontSize: 13,
      marginTop: 3,
    },

    dutyCard: {
      borderWidth: 1,
      borderRadius: 18,
      padding: 16,
      marginBottom: 24,
    },

    dutyHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
    },

    dutyIcon: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },

    dutyHeaderText: {
      flex: 1,
    },

    dutyType: {
      fontSize: 17,
      fontWeight: "800",
    },

    completedBadge: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 5,
    },

    completedBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      marginLeft: 4,
    },

    dutyDivider: {
      height: 1,
      marginVertical: 14,
    },

    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 34,
    },

    infoLabel: {
      width: 82,
      marginLeft: 9,
      fontSize: 13,
    },

    infoValue: {
      flex: 1,
      textAlign: "right",
      fontSize: 13,
      fontWeight: "700",
    },

    section: {
      marginBottom: 24,
    },

    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },

    sectionIcon: {
      width: 38,
      height: 38,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 10,
    },

    sectionTitle: {
      fontSize: 20,
      fontWeight: "800",
    },

    sectionSubtitle: {
      fontSize: 16,
      marginTop: 2,
    },

    textInputWrapper: {
      borderWidth: 1,
      borderRadius: 15,
      minHeight: 165,
      overflow: "hidden",
    },

    textInput: {
      flex: 1,
      minHeight: 135,
      paddingHorizontal: 14,
      paddingTop: 13,
      paddingBottom: 8,
      fontSize: 14,
      lineHeight: 21,
    },

    characterCount: {
      textAlign: "right",
      fontSize: 15,
      paddingHorizontal: 13,
      paddingBottom: 9,
    },

    photoSectionHeaderText: {
      flex: 1,
    },

    photoTitleRow: {
      flexDirection: "row",
      alignItems: "center",
    },

    photoCountBadge: {
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
      marginLeft: 8,
    },

    photoCountText: {
      fontSize: 11,
      fontWeight: "800",
    },

    photoHint: {
      fontSize: 16,
      marginBottom: 11,
      lineHeight: 17,
    },

    photoGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },

    photoWrapper: {
      width: "31.8%",
      aspectRatio: 1,
      position: "relative",
    },

    photoPressable: {
      width: "100%",
      height: "100%",
      borderRadius: 14,
      overflow: "hidden",
    },

    photo: {
      width: "100%",
      height: "100%",
    },

    photoNumber: {
      position: "absolute",
      left: 7,
      top: 7,
      width: 25,
      height: 25,
      borderRadius: 8,
      backgroundColor: "rgba(0,0,0,0.65)",
      alignItems: "center",
      justifyContent: "center",
    },

    photoNumberText: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "800",
    },

    removePhotoButton: {
      position: "absolute",
      right: -5,
      top: -5,
      width: 25,
      height: 25,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: isDarkTheme ? "#101B2D" : "#FFFFFF",
      backgroundColor: "#DC2626",
    },

    addPhotoButton: {
      width: "31.8%",
      aspectRatio: 1,
      borderRadius: 14,
      borderWidth: 1.5,
      borderStyle: "dashed",
      alignItems: "center",
      justifyContent: "center",
    },

    addPhotoIcon: {
      width: 46,
      height: 46,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 7,
    },

    addPhotoText: {
      fontSize: 18,
      fontWeight: "800",
    },

    addPhotoSubtext: {
      fontSize: 15,
      marginTop: 3,
    },

    infoNotice: {
      flexDirection: "row",
      alignItems: "flex-start",
      borderWidth: 1,
      borderRadius: 13,
      padding: 12,
      marginBottom: 18,
    },

    infoNoticeText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 18,
      marginLeft: 8,
    },

    submitButton: {
      minHeight: 53,
      borderRadius: 15,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 18,
    },

    submitButtonText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "800",
      marginLeft: 9,
      textAlign: "center",
    },

    footerText: {
      textAlign: "center",
      fontSize: 15,
      lineHeight: 16,
      marginTop: 10,
    },

    previewOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.94)",
      alignItems: "center",
      justifyContent: "center",
    },

    previewImage: {
      width: "100%",
      height: "80%",
    },

    previewClose: {
      position: "absolute",
      right: 18,
      top: Platform.OS === "ios" ? 55 : 25,
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: "rgba(255,255,255,0.15)",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 10,
    },

    recentSection: {
      marginTop: 10,
      marginBottom: 20,
    },

    recentSectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },

    summaryList: {
      gap: 12,
    },

    summaryCard: {
      borderWidth: 1,
      borderRadius: 16,
      padding: 14,
    },

    summaryTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    summaryDateContainer: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },

    summaryDateIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 9,
    },

    summaryDate: {
      fontSize: 20,
      fontWeight: "800",
    },

    summaryDateSubtext: {
      fontSize: 16,
      marginTop: 2,
    },

    summaryTime: {
      flexDirection: "row",
      alignItems: "center",
      marginLeft: 8,
    },

    summaryTimeText: {
      fontSize: 15,
      marginLeft: 4,
    },

    summaryDivider: {
      height: 1,
      marginVertical: 12,
    },

    summaryContent: {
      fontSize: 17,
      lineHeight: 20,
    },

    submittedPhotosRow: {
      marginTop: 12,
    },

    submittedPhotoLabel: {
      flexDirection: "row",
      alignItems: "center",
    },

    submittedPhotoText: {
      fontSize: 15,
      marginLeft: 5,
    },

    submittedBadgeRow: {
      marginTop: 11,
      flexDirection: "row",
    },

    submittedBadge: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },

    submittedBadgeText: {
      fontSize: 10,
      fontWeight: "800",
      marginLeft: 4,
    },

    loadingCard: {
      minHeight: 80,
      borderWidth: 1,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
    },

    loadingText: {
      fontSize: 16,
      marginLeft: 8,
    },

    emptyCard: {
      borderWidth: 1,
      borderRadius: 15,
      padding: 20,
      alignItems: "center",
    },

    emptyIcon: {
      width: 50,
      height: 50,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 9,
    },

    emptyTitle: {
      fontSize: 18,
      fontWeight: "800",
    },

    emptyText: {
      fontSize: 15,
      lineHeight: 17,
      textAlign: "center",
      marginTop: 4,
      maxWidth: 280,
    },

    summaryOpenIndicator: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 8,
    },

    detailModal: {
      flex: 1,
    },

    detailHeader: {
      minHeight: 72,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 10,
      borderBottomWidth: 1,
    },

    detailBackButton: {
      width: 42,
      height: 42,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
    },

    detailHeaderText: {
      flex: 1,
      marginLeft: 12,
    },

    detailHeaderTitle: {
      fontSize: 20,
      fontWeight: "800",
    },

    detailHeaderSubtitle: {
      fontSize: 15,
      marginTop: 2,
    },

    detailScroll: {
      flex: 1,
    },

    detailContent: {
      padding: 16,
      paddingBottom: 35,
    },

    detailInfoCard: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderRadius: 16,
      padding: 14,
      marginBottom: 12,
    },

    detailInfoIcon: {
      width: 44,
      height: 44,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
    },

    detailInfoText: {
      flex: 1,
      marginLeft: 12,
    },

    detailInfoLabel: {
      fontSize: 15,
      fontWeight: "800",
      letterSpacing: 0.8,
    },

    detailInfoValue: {
      fontSize: 18,
      fontWeight: "800",
      marginTop: 3,
    },

    detailInfoTime: {
      fontSize: 15,
      marginTop: 2,
    },

    detailSection: {
      borderWidth: 1,
      borderRadius: 16,
      padding: 15,
      marginBottom: 12,
    },

    detailSectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 13,
    },

    detailSectionIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 9,
    },

    detailSectionTitle: {
      fontSize: 18,
      fontWeight: "800",
    },

    detailPhotoCount: {
      fontSize: 15,
      marginTop: 2,
    },

    detailSummaryText: {
      fontSize: 18,
      lineHeight: 22,
    },

    detailPhotoGrid: {
      flexDirection: "row",
      gap: 8,
    },

    detailPhotoWrapper: {
      flex: 1,
      height: 130,
      borderRadius: 12,
      overflow: "hidden",
      position: "relative",
    },

    detailPhoto: {
      width: "100%",
      height: "100%",
    },

    detailPhotoPlaceholder: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },

    photoExpandIcon: {
      position: "absolute",
      right: 7,
      bottom: 7,
      width: 28,
      height: 28,
      borderRadius: 9,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center",
      justifyContent: "center",
    },

    detailPhotoLoading: {
      height: 100,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
    },

    detailPhotoLoadingText: {
      fontSize: 16,
      marginLeft: 8,
    },

    noPhotosBox: {
      minHeight: 100,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },

    noPhotosText: {
      fontSize: 15,
      marginTop: 7,
    },

    detailSubmittedBadge: {
      minHeight: 48,
      borderRadius: 13,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },

    detailSubmittedText: {
      fontSize: 20,
      fontWeight: "700",
      marginLeft: 7,
    },

    photoViewer: {
      flex: 1,
      backgroundColor: "#000000",
      alignItems: "center",
      justifyContent: "center",
    },

    fullScreenPhoto: {
      width: "100%",
      height: "100%",
    },

    photoViewerClose: {
      position: "absolute",
      zIndex: 20,
      top: 48,
      right: 18,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center",
      justifyContent: "center",
    },

    photoViewerFooter: {
      position: "absolute",
      zIndex: 20,
      bottom: 35,
      alignSelf: "center",
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 12,
      backgroundColor: "rgba(0,0,0,0.55)",
    },

    photoViewerCounter: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "700",
    },

    photoNavButton: {
      position: "absolute",
      zIndex: 20,
      top: "50%",
      marginTop: -25,
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: "rgba(0,0,0,0.5)",
      alignItems: "center",
      justifyContent: "center",
    },

    photoNavLeft: {
      left: 12,
    },

    photoNavRight: {
      right: 12,
    },

    addSummaryButton: {
      minHeight: 76,
      borderRadius: 17,
      paddingHorizontal: 14,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 18,
    },

    addSummaryButtonIcon: {
      width: 44,
      height: 44,
      borderRadius: 13,
      backgroundColor: "rgba(255,255,255,0.18)",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 11,
    },

    addSummaryButtonTitle: {
      color: "#FFFFFF",
      fontSize: 20,
      fontWeight: "800",
    },

    addSummaryButtonSubtitle: {
      color: "rgba(255,255,255,0.78)",
      fontSize: 15,
      marginTop: 3,
    },

    addSummaryModal: {
      flex: 1,
    },

    addSummaryHeader: {
      minHeight: 74,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 10,
      borderBottomWidth: 1,
    },

    addSummaryCloseButton: {
      width: 42,
      height: 42,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
    },

    addSummaryHeaderText: {
      flex: 1,
      marginLeft: 12,
    },

    addSummaryTitle: {
      fontSize: 20,
      fontWeight: "800",
    },

    addSummarySubtitle: {
      fontSize: 15,
      marginTop: 2,
    },

    addSummaryContent: {
      padding: 16,
      paddingBottom: 30,
    },

    formSection: {
      marginBottom: 20,
    },

    formLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 5,
    },

    formLabel: {
      fontSize: 18,
      fontWeight: "800",
      marginLeft: 7,
    },

    formHint: {
      fontSize: 15,
      lineHeight: 18,
      marginBottom: 10,
    },

    summaryInput: {
      minHeight: 160,
      borderWidth: 1,
      borderRadius: 14,
      paddingHorizontal: 13,
      paddingVertical: 12,
      fontSize: 17,
      lineHeight: 20,
    },

    photoLimit: {
      marginLeft: "auto",
      fontSize: 11,
      fontWeight: "700",
    },

    photoPreviewRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 10,
    },

    photoPreviewWrapper: {
      width: 88,
      height: 88,
      borderRadius: 12,
      overflow: "visible",
      position: "relative",
    },

    photoPreview: {
      width: "100%",
      height: "100%",
      borderRadius: 12,
    },

    gpsPreviewBadge: {
      position: "absolute",
      left: 5,
      bottom: 5,

      height: 22,

      paddingHorizontal: 6,

      borderRadius: 7,

      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",

      backgroundColor: "rgba(22,163,74,0.92)",
    },

    gpsPreviewText: {
      color: "#FFFFFF",
      fontSize: 9,
      fontWeight: "900",
      marginLeft: 2,
    },

    photoActions: {
      flexDirection: "row",
      gap: 9,
    },

    photoActionButton: {
      flex: 1,
      minHeight: 54,
      borderRadius: 13,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
    },

    photoActionText: {
      fontSize: 16,
      fontWeight: "700",
      marginLeft: 7,
    },

    gpsNotice: {
      flexDirection: "row",
      alignItems: "flex-start",

      borderWidth: 1,
      borderRadius: 13,

      padding: 12,
      marginBottom: 18,
    },

    gpsNoticeText: {
      flex: 1,

      fontSize: 12,
      lineHeight: 18,

      marginLeft: 8,
    },
  });
