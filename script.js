const delay = (ms, factor = 1) => new Promise(resolve => setTimeout(resolve, ms * factor));

async function loadConfig() {
    const response = await fetch('config.yaml');
    const yamlText = await response.text();
    return jsyaml.load(yamlText);
}

async function updateUIFromConfig() {
    document.title = config.site.title;
    document.getElementById('site-description').content = config.site.description;
    document.getElementById('site-heading').textContent = config.site.title;
    document.getElementById('result-text').textContent = config.ui.testingText;
}

let config;

async function init() {
    config = await loadConfig();
    await updateUIFromConfig();
    await testAllCDNs();
}

async function measureLatency(url, timeout = config.speedtest.timeout) {
    const attempts = config.speedtest.attempts;
    const maxRetries = config.speedtest.maxRetries;
    let totalLatency = 0;
    let successCount = 0;

    for (let i = 0; i < attempts; i++) {
        for (let retry = 0; retry <= maxRetries; retry++) {
            const controller = new AbortController();
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

    return successCount > 0 ? totalLatency / successCount : Infinity;
}

async function testAllCDNs() {
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

    const validResults = cdnResults.filter(result => result.latency !== Infinity);
    if (validResults.length > 0) {
        const bestResult = validResults.reduce((a, b) => a.latency < b.latency ? a : b);
        
        resultText.innerHTML = `
            <span class="status-success">${config.ui.bestRouteText} ${bestResult.cdn.name} (${Math.round(bestResult.latency)}ms)</span>
            <button id="retry-btn" onclick="testAllCDNs()">${config.ui.retryText}</button>
        `;
        
        setTimeout(() => {
            window.location.href = bestResult.cdn.url;
        }, 2000);
    } else {
        resultText.innerHTML = `
            <span class="status-error">所有线路测试失败</span>
            <button id="retry-btn" onclick="testAllCDNs()">${config.ui.retryText}</button>
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

window.onload = init;