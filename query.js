let session = null;
let rows = [];
let filteredRows = [];
let columns = [];
let sortField = null;
let sortDir = 'asc';
let filters = [];
let aggResult = null;

const DB_NAME = 'cnf-report-db';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('scrapes')) {
        db.createObjectStore('scrapes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('rows')) {
        const s = db.createObjectStore('rows', { keyPath: 'id' });
        s.createIndex('scrapeId', 'scrapeId', { unique: false });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function loadData() {
  const sessionId = location.hash.slice(1);
  if (!sessionId) {
    document.getElementById('loadingOverlay').innerHTML = '<p>No session ID provided. Use the extension popup to scrape a report.</p>';
    return;
  }

  try {
    const db = await openDB();
    const sessionReq = await new Promise((resolve, reject) => {
      const tx = db.transaction('scrapes', 'readonly');
      const req = tx.objectStore('scrapes').get(sessionId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (!sessionReq) {
      document.getElementById('loadingOverlay').innerHTML = '<p>Session not found. Data may have been deleted.</p>';
      return;
    }

    session = sessionReq;
    columns = session.columns || [];

    const rowsReq = await new Promise((resolve, reject) => {
      const tx = db.transaction('rows', 'readonly');
      const index = tx.objectStore('rows').index('scrapeId');
      const req = index.getAll(sessionId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    rows = rowsReq.map(r => ({ ...r.data, _section: r.section || '' }));
    filteredRows = [...rows];

    initUI();
    render();
    document.getElementById('loadingOverlay').style.display = 'none';
    document.getElementById('mainContent').style.display = '';
  } catch (err) {
    document.getElementById('loadingOverlay').innerHTML = `<p>Error loading data: ${err.message}</p>`;
  }
}

function initUI() {
  const headerNames = columns.map(c => c.key);

  document.getElementById('reportTitle').textContent =
    `${session.title || 'Report'} — ${session.meta?.party || session.meta?.pageTitle || ''}`;
  document.getElementById('recordCount').textContent = `${rows.length} records scraped`;

  renderFieldsList();
  populateSelects();
  addFilterRow();
}

function renderFieldsList() {
  const container = document.getElementById('fieldsList');
  container.innerHTML = '';
  for (const col of columns) {
    const div = document.createElement('div');
    div.className = 'field-item';
    const badgeClass = `badge-${col.type}`;
    div.innerHTML = `
      <div class="field-name">${escapeHtml(col.key)}</div>
      <div class="field-meta">
        <span class="badge ${badgeClass}">${col.type}</span>
        <span class="field-empty" title="Empty cells">${col.emptyCount}/${col.totalCount} empty</span>
      </div>
    `;
    container.appendChild(div);
  }
}

function populateSelects() {
  const filterField = document.getElementById('filterFieldTemplate');
  const aggField = document.getElementById('aggFunction');
  const aggFieldSelect = document.getElementById('aggField');
  const groupField = document.getElementById('groupField');

  aggField.innerHTML = '';
  for (const fn of AGG_FUNCTIONS) {
    const opt = document.createElement('option');
    opt.value = fn.value;
    opt.textContent = fn.label;
    aggField.appendChild(opt);
  }

  aggFieldSelect.innerHTML = '';
  groupField.innerHTML = '<option value="">(none)</option>';

  for (const col of columns) {
    const opt1 = document.createElement('option');
    opt1.value = col.key;
    opt1.textContent = col.key;
    aggFieldSelect.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = col.key;
    opt2.textContent = col.key;
    groupField.appendChild(opt2);
  }

  updateAggFieldOptions();
}

function updateAggFieldOptions() {
  const aggFunc = document.getElementById('aggFunction').value;
  const aggFuncObj = AGG_FUNCTIONS.find(f => f.value === aggFunc);
  const isNumericOnly = aggFuncObj ? aggFuncObj.numericOnly : true;

  const aggFieldSelect = document.getElementById('aggField');
  for (const opt of aggFieldSelect.options) {
    const col = columns.find(c => c.key === opt.value);
    if (isNumericOnly && col && col.type !== 'number') {
      opt.disabled = true;
      opt.title = 'Only numeric fields allowed';
    } else {
      opt.disabled = false;
      opt.title = '';
    }
  }
}

document.getElementById('aggFunction').addEventListener('change', updateAggFieldOptions);

function addFilterRow(values) {
  const container = document.getElementById('filtersContainer');
  const idx = container.children.length;

  const div = document.createElement('div');
  div.className = 'filter-row';
  div.dataset.index = idx;

  const fieldSelect = document.createElement('select');
  fieldSelect.className = 'filter-field';
  fieldSelect.innerHTML = columns.map(c =>
    `<option value="${escapeHtml(c.key)}"${values && values.field === c.key ? ' selected' : ''}>${escapeHtml(c.key)}</option>`
  ).join('');

  const opSelect = document.createElement('select');
  opSelect.className = 'filter-op';

  const valInput = document.createElement('input');
  valInput.className = 'filter-val';
  valInput.type = 'text';
  valInput.placeholder = 'value';
  if (values) valInput.value = values.value || '';

  const removeBtn = document.createElement('button');
  removeBtn.className = 'btn-sm btn-remove';
  removeBtn.textContent = '×';
  removeBtn.title = 'Remove filter';

  div.appendChild(fieldSelect);
  div.appendChild(opSelect);
  div.appendChild(valInput);
  div.appendChild(removeBtn);
  container.appendChild(div);

  updateOperators(fieldSelect, opSelect, values);
  fieldSelect.addEventListener('change', () => updateOperators(fieldSelect, opSelect));
  removeBtn.addEventListener('click', () => { div.remove(); });

  if (values && values.operator) {
    opSelect.value = values.operator;
  }
}

function updateOperators(fieldSelect, opSelect, values) {
  const col = columns.find(c => c.key === fieldSelect.value);
  const type = col ? col.type : 'string';
  const ops = OPERATORS[type] || OPERATORS.string;

  opSelect.innerHTML = ops.map(o =>
    `<option value="${o.value}"${values && values.operator === o.value ? ' selected' : ''}>${o.label}</option>`
  ).join('');

  const valInput = opSelect.parentElement.querySelector('.filter-val');
  const isValueOp = !['is_empty', 'is_not_empty'].includes(opSelect.value);
  valInput.style.display = isValueOp ? '' : 'none';
}

document.getElementById('addFilterBtn').addEventListener('click', () => addFilterRow());

document.getElementById('applyFiltersBtn').addEventListener('click', () => {
  filters = [];
  const rows = document.querySelectorAll('.filter-row');
  for (const row of rows) {
    const field = row.querySelector('.filter-field').value;
    const operator = row.querySelector('.filter-op').value;
    const valInput = row.querySelector('.filter-val');
    const value = valInput.style.display !== 'none' ? valInput.value : '';
    filters.push({ field, operator, value });
  }
  applyAndRender();
});

document.getElementById('clearFiltersBtn').addEventListener('click', () => {
  document.getElementById('filtersContainer').innerHTML = '';
  filters = [];
  applyAndRender();
});

document.getElementById('applyAggBtn').addEventListener('click', () => {
  const func = document.getElementById('aggFunction').value;
  const field = document.getElementById('aggField').value;
  const group = document.getElementById('groupField').value;

  if (!field) return;

  const dataToAgg = filteredRows;

  if (group) {
    const result = groupAndAggregate(dataToAgg, group, field, func);
    aggResult = { type: 'grouped', group, field, func, result };
    renderAggregated(result, func, field, group);
  } else {
    const values = dataToAgg.map(r => r[field] || '');
    const val = aggregate(values, func);
    aggResult = { type: 'single', field, func, value: val };
    document.getElementById('aggResult').textContent =
      `${func}(${field}) = ${typeof val === 'number' ? val.toLocaleString() : val}`;
  }
});

document.getElementById('searchInput').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  if (!q) {
    filteredRows = applyFilters(rows, filters);
  } else {
    filteredRows = applyFilters(rows, filters).filter(row =>
      Object.values(row).some(v => (v || '').toString().toLowerCase().includes(q))
    );
  }
  renderTable();
});

document.getElementById('exportPdfBtn').addEventListener('click', () => {
  const headerNames = columns.map(c => c.key);
  const title = `CNF Report - ${session.title || 'Report'}`;
  const subtitle = session.meta?.party || session.url || '';
  openPdfWindow(title, subtitle, headerNames, filteredRows, filters);
});

document.getElementById('exportExcelBtn').addEventListener('click', () => {
  const headerNames = columns.map(c => c.key);
  const title = `CNF Report - ${session.title || 'Report'}`;
  downloadExcel(title, headerNames, filteredRows);
});

function applyAndRender() {
  filteredRows = applyFilters(rows, filters);
  aggResult = null;
  document.getElementById('aggResult').textContent = '';
  render();
}

function render() {
  renderTable();
  document.getElementById('resultCount').textContent = `${filteredRows.length} records (filtered from ${rows.length})`;
}

function renderTable() {
  const thead = document.getElementById('tableHead');
  const tbody = document.getElementById('tableBody');

  const headerNames = columns.map(c => c.key);

  thead.innerHTML = `<tr><th class="th-row-num">#</th>${headerNames.map(h => {
    const isSorted = sortField === h;
    const arrow = isSorted ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅';
    return `<th class="th-sortable" data-field="${escapeHtml(h)}">${escapeHtml(h)}${arrow}</th>`;
  }).join('')}</tr>`;

  const visibleRows = filteredRows;
  tbody.innerHTML = visibleRows.map((row, idx) => {
    const section = row._section;
    const sectionRow = section
      ? `<tr class="section-row"><td colspan="${headerNames.length + 1}">${escapeHtml(section)}</td></tr>`
      : '';
    const dataRow = `<tr>${[idx + 1, ...headerNames.map(h => {
      const val = row[h] !== undefined ? row[h] : '';
      return `<td class="${val === '' ? 'cell-empty' : ''}">${escapeHtml(val)}</td>`;
    })].join('')}</tr>`;
    return section ? sectionRow + dataRow : dataRow;
  }).join('');

  thead.addEventListener('click', (e) => {
    const th = e.target.closest('th[data-field]');
    if (!th) return;
    const field = th.dataset.field;
    if (sortField === field) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortField = field;
      sortDir = 'asc';
    }
    filteredRows = sortData(filteredRows, sortField, sortDir);
    renderTable();
  });
}

function renderAggregated(result, func, field, group) {
  const tbody = document.getElementById('tableBody');
  const thead = document.getElementById('tableHead');
  thead.innerHTML = `<tr><th>${escapeHtml(group)}</th><th>Count</th><th>${escapeHtml(func)}(${escapeHtml(field)})</th></tr>`;
  tbody.innerHTML = result.map(r =>
    `<tr><td>${escapeHtml(r.group)}</td><td>${r.count}</td><td>${typeof r.result === 'number' ? r.result.toLocaleString() : r.result}</td></tr>`
  ).join('');
  document.getElementById('resultCount').textContent = `${result.length} groups`;
  document.getElementById('aggResult').textContent = '';
}

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', loadData);
