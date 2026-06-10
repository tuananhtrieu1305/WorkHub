FROM node:22-alpine AS build
WORKDIR /app

ARG VITE_NODE_API_URL
ARG VITE_PYTHON_API_URL
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_NODE_API_URL=$VITE_NODE_API_URL
ENV VITE_PYTHON_API_URL=$VITE_PYTHON_API_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
