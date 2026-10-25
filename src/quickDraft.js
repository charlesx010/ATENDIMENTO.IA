// Marco zero: formatação local de conteúdo clínico explicitamente informado.
// Não formula diagnósticos, não presume exame normal, não escolhe terapêutica.
export const SECTIONS = ['QUEIXA','HDA','EXAME FÍSICO','RX / EXAMES','CONDUTA'];
const MARKERS=[
 {key:'QUEIXA',regex:/^(?:queixa(?: principal)?|qp|motivo da consulta)\s*[:\-–]\s*/i},
 {key:'HDA',regex:/^(?:hda|hist[oó]ria da doen[cç]a atual|hist[oó]ria|relato)\s*[:\-–]\s*/i},
 {key:'EXAME FÍSICO',regex:/^(?:exame f[ií]sico|exame|ef|ao exame)\s*[:\-–]\s*/i},
 {key:'RX / EXAMES',regex:/^(?:rx(?: p[oó]s[- ]?redu[cç][aã]o)?|radiografia|tomografia|tc|resson[aâ]ncia|rm|usg|exames?)\s*[:\-–]\s*/i},
 {key:'CONDUTA',regex:/^(?:cd|conduta|plano|tratamento|orienta[cç][oõ]es)\s*[:\-–]\s*/i}
];
const prefix=/^\s*(?:DITADO DO NAVEGADOR \(REVISAR\)|TRANSCRIÇÃO BRUTA \(REVISAR\)):\s*/gim;
export function splitNote(source){
 const clean=String(source??'').replace(prefix,'').replace(/\r\n?/g,'\n').trim();
 // Quebra frases apenas quando há espaço após . ! ?; números decimais são preservados.
 return clean.split(/\n+|(?<=[.!?])\s+(?=[\p{L}])/u).map(v=>v.trim()).filter(Boolean);
}
export function classifyNote(source){
 const sections=Object.fromEntries(SECTIONS.map(k=>[k,[]]));
 const unmatched=[];
 let current=null;
 for(const chunk of splitNote(source)){
   const marker=MARKERS.find(x=>x.regex.test(chunk));
   if(marker){
     current=marker.key;
     const plain=chunk.replace(marker.regex,'').trim();
     if(plain)sections[current].push(plain);
     continue;
   }
   // A partir de marcador explícito, frases seguintes pertencem à mesma seção.
   // Cabeçalhos iniciados por # podem ser usados como QUEIXA em modelos rápidos.
   if(/^#\s*DOR\s+(?:EM|NO|NA)\b/i.test(chunk) && !current){
     sections.QUEIXA.push(chunk.replace(/^#\s*/,''));
     continue;
   }
   if(current){sections[current].push(chunk);continue;}
   // Enunciados típicos de exame físico são classificados literalmente.
   if(/^(?:sinal\s+(?:da|de|do)|arco\s+de\s+movimento|adm\b|nv\b|neurovascular\b|perfus[aã]o\b|boa\s+perfus[aã]o|d[oó]r\s+[aà]\s+palpa[cç][aã]o|sem\s+edemas?\b|sem\s+hematomas?\b|sem\s+sinais\b|deambulando\b|las[eè]gue\b|pronossupina[cç][aã]o\b)/i.test(chunk)){
     sections['EXAME FÍSICO'].push(chunk);
     continue;
   }
   // Conteúdo sem marcador é HDA apenas quando inicia com relato clínico.
   if(/^(?:paciente|refere|relata|informa|nega|apresenta|queixa[- ]se|hist[oó]rico\s+de|h[aá]\s+\d+\s+dias?)(?![\p{L}\p{N}])/iu.test(chunk)){
     sections.HDA.push(chunk);continue;
   }
   // Nunca classificar automaticamente números de medicamentos, achados ou condutas.
   unmatched.push(chunk);
 }
 return {sections,unmatched};
}
export function formatNarrative(source,{caps=true}={}){
 const {sections,unmatched}=classifyNote(source);
 let hda=sections.HDA.join(' ');
 const queixa=sections.QUEIXA.join(' ');
 const exam=sections['EXAME FÍSICO'].join(' ');
 const images=sections['RX / EXAMES'].join(' ');
 const plan=sections.CONDUTA.join(' ');
 const entries=[
  ['QUEIXA',queixa],
  ['HDA',hda],
  ['EXAME FÍSICO',exam],
  ['RX / EXAMES',images],
  ['CONDUTA',plan]
 ].filter(([label,content])=>label!=='RX / EXAMES'||content);
 const output=entries.map(([label,value])=>label+':'+(value?' '+value:'')).join('\n\n');
 const footer=unmatched.length?'\n\nINFORMAÇÕES A CLASSIFICAR: '+unmatched.join(' '):'';
 const final=(output+footer).trim();
 return caps?final.toLocaleUpperCase('pt-BR'):final;
}
export function insertConfirmedExam(note,findings,{caps=true}={}){
 const valid=(findings||[]).map(v=>String(v||'').trim()).filter(Boolean);
 if(!valid.length)return String(note||'');
 // Nunca altera trecho de exame pré-existente, apenas acrescenta o que foi confirmado.
 const text=String(note||'');
 const marker=/^(EXAME F[IÍ]SICO:[ \t]*)([^\n]*)/im;
 if(!marker.test(text))return text;
 return text.replace(marker,(_all,title,value)=>{
  const portion=valid.map(item=>caps?item.toLocaleUpperCase('pt-BR'):item);
  const base=String(value||'').trim();
  const notDup=portion.filter(item=>!base.toLocaleLowerCase('pt-BR').includes(item.toLocaleLowerCase('pt-BR')));
  return title.trimEnd()+' '+(base?(base.replace(/[.]$/,'')+(notDup.length?'. ':'') ):'')+notDup.join('; ')+(notDup.length?'.':'');
 });
}
export const wordCount=value=>String(value||'').trim().split(/\s+/).filter(Boolean).length;
