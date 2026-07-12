import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { getStyles, getThemeColors } from "../theme/styles";
import { getRanks, getUnits } from "../services/database";
import { PersonnelPhotoPicker } from "./PersonnelPhotoPicker";
import { SafeAreaView } from "react-native-safe-area-context";

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
    photoUri: string; // Required photo URI for upload
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

  // Field-specific error states
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [badgeNumberError, setBadgeNumberError] = useState<string | null>(null);
  const [rankError, setRankError] = useState<string | null>(null);
  const [fullnameError, setFullnameError] = useState<string | null>(null);
  const [unitError, setUnitError] = useState<string | null>(null);
  const [designationError, setDesignationError] = useState<string | null>(null);
  const [phoneNumberError, setPhoneNumberError] = useState<string | null>(null);
  const [viberNumberError, setViberNumberError] = useState<string | null>(null);

  // Dropdown options loaded dynamically from DB
  const [ranks, setRanks] = useState<{ id: string; rankName: string }[]>([]);
  const [units, setUnits] = useState<{ id: string; unitName: string }[]>([]);

  // Custom picker dropdown visibility toggles
  const [showRankDropdown, setShowRankDropdown] = useState(false);
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);

  const [loading, setLoading] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | undefined>(
    undefined,
  );

  // Refs for focusing on error
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const badgeNumberInputRef = useRef<TextInput>(null);
  const fullnameInputRef = useRef<TextInput>(null);
  const rankTouchRef = useRef<TouchableOpacity>(null);
  const unitTouchRef = useRef<TouchableOpacity>(null);
  const designationInputRef = useRef<TextInput>(null);
  const phoneNumberInputRef = useRef<TextInput>(null);
  const viberNumberInputRef = useRef<TextInput>(null);

  useEffect(() => {
    // Clear all error messages after 7 seconds
    const timer = setTimeout(() => {
      setEmailError(null);
      setPasswordError(null);
      setBadgeNumberError(null);
      setRankError(null);
      setFullnameError(null);
      setUnitError(null);
      setDesignationError(null);
      setPhoneNumberError(null);
      setViberNumberError(null);
    }, 7000); // 7000 milliseconds = 7 seconds

    // Clean up the timer if the component unmounts
    return () => clearTimeout(timer);
  }, []); // Empty deps to run only on mount

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
    // Clear all field errors at start of validation
    setEmailError(null);
    setPasswordError(null);
    setBadgeNumberError(null);
    setRankError(null);
    setFullnameError(null);
    setUnitError(null);
    setDesignationError(null);
    setPhoneNumberError(null);
    setViberNumberError(null);

    if (!selectedImageUri) {
      // Focus on photo picker is handled by the PersonnelPhotoPicker component internally if needed
      return;
    }

    // Validate email
    const trimmedEmail = email.trim();
    console.log(trimmedEmail);
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setEmailError("Please enter a valid official email address.");
      emailInputRef.current?.focus();
      return;
    }
    // Validate password
    const trimmedPassword = password.trim();
    if (!trimmedPassword || trimmedPassword.length < 6) {
      setPasswordError("Please set a secure password of at least 6 characters.");
      passwordInputRef.current?.focus();
      return;
    }
    // Validate badge code
    const trimmedBadge = badgeNumber.trim();
    if (!trimmedBadge) {
      setBadgeNumberError("Please enter your official badge identifier.");
      badgeNumberInputRef.current?.focus();
      return;
    }
    // Validate rank
    if (!rankId) {
      setRankError("Please select your personnel rank designation.");
      rankTouchRef.current?.focus();
      return;
    }
    // Validate fullname
    const trimmedFullname = fullname.trim();
    if (!trimmedFullname) {
      setFullnameError(
        "Please provide your complete full name matching your PNP ID.",
      );
      fullnameInputRef.current?.focus();
      return;
    }
    // Validate unit
    if (!unitId) {
      setUnitError("Please select your assigned unit district.");
      unitTouchRef.current?.focus();
      return;
    }
    // Validate designation
    const trimmedDesignation = designation.trim();
    if (!trimmedDesignation) {
      setDesignationError(
        "Please specify your role/designation (e.g. Patrol Officer).",
      );
      designationInputRef.current?.focus();
      return;
    }
    // Validate phone and viber number
    const trimmedPhone = phoneNumber.trim();
    const trimmedViber = viberNumber.trim();
    if (!trimmedPhone) {
      setPhoneNumberError("Please enter your mobile phone number.");
      phoneNumberInputRef.current?.focus();
      return;
    }
    if (!trimmedViber) {
      setViberNumberError("Please enter your Viber contact number.");
      viberNumberInputRef.current?.focus();
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
      photoUri: selectedImageUri!, // Pass the selected image URI (now non-null after validation)
    });
    setLoading(false);

    if (result.success) {
      // Clear any field errors on success
      setEmailError(null);
      setPasswordError(null);
      setBadgeNumberError(null);
      setRankError(null);
      setFullnameError(null);
      setUnitError(null);
      setDesignationError(null);
      setPhoneNumberError(null);
      setViberNumberError(null);
    } else {
      // If it's a general error (not field-specific), we could show a toast or handle it differently
      // For now, we'll log it but not.show it since we're focusing on field-specific errors
      console.log("Registration failed:", result.message);
      // Optionally, you could show a general error toast here if needed
    }
  };

  const activeRankName =
    ranks.find((r) => r.id === rankId)?.rankName || "Select Rank";
  const activeUnitName =
    units.find((u) => u.id === unitId)?.unitName || "Select Unit";

  // If the form was submitted successfully, we could show a success message or navigate
