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
const copyJsonBtn = document.getElementById('copyJson');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');

let currentId = '';
let lastResponse = null;
let pollTimer = null;
let referenceFiles = [];

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
    const converted = await filesToDataUrls(files);
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

const copyJson = async () => {
  if (!lastResponse) {
    appendLog('暂无可复制的响应。');
    return;
  }
  const text = JSON.stringify(lastResponse, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    appendLog('JSON 已复制到剪贴板。');
  } catch {
    appendLog('复制失败，请手动复制。');
  }
};

form.addEventListener('submit', submitForm);
resetBtn.addEventListener('click', resetForm);
copyJsonBtn.addEventListener('click', copyJson);
setupDropzone();

appendLog('准备就绪，填写提示词即可开始生成。');
