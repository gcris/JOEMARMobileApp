import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
  UIManager,
  findNodeHandle,
} from "react-native";
import { getThemeColors } from "../theme/styles";
import Ionicons from "@expo/vector-icons/Ionicons";

export interface OnboardingTourRef {
  header: React.RefObject<View>;
  patrolTracker: React.RefObject<View>;
  dutyDropdown: React.RefObject<View>;
  patrolButton: React.RefObject<View>;
  syncCard: React.RefObject<View>;
  sosButton: React.RefObject<View>;
  bottomNav: React.RefObject<View>;
}

interface OnboardingStep {
  id: string;
  refKey: keyof OnboardingTourRef;
  title: string;
  body: string;
  tooltipPosition: "above" | "below" | "left" | "right";
  icon: keyof typeof Ionicons.glyphMap;
}

const STEPS: OnboardingStep[] = [
  {
    id: "header",
    refKey: "header",
    title: "Welcome Officer",
    body: "View your active officer profile and system status right from the top dashboard header.",
    tooltipPosition: "below",
    icon: "person-circle-outline",
  },
  {
    id: "dutyDropdown",
    refKey: "dutyDropdown",
    title: "Select Duty & Patrol Mode",
    body: "Choose your assigned duty type (e.g., Foot Patrolling, Mobile Patrol) before initiating tracking.",
    tooltipPosition: "below",
    icon: "list-outline",
  },
  {
    id: "patrolButton",
    refKey: "patrolButton",
    title: "Start Live Tracking",
    body: "Tap here to initiate GPS coordinate recording. Tracking runs locally and continues even when the app is minimized.",
    tooltipPosition: "below",
    icon: "play-circle-outline",
  },
  {
    id: "syncCard",
    refKey: "syncCard",
    title: "Offline Sync Manager",
    body: "Monitor pending offline patrol logs here. Coordinates automatically sync to the server when an internet connection is detected.",
    tooltipPosition: "above",
    icon: "cloud-upload-outline",
  },
  {
    id: "sosButton",
    refKey: "sosButton",
    title: "Distress Signal",
    body: "Tap this red action button at any time to immediately send an distress signal or log an urgent field incident.",
    tooltipPosition: "above",
    icon: "alert-circle-outline",
  },
  {
    id: "bottomNav",
    refKey: "bottomNav",
    title: "Quick Navigation",
    body: "Switch between your active Home screen, past Recent Logs, Patrol Summary reports, and Account settings.",
    tooltipPosition: "above",
    icon: "grid-outline",
  },
];

interface OnboardingViewProps {
  isDarkTheme: boolean;
  visible: boolean;
  onClose: () => void;
  tourRefs: OnboardingTourRef;
}

