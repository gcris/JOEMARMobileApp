import { NativeModules } from "react-native";

const { FCMModule } = NativeModules;

export default {
  async getToken(): Promise<string> {
    return await FCMModule.getToken();
  },

  async deleteToken(): Promise<void> {
    await FCMModule.deleteToken();
  },
};
