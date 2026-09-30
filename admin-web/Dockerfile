FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY admin-web/package.json admin-web/package.json
COPY driver-app/package.json driver-app/package.json
RUN npm ci --workspace=@empimecatronic/admin-web --include-workspace-root
COPY admin-web ./admin-web
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL
RUN npm run build --workspace=@empimecatronic/admin-web

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/admin-web ./admin-web
USER node
WORKDIR /app/admin-web
EXPOSE 3001
CMD ["../node_modules/.bin/next", "start", "-p", "3001"]

