# ☁️ 云端接码 - 临时邮箱

免费临时邮箱服务，极速接收验证码和登录链接。

- **技术栈**: Next.js + Tailwind CSS + Cloudflare Workers + D1
- **部署**: 前端 Vercel，后端 Cloudflare Workers（全免费）
- **功能**: 随机生成邮箱、实时收信、自动提取验证码和链接、一键复制

---

## 部署步骤

### 前置条件

1. 一个域名（如 `yourdomain.top`）
2. [Cloudflare 账号](https://dash.cloudflare.com/sign-up)（免费）
3. [Vercel 账号](https://vercel.com)（免费）
4. 安装 Node.js 18+

---

### 第一步：配置 Cloudflare

#### 1.1 添加域名到 Cloudflare

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 点击 "Add a site"，输入你的域名
3. 选择 **Free** 计划
4. 按提示修改域名的 NS 记录指向 Cloudflare

#### 1.2 开启 Email Routing

1. 进入域名管理页 → **Email** → **Email Routing**
2. 点击 "Get started"，按提示添加 DNS 记录
3. 在 **Routing rules** 中添加 **Catch-all** 规则：
   - Action: **Send to a Worker**
   - Destination: `temp-mail-worker`（先完成 1.3 部署 Worker 后再设置）

#### 1.3 部署 Cloudflare Worker

```bash
# 进入 worker 目录
cd worker

# 安装依赖
npm install

# 登录 Cloudflare
npx wrangler login

# 创建 D1 数据库
npm run db:create
# 输出会包含 database_id，复制它

# 编辑 wrangler.toml，替换以下值：
# - database_id: 上面创建的 ID
# - ALLOWED_DOMAINS: 你的临时邮箱域名（逗号分隔）
# - ALLOWED_ORIGINS: 你的 Vercel 部署地址
# - FORWARD_RULES: 转发子域名规则（见下方说明）

# 初始化数据库表
npm run db:init

# 部署 Worker
npm run deploy
```

部署成功后会输出 Worker URL，类似：
`https://temp-mail-worker.your-account.workers.dev`

#### 1.4 设置 Email Routing Catch-all

回到 Cloudflare Dashboard → Email → Email Routing → Routing rules：
- 编辑 Catch-all 规则
- Action: **Send to a Worker**
- Worker: 选择 `temp-mail-worker`

> **子域名也需要单独设置 Email Routing**：如果你用了转发子域名（如 `fwd.example.com`），需要在 Cloudflare 中为该子域名也开启 Email Routing 并设置 Catch-all 指向同一个 Worker。

#### 1.5 （可选）配置子域名邮件转发到 Gmail

你可以指定某个子域名下收到的所有邮件**自动转发到你的 Gmail**，同时也保存到网页端。

编辑 `worker/wrangler.toml` 中的 `FORWARD_RULES`：

```toml
# 格式: "子域名:目标邮箱"，多条规则用逗号分隔
FORWARD_RULES = "fwd.example.com:yourname@gmail.com,fwd.domain2.top:other@gmail.com"
```

**工作流程**：
```
发件人 → xxx@fwd.example.com
              ↓
        Cloudflare Worker
         ↙          ↘
   转发到 Gmail    存入 D1（网页也能看）
```

**Cloudflare 端设置**：
1. 在 DNS 中为子域名 `fwd` 添加 Email Routing 需要的 MX 记录
2. 在 Email Routing → Routing rules 中为 `fwd.example.com` 也设置 Catch-all → Worker
3. 在 Email Routing → Destination addresses 中添加并验证你的 Gmail 地址（Cloudflare 会发一封确认邮件）

---

### 第二步：部署前端到 Vercel

#### 2.1 修改配置

编辑项目根目录的 `.env.local`：

```env
NEXT_PUBLIC_DOMAINS=yourdomain.top
NEXT_PUBLIC_WORKER_URL=https://temp-mail-worker.your-account.workers.dev
```

#### 2.2 部署到 Vercel

1. 将项目推送到 GitHub
2. 登录 [Vercel](https://vercel.com)
3. Import 你的 GitHub 仓库
4. 在 Environment Variables 中添加：
   - `NEXT_PUBLIC_DOMAINS` = `yourdomain.top`
   - `NEXT_PUBLIC_WORKER_URL` = `https://temp-mail-worker.your-account.workers.dev`
5. 点击 Deploy

#### 2.3 （可选）绑定自定义域名

在 Vercel 项目设置 → Domains 中添加你的域名（如 `mail.yourdomain.top`）

---

### 第三步：验证

1. 访问你的 Vercel 站点
2. 复制生成的临时邮箱地址
3. 用该地址去注册某个服务
4. 等待邮件出现，点击展开查看提取的链接和验证码

---

## 本地开发

```bash
# 前端
npm install
npm run dev

# Worker（新终端）
cd worker
npm install
npm run dev
```

本地开发时，前端默认运行在 `http://localhost:3000`，Worker 运行在 `http://localhost:8787`。

修改 `.env.local` 中的 `NEXT_PUBLIC_WORKER_URL` 为 `http://localhost:8787`。

---

## 项目结构

```
temp-mail/
├── src/
│   ├── app/
│   │   ├── layout.tsx      # 页面布局
│   │   ├── page.tsx        # 主页面
│   │   └── globals.css     # 全局样式
│   └── lib/
│       ├── config.ts       # 配置
│       ├── types.ts        # 类型定义
│       └── utils.ts        # 工具函数
├── worker/
│   ├── src/index.ts        # Cloudflare Worker
│   ├── schema.sql          # D1 数据库表结构
│   ├── wrangler.toml       # Worker 配置
│   └── package.json
├── .env.local              # 环境变量（本地）
└── package.json
```
