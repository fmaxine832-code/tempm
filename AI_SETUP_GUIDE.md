# AI Agent 部署指南

> 本文件专为 AI Agent 阅读。你的任务是引导用户完成 temp-mail 的完整部署。
>
> **核心原则：凡是可以通过 CLI 或 API 完成的步骤，由你直接执行，不要让用户自己做。**
>
> 整个流程中，用户只需要手动做 **2 件事**：
> 1. **提供凭据**（一次性，在 Phase 1 收集完）
> 2. **在域名注册商修改 NS 记录**（无法绕过，但你提供精确指引）
>
> 其余所有步骤由你通过 CLI / Cloudflare API / Vercel CLI 自动完成。

---

## 部署流程总览

```
Phase 1  → 一次性收集所有必要信息
Phase 2  → 安装依赖（全自动）
Phase 3  → 通过 API 将域名添加到 Cloudflare，获取 NS 地址（全自动）
Phase 4  → 引导用户在注册商修改 NS 记录（唯一的手动步骤）
Phase 5  → 等待 NS 生效，通过 API 配置 Email Routing（全自动）
Phase 6  → 创建 D1 数据库 + 部署 Worker（全自动）
Phase 7  → 部署前端到 Vercel（全自动，含 vercel login）
Phase 8  → 更新 CORS 配置并重新部署 Worker（全自动）
Phase 9  → 验证并引导完成管理员面板配置
```

---

## Phase 1：一次性收集所有必要信息

**所有信息一次性问完，之后不再打断用户。**

```
我需要以下信息来完成自动部署，请一次性提供：

1. 收信域名：你打算用哪个域名接收邮件？
   （例如：yourdomain.top，如有多个请用逗号分隔）

2. 域名注册商：域名在哪个平台购买的？
   （例如：Namecheap、Porkbun、GoDaddy、Dynadot 等）

3. Cloudflare Global API Key：
   - 打开 https://dash.cloudflare.com/profile/api-tokens
   - 页面下方找到 "Global API Key"，点击 "View"，输入密码后复制
   请把这串 Key 发给我。

4. Cloudflare 账号邮箱：你登录 Cloudflare 用的邮箱地址。

5. 管理员密码：我可以自动生成一个强密码，或你自己指定。
   请输入"自动生成"，或直接告诉我你想要的密码。

6. GitHub Token（用于推送代码触发 Vercel 部署）：
   - 打开 https://github.com/settings/tokens
   - 点击 "Generate new token (classic)"
   - 勾选 repo 权限，生成后复制
   （如果你打算手动连接 Vercel，这项可以跳过）
```

收到回答后：
- 如果用户选择自动生成密码，生成一个 16 位包含大小写字母、数字、符号的密码，**明确展示给用户，要求他保存到安全的地方**。
- 将所有信息存入变量：`$CF_API_KEY`、`$CF_EMAIL`、`$DOMAIN`、`$REGISTRAR`、`$ADMIN_PASSWORD`

---

## Phase 2：安装依赖（全自动）

```bash
# 安装前端依赖
npm install

# 安装 Worker 依赖
cd worker && npm install && cd ..
```

检查 wrangler 是否可用：
```bash
npx wrangler --version
```

如果报错，运行：
```bash
npm install -g wrangler
```

---

## Phase 3：通过 Cloudflare API 添加域名（全自动）

使用 API Key，所有 Cloudflare 操作不需要浏览器登录。

### 3.1 获取 Account ID

```bash
curl -s -X GET "https://api.cloudflare.com/client/v4/accounts" \
  -H "X-Auth-Email: $CF_EMAIL" \
  -H "X-Auth-Key: $CF_API_KEY" \
  -H "Content-Type: application/json"
```

解析响应中的第一个 `id` 字段，存入 `$CF_ACCOUNT_ID`。

### 3.2 检查域名是否已在 Cloudflare

```bash
curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=$DOMAIN" \
  -H "X-Auth-Email: $CF_EMAIL" \
  -H "X-Auth-Key: $CF_API_KEY"
```

- 如果 `result` 数组非空，域名已存在，取其 `id` 存入 `$ZONE_ID`，跳到 3.4。
- 如果为空，执行 3.3 添加域名。

### 3.3 添加域名到 Cloudflare

```bash
curl -s -X POST "https://api.cloudflare.com/client/v4/zones" \
  -H "X-Auth-Email: $CF_EMAIL" \
  -H "X-Auth-Key: $CF_API_KEY" \
  -H "Content-Type: application/json" \
  --data "{
    \"name\": \"$DOMAIN\",
    \"account\": {\"id\": \"$CF_ACCOUNT_ID\"},
    \"jump_start\": false
  }"
```

从响应中提取：
- `result.id` → 存入 `$ZONE_ID`
- `result.name_servers` 数组 → 存入 `$NS1`、`$NS2`（两个 nameserver 地址）

### 3.4 确认 Nameserver 地址

```bash
curl -s "https://api.cloudflare.com/client/v4/zones/$ZONE_ID" \
  -H "X-Auth-Email: $CF_EMAIL" \
  -H "X-Auth-Key: $CF_API_KEY"
```

