# Dockerfile
FROM golang:1.21-alpine AS builder
WORKDIR /app

# 1) Copy only go.mod so Go knows the module name
COPY go.mod ./

# 2) Copy all your source (main.go & crawler.go) so imports are visible
COPY . .

# 3) Pull dependencies and create go.sum in‑image
RUN go mod tidy

# 4) Build your binary
RUN go build -o server .

# ---- final image ----
FROM alpine:3.18
WORKDIR /app
COPY --from=builder /app/server .

EXPOSE 8080
CMD ["./server"]
