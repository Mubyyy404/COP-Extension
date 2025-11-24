const ta = document.getElementById('kw');
const statusDiv = document.getElementById('status');

browser.storage.sync.get(['mcp_keywords'], (res) => {
  const defaultKeywords = ["harass", "harras", "abuse", "threat", "sexual", "stalker", "attack", "blackmail"];
  ta.value = (res.mcp_keywords || defaultKeywords).join('\n');
});

document.getElementById('save').addEventListener('click', () => {
  const arr = ta.value.split('\n').map(s => s.trim()).filter(Boolean);
  if (arr.length === 0) {
    statusDiv.textContent = 'Error: At least one keyword is required.';
    statusDiv.className = 'error';
    setTimeout(() => { statusDiv.textContent = ''; statusDiv.className = ''; }, 3000);
    return;
  }
  browser.storage.sync.set({ mcp_keywords: arr }, () => {
    statusDiv.textContent = 'Keywords saved!';
    statusDiv.className = '';
    setTimeout(() => statusDiv.textContent = '', 2000);
  });
});
