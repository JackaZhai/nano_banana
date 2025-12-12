const form = document.getElementById('drawForm');
const promptInput = document.getElementById('prompt');
const modelInput = document.getElementById('model');
const aspectRatioInput = document.getElementById('aspectRatio');
const imageSizeInput = document.getElementById('imageSize');
const webHookInput = document.getElementById('webHook');
const shutProgressInput = document.getElementById('shutProgress');
const submitBtn = document.getElementById('submitBtn');
const resetBtn = document.getElementById('resetBtn');
const statusText = document.getElementById('statusText');
const progressBar = document.getElementById('progressBar');
const logPanel = document.getElementById('log');
const gallery = document.getElementById('gallery');
const copyImageBtn = document.getElementById('copyImage');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatMessage');
const chatModel = document.getElementById('chatModel');
const systemPromptInput = document.getElementById('systemPrompt');
const chatStreamInput = document.getElementById('chatStream');
const chatLog = document.getElementById('chatLog');
const chatClear = document.getElementById('chatClear');
const chatSend = document.getElementById('chatSend');
const apiKeyForm = document.getElementById('apiKeyForm');
const apiKeyInput = document.getElementById('apiKeyInput');
const apiKeyList = document.getElementById('apiKeyList');
const activeKeyMask = document.getElementById('activeKeyMask');
const apiKeyNotice = document.getElementById('apiKeyNotice');
const sidebarKey = document.getElementById('sidebarKey');
const usageTotal = document.getElementById('usageTotal');
const usageLast = document.getElementById('usageLast');
const featureButtons = document.querySelectorAll('[data-feature]');
const featureSections = document.querySelectorAll('.feature-section');
const featureEndpoints = document.querySelectorAll('[data-feature-display]');
const featureShortcuts = document.querySelectorAll('[data-feature-target]');
const workbench = document.querySelector('.workbench');

let currentId = '';
let lastResponse = null;
let pollTimer = null;
let referenceFiles = [];
let chatHistory = [];
let apiKeys = [];
let activeKeyId = '';
const MAX_REFERENCE_FILES = 3;
const MAX_FILE_SIZE_MB = 2;

const appendLog = (message) => {
  const now = new Date();
  const timestamp = now.toLocaleTimeString();
  logPanel.textContent += `[${timestamp}] ${message}\n`;
  logPanel.scrollTop = logPanel.scrollHeight;
};

const setStatus = (text, type = '') => {
  statusText.textContent = text;
  statusText.className = `status-pill ${type}`.trim();
};

const setProgress = (value) => {
  const val = Math.min(100, Math.max(0, value || 0));
  progressBar.style.width = `${val}%`;
};

const setFeature = (feature) => {
  featureButtons.forEach((btn) => {
    const isActive = btn.dataset.feature === feature;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive);
  });

  featureSections.forEach((section) => {
    const match = section.id === `feature-${feature}`;
    section.hidden = !match;
    section.classList.toggle('active', match);
  });

  featureEndpoints.forEach((endpoint) => {
    const match = endpoint.dataset.featureDisplay === feature;
    endpoint.hidden = !match;
  });

  if (workbench) {
    workbench.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

const toggleLoading = (loading) => {
  submitBtn.disabled = loading;
  submitBtn.textContent = loading ? '正在提交...' : '立即生成';
};

const renderResults = (results = []) => {
  gallery.innerHTML = '';
  if (!results.length) {
    gallery.classList.add('empty');
    gallery.innerHTML = '<p class="placeholder">结果将展示在这里。</p>';
    return;
  }
  gallery.classList.remove('empty');
  results.forEach(({ url, content }, index) => {
    const card = document.createElement('div');
    card.className = 'card';

    const img = document.createElement('img');
    img.src = url;
    img.alt = content || `结果 ${index + 1}`;

    const footer = document.createElement('footer');
    footer.innerHTML = `<span>${content || '生成内容'}</span><a href="${url}" target="_blank" rel="noopener">下载</a>`;

    card.appendChild(img);
    card.appendChild(footer);
    gallery.appendChild(card);
  });
};

const extractResults = (response) => {
  if (!response) return [];
  if (Array.isArray(response.results)) return response.results;
  if (response.data && Array.isArray(response.data.results)) return response.data.results;
  return [];
};

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
};

