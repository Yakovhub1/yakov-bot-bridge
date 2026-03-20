FROM denoland/deno:alpine-1.31.1
EXPOSE 8080
WORKDIR /app
COPY . .
CMD ["run", "--allow-net", "--allow-env", "server.ts"]
