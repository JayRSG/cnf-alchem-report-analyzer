chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'ping') {
    sendResponse({ status: 'alive' });
    return true;
  }

  if (message.action === 'scrape') {
    try {
      const result = extractReport(document);
      if (!result || !result.headers || result.data.length === 0) {
        sendResponse({ error: 'No report table found on this page.' });
        return true;
      }

      const columns = analyzeColumns(result.headers, result.data);
      sendResponse({
        success: true,
        headers: result.headers,
        data: result.data,
        meta: result.meta,
        columns: columns
      });
    } catch (err) {
      sendResponse({ error: err.message });
    }
    return true;
  }
});
