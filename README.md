# PaddleBai

A mobile-first padel open-play app built directly in `Paddle_Na_Bai`. Next.js App Router, TypeScript, Tailwind CSS, Lucide icons, and Dexie/IndexedDB. No account, paid service, or cloud configuration is needed.

## Run in VS Code

Install Node.js 22 or newer, open this folder in VS Code, and open a terminal:

```sh
npm install
npm run dev -- --hostname 0.0.0.0
```

Open http://localhost:3000. On Windows PowerShell, if execution policy blocks `npm.ps1`, use `npm.cmd` in place of `npm` (or use a Command Prompt terminal). You do not need to change your system execution policy.

## Test on your iPhone over Wi-Fi

Keep the computer and phone on the same network. In a Windows terminal run `ipconfig` and find the **IPv4 Address** of the active Ethernet/Wi-Fi adapter. Avoid VPN, loopback, and disconnected adapters.

The address found during setup was `192.168.1.21`; it can change. With the development server running, open **http://192.168.1.21:3000** in Safari. If prompted, allow Node through Windows Firewall on your private network. Guest Wi-Fi client isolation can prevent access.

Generate a QR code locally:

```sh
npm run qr -- http://192.168.1.21:3000
```

Open `local-qr.png` on your computer and scan it with the iPhone camera. No QR service receives your URL.

**Plain LAN HTTP is not a secure context on iPhone.** Use it for layout and normal application testing. It does not validate service workers, full offline PWA behavior, or all device APIs. The app uses a secure-context-independent random UUID fallback for this mode. IndexedDB data belongs to that browser and origin: switching between localhost, an IP, HTTP, HTTPS, or ports creates separate storage.

## Validate offline PWA features with trusted HTTPS

The service worker is enabled only in production on secure origins (including desktop localhost). First test on the computer:

```sh
npm run build
npm run start
```

Open http://localhost:3000 online and wait for **Ready for offline play**. In browser devtools select offline and reload again. Check navigation, saving players, generating matches, and recording results while offline.

For an iPhone, use a locally trusted certificate:

