const OPERATORS = {
  string: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'not equals' },
    { value: 'contains', label: 'contains' },
    { value: 'starts_with', label: 'starts with' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' }
  ],
  number: [
    { value: 'equals', label: '=' },
    { value: 'not_equals', label: '≠' },
    { value: 'greater_than', label: '>' },
    { value: 'greater_than_or_equal', label: '≥' },
    { value: 'less_than', label: '<' },
    { value: 'less_than_or_equal', label: '≤' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' }
  ],
  date: [
    { value: 'equals', label: '=' },
    { value: 'before', label: 'before' },
    { value: 'after', label: 'after' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' }
  ]
};

const AGG_FUNCTIONS = [
  { value: 'SUM', label: 'SUM', numericOnly: true },
  { value: 'COUNT', label: 'COUNT', numericOnly: false },
  { value: 'COUNT_DISTINCT', label: 'COUNT DISTINCT', numericOnly: false },
  { value: 'AVG', label: 'AVG', numericOnly: true },
  { value: 'MIN', label: 'MIN', numericOnly: true },
  { value: 'MAX', label: 'MAX', numericOnly: true }
];

function evaluateFilter(row, filter) {
  const val = (row[filter.field] || '').toString();
  const filterVal = (filter.value || '').toString();

  switch (filter.operator) {
    case 'equals':
      return val === filterVal;
    case 'not_equals':
      return val !== filterVal;
    case 'contains':
      return val.toLowerCase().includes(filterVal.toLowerCase());
    case 'starts_with':
      return val.toLowerCase().startsWith(filterVal.toLowerCase());
    case 'is_empty':
      return val === '';
    case 'is_not_empty':
      return val !== '';
    case 'greater_than':
      return parseFloat(val) > parseFloat(filterVal);
    case 'greater_than_or_equal':
      return parseFloat(val) >= parseFloat(filterVal);
    case 'less_than':
      return parseFloat(val) < parseFloat(filterVal);
    case 'less_than_or_equal':
      return parseFloat(val) <= parseFloat(filterVal);
    case 'before':
      return val.localeCompare(filterVal) < 0;
    case 'after':
      return val.localeCompare(filterVal) > 0;
    default:
      return true;
  }
}

function applyFilters(data, filters) {
  if (!filters || filters.length === 0) return data;
  return data.filter((row) => filters.every((f) => evaluateFilter(row, f)));
}

function aggregate(values, func) {
  const numeric = values.map((v) => parseFloat(v)).filter((v) => !isNaN(v));
  switch (func) {
    case 'SUM':
      return numeric.reduce((s, v) => s + v, 0);
    case 'COUNT':
      return values.length;
    case 'COUNT_DISTINCT':
      return new Set(values).size;
    case 'AVG': {
      if (numeric.length === 0) return 0;
      return numeric.reduce((s, v) => s + v, 0) / numeric.length;
    }
    case 'MIN':
      return numeric.length > 0 ? Math.min(...numeric) : null;
    case 'MAX':
      return numeric.length > 0 ? Math.max(...numeric) : null;
    default:
      return null;
  }
}

function groupAndAggregate(data, groupField, aggField, aggFunc) {
  const groups = {};
  for (const row of data) {
    const key = row[groupField] || '(empty)';
    if (!groups[key]) groups[key] = [];
    groups[key].push(row[aggField] || '');
  }
  const result = [];
  for (const [key, values] of Object.entries(groups)) {
    result.push({
      group: key,
      count: values.length,
      result: aggregate(values, aggFunc)
    });
  }
  return result;
}

function sortData(data, field, direction) {
  return [...data].sort((a, b) => {
    const va = (a[field] || '').toString();
    const vb = (b[field] || '').toString();
    const na = parseFloat(va);
    const nb = parseFloat(vb);
    if (!isNaN(na) && !isNaN(nb)) {
      return direction === 'asc' ? na - nb : nb - na;
    }
    return direction === 'asc'
      ? va.localeCompare(vb)
      : vb.localeCompare(va);
  });
}
