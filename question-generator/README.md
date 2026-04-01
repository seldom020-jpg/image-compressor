# AI 题库生成器

从 Word/PDF/Excel 文档自动生成考试题目的 AI 工具。

## 功能特点

- ✅ 支持多种文件格式：PDF, Word(.doc/.docx), Excel(.xls/.xlsx), CSV, TXT
- ✅ 支持多种题型：单选题、多选题、判断题、简答题
- ✅ 支持难度选择：简单、中等、困难
- ✅ 可配置题目数量 5-50 题
- ✅ 支持导出 JSON 和 TXT 格式
- ✅ 支持 OpenAI、通义千问等多种 AI 提供商
- ✅ 前后端分离架构，易于部署

## 快速开始

### 1. 安装依赖

```bash
cd backend
npm install
```

### 2. 配置 AI

复制环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的 API Key：

```env
# 使用 OpenAI
AI_PROVIDER=openai
AI_API_KEY=sk-xxx
AI_MODEL=gpt-3.5-turbo

# 或者使用通义千问（阿里云）
# AI_PROVIDER=tongyi
# AI_API_KEY=your-dashscope-api-key
# AI_MODEL=qwen-turbo
```

### 3. 启动服务

```bash
npm start
```

### 4. 访问

打开浏览器访问 `http://localhost:3000` 即可使用。

## API 接口

### POST /api/upload

上传文件并生成题目

参数（FormData）：
- `file`: 文件
- `questionType`: 题型 (single|multiple|judgment|essay)
- `count`: 题目数量
- `difficulty`: 难度 (easy|medium|hard)

返回：
```json
{
  "success": true,
  "textLength": 1234,
  "questions": [...]
}
```

## 部署

### 本地开发

```bash
cd backend
npm run dev  # 开发模式（nodemon 自动重启）
```

### 服务器部署

可以用 PM2 守护进程：

```bash
npm install -g pm2
pm2 pm2 start server.js --name question-generator
```

## 项目结构

```
question-generator/
├── backend/
│   ├── server.js          # Express 主服务
│   ├── package.json
│   ├── .env.example       # 环境变量示例
│   └── utils/
│       ├── fileParser.js  # 文件解析
│       └── aiGenerator.js # AI 生成题目
└── frontend/
    ├── index.html
    ├── style.css
    └── app.js
```

## 说明

- 单个文件最大 10MB
- 文本内容默认截断到 12000 tokens（避免超出 AI 上下文限制）
- 上传的临时文件会自动清理

## 许可证

MIT
