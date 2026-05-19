# LeeQ AI Search

基于 AI 的智能搜索引擎，支持多引擎并发搜索、LLM 流式回答、RAG 增强检索、文档分析、技能执行等功能。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3 + TypeScript + Vite + Vue Router |
| UI 组件 | VXE Table + VXE PC UI |
| Markdown | markdown-it + Mermaid 图表 |
| 后端 | Express + TypeScript (Node.js) |
| 数据库 | PostgreSQL 15 |
| 认证 | JWT + BCrypt |
| 容器化 | Docker + Docker Compose |
| CI/CD | GitHub Actions (自动构建并推送 Docker 镜像到 GHCR) |
| LLM 支持 | OpenAI / DeepSeek / 通义千问 / 智谱AI / Ollama 等 20+ 供应商 |

## 项目结构

```
LeeQ/
├── client/                      # 前端 (Vue 3)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── search/          # 前台搜索页面（首页、搜索结果、内容详情、AI对话）
│   │   │   └── admin/           # 后台管理页面（仪表盘、任务、日志、用户、模型等）
│   │   ├── components/          # 通用组件（布局、分页、搜索栏、弹窗等）
│   │   ├── router/              # Vue Router 路由配置
│   │   ├── utils/               # 工具函数（API 请求封装、SSE 流式连接）
│   │   └── assets/              # 静态资源与样式
│   ├── vite.config.ts           # Vite 构建配置（构建输出到 ../server/public）
│   └── package.json
├── server/                      # 后端 (Express + TypeScript)
│   ├── src/
│   │   ├── routes/              # API 路由（前台搜索、后台管理、用户、技能、文档）
│   │   ├── services/            # 业务逻辑层（搜索、LLM、抓取、备份、质量等）
│   │   ├── config/              # 配置文件（数据库连接、供应商配置、数据库初始化）
│   │   ├── middleware/          # 中间件（JWT 认证）
│   │   ├── utils/               # 工具函数（用量限制）
│   │   ├── app.ts               # Express 应用配置
│   │   └── index.ts             # 服务启动入口
│   └── package.json
├── Dockerfile                   # 多阶段 Docker 构建
├── docker-compose.yml           # Docker Compose 编排（app + PostgreSQL）
├── docker-entrypoint.sh         # 容器启动脚本（等待DB → 初始化表 → 启动服务）
├── .github/workflows/           # GitHub Actions CI/CD
│   └── docker-build.yml         # 自动构建并推送 Docker 镜像到 GHCR
└── package.json                 # 根配置（构建脚本）
```

## 功能模块

### 前台搜索
- **多引擎并发搜索** — 支持 Google、百度、Bing、搜狗、360、Yandex 六大搜索引擎，并发获取结果并去重合并
- **AI 流式回答** — 基于 LLM 的流式回答，支持 RAG 增强检索，自动抓取搜索结果页面作为上下文
- **URL 直接抓取** — 输入 URL 直接抓取页面内容
- **AI 对话** — 多轮对话，支持文件上传与技能上下文注入
- **用户系统** — 注册/登录、个人信息管理、头像上传、自定义技能
- **搜索反馈** — 用户对搜索结果进行评价

### AI 技能
- **技能模板** — 文本摘要、代码审查、周报生成、翻译（中英互译）、自定义 Prompt
- **流式执行** — 技能执行结果通过 SSE 流式返回
- **用户自定义技能** — 用户可创建自己的 Prompt 技能

### 文档分析
- 支持 PDF、DOCX、TXT 文件上传解析
- 基于 LLM 的文档内容分析
- 文件与对话上下文联动

### 后台管理
- **仪表盘** — 搜索统计、趋势图表、热门关键词、服务状态监控
- **任务管理** — 单页抓取/全网爬取任务的创建、查看、重试
- **数据源管理** — 信任域名/屏蔽域名的黑白名单管理
- **搜索日志** — 按关键词、日期范围筛选搜索记录
- **用户反馈** — 查看用户对搜索结果的评价
- **LLM 模型管理** — 20+ 供应商模型配置、模型列表拉取、测速
- **系统配置** — 搜索引擎、AnyCrawl、Elasticsearch、SEO 配置
- **技能模板管理** — 创建/编辑/启禁用技能模板
- **技能执行记录** — 查看历史技能执行结果
- **文档分析记录** — 查看历史文档分析结果
- **用户管理** — 用户列表、状态控制、删除
- **聊天记录** — 按用户/关键词查看对话历史
- **LLM 提示词管理** — 系统提示词在线编辑、缓存刷新
- **数据库备份** — 创建/下载/恢复/删除数据库备份
- **质量面板** — 系统质量审计与问题追踪

