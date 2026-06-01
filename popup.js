const statusBox = document.getElementById('statusBox');
const scrapeBtn = document.getElementById('scrapeBtn');
const resultInfo = document.getElementById('resultInfo');
const fieldCount = document.getElementById('fieldCount');
const rowCount = document.getElementById('rowCount');
const openQueryBtn = document.getElementById('openQueryBtn');

let lastSessionId = null;

scrapeBtn.addEventListener('click', async () => {
  setStatus('Analyzing page...', 'loading');
  scrapeBtn.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !tab.url.startsWith('https://apps.univanbd.com/')) {
      setStatus('Not on apps.univanbd.com', 'error');
      scrapeBtn.disabled = false;
      return;
    }

    const ping = await chrome.tabs.sendMessage(tab.id, { action: 'ping' }).catch(() => null);
    if (!ping || ping.status !== 'alive') {
      setStatus('Extension not loaded. Refresh the page.', 'error');
      scrapeBtn.disabled = false;
      return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, { action: 'scrape' });

    if (response.error) {
      setStatus(response.error, 'error');
      scrapeBtn.disabled = false;
      return;
    }

    if (!response.success) {
      setStatus('Scraping failed unexpectedly.', 'error');
      scrapeBtn.disabled = false;
      return;
    }

    const { headers, data, meta, columns } = response;
    setStatus(`Scraped ${data.length} records`, 'success');

    fieldCount.textContent = headers.length;
    rowCount.textContent = data.length;
    resultInfo.classList.remove('hidden');

    const sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

    const session = {
      id: sessionId,
      url: tab.url,
      title: meta?.pageTitle || 'Report',
      timestamp: Date.now(),
      meta: meta || {},
      columns: columns,
      rowCount: data.length
    };

    const rowEntries = data.map((row, idx) => ({
      id: `${sessionId}_${idx}`,
      scrapeId: sessionId,
      rowIndex: idx,
      section: row._section || '',
      data: {}
    }));
    for (const h of headers) {
      for (let i = 0; i < data.length; i++) {
        rowEntries[i].data[h] = data[i][h] || '';
      }
    }

    await db.saveScrape(session);
    await db.saveRows(rowEntries);

    lastSessionId = sessionId;
    openQueryBtn.classList.remove('hidden');
  } catch (err) {
    setStatus('Error: ' + err.message, 'error');
  }

  scrapeBtn.disabled = false;
});

openQueryBtn.addEventListener('click', () => {
  if (lastSessionId) {
    chrome.tabs.create({ url: chrome.runtime.getURL(`query.html#${lastSessionId}`) });
  }
});

function setStatus(msg, type) {
  statusBox.textContent = msg;
  statusBox.className = 'status-box';
  if (type === 'error') statusBox.classList.add('error');
  else if (type === 'success') statusBox.classList.add('success');
  else if (type === 'loading') {
    statusBox.classList.add('loading');
    statusBox.innerHTML = `<span class="spinner"></span>${msg}`;
  }
}
