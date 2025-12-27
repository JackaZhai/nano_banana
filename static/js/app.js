/* ============================================
   a.zhai's ToolBox - 主应用脚本
   ============================================ */

// 应用状态管理
const AppState = {
    currentPage: 'dashboard',
    theme: localStorage.getItem('theme') || 'dark',
    apiKey: null,
    isLoading: false,
    notifications: [],
    referenceImages: []
};

// DOM 元素缓存
const DOM = {
    // 侧边栏
    sidebar: document.querySelector('.sidebar'),
    navItems: document.querySelectorAll('.nav-item'),

    // 顶部栏
    pageTitle: document.getElementById('pageTitle'),
    pageSubtitle: document.getElementById('pageSubtitle'),
    searchInput: document.querySelector('.search-input'),
    themeToggle: document.getElementById('themeToggle'),
    notificationsBtn: document.getElementById('notificationsBtn'),

    // 页面容器
    pageSections: document.querySelectorAll('.page-section'),

    // 仪表盘
    totalImages: document.getElementById('totalImages'),
    totalChats: document.getElementById('totalChats'),
    apiUsage: document.getElementById('apiUsage'),
    refreshActivities: document.getElementById('refreshActivities'),
    activitiesList: document.getElementById('activitiesList'),

    // 图像生成
    promptInput: document.getElementById('promptInput'),
    modelSelect: document.getElementById('modelSelect'),
    aspectRatioSelect: document.getElementById('aspectRatioSelect'),
    resolutionSelect: document.getElementById('resolutionSelect'),
    referenceImagesInput: document.getElementById('referenceImagesInput'),
    referenceImagesList: document.getElementById('referenceImagesList'),
    generateBtn: document.getElementById('generateBtn'),
    resetFormBtn: document.getElementById('resetFormBtn'),
    progressBar: document.getElementById('progressBar'),
    progressText: document.getElementById('progressText'),
    downloadBtn: document.getElementById('downloadBtn'),
    clearBtn: document.getElementById('clearBtn'),

    // 聊天
    newChatBtn: document.getElementById('newChatBtn'),
    chatList: document.getElementById('chatList'),
    chatMessages: document.getElementById('chatMessages'),
    chatInput: document.getElementById('chatInput'),
    sendMessageBtn: document.getElementById('sendMessageBtn'),
    exportChatBtn: document.getElementById('exportChatBtn'),
    clearChatBtn: document.getElementById('clearChatBtn'),
    streamToggle: document.getElementById('streamToggle'),

    // API 密钥
    currentKeyStatus: document.getElementById('currentKeyStatus'),
    lastUsedTime: document.getElementById('lastUsedTime'),
    newApiKey: document.getElementById('newApiKey'),
    keyName: document.getElementById('keyName'),
    addKeyBtn: document.getElementById('addKeyBtn'),
    testKeyBtn: document.getElementById('testKeyBtn'),
    refreshKeysBtn: document.getElementById('refreshKeysBtn'),
    keysTableBody: document.getElementById('keysTableBody'),

    // 仪表盘
    creditsBalance: document.getElementById('creditsBalance'),
    apiKeyStatusText: document.getElementById('apiKeyStatus'),
    apiHostDisplay: document.getElementById('apiHostDisplay'),
    refreshModelStatus: document.getElementById('refreshModelStatus'),
    modelStatusList: document.getElementById('modelStatusList'),

    // 设置
    timeoutSelect: document.getElementById('timeoutSelect'),
    retrySelect: document.getElementById('retrySelect')
};

// 页面配置
const PageConfig = {
    dashboard: {
        title: '仪表盘',
        subtitle: "a.zhai's ToolBox 运行状态"
    },
    'image-generation': {
        title: '图像生成',
        subtitle: '使用先进的 AI 模型生成高质量图像'
    },
    chat: {
        title: '智能对话',
        subtitle: '功能正在开发中'
    },
    'api-keys': {
        title: 'API 密钥',
        subtitle: '安全地管理您的 API 密钥'
    },
    settings: {
        title: '系统设置',
        subtitle: '配置应用程序参数和个性化选项'
    }
};

// 初始化应用
function initApp() {
    console.log("初始化 a.zhai's ToolBox 应用...");

    // 设置主题
    setTheme(AppState.theme);

    // 绑定事件
    bindEvents();

    renderReferenceImages();

    // 加载初始数据
    loadInitialData();

    // 显示当前页面
    showPage(AppState.currentPage);

    console.log('应用初始化完成');
}

// 设置主题
function setTheme(theme) {
    AppState.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    // 更新主题切换按钮图标
    if (DOM.themeToggle) {
        const icon = DOM.themeToggle.querySelector('i');
        icon.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
    }
}

