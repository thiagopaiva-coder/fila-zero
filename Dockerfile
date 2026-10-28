FROM node:20-alpine
WORKDIR /app
COPY server ./server
COPY public ./public
ENV PORT=8080 DATA_DIR=/app/data
VOLUME ["/app/data"]
EXPOSE 8080
CMD ["node", "server/index.js"]
