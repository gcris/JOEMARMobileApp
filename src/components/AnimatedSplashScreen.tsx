import React, { useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Animated,
  Easing,
  Dimensions,
} from "react-native";

const { width } = Dimensions.get("window");

interface AnimatedSplashScreenProps {
  onFinish: () => void;
  isDarkTheme: boolean;
}

export const AnimatedSplashScreen: React.FC<AnimatedSplashScreenProps> = ({
  onFinish,
  isDarkTheme,
}) => {
  const colors = isDarkTheme
    ? {
        bg: "#0B121F",
        textMain: "#F8FAFC",
        textSec: "#94A3B8",
        tacticalGold: "#FACC15",
        policeBlue: "#1E3A8A",
        laserGreen: "#10B981",
      }
    : {
        bg: "#F1F5F9",
        textMain: "#0F172A",
        textSec: "#475569",
        tacticalGold: "#1E3A8A",
        policeBlue: "#2563EB",
        laserGreen: "#16A34A",
      };

  // Screen/Overall Scale
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const contentFadeAnim = useRef(new Animated.Value(0)).current;

  // Breathing Pulse for Official Logo (Fade In & Out Loop)
  const logoOpacity = useRef(new Animated.Value(0)).current;

  // Moving ground telemetry
  const gridCycle = useRef(new Animated.Value(0)).current; // 0 to 1 loop for moving ground

  // Loading Protocol States
  const [terminalLog, setTerminalLog] = useState<string>(
    "Initializing secure SQLite engine...",
  );
  const [percent, setPercent] = useState<number>(0);

  useEffect(() => {
    // 1. Fade in screen content on mount
    Animated.timing(contentFadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // 2. Logo Fade In & Breathing Loop
    Animated.sequence([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 1000,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(logoOpacity, {
            toValue: 0.35,
            duration: 1300,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(logoOpacity, {
            toValue: 1,
            duration: 1300,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ),
    ]).start();

    // 3. Loop moving ground grid
    Animated.loop(
      Animated.timing(gridCycle, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();

    // 4. Progress percentage and boot logs simulator
    const progressInterval = setInterval(() => {
      setPercent((prev) => {
        const next = prev + Math.floor(Math.random() * 8) + 4;
        return next > 100 ? 100 : next;
      });
    }, 140);

    const logs = [
      "Establishing TLS encrypted proxy handshake...",
      "Binding cell tower signals and sector vectors...",
      "Caching Local Tracking Database indexes...",
      "Verifying Supabase MFA session profiles...",
      "Pre-fetching active foot schedules...",
      "Arming background distress beacon systems...",
      "Ilocos Norte Patrol Console secured.",
    ];

    let logIndex = 0;
    const logInterval = setInterval(() => {
      if (logIndex < logs.length) {
        setTerminalLog(logs[logIndex]);
        logIndex++;
      }
    }, 450);

    // 5. Exit transition after 3.8 seconds
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }).start(() => {
        clearInterval(progressInterval);
        clearInterval(logInterval);
        onFinish();
      });
    }, 3850);

    return () => {
      clearTimeout(timer);
      clearInterval(progressInterval);
      clearInterval(logInterval);
    };
  }, []);

  // Moving ground dashed lines
  const gridTranslateX = gridCycle.interpolate({
    inputRange: [0, 1],
    outputRange: [60, 0], // moves to the left representing patrolling forward
  });

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: colors.bg, opacity: fadeAnim },
      ]}
    >
      <Animated.View style={[styles.content, { opacity: contentFadeAnim }]}>
        {/* Decorative Radar Scanning Circles */}
        <View style={styles.gridHolder}>
          <View
            style={[
              styles.radialWave,
              {
                borderColor: isDarkTheme ? "#1E293B" : "#E2E8F0",
                width: 330,
                height: 330,
                borderRadius: 165,
              },
            ]}
          />
          <View
            style={[
              styles.radialWave,
              {
                borderColor: isDarkTheme ? "#1E293B" : "#E2E8F0",
                width: 220,
                height: 220,
                borderRadius: 110,
              },
            ]}
          />
        </View>

        {/* Tactical Badge Header */}
        <View style={styles.headerBlock}>
          <Text style={[styles.brandPre, { color: colors.tacticalGold }]}>
            Ilocos Norte Police Provincial Office
          </Text>
          <Text style={[styles.brandTitle, { color: colors.textMain }]}>
            Patrol Tracker v1.0
          </Text>
        </View>

        {/* OFFICIAL ILOCOS NORTE PNP EMBLEM */}
        <View style={styles.logoStage}>
          <Animated.Image
            source={require("../assets/logo.png")}
            style={[styles.logoImage, { opacity: logoOpacity }]}
            resizeMode="contain"
          />
        </View>

        {/* Patrolling Sector Ground Plane Grid */}
        <View style={styles.gridGroundSection}>
          <View
            style={[
              styles.solidGroundRule,
              { backgroundColor: colors.textSec, opacity: 0.25 },
            ]}
          />
          <Animated.View
            style={[
              styles.dashedMovingGrid,
              { transform: [{ translateX: gridTranslateX }] },
            ]}
          >
            {Array.from({ length: 15 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.movingGridTick,
                  {
                    backgroundColor:
                      i % 2 === 0 ? colors.tacticalGold : colors.laserGreen,
                    opacity: 0.7,
                  },
                ]}
              />
            ))}
          </Animated.View>
        </View>

        {/* Terminal Logging Section */}
        <View style={styles.terminalOverlay}>
          <View style={styles.statusBarBlock}>
            <View
              style={[
                styles.ledIndicator,
                { backgroundColor: colors.laserGreen },
              ]}
            />
            <Text
              style={[styles.systemOnlineText, { color: colors.laserGreen }]}
            >
              SECURING COMS CHANNEL
            </Text>
          </View>

          <Text
            style={[styles.terminalText, { color: colors.textMain }]}
            numberOfLines={1}
          >
            {`> `}
            {terminalLog}
          </Text>

          {/* Graphical Loading Bar */}
          <View
            style={[
              styles.pnpProgressBarBg,
              { backgroundColor: isDarkTheme ? "#1A2333" : "#E2E8F0" },
            ]}
          >
            <View
              style={[
                styles.pnpProgressBarFill,
                { width: `${percent}%`, backgroundColor: colors.tacticalGold },
              ]}
            />
          </View>

          <View style={styles.percentageRow}>
            <Text style={[styles.percentLabel, { color: colors.textSec }]}>
              SECURE TELEMETRY BINDING
            </Text>
            <Text
              style={[styles.percentLabelVal, { color: colors.tacticalGold }]}
            >
              {percent}%
            </Text>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 24,
  },
  gridHolder: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    top: 50,
    zIndex: -1,
  },
  radialWave: {
    position: "absolute",
    borderWidth: 2,
    borderStyle: "dashed",
    opacity: 0.12,
  },
  headerBlock: {
    alignItems: "center",
    marginBottom: 35,
  },
  brandPre: {
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 2.5,
    marginBottom: 6,
    textAlign: "center",
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 1.5,
    textAlign: "center",
  },
  brandSub: {
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 4,
    marginTop: 6,
    textAlign: "center",
  },
  logoStage: {
    width: 200,
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 35,
  },
  logoImage: {
    width: 170,
    height: 195,
  },
  gridGroundSection: {
    width: "100%",
    height: 35,
    position: "relative",
    overflow: "hidden",
    marginBottom: 35,
  },
  solidGroundRule: {
    width: "100%",
    height: 4,
    borderRadius: 2,
  },
  dashedMovingGrid: {
    flexDirection: "row",
    width: width + 120,
    marginTop: 12,
    paddingLeft: 20,
  },
  movingGridTick: {
    width: 16,
    height: 5,
    borderRadius: 2.5,
    marginRight: 24,
  },
  terminalOverlay: {
    width: "100%",
    padding: 20,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  statusBarBlock: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  ledIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  systemOnlineText: {
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  terminalText: {
    fontSize: 15,
    fontWeight: "800",
    fontFamily: "System",
    marginBottom: 16,
    height: 24,
  },
  pnpProgressBarBg: {
    height: 10,
    borderRadius: 5,
    width: "100%",
    overflow: "hidden",
    marginBottom: 10,
  },
  pnpProgressBarFill: {
    height: "100%",
    borderRadius: 5,
  },
  percentageRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  percentLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  percentLabelVal: {
    fontSize: 16,
    fontWeight: "900",
  },
});
