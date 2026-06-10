FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install
COPY . .
# Giả sử backend chạy port 3000
EXPOSE 3000

# Lệnh chạy dev (nhớ cài nodemon hoặc ts-node-dev trong package.json)
CMD ["npm", "run", "dev"]