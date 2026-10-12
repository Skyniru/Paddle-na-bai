# Install and test PaddleBai

The public app name and icons now use `PaddleBai` and `public/icons/PaddleBai-Logo.png`. The internal IndexedDB name (`paddle-na-bai`), Windows app identifier and Rust executable name remain stable to preserve saved data and upgrade paths. Backups created under “Paddle Na Bai!” remain compatible; new exports use the PaddleBai name. The separate untracked Vite project in `Paddle_Na_Bai/` is not modified or included in the main Next.js build.

The existing app, UI and database were retained. No Premium, payment or subscription features were added. Browser/PWA data remains at its existing origin. Desktop uses a separate persistent WebView2 profile; export/import a backup to transfer data. Never delete a browser profile or app data folder to fix installation problems.

## What is available

- Production static PWA: `E:\PROYEKTO CODE\Apps development\Paddle_Na_Bai\out`.
- Tauri 2 Windows source/configuration and official-logo icons: `src-tauri/`.
- Windows installer: **not generated in this environment**. The build attempt failed because Cargo is absent. Tauri's environment check also found no MSVC/Windows SDK installation. WebView2 was detected. Compilation, native save dialogs, installer execution and native session reopening remain untested.
- iPhone and Android installation: PWA via trusted HTTPS. No `.ipa`, `.apk` or `.aab` was generated; no physical phone test was performed.

## Windows installer build

Open PowerShell at the project:

```powershell
Set-Location -LiteralPath 'E:\PROYEKTO CODE\Apps development\Paddle_Na_Bai'
npm.cmd ci
npm.cmd run tauri -- info
```

