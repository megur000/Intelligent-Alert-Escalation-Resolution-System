FROM node:18-alpine

WORKDIR /app

COPY . .

RUN npm install express kafkajs prom-client

EXPOSE 9100

CMD ["node", "index.js"]
