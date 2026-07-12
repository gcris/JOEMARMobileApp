import { StyleSheet } from "react-native";

export const getThemeColors = (isDark: boolean) => {
  return isDark
    ? {
        bgDark: "#0B121F", // Deep Navy Space
        surfaceBlue: "#142035", // Dark Navy Card
        borderBlue: "#1E293B", // Dark Slate border
        textPrimary: "#F8FAFC", // Light Slate Text
        textSecondary: "#94A3B8", // Medium Slate Text
        textMuted: "#64748B", // Mmuted gray
        accentAmber: "#FACC15", // PNP Tactical Gold Badge Accent
        errorRed: "#FEF2F2", // Error Alert Background
        errorBg: "#1E1B1B",
        errorText: "#EF4444", // Alert bright red
        successGreen: "#10B981", // System active green
        activeGreen: "#10B981",
        white: "#FFFFFF",
        blackText: "#F8FAFC", // High contrast text
        inputBg: "#0F172A", // Inputs container
      }
    : {
        bgDark: "#F1F5F9", // Light Slate background
        surfaceBlue: "#FFFFFF", // Clean White Card
        borderBlue: "#E2E8F0", // Cool Light border
        textPrimary: "#0F172A", // Dark Charcoal Text
        textSecondary: "#475569", // Slate gray text
        textMuted: "#64748B",
        accentAmber: "#1E3A8A", // PNP Navy Primary Blue
        errorRed: "#FEF2F2",
        errorBg: "#FEF2F2",
        errorText: "#DC2626",
        successGreen: "#16A34A",
        activeGreen: "#22C55E",
        white: "#FFFFFF",
        blackText: "#0F172A",
        inputBg: "#F8FAFC",
      };
};

// Default colors (for backwards compatibility)
export const COLORS = {
  bgDark: "#F1F5F9",
  surfaceBlue: "#FFFFFF",
  borderBlue: "#E2E8F0",
  textSecondary: "#475569",
  textMuted: "#64748B",
  accentAmber: "#EA580C",
  errorRed: "#FEF2F2",
  errorText: "#DC2626",
  successGreen: "#16A34A",
  activeGreen: "#22C55E",
  white: "#FFFFFF",
  lightBlueGrad: "#0F172A",
  blackText: "#0F172A",
};

