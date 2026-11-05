#!/bin/sh
set -eu
cd "$(dirname "$0")"
image=assignment4-jsflow:demo
case "${1:-suite}" in
  build)
    docker build -t "$image" .
    ;;
  export)
    docker build --target pages --output "type=local,dest=${2:-site}" .
    ;;
  web)
    printf 'Open http://localhost:%s (Ctrl-C to stop)\n' "${PORT:-8765}"
    exec docker run --rm --name assignment4-jsflow-web \
      -p "127.0.0.1:${PORT:-8765}:8080" --read-only --cap-drop ALL \
      --security-opt no-new-privileges --pids-limit 96 --memory 512m \
      --entrypoint node "$image" /demo/server.js
    ;;
  repl)
    exec docker run --rm -it --network none --read-only --cap-drop ALL \
      --security-opt no-new-privileges --entrypoint node "$image" \
      /opt/jsflow/out/Toplevel/nodejs/NodeFlow.js
    ;;
  *)
    exec docker run --rm --network none --read-only --cap-drop ALL \
      --security-opt no-new-privileges "$image" "${1:-suite}"
    ;;
esac
