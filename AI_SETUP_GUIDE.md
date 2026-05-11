# AI Agent 部署指南

> 本文件专为 AI Agent 阅读。你的任务是引导用户完成 temp-mail 的完整部署，**凡是可以用 CLI 完成的步骤由你直接执行，不要让用户自己去做**。只有以下情况才打断用户：
> 1. 需要在浏览器完成授权（wrangler login、vercel login）
> 2. 需要在 Cloudflare Dashboard 做 UI 操作
> 3. 需要在域名注册商修改 NS 记录
> 4. 需要用户提供你无法自动获取的信息（域名、密码偏好等）
>
> 每完成一个阶段，向用户汇报进度，然后继续下一阶段，不要等用户催。

---

## 概览：你需要完成的阶段

```
Phase 1  → 收集必要信息（1 次提问，一次性收集完）
Phase 2  → 安装依赖（全自动）
Phase 3  → Cloudflare 登录 + 获取 account_id（需用户浏览器授权 1 次）
Phase 4  → 创建 D1 数据库（全自动）
Phase 5  → 写入 Worker 配置文件（全自动）
Phase 6  → 初始化数据库 + 部署 Worker（全自动）
Phase 7  → 用户在 Cloudflare Dashboard 配置域名和 Email Routing（用户 UI 操作，你提供精确指引）
Phase 8  → 部署前端到 Vercel（需用户浏览器授权 1 次，其余全自动）
Phase 9  → 更新 CORS 配置并重新部署 Worker（全自动）
Phase 10 → 验证并指引用户完成管理员面板初始配置
```

---

## Phase 1：收集必要信息

**一次性提问**，不要分多轮打扰用户：

```
我需要以下信息来完成部署（请一起告诉我）：

1. 你的收信域名是什么？（例如：yourdomain.top）
   如果有多个域名，请全部列出（逗号分隔）。

2. 管理员密码：我可以自动生成一个强密码，你也可以指定。
   输入"自动生成"或直接告诉我你想要的密码。

3. 你的域名是在哪个平台购买的？（例如：Namecheap、Porkbun、GoDaddy）
   这样我可以给你更精确的 NS 修改指引。
```

收到回答后：
- 如果用户选择自动生成密码，生成一个 16 位包含大小写字母、数字、符号的密码，并**在屏幕上明确展示给用户，要求他保存好**。
- 将域名列表和密码保存到变量中，供后续步骤使用。

---

## Phase 2：安装依赖

在项目根目录和 `worker/` 目录分别安装依赖：

```bash
# 在项目根目录
npm install

# 在 worker 目录
cd worker && npm install && cd ..
```

如果 `wrangler` 命令不存在，运行：
```bash
npm install -g wrangler
```

完成后告诉用户："✅ 依赖安装完成，开始连接 Cloudflare 账号。"

---

## Phase 3：Cloudflare 登录 + 获取 account_id

### 3.1 登录

```bash
cd worker && npx wrangler login
```

**此时打断用户**：

```
🌐 我已触发 Cloudflare 登录，浏览器应该会自动打开授权页面。
请在浏览器中完成登录授权，完成后回到这里告诉我"完成了"。
```

等用户确认后继续。

### 3.2 获取 account_id

```bash
npx wrangler whoami
```

解析输出，找到 `Account ID` 字段（格式为 32 位十六进制字符串）。将其存入变量 `$ACCOUNT_ID`。

示例输出：
```
👋 You are logged in with an OAuth Token, associated with the email user@example.com!
┌─────────────────────────────────┬──────────────────────────────────┐
│ Account Name                    │ Account ID                       │
├─────────────────────────────────┼──────────────────────────────────┤
│ user@example.com                │ abcdef1234567890abcdef1234567890 │  ← 取这个
└─────────────────────────────────┴──────────────────────────────────┘
```

告诉用户："✅ 已获取你的 Cloudflare Account ID。"

---

## Phase 4：创建 D1 数据库

```bash
cd worker && npm run db:create
```

解析输出，找到 `uuid` 字段，存入变量 `$DATABASE_ID`。

示例输出：
```json
{
  "uuid": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "name": "temp-mail-db"
}
```

如果数据库已存在（命令报错说 `already exists`），运行：
```bash
npx wrangler d1 list
```
找到 `temp-mail-db` 对应的 ID。

告诉用户："✅ D1 数据库已创建。"

---

## Phase 5：写入 Worker 配置文件

修改 `worker/wrangler.toml`，用以下值替换对应字段：

| 字段 | 值 |
|------|----|
| `account_id` | `$ACCOUNT_ID`（Phase 3 获取）|
| `database_id`（在 `[[d1_databases]]` 下）| `$DATABASE_ID`（Phase 4 获取）|
| `ADMIN_PASSWORD` | 用户提供或自动生成的密码 |
| `ALLOWED_ORIGINS` | `"http://localhost:3000"`（占位符，Phase 9 会更新）|

