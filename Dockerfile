# 多阶段构建 - 最小化镜像体积，减少攻击面
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# 运行阶段 - 最小化基础镜像
FROM node:18-alpine

# 安全加固：使用非 root 用户运行
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# 只复制运行所需文件
COPY --from=builder /app/node_modules ./node_modules
COPY server ./server
COPY public ./public
COPY package.json ./

# 创建数据目录并设置权限
RUN mkdir -p /app/data && chown -R appuser:appgroup /app

USER appuser

# 环境变量（部署时覆盖）
ENV NODE_ENV=production
ENV PORT=3000
ENV JWT_SECRET=change-me-in-production
ENV ACCESS_KEY=change-me-in-production

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/venue',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

EXPOSE 3000

CMD ["node", "server/index.js"]
