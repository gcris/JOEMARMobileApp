import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import {
  MapView,
  Camera,
  CameraRef,
  ShapeSource,
  CircleLayer,
  LineLayer,
  setAccessToken,
} from "@maplibre/maplibre-react-native";
import Constants from 'expo-constants';

// Use environment variable for style URL or fall back to Mapbox Streets
const MAP_STYLE_URL =
  process.env.EXPO_PUBLIC_MAP_STYLE_URL ||
  "mapbox://styles/mapbox/streets-v12";

interface PatrolMapProps {
  children?: React.ReactNode;
  centerCoordinate?: [number, number]; // [lng, lat]
  zoomLevel?: number;
  style?: any;
}

export const PatrolMap: React.FC<PatrolMapProps> = ({
  children,
  centerCoordinate = [120.5936, 18.1978], // Ilocos Norte default
  zoomLevel = 10,
  style
}) => {
  const cameraRef = useRef<CameraRef>(null);

  // Set Mapbox access token for authentication with tile server
  useEffect(() => {
    const mapboxKey = process.env.MAPBOX_API_KEY;
    if (mapboxKey) {
      setAccessToken(mapboxKey);
    }
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, style]}>
      <MapView
        style={StyleSheet.absoluteFill}
        mapStyle={MAP_STYLE_URL}
        logoEnabled={false}
        attributionEnabled={true}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: centerCoordinate, // [lng, lat]
            zoomLevel: zoomLevel,
          }}
        />
        {children}
      </MapView>

      {/* OSM Attribution */}
      <View style={styles.attributionContainer}>
        <Text style={styles.attributionText}>© OpenStreetMap contributors</Text>
      </View>
    </View>
  );
};

// Export shapes for reusability
export const PatrolMapShapes = {
  ShapeSource,
  CircleLayer,
  LineLayer,
};

const styles = StyleSheet.create({
  attributionContainer: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  attributionText: {
    fontSize: 10,
    color: '#333',
  },
});
