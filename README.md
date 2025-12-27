# a.zhai's ToolBox

## 部署到服务器并通过外网访问

下面的步骤可以在一台全新服务器上启动应用，使其通过公网 IP 与端口访问。

### 1. 准备运行环境
- 安装 Python 3.9+。
- 克隆代码后进入项目目录：`cd nano_banana`。
- 创建虚拟环境并安装依赖：
  ```bash
  python -m venv .venv
  source .venv/bin/activate
  pip install -r requirements.txt
  ```

### 2. 配置环境变量
在启动前配置以下变量（可写入 `.env` 或直接导出）：

- `APP_SECRET_KEY`：Flask 会话密钥，必填，使用随机字符串。
- `APP_USERNAME` / `APP_PASSWORD`: Optional seed account used to initialize local data.
- `NANO_BANANA_API_KEY`：调用上游 API 的密钥。
- 可选：`PORT` 设置监听端口（默认 `5000`），`DATA_DIR` 设置数据存储目录，`DB_PATH` 指定 SQLite 文件路径（默认 `data/app.db`）。

### 3. 启动服务
开发模式可直接运行（监听所有网卡，便于外网访问）：
```bash
python app.py
```
或使用 Gunicorn 作为生产服务：
```bash
gunicorn -w 4 -b 0.0.0.0:${PORT:-5000} app:app
```

### 4. 开放端口并访问
- 确认服务器安全组/防火墙允许外网访问所选端口（例如 5000）。
- 浏览器访问 `http://<你的公网IP>:<端口>` 即可打开应用主页。

### 5. 常见问题
- **无法访问**：检查服务器防火墙规则，或确认应用是否在监听 `0.0.0.0`。
- **API Key 缺失**: 在页面的 “Api key 管理” 添加，或在环境变量中设置 `NANO_BANANA_API_KEY`。

### 数据存储
- 账号、密码哈希、API Key 以及每个账号的用量统计都会保存在 SQLite 数据库（默认 `data/app.db`）中。
- `APP_USERNAME` / `APP_PASSWORD`: Optional seed account used to initialize local data.
- 数据目录可通过 `DATA_DIR` 或 `DB_PATH` 自定义，确保进程有写入权限。

## 界面布局概览
- 左侧固定导航：深色侧边栏包含品牌区与按钮式功能切换（图像生成、Api key 管理、大模型对话），并在同一侧展示当前接口地址、已选 Api key 掩码以及累计调用次数/最近使用时间。
- 右侧工作台：顶部为标题与简介提示，主体区域根据左侧选择在三块面板间切换。
- 图像生成：左右两列网格布局，左侧为表单（提示词、模型、画幅比例、分辨率、参考图上传、Webhook 设置及进度回复开关），右侧为进度面板和结果画廊。
- Api key 管理：展示添加新 key 的表单及 key 列表，列表可切换或删除，当前使用的 key 会高亮展示并同步到侧边栏信息。
- 大模型对话：提供模型选择、System Prompt、流式开关，以及对话输入和日志区域。