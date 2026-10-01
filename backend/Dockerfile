FROM node:20-alpine AS builder

WORKDIR /app

# Copiar definiciones de dependencias
COPY package*.json ./
RUN npm ci

# Copiar código fuente y compilar TypeScript
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Stage 2: Runtime liviano
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY package*.json ./
RUN npm ci --omit=dev

# Copiar artefactos compilados
COPY --from=builder /app/dist ./dist

EXPOSE 4000

CMD ["node", "dist/server.js"]