### API 端点概览

| 前缀 | 说明 |
|------|------|
| `/api/v1` | 前台搜索 API（搜索、内容、聊天、技能、用户、文档） |
| `/api/admin/v1` | 后台管理 API（需 JWT 认证） |
| `/api/health` | 健康检查 |

## 数据库

PostgreSQL 15，包含 16 张数据表，全部含有中文注释：

`admin_user` · `crawl_task` · `datasource` · `search_log` · `feedback` · `system_config` · `document_analysis` · `llm_prompts` · `skill_template` · `skill_execution` · `users` · `user_skills` · `chat_history` · `conversation_state` · `operation_log` · `uploaded_file`

## 快速开始

### 环境要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node.js | 20+ | 运行时环境 |
| PostgreSQL | 15+ | 数据库 |
| npm | 10+ | 包管理器 |
| Docker | 24+（可选） | 容器化部署 |

---

### 🔧 方式一：本地开发（推荐）

#### 1. 克隆项目

```bash
git clone https://github.com/caidiekeji/LeeQ.git
cd LeeQ
```

#### 2. 安装依赖

```bash
# 安装后端依赖（根目录自动安装 server）
npm install

# 安装前端依赖
cd client && npm install && cd ..
```

#### 3. 配置环境变量

创建 `server/.env` 文件（可选，有默认值）：

```env
# 服务端口配置
PORT=3001                    # 后端服务端口（默认3001）

# 数据库配置
DB_HOST=localhost            # 数据库主机
DB_PORT=5432                 # 数据库端口（PostgreSQL默认5432）
DB_USER=postgres             # 数据库用户名
DB_PASSWORD=postgres         # 数据库密码
DB_NAME=a_search             # 数据库名

# JWT认证配置
JWT_SECRET=your-secret-key   # JWT签名密钥（生产环境必须设置）
JWT_EXPIRES_IN=86400         # JWT过期时间（秒，默认24小时）
```

#### 4. 初始化数据库

```bash
# 确保PostgreSQL服务已启动，然后执行初始化
cd server && npm run db:init
```

#### 5. 启动服务

**启动后端服务（端口 3001）：**
```bash
cd server && npx ts-node src/index.ts
# 或使用 npm 脚本
npm run dev
```

**启动前端开发服务（端口 3000）：**
```bash
cd client && npm run dev
```

#### 6. 访问地址

| 页面 | 地址 | 说明 |
|------|------|------|
| 前台搜索 | `http://localhost:3000` | 用户搜索主页 |
| 后台管理 | `http://localhost:3000/admin/login` | 管理后台登录 |
| 后端API | `http://localhost:3001/api/v1` | 前台API端点 |
| 管理API | `http://localhost:3001/api/admin/v1` | 后台API端点 |
| 健康检查 | `http://localhost:3001/api/health` | 服务状态检查 |

**默认管理员账号：**
- 用户名：`admin`
- 密码：`admin123`

---

### 🐳 方式二：Docker Compose 一键部署

**无需手动安装 Node.js 和 PostgreSQL，一键启动完整环境：**

```bash
# 克隆项目
git clone https://github.com/caidiekeji/LeeQ.git
cd LeeQ

# 启动所有服务（后台运行）
docker compose up -d
```

**服务启动流程：**
1. 启动 PostgreSQL 数据库（端口 5432）
2. 等待数据库就绪
3. 自动初始化数据库表结构和默认数据
4. 启动 AI 搜索引擎后端服务（端口 3001）

**访问地址：**
- 前台搜索：`http://localhost:3000`
- 后台管理：`http://localhost:3000/admin/login`

**停止服务：**
```bash
docker compose down
```

**查看日志：**
```bash
docker compose logs -f
```

---

