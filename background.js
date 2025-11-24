const DB_NAME = 'mcp_mass_db';
const STORE = 'evidence';

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function saveEvidence(item) {
  try {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).add(item).onsuccess = e => res(e.target.result);
      tx.onerror = () => rej(tx.error);
    });
  } catch (err) {
    console.error('IndexedDB save error:', err);
    throw err;
  }
}

async function listEvidence() {
  try {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  } catch (err) {
    console.error('IndexedDB list error:', err);
    throw err;
  }
}

async function clearEvidence() {
  try {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear().onsuccess = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (err) {
    console.error('IndexedDB clear error:', err);
    throw err;
  }
}

async function captureScreenshot(tabId) {
  return new Promise((res, rej) => {
    browser.tabs.captureVisibleTab(tabId, { format: 'jpeg', quality: 80 }, dataUrl => {
      if (browser.runtime.lastError) {
        console.error('Screenshot capture error:', browser.runtime.lastError.message);
        return rej(browser.runtime.lastError);
      }
      res(dataUrl);
    });
  });
}

browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('Background received message:', msg);
  (async () => {
    try {
      if (msg.type === 'save-evidence') {
        const screenshot = await captureScreenshot(sender.tab?.id).catch(err => {
          console.error('Failed to capture screenshot:', err);
          return null;
        });
        const item = {
          createdAt: new Date().toISOString(),
          url: sender.tab?.url || null,
          tabTitle: sender.tab?.title || null,
          screenshot,
          reason: msg.payload.reason,
          matchCount: msg.payload.matchCount,
          matchedKeywords: msg.payload.matchedKeywords || [],
          snippet: msg.payload.snippet,
          pageHtml: msg.payload.pageHtml,
          requests: msg.payload.requests || []
        };
        const id = await saveEvidence(item);
        sendResponse({ ok: true, id });

      } else if (msg.type === 'list-evidence') {
        const list = await listEvidence();
        sendResponse({ ok: true, list });

      } else if (msg.type === 'export-evidence') {
        const list = await listEvidence();
        const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        browser.downloads.download({ url, filename: 'mcp_evidence.json', saveAs: true }, () => {
          URL.revokeObjectURL(url);
          sendResponse({ ok: true });
        });
        return true;

      } else if (msg.type === 'clear-evidence') {
        await clearEvidence();
        sendResponse({ ok: true });

      } else {
        sendResponse({ ok: false, error: 'unknown message' });
      }
    } catch (err) {
      console.error('Background error:', err);
      sendResponse({ ok: false, error: err.message });
    }
  })();
  return true;
});
