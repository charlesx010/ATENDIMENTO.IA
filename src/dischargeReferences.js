export function dischargeReferenceIds(reference) {
  return [...new Set(String(reference || '').toUpperCase().match(/\b(?:PEDV4-PED|ADU|PED)-\d+\b/g) || [])];
}
export function resolveDischargeReferences(catalog, ids) {
  const wanted = new Set(ids);
  return {
    entries: catalog.filter(item => wanted.has(item.id)),
    missing: ids.filter(id => !catalog.some(item => item.id === id))
  };
}


