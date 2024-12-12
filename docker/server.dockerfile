FROM node:18-alpine

RUN apk add --no-cache \
    postgresql-client \
    netcat-openbsd \
    gnupg \
    openssl \
    && rm -rf /var/cache/apk/*

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY wait-for-it.sh /wait-for-it.sh
RUN chmod +x /wait-for-it.sh

COPY . .

RUN npx prisma generate

EXPOSE 5000
EXPOSE 5555

ENTRYPOINT ["/wait-for-it.sh"]
CMD ["npm", "run", "start:dev"]