export const OnboardingView = ({
  isDarkTheme,
  visible,
  onClose,
  tourRefs,
}: OnboardingViewProps) => {
  const colors = getThemeColors(isDarkTheme);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [spotlightLayout, setSpotlightLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const spotlightAnim = useRef(new Animated.Value(0)).current;
  const tooltipAnim = useRef(new Animated.Value(0)).current;
  const spotlightRef = useRef<View>(null);

  const step = STEPS[activeStepIndex];
  const isLast = activeStepIndex === STEPS.length - 1;

  // Measure target element and animate spotlight safely
  useEffect(() => {
    if (!visible || !tourRefs) return;

    const ref = tourRefs[step.refKey];
    
    // Fallback default center coordinates if ref isn't ready yet
    const fallbackLayout = { x: 50, y: 150, width: 300, height: 100 };

    if (!ref || !ref.current) {
      // Use fallback so it doesn't get stuck hidden
      setSpotlightLayout(fallbackLayout);
      startAnimations();
      return;
    }

    const handle = findNodeHandle(ref.current);
    if (!handle) {
      setSpotlightLayout(fallbackLayout);
      startAnimations();
      return;
    }

    const timer = setTimeout(() => {
      UIManager.measureInWindow(handle, (x, y, width, height) => {
        if (
          typeof x === "number" &&
          typeof y === "number" &&
          typeof width === "number" &&
          typeof height === "number" &&
          width > 0 &&
          height > 0
        ) {
          setSpotlightLayout({ x, y, width, height });
        } else {
          setSpotlightLayout(fallbackLayout); // Fallback if measurement is 0
        }
        startAnimations();
      });
    }, 50);

    return () => clearTimeout(timer);
  }, [activeStepIndex, visible, step.refKey, tourRefs]);

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(spotlightAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(tooltipAnim, {
        toValue: 1,
        duration: 300,
        delay: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Reset when hidden
  useEffect(() => {
    if (!visible) {
      setActiveStepIndex(0);
      spotlightAnim.setValue(0);
      tooltipAnim.setValue(0);
      setSpotlightLayout(null);
    }
  }, [visible, spotlightAnim, tooltipAnim]);

  if (!visible) return null;

  const goNext = () => {
    if (isLast) {
      onClose();
      return;
    }
    setActiveStepIndex((prev) => prev + 1);
  };

  const goPrev = () => {
    setActiveStepIndex((prev) => Math.max(0, prev - 1));
  };

  const goSkip = () => {
    onClose();
  };

  if (!spotlightLayout) {
    return (
      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={localStyles.overlay} />
      </Modal>
    );
  }

  const { x, y, width, height } = spotlightLayout;
  const centerX = x + width / 2;

  // Tooltip positioning
  const tooltipWidth = Math.min(320, width * 2.5);
  let tooltipX = centerX - tooltipWidth / 2;
  let tooltipY: number;

  if (step.id === "header") {
    // FORCE Step 1 to sit right below the header without relying on measured Y offset
    tooltipY = 140; // Adjust this number smaller (e.g. 110) to go higher, or larger to go down
  } else if (step.tooltipPosition === "above") {
    tooltipY = y - (step.id === "sosButton" ? 260 : 210);
  } else {
    tooltipY = y + height + 20;
  }

  // Clamp tooltip to screen bounds
  const screenWidth = 390; 
  tooltipX = Math.max(16, Math.min(screenWidth - tooltipWidth - 16, tooltipX));
  
  // Lower the floor clamp so it isn't blocked from moving up
  tooltipY = Math.max(40, tooltipY);

  const tooltipStyle = {
    transform: [
      { translateX: tooltipX },
      { translateY: tooltipY },
    ],
    opacity: tooltipAnim,
  } as any;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={localStyles.overlay}>
        {/* Spotlight cutout */}
        <Animated.View
          ref={spotlightRef}
          style={[
            localStyles.spotlight,
            {
              transform: [
                { translateX: x },
                { translateY: y },
              ],
              width,
              height,
              borderRadius: 14,
              opacity: spotlightAnim,
            },
          ]}
          pointerEvents="none"
        />

        {/* Tooltip */}
        <Animated.View
          style={[
            localStyles.tooltip,
            { width: tooltipWidth },
            tooltipStyle,
          ]}
          pointerEvents="box-none"
        >
          <View style={localStyles.tooltipContent}>
            <View style={localStyles.tooltipHeader}>
              <View
                style={[
                  localStyles.tooltipIconCircle,
                  {
                    backgroundColor: isDarkTheme
                      ? "rgba(250,204,21,0.12)"
                      : "#EFF6FF",
                  },
                ]}
              >
                <Ionicons
                  name={step.icon}
                  size={24}
                  color={colors.accentAmber}
                />
              </View>
              <View style={localStyles.tooltipTitleWrap}>
                <Text style={localStyles.tooltipTitle}>{step.title}</Text>
                <Text style={localStyles.tooltipStepCounter}>
                  Step {activeStepIndex + 1} of {STEPS.length}
                </Text>
              </View>
            </View>
            <Text style={localStyles.tooltipBody}>{step.body}</Text>

            <View style={localStyles.tooltipActions}>
              <TouchableOpacity
                onPress={goSkip}
                activeOpacity={0.7}
                style={localStyles.ghostButton}
              >
                <Text style={localStyles.ghostButtonText}>Skip</Text>
              </TouchableOpacity>

              {activeStepIndex > 0 && (
                <TouchableOpacity
                  onPress={goPrev}
                  activeOpacity={0.7}
                  style={localStyles.ghostButton}
                >
                  <Text style={localStyles.ghostButtonText}>Back</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={goNext}
                activeOpacity={0.8}
                style={[
                  localStyles.primaryButton,
                  { backgroundColor: colors.accentAmber },
                ]}
              >
                <Text
                  style={[
                    localStyles.primaryButtonText,
                    { color: isDarkTheme ? "#0B121F" : "#FFFFFF" },
                  ]}
                >
                  {isLast ? "Done" : "Next"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* Progress dots at bottom */}
        <View style={localStyles.progressDots}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                localStyles.progressDot,
                {
                  backgroundColor:
                    i <= activeStepIndex
                      ? colors.accentAmber
                      : colors.borderBlue,
                  width: i === activeStepIndex ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>
      </View>
    </Modal>
  );
};

const localStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(2,8,20,0.85)",
  },
  spotlight: {
    position: "absolute",
    backgroundColor: "transparent",
    borderWidth: 3,
    borderColor: "#FACC15",
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  tooltip: {
    position: "absolute",
    backgroundColor: "#142035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#263449",
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 12,
  },
 tooltipArrow: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8, // Adjust width/height to change the tip size
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    // Change this background color to match your tooltip card background
    // borderBottomColor: isDarkTheme ? "#142035" : "#FFFFFF", 
    alignSelf: "center",
    marginTop: -8, // Pulls it slightly up to overlap the card edge cleanly
  },
  tooltipContent: {},
  tooltipHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  tooltipIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  tooltipTitleWrap: { flex: 1 },
  tooltipTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#F8FAFC",
  },
  tooltipStepCounter: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
    marginTop: 2,
  },
  tooltipBody: {
    fontSize: 15,
    lineHeight: 22,
    color: "#CBD5E1",
    marginBottom: 18,
  },
  tooltipActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ghostButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  ghostButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#94A3B8",
  },
  primaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    minWidth: 80,
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  progressDots: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  progressDot: {
    height: 8,
    borderRadius: 4,
  },
});