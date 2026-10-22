# Pantro Tenant — Google Play Release Guide (Android)

_Package: `com.pantro.tenant` · Expo SDK 54 / React Native 0.81 · target SDK 36_

This app is **Play-compliant as of October 2026**:

| Requirement | Status |
|---|---|
| Target API level 36 (Android 16) — mandatory since 31 Aug 2026 | ✅ `targetSdkVersion 36` |
| 16 KB memory page sizes — mandatory since 1 Nov 2025 | ✅ RN 0.81 / AGP 8.9 native libs are 16 KB aligned |
| New Architecture | ✅ `newArchEnabled: true` |
| Edge-to-edge (enforced on API 35+) | ✅ `edgeToEdgeEnabled: true` + `react-native-safe-area-context` 5 |

---

## 1. Build

```powershell
cd mobile_new\tenant

npm install

# (only needed once) regenerate the native project + write the signing config
npx expo prebuild --platform android --clean
npm run sign:android

# build the artifacts
npm run build:aab     # -> android\app\build\outputs\bundle\release\app-release.aab
npm run build:apk     # -> android\app\build\outputs\apk\release\app-release.apk

# optional: prove 16 KB page-size compliance
npm run verify:16kb
```

> `npm run build:android` runs signing + AAB + APK in one go.

### Where the signing config comes from

`scripts/setup-android-signing.ps1` writes `android/app/keystore.properties` and
`plugins/with-release-signing.js` (an Expo config plugin) injects the matching
`signingConfigs.release` block into `android/app/build.gradle` on every
prebuild. Because the plugin lives outside `android/`, `expo prebuild --clean`
never loses the signing setup.

---

## 2. Signing key (upload key)

The tenant app reuses the shared release keystore, on its **own alias**:

| | |
|---|---|
| Keystore | `mobile/keystore/pantro-release.keystore` (PKCS12) |
| Alias | `pantro-tenant` |
| Valid until | 04 Jan 2054 |
| **SHA-1 (upload key)** | `58:A1:91:13:B4:7C:E8:D2:46:B3:75:02:2B:10:E0:89:2F:E9:83:E5` |
| **SHA-256 (upload key)** | `F5:C1:A7:69:F7:1A:36:C8:3F:EA:C8:0F:3D:1D:9D:19:48:BD:8F:E5:6D:8D:DB:C5:B7:6F:C8:CE:77:BB:03:33` |

The sibling alias `pantro-owner` (SHA-1 `92:24:05:48:E1:64:FE:1B:5E:50:38:DD:B7:AC:EF:4D:81:89:A6:90`)
belongs to the owner app — do **not** register that one for `com.pantro.tenant`.

> 🔐 **Back up `mobile/keystore/pantro-release.keystore` and the password now.**
> If the upload key is lost you must ask Google to reset it (Play Console →
> Setup → App signing → Upload key → Request key reset).

---

## 3. First upload to Google Play

### 3.1 Create the app listing

1. Open <https://play.google.com/console> → **Create app**.
2. App name: `Pantro Tenant`, default language: English, Free/Paid: **Free**.
3. Fill in the store listing (icon 512×512 PNG, feature graphic 1024×500,
   phone screenshots ≥ 2, short/long description, privacy policy URL).
4. **Setup → App integrity → App signing**: keep *Play App Signing* enabled —
   Google generates the distribution key, our keystore is only the *upload* key.
5. **Setup → App integrity → Upload key certificate** → paste the SHA-1 above.

### 3.2 Upload the bundle

1. **Release → Testing → Internal testing → Create new release**.
2. Drag in `app-release.aab`.
3. Play validates and shows the compliance results — expect the target-API and
   16 KB checks to pass.
4. Add release notes, e.g. *"Initial release — rent, dues and payments."*
5. **Save → Review release → Start rollout to Internal testing**.

### 3.3 Promote to production

1. **Release → Production → Create new release**.
2. Choose the exact `app-release.aab` that was tested in Internal testing.
3. Complete the **App content** section (Play blocks the rollout until this is
   done):
   - Privacy policy URL
   - Data safety form (the app stores the tenant's name, phone, documents and
     payment receipts → declare them)
   - Content rating questionnaire
   - Target audience & content
   - Ads declaration (**No ads**)
   - Government/health apps declaration (**No**)
   - News app (**No**)
   - COVID-19 contact tracing (**No**)
4. Save → **Start rollout to Production**.

---

## 4. Releasing a new version later

1. Bump `versionCode` in `app.json` (**must be higher** than the last upload —
   Play rejects duplicates) and `version` for the user-facing version:

   ```jsonc
   "android": { "versionCode": 3 },
   "version": "1.0.1"
   ```

2. Rebuild:

   ```powershell
   npm run build:android
   ```

3. Upload the new `.aab` in the Play Console.

> The Play Console's "App bundle explorer" is the quickest way to confirm the
> uploaded bundle's target SDK, permissions and version code.

---

## 5. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Your app must target Android 16 (API level 36)` | `expo-build-properties` in `app.json` sets `targetSdkVersion: 36`. Re-run `npx expo prebuild --platform android --clean`. |
| `This app has native libraries that don't support 16 KB page sizes` | Run `npm run verify:16kb`. A failure means the native project was built with an old Expo/RN version — re-run the prebuild on SDK 54. |
| `Release signed with the debug key` | `npm run sign:android` was not run after the last prebuild. |
| `keystore password was incorrect` | The password is read from `mobile/owner-app/android/app/keystore.properties`. |
| Gradle: `Failed to install the following SDK components: platforms;android-36` | Run `sdkmanager "platforms;android-36" "build-tools;36.0.0"`. |

---

## 6. Notes on this release

* **FCM / push notifications** are wired up — `google-services.json` for
  `com.pantro.tenant` is in `firebase/tenant/` and is referenced from
  `app.json` (`android.googleServicesFile`). The file is gitignored, so copy it
  manually on a fresh clone.
* **`react-native-get-sms-android` was removed.** SMS auto-detection is
  disabled (Google Play restricts `READ_SMS` / `RECEIVE_SMS`); the
  `useSmsListener` hook degrades to a no-op.
* **SMS/REST permissions** were kept off the manifest, but `CAMERA`,
  `ACCESS_FINE_LOCATION` and `POST_NOTIFICATIONS` are still declared — make sure
  the Data safety form mentions location (property verification) and camera
  (document upload).
