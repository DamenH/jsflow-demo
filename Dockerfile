FROM node:14.16.1-buster-slim@sha256:8bb50ef6c2eda4bcb406f089d9c813d6b5e8c535b01765c634c529d6085fc589 AS interpreter
WORKDIR /opt/jsflow
COPY vendor/jsflow/package.json vendor/jsflow/package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY vendor/jsflow/src ./src
COPY vendor/jsflow/tsconfig.json vendor/jsflow/LICENSE ./
COPY vendor/jsflow/policies ./policies
RUN ./node_modules/.bin/tsc
FROM node:22.14.0-bookworm-slim@sha256:1c18d9ab3af4585870b92e4dbc5cac5a0dc77dd13df1a5905cea89fc720eb05b AS browser-build
WORKDIR /browser/editor
COPY demo/editor/package.json demo/editor/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY --from=interpreter /opt/jsflow /opt/jsflow
COPY demo/editor ./
COPY demo/scenarios.js /browser/scenarios.js
COPY demo/web/index.html /browser/web/index.html
RUN node build.js

FROM scratch AS pages
COPY --from=browser-build /browser/editor/dist /assets
COPY --from=browser-build /browser/editor/dist/index.html /index.html
COPY demo/web/style.css /style.css
COPY demo/pages/.nojekyll /.nojekyll

FROM interpreter
COPY demo /demo
COPY --from=browser-build /browser/editor/dist /demo/web/assets
COPY --from=browser-build /browser/editor/dist/index.html /demo/web/index.html
USER node
ENTRYPOINT ["node", "/demo/run.js"]
CMD ["suite"]