修改后的文件应如下（以实际值为例）：

```toml
name = "temp-mail-worker"
main = "src/index.ts"
compatibility_date = "2024-12-01"
workers_dev = true
account_id = "abcdef1234567890abcdef1234567890"

[[d1_databases]]
binding = "DB"
database_name = "temp-mail-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

[triggers]
crons = ["0 3 * * *"]

[vars]
ALLOWED_ORIGINS = "http://localhost:3000"
ADMIN_PASSWORD = "用户的密码"
```

告诉用户："✅ Worker 配置文件已更新。"

---

## Phase 6：初始化数据库并部署 Worker

```bash
cd worker

# 初始化表结构
npm run db:init

# 部署 Worker
npm run deploy
```

解析 `npm run deploy` 的输出，找到 Worker URL，格式为：
```
https://temp-mail-worker.{账号名}.workers.dev
```

将其存入变量 `$WORKER_URL`。

告诉用户：
```
✅ Worker 已部署成功！
Worker 地址：$WORKER_URL

接下来需要你在 Cloudflare Dashboard 做几个配置，我会给你详细步骤。
```

---

## Phase 7：引导用户完成 Cloudflare Dashboard 配置

**这个阶段需要用户操作浏览器**，给出精确的分步指引，并在每个子步骤后确认用户是否完成。

### 7.1 将域名添加到 Cloudflare

```
请打开 https://dash.cloudflare.com，然后按以下步骤操作：

1. 点击右上角 "Add a site"（或 "Add a domain"）
2. 输入你的域名：[用户的域名]
3. 选择 "Free" 套餐，点击 Continue
4. Cloudflare 会自动扫描现有 DNS 记录，直接点击 Continue 跳过
5. 页面会显示两个 Nameserver 地址，类似：
     - ara.ns.cloudflare.com
     - bob.ns.cloudflare.com
   请将这两个地址告诉我（你也需要在下一步去域名注册商修改）。
```

等用户提供 Nameserver 地址。

### 7.2 在域名注册商修改 NS 记录

根据用户在 Phase 1 提供的域名平台，给出对应指引：

**Namecheap：**
```
1. 登录 namecheap.com → Domain List → 点击你域名的 Manage
2. 找到 NAMESERVERS，在下拉菜单选择 "Custom DNS"
3. 填入 Cloudflare 提供的两个 NS 地址
4. 点击保存（绿色对勾）
```

**Porkbun：**
```
1. 登录 porkbun.com → 点击域名右侧的 "Details"
2. 找到 "Nameservers" 部分，点击 "Edit"
3. 删除现有 NS，填入 Cloudflare 的两个 NS 地址
4. 保存
```

**GoDaddy：**
```
1. 登录 godaddy.com → My Products → 点击域名旁的 DNS
2. 找到 Nameservers，点击 "Change"
3. 选择 "Enter my own nameservers (advanced)"
4. 填入 Cloudflare 的两个 NS 地址，保存
```

**其他平台：** 告诉用户"找到域名的 DNS 或 Nameserver 设置，将 NS 改为 Cloudflare 提供的两个地址"。

修改后告诉用户：
```
NS 记录通常需要 10 分钟到几小时生效（最长 48 小时）。
我可以帮你检测是否已生效。请告诉我你修改完了，然后我来检测。
```

用户确认后，运行以下命令检测 NS 是否已切换到 Cloudflare：
```bash
dig NS 用户的域名 +short
```

如果输出包含 `cloudflare.com`，继续。否则告诉用户等待并稍后再运行检测，你会帮他每隔一段时间检查。

### 7.3 开启 Email Routing

```
NS 已切换生效！现在请在 Cloudflare Dashboard 开启邮件接收：

1. 回到 https://dash.cloudflare.com，点击你的域名
2. 在左侧菜单点击 "Email" → "Email Routing"
3. 点击 "Get started" 或 "Enable Email Routing"
4. 按提示操作（Cloudflare 会自动添加所需的 MX 和 TXT 记录）
5. 状态变为 "Email Routing is enabled" 后，告诉我已完成
```

等用户确认。

### 7.4 设置 Catch-all 规则

```
最后一个 Cloudflare 配置：

仍在 Email Routing 页面，找到 "Routing rules" 部分：

1. 找到 "Catch-all address" 那一行（在列表底部）
2. 点击右侧的编辑按钮（铅笔图标）
3. 将 Action 改为 "Send to a Worker"
4. 在 Worker 下拉框中选择 "temp-mail-worker"
5. 点击 Save

完成后告诉我。
```

