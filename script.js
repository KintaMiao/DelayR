const delay = (ms, factor = 1) => new Promise(resolve => setTimeout(resolve, ms * factor));

let config = null;
let isTestingActive = false;
let activeControllers = [];
let redirectTimer = null;

async function loadConfig() {
    try {
        // 检查依赖
        if (typeof jsyaml === 'undefined') {
            throw new Error('jsyaml 未加载');
        }
        
        const response = await fetch('config.yaml');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const yamlText = await response.text();
        return jsyaml.load(yamlText);
    } catch (error) {
        console.error('加载配置失败:', error);
        throw error;
    }
}

async function updateUIFromConfig() {
    if (!config || !config.site || !config.ui) {
        throw new Error("配置信息缺失");
    }
    
    // 使用安全的 DOM 更新方法
    const updateElement = (id, value, property = 'textContent') => {
        const element = document.getElementById(id);
        if (element) {
            element[property] = value;
        } else {
            console.warn(`Element ${id} not found`);
        }
    };
    
    updateElement('site-title', config.site.title);
    updateElement('site-description', config.site.description, 'content');
    updateElement('site-heading', config.site.title);
    updateElement('result-text', config.ui.testingText);
    document.title = config.site.title;
}

function stopTesting() {
    isTestingActive = false;
    // 中止所有控制器并清理
    activeControllers.forEach(controller => {
        try {
            controller.abort();
        } catch (error) {
            console.warn('中止控制器失败:', error);
        }
    });
    activeControllers = [];
    
    if (redirectTimer) {
        clearTimeout(redirectTimer);
        redirectTimer = null;
    }
    
    const stopBtn = document.getElementById('stop-btn');
    if (stopBtn) {
        stopBtn.style.display = 'none';
    }
    
    const resultText = document.getElementById('result-text');
    if (resultText) {
        resultText.textContent = '测试已停止';
    }
}

window.onload = async function init() {
    try {
        isTestingActive = true; // 重置测试状态
        config = await loadConfig();
        await updateUIFromConfig();
        await testAllCDNs(); // 假设这个函数存在
    } catch (err) {
        console.error("初始化失败: ", err);
        const resultElement = document.getElementById('result-text');
        if (resultElement) {
            resultElement.innerHTML = `
                <span class="status-error">配置加载失败</span>
                <button id="retry-btn" onclick="init()">重试</button>
            `;
        }
        isTestingActive = false;
    }
};

async function measureLatency(url, timeout = config.speedtest.timeout) {
    const attempts = config.speedtest.attempts;
    const maxRetries = config.speedtest.maxRetries;
    let totalLatency = 0;
    let successCount = 0;

    const controller = new AbortController();
    activeControllers.push(controller);

    for (let i = 0; i < attempts; i++) {
        if (!isTestingActive) return Infinity;
        for (let retry = 0; retry <= maxRetries; retry++) {
            if (!isTestingActive) return Infinity;
            const signal = controller.signal;
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            try {
                const start = performance.now();
                const response = await fetch(url + '?' + Date.now(), {
                    method: 'GET',
                    cache: 'no-store',
                    signal,
                    mode: 'no-cors',
                    credentials: 'omit'
                });

                await response.blob();
                
                const end = performance.now();
                clearTimeout(timeoutId);
                totalLatency += (end - start);
                successCount++;
                break;
            } catch (error) {
                clearTimeout(timeoutId);
                console.warn(`CDN测试失败 (${retry + 1}/${maxRetries + 1}):`, error);
                
                if (retry < maxRetries) {
                    await delay(Math.min(1000 * Math.pow(2, retry), 5000));
                    continue;
                }
            }
        }
    }

    const index = activeControllers.indexOf(controller);
    if (index > -1) {
        activeControllers.splice(index, 1);
    }

    return successCount > 0 ? totalLatency / successCount : Infinity;
}

async function testAllCDNs() {
    if (!config || !Array.isArray(config.cdnEndpoints) || config.cdnEndpoints.length === 0) {
        console.error("CDN 配置无效");
        return;
    }

    isTestingActive = true;
    document.getElementById('stop-btn').style.display = 'inline-block';

    const results = document.getElementById('test-results');
    const resultText = document.getElementById('result-text');
    const progressBar = document.querySelector('.progress-fill');
    
    results.innerHTML = '';
    progressBar.style.width = '0%';
    
    let cdnResults = [];
    let completedTests = 0;
    const totalTests = config.cdnEndpoints.length;

    const updateProgress = () => {
        const progress = (completedTests / totalTests) * 100;
        progressBar.style.width = `${progress}%`;
    };

    const testPromises = config.cdnEndpoints.map(async (cdn) => {
        if (!isTestingActive) return;

        const resultElement = document.createElement('div');
        resultElement.className = 'test-result testing';
        resultElement.innerHTML = `
            <span class="cdn-name">
                <span class="pulse-dot"></span>
                ${cdn.name}
            </span>
            <span class="latency">测试中...</span>
        `;
        results.appendChild(resultElement);
        
        const latency = await measureLatency(cdn.url);
        cdnResults.push({ cdn, latency });
        
        completedTests++;
        updateProgress();
        
        resultElement.classList.remove('testing');
        const latencySpan = resultElement.querySelector('.latency');
        if (latency === Infinity) {
            latencySpan.innerHTML = `<span class="error">${config.ui.connectErrorText}</span>`;
            resultElement.classList.add('failed');
        } else {
            latencySpan.innerHTML = `${Math.round(latency)}ms`;
            resultElement.classList.add('success');
        }
    });

    await Promise.all(testPromises);

    if (!isTestingActive) return;

    document.getElementById('stop-btn').style.display = 'none';
    const validResults = cdnResults.filter(result => result.latency !== Infinity);
    if (validResults.length > 0) {
        const bestResult = validResults.reduce((a, b) => a.latency < b.latency ? a : b);
        
        resultText.innerHTML = `
            <span class="status-success">${config.ui.bestRouteText} ${bestResult.cdn.name} (${Math.round(bestResult.latency)}ms)</span>
            <button id="retry-btn" onclick="testAllCDNs()">${config.ui.retryText}</button>
        `;
        
        redirect(bestResult.cdn.url);
    } else {
        resultText.innerHTML = `
            <span class="status-error">${config.ui.allFailedText}</span>
            <button id="retry-btn" onclick="testAllCDNs()">${config.ui.retryText}</button>
        `;
    }
}

async function redirect(url) {
    try {
        const testUrl = new URL(url);
        redirectTimer = setTimeout(() => {
            window.location.href = url;
        }, config.speedtest.redirectDelay);
    } catch(e) {
        console.error("无效的重定向URL:", e);
        document.getElementById('result-text').innerHTML = `
            <span class="status-error">重定向失败</span>
            <button id="retry-btn" onclick="testAllCDNs()">重试</button>
        `;
    }
}

const debounce = (fn, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
};

const debouncedTestAllCDNs = debounce(testAllCDNs, 1000);