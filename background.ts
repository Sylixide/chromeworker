const EXTENSION_ID = 'coworker-browser-control';
const MAX_MESSAGE_SIZE = 1024 * 1024;

interface ToolRequest {
  method: string;
  params?: unknown;
}

interface ToolResponse {
  success: boolean;
  result?: unknown;
  error?: string;
}

interface TabInfo {
  id: number;
  url: string;
  title: string;
  active: boolean;
  windowId: number;
}

interface ConsoleMessage {
  type: 'log' | 'warn' | 'error' | 'info' | 'debug';
  message: string;
  timestamp: number;
  source: string;
  line?: number;
  column?: number;
}

const consoleMessages: ConsoleMessage[] = [];
const MAX_CONSOLE_MESSAGES = 1000;

function addConsoleMessage(msg: ConsoleMessage): void {
  consoleMessages.push(msg);
  if (consoleMessages.length > MAX_CONSOLE_MESSAGES) {
    consoleMessages.shift();
  }
}

async function handleToolRequest(request: ToolRequest): Promise<ToolResponse> {
  const { method, params } = request;

  try {
    switch (method) {
      case 'tabs_list': {
        const tabs = await chrome.tabs.query(params as chrome.tabs.QueryInfo | undefined);
        return {
          success: true,
          result: tabs.map((tab): TabInfo => ({
            id: tab.id!,
            url: tab.url || '',
            title: tab.title || '',
            active: tab.active,
            windowId: tab.windowId,
          })),
        };
      }

      case 'tabs_create': {
        const tab = await chrome.tabs.create(params as chrome.tabs.CreateProperties);
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
        const tab = await chrome.tabs.get(params as number);
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
        const [tab] = await chrome.tabs.update(params as chrome.tabs.UpdateProperties);
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
        await chrome.tabs.remove(params as number);
        return { success: true };
      }

      case 'tabs_reload': {
        await chrome.tabs.reload(params as number);
        return { success: true };
      }

      case 'tabs_go_back': {
        const [tab] = await chrome.tabs.goBack(params as number);
        return { success: true, result: tab };
      }
      
      case 'tabs_go_forward': {
        const [tab] = await chrome.tabs.goForward(params as number);
        return { success: true, result: tab };
      }

      case 'console_read': {
        const { pattern, limit } = (params as { pattern?: string; limit?: number }) || {};
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
        const { tabId, code, args } = params as {
          tabId?: number;
          code: string;
          args?: unknown[];
        };
        
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
        const { tabId, code, css } = params as {
          tabId?: number;
          code?: string;
          css?: string;
        };
        
        const injectionResults: unknown[] = [];
        
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
        const { tabId, format, quality } = params as {
          tabId?: number;
          format?: 'png' | 'jpeg';
          quality?: number;
        };
        
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
        const { url, name } = params as { url: string; name?: string };
        const cookies = await chrome.cookies.get({ url, name });
        return { success: true, result: cookies };
      }

      case 'cookies_set': {
        const cookie = await chrome.cookies.set(params as chrome.cookies.Cookie);
        return { success: true, result: cookie };
      }

      case 'cookies_delete': {
        const { url, name } = params as { url: string; name: string };
        await chrome.cookies.remove({ url, name });
        return { success: true };
      }

      case 'storage_get': {
        const { keys } = params as { keys?: string | string[] };
        const data = await chrome.storage.local.get(keys);
        return { success: true, result: data };
      }

      case 'storage_set': {
        await chrome.storage.local.set(params as Record<string, unknown>);
        return { success: true };
      }

      case 'storage_delete': {
        const { keys } = params as { keys: string | string[] };
        await chrome.storage.local.remove(keys);
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
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function setupConsoleListener(): void {
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'tool_request') {
    handleToolRequest(message as ToolRequest)
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
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  return false;
});

chrome.runtime.onConnectExternal.addListener((port) => {
  if (port.name === 'coworker-mcp') {
    port.onMessage.addListener(async (message) => {
      if (message.type === 'tool_request') {
        const response = await handleToolRequest(message as ToolRequest);
        port.postMessage(response);
      }
    });
  }
});
