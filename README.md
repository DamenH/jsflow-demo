# JSFlow browser debugger

A static, browser-only teaching demo of JSFlow information-flow tracking. Monaco
provides an editable ES5 source view, real statement stepping, breakpoints, and
hover inspection of variable values, security labels, and execution context.

The authors' interpreter runs in a browser worker. The site has no execution
backend and never sends edited programs to a server. Ten examples include
explicit and implicit flows, conservative rejection, callbacks, and queued
callback delivery through an inline `defer` helper and a bounded timer adapter.
The library example covers control flow through a getter. Visible notes
explain the source and sink policy; comparison and diagnostic controls are below
the editor. See [ROLLBACK.md](ROLLBACK.md) for independent feature switches and
the exact baseline revision.

## Build

Only Docker is required:

```sh
./demo.sh export site
python3 -m http.server --directory site 8000
```

Open http://localhost:8000. The output works at a domain root or repository
subpath. GitHub Actions builds and publishes the `site` artifact to Pages when
changes are pushed to `main`.

## Provenance and policy

The upstream source is vendored unchanged at the commit recorded in
`UPSTREAM.json`; its original licenses and notices are retained. Monaco is MIT
licensed. Built assets include JSFlow and Monaco license files.

`publicOutput` is a demo sink that checks the value and effective context labels.
`print` is a trusted diagnostic. The examples define `defer(callback, value)`
inline, using a fixed 1000 ms presentation delay and calling
`setTimeout`. A timer host adapter waits in real time, then resumes the actual
interpreted callback. It retains scheduling context, delay/function labels, and
callback argument labels. Delays are clamped to 0–2000 ms; timers accept function
callbacks and optional arguments, without cancellation or string callbacks.
The interpreted language is non-strict ES5; promises and async/await are not
provided. This is a teaching API model, not a complete browser event loop or a
guarantee about timing channels.
Set `fixedTimers` to `false` to restore random 500–1499 ms delays, or edit the
helper in the browser to explore another delay expression.

Static hosting cannot attach custom response headers to individual workers, so
workers start through Blob bootstraps and inherit the page's Content Security
Policy. Network connections are disabled. The policy permits dynamic evaluation
for the optional native-JavaScript comparison; edited source executes only in
workers. Execution, callback, output and time limits keep runs stoppable.

## Checks

The browser integration scripts require an installed Playwright package and
Chromium. Set `PLAYWRIGHT_MODULE` to its installed module path when needed:

```sh
node demo/test-browser.cjs http://localhost:8000/
node demo/test-callbacks.cjs http://localhost:8000/
node demo/test-teaching-options.cjs
node demo/test-teaching-ui.cjs http://localhost:8000/
node demo/test-library-model.cjs http://localhost:8000/
```

The upgrade-and-disclosure and declassification examples are disabled. Their
checks in `demo/test-upgrade-disclosure.cjs` and
`demo/test-declassification.cjs` apply when their corresponding feature is enabled.

The original Docker CLI suite remains available through `./demo.sh build` and
`./demo.sh`. This repository contains only the demo, build inputs, tests and
upstream artifact; it contains no class notes, credentials or private data.