从响应的 `name_servers` 字段确认两个 NS 地址。

---

## Phase 4：引导用户修改 NS 记录（唯一手动步骤）

根据 `$REGISTRAR` 提供针对性指引：

```
现在只需要你做一件事：去域名注册商把 NS 记录改为 Cloudflare 的地址。

你的域名：$DOMAIN
需要填入的 Nameserver：
  - $NS1
  - $NS2
```

**Namecheap：**
```
1. 登录 namecheap.com → Domain List → 点击域名右侧 Manage
2. 找到 NAMESERVERS，下拉选择 "Custom DNS"
3. 填入上面两个 NS 地址，点击绿色对勾保存
```

**Porkbun：**
```
1. 登录 porkbun.com → 点击域名 → Details
2. 找到 Nameservers，点击 Edit
3. 清空原有内容，填入上面两个 NS 地址，保存
```

**GoDaddy：**
```
1. 登录 godaddy.com → My Products → 域名旁点击 DNS
2. 找到 Nameservers → Change → Enter my own nameservers
3. 填入上面两个 NS 地址，保存
```

**Dynadot：**
```
1. 登录 dynadot.com → Domains → 点击域名
2. DNS Settings → Name Servers → Custom Name Servers
3. 填入上面两个 NS 地址，保存
```

**其他注册商：** 告诉用户找到"DNS 设置"或"Name Servers"，改为自定义 NS，填入上面两个地址。

修改完后告诉我，我来检测 NS 是否已生效，你不需要等待或计时。

---

## Phase 5：等待 NS 生效，配置 Email Routing（全自动）

### 5.1 轮询 NS 生效状态

用户确认已修改 NS 后，每隔 30 秒检查一次：

```bash
dig NS $DOMAIN +short
```

如果输出包含 `cloudflare.com`，说明已生效，继续下一步。

同时通过 Cloudflare API 确认 zone 激活状态：
```bash
curl -s "https://api.cloudflare.com/client/v4/zones/$ZONE_ID" \
  -H "X-Auth-Email: $CF_EMAIL" \
  -H "X-Auth-Key: $CF_API_KEY" \
  | grep -o '"status":"[^"]*"'
```

当 `status` 变为 `active` 时继续。

**向用户汇报进度，不要让用户盯着屏幕等待。** 可以说"我在后台检测，生效后自动继续"。

### 5.2 开启 Email Routing

```bash
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/email/routing/enable" \
  -H "X-Auth-Email: $CF_EMAIL" \
  -H "X-Auth-Key: $CF_API_KEY" \
  -H "Content-Type: application/json"
```

Cloudflare 会自动添加 MX 和 SPF 记录，无需手动操作。

### 5.3 添加 Catch-all 路由规则（发往 Worker）

```bash
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/email/routing/rules" \
  -H "X-Auth-Email: $CF_EMAIL" \
  -H "X-Auth-Key: $CF_API_KEY" \
  -H "Content-Type: application/json" \
  --data '{
    "name": "Catch-all to temp-mail-worker",
    "enabled": true,
    "matchers": [{"type": "all"}],
    "actions": [{"type": "worker", "value": ["temp-mail-worker"]}]
  }'
```

确认响应中 `success` 为 `true`。

---

## Phase 6：创建 D1 数据库并部署 Worker（全自动）

使用 API Key 认证，跳过浏览器登录：

```bash
export CLOUDFLARE_API_KEY="$CF_API_KEY"
export CLOUDFLARE_EMAIL="$CF_EMAIL"
export CLOUDFLARE_ACCOUNT_ID="$CF_ACCOUNT_ID"
```

### 6.1 创建 D1 数据库

```bash
cd worker
npx wrangler d1 create temp-mail-db
```

解析输出找到 `database_id`（UUID 格式），存入 `$DATABASE_ID`。

如果提示数据库已存在：
```bash
npx wrangler d1 list
```
找到 `temp-mail-db` 对应的 ID。

### 6.2 写入 Worker 配置文件

修改 `worker/wrangler.toml`：

```toml
name = "temp-mail-worker"
main = "src/index.ts"
compatibility_date = "2024-12-01"
workers_dev = true
account_id = "$CF_ACCOUNT_ID"

[[d1_databases]]
binding = "DB"
database_name = "temp-mail-db"
database_id = "$DATABASE_ID"

[triggers]
crons = ["0 3 * * *"]

[vars]
ALLOWED_ORIGINS = "http://localhost:3000"
ADMIN_PASSWORD = "$ADMIN_PASSWORD"
```

### 6.3 初始化数据库表结构

```bash
npm run db:init
```

### 6.4 部署 Worker

```bash
npm run deploy
```

解析输出找到 Worker URL（格式：`https://temp-mail-worker.{账号}.workers.dev`），存入 `$WORKER_URL`。

向用户汇报：`✅ Worker 已部署：$WORKER_URL`

---

## Phase 7：部署前端到 Vercel（全自动）

