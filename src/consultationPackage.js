export const DOCUMENT_SECTIONS=[
 ['evolucao','EVOLUÇÃO / REGISTRO CLÍNICO'],
 ['hipoteses','HIPÓTESES DIAGNÓSTICAS — RASCUNHO'],
 ['diferenciais','DIAGNÓSTICOS DIFERENCIAIS — RASCUNHO'],
 ['investigacao','INVESTIGAÇÃO / EXAME DIRIGIDO — RASCUNHO'],
 ['tratamento','CONDUTA / POSSIBILIDADES — RASCUNHO'],
 ['alertas','SINAIS DE ALERTA E REAVALIAÇÃO — RASCUNHO'],
 ['medicacao','RASCUNHO DE MEDICAÇÃO — NÃO É RECEITA EMITIDA'],
 ['orientacoes','ORIENTAÇÕES — RASCUNHO'],
 ['exames','EXAMES A CONSIDERAR — RASCUNHO'],
 ['fisioterapia','FISIOTERAPIA — RASCUNHO'],
 ['laudo','LAUDO / RELATÓRIO — RASCUNHO'],
 ['encaminhamento','ENCAMINHAMENTO — RASCUNHO'],
 ['afastamento','ATESTADO / AFASTAMENTO — RASCUNHO'],
 ['declaracao','DECLARAÇÃO — RASCUNHO']
];

export function buildFinalPackage({narrative='',documents={},pending=''}={}){
 const source={...documents,evolucao:narrative};
 const sections=DOCUMENT_SECTIONS.map(([id,label])=>({id,label,text:String(source[id]||'').trim()})).filter(item=>item.text);
 if(String(pending||'').trim())sections.push({id:'pendencias',label:'DADOS A CONFIRMAR — NÃO COPIAR COMO DOCUMENTO',text:String(pending).trim()});
 return sections;
}
export function packageAsText(input){
 return buildFinalPackage(input).map(section=>section.label+'\n'+section.text).join('\n\n');
}