export const getStyles = (isDark: boolean) => {
  const colors = getThemeColors(isDark);

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgDark,
    },
    center: {
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
      backgroundColor: colors.bgDark,
    },
    loadingText: {
      color: colors.textSecondary,
      marginTop: 16,
      fontSize: 18,
      textAlign: "center",
    },
    scrollContent: {
      padding: 10,
      paddingBottom: 40,
    },
    headerSpacer: {
      height: 20,
    },
    brandingBox: {
      alignItems: "center",
      marginBottom: 28,
    },
    badgeShieldIcon: {
      width: 90,
      height: 90,
      borderRadius: 45,
      backgroundColor: isDark ? "#1E293B" : "#E2E8F0",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 16,
      borderWidth: 2,
      borderColor: colors.accentAmber,
      shadowColor: colors.accentAmber,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.4 : 0.1,
      shadowRadius: 10,
      elevation: 6,
    },
    badgeHeroText: {
      fontSize: 42,
    },
    pnpTitle: {
      color: colors.blackText,
      fontWeight: "900",
      fontSize: 24,
      textAlign: "center",
      letterSpacing: 1.5,
    },
    pnpSubTitle: {
      color: colors.accentAmber,
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 2.2,
      marginTop: 6,
    },
    formCard: {
      backgroundColor: colors.surfaceBlue,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.borderBlue,
      padding: 24,
      shadowColor: "#000",
      shadowOpacity: isDark ? 0.3 : 0.06,
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 12,
      elevation: 5,
    },
    cardHeader: {
      color: colors.blackText,
      fontSize: 18,
      fontWeight: "900",
      letterSpacing: 1.2,
      marginBottom: 16,
      textAlign: "center",
    },
    inputLabel: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: "800",
      letterSpacing: 0.8,
      marginBottom: 6,
      marginTop: 12,
    },
    inputContainer: {
      position: "relative",
      justifyContent: "center",
    },
    input: {
      backgroundColor: colors.inputBg,
      color: colors.blackText,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: colors.borderBlue,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 18,
    },
    inputPasswordToggle: {
      position: "absolute",
      right: 14,
      height: "100%",
      justifyContent: "center",
    },
    inputPasswordToggleText: {
      color: colors.accentAmber,
      fontSize: 15,
      fontWeight: "700",
    },
    gpsErrorBox: {
      backgroundColor: isDark ? "#2D1B1B" : "#FEF2F2",
      borderWidth: 1.5,
      borderColor: "#EF4444",
      padding: 14,
      borderRadius: 8,
      marginTop: 16,
    },
    gpsErrorTitle: {
      color: "#EF4444",
      fontSize: 14,
      fontWeight: "700",
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    gpsErrorMessage: {
      color: isDark ? "#FCA5A5" : "#991B1B",
      fontSize: 13,
      lineHeight: 18,
    },
    gpsButtonSmall: {
      backgroundColor: "#DC2626",
      borderRadius: 6,
      padding: 12,
      alignItems: "center",
      marginTop: 10,
    },
    gpsButtonText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "700",
    },
    submitBtn: {
      backgroundColor: colors.accentAmber,
      paddingVertical: 16,
      borderRadius: 8,
      alignItems: "center",
      marginTop: 24,
    },
    submitBtnText: {
      color: isDark ? "#0B121F" : "#FFFFFF",
      fontWeight: "900",
      fontSize: 18,
      letterSpacing: 1.2,
    },
    disclaimerContainer: {
      backgroundColor: isDark ? "#142035" : "#F8FAFC",
      borderLeftWidth: 4,
      borderLeftColor: colors.accentAmber,
      padding: 16,
      borderRadius: 6,
      marginTop: 24,
    },
    disclaimerHead: {
      color: colors.accentAmber,
      fontSize: 14,
      fontWeight: "700",
      letterSpacing: 0.8,
      marginBottom: 4,
    },
    disclaimerText: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },

    // --- DASHBOARD & NAVBAR ---
    navbar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: colors.surfaceBlue,
      borderBottomWidth: 1.5,
      borderBottomColor: colors.borderBlue,
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    navLeading: {
      flexDirection: "row",
      alignItems: "center",
    },
    navShield: {
      fontSize: 30,
      marginRight: 10,
    },
    navTitle: {
      color: colors.blackText,
      fontWeight: "700",
      fontSize: 18,
    },
    navSub: {
      color: colors.accentAmber,
      fontSize: 13,
      fontWeight: "700",
    },
    navTabs: {
      flexDirection: "row",
      alignItems: "center",
    },
    tab: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 6,
      marginRight: 6,
    },
    tabActive: {
      backgroundColor: isDark ? "#1E293B" : "#E2E8F0",
    },
    tabText: {
      color: colors.textSecondary,
      fontSize: 15,
      fontWeight: "700",
    },
    tabTextActive: {
      color: colors.blackText,
    },
    tabExit: {
      backgroundColor: "#DC2626",
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    tabExitText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "700",
      letterSpacing: 0.5,
    },
    dashboardContainer: {
      padding: 16,
      paddingBottom: 30,
    },
    dangerAlertBar: {
      backgroundColor: isDark ? "#2D1B1B" : "#FEF2F2",
      borderWidth: 1.5,
      borderColor: "#EF4444",
      padding: 12,
      borderRadius: 6,
      marginBottom: 16,
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      alignItems: "center",
    },
    dangerAlertText: {
      color: "#EF4444",
      fontSize: 14,
      fontWeight: "700",
      textAlign: "center",
    },
    dangerSettingsLink: {
      color: "#EF4444",
      fontSize: 14,
      fontWeight: "800",
      marginLeft: 6,
      textDecorationLine: "underline",
    },
    card: {
      backgroundColor: colors.surfaceBlue,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.borderBlue,
      padding: 18,
      marginBottom: 16,
    },
    cardHeading: {
      color: colors.accentAmber,
      fontSize: 15,
      fontWeight: "900",
      letterSpacing: 1,
      marginBottom: 12,
      borderBottomWidth: 1.5,
      borderBottomColor: colors.borderBlue,
      paddingBottom: 8,
    },
    shiftCard: {
      borderColor: colors.borderBlue,
    },
    shiftCardActive: {
      borderColor: colors.successGreen,
      borderWidth: 2,
    },
    shiftHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    statusPill: {
      backgroundColor: colors.borderBlue,
      color: colors.blackText,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 14,
      fontSize: 14,
      fontWeight: "700",
    },
    statusPillActive: {
      backgroundColor: colors.successGreen + "20",
      color: colors.successGreen,
    },
    gmtText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: "600",
    },
    activeShiftLabel: {
      color: colors.textSecondary,
      fontSize: 25,
      fontWeight: "800",
      letterSpacing: 0.8,
      marginTop: 14,
    },
    policeDutyPlate: {
      color: colors.blackText,
      fontSize: 26,
      fontWeight: "900",
      letterSpacing: 1.5,
      marginVertical: 6,
    },
    shiftDisclaimer: {
      color: colors.textSecondary,
      fontSize: 18,
      lineHeight: 18,
      margin: 14,
      textAlign: "justify",
    },
    dutyTypeSelector: {
      position: "relative",
      marginVertical: 12,
    },
    dutyTypeLabel: {
      color: colors.textSecondary,
      fontSize: 18,
      fontWeight: "600",
      marginBottom: 6,
    },
    dropdownButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: colors.borderBlue,
      borderRadius: 6,
      backgroundColor: colors.surfaceBlue,
    },
    dropdownButtonActive: {
      borderColor: colors.accentAmber,
    },
    dropdownButtonText: {
      color: colors.blackText,
      fontSize: 20,
    },
    dropdownIcon: {
      color: colors.textSecondary,
    },
    dropdownMenu: {
      position: "absolute",
      top: "100%",
      left: 0,
      right: 0,
      marginTop: 4,
      backgroundColor: colors.surfaceBlue,
      borderWidth: 1,
      borderColor: colors.borderBlue,
      borderRadius: 6,
      zIndex: 10,
    },
    dropdownItem: {
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    dropdownItemText: {
      color: colors.blackText,
      fontSize: 20,
    },
    toggleShiftBtn: {
      paddingVertical: 16,
      borderRadius: 8,
      alignItems: "center",
      marginBottom: 10,
    },
    toggleShiftBtnStart: {
      backgroundColor: colors.accentAmber,
    },
    toggleShiftBtnStop: {
      backgroundColor: "#EF4444",
    },
    toggleShiftBtnText: {
      color: isDark ? "#0B121F" : "#FFFFFF",
      fontWeight: "900",
      fontSize: 25,
      letterSpacing: 1,
    },
    syncCountsRow: {
      flexDirection: "row",
      justifyContent: "space-around",
      marginVertical: 12,
    },
    countWidget: {
      alignItems: "center",
      flex: 1,
    },
    countVal: {
      color: colors.accentAmber,
      fontSize: 58,
      fontWeight: "700",
    },
    countTitle: {
      color: colors.textSecondary,
      fontSize: 20,
      letterSpacing: 0.5,
    },
    actionsRow: {
      flexDirection: "row",
      marginTop: 14,
    },
    actionBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 6,
      alignItems: "center",
      marginHorizontal: 4,
    },
    primaryActionBtn: {
      backgroundColor: isDark ? "#1E3A8A" : "#1E3A8A",
    },
    secActionBtn: {
      backgroundColor: isDark ? "#334155" : "#64748B",
    },
    actionBtnText: {
      color: "#FFFFFF",
      fontSize: 20,
      fontWeight: "700",
      letterSpacing: 0.5,
    },
    emptyTableText: {
      color: colors.textSecondary,
      fontSize: 18,
      textAlign: "center",
      marginVertical: 14,
      fontStyle: "italic",
    },
    logRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderBottomWidth: 1,
      borderBottomColor: colors.borderBlue,
      paddingVertical: 12,
    },
    logLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    logTimeSymbol: {
      fontSize: 20,
      marginRight: 10,
    },
    logCoords: {
      color: colors.blackText,
      fontSize: 16,
      fontWeight: "700",
    },
    logCapturedText: {
      color: colors.textSecondary,
      fontSize: 13,
      marginTop: 2,
    },
    logRight: {
      alignItems: "flex-end",
    },
    logSignalText: {
      color: colors.accentAmber,
      fontSize: 13,
      fontWeight: "700",
    },
    logSpeedText: {
      color: colors.blackText,
      fontSize: 15,
      fontWeight: "700",
      marginTop: 2,
    },

    // --- SECTOR MAP REPLICA CANVAS ---
    mapReplica: {
      height: 240,
      backgroundColor: isDark ? "#0F172A" : "#EDF2F7",
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.borderBlue,
      justifyContent: "center",
      alignItems: "center",
      padding: 16,
      position: "relative",
      overflow: "hidden",
    },
    radarCrosshairHorizontal: {
      position: "absolute",
      width: "100%",
      height: 1,
      backgroundColor: isDark ? "#1E293B" : "#E2E8F0",
    },
    radarCrosshairVertical: {
      position: "absolute",
      width: 1,
      height: "100%",
      backgroundColor: isDark ? "#1E293B" : "#E2E8F0",
    },
    radarSweepCircle1: {
      position: "absolute",
      width: 100,
      height: 100,
      borderRadius: 50,
      borderWidth: 1,
      borderColor: isDark ? "#192841" : "#E2E8F0",
    },
    radarSweepCircle2: {
      position: "absolute",
      width: 200,
      height: 200,
      borderRadius: 100,
      borderWidth: 1,
      borderColor: isDark ? "#1E293B" : "#CBD5E1",
    },
    radarSweepCircle3: {
      position: "absolute",
      width: 300,
      height: 300,
      borderRadius: 150,
      borderWidth: 1,
      borderColor: isDark ? "#0F172A" : "#F1F5F9",
    },
    canvasContainer: {
      position: "absolute",
      width: "100%",
      height: "100%",
    },
    canvasPointDot: {
      position: "absolute",
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: "#10B981",
      borderWidth: 1.5,
      borderColor: "#FFFFFF",
    },
    canvasSosPointDot: {
      position: "absolute",
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: "#EF4444",
      borderWidth: 2,
      borderColor: "#FFFFFF",
    },
    mapLabelSurface: {
      position: "absolute",
      bottom: 8,
      right: 8,
      backgroundColor: isDark
        ? "rgba(15,23,42,0.95)"
        : "rgba(255,255,255,0.95)",
      borderRadius: 4,
      borderWidth: 0.5,
      borderColor: colors.borderBlue,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    mapLabelText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    mapTitle: {
      color: colors.blackText,
      fontWeight: "700",
      fontSize: 18,
      letterSpacing: 1,
    },
    mapSub: {
      color: colors.textSecondary,
      fontSize: 15,
      textAlign: "center",
      marginTop: 4,
    },
    mapLine: {
      height: 2,
      backgroundColor: colors.accentAmber,
      width: "40%",
      marginVertical: 10,
    },
    mapIndicator: {
      color: colors.accentAmber,
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 0.5,
    },
    scheduleDetailBox: {
      marginTop: 8,
    },
    schedTitle: {
      color: colors.blackText,
      fontSize: 15,
      fontWeight: "700",
      letterSpacing: 0.8,
      marginBottom: 10,
    },
    schedRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 12,
      borderBottomWidth: 1.5,
      borderBottomColor: colors.borderBlue,
    },
    schedKey: {
      color: colors.textSecondary,
      fontSize: 16,
    },
    schedValue: {
      color: colors.blackText,
      fontSize: 16,
      fontWeight: "700",
    },
    sosCard: {
      borderColor: "#EF4444",
      borderWidth: 2.5,
      backgroundColor: isDark ? "#221314" : "#FEF2F2",
      padding: 18,
      borderRadius: 12,
      marginBottom: 16,
      alignItems: "center",
    },
    sosHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      width: "100%",
      marginBottom: 12,
    },
    sosPill: {
      backgroundColor: "#EF4444",
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "700",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 4,
      overflow: "hidden",
    },
    sosWarningText: {
      color: "#EF4444",
      fontWeight: "900",
      fontSize: 20,
      letterSpacing: 1.5,
      alignSelf: "center",
    },
    sosDesc: {
      color: isDark ? "#FCA5A5" : "#7F1D1D",
      fontSize: 18,
      textAlign: "center",
      marginBottom: 16,
      lineHeight: 20,
    },
    sosTriggerButton: {
      backgroundColor: "#DC2626",
      borderRadius: 50,
      width: 100,
      height: 100,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 4,
      borderColor: "#FCA5A5",
      shadowColor: "#EF4444",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.6,
      shadowRadius: 10,
      elevation: 8,
    },
    sosTriggerText: {
      color: "#FFFFFF",
      fontWeight: "900",
      fontSize: 40,
      letterSpacing: 1.5,
    },
    sosTriggerSubText: {
      color: "#FCA5A5",
      fontWeight: "700",
      fontSize: 12,
    },
    logRowSos: {
      borderLeftWidth: 4,
      borderLeftColor: "#EF4444",
      backgroundColor: isDark ? "#3A1416" : "#FEE2E2",
    },
    logRowSosText: {
      color: "#EF4444",
      fontWeight: "700",
    },
    patrolNotificationBar: {
      backgroundColor: "#DC2626", // Red alert background
      borderBottomWidth: 1.5,
      borderBottomColor: "#F87171",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      paddingHorizontal: 14,
      width: "100%",
    },
    patrolNotificationInfo: {
      flex: 1,
      marginRight: 10,
    },
    patrolNotificationTitle: {
      color: "#FFFFFF",
      fontWeight: "700",
      fontSize: 15,
      letterSpacing: 0.5,
    },
    patrolNotificationSub: {
      color: "#FEE2E2",
      fontSize: 16,
    },
    patrolNotificationButtonSos: {
      backgroundColor: "#7F1D1D",
      borderWidth: 1.5,
      borderColor: "#FFFFFF",
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
    },
    patrolNotificationButtonSosText: {
      color: "#FFFFFF",
      fontWeight: "900",
      fontSize: 17,
      letterSpacing: 1,
    },
  });
};

// Static default styles (for legacy compatibility)
export const globalStyles = getStyles(true);
