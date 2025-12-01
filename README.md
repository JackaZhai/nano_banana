# Nano Banana 绘画体验站

一个使用 Python (Flask) 编写的轻量演示站点，提供精美前端界面，便于调用 nano-banana 绘画接口并轮询结果。

## 快速开始

1. 安装依赖：

   ```bash
   pip install -r requirements.txt
   ```

2. 配置环境变量：

   ```bash
   export NANO_BANANA_API_KEY=<你的 api key>
   # 可选：切换节点
   export NANO_BANANA_HOST=https://grsai.dakka.com.cn
   ```

3. 运行服务：

   ```bash
   python app.py
   ```

打开浏览器访问 `http://localhost:5000`，填写提示词后即可提交任务。默认使用轮询方式（webHook 为空时自动填充为 "-1"），也可填写回调地址。

## 配置说明
- 默认调用 `/v1/draw/nano-banana`，`webHook` 未填写时会置为 `-1`，便于立即获取任务 `id` 并轮询 `/v1/draw/result`。
- 表单支持模型、比例、分辨率、参考图 URL、是否关闭进度等参数。

## 安全提示
请勿在前端暴露 API Key，确保仅在后端的环境变量中配置。若需要部署到公网，请加上访问控制与 HTTPS。
