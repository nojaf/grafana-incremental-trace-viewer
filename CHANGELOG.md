# Changelog

## [Unreleased]

### Fixed

- Fixed the panel failing to load on Grafana 13 / React 19 (`TypeError: Cannot read properties of undefined (reading 'ReactCurrentOwner')`). The bundled `react/jsx-runtime` (React 18) reached for internals that React 19 removed; it is now externalized so the plugin uses the host Grafana's shared `react/jsx-runtime`.

### Changed

- Raised the minimum supported Grafana version to **11.6.14** (`grafanaDependency` `>=11.6.14`). Grafana only exposes `react/jsx-runtime` as a shared SystemJS module from ~11.5 onward, so externalizing it requires this floor. Grafana 11.0–11.4 are no longer supported.

## [0.4.0] - 2026-06-02

### Changed

- Migrated child-count retrieval to Tempo's `span:childCount` TraceQL intrinsic. The plugin now always requests `| select(span:name, resource.service.name, span:childCount)` and reads the count inline. This **requires Grafana Tempo >= 2.10 with the vParquet5 block encoding** (or the G-Research custom Tempo API, which also returns `span:childCount`). The previous bare `childCount` select is now a syntax error on Tempo >= 2.10, so this also fixes that breakage.
- Removed the per-span `count()` fallback query for child counts. Because counts are now returned inline, the previous N+1 fan-out is gone.
- The span detail panel now detects at runtime whether the backend returns all attributes inline (G-Research custom API) versus only the selected ones (standard Tempo), instead of relying on a panel option.

### Removed

- Removed the "Enable G-Research Tempo API support" panel option (`supportsChildCount`). Both backends are now handled by a single build with runtime feature detection, so no per-panel configuration is required.
- Removed the `build:without-child-count` and `dev:without-child-count` scripts and the `SUPPORTS_CHILD_COUNT` build-time environment variable. Use `bun run build` / `bun run dev` for all builds.

## [0.3.0] - 2026-06-02

### Changed

- Lowered the minimum supported Grafana version to 11. The `@grafana/*` packages are now built against `11.6.14` and `grafanaDependency` is set to `>=11.0.0`. The plugin continues to work on Grafana 11 and higher.

## [0.2.0] - 2025-11-04

### Changed

- Converted `SUPPORTS_CHILD_COUNT` from build-time environment variable to runtime panel option. The plugin now uses a panel setting "Enable G-Research Tempo API support" that can be configured per panel when editing a dashboard. This allows a single build to work with both standard Grafana Tempo API and G-Research custom Tempo API.
- Removed `build:with-child-count` script. Use `bun run build` for all builds.
- Updated release workflow to use standard build process.

### Added

- Panel option "Enable G-Research Tempo API support" for runtime configuration of child count support.
- Support for setting default panel option value via `SUPPORTS_CHILD_COUNT` environment variable for local development (e.g., `SUPPORTS_CHILD_COUNT=1 bun run dev`).

## [0.1.5] - 2025-10-31

### Added

- Show clear exception message in span details. https://github.com/G-Research/grafana-incremental-trace-viewer/pull/126
- Show error icon in span in a case of exception. https://github.com/G-Research/grafana-incremental-trace-viewer/pull/125

## [0.1.4] - 2025-09-17

### Fixed

- Simplified release scripts.

## [0.1.3] - 2025-09-16

### Fixed

- Build release plugin with SUPPORTS_CHILD_COUNT=1

## [0.1.2] - 2025-09-10

### Changed

- Use different CI strategy to create release.

## [0.1.1] - 2025-09-10

Testing CI.

## [0.1.0] - 2025-09-10

Initial release.
