function setStatus(message, isError = false) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.style.color = isError ? 'red' : 'green';
  setTimeout(() => statusDiv.textContent = '', 3000);
}

document.getElementById('manual').addEventListener('click', async () => {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      const response = await browser.tabs.sendMessage(tab.id, { type: 'manual-capture' });
      if (response.ok) {
        setStatus('Capture triggered successfully!');
      } else {
        setStatus('Capture failed: ' + (response.error || 'Unknown error'), true);
      }
    } else {
      setStatus('No active tab found.', true);
    }
  } catch (err) {
    console.error('Manual capture error:', err);
    setStatus('Could not connect to the page: ' + err.message, true);
  }
});

document.getElementById('list').addEventListener('click', () => {
  browser.tabs.create({ url: browser.runtime.getURL("evidence.html") });
});

document.getElementById('export').addEventListener('click', () => {
  setStatus('Starting export...');
  browser.runtime.sendMessage({ type: 'export-evidence' }, (response) => {
    if (response && response.ok) {
      setStatus('Export completed. Check downloads.');
    } else {
      setStatus('Export failed: ' + (response?.error || 'Unknown error'), true);
    }
  });
});

document.getElementById('clear').addEventListener('click', () => {
  if (!confirm('Are you sure you want to clear ALL saved evidence? This cannot be undone.')) return;
  browser.runtime.sendMessage({ type: 'clear-evidence' }, resp => {
    if (resp && resp.ok) {
      setStatus('All evidence cleared.');
    } else {
      setStatus('Error clearing evidence: ' + (resp?.error || 'Unknown error'), true);
    }
  });
});
