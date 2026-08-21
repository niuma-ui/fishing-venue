# 部署指南（最安全方案）

## 为什么不用本地隧道

本地隧道（ngrok/localtunnel）会把你的电脑直接暴露到公网，存在被扫描、攻击、窃取资料的风险。**本项目不使用任何本地隧道。**

## 推荐方案：Render 免费云容器

Render 提供免费的 Docker 容器托管，具备：
- 隔离的容器环境（不碰你的电脑）
- 自动 HTTPS
- DDoS 防护
- 固定域名：`https://你的项目名.onrender.com`
- 无需信用卡

## 部署步骤（全程约 5 分钟）

### 第一步：注册 GitHub（免费）

1. 打开 https://github.com
2. 点 Sign up，用邮箱注册
3. 记住你的用户名

### 第二步：把代码推到 GitHub

在你的电脑上打开命令行（PowerShell），运行：

```powershell
cd D:\我的app\web-app
git init
git add .
git commit -m "钓场预约系统"
git branch -M main
git remote add origin https://github.com/你的用户名/fishing-venue.git
git push -u origin main
```

如果没有 git，先安装：https://git-scm.com/download/win

### 第三步：在 Render 上部署（2 次点击）

1. 打开 https://render.com
2. 点 "Get Started"，用 GitHub 账号登录（授权即可）
3. 点 "New" → "Web Service"
4. 选你刚创建的 `fishing-venue` 仓库
5. 配置：
   - Name: `fishing-venue`（这个就是域名前缀）
   - Runtime: `Docker`
   - 其他保持默认
6. 点 "Create Web Service"
7. 等待 2-3 分钟构建完成

### 第四步：设置安全密钥（重要）

部署完成后，在 Render 项目页面：

1. 点 "Environment" 标签
2. 添加两个环境变量：
   - `JWT_SECRET` = 随便输一串长字符（如 `fishing-2026-x7k9m2p4q8`）
   - `ACCESS_KEY` = 随便输一串字符（如 `gate-key-2026`）
3. 点 "Save Changes"，等待自动重新部署

### 第五步：访问你的网站

部署完成后，Render 会显示你的网址：
```
https://fishing-venue.onrender.com
```

默认管理员账号：`admin` / `admin123`
**登录后立即修改密码！**

## 安全特性

- 容器隔离：应用运行在独立容器中，与你的电脑完全隔离
- HTTPS：Render 自动提供 SSL 证书
- 访问密钥：所有 API 请求需要 X-Access-Key 头，无密钥返回 404
- JWT 认证：用户登录后获得令牌，7 天过期
- bcrypt：密码加盐哈希存储
- 速率限制：全局 100次/分钟，认证接口 10次/分钟
- SQL 注入防护：全部使用参数化查询
- 输入校验：所有用户输入经过 express-validator 校验
- Helmet：安全 HTTP 头，防止 XSS、点击劫持
- 非 root 用户：Docker 容器内以非 root 用户运行

## 数据持久化

Render 免费容器的文件系统在重启后会重置。如需持久化数据：

1. 在 Render 项目页面点 "Disks"
2. 创建一个 1GB 的磁盘，挂载路径设为 `/app/data`
3. 保存后数据库会持久化保存

## 自定义域名（可选）

如果想用自己的域名：

1. 在 Render 项目页面点 "Custom Domains"
2. 添加你的域名
3. 按提示在域名服务商处配置 DNS
4. Render 自动签发 SSL 证书

## 本地开发（不暴露公网）

```bash
cd D:\我的app\web-app
npm install
npm start
```

仅在本地 `http://localhost:3000` 访问，**不会暴露到公网**。
