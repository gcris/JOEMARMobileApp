import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Platform,
  Linking,
  Alert,
} from "react-native";

interface SosAlertModalProps {
  sosAlertData: {
    senderName: string;
    latitude: number;
    longitude: number;
    phone_number: string;
  } | null;
  onClose: () => void;
}

const SosAlertModal: React.FC<SosAlertModalProps> = ({
  sosAlertData,
  onClose,
}) => {
  if (!sosAlertData) return null;

  const handlePhoneCall = () => {
    if (!sosAlertData.phone_number) return;
    // tel: protocol opens the device's native dialer automatically
    const url = `tel:${sosAlertData.phone_number.replace(/\s+/g, "")}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Alert.alert("Error", "Phone calls are not supported on this device.");
        }
      })
      .catch((err) => console.error("Linking error:", err));
  };

  return (
    <Modal
      transparent={true}
      visible={sosAlertData !== null}
      animationType="fade"
      hardwareAccelerated={true}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <View
          style={{
            backgroundColor: "#fff",
            padding: 20,
            borderRadius: 10,
            width: "80%",
            maxWidth: 400,
            elevation: 5,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: "bold", marginBottom: 10 }}>
            DISTRESS SIGNAL TRIGGERED
          </Text>
          <Text style={{ marginBottom: 20, fontSize: 16 }}>
            {sosAlertData.senderName} needs assistance at the following
            location:
          </Text>
          <Text style={{ fontSize: 16 }}>
            Latitude: {sosAlertData.latitude.toFixed(6)}
          </Text>
          <Text style={{ fontSize: 16 }}>
            Longitude: {sosAlertData.longitude.toFixed(6)}
          </Text>
          {sosAlertData.phone_number && (
            <Text style={{ fontSize: 16, marginBottom: 20 }}>
              Phone Number: {sosAlertData.phone_number}
            </Text>
          )}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-around",
              marginTop: 10,
            }}
          >
            <TouchableOpacity
              style={{
                backgroundColor: "#007AFF",
                paddingVertical: 10,
                paddingHorizontal: 10,
                borderRadius: 5,
              }}
              onPress={() => {
                // Handle "Get Direction" press
                if (sosAlertData?.latitude && sosAlertData?.longitude) {
                  const lat = sosAlertData.latitude;
                  const lng = sosAlertData.longitude;
                  const mapUrl =
                    Platform.OS === "ios"
                      ? `maps://?d=${lat},${lng}`
                      : `geo:${lat},${lng}?q=${lat},${lng}(Officer+in+Distress)`;
                  Linking.openURL(mapUrl).catch((err) =>
                    console.error("Failed to open map:", err),
                  );
                }
                onClose(); // Close the modal after opening map
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
                Get Direction
              </Text>
            </TouchableOpacity>
            {sosAlertData.phone_number && (
              <TouchableOpacity
                style={{
                  backgroundColor: "#67ff30",
                  paddingVertical: 10,
                  paddingHorizontal: 20,
                  borderRadius: 5,
                }}
                onPress={handlePhoneCall}
              >
                <Text
                  style={{ color: "#262626", fontWeight: "600", fontSize: 16 }}
                >
                  Call
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={{
                backgroundColor: "#FF3B30",
                paddingVertical: 10,
                paddingHorizontal: 20,
                borderRadius: 5,
              }}
              onPress={onClose}
            >
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default SosAlertModal;
