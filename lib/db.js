const DB_NAME = 'cnf-report-db';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('scrapes')) {
        const store = db.createObjectStore('scrapes', { keyPath: 'id' });
        store.createIndex('url', 'url', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains('rows')) {
        const store = db.createObjectStore('rows', { keyPath: 'id' });
        store.createIndex('scrapeId', 'scrapeId', { unique: false });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

const db = {
  async saveScrape(session) {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('scrapes', 'readwrite');
      const store = tx.objectStore('scrapes');
      const req = store.put(session);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async saveRows(rows) {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('rows', 'readwrite');
      const store = tx.objectStore('rows');
      let completed = 0;
      for (const row of rows) {
        const req = store.put(row);
        req.onsuccess = () => {
          completed++;
          if (completed === rows.length) resolve();
        };
        req.onerror = () => reject(req.error);
      }
      if (rows.length === 0) resolve();
    });
  },

  async getScrape(id) {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('scrapes', 'readonly');
      const store = tx.objectStore('scrapes');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async getRows(scrapeId) {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('rows', 'readonly');
      const store = tx.objectStore('rows');
      const index = store.index('scrapeId');
      const req = index.getAll(scrapeId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async getAllScrapes() {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('scrapes', 'readonly');
      const store = tx.objectStore('scrapes');
      const index = store.index('timestamp');
      const req = index.openCursor(null, 'prev');
      const results = [];
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      req.onerror = () => reject(req.error);
    });
  },

  async deleteScrape(id) {
    const database = await openDB();
    const tx = database.transaction(['scrapes', 'rows'], 'readwrite');
    return new Promise((resolve, reject) => {
      tx.objectStore('scrapes').delete(id);
      const rows = tx.objectStore('rows');
      const index = rows.index('scrapeId');
      const req = index.openCursor(IDBKeyRange.only(id));
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          rows.delete(cursor.primaryKey);
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => reject(req.error);
    });
  }
};
