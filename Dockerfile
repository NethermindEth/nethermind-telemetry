FROM node:13-alpine
COPY . .
RUN npm install
CMD ["node","src/index.js"]