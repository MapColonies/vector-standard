FROM node:24.10.0-alpine3.22

RUN apk add dumb-init

ENV NODE_ENV=production
ENV TS_NODE_TRANSPILE_ONLY=true

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
COPY packages/db/package.json ./packages/db/package.json

RUN npm install --workspace=packages/db --include-workspace-root --omit=dev

COPY tsconfig.json ./
COPY packages/db ./packages/db

USER node
WORKDIR /usr/src/app/packages/db

ENTRYPOINT ["dumb-init", "node", "--require", "ts-node/register", "../../node_modules/typeorm/cli.js", "-d", "./dataSource.ts"]
CMD ["migration:run"]
