# syntax = docker/dockerfile:1

ARG NODE_VERSION=22.21.1
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Node.js"

WORKDIR /app

ENV NODE_ENV="production"

FROM base AS build

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Cambiar: usar npm install en lugar de npm ci
COPY package.json ./
RUN npm install

COPY . .

FROM base

COPY --from=build /app /app

EXPOSE 8080

# Asegurar que existe el directorio persistente
RUN mkdir -p /data/uploads

CMD [ "npm", "run", "start" ]