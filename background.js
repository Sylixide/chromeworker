const EXTENSION_ID = 'coworker-browser-control';
const MAX_MESSAGE_SIZE = 1024 * 1024;
const consoleMessages = [];
const MAX_CONSOLE_MESSAGES = 1000;
function addConsoleMessage(msg) {
    consoleMessages.push(msg);
    if (consoleMessages.length > MAX_CONSOLE_MESSAGES) {
        consoleMessages.shift();
    }
}
async function handleToolRequest(request) {
    const { method, params } = request;
    try {
        switch (method) {
            case 'tabs_list': {
                const tabs = await chrome.tabs.query(params);
                return {
                    success: true,
                    result: tabs.map((tab) => ({
                        id: tab.id,
                        url: tab.url || '',
                        title: tab.title || '',
                        active: tab.active,
                        windowId: tab.windowId,
                    })),
                };
            }
            case 'tabs_create': {
                const tab = await chrome.tabs.create(params);
                return {
                    success: true,
                    result: {
                        id: tab.id,
                        url: tab.url,
                        title: tab.title,
                        active: tab.active,
                        windowId: tab.windowId,
                    },
                };
            }
            case 'tabs_get': {
                const tab = await chrome.tabs.get(params);
                return {
                    success: true,
                    result: tab ? {
                        id: tab.id,
                        url: tab.url,
                        title: tab.title,
                        active: tab.active,
                        windowId: tab.windowId,
                    } : null,
                };
            }
            case 'tabs_update': {
                const [tab] = await chrome.tabs.update(params);
                return {
                    success: true,
                    result: tab ? {
                        id: tab.id,
                        url: tab.url,
                        title: tab.title,
                        active: tab.active,
                        windowId: tab.windowId,
                    } : null,
                };
            }
            case 'tabs_close': {
                await chrome.tabs.remove(params);
                return { success: true };
            }
            case 'tabs_reload': {
                await chrome.tabs.reload(params);
                return { success: true };
            }
            case 'tabs_go_back': {
                const [tab] = await chrome.tabs.goBack(params);
                return { success: true, result: tab };
            }
            case 'tabs_go_forward': {
                const [tab] = await chrome.tabs.goForward(params);
                return { success: true, result: tab };
            }
            case 'console_read': {
                const { pattern, limit } = params || {};
                let filtered = consoleMessages;
                if (pattern) {
                    const regex = new RegExp(pattern);
                    filtered = filtered.filter(m => regex.test(m.message));
                }
                const final = filtered.slice(-(limit || 100));
                return { success: true, result: final };
            }
            case 'console_clear': {
                consoleMessages.length = 0;
                return { success: true };
            }
            case 'script_execute': {
                const { tabId, code, args } = params;
                const results = await chrome.scripting.executeScript({
                    target: tabId ? { tabId } : { all: true },
                    func: new Function('args', code)(args),
                });
                return {
                    success: true,
                    result: results.map(r => r.result),
                };
            }
            case 'script_insert': {
                const { tabId, code, css } = params;
                const injectionResults = [];
                if (code) {
                    const results = await chrome.scripting.executeScript({
                        target: tabId ? { tabId } : { all: true },
                        func: () => {
                            eval(code);
                        },
                    });
                    injectionResults.push(...results.map(r => r.result));
                }
                if (css) {
                    const results = await chrome.scripting.insertCSS({
                        target: tabId ? { tabId } : { all: true },
                        css,
                    });
                    injectionResults.push(results);
                }
                return { success: true, result: injectionResults };
            }
            case 'screenshot': {
                const { tabId, format, quality } = params;
                const targetTabId = tabId || (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
                if (!targetTabId) {
                    return { success: false, error: 'No active tab found' };
                }
                const dataUrl = await chrome.tabs.captureVisibleTab(targetTabId, {
                    format: format || 'png',
                    quality: quality || 100,
                });
                return { success: true, result: { dataUrl } };
            }
            case 'cookies_get': {
                const { url, name } = params;
                const cookies = await chrome.cookies.get({ url, name });
                return { success: true, result: cookies };
            }
            case 'cookies_set': {
                const cookie = await chrome.cookies.set(params);
                return { success: true, result: cookie };
            }
            case 'cookies_delete': {
                const { url, name } = params;
                await chrome.cookies.remove({ url, name });
                return { success: true };
            }
            case 'storage_get': {
                const { keys } = params;
                const data = await chrome.storage.local.get(keys);
                return { success: true, result: data };
            }
            case 'storage_set': {
                await chrome.storage.local.set(params);
                return { success: true };
            }
            case 'storage_delete': {
                const { keys } = params;
                await chrome.storage.local.remove(keys);
                return { success: true };
            }
            case 'computer':
            case 'find':
            case 'form_input':
            case 'gif_creator':
            case 'read_page':
            case 'upload_image':
                return { success: false, error: `${method} is not yet fully implemented via CDP in chromeworker.` };
            case 'get_page_text': {
                const { tabId } = params;
                const results = await chrome.scripting.executeScript({
                    target: { tabId },
                    func: () => document.body.innerText || document.documentElement.innerText,
                });
                return { success: true, result: results[0]?.result };
            }
            case 'network_read': {
                return { success: true, result: [] }; // Stub
            }
            case 'resize_window': {
                const { tabId, width, height } = params;
                const tab = await chrome.tabs.get(tabId);
                if (tab.windowId) {
                    await chrome.windows.update(tab.windowId, { width, height });
                }
                return { success: true };
            }
            case 'get_status': {
                return {
                    success: true,
                    result: {
                        extensionId: EXTENSION_ID,
                        version: '1.0.0',
                        connected: true,
                    },
                };
            }
            default:
                return { success: false, error: `Unknown method: ${method}` };
        }
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
function setupConsoleListener() {
    chrome.tabs.onCreated.addListener((tab) => {
        addConsoleMessage({
            type: 'info',
            message: `Tab created: ${tab.id} - ${tab.title}`,
            timestamp: Date.now(),
            source: 'extension',
        });
    });
    chrome.tabs.onRemoved.addListener((tabId) => {
        addConsoleMessage({
            type: 'info',
            message: `Tab closed: ${tabId}`,
            timestamp: Date.now(),
            source: 'extension',
        });
    });
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.url) {
            addConsoleMessage({
                type: 'info',
                message: `Tab ${tabId} navigated to: ${changeInfo.url}`,
                timestamp: Date.now(),
                source: 'extension',
            });
        }
    });
}
setupConsoleListener();
let nativePort = null;
let isNativeConnected = false;
function connectToNativeHost() {
    if (nativePort)
        return;
    console.log('[CoWorker] Attempting to connect to native host...');
    try {
        nativePort = chrome.runtime.connectNative('com.coworker.chrome_native_host');
        nativePort.onMessage.addListener(async (message) => {
            console.log('[CoWorker] Received message from native host:', message);
            if (message.type === 'tool_request') {
                const response = await handleToolRequest(message);
                if (nativePort) {
                    nativePort.postMessage({
                        type: 'tool_response',
                        success: response.success,
                        result: response.result,
                        error: response.error
                    });
                }
            }
        });
        nativePort.onDisconnect.addListener(() => {
            console.log('[CoWorker] Disconnected from native host:', chrome.runtime.lastError?.message);
            nativePort = null;
            isNativeConnected = false;
            // Reconnect after 5 seconds
            setTimeout(connectToNativeHost, 5000);
        });
        isNativeConnected = true;
        console.log('[CoWorker] Connected to native host successfully.');
    }
    catch (err) {
        console.error('[CoWorker] Failed to connect to native host:', err);
        nativePort = null;
        isNativeConnected = false;
    }
}
// Initial connect
connectToNativeHost();
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'tool_request') {
        handleToolRequest(message)
            .then(response => sendResponse(response))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
    if (message.type === 'ping') {
        sendResponse({ type: 'pong', timestamp: Date.now() });
        return false;
    }
    if (message.type === 'get_status') {
        handleToolRequest({ method: 'get_status' })
            .then(response => {
            // Override connected status with real native connection status
            if (response.success && response.result) {
                response.result.connected = isNativeConnected;
            }
            sendResponse(response);
        })
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
    return false;
});
chrome.runtime.onConnectExternal.addListener((port) => {
    if (port.name === 'coworker-mcp') {
        port.onMessage.addListener(async (message) => {
            if (message.type === 'tool_request') {
                const response = await handleToolRequest(message);
                port.postMessage(response);
            }
        });
    }
});
