import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, ViewStyle } from "react-native";
import LottieView from "lottie-react-native";

// ============================================================
// SPLASH SCREEN PROPS
// ============================================================

interface AnimatedSplashScreenProps {
  onFinish: () => void;
  isDarkTheme: boolean;
}

// ============================================================
// CONFIGURATION
// ============================================================

// Total time before the exit animation begins.
const SPLASH_DISPLAY_DURATION = 2500;

// Logo fade-in duration.
const LOGO_ENTRANCE_DURATION = 500;

// Logo fade-out duration.
const LOGO_EXIT_DURATION = 1300;

// ============================================================
// ANIMATED SPLASH SCREEN
// ============================================================

export const AnimatedSplashScreen: React.FC<AnimatedSplashScreenProps> = ({
  onFinish,
  isDarkTheme,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  const finishingRef = useRef(false);

  useEffect(() => {
    // ========================================================
    // LOGO ENTRANCE
    // ========================================================

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: LOGO_ENTRANCE_DURATION,
        useNativeDriver: true,
      }),

      Animated.spring(scale, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // ========================================================
    // WAIT BEFORE EXIT
    // ========================================================

    const timer = setTimeout(() => {
      if (finishingRef.current) {
        return;
      }

      finishingRef.current = true;

      // ======================================================
      // LOGO EXIT
      // ======================================================

      Animated.timing(opacity, {
        toValue: 0,
        duration: LOGO_EXIT_DURATION,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          onFinish();
        }
      });
    }, SPLASH_DISPLAY_DURATION);

    // ========================================================
    // CLEANUP
    // ========================================================

    return () => {
      clearTimeout(timer);

      opacity.stopAnimation();
      scale.stopAnimation();
    };
  }, [opacity, scale, onFinish]);

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.simpleSplashContainer,
        {
          backgroundColor: isDarkTheme ? "#07111F" : "#FFFFFF",
          opacity,
        },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={{
          transform: [{ scale }],
        }}
      >
        <LottieView
          source={require("../assets/police_patrol.json")}
          autoPlay
          loop
          resizeMode="contain"
          style={styles.simpleSplashLogo}
        />
      </Animated.View>
    </Animated.View>
  );
};

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  simpleSplashContainer: {
    ...StyleSheet.absoluteFillObject,

    justifyContent: "center",
    alignItems: "center",
  },

  simpleSplashLogo: {
    width: 260,
    height: 260,
  },
});
