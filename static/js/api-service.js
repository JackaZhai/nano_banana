/* ============================================
   MATCHBOX - API 服务层
   直接调用第三方AI API，实现完整的业务功能
   ============================================ */

// API 配置
const APIConfig = {
    // API 主机地址（根据用户选择使用海外或国内节点）
    host: localStorage.getItem('apiHost') || 'https://api.grsai.com',

    // 支持的模型列表
    imageModels: [
        { id: 'nano-banana-fast', name: 'Nano Banana Fast', description: '快速生成，适合简单场景' },
        { id: 'nano-banana', name: 'Nano Banana', description: '标准模型，平衡速度和质量' },
        { id: 'nano-banana-pro', name: 'Nano Banana Pro', description: '专业模型，支持高分辨率' },
        { id: 'nano-banana-pro-vt', name: 'Nano Banana Pro VT', description: '专业视觉思考模型' }
    ],

    chatModels: [
        { id: 'nano-banana-pro', name: 'Nano Banana Pro', description: '专业对话模型' },
        { id: 'nano-banana-pro-vt', name: 'Nano Banana Pro VT', description: '专业视觉思考模型' },
        { id: 'nano-banana-fast', name: 'Nano Banana Fast', description: '快速对话模型' },
        { id: 'nano-banana', name: 'Nano Banana', description: '标准对话模型' },
        { id: 'gemini-3-pro', name: 'Gemini 3 Pro', description: 'Google Gemini 3 Pro' },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Google Gemini 2.5 Pro' },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Google Gemini 2.5 Flash' },
        { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', description: '轻量级Gemini模型' }
    ],

    // 图像比例选项
    aspectRatios: [
        { id: 'auto', name: '自动', description: '根据提示词自动选择' },
        { id: '1:1', name: '1:1', description: '正方形' },
        { id: '16:9', name: '16:9', description: '宽屏' },
        { id: '9:16', name: '9:16', description: '竖屏' },
        { id: '4:3', name: '4:3', description: '传统比例' },
        { id: '3:4', name: '3:4', description: '传统竖屏' },
        { id: '3:2', name: '3:2', description: '照片比例' },
        { id: '2:3', name: '2:3', description: '照片竖屏' },
        { id: '5:4', name: '5:4', description: '特殊比例' },
        { id: '4:5', name: '4:5', description: '特殊竖屏' },
        { id: '21:9', name: '21:9', description: '超宽屏' }
    ],

    // 图像尺寸选项
    imageSizes: [
        { id: '1K', name: '1K', description: '标准分辨率' },
        { id: '2K', name: '2K', description: '高清分辨率' },
        { id: '4K', name: '4K', description: '超高清分辨率' }
    ]
};

// API 服务类
class APIService {
    constructor() {
        this.apiKey = localStorage.getItem('apiKey') || null;
        this.apiHost = APIConfig.host;
        this.activeImageModel = localStorage.getItem('activeImageModel') || 'nano-banana';
        this.activeChatModel = localStorage.getItem('activeChatModel') || 'nano-banana-pro';
        this.useStreaming = localStorage.getItem('useStreaming') !== 'false'; // 默认启用流式
    }

    // 设置 API 密钥
    setApiKey(apiKey) {
        this.apiKey = apiKey;
        localStorage.setItem('apiKey', apiKey);
    }

    // 设置 API 主机
    setApiHost(host) {
        this.apiHost = host;
        localStorage.setItem('apiHost', host);
    }

