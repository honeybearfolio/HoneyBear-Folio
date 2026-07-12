# Contributing to HoneyBear Folio

Thanks for your interest in contributing.

## Ways to contribute

- Report bugs (include steps to reproduce, expected vs actual behavior, OS, and screenshots if relevant)
- Suggest enhancements (describe the user goal and any UX constraints)
- Improve docs (README, import/export notes, troubleshooting)
- Submit pull requests (bug fixes, refactors, features)
- Financialy supporting the project by buying me a coffee: [https://buymeacoffee.com/bernatbc](https://buymeacoffee.com/bernatbc)

## Development setup

See [README.md — Development](README.md#development) for prerequisites, system dependencies, and commands to run or build the app.

All frontend commands below run from the `app/` directory (`cd app` first).

## Quality checks

Run these before opening a PR (CI runs the same checks on `app/` changes):

| Command | Purpose |
|---------|---------|
| `bun test` | Run the Vitest suite (watch mode locally) |
| `bun run coverage` | Run tests with coverage; fails below 80% line coverage |
| `bun run lint` | ESLint with zero warnings allowed |
| `bun run typecheck` | TypeScript check (`tsc --noEmit`) |

Optional pre-commit hooks (Husky + lint-staged) run ESLint and Prettier on staged frontend files. They install automatically when you run `bun install` in `app/`. To skip a one-off commit: `git commit --no-verify`.

## Project layout (quick map)

- `app/src/`: React UI entry (`main.tsx`, `App.tsx`)
- `app/src/features/`: Feature screens and domain UI (accounts, dashboard, assets, FIRE, rules, scheduled, settings, chat, etc.)
- `app/src/components/`: Shared, reusable UI (layout, modals, import/export, form controls)
- `app/src/api/`: Typed Tauri client (`tauri-client.ts`) and shared API types
- `app/src/stores/`: Zustand stores for cross-cutting UI state (theme, privacy, toasts, etc.)
- `app/src/hooks/`, `app/src/utils/`, `app/src/i18n/`: Shared hooks, helpers, and localization
- `app/src-tauri/src/core/`: Rust backend modules (commands, SQLite, market data, import/export)
- `app/src-tauri/src/tests/`: Rust integration and unit tests

## Architecture

Data and actions flow in one direction:

1. **Tauri commands** (`app/src-tauri/src/core/`) — Rust handlers for DB access, calculations, market data, and file I/O.
2. **`tauri-client.ts`** (`app/src/api/`) — Typed wrapper around `invoke()`; feature code should call `rust.*` helpers here instead of invoking commands directly.
3. **Feature screens** (`app/src/features/`) — Route-level views (e.g. `Dashboard`, `AccountDetails`, `FireCalculator`) that compose shared components and wire up user interactions.
4. **Zustand stores** (`app/src/stores/`) — Client-side UI state (theme, number format, privacy mode, toasts) that does not belong in SQLite.

When adding a new capability, start with the Rust command, expose it in `tauri-client.ts`, then build or extend the relevant feature screen.

## Code style & conventions

- Keep changes focused; avoid drive-by reformatting.
- Rust:
  - Format with `cargo fmt`
  - Prefer running `cargo clippy` before opening a PR
- Frontend:
  - Keep component structure consistent with existing patterns
  - Prefer small, readable functions and explicit state updates

## Error handling

Use `handleAsyncError` and `logError` from `app/src/utils/errors.ts` for all async
error paths. Do not pair raw `console.error` with `showToast` — that bypasses the
centralized conventions.

| Surface | Helper | User feedback |
|---------|--------|---------------|
| Full-page load / retry | `handleAsyncError` with `setError` | `ErrorState` with expandable detail |
| Mutations / actions | `handleAsyncError` with `toast` + i18n `userMessage` | Toast notification |
| Background / optional | `logError` only | None |

### Fetch modes (`"page"` vs `"refresh"`)

List screens that load on mount and reload after mutations should accept a mode on
their fetch helper:

- **`"page"`** — initial load or retry: `handleAsyncError({ setError, detailFallback })`
  (no toast).
- **`"refresh"`** — reload after a mutation: `handleAsyncError({ toast, userMessage })`
  (no `setError`).

See `RulesList`, `ScheduledList`, and `AssetTracker` for reference implementations.

### Documented exceptions

These paths intentionally do not call `handleAsyncError`:

- **`ErrorBoundary`** and global `window` error handlers in `App.tsx`
- **Background enrichment** (e.g. stock quotes, daily prices on the dashboard)
- **Import row failures** in `import-transactions.ts` — logged with `logError`, surfaced
  in the import summary UI
- **Import file parsing** in `import-parser.ts` — errors returned to the caller as
  `parseError` / empty rows
- **Update checks** in `UpdateNotification` — inline error state for install/relaunch;
  `logError` for background check failures
- **Session rename/remove** — silent best-effort actions; failures logged with `logError`

Always pass an i18n-translated `userMessage` to toasts. Use `toUserMessage` only for
`ErrorState` detail text via `setError` or `detailFallback`.

If you introduce a new dependency, explain why in the PR description.

## Data & security considerations

This app is a personal finance tool.

- Do not commit any personal data or exported files.
- Imports should validate schema, types, and bounds; treat all input as untrusted.
- When writing XLSX/CSV exports, mitigate formula injection by prefixing or sanitizing cells that begin with `=`, `+`, `-`, or `@`.

## Pull request checklist

Before requesting review:

- The app starts in dev mode (`bun run tauri dev`).
- Frontend builds (`bun run build`).
- Frontend quality checks pass (`bun test`, `bun run lint`, `bun run typecheck`; use `bun run coverage` before large test changes).
- Rust code formats (`cargo fmt`) and is clean under `cargo clippy` (when practical).
- UI changes include screenshots.
- Import/export changes include sample files and edge cases.

## Versioning / releases

Releases are created by pushing a git tag like `v1.2.3`.

The release workflow syncs that version into:

- `app/package.json`
- `app/src-tauri/tauri.conf.json`
- `app/src-tauri/Cargo.toml`
