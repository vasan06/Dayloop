import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.dayloop.app",
  appName: "DayLoop",
  webDir: "../frontend/dist",
  bundledWebRuntime: false,
  android: { allowMixedContent: false },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ["google.com"],
    },
  },
};

export default config;
