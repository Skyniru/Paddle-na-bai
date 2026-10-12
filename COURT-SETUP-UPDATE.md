# Simplified court setup — October 12, 2026

## Completed changes

- Court Setup now contains the requested explanation and a single Available Courts numeric input, supporting 1–12 courts. The last count is remembered after successful session creation. Invalid or inaccessible preference storage falls back to four courts; session creation still works.
- New courts are automatically numbered from Court 1. New sessions do not supply reservation dates, court numbers, start/end schedules, or planned duration.
- Removed reservation controls, reservation countdowns, extension buttons, expiry warnings, and Total Court-Minutes from live screens. Historical reservation details remain viewable for older records.
- Automatic and manual assignment no longer use reservation timestamps to restrict court availability. They still check session membership, active session state, occupied courts, eligible attendance, and exclusive player assignment. Rotation modes are preserved.
- Small independent match timers remain beside Playing. They use stored match creation/end timestamps, show MM:SS or HH:MM:SS, recover after reload/navigation, and reset with each new match.
- Sessions end only through the organizer's End session action. The existing transaction cancels unfinished matches without assigning winners, retains completed results, and saves actual session end/elapsed time. Ending now opens that session's saved recap automatically, including a clear explanation of cancelled unfinished matches.

## Data compatibility

No existing file was deleted, renamed, or moved. Database identity, migrations, schema version, historical court numbers, reservation timestamps/history, and backup format remain intact. The old reservation validation/extension API remains for compatibility but is no longer exposed as live scheduling controls. Old backups still restore their original records; historical schedules do not block subsequent open play. Existing atomic backup restore and photo persistence are unchanged. Tests use disposable data.

## Files modified

- `src/components/courts/ReservationSetup.tsx`: repurposed in place as simple Court Setup, preserving the file path.
- `src/components/courts/CourtCard.tsx`: removed live scheduling/extension controls.
- `src/components/App.tsx`: unscheduled session creation, remembered count, simplified statistics, direct recap navigation, historical details and cancelled-match explanation.
- `src/lib/reservations.ts`: compatibility helpers now ignore historical scheduling for availability/status.
- `src/lib/db.ts`: availability error messages use open-play language; existing transactional guards remain.
- `src/lib/match-time.ts`: long-match hour formatting.
- `tests/attendance.test.ts`, `tests/match-management.test.ts`: scheduling-independent availability, exclusive assignment, court numbering/counts, backups and duration regressions.
- `tests/browser/audit-fixes.spec.ts`, `attendance.spec.ts`, `groups.spec.ts`, `host.spec.ts`, `inline-players.spec.ts`: simplified setup and recap expectations; new four-court/count-preference workflow.
- Generated production export/service worker; `INSTALL-AND-TEST.md`; this report.

## Verification

| Check | Final result |
| --- | --- |
| Unit tests | 27 passed, 0 failed |
| Chromium browser tests | 27 passed, 0 failed |
| TypeScript | Passed |
| Lint | Passed |
| Production build | Passed; 57 exported files precached |

Coverage includes one- and four-court creation, sequential numbering, starting without scheduling, independent timers, refresh recovery, completed-round generation, concurrent assignment protection, manual ending/recap, remembered counts, old backups/photos, offline routes, browser shutdown/offline reopening, mobile/tablet/desktop layouts, and themes.

Intermediate failures identified outdated test assumptions about expired courts, removed reservation controls, and navigation after ending. A new browser fixture also needed explicit check-in and a loop that accounted for check-in buttons disappearing. Those tests were corrected; the final complete runs pass. Lint initially flagged synchronous preference loading and an unescaped apostrophe; both were fixed.

## Limitations

Physical iPhone/Safari and native Windows/WebView2 were not tested. No native installer was rebuilt in this update. The existing static export and offline approach are preserved for PWA and Tauri, but real-device installation, native dialogs and native packaging still require acceptance tests. Browser-storage clearing can remove preferences/local data; exported backups remain important. Match elapsed time follows the device clock, so manually changing that clock can affect displayed duration.
