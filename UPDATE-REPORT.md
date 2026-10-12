# PaddleBai update and verification report

Verified October 12, 2026. This update works within the existing application. Existing unfinished changes were inspected and preserved. No existing files were deleted, renamed, or moved; no dependencies were removed. Tests use disposable databases/browser profiles, not the user's saved application data. The database name and schema version remain unchanged.

## 1. Bugs fixed and their causes

| Issue | Cause | Implemented fix and verification |
| --- | --- | --- |
| Scores carried into the next match | Court components retained local input state when the match changed; drafts were not stored per match. | Component identity includes the match ID. Drafts persist on their own match, survive navigation/reopening, and clear on completion. Queued partial writes merge safely; late writes cannot alter a completed match. Regression tests cover a 6–3 result followed by empty new-match inputs, court switching, reload, and offline recovery. |
| Hamburger stayed open | Dismissal depended on the toggle instead of outside interaction, Escape, and navigation. | Added outside-pointer and Escape dismissal, route cleanup, and explicit navigation dismissal. Escape restores trigger focus. Browser tests cover all dismissal paths. |
| About X disappeared when scrolling | The heading scrolled together with the full panel. | Header and X remain outside the independently scrolling body. Short 320×568 mobile tests scroll to support and verify the close control remains visible. Native dialog dismissal and focus behavior remain available. |
| Question marks in dates/history | Display templates contained literal question-mark separators. | Replaced affected separators with bullets/dashes, clarified attendance events, and consistently formatted Philippine dates/times. Browser checks cover reservation and attendance text. |
| Defaults erased custom court settings | Reservation rows were recreated from defaults rather than preserving individually edited state. | Stable controlled rows retain court numbers and times, including after reducing and restoring the court count. Changing defaults does not rewrite existing rows. Applying defaults requires an explicit warning/confirmation and replaces times only. Browser regressions cover each behavior. |

Match result correction now edits the original completed match transactionally, keeping its ID and original end time. Corrections and Undo append an audit history rather than duplicating matches. Statistics are derived again from the corrected records. Conflicting edits are rejected using the version captured when the form opens. Tests verify games, wins, losses, win rate, streaks, correction, Undo, and backup validation.

## 2. Interface and accessibility improvements

- Active sessions show four primary counters: checked-in players, playing, waiting, and currently available courts. Secondary details are expandable. Total Court-Minutes accurately describes aggregated reservation time.
- Playing, Waiting, Resting, Unavailable, Not Checked In, and Checked Out use common definitions. Free courts exclude busy courts and reservations outside their active time window.
- Generate Next Round explains why it is unavailable when there are fewer than four eligible players or no free courts. Manual assignment offers eligible players only, excludes duplicate selections, and stays disabled until four unique players are selected. Existing database guards still protect against concurrent assignments.
- Main navigation is Play, Courts, Leaderboard, History, and Players. Snaps remains available through More. White navigation has dark readable labels and a clear selected state in both themes.
- The empty dashboard has one primary New session action. The mobile developer button has dedicated space beside navigation, preventing overlap with app controls and respecting safe areas.
- Normal body/form text uses rem-based sizing around 16px; key controls have 48px minimum targets. Smaller secondary/navigation labels remain compact to fit narrow screens. Keyboard focus is visible, reduced-motion preferences are respected, and destructive player/group removal requires confirmation.
- About keeps the introduction, email feedback and editable mailto draft, email-copy alternative, and completely optional GCash support. Its header remains visible, content scrolls, and version 1.0.0 is shown. The developer name follows the latest request: Neil Iwelador. Clipboard success/failure feedback remains available offline. No payment processing or personal/financial data collection was added.
- Device Data displays the last successfully initiated export time using Philippine local time. Creating a snapshot or previewing a restore does not falsely count as an export. A browser cannot confirm the user actually retained a downloaded file; native metadata is recorded after the write succeeds.

## 3. Files changed for this update

These are the files touched for this task, not a claim that every existing working-tree change was created by this update.

| Area | Files |
| --- | --- |
| Match data and shared rules | `src/types/index.ts`, `src/lib/db.ts`, `src/lib/reservations.ts`, `src/lib/matchmaking.ts` |
| Match and reservation interface | `src/components/courts/CourtCard.tsx`, `src/components/courts/ReservationSetup.tsx`; new `src/components/courts/ResultEditor.tsx` |
| Dashboard, navigation, About, accessibility | `src/components/App.tsx`, `src/components/layout/Shell.tsx`, `src/components/layout/DeveloperAbout.tsx`, `src/app/globals.css` |
| Players and backup information | `src/components/players/SessionRoster.tsx`, `src/components/players/GroupManager.tsx`, `src/components/DeviceData.tsx`, `src/lib/backup.ts` |
| Offline output | `scripts/build-sw.cjs`, regenerated `public/sw.js` and production export |
| New regression tests | `tests/match-management.test.ts`, `tests/browser/audit-fixes.spec.ts` |
| Existing browser expectations | `tests/browser/attendance.spec.ts`, `close-controls.spec.ts`, `developer-about.spec.ts`, `groups.spec.ts`, `host.spec.ts`, `inline-players.spec.ts`, `offline.spec.ts` |
| Documentation | `INSTALL-AND-TEST.md`; new `UPDATE-REPORT.md` |

Backup validation accepts the additive draft/correction fields while retaining compatibility with existing backups. Cancelled matches may retain unfinished drafts; completed matches may not. Existing atomic restore and photo handling remain intact.

## 4. Potentially unused or duplicate material — retained

