import { NativeModules } from "react-native";

type SignalStrengthResult = {
  dbm: number;
  level: number;
  networkType: string;
};

const { SignalStrengthModule } = NativeModules;

export default {
  async getSignalStrength(): Promise<SignalStrengthResult> {
    return await SignalStrengthModule.getSignalStrength();
  },
};
