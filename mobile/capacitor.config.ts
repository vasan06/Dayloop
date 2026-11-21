import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.dayloop.app",
  appName: "DayLoop",
  webDir: "../frontend/dist",
  // LAN FastAPI currently uses HTTP. Android WebView can otherwise block
  // cross-origin fetches even when Chrome can reach the PC directly.
  // Switch this off after moving the API to HTTPS for production.
  android: { allowMixedContent: true },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ["google.com"],
    },
  },
};

export default config;
