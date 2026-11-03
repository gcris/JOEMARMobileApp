import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import {
  MapView,
  Camera,
  CameraRef,
  ShapeSource,
  CircleLayer,
  LineLayer,
} from "@maplibre/maplibre-react-native";

// CartoDB Positron style — free, public, no API key required
const MAP_STYLE_URL =
  process.env.EXPO_PUBLIC_MAP_STYLE_URL ||
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

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
