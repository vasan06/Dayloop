# DayLoop Android (Capacitor)

The canonical logo is the SVG geometry from the supplied DayLoop.html prototype, stored at `frontend/public/dayloop-mark.svg`. It is shared by the website, loading screen, and Android launcher/native splash. The in-app logo keeps its 5.5-second, linear, infinite CSS rotation. To regenerate icons after changing the source, run `powershell.exe -ExecutionPolicy Bypass -File mobile/scripts/generate-icons.ps1` from the repository root on Windows, then rebuild the React bundle and run `npx cap sync android` from `mobile/`.

This directory wraps the **existing React frontend** in an Android app. All web routes and page logic are reused from `frontend/`; do not maintain a second copy.

## Local workflow

From the repository root:

```bash
npm ci
npm run build
cd mobile
npm ci
npx cap add android     # only if mobile/android does not exist
npx cap sync android
npx cap open android
```

Use Android Studio to build or run. The `android/` native project is maintained here, and the GitHub Actions workflow packages the shared React frontend for Android.

## API and Firebase

- A phone cannot connect to your computer's `localhost` API. Provide a public HTTPS Python API endpoint via the GitHub Actions repository variable `DAYLOOP_API_URL` (including `/api/v1`). Without it, the APK builds but network-backed features cannot work away from a configured API.
- Configure the existing `VITE_FIREBASE_*` repository variables (Firebase **web** configuration) for the mobile web bundle; these are client configuration, not service-account keys.
- Keep Firebase Admin credentials and PostgreSQL connection strings on the backend only.
- Email/password uses the web Firebase SDK. Android Google sign-in gets a Google ID token natively and exchanges it with the web Firebase SDK. The Android package, signing certificate SHA‑1, and matching web OAuth client must be registered in the same Firebase project.
- The checked-in `google-services.json` contains public Firebase client configuration for `com.dayloop.app`. CI can supply an updated copy through the `FIREBASE_ANDROID_JSON_BASE64` secret.
- Never enable the local development identity on a publicly reachable backend.

## CI

Go to **Actions → Android Internal APK → Run workflow**, select the build branch, and download `app-internal.apk` from the existing artifact `dayloop-android-debug-apk`. The workflow builds the non-debuggable `internal` variant, explicitly selects the keystore from `DAYLOOP_ANDROID_DEBUG_KEYSTORE_BASE64`, and checks that the finished APK matches the Firebase-registered signing certificate. Build 12 uses Android version code 12 and version name 1.0.12.

Android requires the installed app and update to have the same signing identity. The v1.0 GitHub Release APK and the last baseline CI APK carry different certificates from the Firebase-registered internal key. Use a fresh device or emulator for Build 12 testing if you have one of those installations. Preserve the existing installation until its pending local changes and conflicts have been exported and reconciled.

For a local smoke build, install JDK 21 and Android SDK Platform 36, point `ANDROID_HOME` at that SDK, and run the frontend build and Capacitor sync above. You can set `VITE_API_URL=https://dayloop.invalid/api/v1` for a build where network-backed features are intentionally unavailable. Then run `./gradlew assembleInternal` from `mobile/android`. Without the CI keystore, the local APK uses your local Android debug certificate. It can be installed on a fresh emulator to check startup, but its certificate will differ from existing signed installs and Firebase Google sign-in requires a registered certificate. Use an emulator or separate test device to keep existing installations and data intact.

The service worker, browser push, OAuth popups, background alarms, filesystem attachments and offline data sync need platform-specific testing; creating an Android APK does not convert them automatically into native platform capabilities.
