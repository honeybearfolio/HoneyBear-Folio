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
- Rust code formats (`cargo fmt`) and is clean under `cargo clippy` (when practical).
- UI changes include screenshots.
- Import/export changes include sample files and edge cases.

## Versioning / releases

Releases are created by pushing a git tag like `v1.2.3`.

The release workflow syncs that version into:

- `app/package.json`
- `app/src-tauri/tauri.conf.json`
- `app/src-tauri/Cargo.toml`