// 绑定事件
function bindEvents() {
    // 侧边栏导航
    DOM.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            showPage(page);
        });
    });

    // 主题切换
    if (DOM.themeToggle) {
        DOM.themeToggle.addEventListener('click', () => {
            const newTheme = AppState.theme === 'dark' ? 'light' : 'dark';
            setTheme(newTheme);
        });
    }

    // 搜索框
    if (DOM.searchInput) {
        DOM.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch(DOM.searchInput.value);
            }
        });
    }

    // 仪表盘事件
    if (DOM.refreshActivities) {
        DOM.refreshActivities.addEventListener('click', refreshActivities);
    }

    if (DOM.refreshModelStatus) {
        DOM.refreshModelStatus.addEventListener('click', refreshModelStatuses);
    }

    // 图像生成事件
    if (DOM.generateBtn) {
        DOM.generateBtn.addEventListener('click', generateImage);
    }

    if (DOM.resetFormBtn) {
        DOM.resetFormBtn.addEventListener('click', resetImageForm);
    }

    if (DOM.referenceImagesInput) {
        DOM.referenceImagesInput.addEventListener('change', (e) => {
            handleReferenceImages(e.target.files);
        });
    }

    if (DOM.clearBtn) {
        DOM.clearBtn.addEventListener('click', clearPreview);
    }

    // 聊天事件
    if (DOM.sendMessageBtn) {
        DOM.sendMessageBtn.addEventListener('click', sendMessage);
    }

    if (DOM.chatInput) {
        DOM.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    if (DOM.newChatBtn) {
        DOM.newChatBtn.addEventListener('click', createNewChat);
    }

    if (DOM.clearChatBtn) {
        DOM.clearChatBtn.addEventListener('click', clearChat);
    }

    // API 密钥事件
    if (DOM.addKeyBtn) {
        DOM.addKeyBtn.addEventListener('click', addApiKey);
    }

    if (DOM.testKeyBtn) {
        DOM.testKeyBtn.addEventListener('click', testApiKey);
    }

    if (DOM.refreshKeysBtn) {
        DOM.refreshKeysBtn.addEventListener('click', refreshApiKeys);
    }

    // 设置事件
    if (DOM.timeoutSelect) {
        DOM.timeoutSelect.addEventListener('change', saveSettings);
    }

    if (DOM.retrySelect) {
        DOM.retrySelect.addEventListener('change', saveSettings);
    }

    // API主机选择
    const apiHostSelect = document.getElementById('apiHostSelect');
    if (apiHostSelect) {
        apiHostSelect.addEventListener('change', saveSettings);
    }

    // 流式响应开关
    const streamToggle = document.getElementById('streamToggle');
    if (streamToggle) {
        streamToggle.addEventListener('change', saveSettings);
    }

    // 模型选择
    const imageModelSelect = document.getElementById('imageModelSelect');
    const chatModelSelect = document.getElementById('chatModelSelect');

    if (imageModelSelect) {
        imageModelSelect.addEventListener('change', saveSettings);
    }

    if (chatModelSelect) {
        chatModelSelect.addEventListener('change', saveSettings);
    }

    // 主题选择器
    document.querySelectorAll('[data-theme]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const theme = e.currentTarget.dataset.theme;
            setTheme(theme);
        });
    });

    // 快速操作按钮
    document.querySelectorAll('.quick-action').forEach(action => {
        action.addEventListener('click', (e) => {
            e.preventDefault();
            const target = action.dataset.target;
            if (target) {
                showPage(target);
            }
        });
    });
}

