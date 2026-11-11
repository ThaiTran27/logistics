FROM node:22-bookworm-slim

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci --omit=dev

WORKDIR /app
COPY backend ./backend
COPY shared ./shared

WORKDIR /app/backend

EXPOSE 5000

CMD ["sh", "-c", "node migrations/run.js up && node server.js"]