Install Rust stable through [rustup](https://rustup.rs/) with the MSVC toolchain, and Visual Studio Build Tools with **Desktop development with C++**, MSVC and Windows SDK. Reopen PowerShell afterwards. See [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

```powershell
rustc --version
cargo --version
npm.cmd run build
npm.cmd run desktop:check
npm.cmd run desktop:dev
```

`desktop:dev` launches the existing Next.js app on port 3102 inside Tauri. Its HTTP development origin has separate storage from the installed app. Use it for UI/debugging; validate offline cold start on a production build.

```powershell
npm.cmd run desktop:build
Get-ChildItem -LiteralPath '.\src-tauri\target\release\bundle\nsis' -Filter '*.exe'
```

After a successful build the exact output directory is:

```text
E:\PROYEKTO CODE\Apps development\Paddle_Na_Bai\src-tauri\target\release\bundle\nsis\
```

The compiled application executable is expected at:

```text
E:\PROYEKTO CODE\Apps development\Paddle_Na_Bai\src-tauri\target\release\paddle-na-bai.exe
```

These are configured output locations, not generated files. The `Get-ChildItem` command reports the actual installer name once built. No alternative Cargo target directory is configured; a user-set `CARGO_TARGET_DIR` changes these locations.

Run the generated `*-setup.exe` as your normal Windows user, then launch **PaddleBai** from Start. The NSIS installer bundles WebView2's offline installer, so the target computer does not need internet for installation. Building the installer initially requires downloading Rust crates, build dependencies and WebView2 tooling. Offline WebView2 packaging increases size; see [Windows installer guidance](https://v2.tauri.app/distribute/windows-installer/). The executable is unsigned; code signing remains a release step.

Desktop stores the existing schema-v5 IndexedDB database in WebView2's persistent app profile, under the app's local data directory associated with `com.paddlenabai.app`. It is not browser Chrome/Edge storage and is not SQLite. Keep the identifier, window label, HTTPS scheme and profile settings stable between releases. No code clears it at startup. Native export uses a Save dialog and writes the user-selected JSON file; restore continues to use file selection, preview, validation and atomic IndexedDB replacement. A future SQLite conversion requires its own adapter and explicit data migration.

Before moving browser records, export a backup from the original URL. In the installed app choose **Preview restore**, inspect the counts, then confirm replacement. Imported active sessions retain their timestamps and matches. This copies records; it does not remove the original browser data. If the destination already has a live session, finish that session first.

Windows acceptance test after compilation:

1. Add players/photos, create/start a session, check players in and generate a match. Wait for save confirmation.
2. Close the entire app, turn networking off, reopen it from Start. Confirm the active session, timer, attendance and photos.
3. Record scores offline and reopen again; verify results and leaderboard.
4. Export with the native Save dialog, restore in a separate test profile, and verify photos/results. Cancel a dialog and try an invalid backup.
5. Install a newer build with the same identifier; confirm existing data remains. Export before upgrading or uninstalling.

## iPhone and Android over trusted HTTPS

Install [mkcert](https://github.com/FiloSottile/mkcert#installation) on the Windows computer. Keep the phone and computer on the same private Wi-Fi network. Run:

```powershell
npm.cmd run phone:setup
```

This prints your detected IPv4 address and the exact certificate commands. If several adapters are present, select the reachable Wi-Fi/Ethernet address:

```powershell
npm.cmd run phone:setup -- 192.168.1.21
New-Item -ItemType Directory -Path certs -Force
mkcert -install
mkcert -cert-file certs/local.pem -key-file certs/local-key.pem localhost 127.0.0.1 192.168.1.21
mkcert -CAROOT
npm.cmd run build
npm.cmd run https
```

Replace the example IP with the helper's current output. `https` directly serves `out/` on port 3443; no port-3000 server is needed. Allow Node/private-network access if Windows Firewall prompts. Guest Wi-Fi isolation can block device access. Certificates and keys are ignored by Git. Share only `rootCA.pem` from the directory shown by `mkcert -CAROOT`; never share the CA private key.

**iPhone:** transfer and open `rootCA.pem`, install its certificate profile in Settings, then enable full trust under Settings → General → About → Certificate Trust Settings. Open `https://<computer-IP>:3443` in Safari without a certificate warning. Wait for **Ready for offline play**, then Share → Add to Home Screen → Add. Launch the home-screen app once while online. Remove the local test CA from the phone when testing is finished.

**Android:** install `rootCA.pem` as a trusted CA through device security/certificate settings (menu names vary). Open the same HTTPS URL in Chrome without a warning; wait for **Ready for offline play**, then use Install app/Add to Home screen. Native Android debug apps require separate user-CA trust configuration; this workflow tests the browser PWA. If your managed device blocks local CA installation, use a trusted HTTPS static host for `out/` instead, transferring data with backups.

On each phone: add a photo, start a session and generate a match; turn off Wi-Fi and cellular, fully close/reopen the installed PWA, visit every tab, record a result and reopen again. Confirm the session/attendance/timer/results/photos. Reconnect, export a backup and test restore using separate test data. Initial install needs online access; completed caching enables later offline use. Phone power-saving/OS storage policies can evict data, so keep backups outside the app.

Keep the original URL/port for existing browser data. HTTPS, HTTP, computer IP, localhost and different ports are separate origins. Existing installed PWAs receive updates only after every app window/tab using the old worker closes; finish live play before applying them. Desktop updates use a new installer, not the browser worker.

## Verification commands and limits

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run desktop:check -- --config-only
npm.cmd run test:browser
```

Chromium tests include online/offline navigation, versioned backups and photos, concurrent assignments, safe updates, and full browser shutdown/offline relaunch using a disposable persistent profile. The HTTPS smoke test uses a temporary self-signed certificate with an automated browser exception; it verifies the HTTPS server and caching, not phone certificate trust. Desktop-bridge tests use a mock and do not validate Rust compilation, Windows dialogs, filesystem permissions or WebView2. Native package and physical phone acceptance tests are still required.

Latest continuous-play verification (October 12, 2026): lint, typecheck, static production build, 33 unit tests and 33 Chromium browser tests passed. The production worker precaches 57 exported files. The Tauri configuration check passed; no native installer was rebuilt. See [CONTINUOUS-PLAY-UPDATE.md](CONTINUOUS-PLAY-UPDATE.md) for stable Up Next/Standby, automatic rotation, local PNG results export, theme reopening tests, compatibility and limitations. [COURT-SETUP-UPDATE.md](COURT-SETUP-UPDATE.md) documents simplified court setup. Earlier manual-round instructions and white dark-theme navigation descriptions in [UPDATE-REPORT.md](UPDATE-REPORT.md) have been superseded. No fresh dependency security audit or physical-device acceptance test was performed. An existing debug executable is present but was not rebuilt or tested against these changes.