### 7.1 更新前端环境变量

修改项目根目录 `.env.local`：

```env
NEXT_PUBLIC_WORKER_URL=$WORKER_URL
```

### 7.2 安装 Vercel CLI 并登录

```bash
npm install -g vercel
vercel login
```

Vercel login 会打开浏览器，这是整个流程中第二个也是最后一个需要用户操作浏览器的步骤。告诉用户：
```
🌐 请在浏览器中完成 Vercel 登录（推荐选择 GitHub 登录），完成后自动继续。
```

### 7.3 部署到 Vercel

```bash
vercel --yes -e NEXT_PUBLIC_WORKER_URL="$WORKER_URL"
```

如果这是首次部署，vercel 会询问几个问题，按以下方式回答：
- "Set up and deploy?" → Y
- "Which scope?" → 选择你的个人账号
- "Link to existing project?" → N
- "What's your project's name?" → temp-mail（或任意名称）
- "In which directory is your code located?" → ./（回车）

部署完成后解析输出，找到 Preview URL，存入 `$VERCEL_PREVIEW_URL`。

### 7.4 部署到生产环境

```bash
vercel --prod --yes
```

解析输出找到生产 URL，存入 `$VERCEL_URL`。

向用户汇报：`✅ 前端已部署：$VERCEL_URL`

---

## Phase 8：更新 CORS 并重新部署 Worker（全自动）

修改 `worker/wrangler.toml` 中的 `ALLOWED_ORIGINS`：

```toml
ALLOWED_ORIGINS = "$VERCEL_URL,$VERCEL_PREVIEW_URL,http://localhost:3000"
```

重新部署：

```bash
cd worker && npm run deploy
```

---

## Phase 9：验证并完成管理员面板配置

### 9.1 自动验证

运行以下检查，全部通过才算部署成功：

**检查 Worker API：**
```bash
curl -s "$WORKER_URL/api/config" | grep -o '"domains":\[[^]]*\]'
```
预期：返回包含 `domains` 的 JSON。

**检查 CORS：**
```bash
curl -s -H "Origin: $VERCEL_URL" -I "$WORKER_URL/api/config" | grep "Access-Control-Allow-Origin"
```
预期：`Access-Control-Allow-Origin: $VERCEL_URL`

**检查 Email Routing MX 记录：**
```bash
dig MX $DOMAIN +short
```
预期：包含 `cloudflare.net`。

### 9.2 引导用户完成管理员面板配置

所有验证通过后，告诉用户：

```
🎉 部署完成！最后需要你在管理员面板做一次配置（1 分钟内完成）：

1. 访问：$VERCEL_URL/admin
2. 输入管理员密码：$ADMIN_PASSWORD
3. 在"域名列表"中添加：$DOMAIN
4. 点击"保存配置"
5. 回到首页，随机生成一个临时邮箱地址
6. 用该地址注册任意网站测试收信

如果收到邮件，说明一切正常。如果没收到，告诉我，我来排查。
```

---

## 故障排查手册

### 收不到邮件

按顺序检查：

```bash
# 1. Worker API 是否正常
curl "$WORKER_URL/api/config"

# 2. Email Routing MX 记录是否存在
dig MX $DOMAIN +short

# 3. 域名是否已在管理员面板添加
curl "$WORKER_URL/api/config" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('domains'))"

# 4. Email Routing 规则是否存在
curl -s "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/email/routing/rules" \
  -H "X-Auth-Email: $CF_EMAIL" \
  -H "X-Auth-Key: $CF_API_KEY"
```

### CORS 报错

检查 ALLOWED_ORIGINS 是否包含 Vercel URL，然后重新部署 Worker。

### Worker 部署失败

检查 `worker/wrangler.toml` 中的 `account_id` 和 `database_id` 是否正确。

### Email Routing enable 报错 `zone not active`

NS 尚未完全生效，继续等待并轮询 zone 状态。

---

## 变量速查表

| 变量 | 来源 | 用途 |
|------|------|------|
| `$CF_API_KEY` | Phase 1 用户提供 | 所有 Cloudflare API 调用 |
| `$CF_EMAIL` | Phase 1 用户提供 | 所有 Cloudflare API 调用 |
| `$CF_ACCOUNT_ID` | Phase 3.1 API 查询 | wrangler 认证、创建 zone |
| `$ZONE_ID` | Phase 3.2/3.3 API 返回 | Email Routing API |
| `$NS1` / `$NS2` | Phase 3.3/3.4 API 返回 | 告知用户填写到注册商 |
| `$DATABASE_ID` | Phase 6.1 wrangler 输出 | wrangler.toml |
| `$WORKER_URL` | Phase 6.4 wrangler 输出 | .env.local、CORS 配置 |
| `$VERCEL_URL` | Phase 7.4 vercel 输出 | CORS 配置、告知用户 |
| `$DOMAIN` | Phase 1 用户提供 | zone 创建、管理员面板 |
| `$ADMIN_PASSWORD` | Phase 1 用户提供/生成 | wrangler.toml、告知用户 |