const pollResult = (id) => {
  stopPolling();
  pollTimer = setInterval(async () => {
    try {
      const res = await fetch('/api/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '接口请求失败');
      const payload = data.data || data; // 兼容两种响应格式
      const { progress = 0, status = 'running', results = [], failure_reason, error } = payload;
      setProgress(progress);
      setStatus(status === 'succeeded' ? '生成成功' : status === 'failed' ? '生成失败' : '生成中', status === 'succeeded' ? 'success' : status === 'failed' ? 'error' : 'running');
      appendLog(`任务 ${id} 状态：${status}，进度 ${progress}%`);
      if (failure_reason || error) {
        appendLog(`失败原因：${failure_reason || error}`);
      }
      if (status === 'succeeded') {
        lastResponse = payload;
        renderResults(results);
        stopPolling();
      }
      if (status === 'failed') {
        stopPolling();
      }
    } catch (error) {
      appendLog(`轮询失败：${error.message}`);
      stopPolling();
    }
  }, 2000);
};

const filesToDataUrls = async (files) => {
  const converters = Array.from(files).map(
    (file) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ name: file.name, dataUrl: reader.result });
        reader.onerror = () => reject(reader.error || new Error('读取文件失败'));
        reader.readAsDataURL(file);
      }),
  );
  return Promise.all(converters);
};

const renderThumbs = () => {
  fileList.innerHTML = '';
  referenceFiles.forEach((item, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'thumb';

    const img = document.createElement('img');
    img.src = item.dataUrl;
    img.alt = item.name;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      referenceFiles.splice(index, 1);
      renderThumbs();
    });

    wrapper.appendChild(img);
    wrapper.appendChild(removeBtn);
    fileList.appendChild(wrapper);
  });
};

const handleFiles = async (files) => {
  if (!files || !files.length) return;
  try {
    const remainingSlots = MAX_REFERENCE_FILES - referenceFiles.length;
    const selected = Array.from(files).slice(0, remainingSlots);

    const oversized = selected.filter((file) => file.size > MAX_FILE_SIZE_MB * 1024 * 1024);
    if (oversized.length) {
      appendLog(`以下文件过大（>${MAX_FILE_SIZE_MB}MB）：${oversized.map((f) => f.name).join('、')}`);
      return;
    }

    if (!selected.length) {
      appendLog(`最多支持 ${MAX_REFERENCE_FILES} 张参考图。`);
      return;
    }

    const converted = await filesToDataUrls(selected);
    referenceFiles = referenceFiles.concat(converted);
    renderThumbs();
    appendLog(`添加了 ${converted.length} 张参考图。`);
  } catch (error) {
    appendLog(error.message || '参考图添加失败');
  }
};

const setupDropzone = () => {
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropzone.classList.add('dragging');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragging'));
  dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropzone.classList.remove('dragging');
    handleFiles(event.dataTransfer.files);
  });
  fileInput.addEventListener('change', (event) => handleFiles(event.target.files));
};

const submitForm = async (event) => {
  event.preventDefault();
  stopPolling();
  currentId = '';
  lastResponse = null;
  logPanel.textContent = '';
  setProgress(0);
  setStatus('提交中', 'running');
  toggleLoading(true);

  const payload = {
    prompt: promptInput.value.trim(),
    model: modelInput.value,
    aspectRatio: aspectRatioInput.value,
    imageSize: imageSizeInput.value,
    urls: referenceFiles.map((file) => file.dataUrl),
    webHook: webHookInput.value.trim() || '-1',
    shutProgress: shutProgressInput.checked,
  };

  try {
    const res = await fetch('/api/draw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '接口请求失败');

    lastResponse = data;
    const drawId = data.id || (data.data && data.data.id);
    if (drawId) {
      currentId = drawId;
      appendLog(`任务已创建，id=${drawId}，开始轮询结果...`);
      setStatus('生成中', 'running');
      pollResult(drawId);
    }

    if (data.results) {
      appendLog('收到直接结果。');
      renderResults(data.results);
      setProgress(data.progress || 100);
      setStatus(data.status || '已返回', data.status === 'succeeded' ? 'success' : '');
    }
    fetchProfile();
  } catch (error) {
    appendLog(error.message);
    setStatus('提交失败', 'error');
  } finally {
    toggleLoading(false);
  }
};

const resetForm = () => {
  form.reset();
  promptInput.focus();
  setProgress(0);
  setStatus('尚未开始');
  gallery.classList.add('empty');
  gallery.innerHTML = '<p class="placeholder">结果将展示在这里。</p>';
  logPanel.textContent = '';
  referenceFiles = [];
  renderThumbs();
  stopPolling();
};

const syncApiKeyNotice = (hasKey) => {
  if (!apiKeyNotice) return;
  apiKeyNotice.style.display = hasKey ? 'none' : 'block';
};

const renderApiKeyList = () => {
  if (!apiKeyList) return;
  apiKeyList.innerHTML = '';

  if (!apiKeys.length) {
    const empty = document.createElement('p');
    empty.className = 'placeholder';
    empty.textContent = '尚未添加 Api key，添加后可在此切换或删除。';
    apiKeyList.appendChild(empty);
    if (activeKeyMask) activeKeyMask.textContent = '暂无';
    return;
  }

  apiKeys.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'key-item';

    const meta = document.createElement('div');
    meta.className = 'meta';

    const mask = document.createElement('p');
    mask.className = 'key-mask';
    mask.textContent = item.mask || '***';

    const source = document.createElement('p');
    source.className = 'key-source';
    source.textContent = item.source === 'env' ? '来源：环境变量/配置' : '来源：手动添加';

    meta.appendChild(mask);
    meta.appendChild(source);

    const actions = document.createElement('div');
    actions.className = 'key-actions';

    if (item.isActive) {
      const badge = document.createElement('span');
      badge.className = 'status-pill success';
      badge.textContent = '使用中';
      actions.appendChild(badge);
      if (activeKeyMask) activeKeyMask.textContent = item.mask;
    } else {
      const useBtn = document.createElement('button');
      useBtn.type = 'button';
      useBtn.className = 'ghost';
      useBtn.textContent = '设为当前';
      useBtn.addEventListener('click', () => setActiveApiKey(item.id));
      actions.appendChild(useBtn);
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'ghost danger';
    deleteBtn.textContent = '删除';
    deleteBtn.addEventListener('click', () => removeApiKey(item.id));
    actions.appendChild(deleteBtn);

    row.appendChild(meta);
    row.appendChild(actions);
    apiKeyList.appendChild(row);
  });
};

