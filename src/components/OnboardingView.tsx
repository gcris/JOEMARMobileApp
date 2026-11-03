import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
  Platform,
  StatusBar,
  useWindowDimensions,
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
  tooltipPosition: "above" | "below";
  icon: keyof typeof Ionicons.glyphMap;
}

const STEPS: OnboardingStep[] = [
  {
    id: "header",
    refKey: "header",
    title: "Welcome",
    body: "View your active personnel profile and system status right from the top dashboard header.",
    tooltipPosition: "below",
    icon: "person-circle-outline",
  },
  {
    id: "dutyDropdown",
    refKey: "dutyDropdown",
    title: "Select Duty & Patrol Mode",
    body: "Choose your assigned duty activity (e.g., Foot Patrolling, Mobile Patrol) before initiating tracking.",
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
    body: "Tap this red action button at any time to immediately send a distress signal or log an urgent field incident.",
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

// Space between the spotlight and the tooltip
const TOOLTIP_GAP = 16;
// Keep the tooltip clear of the status bar and the progress dots
const TOP_MARGIN = 40;
const BOTTOM_MARGIN = 80;

// On Android, measureInWindow() is relative to the area BELOW the status bar,
// but a Modal with statusBarTranslucent starts at the very top of the screen.
// Adding the status bar height lines the spotlight up with the real element.
// If your app already draws behind the status bar (edge-to-edge / translucent
// StatusBar), measurements already include it: set this to 0.
const STATUS_BAR_OFFSET =
  Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0;

// Fine-tune if the spotlight is still slightly off (positive = move down,
// negative = move up), in dp.
const MANUAL_Y_ADJUST = 0;

const Y_OFFSET = STATUS_BAR_OFFSET + MANUAL_Y_ADJUST;

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
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [spotlightLayout, setSpotlightLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  // Real tooltip height (measured), used to place it above a target
  const [tooltipHeight, setTooltipHeight] = useState(200);

  const spotlightAnim = useRef(new Animated.Value(0)).current;
  const tooltipAnim = useRef(new Animated.Value(0)).current;

  const step = STEPS[activeStepIndex];
  const isLast = activeStepIndex === STEPS.length - 1;

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

  // Measure the target element for the current step
  useEffect(() => {
    if (!visible || !tourRefs) return;

    let cancelled = false;

    // Used only if the target can't be measured
    const fallbackLayout = {
      x: 16,
      y: 120,
      width: screenWidth - 32,
      height: 80,
    };

    const finish = (layout: typeof fallbackLayout) => {
      if (cancelled) return;
      setSpotlightLayout(layout);
      startAnimations();
    };

    // Fade the tooltip in again for every step
    tooltipAnim.setValue(0);

    const timer = setTimeout(() => {
      const target = tourRefs[step.refKey]?.current;

      if (!target) {
        finish(fallbackLayout);
        return;
      }

      // measureInWindow works with the Modal's statusBarTranslucent setting,
      // so coordinates line up on Android and iOS.
      target.measureInWindow((x, y, width, height) => {
        if (
          typeof x === "number" &&
          typeof y === "number" &&
          typeof width === "number" &&
          typeof height === "number" &&
          width > 0 &&
          height > 0
        ) {
          finish({ x, y: y + Y_OFFSET, width, height });
        } else {
          finish(fallbackLayout);
        }
      });
    }, 50);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStepIndex, visible, step.refKey, tourRefs, screenWidth]);

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
        statusBarTranslucent
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={localStyles.overlay} />
      </Modal>
    );
  }

  const { x, y, width, height } = spotlightLayout;
  const centerX = x + width / 2;

  // ---------------------------------------------------------------------
  // Tooltip position (same rule for every step, including the header)
  // ---------------------------------------------------------------------
  const tooltipWidth = Math.min(340, screenWidth - 32);

  let tooltipX = centerX - tooltipWidth / 2;
  tooltipX = Math.max(16, Math.min(screenWidth - tooltipWidth - 16, tooltipX));

  const belowY = y + height + TOOLTIP_GAP;
  const aboveY = y - tooltipHeight - TOOLTIP_GAP;

  let tooltipY = step.tooltipPosition === "above" ? aboveY : belowY;

  // Flip to the other side if the preferred side doesn't fit
  if (
    tooltipY < TOP_MARGIN &&
    belowY + tooltipHeight <= screenHeight - BOTTOM_MARGIN
  ) {
    tooltipY = belowY;
  } else if (
    tooltipY + tooltipHeight > screenHeight - BOTTOM_MARGIN &&
    aboveY >= TOP_MARGIN
  ) {
    tooltipY = aboveY;
  }

  // Final clamp so it always stays on screen
  tooltipY = Math.max(
    TOP_MARGIN,
    Math.min(screenHeight - tooltipHeight - BOTTOM_MARGIN, tooltipY),
  );

  const tooltipStyle = {
    transform: [{ translateX: tooltipX }, { translateY: tooltipY }],
    opacity: tooltipAnim,
  } as any;

  return (
    <Modal
      visible={visible}
      transparent={true}
      statusBarTranslucent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={localStyles.overlay}>
        {/* Spotlight cutout */}
        <Animated.View
          style={[
            localStyles.spotlight,
            {
              transform: [{ translateX: x }, { translateY: y }],
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
          style={[localStyles.tooltip, { width: tooltipWidth }, tooltipStyle]}
          pointerEvents="box-none"
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (Math.abs(h - tooltipHeight) > 1) setTooltipHeight(h);
          }}
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
    top: 0,
    left: 0,
    backgroundColor: "transparent",
    borderWidth: 3,
    borderColor: "#FACC15",
  },
  tooltip: {
    position: "absolute",
    top: 0,
    left: 0,
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
