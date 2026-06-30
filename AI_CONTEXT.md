Project: PX4 ULog Reader (static browser app)

Current checkpoint on 2026-06-30:
- First working product baseline is committed and pushed to GitHub:
  - repository: `stevegr74/ulog-reader`
  - branch: `main`
  - history has been cleaned to avoid embedding local sample-log paths
- Current verified parser baseline uses:
  - `example.ulg`
- Verified sample result:
  - ULog v1
  - 3902 messages
  - 2553 data records
  - 191 formats
  - 113 topics
  - 780 parameters
  - 0 topic parse errors

Current app structure:
- `index.html`
  - static app shell
  - tabs: Overview, Topic, Metadata, Formats, Logs, Docs
  - file picker for `.ulg` files
  - built-in documentation in the Docs tab
- `src/ulog-parser.js`
  - dependency-free ULog parser
  - validates ULog magic/header
  - parses message types currently needed by the verified sample:
    - `F` format definitions
    - `I` info
    - `M` multi-info
    - `P` parameters
    - `Q` default parameters
    - `A` add logged topic
    - `R` remove logged topic
    - `D` data
    - `L` logged strings
    - `O` dropouts
    - `B` flags
    - `S` sync
    - `C` compatibility
  - stores unknown messages with type, size, and offset
  - tracks parser stats including total messages, data messages, file bytes, and per-message-type counts
  - flattens nested fields and arrays into table-friendly field names
- `src/app.js`
  - browser UI state and rendering
  - file loading via `File.arrayBuffer()`
  - overview cards
  - parse-health table
  - topic filtering
  - selected-topic detail rendering
  - numeric field plotting with canvas
  - paged record table
  - metadata, format, and log rendering
  - selected-topic CSV export
- `src/styles.css`
  - application layout and responsive styling
  - docs styling
- `server.mjs`
  - local static server
  - default URL: `http://127.0.0.1:5179`
- `test/parse-sample.mjs`
  - Node parser smoke/regression test
  - when run against the verified sample filename, asserts the known baseline counts and zero topic parse errors

Current user-facing state:
- User has run the app and said it is working and looks pretty good.
- User asked for a sensible product-ready roadmap.
- README has been expanded to follow the broad style of the Spectrum emulator README.
- `AI_CONTEXT.md` has been added in the checkpoint style of the Spectrum emulator project.
- `LICENSE` has been added using the same MIT license text as the Spectrum emulator project.

Important environment notes:
- Local project path:
  - `C:\Users\steve\Projects\ulog-reader`
- Sample log path:
  - `example.ulg`
- GitHub account:
  - `stevegr74`
- GitHub repository:
  - `https://github.com/stevegr74/ulog-reader`
- GitHub CLI `gh` was not installed during the first push.
- GitHub connector was available and verified remote contents.
- PowerShell may block `npm.ps1`; prefer direct Node commands for now.

Validation commands:
- Parser baseline:
  - `node test\parse-sample.mjs example.ulg`
- Start local app:
  - `node server.mjs`
- Alternate port:
  - `$env:PORT=5180; node server.mjs`

Roadmap summary:
- Milestone 1 is complete:
  - first static reader, parser baseline, UI tabs, CSV export, docs, and sample regression check
- Milestone 2 should focus on parser confidence:
  - more sample logs
  - focused tests per message type
  - malformed/partial-log diagnostics
  - explicit supported-ULog subset documentation
- Milestone 3 should focus on topic exploration:
  - sortable tables
  - field filters
  - time-range filtering
  - timestamp options
  - units and common PX4 formatting
- Milestone 4 should focus on plotting and analysis:
  - multi-field plots
  - time x-axis
  - zoom/pan
  - hover readouts
  - statistics
  - downsampling
  - common PX4 quick plots
- Milestone 5 should focus on performance:
  - Web Worker parsing
  - progress reporting
  - lazy materialization if needed
  - large-log benchmarks
- Milestone 6 should focus on export/share:
  - filtered CSV
  - selected fields
  - JSON summaries
  - diagnostics export
  - privacy-preserving report bundles
- Milestone 7 should focus on release mechanics:
  - browser smoke tests
  - GitHub Actions
  - versioned releases
  - hosted static build option
  - offline artifact
- Milestone 8 should be product-ready hardening:
  - broad PX4 corpus validation
  - cross-browser checks
  - privacy/security notes
  - troubleshooting guide
  - accessibility pass
  - performance targets
  - `v1.0.0`

Design constraints to preserve:
- Keep the app local-first and privacy-preserving.
- Keep it static-file friendly.
- Avoid dependencies until a dependency clearly pays for itself.
- Do not hide raw ULog concepts; diagnostic detail is useful for this tool.
- Add parser changes with real sample validation where possible.
- Prefer incremental, working checkpoints over large rewrites.

Best next step:
- Commit the roadmap/documentation/license changes.
- Then start Milestone 2 by adding a small parser test suite around individual ULog message types before broadening sample-log coverage.
