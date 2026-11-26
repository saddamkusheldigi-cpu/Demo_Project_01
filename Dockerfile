FROM node:24-alpine AS dependencies

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-alpine AS runtime

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json server.js ./
COPY public ./public

COPY data ./data

USER node
EXPOSE 3000

CMD ["node", "server.js"]
