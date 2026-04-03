(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // background.ts
  var require_background = __commonJS({
    "background.ts"(exports, module) {
      var EXTENSION_ID = "coworker-browser-control";
      var NATIVE_HOST_NAME = "com.coworker.chrome_native_host";
      var MAX_MESSAGE_SIZE = 1024 * 1024;
      var consoleMessages = [];
      var MAX_CONSOLE_MESSAGES = 1e3;
      var nativePort = null;
      var nativeConnected = false;
      function connectToNativeHost() {
        try {
          nativePort = chrome.runtime.connectNative(NATIVE_HOST_NAME);
          nativeConnected = true;
          console.log("[CoWorker] Connected to native host");
          nativePort.onMessage.addListener((message) => {
            const msg = message;
            if (msg.type === "tool_response" || msg.type === "status_response") {
            }
          });
          nativePort.onDisconnect.addListener(() => {
            console.log("[CoWorker] Disconnected from native host");
            nativeConnected = false;
            nativePort = null;
            setTimeout(connectToNativeHost, 5e3);
          });
        } catch (error) {
          console.log("[CoWorker] Failed to connect to native host:", error);
          nativeConnected = false;
          setTimeout(connectToNativeHost, 5e3);
        }
      }
      function sendToNativeHost(message) {
        if (nativePort && nativeConnected) {
          try {
            nativePort.postMessage(message);
          } catch (error) {
            console.log("[CoWorker] Failed to send to native host:", error);
          }
        }
      }
      async function handleToolRequestNative(request2) {
        return new Promise((resolve) => {
          if (!nativePort || !nativeConnected) {
            resolve({ success: false, error: "Not connected to native host" });
            return;
          }
          const responseHandler = (message) => {
            const msg = message;
            if (msg.success !== void 0) {
              nativePort?.onMessage.removeListener(responseHandler);
              resolve(msg);
            }
          };
          nativePort.onMessage.addListener(responseHandler);
          sendToNativeHost({ type: "tool_request", ...request2 });
          setTimeout(() => {
            nativePort?.onMessage.removeListener(responseHandler);
            resolve({ success: false, error: "Request timeout" });
          }, 3e4);
        });
      }
      function addConsoleMessage(msg) {
        consoleMessages.push(msg);
        if (consoleMessages.length > MAX_CONSOLE_MESSAGES) {
          consoleMessages.shift();
        }
      }
      async function handleToolRequest(request) {
        if (nativeConnected && nativePort) {
          try {
            return await handleToolRequestNative(request);
          } catch (error) {
            console.log("[CoWorker] Native host failed, falling back to local:", error);
          }
        }
        const { method, params } = request;
        try {
          switch (method) {
            case "tabs_list": {
              const tabs = await chrome.tabs.query(params);
              return {
                success: true,
                result: tabs.map((tab) => ({
                  id: tab.id,
                  url: tab.url || "",
                  title: tab.title || "",
                  active: tab.active,
                  windowId: tab.windowId
                }))
              };
            }
            case "tabs_create": {
              const tab = await chrome.tabs.create(params);
              return {
                success: true,
                result: {
                  id: tab.id,
                  url: tab.url,
                  title: tab.title,
                  active: tab.active,
                  windowId: tab.windowId
                }
              };
            }
            case "tabs_get": {
              const tab = await chrome.tabs.get(params);
              return {
                success: true,
                result: tab ? {
                  id: tab.id,
                  url: tab.url,
                  title: tab.title,
                  active: tab.active,
                  windowId: tab.windowId
                } : null
              };
            }
            case "tabs_update": {
              const [tab] = await chrome.tabs.update(params);
              return {
                success: true,
                result: tab ? {
                  id: tab.id,
                  url: tab.url,
                  title: tab.title,
                  active: tab.active,
                  windowId: tab.windowId
                } : null
              };
            }
            case "tabs_close": {
              await chrome.tabs.remove(params);
              return { success: true };
            }
            case "tabs_reload": {
              await chrome.tabs.reload(params);
              return { success: true };
            }
            case "tabs_go_back": {
              const [tab] = await chrome.tabs.goBack(params);
              return { success: true, result: tab };
            }
            case "tabs_go_forward": {
              const [tab] = await chrome.tabs.goForward(params);
              return { success: true, result: tab };
            }
            case "console_read": {
              const { pattern, limit } = params || {};
              let filtered = consoleMessages;
              if (pattern) {
                const regex = new RegExp(pattern);
                filtered = filtered.filter((m) => regex.test(m.message));
              }
              const final = filtered.slice(-(limit || 100));
              return { success: true, result: final };
            }
            case "console_clear": {
              consoleMessages.length = 0;
              return { success: true };
            }
            case "script_execute": {
              const { tabId: tabId2, code: code2, args } = params;
              const results2 = await chrome.scripting.executeScript({
                target: tabId2 ? { tabId: tabId2 } : { all: true },
                func: new Function("args", code2)(args)
              });
              return {
                success: true,
                result: results2.map((r) => r.result)
              };
            }
            case "script_insert": {
              const { tabId, code, css } = params;
              const injectionResults = [];
              if (code) {
                const results = await chrome.scripting.executeScript({
                  target: tabId ? { tabId } : { all: true },
                  func: () => {
                    eval(code);
                  }
                });
                injectionResults.push(...results.map((r) => r.result));
              }
              if (css) {
                const results2 = await chrome.scripting.insertCSS({
                  target: tabId ? { tabId } : { all: true },
                  css
                });
                injectionResults.push(results2);
              }
              return { success: true, result: injectionResults };
            }
            case "screenshot": {
              const { tabId: tabId2, format, quality } = params;
              const targetTabId = tabId2 || (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
              if (!targetTabId) {
                return { success: false, error: "No active tab found" };
              }
              const dataUrl = await chrome.tabs.captureVisibleTab(targetTabId, {
                format: format || "png",
                quality: quality || 100
              });
              return { success: true, result: { dataUrl } };
            }
            case "cookies_get": {
              const { url, name } = params;
              const cookies = await chrome.cookies.get({ url, name });
              return { success: true, result: cookies };
            }
            case "cookies_set": {
              const cookie = await chrome.cookies.set(params);
              return { success: true, result: cookie };
            }
            case "cookies_delete": {
              const { url, name } = params;
              await chrome.cookies.remove({ url, name });
              return { success: true };
            }
            case "storage_get": {
              const { keys } = params;
              const data = await chrome.storage.local.get(keys);
              return { success: true, result: data };
            }
            case "storage_set": {
              await chrome.storage.local.set(params);
              return { success: true };
            }
            case "storage_delete": {
              const { keys } = params;
              await chrome.storage.local.remove(keys);
              return { success: true };
            }
            case "get_status": {
              return {
                success: true,
                result: {
                  extensionId: EXTENSION_ID,
                  version: "1.0.0",
                  connected: true
                }
              };
            }
            default:
              return { success: false, error: `Unknown method: ${method}` };
          }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
      function setupConsoleListener() {
        chrome.tabs.onCreated.addListener((tab) => {
          addConsoleMessage({
            type: "info",
            message: `Tab created: ${tab.id} - ${tab.title}`,
            timestamp: Date.now(),
            source: "extension"
          });
        });
        chrome.tabs.onRemoved.addListener((tabId2) => {
          addConsoleMessage({
            type: "info",
            message: `Tab closed: ${tabId2}`,
            timestamp: Date.now(),
            source: "extension"
          });
        });
        chrome.tabs.onUpdated.addListener((tabId2, changeInfo, tab) => {
          if (changeInfo.url) {
            addConsoleMessage({
              type: "info",
              message: `Tab ${tabId2} navigated to: ${changeInfo.url}`,
              timestamp: Date.now(),
              source: "extension"
            });
          }
        });
      }
      setupConsoleListener();
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === "tool_request") {
          handleToolRequest(message).then((response) => sendResponse(response)).catch((error) => sendResponse({ success: false, error: error.message }));
          return true;
        }
        if (message.type === "ping") {
          sendResponse({ type: "pong", timestamp: Date.now() });
          return false;
        }
        if (message.type === "get_status") {
          handleToolRequest({ method: "get_status" }).then((response) => sendResponse(response)).catch((error) => sendResponse({ success: false, error: error.message }));
          return true;
        }
        return false;
      });
      chrome.runtime.onConnectExternal.addListener((port) => {
        if (port.name === "coworker-mcp") {
          port.onMessage.addListener(async (message) => {
            if (message.type === "tool_request") {
              const response = await handleToolRequest(message);
              port.postMessage(response);
            }
          });
        }
      });
      connectToNativeHost();
    }
  });
  require_background();
})();
