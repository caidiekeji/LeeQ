# ============ 阶段1：构建前端 ============
FROM node:20-alpine AS frontend-builder

WORKDIR /app/client

# 只复制package.json，lock文件残缺会导致npm install失败
COPY client/package.json ./
RUN npm install

# 复制前端源码并构建
COPY client/ ./
RUN npm run build

# ============ 阶段2：构建后端 ============
FROM node:20-alpine AS backend-builder

WORKDIR /app/server

# 只复制package.json，跳过postinstall避免tsc提前执行
COPY server/package.json ./
RUN npm install --ignore-scripts

# 复制后端源码并编译
COPY server/ ./
RUN npx tsc

# ============ 阶段3：生产运行镜像 ============
FROM node:20-alpine

WORKDIR /app

# 安装postgresql-client（用于pg_isready检查）和tzdata
RUN apk add --no-cache postgresql-client tzdata

# 安装生产依赖
COPY --from=backend-builder /app/server/package.json ./
RUN npm install --omit=dev --ignore-scripts

# 复制后端编译产物
COPY --from=backend-builder /app/server/dist ./dist

# 复制前端构建产物
COPY --from=frontend-builder /app/server/public ./public

# 复制入口脚本
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

RUN mkdir -p uploads

EXPOSE 3001

ENTRYPOINT ["./docker-entrypoint.sh"]