const updateApiKeyState = (data) => {
  apiKeys = data.keys || [];
  activeKeyId = data.activeId || '';
  renderApiKeyList();
  syncApiKeyNotice(Boolean(data.hasKey));
  if (sidebarKey) {
    const active = data.keys.find((item) => item.isActive);
    sidebarKey.textContent = active?.mask || '未设置';
  }
};

const fetchApiKeys = async () => {
  try {
    const res = await fetch('/api/keys');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '获取 Api key 失败');
    updateApiKeyState(data);
  } catch (error) {
    appendLog(`获取 Api key 失败：${error.message || error}`);
  }
};

const submitApiKey = async (event) => {
  event.preventDefault();
  const value = (apiKeyInput?.value || '').trim();
  if (!value) return;
  try {
    const res = await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '保存 Api key 失败');
    updateApiKeyState(data);
    apiKeyInput.value = '';
    appendLog('已添加并启用新的 Api key');
  } catch (error) {
    appendLog(error.message || '保存 Api key 失败');
  }
};

const setActiveApiKey = async (id) => {
  try {
    const res = await fetch('/api/keys/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '切换失败');
    updateApiKeyState(data);
    appendLog('已切换 Api key');
  } catch (error) {
    appendLog(error.message || '切换 Api key 失败');
  }
};

const removeApiKey = async (id) => {
  try {
    const res = await fetch(`/api/keys/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '删除失败');
    updateApiKeyState(data);
    appendLog('已删除 Api key');
  } catch (error) {
    appendLog(error.message || '删除 Api key 失败');
  }
};

const updateUsage = (data) => {
  if (!data || !data.usage) return;
  if (usageTotal) usageTotal.textContent = data.usage.totalCalls ?? 0;
  if (usageLast) {
    usageLast.textContent = data.usage.lastUsedAt
      ? `最近使用：${new Date(data.usage.lastUsedAt).toLocaleString()}`
      : '最近使用：暂无';
  }
  if (sidebarKey && data.activeKeyMask !== undefined) {
    sidebarKey.textContent = data.activeKeyMask || '未设置';
  }
};

const fetchProfile = async () => {
  try {
    const res = await fetch('/api/profile');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '获取个人信息失败');
    updateUsage(data);
  } catch (error) {
    appendLog(error.message || '获取个人信息失败');
  }
};

const renderChatLog = () => {
  if (!chatLog) return;
  chatLog.innerHTML = '';
  if (!chatHistory.length) {
    const empty = document.createElement('div');
    empty.className = 'chat__empty';
    empty.textContent = '尚无对话，输入内容开始与模型交流。';
    chatLog.appendChild(empty);
    return;
  }

  chatHistory.forEach(({ role, content }) => {
    const row = document.createElement('div');
    row.className = `chat__message ${role}`;

    const roleEl = document.createElement('div');
    roleEl.className = 'chat__role';
    roleEl.textContent = role === 'assistant' ? '助手' : role === 'system' ? '系统' : '用户';

    const bubble = document.createElement('div');
    bubble.className = 'chat__bubble';
    bubble.textContent = content;

    row.appendChild(roleEl);
    row.appendChild(bubble);
    chatLog.appendChild(row);
  });
  chatLog.scrollTop = chatLog.scrollHeight;
};

const updateAssistantDraft = (index, content) => {
  if (!chatHistory[index]) return;
  chatHistory[index].content = content;
  renderChatLog();
};

const handleChatStream = async (response, draftIndex) => {
  if (!response.body) throw new Error('无法读取流式响应');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let assembled = chatHistory[draftIndex]?.content || '';

  const processLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('data:')) return;
    const payload = trimmed.replace(/^data:\s*/, '');
    if (payload === '[DONE]') return 'done';
    try {
      const json = JSON.parse(payload);
      const choice = (json.choices && json.choices[0]) || {};
      const delta = (choice.delta && choice.delta.content) || '';
      if (delta) {
        assembled += delta;
        updateAssistantDraft(draftIndex, assembled);
      }
    } catch (err) {
      // ignore malformed chunk
    }
    return null;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n');
    buffer = parts.pop();
    for (const part of parts) {
      const status = processLine(part);
      if (status === 'done') return;
    }
  }

  if (buffer) {
    processLine(buffer);
  }
};

const sendChat = async (event) => {
  event.preventDefault();
  if (!chatInput || !chatModel) return;
  const question = (chatInput.value || '').trim();
  if (!question) return;

  const systemPrompt = (systemPromptInput?.value || '').trim() || 'You are a helpful assistant.';
  const stream = !!chatStreamInput?.checked;

  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push(...chatHistory.filter((msg) => msg.role !== 'system'));
  messages.push({ role: 'user', content: question });

  chatHistory.push({ role: 'user', content: question });
  renderChatLog();

  chatSend.disabled = true;
  chatSend.textContent = '发送中...';

  const draftIndex = chatHistory.push({ role: 'assistant', content: '' }) - 1;
  renderChatLog();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: chatModel.value, messages, stream }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || '接口请求失败');
    }

    if (stream) {
      await handleChatStream(res, draftIndex);
    } else {
      const data = await res.json();
      const choice = (data.choices && data.choices[0]) || {};
      const reply = (choice.message && choice.message.content) || (choice.delta && choice.delta.content) || data.content || '';
      updateAssistantDraft(draftIndex, reply || '');
    }
    fetchProfile();
  } catch (error) {
    updateAssistantDraft(draftIndex, `请求失败：${error.message || error}`);
  } finally {
    chatSend.disabled = false;
    chatSend.textContent = '发送';
    chatInput.value = '';
    chatInput.focus();
  }
};

const clearChat = () => {
  chatHistory = [];
  renderChatLog();
  if (chatInput) chatInput.value = '';
};

const copyImage = async () => {
  const results = extractResults(lastResponse);
  if (!results.length) {
    appendLog('暂无可复制的图片。');
    return;
  }

  const targetUrl = results[0].url;
  if (!targetUrl) {
    appendLog('未找到可复制的图片链接。');
    return;
  }

  if (!navigator.clipboard || typeof window.ClipboardItem === 'undefined') {
    appendLog('当前浏览器不支持图片复制，请尝试手动保存。');
    return;
  }

  try {
    const response = await fetch(targetUrl);
    const blob = await response.blob();
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    appendLog('图片已复制到剪贴板。');
  } catch (error) {
    appendLog('复制图片失败，请尝试手动下载。');
  }
};

form.addEventListener('submit', submitForm);
resetBtn.addEventListener('click', resetForm);
copyImageBtn.addEventListener('click', copyImage);
setupDropzone();

featureButtons.forEach((btn) => {
  btn.addEventListener('click', () => setFeature(btn.dataset.feature));
});

featureShortcuts.forEach((card) => {
  card.addEventListener('click', () => setFeature(card.dataset.featureTarget));
});

setFeature('home');

appendLog('准备就绪，填写提示词即可开始生成。');

if (chatForm) {
  renderChatLog();
  chatForm.addEventListener('submit', sendChat);
}

if (chatClear) {
  chatClear.addEventListener('click', clearChat);
}

if (apiKeyForm) {
  fetchApiKeys();
  apiKeyForm.addEventListener('submit', submitApiKey);
}

fetchProfile();
