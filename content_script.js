(function() {
  const DEFAULT_KEYWORDS = ["harass", "harras", "abuse", "threat", "sexual", "stalker", "attack", "blackmail"];
  let keywords = DEFAULT_KEYWORDS;
  let recentRequests = [];

  browser.storage.sync.get(['mcp_keywords'], (res) => {
    if (res.mcp_keywords && Array.isArray(res.mcp_keywords)) {
      keywords = res.mcp_keywords;
    }
    console.log('Loaded keywords:', keywords);
  });

  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.mcp_keywords) {
      keywords = changes.mcp_keywords.newValue || DEFAULT_KEYWORDS;
      console.log('Updated keywords:', keywords);
    }
  });

  function scanPageForKeywords() {
    try {
      const text = document.body ? document.body.innerText : '';
      let count = 0;
      let matchedKeywords = [];
      for (const k of keywords) {
        const re = new RegExp('\\b' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
        const matches = text.match(re);
        if (matches) {
          count += matches.length;
          matchedKeywords.push(k);
        }
      }
      return { matchCount: count, snippet: text.slice(0, 500), matchedKeywords };
    } catch (e) {
      console.error('Scan error:', e);
      return { matchCount: 0, snippet: '', matchedKeywords: [] };
    }
  }

  function sendEvidence(payload) {
    browser.runtime.sendMessage({ type: 'save-evidence', payload }, (resp) => {
      if (browser.runtime.lastError) {
        console.error('Send evidence error:', browser.runtime.lastError);
      } else {
        console.log('Evidence saved:', resp);
      }
    });
  }

  function triggerCapture(reason) {
    console.log('Triggering capture for reason:', reason);
    const info = scanPageForKeywords();
    if (info.matchCount === 0 && reason.includes('keyword') && reason !== 'keyword-in-request-response' && reason !== 'keyword-in-xhr-response') {
      console.log('No keywords found, skipping capture for:', reason);
      return;
    }
    const evidence = {
      reason: reason || 'keyword-detected',
      matchCount: info.matchCount,
      matchedKeywords: info.matchedKeywords,
      snippet: info.snippet,
      pageHtml: document.documentElement.outerHTML.slice(0, 200000),
      requests: recentRequests.slice(-20) || []
    };
    console.log('Captured evidence:', JSON.stringify(evidence, null, 2));
    sendEvidence(evidence);
  }

  function pushRequestEntry(entry) {
    console.log('Pushing request:', entry);
    recentRequests.push(entry);
    if (recentRequests.length > 200) recentRequests.shift();
  }

  // Dummy request for debugging
  function logDummyRequest() {
    const entry = {
      type: 'dummy',
      url: 'http://example.com/dummy',
      method: 'GET',
      requestBody: null,
      responseBody: 'Dummy response for debugging',
      status: 200,
      time: new Date().toISOString()
    };
    pushRequestEntry(entry);
  }

  // Filter out irrelevant requests (e.g., images, CSS)
  function isRelevantRequest(url) {
    return !url.match(/\.(jpg|jpeg|png|gif|css|js|woff|woff2|ttf|ico)$/i);
  }

  // Apply monkey-patching for fetch and XHR
  function applyMonkeyPatches() {
    console.log('Applying monkey patches for fetch and XHR');
    const origFetch = window.fetch;
    window.fetch = async function(input, init) {
      let url = typeof input === 'string' ? input : (input instanceof Request ? input.url : '');
      if (!url || !isRelevantRequest(url)) {
        console.log('Skipping fetch for irrelevant URL:', url);
        return origFetch.apply(this, arguments);
      }
      console.log('Intercepted fetch:', url);
      const start = Date.now();
      const reqInfo = { type: 'fetch', url, method: (init && init.method) || 'GET', requestBody: init && init.body ? String(init.body).slice(0, 20000) : null, time: new Date().toISOString() };
      try {
        const resp = await origFetch.apply(this, arguments);
        const clone = resp.clone();
        let text;
        try { text = await clone.text(); text = text.slice(0, 200000); } catch (e) { text = '[could not read body]'; }
        reqInfo.duration = Date.now() - start;
        reqInfo.status = resp.status;
        reqInfo.responseBody = text;
        pushRequestEntry(reqInfo);
        const combined = (reqInfo.requestBody || '') + ' ' + (reqInfo.responseBody || '');
        if (keywords.some(k => combined.toLowerCase().includes(k.toLowerCase()))) {
          triggerCapture('keyword-in-request-response');
        }
        return resp;
      } catch (err) {
        console.error('Fetch patching error:', err);
        reqInfo.error = String(err);
        pushRequestEntry(reqInfo);
        throw err;
      }
    };

    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url) {
      if (!url || !isRelevantRequest(url)) {
        console.log('Skipping XHR for irrelevant URL:', url);
        return origOpen.apply(this, arguments);
      }
      console.log('Intercepted XHR open:', url);
      this.__mcp_url = url;
      this.__mcp_method = method;
      return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function(body) {
      const xhr = this;
      const entry = { type: 'xhr', url: xhr.__mcp_url, method: xhr.__mcp_method, requestBody: body ? String(body).slice(0, 20000) : null, time: new Date().toISOString() };
      const onState = function() {
        if (xhr.readyState === 4) {
          try {
            entry.status = xhr.status;
            entry.responseBody = xhr.responseText ? String(xhr.responseText).slice(0, 200000) : null;
          } catch (e) {
            entry.responseBody = '[could not read]';
          }
          pushRequestEntry(entry);
          const combined = (entry.requestBody || '') + ' ' + (entry.responseBody || '');
          if (keywords.some(k => combined.toLowerCase().includes(k.toLowerCase()))) {
            triggerCapture('keyword-in-xhr-response');
          }
          xhr.removeEventListener('readystatechange', onState);
        }
      };
      xhr.addEventListener('readystatechange', onState);
      return origSend.apply(this, arguments);
    };
  }

  // Apply patches initially and re-apply periodically
  applyMonkeyPatches();
  setInterval(applyMonkeyPatches, 10000); // Re-apply every 10 seconds to handle overrides

  window.addEventListener('load', () => {
    logDummyRequest();
    triggerCapture('initial-load');
  });

  setInterval(() => {
    triggerCapture('periodic-scan');
  }, 5000);

  const observer = new MutationObserver(() => {
    triggerCapture('dom-changed');
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === 'manual-capture') {
      logDummyRequest();
      triggerCapture('popup-manual');
      sendResponse({ ok: true });
    }
  });

  console.log('Content script loaded on:', window.location.href);
})();
