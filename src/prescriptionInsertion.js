export function containsPrescription(existing, candidate) {
  const normalize=value=>String(value||'').replace(/\r\n?/g,'\n').trim();
  const text=normalize(candidate);
  return Boolean(text)&&('\n\n'+normalize(existing)+'\n\n').includes('\n\n'+text+'\n\n');
}