// 显示页面
function showPage(pageId) {
    // 更新当前页面状态
    AppState.currentPage = pageId;

    // 更新导航激活状态
    DOM.navItems.forEach(item => {
        if (item.dataset.page === pageId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // 更新页面标题
    const config = PageConfig[pageId];
    if (config) {
        DOM.pageTitle.textContent = config.title;
        DOM.pageSubtitle.textContent = config.subtitle;
    }

    // 切换页面内容
    DOM.pageSections.forEach(section => {
        if (section.id === `page-${pageId}`) {
            section.classList.add('active');
        } else {
            section.classList.remove('active');
        }
    });

    // 页面特定初始化
    switch (pageId) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'api-keys':
            loadApiKeys();
            break;
        case 'settings':
            loadSettings();
            break;
    }

    // 滚动到顶部
    window.scrollTo(0, 0);
}

// 执行搜索
function performSearch(query) {
    if (!query.trim()) return;

    console.log('搜索:', query);
    // 这里可以添加实际的搜索逻辑
    showNotification(`搜索: ${query}`, 'info');
}

// 加载初始数据
async function loadInitialData() {
    try {
        // 更新API密钥状态
        if (DOM.currentKeyStatus) {
            const hasApiKey = window.APIService && window.APIService.apiKey;
            DOM.currentKeyStatus.textContent = hasApiKey ? '已设置' : '未设置';
            DOM.currentKeyStatus.className = hasApiKey ? 'badge badge-success' : 'badge badge-secondary';
        }

        // 更新仪表盘统计数据
        await updateDashboardStats();

        // 初始化活动记录
        refreshActivities();
    } catch (error) {
        console.error('加载初始数据失败:', error);
    }
}

// 加载仪表盘数据
function loadDashboardData() {
    updateDashboardStats();
}

function getDashboardModels() {
    const models = [];
    if (window.APIConfig && Array.isArray(window.APIConfig.imageModels)) {
        window.APIConfig.imageModels.forEach((model) => {
            models.push({ id: model.id, name: model.name });
        });
    }
    if (window.APIConfig && Array.isArray(window.APIConfig.chatModels)) {
        window.APIConfig.chatModels.forEach((model) => {
            if (!models.find((item) => item.id === model.id)) {
                models.push({ id: model.id, name: model.name });
            }
        });
    }
    return models;
}

async function refreshCreditsBalance() {
    if (!DOM.creditsBalance) return;

    if (!window.APIService || !window.APIService.apiKey) {
        DOM.creditsBalance.textContent = '--';
        return;
    }

    try {
        const result = await window.APIService.getCredits();
        DOM.creditsBalance.textContent = typeof result.credits === 'number' ? result.credits : '--';
    } catch (error) {
        DOM.creditsBalance.textContent = '--';
        console.error('获取积分余额失败:', error);
        showNotification(`积分余额获取失败: ${error.message || '请求失败'}`, 'error');
    }
}

function updateDashboardKeyStatus() {
    if (!DOM.apiKeyStatusText) return;
    const hasKey = window.APIService && window.APIService.apiKey;
    DOM.apiKeyStatusText.textContent = hasKey ? '已设置' : '未设置';
}

function updateDashboardHost() {
    if (!DOM.apiHostDisplay) return;
    if (!window.APIService || !window.APIService.apiHost) {
        DOM.apiHostDisplay.textContent = '--';
        return;
    }

    const host = window.APIService.apiHost;
    const isDomestic = host.includes('dakka.com.cn');
    DOM.apiHostDisplay.textContent = isDomestic ? '国内直连' : '海外节点';
}

async function refreshModelStatuses() {
    if (!DOM.modelStatusList) return;

    const models = getDashboardModels();
    if (models.length === 0) {
        DOM.modelStatusList.innerHTML = '<div class="model-status-empty">暂无模型</div>';
        return;
    }

    DOM.modelStatusList.innerHTML = '<div class="model-status-loading">正在获取模型状态...</div>';

    if (!window.APIService || !window.APIService.apiKey) {
        DOM.modelStatusList.innerHTML = '<div class="model-status-empty">请先设置 API Key</div>';
        return;
    }

    const results = await Promise.all(models.map(async (model) => {
        try {
            const response = await window.APIService.getModelStatus(model.id);
            return {
                model,
                status: !!response.status,
                error: response.error || ''
            };
        } catch (error) {
            return {
                model,
                status: false,
                error: error.message || '获取失败'
            };
        }
    }));

    DOM.modelStatusList.innerHTML = results.map((item) => {
        const badgeClass = item.status ? 'badge-success' : 'badge-error';
        const badgeText = item.status ? '正常' : '异常';
        const errorText = item.error ? `<div class="model-status-error">${escapeHtml(item.error)}</div>` : '';
        return `
            <div class="model-status-item">
                <div class="model-status-info">
                    <div class="model-status-name">${escapeHtml(item.model.name || item.model.id)}</div>
                    <div class="model-status-id">${escapeHtml(item.model.id)}</div>
                    ${errorText}
                </div>
                <span class="badge ${badgeClass}">${badgeText}</span>
            </div>
        `;
    }).join('');
}

// 刷新活动记录
const MAX_REFERENCE_IMAGES = 3;
const MAX_REFERENCE_IMAGE_BYTES = 5 * 1024 * 1024;

function handleReferenceImages(fileList) {
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    const remainingSlots = MAX_REFERENCE_IMAGES - AppState.referenceImages.length;

    if (remainingSlots <= 0) {
        showNotification('Reference image limit reached.', 'warning');
        if (DOM.referenceImagesInput) {
            DOM.referenceImagesInput.value = '';
        }
        return;
    }

    files.slice(0, remainingSlots).forEach((file) => {
        if (!file.type || !file.type.startsWith('image/')) {
            showNotification(`Skipped ${file.name}: not an image.`, 'warning');
            return;
        }
        if (file.size > MAX_REFERENCE_IMAGE_BYTES) {
            showNotification(`Skipped ${file.name}: file too large.`, 'warning');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            AppState.referenceImages.push({
                name: file.name,
                size: file.size,
                dataUrl: reader.result
            });
            renderReferenceImages();
        };
        reader.onerror = () => {
            showNotification(`Failed to read ${file.name}.`, 'error');
        };
        reader.readAsDataURL(file);
    });

    if (DOM.referenceImagesInput) {
        DOM.referenceImagesInput.value = '';
    }
}

function removeReferenceImage(index) {
    AppState.referenceImages.splice(index, 1);
    renderReferenceImages();
}

function renderReferenceImages() {
    if (!DOM.referenceImagesList) return;

    if (AppState.referenceImages.length === 0) {
        DOM.referenceImagesList.innerHTML = '<div class=\"reference-empty\">No reference images</div>';
        return;
    }

    DOM.referenceImagesList.innerHTML = AppState.referenceImages.map((item, index) => `
        <div class=\"reference-item\">
            <img src=\"${item.dataUrl}\" alt=\"Reference ${index + 1}\" class=\"reference-thumb\">
            <div class=\"reference-meta\">
                <div class=\"reference-name\">${escapeHtml(item.name)}</div>
                <div class=\"reference-size\">${formatBytes(item.size)}</div>
            </div>
            <button class=\"reference-remove\" data-index=\"${index}\" type=\"button\">
                <i class=\"fas fa-times\"></i>
            </button>
        </div>
    `).join('');

    DOM.referenceImagesList.querySelectorAll('.reference-remove').forEach((btn) => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index, 10);
            if (!Number.isNaN(idx)) {
                removeReferenceImage(idx);
            }
        });
    });
}

function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = (bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1);
    return `${value} ${units[index]}`;
}

