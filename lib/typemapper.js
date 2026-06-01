function inferType(values, sampleSize = 50) {
  const nonEmpty = values.filter(
    (v) => v !== '' && v !== null && v !== undefined
  );
  if (nonEmpty.length === 0) return 'string';

  const sampled = nonEmpty.slice(0, sampleSize);

  const numberPattern = /^-?[\d,]+\.?\d*$/;
  const datePattern1 = /^\d{2}\/\d{2}\/\d{4}$/;
  const datePattern2 = /^\d{4}-\d{2}-\d{2}$/;

  const allNumbers = sampled.every((v) =>
    numberPattern.test(v.replace(/,/g, ''))
  );
  if (allNumbers) return 'number';

  const allDates = sampled.every(
    (v) => datePattern1.test(v) || datePattern2.test(v)
  );
  if (allDates) return 'date';

  return 'string';
}

function analyzeColumns(headers, data) {
  return headers.map((header) => {
    const values = data.map((row) => row[header] || '');
    const type = inferType(values);
    const emptyCount = values.filter((v) => v === '').length;
    return {
      key: header,
      name: header,
      type,
      emptyCount,
      totalCount: values.length,
      emptyPercent: values.length > 0
        ? Math.round((emptyCount / values.length) * 100)
        : 0
    };
  });
}
