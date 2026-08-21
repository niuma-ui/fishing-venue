const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;
const ACCESS_KEY = process.env.ACCESS_KEY || 'fishing-gate-2026-x7k9m2';

// 访问密钥防护：无密钥的 API 请求返回 404
const blockedIPs = new Map();
app.use('/api/', (req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  // 清理过期封禁
  for (const [k, v] of blockedIPs) { if (v.expire < now) blockedIPs.delete(k); }
  if (blockedIPs.has(ip)) return res.status(404).send('Not Found');
  const key = req.headers['x-access-key'];
  if (key !== ACCESS_KEY) {
    const rec = blockedIPs.get(ip) || { count: 0, expire: 0 };
    rec.count++;
    if (rec.count >= 15) { rec.expire = now + 3600000; blockedIPs.set(ip, rec); return res.status(404).send('Not Found'); }
    blockedIPs.set(ip, rec);
    return res.status(404).send('Not Found');
  }
  next();
});

// ========== 安全防护中间件 ==========

// Helmet: 设置安全 HTTP 头
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'data:'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS: 限制跨域访问
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

// 全局限流: 每个 IP 每分钟最多 100 次请求
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', globalLimiter);

// 认证接口更严格的限流: 每 IP 每分钟最多 10 次
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: '尝试次数过多，请稍后再试' },
});
app.use('/api/auth/', authLimiter);

// 请求体大小限制
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// 隐藏服务器信息
app.disable('x-powered-by');

// ========== API 路由 ==========
app.use('/api', routes);

// ========== 静态文件 (Web 前端) ==========
app.use(express.static(path.join(__dirname, '..', 'public'), {
  maxAge: '1h',
  etag: true,
}));

// SPA 回退: 所有非 API 路由返回 index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ========== 全局错误处理 ==========
app.use((err, req, res, next) => {
  console.error('[错误]', err.message);
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: '请求体过大' });
  }
  res.status(500).json({ error: '服务器内部错误' });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`\n  休闲生态农场养殖 - 钓场预约系统`);
  console.log(`  服务器已启动: http://localhost:${PORT}`);
  console.log(`  管理后台: http://localhost:${PORT}/#/admin`);
  console.log(`  默认管理员: admin / admin123 (请及时修改密码)\n`);
});
