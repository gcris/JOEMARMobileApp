import { NativeModules } from "react-native";

const { SOSModule } = NativeModules;

export interface SOSPayload {
  title: string;
  body: string;
  senderName: string;
  phone_number: string;
  latitude: number;
  longitude: number;
}

export default {
  show(data: SOSPayload) {
    SOSModule.showSOS(data);
  },
};