// For now, we'll just clear the form and let the parent handle navigation

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bgDark }}
        contentContainerStyle={{ padding: 10 }}
      >
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
              fontSize: 15,
              color: isDarkTheme ? "#94A3B8" : "#475569",
              textAlign: "center",
              marginTop: 4,
              lineHeight: 16,
            }}
          >
            Provide the fields below to be able to register.
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
          {/* PERSONNEL PHOTO SECTION */}
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                color: isDarkTheme ? "#94A3B8" : "#475569",
                fontSize: 15,
                fontWeight: "bold",
                marginBottom: 6,
              }}
            >
              Profile Photo
            </Text>
            <PersonnelPhotoPicker
              personnelId="temp-id" // Will be replaced with actual ID after registration
              onPhotoSelected={(uri) => {
                setSelectedImageUri(uri);
              }}
              onPhotoUpdate={() => {
                // We handle photo upload after registration, so no-op here
              }}
              uploadAfterSelect={false} // We'll handle the URI ourselves
            />
          </View>

          {/* SECTION: AUTH CREDENTIALS */}
          <Text
            style={{
              color: "#3B82F6",
              fontSize: 18,
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
              fontSize: 15,
              fontWeight: "bold",
              marginBottom: 6,
            }}
          >
            Email Address
          </Text>
          <TextInput
            ref={emailInputRef}
            style={[styles.input, { marginBottom: 14 }]}
            value={email}
            onChangeText={setEmail}
            placeholder="e.g. name@gmail.com"
            placeholderTextColor={isDarkTheme ? "#64748B" : "#94A3B8"}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {emailError && (
            <Text style={{ color: "#EF4444", fontSize: 12, marginBottom: 8 }}>
              {emailError}
            </Text>
          )}

          <Text
            style={{
              color: isDarkTheme ? "#94A3B8" : "#475569",
              fontSize: 15,
              fontWeight: "bold",
              marginBottom: 6,
            }}
          >
            Password
          </Text>
          <TextInput
            ref={passwordInputRef}
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
              fontSize: 18,
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
              fontSize: 15,
              fontWeight: "bold",
              marginBottom: 6,
            }}
          >
            Badge Number
          </Text>
          <TextInput
            ref={badgeNumberInputRef}
            style={[styles.input, { marginBottom: 14 }]}
            value={badgeNumber}
            onChangeText={setBadgeNumber}
            placeholder="e.g. 123456"
            placeholderTextColor={isDarkTheme ? "#64748B" : "#94A3B8"}
            autoCapitalize="characters"
          />

          <Text
            style={{
              color: isDarkTheme ? "#94A3B8" : "#475569",
              fontSize: 15,
              fontWeight: "bold",
              marginBottom: 6,
            }}
          >
            Rank
          </Text>
          <TouchableOpacity
            ref={rankTouchRef}
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
              style={{
                color: isDarkTheme ? "#FFFFFF" : "#0F172A",
                fontSize: 15,
              }}
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
                      fontSize: 16,
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
              fontSize: 15,
              fontWeight: "bold",
              marginBottom: 6,
            }}
          >
            Full name
          </Text>
          <TextInput
            ref={fullnameInputRef}
            style={[styles.input, { marginBottom: 14 }]}
            value={fullname}
            onChangeText={setFullname}
            placeholder="Firstname Middlename Lastname"
            placeholderTextColor={isDarkTheme ? "#64748B" : "#94A3B8"}
          />

          <Text
            style={{
              color: isDarkTheme ? "#94A3B8" : "#475569",
              fontSize: 15,
              fontWeight: "bold",
              marginBottom: 6,
            }}
          >
            Unit/Station
          </Text>
          <TouchableOpacity
            ref={unitTouchRef}
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
              style={{
                color: isDarkTheme ? "#FFFFFF" : "#0F172A",
                fontSize: 16,
              }}
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
                      fontSize: 15,
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
              fontSize: 15,
              fontWeight: "bold",
              marginBottom: 6,
            }}
          >
            Designation
          </Text>
          <TextInput
            ref={designationInputRef}
            style={[styles.input, { marginBottom: 14 }]}
            value={designation}
            onChangeText={setDesignation}
            placeholder="e.g. Patroller"
            placeholderTextColor={isDarkTheme ? "#64748B" : "#94A3B8"}
          />

          {/* SECTION: OFF-DUTY EMERGENCY DIRECTIVES */}
          <Text
            style={{
              color: "#3B82F6",
              fontSize: 18,
              fontWeight: "bold",
              letterSpacing: 1,
              textTransform: "uppercase",
              marginBottom: 12,
              borderTopWidth: 0.5,
              borderTopColor: isDarkTheme ? "#1E293B" : "#E2E8F0",
              paddingTop: 12,
            }}
          >
            Step 3: Communications/SIPOT
          </Text>

          <Text
            style={{
              color: isDarkTheme ? "#94A3B8" : "#475569",
              fontSize: 15,
              fontWeight: "bold",
              marginBottom: 6,
            }}
          >
            Mobile Phone Number
          </Text>
          <TextInput
            ref={phoneNumberInputRef}
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
              fontSize: 15,
              fontWeight: "bold",
              marginBottom: 6,
            }}
          >
            Viber Account Number
          </Text>
          <TextInput
            ref={viberNumberInputRef}
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
                  fontSize: 20,
                }}
              >
                Register
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
                fontSize: 18,
                fontWeight: "bold",
                color: isDarkTheme ? "#3B82F6" : "#1D4ED8",
              }}
            >
              Sign in me instead
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
          </SafeAreaView>
  );
};
