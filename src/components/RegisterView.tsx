import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { getStyles, getThemeColors } from "../theme/styles";
import { getRanks, getUnits } from "../services/database";

interface RegisterViewProps {
  onRegister: (data: {
    email: string;
    badge_number: string;
    rank_id: string;
    fullname: string;
    unit_id: string;
    designation: string;
    phone_number: string;
    viber_number: string;
    password?: string;
  }) => Promise<{ success: boolean; message: string }>;
  onBackToLogin: () => void;
  isDarkTheme: boolean;
}

export const RegisterView = ({
  onRegister,
  onBackToLogin,
  isDarkTheme,
}: RegisterViewProps) => {
  const styles = getStyles(isDarkTheme);
  const colors = getThemeColors(isDarkTheme);

  // Form Fields State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [badgeNumber, setBadgeNumber] = useState("");
  const [rankId, setRankId] = useState("");
  const [fullname, setFullname] = useState("");
  const [unitId, setUnitId] = useState("");
  const [designation, setDesignation] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [viberNumber, setViberNumber] = useState("");

  // Dropdown options loaded dynamically from DB
  const [ranks, setRanks] = useState<{ id: string; rankName: string }[]>([]);
  const [units, setUnits] = useState<{ id: string; unitName: string }[]>([]);

  // Custom picker dropdown visibility toggles
  const [showRankDropdown, setShowRankDropdown] = useState(false);
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load ranks and units from SQLite database of PNP
  useEffect(() => {
    let active = true;
    const loadMetadata = async () => {
      try {
        const loadedRanks = await getRanks();
        const loadedUnits = await getUnits();
        if (active) {
          setRanks(loadedRanks);
          setUnits(loadedUnits);
          if (loadedRanks.length > 0) setRankId(loadedRanks[0].id);
          if (loadedUnits.length > 0) setUnitId(loadedUnits[0].id);
        }
      } catch (err) {
        console.error("Failed to load metadata dropdowns", err);
      }
    };
    loadMetadata();
    return () => {
      active = false;
    };
  }, []);

  const handleRegisterSubmit = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validate email
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setErrorMessage("Please enter a valid official email address.");
      return;
    }
    // Validate password
    const trimmedPassword = password.trim();
    if (!trimmedPassword || trimmedPassword.length < 6) {
      setErrorMessage("Please set a secure password of at least 6 characters.");
      return;
    }
    // Validate badge code
    const trimmedBadge = badgeNumber.trim();
    if (!trimmedBadge) {
      setErrorMessage("Please enter your official badge identifier.");
      return;
    }
    // Validate rank
    if (!rankId) {
      setErrorMessage("Please select your personnel rank designation.");
      return;
    }
    // Validate fullname
    const trimmedFullname = fullname.trim();
    if (!trimmedFullname) {
      setErrorMessage(
        "Please provide your complete full name matching your PNP ID.",
      );
      return;
    }
    // Validate unit
    if (!unitId) {
      setErrorMessage("Please select your assigned unit district.");
      return;
    }
    // Validate designation
    const trimmedDesignation = designation.trim();
    if (!trimmedDesignation) {
      setErrorMessage(
        "Please specify your role/designation (e.g. Patrol Officer).",
      );
      return;
    }
    // Validate phone and viber number
    const trimmedPhone = phoneNumber.trim();
    const trimmedViber = viberNumber.trim();
    if (!trimmedPhone) {
      setErrorMessage("Please enter your mobile phone number.");
      return;
    }
    if (!trimmedViber) {
      setErrorMessage("Please enter your Viber contact number.");
      return;
    }

    setLoading(true);
    const result = await onRegister({
      email: trimmedEmail,
      badge_number: trimmedBadge,
      rank_id: rankId,
      fullname: trimmedFullname,
      unit_id: unitId,
      designation: trimmedDesignation,
      phone_number: trimmedPhone,
      viber_number: trimmedViber,
      password: trimmedPassword,
    });
    setLoading(false);

    if (result.success) {
      setSuccessMessage(result.message);
    } else {
      setErrorMessage(result.message);
    }
  };

  const activeRankName =
    ranks.find((r) => r.id === rankId)?.rankName || "Select Rank";
  const activeUnitName =
    units.find((u) => u.id === unitId)?.unitName || "Select Unit";

  // If successfully registered, show a gorgeous, highly-styled confirmation dashboard
  if (successMessage) {
    return (
      <ScrollView
        contentContainerStyle={{
          padding: 24,
          justifyContent: "center",
          flexGrow: 1,
        }}
        style={{ backgroundColor: colors.bgDark }}
      >
        <View
          style={{
            backgroundColor: isDarkTheme ? "#142035" : "#FFFFFF",
            borderRadius: 20,
            padding: 24,
            borderWidth: 1.5,
            borderColor: "#10B981",
            alignItems: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 10,
            elevation: 5,
          }}
        >
          <Text style={{ fontSize: 50, marginBottom: 16 }}>📋</Text>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "bold",
              color: "#10B981",
              textAlign: "center",
              marginBottom: 12,
            }}
          >
            PROFILE REGISTRATION SUBMITTED
          </Text>
          <View
            style={{
              width: 40,
              height: 3,
              backgroundColor: "#10B981",
              borderRadius: 2,
              marginBottom: 16,
            }}
          />

          <Text
            style={{
              color: isDarkTheme ? "#E2E8F0" : "#0F172A",
              fontSize: 13,
              textAlign: "center",
              lineHeight: 22,
              marginBottom: 20,
            }}
          >
            {successMessage}
          </Text>

          <View
            style={{
              backgroundColor: isDarkTheme ? "#1E293B" : "#F1F5F9",
              padding: 16,
              borderRadius: 12,
              width: "100%",
              marginBottom: 24,
              borderWidth: 0.5,
              borderColor: isDarkTheme ? "#334155" : "#E2E8F0",
            }}
          >
            <Text
              style={{
                color: isDarkTheme ? "#94A3B8" : "#475569",
                fontSize: 10,
                fontWeight: "bold",
                letterSpacing: 0.5,
                marginBottom: 8,
              }}
            >
              VERIFICATION SPECIFICATIONS:
            </Text>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <Text
                style={{
                  color: isDarkTheme ? "#64748B" : "#64748B",
                  fontSize: 11,
                }}
              >
                Badge Number:
              </Text>
              <Text
                style={{
                  color: isDarkTheme ? "#F8FAFC" : "#0F172A",
                  fontSize: 11,
                  fontWeight: "bold",
                }}
              >
                {badgeNumber}
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <Text
                style={{
                  color: isDarkTheme ? "#64748B" : "#64748B",
                  fontSize: 11,
                }}
              >
                Officer Rank:
              </Text>
              <Text
                style={{
                  color: isDarkTheme ? "#F8FAFC" : "#0F172A",
                  fontSize: 11,
                  fontWeight: "bold",
                }}
              >
                {activeRankName}
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <Text
                style={{
                  color: isDarkTheme ? "#64748B" : "#64748B",
                  fontSize: 11,
                }}
              >
                District Unit:
              </Text>
              <Text
                style={{
                  color: isDarkTheme ? "#F8FAFC" : "#0F172A",
                  fontSize: 11,
                  fontWeight: "bold",
                }}
              >
                {activeUnitName}
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <Text
                style={{
                  color: isDarkTheme ? "#64748B" : "#64748B",
                  fontSize: 11,
                }}
              >
                Officer Email:
              </Text>
              <Text
                style={{
                  color: isDarkTheme ? "#F8FAFC" : "#0F172A",
                  fontSize: 11,
                  fontWeight: "bold",
                }}
              >
                {email}
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                borderTopWidth: 0.5,
                borderTopColor: isDarkTheme ? "#334155" : "#CBD5E1",
                paddingTop: 6,
                marginTop: 4,
              }}
            >
              <Text
                style={{
                  color: isDarkTheme ? "#64748B" : "#64748B",
                  fontSize: 11,
                }}
              >
                Status State:
              </Text>
              <Text
                style={{ color: "#F59E0B", fontSize: 11, fontWeight: "bold" }}
              >
                PENDING REVIEW
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={{
              backgroundColor: "#1E3A8A",
              paddingVertical: 12,
              paddingHorizontal: 24,
              borderRadius: 8,
              width: "100%",
              alignItems: "center",
            }}
            onPress={onBackToLogin}
          >
            <Text
              style={{ color: "#FFFFFF", fontWeight: "bold", fontSize: 13 }}
            >
              RETURN TO OFFICER LOG IN
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bgDark }}
      contentContainerStyle={{ padding: 20 }}
    >
      {/* Top Bar Navigation back option */}
      <View
        style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}
      >
        <TouchableOpacity
          style={{
            paddingVertical: 8,
            paddingHorizontal: 12,
            backgroundColor: isDarkTheme ? "#1E293B" : "#CBD5E1",
            borderRadius: 8,
          }}
          onPress={onBackToLogin}
        >
          <Text
            style={{
              color: isDarkTheme ? "#F8FAFC" : "#0F172A",
              fontSize: 12,
              fontWeight: "bold",
            }}
          >
            ← BACK TO LOG IN
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ alignItems: "center", marginBottom: 20 }}>
        <Text
          style={{
            fontSize: 25,
            fontWeight: "bold",
            color: isDarkTheme ? "#FACC15" : "#1E3A8A",
            textAlign: "center",
            letterSpacing: 0.5,
          }}
        >
          Registration
        </Text>
        <Text
          style={{
            fontSize: 11,
            color: isDarkTheme ? "#94A3B8" : "#475569",
            textAlign: "center",
            marginTop: 4,
            lineHeight: 16,
          }}
        >
          Register your official tactical credentials to the district tracking
          database.
        </Text>
      </View>

      {/* Main Registration Form Card */}
      <View
        style={{
          backgroundColor: isDarkTheme ? "#142035" : "#FFFFFF",
          borderRadius: 16,
          padding: 24,
          borderWidth: 1,
          borderColor: isDarkTheme ? "#1E293B" : "#E2E8F0",
          marginBottom: 30,
        }}
      >
        {errorMessage && (
          <View
            style={{
              backgroundColor: isDarkTheme
                ? "rgba(239, 68, 68, 0.15)"
                : "#FEE2E2",
              padding: 12,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: "#EF4444",
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                color: "#EF4444",
                fontSize: 11,
                fontWeight: "bold",
                textAlign: "center",
              }}
            >
              ❌ {errorMessage}
            </Text>
          </View>
        )}

        {/* SECTION: AUTH CREDENTIALS */}
        <Text
          style={{
            color: "#3B82F6",
            fontSize: 10,
            fontWeight: "bold",
            letterSpacing: 1,
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Step 1: Account Access details
        </Text>

        <Text
          style={{
            color: isDarkTheme ? "#94A3B8" : "#475569",
            fontSize: 11,
            fontWeight: "bold",
            marginBottom: 6,
          }}
        >
          OFFICIAL EMAIL ADDRESS
        </Text>
        <TextInput
          style={[styles.input, { marginBottom: 14 }]}
          value={email}
          onChangeText={setEmail}
          placeholder="e.g. name@pnp.gov.ph"
          placeholderTextColor={isDarkTheme ? "#64748B" : "#94A3B8"}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text
          style={{
            color: isDarkTheme ? "#94A3B8" : "#475569",
            fontSize: 11,
            fontWeight: "bold",
            marginBottom: 6,
          }}
        >
          SET COMBAT SECTOR PASSWORD
        </Text>
        <TextInput
          style={[styles.input, { marginBottom: 20 }]}
          value={password}
          onChangeText={setPassword}
          placeholder="At least 6 secure characters"
          placeholderTextColor={isDarkTheme ? "#64748B" : "#94A3B8"}
          secureTextEntry
          autoCapitalize="none"
        />

        {/* SECTION: ELIGIBILITY PROTOCOL */}
        <Text
          style={{
            color: "#3B82F6",
            fontSize: 10,
            fontWeight: "bold",
            letterSpacing: 1,
            textTransform: "uppercase",
            marginBottom: 12,
            borderTopWidth: 0.5,
            borderTopColor: isDarkTheme ? "#1E293B" : "#E2E8F0",
            paddingTop: 12,
          }}
        >
          Step 2: PNP Identity verification
        </Text>

        <Text
          style={{
            color: isDarkTheme ? "#94A3B8" : "#475569",
            fontSize: 11,
            fontWeight: "bold",
            marginBottom: 6,
          }}
        >
          OFFICIAL BADGE NUMBER
        </Text>
        <TextInput
          style={[styles.input, { marginBottom: 14 }]}
          value={badgeNumber}
          onChangeText={setBadgeNumber}
          placeholder="e.g. PNP-4820-2026"
          placeholderTextColor={isDarkTheme ? "#64748B" : "#94A3B8"}
          autoCapitalize="characters"
        />

        <Text
          style={{
            color: isDarkTheme ? "#94A3B8" : "#475569",
            fontSize: 11,
            fontWeight: "bold",
            marginBottom: 6,
          }}
        >
          PERSONNEL RANK
        </Text>
        <TouchableOpacity
          style={[
            styles.input,
            {
              height: 48,
              justifyContent: "center",
              marginBottom: 10,
              backgroundColor: isDarkTheme ? "#0B121F" : "#F8FAFC",
            },
          ]}
          onPress={() => {
            setShowRankDropdown(!showRankDropdown);
            setShowUnitDropdown(false);
          }}
        >
          <Text
            style={{ color: isDarkTheme ? "#FFFFFF" : "#0F172A", fontSize: 13 }}
          >
            {activeRankName} {showRankDropdown ? "▲" : "▼"}
          </Text>
        </TouchableOpacity>

        {showRankDropdown && (
          <View
            style={{
              backgroundColor: isDarkTheme ? "#0F172A" : "#F1F5F9",
              borderRadius: 8,
              padding: 6,
              marginBottom: 14,
              borderWidth: 1,
              borderColor: isDarkTheme ? "#1E293B" : "#CBD5E1",
            }}
          >
            {ranks.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderBottomWidth: 0.5,
                  borderBottomColor: isDarkTheme ? "#1E293B" : "#E2E8F0",
                }}
                onPress={() => {
                  setRankId(r.id);
                  setShowRankDropdown(false);
                }}
              >
                <Text
                  style={{
                    color: isDarkTheme ? "#94A3B8" : "#475569",
                    fontSize: 12,
                    fontWeight: rankId === r.id ? "bold" : "normal",
                  }}
                >
                  {r.rankName} {rankId === r.id ? "✔️" : ""}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text
          style={{
            color: isDarkTheme ? "#94A3B8" : "#475569",
            fontSize: 11,
            fontWeight: "bold",
            marginBottom: 6,
          }}
        >
          FULL REGISTERED NAME
        </Text>
        <TextInput
          style={[styles.input, { marginBottom: 14 }]}
          value={fullname}
          onChangeText={setFullname}
          placeholder="Firstname Middlename Lastname"
          placeholderTextColor={isDarkTheme ? "#64748B" : "#94A3B8"}
        />

        <Text
          style={{
            color: isDarkTheme ? "#94A3B8" : "#475569",
            fontSize: 11,
            fontWeight: "bold",
            marginBottom: 6,
          }}
        >
          ASSIGNED UNIT DISTRICT
        </Text>
        <TouchableOpacity
          style={[
            styles.input,
            {
              height: 48,
              justifyContent: "center",
              marginBottom: 10,
              backgroundColor: isDarkTheme ? "#0B121F" : "#F8FAFC",
            },
          ]}
          onPress={() => {
            setShowUnitDropdown(!showUnitDropdown);
            setShowRankDropdown(false);
          }}
        >
          <Text
            style={{ color: isDarkTheme ? "#FFFFFF" : "#0F172A", fontSize: 13 }}
          >
            {activeUnitName} {showUnitDropdown ? "▲" : "▼"}
          </Text>
        </TouchableOpacity>

        {showUnitDropdown && (
          <View
            style={{
              backgroundColor: isDarkTheme ? "#0F172A" : "#F1F5F9",
              borderRadius: 8,
              padding: 6,
              marginBottom: 14,
              borderWidth: 1,
              borderColor: isDarkTheme ? "#1E293B" : "#CBD5E1",
            }}
          >
            {units.map((u) => (
              <TouchableOpacity
                key={u.id}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderBottomWidth: 0.5,
                  borderBottomColor: isDarkTheme ? "#1E293B" : "#E2E8F0",
                }}
                onPress={() => {
                  setUnitId(u.id);
                  setShowUnitDropdown(false);
                }}
              >
                <Text
                  style={{
                    color: isDarkTheme ? "#94A3B8" : "#475569",
                    fontSize: 12,
                    fontWeight: unitId === u.id ? "bold" : "normal",
                  }}
                >
                  {u.unitName} {unitId === u.id ? "✔️" : ""}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text
          style={{
            color: isDarkTheme ? "#94A3B8" : "#475569",
            fontSize: 11,
            fontWeight: "bold",
            marginBottom: 6,
          }}
        >
          TACTICAL DESIGNATION OR POSITION
        </Text>
        <TextInput
          style={[styles.input, { marginBottom: 14 }]}
          value={designation}
          onChangeText={setDesignation}
          placeholder="e.g. Patrol Officer"
          placeholderTextColor={isDarkTheme ? "#64748B" : "#94A3B8"}
        />

        {/* SECTION: OFF-DUTY EMERGENCY DIRECTIVES */}
        <Text
          style={{
            color: "#3B82F6",
            fontSize: 10,
            fontWeight: "bold",
            letterSpacing: 1,
            textTransform: "uppercase",
            marginBottom: 12,
            borderTopWidth: 0.5,
            borderTopColor: isDarkTheme ? "#1E293B" : "#E2E8F0",
            paddingTop: 12,
          }}
        >
          Step 3: Secure communications
        </Text>

        <Text
          style={{
            color: isDarkTheme ? "#94A3B8" : "#475569",
            fontSize: 11,
            fontWeight: "bold",
            marginBottom: 6,
          }}
        >
          MOBILE PHONE NUMBER
        </Text>
        <TextInput
          style={[styles.input, { marginBottom: 14 }]}
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          placeholder="e.g. +639123456789"
          placeholderTextColor={isDarkTheme ? "#64748B" : "#94A3B8"}
          keyboardType="phone-pad"
        />

        <Text
          style={{
            color: isDarkTheme ? "#94A3B8" : "#475569",
            fontSize: 11,
            fontWeight: "bold",
            marginBottom: 6,
          }}
        >
          VIBER ACCOUNT PHONE NUMBER
        </Text>
        <TextInput
          style={[styles.input, { marginBottom: 24 }]}
          value={viberNumber}
          onChangeText={setViberNumber}
          placeholder="Viber contact matching mobile or specific"
          placeholderTextColor={isDarkTheme ? "#64748B" : "#94A3B8"}
          keyboardType="phone-pad"
        />

        {/* SUBMIT BUTTON */}
        <TouchableOpacity
          style={{
            backgroundColor: "#10B981",
            borderRadius: 12,
            height: 50,
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 12,
          }}
          onPress={handleRegisterSubmit}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={isDarkTheme ? "#0B121F" : "#FFFFFF"} />
          ) : (
            <Text
              style={{
                color: isDarkTheme ? "#0B121F" : "#FFFFFF",
                fontWeight: "bold",
                fontSize: 15,
              }}
            >
              Register & Request Profile Approval
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            alignItems: "center",
            paddingVertical: 12,
            borderWidth: 1,
            borderColor: isDarkTheme ? "#1E293B" : "#E2E8F0",
            borderRadius: 12,
          }}
          onPress={onBackToLogin}
        >
          <Text
            style={{
              color: isDarkTheme ? "#94A3B8" : "#475569",
              fontWeight: "bold",
              fontSize: 12,
            }}
          >
            CANCEL & RETURN TO LOG IN
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};
