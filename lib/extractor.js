function findBestTable(doc) {
  const tables = doc.querySelectorAll('table');
  let best = null;
  let bestScore = -1;

  for (const table of tables) {
    const rows = table.querySelectorAll('tr');
    if (rows.length < 2) continue;

    const firstRow = rows[0];
    const ths = firstRow.querySelectorAll('th');
    const headerCount = ths.length;
    if (headerCount < 2) continue;

    let dataRowCount = 0;
    for (let i = 1; i < rows.length; i++) {
      const tds = rows[i].querySelectorAll('td');
      if (tds.length === 0) continue;
      const firstTd = tds[0];
      const isGroupHeader = firstTd && (
        firstTd.classList.contains('GroupHeaderStyle') ||
        (firstTd.getAttribute('colspan') && parseInt(firstTd.getAttribute('colspan')) > 1)
      );
      if (isGroupHeader) continue;
      if (tds.length === headerCount) dataRowCount++;
    }

    const score = headerCount * 5 + dataRowCount * 2;
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

function extractRows(table, headers) {
  const rows = table.querySelectorAll('tr');
  const data = [];
  let currentSection = null;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const cells = row.querySelectorAll('td');
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

    if (cells.length !== headers.length) continue;

    const entry = { _section: currentSection || '' };
    headers.forEach((header, idx) => {
      let val = '';
      if (cells[idx]) {
        val = cells[idx].textContent.replace(/\u00a0/gi, '').trim();
      }
      entry[header] = val;
    });
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

  const headers = extractHeaders(table);
  const data = extractRows(table, headers);
  const meta = extractMeta(doc);

  return { headers, data, meta };
}
