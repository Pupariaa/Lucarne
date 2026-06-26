# Contributing to Lucarne

Thank you for helping improve Lucarne. This project covers an Arduino/ESP32 library, a web Studio, and published documentation.

## Before you start

- Search [existing issues](https://github.com/Pupariaa/Lucarne/issues) to avoid duplicates.
- For large changes (new widget type, protocol change, Studio overhaul), open an issue first to align on the approach.

## Reporting bugs

Use the [bug report template](https://github.com/Pupariaa/Lucarne/issues/new?template=bug_report.yml). Include:

- Board and core version (e.g. ESP32-S3, Arduino-ESP32 3.x)
- Display driver and resolution (e.g. ST7789 240×280)
- Sketch or export steps to reproduce
- Expected vs actual behaviour
- Serial log or screenshot when useful

## Feature requests

Use the [feature request template](https://github.com/Pupariaa/Lucarne/issues/new?template=feature_request.yml). Explain the use case on real hardware, not only in Studio.

## Pull requests

1. Fork and branch from `main`.
2. Keep PRs focused — one topic per PR when possible.
3. Update docs if you change public API, export format, or user-facing behaviour.
4. Test on hardware when touching firmware or examples.
5. Fill in the PR template.

### Code style

- Match surrounding C++ / JavaScript style in each area.
- No unrelated refactors in the same PR.
- Console output and code comments in English.

### Areas

| Path | Scope |
| --- | --- |
| `src/` | Library firmware |
| `examples/` | Arduino sketches |
| `editor/` | Lucarne Studio |
| `docs/` | Markdown guides and `manual.html` |
| `site/` | Public website sources |

Build the deployable site with `node scripts/build-web.mjs` when changing `site/`, `docs/manual.html`, or editor packaging.

## Versioning and releases

- Version lives in `library.properties` (`version=…`).
- Git tags use a `v` prefix: `v0.1.0` for library version `0.1.0`.
- [Semantic Versioning](https://semver.org/): breaking API/export changes → major; features → minor; fixes → patch.

Maintainers create GitHub Releases from tags and attach notes summarising firmware, Studio, and doc changes.

## Questions

Open a [GitHub Discussion](https://github.com/Pupariaa/Lucarne/discussions) or an issue labeled `question` if Discussions are not enabled.