### 📦 方式三：手动构建 Docker 镜像

```bash
# 构建镜像
docker build -t leeq:latest .

# 运行容器
docker run -d -p 3001:3001 \
  -e DB_HOST=your-db-host \
  -e DB_PORT=5432 \
  -e DB_USER=postgres \
  -e DB_PASSWORD=your-password \
  -e DB_NAME=a_search \
  -e JWT_SECRET=your-secret-key \
  --name leeq \
  leeq:latest
```

---

### 🔗 方式四：使用 GitHub Container Registry 镜像

```bash
# 拉取最新镜像
docker pull ghcr.io/caidiekeji/leeq:latest

# 运行容器
docker run -d -p 3001:3001 \
  -e DB_HOST=your-db-host \
  -e DB_PORT=5432 \
  -e DB_USER=postgres \
  -e DB_PASSWORD=your-password \
  -e DB_NAME=a_search \
  -e JWT_SECRET=your-secret-key \
  ghcr.io/caidiekeji/leeq:latest
```

---

## ⚙️ 端口配置说明

### 默认端口映射

| 服务 | 默认端口 | 配置方式 |
|------|----------|----------|
| 前端开发服务器 | `3000` | 修改 `client/vite.config.ts` 中的 `server.port` |
| 后端 API 服务 | `3001` | 设置环境变量 `PORT` |
| PostgreSQL | `5432` | Docker Compose 中修改 `docker-compose.yml` |

### 修改前端端口

编辑 `client/vite.config.ts`：
```typescript
export default defineConfig({
  server: {
    port: 8080,  // 修改为自定义端口
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
```

### 修改后端端口

**方式一：设置环境变量**
```bash
export PORT=8080  # Linux/Mac
set PORT=8080     # Windows
```

**方式二：在 Docker 中映射端口**
```bash
docker run -p 8080:3001 leeq:latest  # 外部8080端口映射到容器3001
```

---

## 📋 环境变量完整列表

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `PORT` | `3001` | 后端服务端口 |
| `DB_HOST` | `localhost` | 数据库主机 |
| `DB_PORT` | `5432` | 数据库端口 |
| `DB_USER` | `postgres` | 数据库用户名 |
| `DB_PASSWORD` | `postgres` | 数据库密码 |
| `DB_NAME` | `a_search` | 数据库名 |
| `JWT_SECRET` | — | JWT签名密钥（**生产环境必须设置**） |
| `JWT_EXPIRES_IN` | `86400` | JWT过期时间（秒，默认24小时） |

### 生产环境注意事项

1. **必须设置 `JWT_SECRET`**：生成一个安全的随机密钥
   ```bash
   # 生成随机密钥
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **修改默认数据库密码**：避免使用默认密码 `postgres`

3. **关闭开发模式**：设置 `NODE_ENV=production`

---

## 🛠️ 常见问题

### Q: 端口被占用怎么办？

**前端端口冲突（3000）：**
```bash
# 方法1：使用其他端口启动
cd client && npm run dev -- --port 8080

# 方法2：修改 vite.config.ts 中的端口配置
```

**后端端口冲突（3001）：**
```bash
# 设置环境变量后启动
PORT=3002 cd server && npm run dev
```

### Q: 数据库连接失败？

1. 确保 PostgreSQL 服务已启动
2. 检查 `DB_HOST`、`DB_PORT`、`DB_USER`、`DB_PASSWORD` 配置
3. 使用 Docker Compose 时，`DB_HOST` 应为 `db`（容器名）

### Q: Docker 启动后无法访问？

```bash
# 检查容器运行状态
docker compose ps

# 查看服务日志
docker compose logs app

# 检查端口映射
docker port leeq-app
```

## LLM 供应商支持

系统内置 20+ LLM 供应商配置，支持通过后台动态切换：

国外：OpenAI · NVIDIA · Anthropic · Google Gemini · Meta Llama · Mistral · Cohere · Groq · Together AI

国内：DeepSeek · 智谱AI · 通义千问 · Moonshot · 百度文心 · 豆包 · 零一万物 · MiniMax · 讯飞星火

本地：Ollama

通用：自定义 OpenAI 兼容接口

## 许可证

Private — All rights reserved.