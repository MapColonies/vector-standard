FROM node:24 AS build

ARG package=synchronizer

WORKDIR /tmp/buildApp

COPY package.json package-lock.json ./
COPY packages/db/package.json ./packages/db/package.json
COPY packages/${package}/package.json ./packages/${package}/package.json

RUN npm install

COPY tsconfig.json ./
COPY packages/db ./packages/db
COPY packages/${package} ./packages/${package}

RUN npm run build -w packages/${package}

FROM node:24.10.0-alpine3.22 AS production

ARG package=synchronizer

RUN apk add dumb-init

ENV NODE_ENV=production
ENV SERVER_PORT=8080

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
COPY packages/db/package.json ./packages/db/package.json
COPY packages/${package}/package.json ./packages/${package}/package.json
RUN npm install --omit=dev

COPY --chown=node:node --from=build /tmp/buildApp/packages/db/package.json ./packages/db/package.json
COPY --chown=node:node --from=build /tmp/buildApp/packages/db/dist ./packages/db/dist
COPY --chown=node:node --from=build /tmp/buildApp/packages/${package}/dist ./packages/${package}/dist

USER node
EXPOSE 8080
WORKDIR /usr/src/app/packages/${package}/dist
CMD ["dumb-init", "node", "--import", "./instrumentation.mjs", "./src/index.js"]
