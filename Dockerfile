FROM node:20-alpine

WORKDIR /server

COPY package.json package-lock.json turbo.json ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/storefront/package.json ./apps/storefront/

RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 9000 5173 8000

ENTRYPOINT ["./start.sh"]