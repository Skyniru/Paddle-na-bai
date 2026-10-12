# Continuous open play, results sharing and theme verification

Completed and verified October 12, 2026, within the existing PaddleBai project. No existing files were deleted, renamed or moved. No dependencies were installed or removed. Saved records and database migrations were retained; automated tests use disposable data and browser profiles.

## Stable queue and independent courts

New sessions automatically include the selected players as present. Starting the session fills eligible courts without a separate check-in or Generate Next Round step. Late players added to the playing list become eligible automatically.

Up Next and Standby are stored on the session in IndexedDB. Clock ticks and component renders do not regenerate the queue. A confirmed four-player group retains its membership and team slots until assigned or until a member becomes ineligible. Departure/rest replaces only that member when a replacement is available. Late arrivals enter the waiting rotation without displacing a confirmed group.

Completing a result and assigning the next group happen in one database transaction. The existing Up Next group is consumed first, then another eligible group is prepared. Other occupied courts and their matches remain unchanged. A simulated assignment failure verifies that the completed-result update and queue changes roll back together. Concurrent court completions and repeat submissions cannot double-assign players.

Fair/balanced waiting priority considers games assigned, the start of the current waiting period/recent participation, and retained order for ties. Balanced team selection and partner-history handling reuse the existing matchmaking implementation. Random mode prepares a randomized group at a meaningful event and then keeps that group fixed. When fewer than four players are ready, the queue says “Waiting for more players.”

The organizer can choose Taking a rest or Finished for today during a match using the existing availability control. That choice applies after the match, preserving the current teams. This avoids immediately assigning a player who wants to stop. End session cancels unfinished matches without inventing results, clears the live queue and keeps the recap/history.

Legacy active sessions without the new flag are resumed into automatic rotation without rewriting existing matches or explicit departures. The existing manual APIs and explicitly manual records (`continuous: false`) retain their compatibility path, labelled Resume rotation rather than Generate Next Round. New UI-created sessions always use automatic rotation. No new manual-mode setting was added to the interface.

## Shareable final results

An optional local session banner photo can be supplied during session creation. It is retained in the session and portable backups. The recap shows that photo, the second–first–third podium with silver/gold/bronze medals, the existing full standings and essential export/Done actions.

Share Results generates PNG images locally using canvas and bundled fonts/logo. The image includes the session name, location, Philippine session date, optional photo, podium and actual completed-match standings. The screen and image use the same ranking helper. Players without completed games remain listed but do not receive podium medals. Cancelled matches do not count in standings.

Up to 12 players fit on each image page; larger crews produce explicitly numbered pages with every player included. Names wrap and row/podium heights expand as needed. The final image is cropped to the actual content height. There is no cloud rendering, account requirement or payment processing.

Supported browsers use native file sharing. Unsupported or failed sharing falls back to PNG downloads, while user cancellation does not trigger an unwanted download. Save PNG provides an explicit download/save action. For multiple pages, individual save buttons are also available if the browser restricts simultaneous downloads. Tauri uses its save dialog and binary file-write bridge; the corresponding capability is added to the existing capability file. Failed native writes and cancelled save dialogs show feedback.

Exports are regenerated from current results. Result corrections or player-name changes invalidate previously prepared page controls so users do not unknowingly save an outdated snapshot.

## Theme persistence

The existing single theme system and early startup script are reused. Manual light/dark choices remain in local storage and override the system preference. Fresh browser profiles were closed completely and reopened offline with the opposite system scheme, then navigated through the main routes. Both selected modes persisted. The latest requested dark header/navigation appearance is preserved.

No duplicate theme provider or preference store was introduced. Local preferences persist while the application's site storage remains available; clearing that storage removes them.

## Data compatibility

Database name, indexed schema version 5, backup format version 1 and old migrations are unchanged. New session fields (`continuous`, `mode`, `queue`, `bannerPhoto`) are additive. Backup validation checks photo data, queue uniqueness, session membership, availability and overlap with active matches. Older backups without these fields remain supported. Existing players, photos, score drafts, match correction history and legacy reservation records remain intact.

## Changed files

| Area | Files |
| --- | --- |
| Session data and atomic rotation | `src/types/index.ts`, `src/lib/db.ts`, `src/lib/backup.ts`; new `src/lib/queue.ts` |
| Live interface | `src/components/App.tsx`, `src/components/players/SessionRoster.tsx`, `src/components/courts/CourtCard.tsx`, `src/app/globals.css`; new `src/components/courts/SessionQueue.tsx` |
| Recap and PNG export | `src/components/leaderboard/LeaderboardTable.tsx`; new `src/lib/standings.ts`, `src/lib/results-image.ts`, `src/components/results/ResultsRecap.tsx` |
| Native save capability | `src-tauri/capabilities/main.json` |
| New tests | `tests/continuous.test.ts`, `tests/browser/continuous.spec.ts`, `tests/browser/theme-reopen.spec.ts` |
| Updated browser flows | `tests/browser/attendance.spec.ts`, `audit-fixes.spec.ts`, `close-controls.spec.ts`, `groups.spec.ts`, `host.spec.ts`, `inline-players.spec.ts`, `offline.spec.ts`, `relaunch.spec.ts` |
| Documentation/output | `INSTALL-AND-TEST.md`, this report, regenerated static export and service worker |

## Final verification

| Check | Result |
| --- | --- |
| Unit tests | **33 passed, 0 failed** |
| Chromium browser tests | **33 passed, 0 failed** |
| TypeScript | Passed |
| Lint | Passed |
| Production build | Passed; 57 static files precached |
| Tauri configuration check | Passed; configuration check only |

Tests cover initial assignment, late-player eligibility, stable group repair, concurrent independent court reassignment, duplicate prevention, storage rollback, accurate statistics, end-session handling, legacy recovery, backup validation, score recovery, offline routes, responsive layouts and service-worker updates. Queue and draft persistence were verified after a full browser shutdown/offline reopening. Both themes passed the same complete reopening test.

The image test exports 25 players into three valid PNG files and verifies every name was drawn. It verifies native-share arguments/cancellation using a mock, and tests the Tauri binary PNG-write bridge, cancellation and write errors with a mock. Generated PNG output was also visually inspected.

Intermediate test failures came from prior manual-flow expectations, comparing visible newline formatting with DOM text, and assuming a newly prepared team's order exactly matched Standby display order. Those expectations were updated to the automatic workflow and stable membership contract. A theme test constructed an uncached double-slash home URL; it was corrected to the real cached home route. The final complete suites have no failures. An initial lint/type check found a mutable declaration and queue-validation typing issues; these were corrected before the passing build.

## Remaining limits

- Physical iPhone/Safari, Android hardware, installed-PWA device sharing and native Windows/WebView2 execution were not tested. Browser mobile/tablet checks use viewport emulation. No native installer was rebuilt.
- Native sharing availability and destination apps are controlled by the device. Messenger/Facebook posting was not performed. Download, individual-page save and native-share fallback paths are available.
- Multiple downloads may require browser permission. The export identifies every page and offers individual save controls; a browser cannot prove the user retained a downloaded file.
- Extremely long metadata or unusually large legacy names may exceed safe canvas dimensions; export reports an error instead of silently cutting off results. Normal saved-player names wrap, and long standings use additional pages.
- Timers still depend on the device clock. Local records, queue and preferences remain subject to browser storage clearing, so portable backups remain useful.
