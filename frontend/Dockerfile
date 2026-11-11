FROM node:22-bookworm-slim

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

WORKDIR /app
COPY frontend ./frontend
COPY shared ./shared

WORKDIR /app/frontend

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
