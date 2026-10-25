// Prontuário.IA: opções de documentação de CONDUTA.
// Não há recomendação terapêutica, cálculo de dose, prescrição ou decisão de alta
// automática. Apenas ações explicitamente selecionadas por profissional médico.
// Textos são rascunhos e devem ser revisados antes de entrar em prontuário real.
const GENERIC_GROUPS=[
 {id:'analgesia',title:'Analgesia / medicação',mode:'single',choices:[
   'PRESCREVO ANALGESIA',
   'ANALGESIA ADMINISTRADA',
   'PRESCREVO MEDICAÇÃO SINTOMÁTICA'
 ]},
 {id:'exames',title:'Exames solicitados',mode:'multiple',choices:[
   'SOLICITO RADIOGRAFIA',
   'SOLICITO TOMOGRAFIA COMPUTADORIZADA',
   'SOLICITO RESSONÂNCIA MAGNÉTICA',
   'SOLICITO ULTRASSONOGRAFIA'
 ]},
 {id:'orientacoes',title:'Orientações fornecidas',mode:'multiple',choices:[
   'ORIENTO REPOUSO RELATIVO DO SEGMENTO',
   'ORIENTO CRIOTERAPIA',
   'ORIENTO ELEVAÇÃO DO MEMBRO',
   'FORNEÇO ORIENTAÇÕES GERAIS',
   'ORIENTO RETORNO EM CASO DE PIORA OU SINAIS DE ALERTA'
 ]},
 {id:'destino',title:'Destino / acompanhamento',mode:'single',choices:[
   'ALTA APÓS REAVALIAÇÃO MÉDICA',
   'MANTENHO EM OBSERVAÇÃO',
   'ENCAMINHO PARA AVALIAÇÃO ORTOPÉDICA',
   'ORIENTO RETORNO AMBULATORIAL',
   'ENCAMINHO PARA AVALIAÇÃO HOSPITALAR'
 ]}
];
const REGION_OPTIONS={
 joelho:[
   {id:'imobilizacao',title:'Imobilização do joelho',mode:'single',choices:[
     'INDICO IMOBILIZAÇÃO DE JONES',
     'REALIZADA IMOBILIZAÇÃO DE JONES',
     'INDICO IMOBILIZADOR DE JOELHO',
     'REALIZADA IMOBILIZAÇÃO COM TALA'
   ]},
   {id:'apoio',title:'Orientação de apoio',mode:'single',choices:[
     'ORIENTO RESTRIÇÃO DE APOIO',
     'ORIENTO APOIO CONFORME TOLERÂNCIA'
   ]}
 ],
 ombro:[
   {id:'imobilizacao',title:'Imobilização do ombro',mode:'single',choices:[
     'INDICO TIPOIA SIMPLES',
     'TIPOIA SIMPLES COLOCADA',
     'INDICO IMOBILIZAÇÃO DE OMBRO',
     'IMOBILIZAÇÃO DE OMBRO REALIZADA'
   ]},
   {id:'acompanhamento',title:'Controle após procedimento',mode:'single',choices:[
     'SOLICITO RADIOGRAFIA DE CONTROLE PÓS-REDUÇÃO',
     'RADIOGRAFIA PÓS-REDUÇÃO AVALIADA'
   ]}
 ],
 tornozelo:[
   {id:'imobilizacao',title:'Imobilização do tornozelo',mode:'single',choices:[
     'INDICO TALA IMOBILIZADORA',
     'TALA IMOBILIZADORA COLOCADA',
     'INDICO BOTA IMOBILIZADORA',
     'BOTA IMOBILIZADORA COLOCADA'
   ]},
   {id:'apoio',title:'Orientação de apoio',mode:'single',choices:[
     'ORIENTO RESTRIÇÃO DE APOIO',
     'ORIENTO APOIO CONFORME TOLERÂNCIA'
   ]}
 ]
};

export const PLAN_REGIONS=[{id:'joelho',name:'Joelho'},{id:'ombro',name:'Ombro'},{id:'tornozelo',name:'Tornozelo'}];

export function getPlanGroups(region){
 const groups=REGION_OPTIONS[region];
 if(!groups)return null;
 return [GENERIC_GROUPS[0],GENERIC_GROUPS[1],...groups,GENERIC_GROUPS[2],GENERIC_GROUPS[3]];
}

export function confirmedPlanPhrases(region,answers={}){
 const groups=getPlanGroups(region);
 if(!groups)return [];
 return groups.flatMap(group=>{
  const answer=answers?.[group.id];
  if(group.mode==='multiple'){
   if(!Array.isArray(answer))return [];
   return group.choices.filter(choice=>answer.includes(choice));
  }
  return group.choices.includes(answer)?[answer]:[];
 });
}

export function insertPlanDetails(note,phrases,{caps=true}={}){
 const text=String(note??'');
 if(!Array.isArray(phrases)||!phrases.length)return text;
 const heading=/^([ \t]*(?:CONDUTA|CD):[ \t]*)([^\n]*)/im;
 if(!heading.test(text))return text;
 return text.replace(heading,(_match,label,existing)=>{
  const base=String(existing||'').trim();
  const selected=[...new Set(phrases.filter(v=>typeof v==='string'&&v.trim()).map(v=>v.trim()))];
  const baseTerms=base.split(/\s+\+\s+|;\s*/).map(s=>s.toLocaleLowerCase('pt-BR').replace(/[.]$/,'').trim());
  const fresh=selected.filter(value=>!baseTerms.includes(value.toLocaleLowerCase('pt-BR').replace(/[.]$/,'').trim()));
  if(!fresh.length)return label+base;
  const formatted=fresh.map(v=>caps?v.toLocaleUpperCase('pt-BR'):v);
  const parts=[base.replace(/[\s.;+]+$/,''),...formatted].filter(Boolean);
  return label.trimEnd()+' '+parts.join(' + ');
 });
}
