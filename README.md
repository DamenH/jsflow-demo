# JSFlow browser debugger

A static, browser-only teaching demo of JSFlow information-flow tracking. Monaco
provides an editable ES5 source view, real statement stepping, breakpoints, and
hover inspection of variable values, security labels, and execution context.

The authors' interpreter runs in a browser worker. The site has no execution
backend and never sends edited programs to a server. Nine examples include
explicit and implicit flows, conservative rejection, callbacks, and queued
callback delivery through an inline `defer` helper and a bounded timer adapter.

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
inline, choosing a random 500–1499 ms delay using JSFlow's Math API and calling
`setTimeout`. A timer host adapter waits in real time, then resumes the actual
interpreted callback. It retains scheduling context, delay/function labels, and
callback argument labels. Delays are clamped to 0–2000 ms; timers accept function
callbacks and optional arguments, without cancellation or string callbacks.
The interpreted language is non-strict ES5; promises and async/await are not
provided. This is a teaching API model, not a complete browser event loop or a
guarantee about timing channels.

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
```

The original Docker CLI suite remains available through `./demo.sh build` and
`./demo.sh`. This repository contains only the demo, build inputs, tests and
upstream artifact; it contains no class notes, credentials or private data.
