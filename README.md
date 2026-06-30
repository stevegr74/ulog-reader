# PX4 ULog Reader

A browser-based PX4 `.ulg` flight-log reader written in plain JavaScript with no runtime dependencies.

This project focuses on reliable local parsing, fast inspection of PX4 topics, clear diagnostics, and incremental development toward a product-ready log analysis tool.

---

## Features

- Static browser app
- Local-only file parsing; logs are not uploaded
- ULog header validation
- Format definition parsing
- Metadata and multi-info parsing
- Parameter and default-parameter parsing
- Topic subscription tracking
- Data-message decoding using in-log schemas
- Nested field flattening
- Numeric array field expansion
- Logged string parsing
- Dropout, flag, sync, and compatibility message capture
- Topic browser with filtering
- Overview metrics
- Parse-health diagnostics
- Message-type counts
- Largest-topic summary
- Per-topic record table
- Paged row inspection
- Numeric field plotting
- CSV export for selected topics
- Built-in app documentation under the Docs tab
- Sample parser regression check

---

## Current Status

Milestone 1 Complete - First Working Static Reader

- App opens PX4 `.ulg` files from the browser file picker
- Parser successfully decodes the verified sample log:
  - ULog v1
  - 3902 messages
  - 2553 data records
  - 191 formats
  - 113 topics
  - 780 parameters
  - 0 topic parse errors
- Main UI views are implemented:
  - Overview
  - Topic
  - Metadata
  - Formats
  - Logs
  - Docs
- CSV export works for the selected topic
- Lightweight canvas plotting works for numeric fields
- Local static server is included

Known limitations:

- Plotting is intentionally basic
- No multi-field plots yet
- No time-window filtering yet
- No binary export formats yet
- No automated browser UI tests yet
- Parser coverage is validated against one known sample so far
- Very large logs may need streaming or worker-based parsing for product-grade responsiveness

---

## Architecture

The reader is intentionally small and dependency-free:

- `index.html`  
  Static app shell, tabs, controls, and built-in documentation

- `src/ulog-parser.js`  
  ULog parser, message dispatch, schema decoding, topic construction, metadata extraction, and parse diagnostics

- `src/app.js`  
  Browser UI orchestration, file loading, rendering, plotting, paging, filtering, and CSV export

- `src/styles.css`  
  Application layout, topic browser, tables, plots, responsive rules, and documentation styling

- `server.mjs`  
  Small local static server for running the app at `http://127.0.0.1:5179`

- `test/parse-sample.mjs`  
  Node-based parser smoke/regression check for the verified sample log

---

## Running

Run the local static server:

```powershell
node server.mjs
```

Then open:

```text
http://127.0.0.1:5179
```

If that port is already in use:

```powershell
$env:PORT=5180; node server.mjs
```

Then open:

```text
http://127.0.0.1:5180
```

You can also open `index.html` directly in a browser, but the local server path is preferred.

---

## Tests

Run the parser sample check:

```powershell
node test/parse-sample.mjs example.ulg
```

The default test path points at `example.ulg` in the project directory:

```powershell
node test/parse-sample.mjs
```

Note: on Windows PowerShell, `npm.ps1` may be blocked by execution policy. Running the Node test directly avoids that issue.

---

## Roadmap

### Milestone 1 - First Working Static Reader Complete

- Static app shell
- Browser file picker
- ULog header validation
- Core message parsing
- Topic table inspection
- Numeric plotting
- CSV export
- Built-in documentation
- Sample regression check

### Milestone 2 - Parser Confidence And Coverage

- Add more real PX4 sample logs from different vehicle types
- Add focused tests for each supported ULog message type
- Add tests for nested structures and arrays
- Preserve raw offsets for decoded records where useful
- Improve diagnostics for malformed or partially written logs
- Add parser summary warnings for unknown message types and decode failures
- Document the supported ULog subset explicitly

### Milestone 3 - Product-Grade Topic Exploration

- Add sortable topic and record tables
- Add column search/filtering inside selected topics
- Add time-range filtering
- Add timestamp normalization options
- Add field pinning or favorite fields
- Add units and human-readable formatting for common PX4 fields
- Add better empty states and loading states

### Milestone 4 - Better Plotting And Analysis

- Multi-field plots
- Time-based x-axis
- Zoom and pan
- Hover readouts
- Field statistics such as min, max, mean, and sample count
- Downsampling for large datasets
- Common PX4 quick plots for attitude, GPS, battery, actuator, and IMU topics

### Milestone 5 - Performance And Large Log Handling

- Move parsing into a Web Worker
- Add progress reporting during parse
- Avoid storing unnecessary duplicate data
- Add lazy topic materialization if needed
- Benchmark large logs
- Keep the UI responsive while parsing and rendering

### Milestone 6 - Export And Sharing

- Export filtered topic CSV
- Export selected fields only
- Export summary JSON
- Export parser diagnostics
- Add copy-to-clipboard for tables and diagnostics
- Add reproducible issue-report bundle without including private flight data by default

### Milestone 7 - Packaging And Release

- Add automated browser smoke tests
- Add GitHub Actions checks
- Add versioned releases
- Add hosted static build option
- Add offline downloadable artifact
- Add screenshots or short demo media to the README
- Decide whether the app remains dependency-free or adopts a small plotting/table library

### Milestone 8 - Product Ready

- Validate against a broad PX4 log corpus
- Confirm behavior on Windows, macOS, and Linux browsers
- Add privacy/security notes
- Add user-facing troubleshooting guide
- Add accessibility pass
- Add large-log performance acceptance targets
- Add release checklist
- Tag `v1.0.0`

---

## Future Improvements

- ULog schema reference view
- Compare two logs side by side
- Derived signals and computed fields
- PX4-specific health checks
- Flight timeline view
- Map view for GPS tracks
- Battery and actuator summary panels
- Import/export presets for common analysis workflows
- PWA/offline install support

---

## Design Principles

- Local-first and privacy-preserving
- No server requirement beyond static file serving
- No external runtime dependencies unless they clearly earn their place
- Incremental development with working checkpoints
- Parser changes backed by real sample logs and regression tests
- Keep raw ULog concepts visible rather than hiding useful diagnostic detail
- Prefer clear inspection tools before polished dashboards

---

## Contributing

This is primarily a personal project for learning and development.

Contributions are welcome for:

- Bug fixes
- Additional sample-log compatibility improvements
- Parser correctness improvements with tests
- UI improvements that keep the local-first workflow simple

---

## License

MIT
