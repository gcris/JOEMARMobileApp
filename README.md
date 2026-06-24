# PNP Geo-Tracker: React Native (Expo) Edition

This directory contains the **complete, production-grade React Native translation** of the PNP Geo-Tracking and Patrol application. It features:
- **Offline-First SQLite Architecture:** Powered by `expo-sqlite` representing the 1:1 local persistence layer of Android's Room DB database.
- **Robust Background Geographic Logging:** Coordinates mapped through `expo-location` and registered dynamically with `expo-task-manager` so that tracking runs flawlessly when the app is minimized.
- **Secure Badge Access & Remote Cloud Gateway:** Powered by `@supabase/supabase-js` to synchronize cached telemetry back to primary tables when Internet connectivity is present.
- **Philippine Standard Time Formatting:** Forces automatic timestamp serialization targeting `Asia/Manila` (GMT+8) zone parameters directly in JS.

---

## 🛠️ VS Code Running & Installation Steps

### Step 1: Open VS Code
1. Export this workspace as a `.zip` file from the settings menu of **Google AI Studio** OR trigger a direct commit to your **GitHub** repository.
2. Extract the downloaded archive on your local computer.
3. Launch **Visual Studio Code**, select **File > Open Folder**, and open the **`react-native-app`** directory from the extracted directory tree.

### Step 2: Install Node Dependencies
1. Open a terminal in VS Code (`Ctrl + ~` or `Cmd + ~`).
2. Run standard NPM installation commands to compile package headers:
   ```bash
   npm install
   ```

### Step 3: Configure Cloud Credentials (.env)
Create a `.env` file inside the structural root of the `react-native-app` folder containing your live Supabase api variables:
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
*Note: If these configurations are omitted or are left as placeholders, the mobile app will automatically activate PNP local simulation sandbox mode so that you can test shifts immediately with cached SQLite data.*

### Step 4: Run the Expo Mobile Client
1. Launch the Metro Bundler inside target console:
   ```bash
   npm run start
   ```
2. **Review the QR Code:**
   - **For Physical Devices:** Install the official **Expo Go** application from Apple App Store or Google Play Store. Scan the terminal's QR code with your mobile camera.
   - **For Emulators:** Press `a` in your VS Code terminal to load on an active Android Emulator, or press `i` to boot on an iOS Simulator.

---

## 📌 Architecture Equivalents (Kotlin Compose vs. React Native)

| Feature | Android Kotlin Target | React Native (Expo) Target |
| :--- | :--- | :--- |
| **User interface** | Jetpack Compose (M3) | React Native Core Components + StyleSheets |
| **Local Cache** | SQLite + Room Database | SQLite + `expo-sqlite` |
| **Remote Sync Gateway** | Retrofit + OkHttp clients | Supabase JS Client (`@supabase/supabase-js`) |
| **Background tracking**| Persistent Foreground Service | `expo-location` + `expo-task-manager` |
| **Timezone Adjust** | `TimeZone.getTimeZone("Asia/Manila")` | Custom ISO epoch calculations in `BackgroundTracker.ts` |
