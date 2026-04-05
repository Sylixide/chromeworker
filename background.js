(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // background.ts
  var require_background = __commonJS({
    "background.ts"(exports, module) {
      var EXTENSION_ID = "coworker-browser-control";
      var MAX_MESSAGE_SIZE = 1024 * 1024;
      var attachedDebuggers = /* @__PURE__ */ new Set();
      async function attachDebugger(tabId2) {
        if (attachedDebuggers.has(tabId2)) return;
        const targets = await chrome.debugger.getTargets();
        const target = targets.find((t) => t.tabId === tabId2);
        if (target?.attached) {
          attachedDebuggers.add(tabId2);
          return;
        }
        await chrome.debugger.attach({ tabId: tabId2 }, "1.3");
        attachedDebuggers.add(tabId2);
      }
      chrome.debugger.onDetach.addListener((source) => {
        if (source.tabId) attachedDebuggers.delete(source.tabId);
      });
      var consoleMessages = [];
      var MAX_CONSOLE_MESSAGES = 1e3;
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
            case "computer": {
              const { action, coordinate, text, tabId: tabId2 } = params;
              const targetTabId = tabId2 || (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
              if (!targetTabId) return { success: false, error: "No tab specified" };
              await attachDebugger(targetTabId);
              try {
                if (action === "left_click" || action === "right_click" || action === "double_click") {
                  if (!coordinate || coordinate.length !== 2) return { success: false, error: "Missing coordinate" };
                  const button = action === "right_click" ? "right" : "left";
                  const clickCount = action === "double_click" ? 2 : 1;
                  await chrome.debugger.sendCommand({ tabId: targetTabId }, "Input.dispatchMouseEvent", {
                    type: "mousePressed",
                    x: coordinate[0],
                    y: coordinate[1],
                    button,
                    clickCount
                  });
                  await chrome.debugger.sendCommand({ tabId: targetTabId }, "Input.dispatchMouseEvent", {
                    type: "mouseReleased",
                    x: coordinate[0],
                    y: coordinate[1],
                    button,
                    clickCount
                  });
                } else if (action === "type") {
                  if (!text) return { success: false, error: "Missing text" };
                  await chrome.scripting.executeScript({
                    target: { tabId: targetTabId },
                    func: (t) => {
                      document.execCommand("insertText", false, t);
                    },
                    args: [text]
                  });
                } else if (action === "key") {
                  await chrome.debugger.sendCommand({ tabId: targetTabId }, "Input.dispatchKeyEvent", {
                    type: "keyDown",
                    commands: [text]
                  });
                  await chrome.debugger.sendCommand({ tabId: targetTabId }, "Input.dispatchKeyEvent", {
                    type: "keyUp",
                    commands: [text]
                  });
                } else if (action === "scroll") {
                  const { scroll_amount, scroll_direction } = params;
                  const delta = (scroll_amount || 1) * 100;
                  await chrome.scripting.executeScript({
                    target: { tabId: targetTabId },
                    func: (dir, d) => {
                      if (dir === "down") window.scrollBy(0, d);
                      if (dir === "up") window.scrollBy(0, -d);
                    },
                    args: [scroll_direction || "down", delta]
                  });
                }
                return { success: true };
              } catch (error) {
                return { success: false, error: String(error) };
              }
            }
            case "find":
            case "gif_creator":
            case "upload_image":
              return { success: false, error: `${method} is not yet fully implemented via CDP in chromeworker.` };
            case "read_page": {
              const { tabId: tabId2 } = params;
              const targetTabId = tabId2 || (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
              const results2 = await chrome.scripting.executeScript({
                target: { tabId: targetTabId },
                func: () => {
                  const interactiveSelectors = 'a, button, input, select, textarea, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])';
                  const elements = document.querySelectorAll(interactiveSelectors);
                  let mapOut = "Interactive Elements Map:\\n";
                  let refId = 1;
                  window.__coworker_element_map = /* @__PURE__ */ new Map();
                  elements.forEach((el) => {
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.top <= (window.innerHeight || document.documentElement.clientHeight)) {
                      const text = (el.textContent || el.value || el.getAttribute("aria-label") || "").trim().substring(0, 50);
                      if (text || el.tagName === "INPUT") {
                        const id = `ref_${refId++}`;
                        window.__coworker_element_map.set(id, el);
                        const center = [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)];
                        mapOut += `[${id}] <${el.tagName.toLowerCase()}> "${text.replace(/\n/g, " ")}" at ${JSON.stringify(center)}
`;
                      }
                    }
                  });
                  return mapOut;
                }
              });
              return { success: true, result: results2[0]?.result };
            }
            case "form_input": {
              const { tabId: tabId2, ref, value } = params;
              const targetTabId = tabId2 || (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
              const results2 = await chrome.scripting.executeScript({
                target: { tabId: targetTabId },
                func: (r, v) => {
                  const map = window.__coworker_element_map;
                  if (!map || !map.has(r)) return "Element reference not found. Run read_page first.";
                  const el = map.get(r);
                  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") {
                    el.value = v;
                    el.dispatchEvent(new Event("change", { bubbles: true }));
                    el.dispatchEvent(new Event("input", { bubbles: true }));
                    return `Filled ${r} with ${v}`;
                  }
                  return "Element is not a form input";
                },
                args: [ref, value]
              });
              return { success: !!results2[0]?.result && !String(results2[0].result).includes("not found"), result: results2[0]?.result };
            }
            case "get_page_text": {
              const { tabId: tabId2 } = params;
              const results2 = await chrome.scripting.executeScript({
                target: { tabId: tabId2 },
                func: () => document.body.innerText || document.documentElement.innerText
              });
              return { success: true, result: results2[0]?.result };
            }
            case "network_read": {
              return { success: true, result: [] };
            }
            case "resize_window": {
              const { tabId: tabId2, width, height } = params;
              const tab = await chrome.tabs.get(tabId2);
              if (tab.windowId) {
                await chrome.windows.update(tab.windowId, { width, height });
              }
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
      var ws = null;
      var isNativeConnected = false;
      var SYLIX_BACKEND_URL = "wss://api.sylixide.com/ws/extension?token=default-desktop-token";
      function connectToSylixBackend() {
        if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;
        console.log("[CoWorker] Attempting to connect to Sylix backend WebSocket...");
        try {
          ws = new WebSocket(SYLIX_BACKEND_URL);
          ws.onopen = () => {
            console.log("[CoWorker] Connected to Sylix backend successfully.");
            isNativeConnected = true;
          };
          ws.onmessage = async (event) => {
            try {
              const message = JSON.parse(event.data);
              console.log("[CoWorker] Received message from backend:", message);
              if (message.type === "tool_request" && message.id) {
                const response = await handleToolRequest(message);
                if (ws && ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({
                    type: "tool_response",
                    id: message.id,
                    success: response.success,
                    result: response.result,
                    error: response.error
                  }));
                }
              }
            } catch (e) {
              console.error("[CoWorker] Failed to handle WebSocket message:", e);
            }
          };
          ws.onclose = (event) => {
            console.log("[CoWorker] Disconnected from Sylix backend:", event.reason);
            ws = null;
            isNativeConnected = false;
            setTimeout(connectToSylixBackend, 5e3);
          };
          ws.onerror = (err) => {
            console.error("[CoWorker] WebSocket error:", err);
            try {
              ws?.close();
            } catch (e) {
            }
          };
        } catch (err) {
          console.error("[CoWorker] Failed to connect to Sylix backend:", err);
          ws = null;
          isNativeConnected = false;
          setTimeout(connectToSylixBackend, 5e3);
        }
      }
      connectToSylixBackend();
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
          handleToolRequest({ method: "get_status" }).then((response) => {
            if (response.success && response.result) {
              response.result.connected = isNativeConnected;
            }
            sendResponse(response);
          }).catch((error) => sendResponse({ success: false, error: error.message }));
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
    }
  });
  require_background();
})();