    // 获取请求头
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };

        if (this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        return headers;
    }

    // 通用 API 请求方法
    async makeRequest(endpoint, method = 'POST', body = null) {
        if (!this.apiKey) {
            throw new Error('请先设置 API 密钥');
        }

        const url = `${this.apiHost}${endpoint}`;
        const options = {
            method,
            headers: this.getHeaders()
        };

        if (body && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(url, options);

            if (!response.ok) {
                const errorText = await response.text();
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    errorData = { message: errorText };
                }

                throw new Error(`API 请求失败: ${response.status} - ${errorData.message || errorData.msg || '未知错误'}`);
            }

            // 处理流式响应
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('text/event-stream')) {
                return response; // 返回原始响应供流式处理
            }

            return await response.json();
        } catch (error) {
            console.error('API 请求错误:', error);
            throw error;
        }
    }

    // 测试 API 密钥
    async testApiKey() {
        try {
            // 使用一个简单的聊天请求测试密钥
            const testBody = {
                model: 'nano-banana-fast',
                stream: false,
                messages: [
                    {
                        role: 'user',
                        content: 'Hello'
                    }
                ]
            };

            const response = await this.makeRequest('/v1/chat/completions', 'POST', testBody);
            return {
                success: true,
                message: 'API 密钥测试成功',
                data: response
            };
        } catch (error) {
            return {
                success: false,
                message: `API 密钥测试失败: ${error.message}`
            };
        }
    }

    // 图像生成 - 流式响应
    async generateImageStream(prompt, options = {}) {
        const {
            model = this.activeImageModel,
            aspectRatio = 'auto',
            imageSize = '1K',
            urls = [],
            shutProgress = false
        } = options;

        const body = {
            model,
            prompt,
            aspectRatio,
            imageSize,
            urls,
            shutProgress
        };

        // 设置 webHook 为 -1 以获取任务ID
        body.webHook = '-1';

        try {
            const response = await this.makeRequest('/v1/draw/nano-banana', 'POST', body);

            if (response.code !== 0) {
                throw new Error(response.msg || '图像生成请求失败');
            }

            return {
                taskId: response.data.id,
                message: '图像生成任务已提交',
                data: response
            };
        } catch (error) {
            throw new Error(`图像生成失败: ${error.message}`);
        }
    }

    // 查询图像生成结果
    async getImageResult(taskId) {
        try {
            const response = await this.makeRequest('/v1/draw/result', 'POST', { id: taskId });

            if (response.code !== 0) {
                throw new Error(response.msg || '查询结果失败');
            }

            return {
                success: true,
                data: response.data,
                message: '结果查询成功'
            };
        } catch (error) {
            throw new Error(`结果查询失败: ${error.message}`);
        }
    }

    // 图像生成 - 轮询方式（兼容旧UI）
    async generateImage(prompt, options = {}) {
        const {
            model = this.activeImageModel,
            aspectRatio = 'auto',
            imageSize = '1K',
            urls = [],
            onProgress = null,
            onComplete = null
        } = options;

        try {
            // 1. 提交生成任务
            const submitResult = await this.generateImageStream(prompt, {
                model,
                aspectRatio,
                imageSize,
                urls,
                shutProgress: false
            });

            const taskId = submitResult.taskId;

            if (onProgress) {
                onProgress(10, '任务已提交，等待处理...');
            }

            // 2. 轮询查询结果
            let result = null;
            let attempts = 0;
            const maxAttempts = 60; // 最多尝试60次（5分钟）
            const pollInterval = 5000; // 5秒轮询一次

            while (attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, pollInterval));
                attempts++;

                try {
                    const pollResult = await this.getImageResult(taskId);
                    result = pollResult.data;

                    if (onProgress) {
                        onProgress(result.progress || Math.min(10 + attempts * 2, 90), `处理中... ${result.progress || 0}%`);
                    }

                    // 检查任务状态
                    if (result.status === 'succeeded') {
                        if (onComplete) {
                            onComplete(result);
                        }
                        return {
                            success: true,
                            taskId,
                            result: result,
                            message: '图像生成成功'
                        };
                    } else if (result.status === 'failed') {
                        throw new Error(`图像生成失败: ${result.failure_reason || result.error || '未知错误'}`);
                    }
                    // 如果状态是 'running'，继续轮询
                } catch (pollError) {
                    console.warn(`第 ${attempts} 次轮询失败:`, pollError);
                    // 继续轮询，除非是致命错误
                }
            }

            throw new Error('图像生成超时，请稍后查询结果');
        } catch (error) {
            throw new Error(`图像生成失败: ${error.message}`);
        }
    }

    // 聊天对话 - 非流式
    async chatCompletion(messages, options = {}) {
        const {
            model = this.activeChatModel,
            stream = false,
            temperature = 0.7,
            maxTokens = 2000
        } = options;

        const body = {
            model,
            stream,
            messages,
            temperature,
            max_tokens: maxTokens
        };

        try {
            const response = await this.makeRequest('/v1/chat/completions', 'POST', body);

            if (stream) {
                // 流式响应需要特殊处理
                return response; // 返回原始响应
            }

            return {
                success: true,
                data: response,
                message: '聊天完成'
            };
        } catch (error) {
            throw new Error(`聊天请求失败: ${error.message}`);
        }
    }

    // 聊天对话 - 流式（用于实时显示）
    async chatCompletionStream(messages, options = {}) {
        const streamOptions = {
            ...options,
            stream: true
        };

        try {
            const response = await this.chatCompletion(messages, streamOptions);

            if (!response.body) {
                throw new Error('流式响应不可用');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');

            return {
                reader,
                decoder,
                close: () => reader.cancel()
            };
        } catch (error) {
            throw new Error(`流式聊天失败: ${error.message}`);
        }
    }

    // 处理流式响应数据
    async processStreamResponse(reader, decoder, onChunk, onComplete) {
        try {
            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    if (onComplete) {
                        onComplete();
                    }
                    break;
                }

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.trim() !== '');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);

                        if (data === '[DONE]') {
                            if (onComplete) {
                                onComplete();
                            }
                            return;
                        }

                        try {
                            const parsed = JSON.parse(data);
                            if (onChunk) {
                                onChunk(parsed);
                            }
                        } catch (parseError) {
                            console.warn('解析流式数据失败:', parseError, data);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('处理流式响应失败:', error);
            throw error;
        }
    }

    // 获取用户使用统计（需要后端支持，这里先模拟）
    async getUserStats() {
        // 在实际应用中，这里应该调用后端API获取统计数据
        // 由于我们只有前端，这里返回模拟数据
        return {
            totalImages: parseInt(localStorage.getItem('totalImages') || '0'),
            totalChats: parseInt(localStorage.getItem('totalChats') || '0'),
            apiUsage: parseInt(localStorage.getItem('apiUsage') || '0'),
            lastUsedAt: localStorage.getItem('lastUsedAt') || null
        };
    }

    // 更新使用统计
    updateStats(type = 'image') {
        const now = new Date().toISOString();

        if (type === 'image') {
            const totalImages = parseInt(localStorage.getItem('totalImages') || '0') + 1;
            localStorage.setItem('totalImages', totalImages.toString());
        } else if (type === 'chat') {
            const totalChats = parseInt(localStorage.getItem('totalChats') || '0') + 1;
            localStorage.setItem('totalChats', totalChats.toString());
        }

        const apiUsage = parseInt(localStorage.getItem('apiUsage') || '0') + 1;
        localStorage.setItem('apiUsage', apiUsage.toString());
        localStorage.setItem('lastUsedAt', now);
    }
}

// 创建全局 API 服务实例
const apiService = new APIService();

// 导出到全局
window.APIService = apiService;
window.APIConfig = APIConfig;