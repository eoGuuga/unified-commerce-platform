FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001 -G appgroup
COPY package*.json ./
COPY node_modules ./node_modules
COPY dist ./dist
USER appuser
EXPOSE 3001
CMD ["node", "dist/main.js"]
