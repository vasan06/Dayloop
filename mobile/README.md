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

Use Android Studio to build or run. The GitHub Actions workflow generates a debug APK automatically; the `android/` native project is maintained here, and the workflow creates it only when missing.

## API and Firebase

- A phone cannot connect to your computer's `localhost` API. Provide a public HTTPS Python API endpoint via the GitHub Actions repository variable `DAYLOOP_API_URL` (including `/api/v1`). Without it, the APK builds but network-backed features cannot work away from a configured API.
- Configure the existing `VITE_FIREBASE_*` repository variables (Firebase **web** configuration) for the mobile web bundle; these are client configuration, not service-account keys.
- Keep Firebase Admin credentials and PostgreSQL connection strings on the backend only.
- Firebase email/password authentication can use the existing web Firebase SDK. Google popup/redirect sign-in in Android WebView requires a separate native auth integration and Android app registration; do not assume it works from this wrapper unchanged.
- Register Android package `com.dayloop.app` in the **same Firebase project** when enabling native Android integrations. Keep `google-services.json` out of Git until a vetted native Firebase integration needs it.
- Never enable the local development identity on a publicly reachable backend.

## CI

Go to **Actions → Android Debug APK → Run workflow**. Download artifact `dayloop-android-debug-apk`. This debug APK is not a Play Store release and is unsigned with a production keystore. For distribution, introduce a protected release signing workflow and proper keystore/secrets.

The service worker, browser push, OAuth popups, background alarms, filesystem attachments and offline data sync need platform-specific testing; creating an Android APK does not convert them automatically into native platform capabilities.
