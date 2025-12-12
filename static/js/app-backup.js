/* ============================================
   MATCHBOX - 主应用脚本
   ============================================ */

// 应用状态管理
const AppState = {
    currentPage: 'dashboard',
    theme: localStorage.getItem('theme') || 'dark',
    apiKey: null,
    isLoading: false,
    notifications: []
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

    // 设置
    timeoutSelect: document.getElementById('timeoutSelect'),
    retrySelect: document.getElementById('retrySelect')
};

// 页面配置
const PageConfig = {
    dashboard: {
        title: '仪表盘',
        subtitle: '欢迎使用 Matchbox AI 服务平台'
    },
    'image-generation': {
        title: '图像生成',
        subtitle: '使用先进的 AI 模型生成高质量图像'
    },
    chat: {
        title: '智能对话',
        subtitle: '与多种大语言模型进行自然对话'
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
    console.log('初始化 Matchbox 应用...');

    // 设置主题
    setTheme(AppState.theme);

    // 绑定事件
    bindEvents();

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

    // 图像生成事件
    if (DOM.generateBtn) {
        DOM.generateBtn.addEventListener('click', generateImage);
    }

    if (DOM.resetFormBtn) {
        DOM.resetFormBtn.addEventListener('click', resetImageForm);
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
function loadInitialData() {
    // 加载用户资料（包含统计数据）
    fetch('/api/profile')
        .then(response => response.json())
        .then(data => {
            if (DOM.totalImages) DOM.totalImages.textContent = data.usage?.totalCalls || 0;
            if (DOM.totalChats) DOM.totalChats.textContent = 0; // 暂时设为0，后续可以添加专门的聊天统计
            if (DOM.apiUsage) DOM.apiUsage.textContent = data.usage?.totalCalls || 0;

            // 更新API密钥状态
            if (DOM.currentKeyStatus) {
                DOM.currentKeyStatus.textContent = data.hasKey ? '已设置' : '未设置';
            }

            if (DOM.lastUsedTime && data.usage?.lastUsedAt) {
                DOM.lastUsedTime.textContent = formatTime(data.usage.lastUsedAt);
            }
        })
        .catch(error => {
            console.error('加载用户资料失败:', error);
        });
}

// 加载仪表盘数据
function loadDashboardData() {
    // 加载最近活动
    refreshActivities();
}

// 刷新活动记录
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

    // 模拟API调用
    setTimeout(() => {
        const activities = [
            {
                icon: 'fa-image',
                title: '图像生成任务已提交',
                description: '使用 nano-banana-pro 模型',
                time: '刚刚'
            },
            {
                icon: 'fa-comment',
                title: '与 GPT-4 的对话已开始',
                description: '讨论 AI 发展趋势',
                time: '5分钟前'
            },
            {
                icon: 'fa-key',
                title: 'API 密钥已更新',
                description: '新增生产环境密钥',
                time: '1小时前'
            }
        ];

        DOM.activitiesList.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon">
                    <i class="fas ${activity.icon}"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-title">${activity.title}</div>
                    <div class="activity-description">${activity.description}</div>
                </div>
                <div class="activity-time">${activity.time}</div>
            </div>
        `).join('');
    }, 500);
}

// 生成图像
function generateImage() {
    if (!DOM.promptInput || !DOM.promptInput.value.trim()) {
        showNotification('请输入提示词', 'error');
        DOM.promptInput.focus();
        return;
    }

    if (AppState.isLoading) return;

    AppState.isLoading = true;
    DOM.generateBtn.disabled = true;
    DOM.generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 生成中...';

    const prompt = DOM.promptInput.value;
    const model = DOM.modelSelect ? DOM.modelSelect.value : 'nano-banana';
    const aspectRatio = DOM.aspectRatioSelect ? DOM.aspectRatioSelect.value : 'auto';
    const resolution = DOM.resolutionSelect ? DOM.resolutionSelect.value : '1K';

    // 模拟进度
    let progress = 0;
    const interval = setInterval(() => {
        progress += 10;
        if (progress > 100) progress = 100;

        if (DOM.progressBar) {
            DOM.progressBar.style.width = `${progress}%`;
        }

        if (DOM.progressText) {
            DOM.progressText.textContent = `${progress}%`;
        }

        if (progress === 100) {
            clearInterval(interval);

            // 模拟完成
            setTimeout(() => {
                AppState.isLoading = false;
                DOM.generateBtn.disabled = false;
                DOM.generateBtn.innerHTML = '<i class="fas fa-magic"></i> 生成图像';

                if (DOM.downloadBtn) {
                    DOM.downloadBtn.disabled = false;
                }

                // 更新预览
                const previewContainer = document.querySelector('.preview-container');
                if (previewContainer) {
                    previewContainer.innerHTML = `
                        <div class="preview-success">
                            <div class="preview-success-icon">
                                <i class="fas fa-check-circle"></i>
                            </div>
                            <p>图像生成成功！</p>
                            <p class="text-sm text-tertiary">点击下载按钮保存图像</p>
                        </div>
                    `;
                }

                showNotification('图像生成成功', 'success');
            }, 500);
        }
    }, 200);
}

// 重置图像表单
function resetImageForm() {
    if (DOM.promptInput) DOM.promptInput.value = '';
    if (DOM.modelSelect) DOM.modelSelect.value = 'nano-banana';
    if (DOM.aspectRatioSelect) DOM.aspectRatioSelect.value = 'auto';
    if (DOM.resolutionSelect) DOM.resolutionSelect.value = '1K';

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
    showNotification('预览已清空', 'info');
}

// 发送消息
function sendMessage() {
    const message = DOM.chatInput ? DOM.chatInput.value.trim() : '';
    if (!message) return;

    // 添加用户消息
    addMessage(message, 'user');

    // 清空输入框
    if (DOM.chatInput) {
        DOM.chatInput.value = '';
        DOM.chatInput.style.height = 'auto';
    }

    // 模拟AI回复
    setTimeout(() => {
        const responses = [
            "这是一个很好的问题！让我为您详细解答...",
            "基于您的问题，我的分析是...",
            "我理解您的疑问，让我从几个方面来回答...",
            "这个问题很有趣！让我分享一些相关的见解..."
        ];
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        addMessage(randomResponse, 'assistant');
    }, 1000);
}

// 添加消息
function addMessage(text, sender) {
    if (!DOM.chatMessages) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;

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

    showNotification('新对话已创建', 'success');
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

    // 模拟API调用
    setTimeout(() => {
        const keys = [
            {
                name: '生产环境密钥',
                masked: 'sk-***7890',
                source: '手动添加',
                status: 'active',
                lastUsed: '2025-01-15 14:30'
            },
            {
                name: '测试环境密钥',
                masked: 'sk-***1234',
                source: '环境变量',
                status: 'inactive',
                lastUsed: '2025-01-10 09:15'
            }
        ];

        DOM.keysTableBody.innerHTML = keys.map(key => `
            <tr>
                <td>${escapeHtml(key.name)}</td>
                <td><code class="key-masked">${escapeHtml(key.masked)}</code></td>
                <td>${escapeHtml(key.source)}</td>
                <td>
                    <span class="badge ${key.status === 'active' ? 'badge-success' : 'badge-secondary'}">
                        ${key.status === 'active' ? '活跃' : '未激活'}
                    </span>
                </td>
                <td>
                    <div class="key-actions">
                        <button class="btn btn-icon btn-sm" title="设为当前">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn btn-icon btn-sm" title="测试">
                            <i class="fas fa-vial"></i>
                        </button>
                        <button class="btn btn-icon btn-sm btn-danger" title="删除">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }, 800);
}

// 添加API密钥
function addApiKey() {
    const key = DOM.newApiKey ? DOM.newApiKey.value.trim() : '';
    const name = DOM.keyName ? DOM.keyName.value.trim() : '';

    if (!key) {
        showNotification('请输入API密钥', 'error');
        if (DOM.newApiKey) DOM.newApiKey.focus();
        return;
    }

    if (!key.startsWith('sk-')) {
        showNotification('API密钥应以 "sk-" 开头', 'error');
        return;
    }

    // 模拟API调用
    showNotification('正在添加API密钥...', 'info');

    setTimeout(() => {
        if (DOM.newApiKey) DOM.newApiKey.value = '';
        if (DOM.keyName) DOM.keyName.value = '';

        showNotification('API密钥添加成功', 'success');
        loadApiKeys();

        // 更新状态
        if (DOM.currentKeyStatus) {
            DOM.currentKeyStatus.textContent = '已设置';
        }

        if (DOM.lastUsedTime) {
            DOM.lastUsedTime.textContent = '刚刚';
        }
    }, 1000);
}

// 测试API密钥
function testApiKey() {
    const key = DOM.newApiKey ? DOM.newApiKey.value.trim() : '';

    if (!key) {
        showNotification('请输入要测试的API密钥', 'error');
        return;
    }

    showNotification('正在测试API密钥...', 'info');

    // 模拟测试
    setTimeout(() => {
        const success = Math.random() > 0.3; // 70%成功率
        if (success) {
            showNotification('API密钥测试成功', 'success');
        } else {
            showNotification('API密钥测试失败，请检查密钥是否正确', 'error');
        }
    }, 1500);
}

// 刷新API密钥
function refreshApiKeys() {
    loadApiKeys();
    showNotification('API密钥列表已刷新', 'info');
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
}

// 保存设置
function saveSettings() {
    const settings = {
        timeout: DOM.timeoutSelect ? DOM.timeoutSelect.value : '60',
        retry: DOM.retrySelect ? DOM.retrySelect.value : '1'
    };

    localStorage.setItem('appSettings', JSON.stringify(settings));
    showNotification('设置已保存', 'success');
}

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
            top: 1rem;
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
            transform: translateX(120%);
            transition: transform 0.3s ease;
            max-width: 24rem;
        }

        .notification.show {
            transform: translateX(0);
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
    setTheme
};