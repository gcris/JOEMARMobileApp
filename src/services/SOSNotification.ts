import { NativeModules, Platform } from "react-native";

const { SOSModule } = NativeModules;

export interface SOSNotificationData {
  title: string;
  body: string;
  senderName: string;
  phone_number: string;
  latitude: number;
  longitude: number;
}

const SOSNotification = {
  show(data: SOSNotificationData) {
    if (Platform.OS !== "android") return;

    if (!SOSModule) {
      console.warn("SOSModule is not registered.");
      return;
    }

    SOSModule.showSOS(data);
  },
};

export default SOSNotification;
