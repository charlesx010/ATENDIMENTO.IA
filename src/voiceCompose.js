// Composição de evolução por voz inteiramente no navegador.
// Nunca chama IA e só acrescenta as palavras ditadas pelo usuário.
export const VOICE_TARGETS=[
 {id:'HDA',label:'História clínica (HDA)'},
 {id:'EXAME FÍSICO',label:'Exame físico'},
 {id:'RX / EXAMES',label:'Exames / resultados'},
 {id:'CONDUTA',label:'Conduta / tratamento'},
 {id:'QUEIXA',label:'Queixa principal'}
];
const HEADING=/^(QUEIXA|HDA|EXAME F[IÍ]SICO|RX\s*\/\s*EXAMES|CONDUTA|CD)\s*[:\-–]\s*/iu;
const NOTE_HEADER=/^(QUEIXA|HDA|EXAME F[IÍ]SICO|RX\s*\/\s*EXAMES|CONDUTA)\s*:/iu;
export function buildVoiceAddition(source,selectedTarget='HDA'){
 const utterance=String(source||'').trim().replace(/\s+/g,' ');
 const explicit=HEADING.exec(utterance);
 const target=explicit?(explicit[1].toLocaleUpperCase('pt-BR')==='CD'?'CONDUTA':explicit[1].toLocaleUpperCase('pt-BR'))
  :(VOICE_TARGETS.some(x=>x.id===selectedTarget)?selectedTarget:'HDA');
 const content=utterance.replace(HEADING,'').trim();
 return {target,content};
}
export function appendVoiceToNote(current,utterance,target='HDA',{caps=true}={}){
 const addition=buildVoiceAddition(utterance,target);
 if(!addition.content)return String(current||'');
 const value=caps?addition.content.toLocaleUpperCase('pt-BR'):addition.content;
 const existing=String(current||'').trim();
 const standard=['QUEIXA','HDA','EXAME FÍSICO','RX / EXAMES','CONDUTA'];
 if(!existing){
  return standard.map(key=>key+':'+(key===addition.target?' '+value:'')).join('\n\n');
 }
 const lines=existing.split('\n');
 let headerLine=-1;
 for(let i=0;i<lines.length;i++){
  if(lines[i].trim().toLocaleUpperCase('pt-BR').startsWith(addition.target+':')){
   headerLine=i;break;
  }
 }
 if(headerLine<0)return existing+'\n\n'+addition.target+': '+value;
 const segmentStart=headerLine+1;
 let segmentEnd=lines.length;
 for(let i=segmentStart;i<lines.length;i++){
  if(NOTE_HEADER.test(lines[i].trim())){segmentEnd=i;break;}
 }
 const combined=lines.slice(headerLine,segmentEnd).join(' ').replace(/\s+/g,' ').trim();
 if(combined.toLocaleLowerCase('pt-BR').includes(value.toLocaleLowerCase('pt-BR')))return existing;
 const currentLine=lines[headerLine];
 if(currentLine.slice(currentLine.indexOf(':')+1).trim()){
  lines[headerLine]=currentLine.replace(/[.;\s]+$/,'')+'. '+value+'.';
 }else if(lines.slice(segmentStart,segmentEnd).some(line=>line.trim())){
  lines.splice(segmentEnd,0,value+'.');
 }else{
  lines[headerLine]=addition.target+': '+value;
 }
 return lines.join('\n');
}
