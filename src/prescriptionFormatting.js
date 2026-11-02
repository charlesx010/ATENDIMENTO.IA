/** Format route blocks without changing medication or directions. */
export function formatPrescriptionRoutes(text='') {
  const lines=String(text).split(/\r?\n/);
  const out=[];
  let route='';
  let number=0;
  const routeHeading=/^uso\s+(?:oral|t[oó]pico|local|nasal|oft[aá]lmico|inalat[oó]rio|vaginal|otol[oó]gico|sublingual|retal|ev(?:\s+ou\s+im)?|im|sc|intravenoso|intramuscular|subcut[aâ]neo)\s*:?$/i;
  for(const line of lines){
    const trimmed=line.trim();
    if(routeHeading.test(trimmed)){
      const key=trimmed.replace(/:$/,'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ');
      if(key!==route){route=key;number=0;out.push(trimmed);}
      continue;
    }
    if(/^(?:orienta[cç][oõ]es|prescri[cç][aã]o na unidade)\s*:?$/i.test(trimmed)){route='';number=0;}
    if(route&&/^\d+[).]\s+/.test(trimmed)){
      number++;out.push(line.replace(/^\s*\d+[).]\s+/,`${number}. `));
    }else out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g,'\n\n').trim();
}


