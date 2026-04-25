# MyCost 操作与部署手册

这份文档记录 MyCost 的日常开发、部署、Preview 测试、Supabase 配置，以及什么时候需要真正的后端服务。忘记流程时优先看这里。

## 当前架构

MyCost 当前是：

- Expo / React Native Web 前端
- Vercel 托管静态 Web/PWA
- Supabase 负责 Auth、Postgres、Row Level Security、云同步
- 浏览器本地使用 SQLite/local storage 做 local-first 数据

核心使用方式：

```text
用户打开 Vercel URL
        ↓
浏览器下载静态 HTML/JS/CSS
        ↓
App 在用户设备本地运行
        ↓
未登录：本地数据
登录后：本地数据合并并同步到 Supabase
```

正式 URL：

```text
https://my-cost-blue.vercel.app
```

iPhone 使用方式：

```text
Safari 打开正式 URL -> Share -> Add to Home Screen
```

这样可以像 App 一样从桌面打开，不需要 Apple Developer Account，也没有 7 天重签问题。

## 本地开发

安装依赖：

```bash
npm install
```

启动 Web 开发服务器：

```bash
npm run web
```

本地开发 URL 通常是：

```text
http://localhost:8081
```

如果端口被占用，Expo 会提示或换端口。

## 本地验证命令

改代码后至少跑：

```bash
npm run typecheck
```

涉及数据、同步、日期、预算、循环支出时跑：

```bash
npm run test:unit
```

准备部署前跑：

```bash
npm run typecheck
npm run test:unit
npm run export:web
```

含义：

- `npm run typecheck`：TypeScript 静态检查，不运行 App，不连数据库。
- `npm run test:unit`：运行单元测试，覆盖预算合并、scope、日期、软删除等纯逻辑。
- `npm run export:web`：生成可部署的 Web 静态文件到 `dist/`。

不要手动修改 `dist/`。每次 build 会重新生成它。

## Supabase 配置

Vercel 需要两个环境变量：

```text
EXPO_PUBLIC_SUPABASE_URL=https://tnwskqqukifffnoxxret.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=你的 anon key 或 publishable key
```

注意：

- `EXPO_PUBLIC_SUPABASE_URL` 必须是项目根 URL。
- 不要带 `/rest/v1/`。
- 不要使用 `service_role` 或 `secret` key。

错误示例：

```text
https://tnwskqqukifffnoxxret.supabase.co/rest/v1/
```

正确示例：

```text
https://tnwskqqukifffnoxxret.supabase.co
```

原因：代码使用 `supabase-js` 的 `createClient(url, key)`。SDK 会自己拼出：

```text
/auth/v1
/rest/v1
/realtime/v1
/storage/v1
/functions/v1
```

如果 env 里已经带 `/rest/v1/`，SDK 会拼出错误地址。

## Supabase Auth URL

在 Supabase：

```text
Authentication -> URL Configuration
```

`Site URL` 填：

```text
https://my-cost-blue.vercel.app
```

`Redirect URLs` 建议包含：

```text
https://my-cost-blue.vercel.app
http://localhost:8081
```

用途：

- `Site URL`：邮件确认、重置密码、默认登录跳转会用它。
- `Redirect URLs`：Supabase 只允许跳回白名单 URL，防止恶意跳转。

## Vercel Build 设置

当前 Vercel 项目设置：

```text
Application Preset: Other
Root Directory: ./
Build Command: npx expo export --platform web
Output Directory: dist
Install Command: npm install
```

这个 Build Command 等价于：

```bash
npm run export:web
```

两种都可以。

Vercel env 选择：

```text
Production and Preview
```

这样正式部署和 Preview 部署都能连接 Supabase。

## 自动部署原理

Vercel 已经连接 GitHub repo：

```text
https://github.com/XY-L-1/myCost
```

当代码 push 到 `main` 后：

```text
git push origin HEAD:main
        ↓
GitHub 收到新 commit
        ↓
GitHub webhook 通知 Vercel
        ↓
Vercel 拉取最新 main
        ↓
npm install
        ↓
npx expo export --platform web
        ↓
发布 dist/ 到 Vercel CDN
        ↓
https://my-cost-blue.vercel.app 更新
```

所以正常代码改动不需要手动点 Redeploy。

## 日常发布流程

小改动可以直接在当前分支提交到 `main`：

```bash
npm run typecheck
npm run test:unit
npm run export:web

git status --short
git add .
git commit -m "Describe the change"
git push origin HEAD:main
```

推送成功后去 Vercel：

```text
Project -> Deployments
```

确认最新 deployment 成功。

## Preview / Staging 流程

Preview 可以理解为测试环境。推荐大改动走 Preview。

规则：

```text
main 分支 -> Production -> 正式 URL
其他分支 -> Preview -> 测试 URL
```

创建测试分支：

```bash
git checkout -b feature/some-change
```

改代码后：

```bash
npm run typecheck
npm run test:unit
npm run export:web

git add .
git commit -m "Test some change"
git push -u origin feature/some-change
```

Vercel 会自动生成 Preview URL。

查看 Preview URL：

```text
Vercel -> myCost -> Deployments
```

找到对应 branch 的 deployment，类型会显示 `Preview`。点进去可以看到 URL。

如果开 Pull Request，GitHub 的 PR 页面通常也会出现 Vercel check：

```text
Vercel - Preview deployment ready
```

