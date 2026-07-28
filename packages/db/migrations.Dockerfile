FROM node:24-alpine

WORKDIR /usr/app

COPY ./package*.json ./
COPY ./packages/db/package*.json ./packages/db/

RUN npm install --workspace=packages/db --include-workspace-root

COPY ./tsconfig.json ./
COPY ./packages/db ./packages/db

WORKDIR /usr/app/packages/db

ENTRYPOINT ["node", "--require", "ts-node/register", "../../node_modules/typeorm/cli.js", "-d", "./dataSource.ts"]
CMD ["migration:run"]
