chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'get_data') {
    importScripts('lib/db.js');
    db.getScrape(message.sessionId).then((session) => {
      db.getRows(message.sessionId).then((rows) => {
        sendResponse({ session, rows });
      });
    });
    return true;
  }

  if (message.action === 'get_scrapes') {
    importScripts('lib/db.js');
    db.getAllScrapes().then((scrapes) => sendResponse(scrapes));
    return true;
  }

  if (message.action === 'delete_scrape') {
    importScripts('lib/db.js');
    db.deleteScrape(message.sessionId).then(() => sendResponse({ status: 'deleted' }));
    return true;
  }
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.url && tab.url.startsWith('https://apps.univanbd.com/')) {
    chrome.tabs.sendMessage(tab.id, { action: 'ping' }).catch(() => {});
  }
});
