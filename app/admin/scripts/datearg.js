export function recomputeDate(dateStr) {
  if (!dateStr) return null;

  try {
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return null;

    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  } catch {
    return null;
  }
}
