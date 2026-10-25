// Tratamento deterministico de hipoteses repetidas da Web Speech API.
// Chrome Android pode sinalizar atualizacoes progressivas como finais.
export function normalizeWord(value){
 return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
}
export function speechWords(text){
 const tokens=[];
 const pattern=/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu;
 for(const match of String(text??'').matchAll(pattern))tokens.push({key:normalizeWord(match[0]),start:match.index,end:match.index+match[0].length});
 return tokens.filter(t=>t.key);
}
export function stitchSpeech(base, addition) {
 const before=String(base??'').trim(), after=String(addition??'').trim();
 if(!before)return after;
 if(!after)return before;
 const left=speechWords(before), right=speechWords(after);
 if(!left.length||!right.length)return before+' '+after;
 const equal=(a,b,n)=>{for(let i=0;i<n;i++)if(a[i]?.key!==b[i]?.key)return false;return true;};
 const size=Math.min(left.length,right.length);
 // Quando a hipótese nova estende ou encurta a frase anterior, substitui
 // seu texto (em vez de acrescentar a mesma frase com mais uma palavra).
 if(size>=3 && equal(left,right,size)){
   return right.length>=left.length?after:before;
 }
 // Evita repetição de uma hipótese completa, caso apareça novamente.
 if(right.length>=3){
  for(let i=Math.max(0,left.length-right.length-2);i<=left.length-right.length;i++){
   if(i<0)continue;
   if(equal(left.slice(i,i+right.length),right,right.length))return before;
  }
 }
 // Se o reconhecedor repetir o fim da hipótese anterior e depois avançar,
 // apenas o trecho ainda não visto é acrescentado.
 for(let overlap=size;overlap>=3;overlap--){
  let matches=true;
  for(let j=0;j<overlap;j++)if(left[left.length-overlap+j].key!==right[j].key){matches=false;break;}
  if(matches){
   if(overlap===right.length)return before;
   return before+' '+after.slice(right[overlap].start);
  }
 }
 return before+' '+after;
}
export function stitchSpeechSegments(segments){
 return segments.reduce((text,chunk)=>stitchSpeech(text,chunk),'').trim();
}
export function getRecognitionParts(results){
 const final=[],temporary=[];
 for(let i=0;i<results.length;i++){
  const item=results[i];
  const segment=String(item?.[0]?.transcript||'').trim();
  if(!segment)continue;
  (item.isFinal?final:temporary).push(segment);
 }
 return {final:stitchSpeechSegments(final),temporary:stitchSpeechSegments(temporary)};
}
export function joinSpeech(base,addition){
 const first=String(base||'').trim(),second=String(addition||'').trim();
 return [first,second].filter(Boolean).join(' ');
}
export function removeObviousRepetitions(source){
 const original=String(source??'').replace(/\s+/g,' ').trim();
 if(!original)return '';
 const parts=original.split(' ');
 const keys=parts.map(normalizeWord);
 const protectedWords=new Set(['nao','nega','negou','sem','nenhum','nenhuma','jamais','nunca','suspender','suspenso','alergia','alergico','alergica']);
 let out=[];
 for(let i=0;i<parts.length;){
  let removed=false;
  for(let n=Math.min(16,Math.floor((parts.length-i)/2));n>=3;n--){
   const words=keys.slice(i,i+n);
   if(words.some(w=>!w||/\d/.test(w)||protectedWords.has(w)))continue;
   if(words.every((key,j)=>key===keys[i+n+j])){
     out.push(...parts.slice(i,i+n));i+=n;
     while(i+n<=parts.length&&words.every((key,j)=>key===keys[i+j]))i+=n;
     removed=true;break;
   }
  }
  if(!removed){out.push(parts[i]);i++;}
 }
 return out.join(' ').replace(/\s+([,.!?;:])/g,'$1').trim();
}
