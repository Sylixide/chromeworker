# CoWorker Chrome Extension

Browser automation extension for CoWorker CLI - enables full Chrome browser control via MCP (Model Context Protocol).

## Installation

### Option 1: Pre-built .crx (Recommended)

1. Download `chromeworker.crx` from the [Releases](https://github.com/Sylixide/chromeworker/releases) page
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Drag and drop the `chromeworker.crx` file onto the extensions page

### Option 2: Load Unpacked

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked** and select the `chromeworker` folder

## Usage

Once installed, use with CoWorker CLI:

```bash
coworker --chrome-extension
```

Or set the environment variable:

```bash
export COWORKER_ENABLE_CHROME_EXTENSION=true
coworker
```

## Features

- **Tab Management** - List, create, update, close, reload tabs
- **Script Injection** - Execute JavaScript in any tab
- **Cookie Control** - Get, set, and delete cookies
- **Storage** - Read and write to extension storage
- **Screenshots** - Capture page screenshots
- **Console Access** - Read and clear browser console

## API Reference

Available in CoWorker code blocks:

```javascript
// Tab operations
extTabsList()
extTabsCreate({ url: 'https://example.com' })
extTabsGet(tabId)
extTabsUpdate(tabId, { url: 'https://newurl.com' })
extTabsClose(tabId)
extTabsReload(tabId)

// Script execution
extScriptExecute({ tabId: 1, code: 'document.title' })

// Cookies
extCookiesGet('https://example.com')
extCookiesSet({ url: 'https://example.com', name: 'token', value: 'abc123' })
extCookiesDelete('https://example.com', 'token')

// Storage
extStorageGet('settings')
extStorageSet({ settings: { theme: 'dark' } })
extStorageDelete('settings')

// Screenshot
extScreenshot({ fullPage: true })
```

## Requirements

- CoWorker CLI (https://github.com/Sylixide/coworker)
- Chrome, Brave, Edge, or Chromium-based browser

## License

MIT License - see [LICENSE](LICENSE) file.

## Support

For issues and feature requests, visit:
https://github.com/Sylixide/chromeworker/issues
