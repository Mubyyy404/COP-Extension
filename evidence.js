function escapeHTML(str) {
  const p = document.createElement('p');
  p.textContent = str;
  return p.innerHTML;
}

browser.runtime.sendMessage({ type: 'list-evidence' }, resp => {
  if (!resp || !resp.ok) {
    console.error('Error loading evidence:', resp?.error);
    document.getElementById('list').innerHTML = '<p>Error loading evidence.</p>';
    return;
  }

  const list = resp.list;
  const container = document.getElementById('list');
  if (list.length === 0) {
    container.innerHTML = '<p>No evidence collected yet.</p>';
    return;
  }

  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  list.forEach(item => {
    const div = document.createElement('div');
    div.className = 'item';

    const title = document.createElement('h3');
    title.textContent = item.tabTitle || item.url || 'Unknown URL';
    div.appendChild(title);

    const urlPara = document.createElement('p');
    urlPara.innerHTML = `<b>URL:</b> ${escapeHTML(item.url || 'N/A')}`;
    div.appendChild(urlPara);

    const timePara = document.createElement('p');
    timePara.innerHTML = `<b>Time:</b> ${new Date(item.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;
    div.appendChild(timePara);

    const reasonPara = document.createElement('p');
    reasonPara.innerHTML = `<b>Reason:</b> ${escapeHTML(item.reason || 'manual')}`;
    div.appendChild(reasonPara);

    const matchPara = document.createElement('p');
    matchPara.innerHTML = `<b>Matches:</b> ${item.matchCount || 0} (Keywords: ${item.matchedKeywords ? escapeHTML(item.matchedKeywords.join(', ')) : 'None'})`;
    div.appendChild(matchPara);

    if (item.screenshot) {
      const img = document.createElement('img');
      img.src = item.screenshot;
      img.style.maxWidth = '300px';
      div.appendChild(img);
    } else {
      const noImg = document.createElement('p');
      noImg.textContent = 'No screenshot available';
      div.appendChild(noImg);
    }

    const createDetailsSection = (summaryText, contentText) => {
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = summaryText;
      const pre = document.createElement('pre');
      pre.textContent = contentText;
      details.appendChild(summary);
      details.appendChild(pre);
      return details;
    };

    div.appendChild(createDetailsSection('🔎 Page Snippet', item.snippet || ''));
    div.appendChild(createDetailsSection('🌐 Network Requests', item.requests.length ? JSON.stringify(item.requests, null, 2) : 'No requests captured (only dummy request)'));
    div.appendChild(createDetailsSection('📄 HTML Snapshot', item.pageHtml ? item.pageHtml.substring(0, 5000) + '...' : ''));

    container.appendChild(div);
  });
});