点 `Details` 会打开 Preview URL。

注意：当前 Preview 和 Production 使用同一个 Supabase 项目，所以 Preview 测试数据会写入正式数据库。

更严格的 staging 做法：

```text
Production env -> prod Supabase project
Preview env -> staging Supabase project
```

这样 Preview 测试不会污染正式数据。

## 什么时候需要 Redeploy

需要手动点 Redeploy 的情况：

1. 只改了 Vercel 环境变量，没有新 commit。
2. 改了 Build Command、Output Directory、Root Directory、Node version 等 Vercel 设置。
3. 上一次 deployment 失败，想用同一个 commit 再跑一次。
4. GitHub webhook 没触发自动部署。
5. 想用最新环境变量重新 build 旧代码。

不需要手动 Redeploy 的情况：

```text
代码 push 到 main
```

因为 Vercel 会自动部署。

## 为什么改环境变量需要重新部署

MyCost 是静态前端，不是一直运行的后端服务器。

`EXPO_PUBLIC_*` 变量是 build-time env：

```text
Vercel env
        ↓
npx expo export --platform web
        ↓
生成 dist/_expo/static/js/web/index-xxxx.js
        ↓
浏览器下载这个 JS
```

也就是说 Supabase URL/key 会在 build 时写进 JS bundle。

如果第一次 build 填错了：

```text
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co/rest/v1/
```

生成的 JS 会写死错误 URL。

后来在 Vercel Settings 里改对了，如果不 Redeploy，用户下载的仍然是旧 JS。所以环境变量改完必须重新 build/redeploy。

## 什么时候需要一个一直跑的后端

当前 MyCost 不需要你自己维护一个一直跑的后端，因为：

- 用户数据直接通过 Supabase SDK 读写 Supabase。
- 安全边界由 Supabase Auth + RLS 控制。
- Web/PWA 静态文件由 Vercel 托管。

需要一直跑的后端，一般是这种场景：

```text
浏览器/手机 App
        ↓
你的 API Server
        ↓
数据库 / 第三方服务 / 私密逻辑
```

典型后端职责：

- 保存不能暴露给前端的 secret key。
- 调用 Stripe、OpenAI、银行 API、邮件服务等私密接口。
- 做复杂权限判断或审计。
- 跑定时任务、后台队列、报表生成。
- 接收 webhook，例如 Stripe payment succeeded。
- 做 server-side aggregation，避免把敏感数据直接给客户端。

常见形态：

```text
Express / Fastify / NestJS Node server
FastAPI / Django Python server
Go / Rust API server
Supabase Edge Functions
Vercel Serverless Functions
Background worker / queue worker
```

## 后端怎么部署

如果以后需要后端，有几种选择。

### 选择 1：Vercel Serverless Functions

适合：

- 简单 API
- webhook
- 不需要长时间运行的请求

目录通常是：

```text
api/some-endpoint.ts
```

部署方式：

```text
push 到 GitHub -> Vercel 自动部署
```

优点：

- 和当前 Vercel 项目集成最简单。
- 不需要自己维护服务器。

限制：

- 不适合长时间后台任务。
- 不适合常驻 websocket/worker。

### 选择 2：Supabase Edge Functions

适合：

- 和 Supabase 数据强相关的 server-side 逻辑
- 需要使用 service role key 但不能暴露给前端
- 轻量 webhook/API

部署方式通常是：

```bash
supabase functions deploy function-name
```

优点：

- 离 Supabase 近。
- 权限和数据库集成方便。

### 选择 3：独立后端平台

例如：

```text
Render
Railway
Fly.io
AWS ECS/Lambda
Google Cloud Run
```

适合：

- 长时间运行的 API server
- worker/queue
- 更复杂的后端系统

一般流程：

```text
写 API server
        ↓
配置环境变量
        ↓
连接数据库
        ↓
部署到平台
        ↓
前端 env 里配置 API base URL
```

## 当前最推荐的路线

现阶段继续保持：

```text
Vercel static Web/PWA + Supabase
```

原因：

- 成本低。
- 维护少。
- iPhone 可直接 Add to Home Screen。
- local-first 使用体验好。
- RLS 已经保护用户数据。

除非后续要接 Stripe、OpenAI、银行 API、复杂报表、自动邮件或定时后台任务，否则暂时不需要自己部署常驻后端。

## 发布后验证清单

每次生产部署后，至少测：

1. 打开正式 URL：

   ```text
   https://my-cost-blue.vercel.app
   ```

2. 不登录新增 expense。
3. 新增 budget。
4. 新增 recurring expense。
5. 登录。
6. 确认本地数据还在。
7. Supabase 检查：

   ```text
   expenses
   budgets
   recurring_expenses
   categories
   ```

8. 页面顶部没有 `Sync issue`。

如果出现 sync issue，先看错误文本；常见问题通常是：

- Supabase env 填错。
- RLS policy 缺失。
- 表结构没有执行最新 SQL。
- 本地旧缓存导致重复同步。

## 常用命令速查

```bash
# 本地开发
npm run web

# 类型检查
npm run typecheck

# 单元测试
npm run test:unit

# Web/PWA build
npm run export:web

# 提交并推生产
git add .
git commit -m "Describe the change"
git push origin HEAD:main

# 新建 Preview 分支
git checkout -b feature/some-change
git push -u origin feature/some-change
```
