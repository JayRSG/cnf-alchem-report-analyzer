function findBestTable(doc) {
  const tables = doc.querySelectorAll('table');
  let best = null;
  let bestScore = -1;

  for (const table of tables) {
    const rows = table.querySelectorAll('tr');
    if (rows.length < 2) continue;

    const ths = rows[0].querySelectorAll('th');
    if (ths.length < 2) continue;

    let dataRowCount = 0;
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].querySelectorAll('td, th');
      if (cells.length === 0) continue;
      const firstCell = cells[0];
      const isGroupHeader = firstCell && (
        firstCell.classList.contains('GroupHeaderStyle') ||
        (firstCell.getAttribute('colspan') && parseInt(firstCell.getAttribute('colspan')) > 1)
      );
      if (isGroupHeader) continue;
      if (cells.length >= ths.length) dataRowCount++;
    }

    const score = ths.length * 5 + dataRowCount * 2;
    if (score > bestScore) {
      bestScore = score;
      best = table;
    }
  }

  return best;
}

function extractHeaders(table) {
  const firstRow = table.querySelector('tr');
  const headers = [];
  firstRow.querySelectorAll('th').forEach((th) => {
    let text = th.textContent.replace(/\u00a0/gi, '').trim();
    if (!text) text = `Column_${headers.length + 1}`;
    headers.push(text);
  });
  return headers;
}

function getTypicalDataRowCellCount(table) {
  const rows = table.querySelectorAll('tr');
  const counts = {};
  for (let i = 1; i < Math.min(rows.length, 20); i++) {
    const cells = rows[i].querySelectorAll('td, th');
    if (cells.length === 0) continue;
    const first = cells[0];
    const isGroup = first && (
      first.classList.contains('GroupHeaderStyle') ||
      (first.getAttribute('colspan') && parseInt(first.getAttribute('colspan')) > 1)
    );
    if (isGroup) continue;
    counts[cells.length] = (counts[cells.length] || 0) + 1;
  }
  let bestCount = 0;
  let bestFreq = 0;
  for (const [count, freq] of Object.entries(counts)) {
    if (freq > bestFreq) {
      bestFreq = freq;
      bestCount = parseInt(count);
    }
  }
  return bestCount;
}

function extractRows(table, headers) {
  const rows = table.querySelectorAll('tr');
  const data = [];
  let currentSection = null;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const cells = row.querySelectorAll('td, th');
    if (cells.length === 0) continue;

    const firstCell = cells[0];
    const isGroupHeader = firstCell && (
      firstCell.classList.contains('GroupHeaderStyle') ||
      (firstCell.getAttribute('colspan') && parseInt(firstCell.getAttribute('colspan')) > 1)
    );

    if (isGroupHeader) {
      const sectionText = firstCell.textContent.replace(/\u00a0/gi, '').trim();
      if (sectionText) currentSection = sectionText;
      continue;
    }

    const entry = { _section: currentSection || '' };

    if (cells.length === headers.length + 1) {
      for (let j = 0; j < headers.length; j++) {
        entry[headers[j]] = cells[j + 1].textContent.replace(/\u00a0/gi, '').trim();
      }
    } else {
      const count = Math.min(cells.length, headers.length);
      for (let j = 0; j < count; j++) {
        entry[headers[j]] = cells[j].textContent.replace(/\u00a0/gi, '').trim();
      }
    }

    data.push(entry);
  }

  return data;
}

function extractMeta(doc) {
  const meta = {};
  const knownSelectors = {
    company: '#lblCompanyNM',
    party: '#lblparty',
    fromDate: '#lblFromDt',
    toDate: '#lblToDate',
    printDate: '#lblPrintDate'
  };
  for (const [key, sel] of Object.entries(knownSelectors)) {
    const el = doc.querySelector(sel);
    if (el) meta[key] = el.textContent.replace(/\u00a0/gi, '').trim();
  }
  const titleEl = doc.querySelector('title');
  if (titleEl) meta.pageTitle = titleEl.textContent.trim();
  return meta;
}

function extractReport(doc) {
  const table = findBestTable(doc);
  if (!table) return null;

  const rawHeaders = extractHeaders(table);
  if (rawHeaders.length < 2) return null;

  const typicalDataCells = getTypicalDataRowCellCount(table);

  let headers = rawHeaders;
  if (typicalDataCells > 0 && typicalDataCells < rawHeaders.length) {
    const trimCount = rawHeaders.length - typicalDataCells;
    headers = rawHeaders.slice(trimCount);
  }

  const data = extractRows(table, headers);
  const meta = extractMeta(doc);

  const hashIdx = headers.indexOf('#');
  if (hashIdx !== -1) {
    headers.splice(hashIdx, 1);
    for (const row of data) {
      delete row['#'];
    }
  }

  return { headers, data, meta };
}
