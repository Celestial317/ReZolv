FROM node:22-slim
WORKDIR /srv
COPY package.json ./
RUN npm install
COPY . .
ARG API_URL=http://server:8000
ENV API_URL=$API_URL
RUN npm run build
CMD ["npm", "start"]
