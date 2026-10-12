# paddlebai audit and improvements

## Initial state

Git reported only the user's untracked `public/icons/logo.png`. It was preserved. Existing database name, IDs and historical data were retained. No Premium, subscription or payment features were added.

Already working: saved players and groups, local photos, inline player creation, reusable group selection, session creation/start/end/history, court reservation windows and extensions, attendance history/check-out undo/re-entry, manual assignment, three matchmaking modes, validated match results, leaderboards/statistics, wall-clock timers and theme preferences. Database versions 1–4 and domain transactions already existed. Snaps was a future-feature placeholder and remains one.

Needed recoding: production required `next start`; the worker was tied to `.next` assets and did not guarantee static navigation payload coverage; export was a UI snapshot without restore; player upload lacked image decoding; navigation inherited dark colors; initial browser tests could reuse a development server.

Real gaps addressed: offline readiness/install guidance, safe update notification, replacement preview, validated restore, retained pre-restore copy, storage protection request/error guidance, explicit roster save confirmation, and active-session recovery status.

## Delivered behavior

- Static Next.js export; no request-time server components, route handlers, API routes, server actions, authentication, SSR, or image optimizer needed by the existing features. Build-time layout/metadata remain supported. A minimal static server serves `out/`; any correctly configured HTTPS static host can serve it.
- Consistent build cache containing every exported route and payload, local font/license, logo, icons, scripts and styles. Navigation reads the same build offline. Worker updates wait until every existing controlled window closes; no forced activation or reload during sessions.
- Same IndexedDB database with additive schema v5 (`safety` table). Domain transactions remain, UI reads and backup export use consistent read transactions. Restore validates before mutation, writes a pre-restore snapshot and replaces all five domain tables in one transaction. A quota/write failure rolls back the whole operation. A live session blocks replacement even from another tab. Snapshot storage itself can run out of space, in which case restore leaves current data intact.
- Versioned JSON with photos; supported legacy schema-v4 exports migrate to the new portable envelope. Validation checks IDs, duplicate records, references, session/court structure, attendance timestamps, teams, scores, and overlapping live assignments. Historical attendance and eligibility identifiers can outlive an unassigned player leaving the roster. UI checks photo decoding before restore. File limit: 100 MB. Last pre-restore snapshot is retained; repeated restores replace that snapshot.
- Local JPG/PNG/WebP uploads up to 2 MB with decoding and a maximum dimension of 8192 pixels. Existing photos remain embedded in IndexedDB. No remote fonts/assets or photo service.
- White navigation in light mode and page-matching dark-green navigation in dark mode, teal selected pills, readable contrast, accessible focus/touch targets, improved cards/buttons/spacing. Header, favicon, Apple icon and manifest icons use the user's logo; exact app name is “paddlebai”.

## Rotation audit

Fair/balanced selection uses fewer eligible assignments, consecutive eligible rests, total eligible rests, waiting duration, last-played time and random ties. Busy/unavailable/resting/not-checked-in players are excluded. Late arrivals do not receive pre-arrival rest credit; re-entry uses persisted attendance history. Partner repetition costs more than opponent repetition; balanced pairing also considers observed win rates. Random mode preserves random selection/pairing behavior. Multi-court assignment and manual assignment use transactions to reject overlapping players/courts.

Existing logic passed the relevant scenarios and was preserved. The algorithm remains a greedy heuristic: grouping selected players by court history can leave repeat partners when a global reshuffle could improve pairings. Equal opportunities over arbitrary arrival/rest patterns cannot be guaranteed, and win rate is not a skill rating. A future optimizer should preserve selection priority and explain any compromises.

## Remaining gaps and limits

- Undo/correcting a finalized result is a useful future feature. Implement an auditable correction transaction with derived-stat recalculation; reopening an old match must not overlap later assignments. It is not implemented here. Existing check-out undo was preserved.
- Snaps/photo recaps remain unfinished; no duplicate photo gallery or paid features were introduced.
- Data belongs to a browser profile and origin. Keep the existing scheme/host/port to retain existing records. New native apps or a different hosting origin need backup import. Private browsing, site-data deletion, storage eviction and device loss can remove local data. Storage protection is browser-dependent; backups remain necessary.
- Timers recover from timestamps and include time while closed. Manual system-clock changes can affect them. Committed transactions recover; a write interrupted before commit is rolled back, not falsely reported as saved.
- Initial installation requires fetching the static bundle. Afterwards the installed PWA can reopen offline. Hosting requires HTTPS except desktop localhost, correct static-route serving, and uncached `sw.js`. Replace deployments as a complete bundle; retain old immutable asset URLs during rollout.
- Browser automation uses Chromium, including mobile-size emulation. It does not certify physical Safari/iOS, Android, an OS install dialog, or native packages. See `NATIVE-PACKAGING.md` for the separate evaluation.

## Verification

- `npm run lint` and `npm run typecheck`: passed.
- `npm test`: 20 tests passed. Coverage includes rotation, late arrivals/re-entry, resting players, multiple courts, concurrent manual/generated assignments, result validation, database reopening, additive migration, backup round trips and simulated restore-write rollback.
- `npm run build`: passed, all six app routes statically exported; 56 files precached.
- `npm run test:browser`: 10 Chromium tests passed against a dedicated production static server. Verified full-route offline navigation/reload, closing/reopening an active match, attendance and result persistence, player/group photo backups, preview confirmation, invalid references/unreadable photos, dark-theme navigation contrast, desktop viewport fit, and worker activation only after all app windows close. Desktop/mobile screenshots inspected.
- `git diff --check`: passed. The user's source logo remains unchanged. Tests use isolated browser/test databases; existing user browser data was not accessed or replaced.

Windows sandbox initially blocked test/build child processes; these checks completed with execution access. An earlier browser run reused an existing port-3000 server; it was discarded and the final suite used an isolated static server on port 3100. A roster test originally refreshed before commit; save confirmation is now visible and the test waits for it.

## Windows packaging and phone testing follow-up

Tauri 2 source/configuration, a validated NSIS offline-WebView2 setup and logo-derived Windows icons are now present. Native backup export uses a Save dialog; IndexedDB remains in an independent WebView2 profile rather than becoming SQLite. Desktop startup skips browser PWA registration. The native build attempt fails at missing Cargo; Tauri info also reports missing MSVC/Windows SDK. No installer has been generated.

HTTPS now directly serves the production `out/` bundle; `phone:setup` prints detected IPv4 and trusted-certificate commands. Additional Chromium tests cover full browser shutdown/offline relaunch (active match, session, attendance, scores and photos), a mocked desktop save-dialog cancellation, and HTTPS/offline caching with a disposable test certificate. No phone or compiled desktop testing is claimed. See `INSTALL-AND-TEST.md`.

Follow-up verification: 20 unit tests and 14 production Chromium tests passed, alongside lint, typecheck, static build and Tauri JSON-schema validation. Native export success/cancellation/write-error tests are mocks. All 59 exported files are precached. Production dependency audit: zero vulnerabilities. Existing saved data was neither accessed nor deleted during tests.

## Rebrand to paddlebai

The header, footer, page/installation metadata, Windows product/window titles, backup UI, and package display name now use paddlebai. Browser, PWA and native icons are regenerated from public/icons/PaddleBai-Logo.png. The IndexedDB name, desktop identifier, window label, Rust executable name and origin are retained to preserve data continuity. Old Paddle Na Bai! backups remain accepted and normalize to the new export name. The user's separate untracked Paddle_Na_Bai/ Vite scaffold is untouched and excluded from the root Next.js TypeScript checks.
