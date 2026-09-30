FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY admin-web/package.json admin-web/package.json
COPY driver-app/package.json driver-app/package.json
RUN npm ci --workspace=@empimecatronic/backend --include-workspace-root

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY backend ./backend
COPY --from=dependencies /app/backend/node_modules ./backend/node_modules
WORKDIR /app/backend
RUN npx prisma generate
USER node
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]