1. Install [mkcert from its official project](https://github.com/FiloSottile/mkcert), following its Windows installation instructions.
2. Create a `certs` folder in this project. Replace the example IP below with your current IPv4 address:

   ```sh
   mkcert -install
   mkcert -cert-file certs/local.pem -key-file certs/local-key.pem localhost 127.0.0.1 192.168.1.21
   mkcert -CAROOT
   ```

3. Transfer **only `rootCA.pem`** from the reported CA directory to your iPhone using a trusted method. Install its profile in Settings, then enable full trust under **Settings → General → About → Certificate Trust Settings**. Never transfer `rootCA-key.pem` or commit certificate keys. Remove the test CA from the phone when testing is done. See [mkcert mobile-device guidance](https://github.com/FiloSottile/mkcert#mobile-devices).
4. After building the static app, run:

   ```sh
   npm run https
   ```

   This project's HTTPS static server serves `out/` directly on port 3443 using the generated certificate. A port-3000 server is not needed.

5. Open **https://192.168.1.21:3443** in Safari with no certificate warning. Allow the private-network firewall port if required. Open every screen online once, reload, then use Safari's Share → Add to Home Screen. Disable phone Wi-Fi and cellular data, reopen the installed app, and verify offline reloads and local results. Re-enable Wi-Fi to reconnect. A certificate-warning bypass is not a substitute for trusting the CA.

The [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps) describes the HTTPS requirement. Merely enabling experimental HTTPS in development does not test this app's production service worker.

## What works

- Create a named session with venue, 1–12 courts, selected players, and optional duration. Start explicitly; the elapsed timer survives refresh. Expiry only displays a reminder.
- Add/edit players with optional JPG/PNG/WebP photos up to 2 MB. Set active/resting/unavailable status. Remove players that have no session records; use unavailable for historical players to preserve their statistics.
- Generate doubles on free courts with pure random, fair rotation, or balanced teams. Only active participants can be assigned; players on live courts are excluded.
- Record a winner and optional scores. Both scores must be present together, whole and nonnegative, and agree with the winner. A finalized match cannot be submitted again.
- View session/all-time games, wins, losses, win rate, current streak, best streak, and ranking. Tap a player for details.
- End a session and review history. Unfinished matches are cancelled, excluded from statistics, and preserved in records.
- Toggle a persistent light/dark theme. Export a JSON backup of all local records from the footer. Preview a JSON backup, then confirm replacement to restore it atomically. A pre-restore copy is retained; finish live play before replacement.

Snaps is an explicitly labeled future-feature screen. Cloud sync, public viewing links, Messenger sharing, real-time cloud updates, photo recaps, and QR session sharing are not implemented.

## Rotation rules

Fair and balanced selection sort players by eligible assignments, consecutive eligible rests, total rests, waiting duration and last-played time, with random ties. This prioritizes waiting players and prevents repeated rests when enough court slots are available. Player win rates never affect selection opportunities. Among the selected players, court allocation favors fewer previous assignments to that court. The three possible doubles pairings are scored for repeated partners and opponents; balanced mode adds a win-rate difference penalty. Zero-game players have a 0% observed win rate; this is not a skill rating. These are transparent greedy heuristics rather than an exhaustive optimization over every possible group of players.

## Architecture and storage

- `src/types`: stable UUIDs and creation/update timestamps on players, sessions, courts, and matches.
- `src/lib/db.ts`: persistence and domain mutations. Round assignment, result finalization, session creation, and session end run in IndexedDB transactions. Results live on the unique match record, and statistics are derived rather than incremented, preventing duplicate wins.
- `src/lib/matchmaking.ts`, `rotation.ts`, `statistics.ts`: pure matching and statistics logic, independent of the UI.
- `src/components`: reusable layout, session, court, player, and leaderboard components. `App.tsx` composes the current views and forms.
- `src/hooks/useSessionTimer.ts`: wall-clock elapsed time from persisted timestamps, not timer ticks.
- `scripts/sw-template.js`: consistent-build cache-first static routes and assets. `postbuild` generates both `public/sw.js` and `out/sw.js`, precaching every exported file including navigation payloads. Updates wait until all app windows close. No forced reload interrupts play.

A future sync adapter can exchange versioned records at the database boundary. No remote credentials or fake sync state are present. Production sync will require conflict policy, authentication, deletion tombstones, and authorization for public read-only sessions.

Storage remains after closing the app, but clearing site data, private browsing, OS storage eviction, or device loss can remove it. Keep exported backups. Data is not shared between devices.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm audit --omit=dev
```

Browser tests use isolated browser storage and emulate an iPhone-sized Chromium viewport; they do not replace Safari testing on a physical phone. Screenshots are written to `test-results`. Unit tests cover streak calculation, fair selection, partner repetition, simultaneous generation, one-time finalization, and invalid input.

The initial audit found five development-only advisories in the Next ESLint plugin's `braces` dependency chain. The available automated fix downgrades the Next ESLint configuration to an incompatible major version, so it was not applied. Production dependencies audited clean. Check for a compatible upstream fix before upgrading tooling.

## Save changes to GitHub

Once the GitHub remote and your commit identity are configured, run these from this project folder:

```sh
git add .
git commit -m "Describe your changes"
git push
```

In VS Code you can also use Source Control to stage changes, enter a commit message, commit, and Sync Changes. The first push sets the upstream with `git push -u origin main`.

Dependencies, build output, generated service worker, certificates, QR images, and browser test artifacts are excluded from Git. A fresh checkout needs `npm install`, then `npm run dev` or `npm run build`.

GitHub saves the application's source code. Players, sessions, photos, and results are stored separately in the browser's IndexedDB; use **Export backup** inside the app to save those records.

## Saved player groups and playing lists

Open **Players → Create group**, name your group, and search for saved players to choose its members. Groups contain a reusable list of players; there is no messaging. Edit or delete a group without deleting player records or match history.

From **Your groups**, tap a logo or **Add to session** to open session setup or add late arrivals to an existing session. When creating a session, tap a group logo to view its members. Choose **Add whole group**, **Add active players**, or tap individual player tiles. Choose **All players** to pick players from outside a group; search is optional. Selections stay checked as you search. With saved groups, the session starts with an empty selection so you can choose who is actually attending. Without groups, available players are selected as before.

During a session, use **Playing list → Add saved players** for late arrivals. Set availability to **Ready to play**, **Taking a rest**, or **Finished for today**. These changes belong to that session and do not change a player's saved availability for future games. Players on court finish their match before changing availability.

Choose **Fair rotation** and select **Generate round** after recording results. Players with fewer assigned games go first; ties favor the longest rest since their last match ended. Partners and opponents vary when possible. Matches in progress stay intact. Pure random mode does not guarantee equal turns. Groups, players, availability, and results are saved on this device and included in **Export backup**; they do not sync across devices.

You can also enter **New player name → Add name** directly inside group creation, session setup, or the late-arrival picker. Each name is saved and selected without leaving the form. Pressing Enter in the name field also adds the player. An existing name is reused rather than duplicated. Groups can be saved empty for planning and updated later; sessions still require at least four players. Creating a group does not start a session, and starting a session does not require a group.

Attendance and court reservations: New sessions require host check-in before matchmaking. Check-out is blocked during active matches, supports re-entry and undo, and retains timestamped history. Courts use Manila reservation windows (including overnight bookings), warn in the last 15 minutes, and can be extended by 30 minutes. Expiry blocks new assignments without stopping live matches. Session time remains independent. Existing sessions retain legacy availability until closed. Dexie schema v4 preserves nested attendance events and reservation history; stable record IDs, epoch timestamps and updatedAt fields are included in JSON backups for future Supabase synchronization. No remote synchronization is enabled.

## Improved offline app

Production is a static export in `out/`. `npm run start` serves that directory on port 3000 without a Next.js server; use `node scripts/serve.cjs 3001` for another port. Browser tests use their own production server on port 3100. Initial installation needs an online HTTPS visit (desktop localhost also works); wait for **Ready for offline play**, choose **Install app** or your browser installation option, and reopen once. On Safari use Share ? Add to Home Screen. Test again with networking off. The app can then start and navigate without its server. Do not open the build with `file://`.

Keep your existing origin to preserve browser data. Export a backup before changing host, protocol, port, browser profile, or platform. Restore accepts this versioned format and legacy schema-v4 exports, previews counts and photos, and keeps a downloadable pre-restore snapshot. Device data controls appear on every screen. New uploads validate image decoding and dimensions; photos stay local and are included in backups. Offline files and saved records are separate: ?Ready for offline play? describes the application cache, while roster saves show a commit confirmation.

See [AUDIT.md](AUDIT.md) for findings, changes and limits; [NATIVE-PACKAGING.md](NATIVE-PACKAGING.md) evaluates Windows/Tauri and Android/iOS/Capacitor. Tauri 2 Windows packaging is configured, but its build is blocked by missing Rust/Cargo and MSVC; no installer or native device test has been completed. The exact branding is **PaddleBai**, with web/install icons derived from the preserved `public/icons/PaddleBai-Logo.png`. Local Geist font licensing is bundled in `public/fonts/OFL.txt`.

## Windows and phone installation

See [INSTALL-AND-TEST.md](INSTALL-AND-TEST.md) for exact commands, prerequisites, configured installer output locations, native data transfer, and trusted HTTPS installation on iPhone/Android. Use `npm run desktop:dev` for the Tauri development window and `npm run desktop:build` for the NSIS installer after installing Rust/MSVC. Run `npm run phone:setup` to print the current local IP and certificate commands.
