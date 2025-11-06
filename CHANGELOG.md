# Changelog

## [0.3.0] - 2025-11-06

### Added

- Error boundary for any unexpected API errors. https://github.com/G-Research/grafana-incremental-trace-viewer/pull/130

## [0.2.0] - 2025-11-04

### Changed

- Converted `SUPPORTS_CHILD_COUNT` from build-time environment variable to runtime panel option. The plugin now uses a panel setting "Enable G-Research Tempo API support" that can be configured per panel when editing a dashboard. This allows a single build to work with both standard Grafana Tempo API and G-Research custom Tempo API.
- Removed `build:with-child-count` script. Use `bun run build` for all builds.
- Updated release workflow to use standard build process.

### Added

- Panel option "Enable G-Research Tempo API support" for runtime configuration of child count support. https://github.com/G-Research/grafana-incremental-trace-viewer/pull/128
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
