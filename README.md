# JSFlow browser debugger

A static, browser-only teaching demo of JSFlow information-flow tracking. Monaco
provides an editable ES5 source view, real statement stepping, breakpoints, and
hover inspection of variable values, security labels, and execution context.

The authors' interpreter runs in a browser worker. The site has no execution
backend and never sends edited programs to a server. Nine examples include
explicit and implicit flows, conservative rejection, callbacks, and queued
callback delivery through the demo's `defer(callback, value)` API model.

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
`print` is a trusted diagnostic. `defer` is a bounded FIFO teaching API model that
retains registration context and argument labels; it is not a native timer or a
full browser event loop. The interpreted language is non-strict ES5.

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