等用户确认。

告诉用户："✅ Cloudflare 配置全部完成！现在部署前端网站。"

---

## Phase 8：部署前端到 Vercel

### 8.1 更新前端环境变量

修改项目根目录的 `.env.local` 文件：

```env
NEXT_PUBLIC_WORKER_URL=<$WORKER_URL>
```

将 `<$WORKER_URL>` 替换为 Phase 6 获取的实际 Worker URL。

### 8.2 Vercel 登录

```bash
npx vercel login
```

**打断用户：**
```
🌐 请在浏览器中完成 Vercel 登录授权（通常选择 GitHub 登录），完成后告诉我。
```

等用户确认。

### 8.3 部署到 Vercel

```bash
npx vercel --yes \
  -e NEXT_PUBLIC_WORKER_URL="$WORKER_URL"
```

解析输出，找到部署后的 URL（格式为 `https://temp-mail-xxx.vercel.app`），存入变量 `$VERCEL_URL`。

如果 Vercel 提示需要关联 GitHub 仓库，告诉用户按提示操作（选择自己的 GitHub 账号），然后再重新运行上面的命令。

### 8.4 设置生产环境变量

```bash
npx vercel env add NEXT_PUBLIC_WORKER_URL production <<< "$WORKER_URL"
npx vercel --prod --yes
```

解析最终的生产 URL，更新 `$VERCEL_URL`。

告诉用户："✅ 前端已部署：$VERCEL_URL"

---

## Phase 9：更新 CORS 配置并重新部署 Worker

修改 `worker/wrangler.toml`，将 `ALLOWED_ORIGINS` 更新为包含 Vercel 地址：

```toml
ALLOWED_ORIGINS = "$VERCEL_URL,http://localhost:3000"
```

重新部署 Worker：

```bash
cd worker && npm run deploy
```

告诉用户："✅ CORS 配置已更新，前后端已完全连通。"

---

## Phase 10：引导用户完成管理员面板配置

```
🎉 所有自动化步骤已完成！最后需要你在管理员面板做一次初始配置：

1. 访问：$VERCEL_URL/admin
2. 输入管理员密码：[你之前设置的密码]
3. 登录后，在"域名列表"中添加你的收信域名：[用户的域名]
4. 点击"保存配置"
5. 回到首页（$VERCEL_URL），随机生成一个临时邮箱
6. 用该地址去注册任意网站，测试是否能收到邮件

可选配置（在管理员面板中完成）：
- 修改站点名称
- 设置站点访问密码（防止陌生人使用）
- 调整邮件自动删除周期（默认 24 小时）
- 配置转发规则（指定子域名的邮件自动转发到你的 Gmail）

完成后告诉我测试结果，如果收不到邮件我来帮你排查。
```

---

## 验证排查

如果用户反馈收不到邮件，按以下顺序检查：

### 检查 1：Worker API 是否正常

```bash
curl "$WORKER_URL/api/config"
```

预期：返回包含 `domains`、`siteName` 等字段的 JSON。
如果报错：Worker 部署有问题，重新运行 `cd worker && npm run deploy`。

### 检查 2：域名是否已添加到配置

```bash
curl "$WORKER_URL/api/config" | grep -o '"domains":\[[^]]*\]'
```

如果 `domains` 是空数组 `[]`，说明用户忘记在管理员面板添加域名。

### 检查 3：Email Routing 是否生效

```bash
dig MX 用户的域名 +short
```

预期输出应包含 `mx1.cloudflare.net` 或 `mx2.cloudflare.net`。
如果没有，Email Routing 未成功开启。

### 检查 4：CORS 是否配置正确

```bash
curl -H "Origin: $VERCEL_URL" -I "$WORKER_URL/api/config"
```

检查响应头中 `Access-Control-Allow-Origin` 是否等于 `$VERCEL_URL`。
如果不匹配，重新检查 `worker/wrangler.toml` 中的 `ALLOWED_ORIGINS` 并重新部署。

---

## 附：各变量速查

| 变量 | 来源 | 示例值 |
|------|------|--------|
| `$ACCOUNT_ID` | Phase 3 `wrangler whoami` | `abcdef1234567890...` |
| `$DATABASE_ID` | Phase 4 `db:create` 输出 | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `$WORKER_URL` | Phase 6 `npm run deploy` 输出 | `https://temp-mail-worker.user.workers.dev` |
| `$VERCEL_URL` | Phase 8 Vercel 部署输出 | `https://temp-mail-xxx.vercel.app` |
| `$DOMAIN` | Phase 1 用户提供 | `yourdomain.top` |
| `$ADMIN_PASSWORD` | Phase 1 用户提供或自动生成 | `Xk9#mP2!qL8@wR4n` |