function refreshActivities() {
    if (!DOM.activitiesList) return;

    DOM.activitiesList.innerHTML = `
        <div class="activity-item">
            <div class="activity-icon">
                <i class="fas fa-spinner fa-spin"></i>
            </div>
            <div class="activity-content">
                <div class="activity-title">加载中...</div>
                <div class="activity-description">正在获取最新活动记录</div>
            </div>
        </div>
    `;

    // 从localStorage加载活动记录
    setTimeout(() => {
        const activities = JSON.parse(localStorage.getItem('activities') || '[]');

        if (activities.length === 0) {
            DOM.activitiesList.innerHTML = `
                <div class="activity-item">
                    <div class="activity-icon">
                        <i class="fas fa-circle text-tertiary"></i>
                    </div>
                    <div class="activity-content">
                        <div class="activity-title">暂无活动记录</div>
                        <div class="activity-description">开始一次绘图或对话后会显示在这里</div>
                    </div>
                    <div class="activity-time"></div>
                </div>
            `;
            return;
        }

        // 显示实际的活动记录
        DOM.activitiesList.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon">
                    <i class="fas ${activity.icon}"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-title">${activity.title}</div>
                    <div class="activity-description">${activity.description}</div>
                </div>
                <div class="activity-time">${formatTime(activity.timestamp || activity.time)}</div>
            </div>
        `).join('');
    }, 300);
}

// 添加活动记录
function addActivity(activity) {
    // 获取现有活动记录
    const activities = JSON.parse(localStorage.getItem('activities') || '[]');

    // 添加时间戳
    activity.timestamp = new Date().toISOString();

    // 添加到列表开头
    activities.unshift(activity);

    // 限制最多保存20条记录
    if (activities.length > 20) {
        activities.pop();
    }

    // 保存到localStorage
    localStorage.setItem('activities', JSON.stringify(activities));

    // 如果当前在仪表盘页面，刷新活动列表
    if (AppState.currentPage === 'dashboard' && DOM.activitiesList) {
        refreshActivities();
    }
}

// 更新仪表盘统计数据
async function updateDashboardStats() {
    try {
        updateDashboardKeyStatus();
        updateDashboardHost();
        await refreshCreditsBalance();
        await refreshModelStatuses();
    } catch (error) {
        console.error('更新仪表盘统计失败:', error);
    }
}

// 生成图像
async function generateImage() {
    if (!DOM.promptInput || !DOM.promptInput.value.trim()) {
        ErrorHandler.handleValidationError('提示词', '请输入提示词');
        DOM.promptInput.focus();
        return;
    }

    if (AppState.isLoading) return;

    // 检查API密钥
    if (!window.APIService || !window.APIService.apiKey) {
        ErrorHandler.handleValidationError('API密钥', '请先设置API密钥');
        showPage('api-keys');
        return;
    }

    AppState.isLoading = true;
    DOM.generateBtn.disabled = true;
    DOM.generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 生成中...';

    const prompt = DOM.promptInput.value;
    const model = DOM.modelSelect ? DOM.modelSelect.value : 'nano-banana';
    const aspectRatio = DOM.aspectRatioSelect ? DOM.aspectRatioSelect.value : 'auto';
    const resolution = DOM.resolutionSelect ? DOM.resolutionSelect.value : '1K';

    // 更新进度条
    if (DOM.progressBar) {
        DOM.progressBar.style.width = '10%';
    }
    if (DOM.progressText) {
        DOM.progressText.textContent = '10%';
    }

    try {
        // 使用API服务生成图像
        const result = await window.APIService.generateImage(prompt, {
            model,
            aspectRatio,
            imageSize: resolution,
            urls: AppState.referenceImages.map((item) => item.dataUrl),
            onProgress: (progress, message) => {
                // 更新进度条
                if (DOM.progressBar) {
                    DOM.progressBar.style.width = `${progress}%`;
                }
                if (DOM.progressText) {
                    DOM.progressText.textContent = `${progress}%`;
                }

                // 显示进度消息
                if (message) {
                    console.log('生成进度:', message);
                }
            },
            onComplete: (resultData) => {
                // 处理生成结果
                handleImageGenerationComplete(resultData);
            }
        });

        if (result.success) {
            // 更新使用统计
            window.APIService.updateStats('image');

            // 更新仪表盘数据
            updateDashboardStats();

    ErrorHandler.handleSuccess('图像生成任务已提交，正在处理中...', '图像生成');
        } else {
            throw new Error(result.message || '图像生成失败');
        }
    } catch (error) {
        ErrorHandler.handleApiError(error, '图像生成');

        // 重置UI状态
        AppState.isLoading = false;
        DOM.generateBtn.disabled = false;
        DOM.generateBtn.innerHTML = '<i class="fas fa-magic"></i> 生成图像';

        if (DOM.progressBar) {
            DOM.progressBar.style.width = '0%';
        }
        if (DOM.progressText) {
            DOM.progressText.textContent = '0%';
        }
    }
}

// 处理图像生成完成
function handleImageGenerationComplete(resultData) {
    AppState.isLoading = false;
    DOM.generateBtn.disabled = false;
    DOM.generateBtn.innerHTML = '<i class="fas fa-magic"></i> 生成图像';

    // 更新进度条
    if (DOM.progressBar) {
        DOM.progressBar.style.width = '100%';
    }
    if (DOM.progressText) {
        DOM.progressText.textContent = '100%';
    }

    // 启用下载按钮
    if (DOM.downloadBtn) {
        DOM.downloadBtn.disabled = false;

        // 设置下载链接
        if (resultData.results && resultData.results.length > 0 && resultData.results[0].url) {
            const imageUrl = resultData.results[0].url;
            DOM.downloadBtn.onclick = () => {
                const link = document.createElement('a');
                link.href = imageUrl;
                link.download = `matchbox-image-${Date.now()}.png`;
                link.click();
            };
        }
    }

    // 更新预览
    const previewContainer = document.querySelector('.preview-container');
    if (previewContainer && resultData.results && resultData.results.length > 0) {
        const result = resultData.results[0];

        if (result.url) {
            // 显示生成的图像
            previewContainer.innerHTML = `
                <div class="preview-success">
                    <div class="preview-success-icon">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <img src="${result.url}" alt="生成的图像" class="preview-image" style="max-width: 100%; max-height: 400px; margin: 1rem 0;">
                    <p>图像生成成功！</p>
                    <p class="text-sm text-tertiary">${result.content || '点击下载按钮保存图像'}</p>
                </div>
            `;
        } else {
            // 显示成功消息
            previewContainer.innerHTML = `
                <div class="preview-success">
                    <div class="preview-success-icon">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <p>图像生成成功！</p>
                    <p class="text-sm text-tertiary">${result.content || '生成完成'}</p>
                </div>
            `;
        }
    }

    ErrorHandler.handleSuccess('图像生成成功', '图像生成');

    // 添加到活动记录
    addActivity({
        icon: 'fa-image',
        title: '图像生成完成',
        description: `使用 ${resultData.model || 'AI'} 模型`,
        time: '刚刚'
    });
}

// 重置图像表单
function resetImageForm() {
    if (DOM.promptInput) DOM.promptInput.value = '';
    if (DOM.modelSelect) DOM.modelSelect.value = 'nano-banana';
    if (DOM.aspectRatioSelect) DOM.aspectRatioSelect.value = 'auto';
    if (DOM.resolutionSelect) DOM.resolutionSelect.value = '1K';
    if (DOM.referenceImagesInput) DOM.referenceImagesInput.value = '';
    AppState.referenceImages = [];
    renderReferenceImages();

    if (DOM.progressBar) DOM.progressBar.style.width = '0%';
    if (DOM.progressText) DOM.progressText.textContent = '0%';
    if (DOM.downloadBtn) DOM.downloadBtn.disabled = true;

    const previewContainer = document.querySelector('.preview-container');
    if (previewContainer) {
        previewContainer.innerHTML = `
            <div class="preview-placeholder">
                <div class="preview-placeholder-icon">
                    <i class="fas fa-image"></i>
                </div>
                <p>生成的图像将显示在这里</p>
                <p class="text-sm text-tertiary">填写提示词并点击"生成图像"开始</p>
            </div>
        `;
    }
}

// 清空预览
function clearPreview() {
    resetImageForm();
    ErrorHandler.handleSuccess('预览已清空', '图像生成');
}

// 发送消息
async function sendMessage() {
    const message = DOM.chatInput ? DOM.chatInput.value.trim() : '';
    if (!message) return;

    // 检查API密钥
    if (!window.APIService || !window.APIService.apiKey) {
        ErrorHandler.handleValidationError('API密钥', '请先设置API密钥');
        showPage('api-keys');
        return;
    }

    // 添加用户消息
    addMessage(message, 'user');

    // 清空输入框
    if (DOM.chatInput) {
        DOM.chatInput.value = '';
        DOM.chatInput.style.height = 'auto';
    }

    // 禁用发送按钮
    if (DOM.sendMessageBtn) {
        DOM.sendMessageBtn.disabled = true;
        DOM.sendMessageBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 思考中...';
    }

    // 添加AI思考中的消息
    const thinkingMessageId = 'thinking-' + Date.now();
    addMessage('思考中...', 'assistant', thinkingMessageId);

    try {
        // 获取聊天历史
        const messages = getChatHistory();
        messages.push({
            role: 'user',
            content: message
        });

        // 检查是否启用流式响应
        const useStreaming = window.APIService.useStreaming;

        if (useStreaming) {
            // 流式响应
            await sendMessageStreaming(messages, thinkingMessageId);
        } else {
            // 非流式响应
            await sendMessageNonStreaming(messages, thinkingMessageId);
        }

        // 更新使用统计
        window.APIService.updateStats('chat');
        updateDashboardStats();

        // 添加到活动记录
        addActivity({
            icon: 'fa-comment',
            title: 'AI对话完成',
            description: '与AI助手进行了对话',
            time: '刚刚'
        });

    } catch (error) {
        const errorResult = ErrorHandler.handleApiError(error, '发送消息');

        // 更新思考中的消息为错误消息
        updateMessage(thinkingMessageId, `抱歉，我遇到了一些问题: ${errorResult.message}`, 'assistant');
    } finally {
        // 恢复发送按钮
        if (DOM.sendMessageBtn) {
            DOM.sendMessageBtn.disabled = false;
            DOM.sendMessageBtn.innerHTML = '<i class="fas fa-paper-plane"></i> 发送';
        }
    }
}

// 获取聊天历史
function getChatHistory() {
    const messages = [];
    const messageElements = DOM.chatMessages ? DOM.chatMessages.querySelectorAll('.message') : [];

    for (const element of messageElements) {
        const isUser = element.classList.contains('user');
        const messageText = element.querySelector('.message-text');

        if (messageText) {
            messages.push({
                role: isUser ? 'user' : 'assistant',
                content: messageText.textContent
            });
        }
    }

    return messages;
}

// 发送消息 - 流式响应
async function sendMessageStreaming(messages, thinkingMessageId) {
    try {
        // 获取流式响应
        const stream = await window.APIService.chatCompletionStream(messages, {
            model: window.APIService.activeChatModel,
            temperature: 0.7,
            maxTokens: 2000
        });

        let fullResponse = '';
        let isFirstChunk = true;

        // 处理流式数据
        await window.APIService.processStreamResponse(
            stream.reader,
            stream.decoder,
            (chunk) => {
                if (chunk.choices && chunk.choices.length > 0) {
                    const delta = chunk.choices[0].delta;
                    if (delta && delta.content) {
                        if (isFirstChunk) {
                            // 替换思考中的消息
                            updateMessage(thinkingMessageId, delta.content, 'assistant');
                            isFirstChunk = false;
                        } else {
                            // 追加内容
                            appendToMessage(thinkingMessageId, delta.content);
                        }
                        fullResponse += delta.content;
                    }
                }
            },
            () => {
                // 流式完成
                console.log('流式响应完成');
                stream.close();
            }
        );

    } catch (error) {
        throw new Error(`流式聊天失败: ${error.message}`);
    }
}

// 发送消息 - 非流式响应
async function sendMessageNonStreaming(messages, thinkingMessageId) {
    try {
        const response = await window.APIService.chatCompletion(messages, {
            model: window.APIService.activeChatModel,
            stream: false,
            temperature: 0.7,
            maxTokens: 2000
        });

        if (response.success && response.data && response.data.choices && response.data.choices.length > 0) {
            const aiResponse = response.data.choices[0].message.content;
            updateMessage(thinkingMessageId, aiResponse, 'assistant');
        } else {
            throw new Error('AI响应格式错误');
        }
    } catch (error) {
        throw new Error(`非流式聊天失败: ${error.message}`);
    }
}

// 更新消息内容
function updateMessage(messageId, newText, sender) {
    const messageElement = document.getElementById(messageId);
    if (messageElement) {
        const messageText = messageElement.querySelector('.message-text');
        if (messageText) {
            messageText.textContent = newText;
        }
    } else {
        // 如果找不到消息元素，创建新的消息
        addMessage(newText, sender, messageId);
    }
}

// 追加消息内容
function appendToMessage(messageId, additionalText) {
    const messageElement = document.getElementById(messageId);
    if (messageElement) {
        const messageText = messageElement.querySelector('.message-text');
        if (messageText) {
            messageText.textContent += additionalText;

            // 滚动到底部
            DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
        }
    }
}

// 添加消息
function addMessage(text, sender, messageId = null) {
    if (!DOM.chatMessages) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;

    if (messageId) {
        messageDiv.id = messageId;
    }

    const avatarIcon = sender === 'user' ? 'fa-user' : 'fa-robot';
    const senderName = sender === 'user' ? '您' : 'AI 助手';

    messageDiv.innerHTML = `
        <div class="message-avatar">
            <i class="fas ${avatarIcon}"></i>
        </div>
        <div class="message-content">
            <div class="message-text">${escapeHtml(text)}</div>
            <div class="message-time">刚刚</div>
        </div>
    `;

    DOM.chatMessages.appendChild(messageDiv);

    // 滚动到底部
    DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
}

// 创建新对话
function createNewChat() {
    if (!DOM.chatMessages) return;

    DOM.chatMessages.innerHTML = `
        <div class="message assistant">
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">
                <div class="message-text">
                    你好！我是 AI 助手，很高兴为您服务。我可以帮助您解答问题、生成内容或进行对话。请问有什么可以帮您的吗？
                </div>
                <div class="message-time">刚刚</div>
            </div>
        </div>
    `;

    if (DOM.chatInput) {
        DOM.chatInput.value = '';
    }

    ErrorHandler.handleSuccess('新对话已创建', '智能对话');
}

// 清空对话
function clearChat() {
    if (!confirm('确定要清空当前对话吗？')) return;

    createNewChat();
}

// 加载API密钥
function loadApiKeys() {
    if (!DOM.keysTableBody) return;

    DOM.keysTableBody.innerHTML = `
        <tr>
            <td colspan="5" class="text-center py-8">
                <div class="loading">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">加载中...</div>
                </div>
            </td>
        </tr>
    `;

    // 从localStorage加载密钥
    setTimeout(() => {
        const keys = JSON.parse(localStorage.getItem('apiKeys') || '[]');
        const currentKey = window.APIService ? window.APIService.apiKey : null;

        if (keys.length === 0) {
            DOM.keysTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-8">
                        <div class="text-tertiary">
                            <i class="fas fa-key fa-2x mb-3"></i>
                            <p>暂无API密钥</p>
                            <p class="text-sm">请在下方添加您的API密钥</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        DOM.keysTableBody.innerHTML = keys.map(key => {
            const isCurrent = currentKey === key.fullKey;
            const maskedKey = key.key || (key.fullKey ? key.fullKey.substring(0, 8) + '...' + key.fullKey.substring(key.fullKey.length - 4) : 'sk-***');

            return `
                <tr>
                    <td>
                        ${escapeHtml(key.name || '未命名密钥')}
                        ${isCurrent ? '<span class="badge badge-primary badge-sm ml-2">当前</span>' : ''}
                    </td>
                    <td><code class="key-masked">${escapeHtml(maskedKey)}</code></td>
                    <td>${escapeHtml(key.source || '手动添加')}</td>
                    <td>
                        <span class="badge ${key.status === 'active' ? 'badge-success' : 'badge-secondary'}">
                            ${key.status === 'active' ? '活跃' : '未激活'}
                        </span>
                    </td>
                    <td>
                        <div class="key-actions">
                            <button class="btn btn-icon btn-sm ${isCurrent ? 'btn-primary' : ''}" title="${isCurrent ? '当前密钥' : '设为当前'}" onclick="setCurrentKey('${escapeHtml(key.fullKey)}')" ${isCurrent ? 'disabled' : ''}>
                                <i class="fas fa-check"></i>
                            </button>
                            <button class="btn btn-icon btn-sm" title="测试" onclick="testSpecificKey('${escapeHtml(key.fullKey)}')">
                                <i class="fas fa-vial"></i>
                            </button>
                            <button class="btn btn-icon btn-sm btn-danger" title="删除" onclick="deleteApiKey('${escapeHtml(key.fullKey)}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }, 300);
}

// 设为当前密钥
function setCurrentKey(fullKey) {
    if (!fullKey) return;

    if (window.APIService) {
        window.APIService.setApiKey(fullKey);
        ErrorHandler.handleSuccess('已设为当前API密钥', 'API密钥管理');
        loadApiKeys();
        loadInitialData();
    }
}

// 测试特定密钥
async function testSpecificKey(fullKey) {
    if (!fullKey) return;

    showNotification('正在测试API密钥...', 'info');

    try {
        const originalKey = window.APIService ? window.APIService.apiKey : null;

        if (window.APIService) {
            window.APIService.setApiKey(fullKey);
            const testResult = await window.APIService.testApiKey();

            // 恢复原始密钥
            if (originalKey) {
                window.APIService.setApiKey(originalKey);
            } else {
                window.APIService.apiKey = null;
                localStorage.removeItem('apiKey');
            }

            if (testResult.success) {
                ErrorHandler.handleSuccess('API密钥测试成功', 'API密钥测试');

                // 更新密钥状态
                updateKeyStatus(fullKey, 'active');
            } else {
                throw new Error(testResult.message);
            }
        }
    } catch (error) {
        const errorResult = ErrorHandler.handleApiError(error, '测试API密钥');
        updateKeyStatus(fullKey, 'inactive');
    }
}

// 删除API密钥
function deleteApiKey(fullKey) {
    if (!fullKey || !confirm('确定要删除这个API密钥吗？')) return;

    const keys = JSON.parse(localStorage.getItem('apiKeys') || '[]');
    const filteredKeys = keys.filter(k => k.fullKey !== fullKey);

    localStorage.setItem('apiKeys', JSON.stringify(filteredKeys));

    // 如果删除的是当前密钥，清除当前密钥
    if (window.APIService && window.APIService.apiKey === fullKey) {
        window.APIService.apiKey = null;
        localStorage.removeItem('apiKey');
        ErrorHandler.handleSuccess('已删除当前API密钥', 'API密钥删除');
    } else {
        ErrorHandler.handleSuccess('API密钥已删除', 'API密钥删除');
    }

    loadApiKeys();
    loadInitialData();
}

// 更新密钥状态
function updateKeyStatus(fullKey, status) {
    const keys = JSON.parse(localStorage.getItem('apiKeys') || '[]');
    const keyIndex = keys.findIndex(k => k.fullKey === fullKey);

    if (keyIndex >= 0) {
        keys[keyIndex].status = status;
        keys[keyIndex].lastTested = new Date().toISOString();
        localStorage.setItem('apiKeys', JSON.stringify(keys));
        loadApiKeys();
    }
}

// 添加API密钥
async function addApiKey() {
    const key = DOM.newApiKey ? DOM.newApiKey.value.trim() : '';
    const name = DOM.keyName ? DOM.keyName.value.trim() : '';

    if (!key) {
        ErrorHandler.handleValidationError('API密钥', '请输入API密钥');
        if (DOM.newApiKey) DOM.newApiKey.focus();
        return;
    }

    if (!key.startsWith('sk-')) {
        ErrorHandler.handleValidationError('API密钥', 'API密钥应以 "sk-" 开头');
        return;
    }

    showNotification('正在添加API密钥...', 'info');

    try {
        // 设置API密钥
        if (window.APIService) {
            window.APIService.setApiKey(key);

            // 测试密钥
            const testResult = await window.APIService.testApiKey();

            if (testResult.success) {
                // 清空表单
                if (DOM.newApiKey) DOM.newApiKey.value = '';
                if (DOM.keyName) DOM.keyName.value = '';

                // 保存密钥信息
                const keyInfo = {
                    name: name || '未命名密钥',
                    key: key.substring(0, 8) + '...' + key.substring(key.length - 4),
                    fullKey: key,
                    addedAt: new Date().toISOString(),
                    lastTested: new Date().toISOString(),
                    status: 'active'
                };

                saveApiKeyInfo(keyInfo);

                ErrorHandler.handleSuccess('API密钥添加并测试成功', 'API密钥管理');
                loadApiKeys();
                loadInitialData(); // 刷新状态显示

                // 添加到活动记录
                addActivity({
                    icon: 'fa-key',
                    title: 'API密钥已添加',
                    description: name || '新API密钥',
                    time: '刚刚'
                });
            } else {
                throw new Error(testResult.message);
            }
        } else {
            throw new Error('API服务未初始化');
        }
    } catch (error) {
        ErrorHandler.handleApiError(error, '添加API密钥');
    }
}

// 保存API密钥信息
function saveApiKeyInfo(keyInfo) {
    const keys = JSON.parse(localStorage.getItem('apiKeys') || '[]');

    // 检查是否已存在相同密钥
    const existingIndex = keys.findIndex(k => k.fullKey === keyInfo.fullKey);
    if (existingIndex >= 0) {
        keys[existingIndex] = keyInfo;
    } else {
        keys.push(keyInfo);
    }

    localStorage.setItem('apiKeys', JSON.stringify(keys));
}

// 测试API密钥
async function testApiKey() {
    const key = DOM.newApiKey ? DOM.newApiKey.value.trim() : '';

    if (!key) {
        ErrorHandler.handleValidationError('API密钥', '请输入要测试的API密钥');
        return;
    }

    showNotification('正在测试API密钥...', 'info');

    try {
        // 临时设置API密钥进行测试
        const originalKey = window.APIService ? window.APIService.apiKey : null;

        if (window.APIService) {
            window.APIService.setApiKey(key);
            const testResult = await window.APIService.testApiKey();

            // 恢复原始密钥
            if (originalKey) {
                window.APIService.setApiKey(originalKey);
            } else {
                window.APIService.apiKey = null;
                localStorage.removeItem('apiKey');
            }

            if (testResult.success) {
                ErrorHandler.handleSuccess('API密钥测试成功', 'API密钥测试');
            } else {
                throw new Error(testResult.message);
            }
        } else {
            throw new Error('API服务未初始化');
        }
    } catch (error) {
        ErrorHandler.handleApiError(error, '测试API密钥');
    }
}

// 刷新API密钥
function refreshApiKeys() {
    loadApiKeys();
    ErrorHandler.handleSuccess('API密钥列表已刷新', 'API密钥管理');
}

// 加载设置
function loadSettings() {
    // 从localStorage加载设置
    const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');

    if (DOM.timeoutSelect && settings.timeout) {
        DOM.timeoutSelect.value = settings.timeout;
    }

    if (DOM.retrySelect && settings.retry) {
        DOM.retrySelect.value = settings.retry;
    }

    // 加载API主机设置
    const apiHostSelect = document.getElementById('apiHostSelect');
    if (apiHostSelect) {
        const savedHost = localStorage.getItem('apiHost') || 'https://api.grsai.com';
        apiHostSelect.value = savedHost;

        // 更新API服务的主机
        if (window.APIService) {
            window.APIService.setApiHost(savedHost);
        }
    }

    // 加载流式响应设置
    const streamToggle = document.getElementById('streamToggle');
    if (streamToggle) {
        const useStreaming = localStorage.getItem('useStreaming') !== 'false';
        streamToggle.checked = useStreaming;

        if (window.APIService) {
            window.APIService.useStreaming = useStreaming;
        }
    }

    // 加载模型选择
    const imageModelSelect = document.getElementById('imageModelSelect');
    const chatModelSelect = document.getElementById('chatModelSelect');

    if (imageModelSelect && window.APIService) {
        imageModelSelect.value = window.APIService.activeImageModel;
    }

    if (chatModelSelect && window.APIService) {
        chatModelSelect.value = window.APIService.activeChatModel;
    }
}

// 保存设置
function saveSettings() {
    const settings = {
        timeout: DOM.timeoutSelect ? DOM.timeoutSelect.value : '60',
        retry: DOM.retrySelect ? DOM.retrySelect.value : '1'
    };

    localStorage.setItem('appSettings', JSON.stringify(settings));

    // 保存API主机设置
    const apiHostSelect = document.getElementById('apiHostSelect');
    if (apiHostSelect) {
        const selectedHost = apiHostSelect.value;
        localStorage.setItem('apiHost', selectedHost);

        if (window.APIService) {
            window.APIService.setApiHost(selectedHost);
        }
    }

    // 保存流式响应设置
    const streamToggle = document.getElementById('streamToggle');
    if (streamToggle) {
        const useStreaming = streamToggle.checked;
        localStorage.setItem('useStreaming', useStreaming);

        if (window.APIService) {
            window.APIService.useStreaming = useStreaming;
        }
    }

    // 保存模型选择
    const imageModelSelect = document.getElementById('imageModelSelect');
    const chatModelSelect = document.getElementById('chatModelSelect');

    if (imageModelSelect && window.APIService) {
        const selectedModel = imageModelSelect.value;
        window.APIService.activeImageModel = selectedModel;
        localStorage.setItem('activeImageModel', selectedModel);
    }

    if (chatModelSelect && window.APIService) {
        const selectedModel = chatModelSelect.value;
        window.APIService.activeChatModel = selectedModel;
        localStorage.setItem('activeChatModel', selectedModel);
    }

    ErrorHandler.handleSuccess('设置已保存', '系统设置');
}

// 错误处理工具
const ErrorHandler = {
    // 处理API错误
    handleApiError: function(error, context = '') {
        console.error(`API错误 [${context}]:`, error);

        let userMessage = '发生未知错误';

        if (error.message) {
            if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
                userMessage = '网络连接失败，请检查网络连接';
            } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                userMessage = 'API密钥无效或已过期';
            } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
                userMessage = '权限不足，请检查API密钥权限';
            } else if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
                userMessage = '请求过于频繁，请稍后再试';
            } else if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
                userMessage = '服务器内部错误，请稍后再试';
            } else if (error.message.includes('timeout')) {
                userMessage = '请求超时，请检查网络连接';
            } else {
                userMessage = error.message;
            }
        }

        showNotification(`${context ? context + ': ' : ''}${userMessage}`, 'error');

        // 记录错误到活动记录
        if (context) {
            addActivity({
                icon: 'fa-exclamation-circle',
                title: `${context}失败`,
                description: userMessage,
                time: '刚刚'
            });
        }

        return {
            success: false,
            message: userMessage,
            error: error
        };
    },

    // 处理验证错误
    handleValidationError: function(field, message) {
        showNotification(`${field}: ${message}`, 'error');
        return {
            success: false,
            field: field,
            message: message
        };
    },

    // 处理成功操作
    handleSuccess: function(message, context = '') {
        showNotification(message, 'success');
        return {
            success: true,
            message: message
        };
    }
};

