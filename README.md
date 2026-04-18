# JSON Tool - 强大的 JSON 与 XSLT 处理工具

一个高效、现代且功能丰富的在线 JSON 处理工具。支持 JSON 格式化、压缩、校验、转义以及强大的 XSLT 2.0/3.0 转换功能。

## ✨ 功能特性

- **🚀 核心功能**: JSON 格式化（自定义缩进）、极致压缩、语法校验。
- **📑 多标签系统**: 支持同时打开多个任务标签，互不干扰。
- **💾 自动保存**: 实时将输入内容和功能状态保存至浏览器 `localStorage`，防止数据丢失。
- **🛠 XSLT 转换**:
  - 支持 **XSLT 1.0** (浏览器原生) 以及 **XSLT 2.0/3.0** (后端 SaxonJS 编译)。
  - 针对 XSLT 3.0 优化，支持 `parse-json(JSON)` 标准语法。
  - 独立的 XSLT 数据源与模板编辑区，支持局部清空与全盘重置。
- **🌓 现代 UI**: 深度暗色模式，极客风格界面。
- **📋 复制增强**: 兼容非 HTTPS 环境的剪贴板操作。

## 🛠️ 技术栈

- **前端**: 原生 HTML5, CSS3 (CSS Variables), Vanilla JavaScript.
- **后端**: Node.js, Express (用于 XSLT 2.0/3.0 编译服务)。
- **核心库**: SaxonJS (XSLT 编译)。

## 🚀 快速开始

### 本地运行
1. 克隆仓库: `git clone <your-repo-url>`
2. 安装依赖: `npm install`
3. 启动服务: `npm start`
4. 访问: `http://localhost:3000`

### 部署
项目支持一键部署至阿里云等云服务器，推荐使用 `PM2` 进行进程管理。

## 📄 开源协议
[MIT License](LICENSE)