| Candidate | Finding and recommendation |
| --- | --- |
| `public/icons/logo.png` | Alternate source artwork, 1,543,753 bytes, not referenced by the current app interface. Retained for review. |
| `public/icons/PaddleBai-Logo.png` | High-resolution source artwork, 950,482 bytes. The header now uses the existing official small icon. Keep the source for branding/native icon generation; it need not be automatically cached. |
| Nested `Paddle_Na_Bai/` | Separate Vite experiment with its own source/configuration. Excluded from the current Next.js build. Its continued value requires the owner's review. No files changed or removed there. |
| `characters/` | Empty directory; no meaningful size impact. |
| CSS layers | Accumulated overrides could be consolidated later with screenshot comparisons. This update preserves earlier rules and adds scoped changes. |

No clearly unused primary component or library was established by the source-reference scan. The font license is required documentation, and the 512px icon is referenced by the manifest; neither should be treated as unused merely because application code does not import it. `local-qr.png` serves the local setup workflow and is not part of the public export.

No dependency was established as safely removable. QR tooling could be classified as development-only in a future dependency review. Desktop checking uses AJV, and Tauri dependencies support the planned desktop bridge. No package removals or dependency changes were made. A fresh security advisory audit was not performed in this update.

## 5. Measured production sizes and safe optimization

Measurements are file bytes from the final production export. MB/KB below are decimal. Summed gzip sizes are estimates from compressing files individually, not observed server transfer sizes or the size of one route's initial download.

| Measurement | Bytes | Approximate size |
| --- | ---: | ---: |
| Entire static export, 61 files | 3,856,668 | 3.86 MB |
| PWA precache, 58 files | 1,359,166 | 1.36 MB |
| JavaScript chunks, excluding worker | 792,097 | 792 KB |
| JavaScript, summed per-file gzip estimate | 245,871 | 246 KB |
| CSS | 50,513 | 50.5 KB |
| CSS gzip estimate | 10,886 | 10.9 KB |
| Bundled local font | 28,356 | 28.4 KB |

Completed optimizations:

- Reused the official 27,004-byte icon for the header instead of the 950,482-byte source image: approximately 97% fewer bytes for that asset.
- Excluded the two unused-at-runtime source images, totaling 2,494,235 bytes, from automatic precaching. This avoids roughly 65% of the otherwise equivalent full precache payload. Both originals remain in the project and export, so total export size is intentionally not reduced by deleting them.
- Precomputed eligible-player fairness priorities and balanced-mode win rates once per matchmaking operation instead of repeatedly scanning history inside sorting. Random mode avoids unnecessary fairness calculations.
- Reused the Philippine date formatter. Fonts, app icons, routes, route payloads, scripts, and styles remain available through the offline cache.

No runtime timing benchmark was performed, so no speed multiplier is claimed. Future work could consolidate CSS, profile session-scoped history queries with large databases, and split infrequently opened forms if measurements justify it. These should be separate measured changes rather than broad restructuring.

## 6. Verification results

| Check | Final result |
| --- | --- |
| `npm run test` | 25 tests passed, 0 failed |
| `npm run test:browser` | 24 Chromium browser tests passed, 0 failed |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm run build` | Passed; static routes generated and 58 files precached |
| `npm run desktop:check -- --config-only` | Passed configuration/schema/icon/export checks |

Coverage includes all five reported bugs, result correction/Undo/statistics, eligible manual assignments, duplicate-submission protections, destructive-action cancellation, narrow mobile layouts, tablet/desktop layouts, 200% text sizing, developer actions, local persistence, backup/photo restore, concurrent assignments, safe service-worker updates, offline navigation, and full browser shutdown followed by offline relaunch.

An intermediate browser run had two failures caused by outdated test selectors for the group-management button and shortened recovery message. Those expectations were corrected; the final complete run has no failures. Existing desktop-bridge tests use a mock. HTTPS testing uses a temporary self-signed certificate with a browser exception and does not establish physical-phone certificate trust.

## 7. Remaining limitations

- Physical iPhone/iPad, Safari installation, Android hardware, and native Windows/WebView2 behavior were not tested. Mobile/tablet checks use Chromium viewport emulation.
- The mailto recipient, subject, and editable body were verified. Launching a real default email application is an operating-system acceptance test that was not performed.
- Browser download initiation cannot establish that a backup was retained on disk. Keep exported backups outside browser storage; clearing site data can still remove local records.
- No new native executable or installer was compiled during this update. Cargo/rustc were not available on the current shell PATH. An existing `src-tauri/target/debug/paddle-na-bai.exe` was found, but it was not rebuilt or tested against these changes and is not evidence of current installer readiness.
- Snaps remains an unfinished feature, accessible through More as requested. No deletion or replacement of its files was performed.
- Wider experimental files and prior working-tree changes remain present for their owner to review.

## 8. PWA and Tauri readiness

The production PWA passes automated offline, persistence, caching, and recovery checks. It is ready for physical installation acceptance testing using a trusted HTTPS deployment or localhost where supported. Confirm safe areas, large system text, clipboard handling, installed-app reopening, and backup export/restore on the actual phone before calling it device-verified.

The static export and Tauri packaging configuration pass the local configuration check. Native release readiness still requires the Rust/Windows build prerequisites, a fresh release build and installer, and tests of WebView2, file dialogs, backup cancellation/write failures, local data reopening, offline use, and update behavior. Existing debug artifacts do not substitute for these checks. See `INSTALL-AND-TEST.md` for setup instructions.