// 显示通知
function showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-icon">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
        </div>
        <div class="notification-content">
            <p>${escapeHtml(message)}</p>
        </div>
        <button class="notification-close">
            <i class="fas fa-times"></i>
        </button>
    `;

    // 添加到页面
    document.body.appendChild(notification);

    // 添加动画
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    // 绑定关闭事件
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    });

    // 自动关闭
    setTimeout(() => {
        if (notification.parentNode) {
            closeBtn.click();
        }
    }, 5000);

    // 添加到状态
    AppState.notifications.push({
        message,
        type,
        timestamp: new Date()
    });
}

// 获取通知图标
function getNotificationIcon(type) {
    switch (type) {
        case 'success': return 'check-circle';
        case 'error': return 'exclamation-circle';
        case 'warning': return 'exclamation-triangle';
        default: return 'info-circle';
    }
}

// 格式化时间
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;

    return date.toLocaleDateString();
}

// HTML转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 添加通知样式
function addNotificationStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .notification {
            position: fixed;
            bottom: 1rem;
            right: 1rem;
            background: var(--color-bg-surface);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-md);
            padding: var(--space-3) var(--space-4);
            display: flex;
            align-items: center;
            gap: var(--space-3);
            box-shadow: var(--shadow-lg);
            z-index: 1000;
            max-width: 24rem;
            opacity: 0;
            transform: translateY(16px) scale(0.98);
            transition: opacity 0.25s ease, transform 0.25s ease;
            backdrop-filter: blur(6px);
        }

        .notification.show {
            opacity: 1;
            transform: translateY(0) scale(1);
        }

        .notification-icon {
            font-size: 1.25rem;
            flex-shrink: 0;
        }

        .notification-info .notification-icon {
            color: var(--color-info);
        }

        .notification-success .notification-icon {
            color: var(--color-success);
        }

        .notification-warning .notification-icon {
            color: var(--color-warning);
        }

        .notification-error .notification-icon {
            color: var(--color-error);
        }

        .notification-content {
            flex: 1;
            font-size: var(--font-size-sm);
        }

        .notification-close {
            background: none;
            border: none;
            color: var(--color-text-tertiary);
            cursor: pointer;
            padding: var(--space-1);
            border-radius: var(--radius-sm);
            flex-shrink: 0;
        }

        .notification-close:hover {
            background: var(--color-bg-surface-hover);
            color: var(--color-text-primary);
        }
    `;
    document.head.appendChild(style);
}

// 添加预览成功样式
function addPreviewSuccessStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .preview-success {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: var(--space-8);
            text-align: center;
        }

        .preview-success-icon {
            font-size: 3rem;
            color: var(--color-success);
            margin-bottom: var(--space-4);
        }
    `;
    document.head.appendChild(style);
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    addNotificationStyles();
    addPreviewSuccessStyles();
    initApp();
});

// 导出到全局
window.App = {
    state: AppState,
    showPage,
    showNotification,
    setTheme,
    // API密钥管理函数
    setCurrentKey,
    testSpecificKey,
    deleteApiKey,
    // 其他实用函数
    addActivity,
    updateDashboardStats
};
