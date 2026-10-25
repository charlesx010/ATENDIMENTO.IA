// Biblioteca documental de HDA ortopédica. Nenhuma frase é presumida:
// a seleção manual representa informação relatada/confirmada pelo médico.
// Sem diagnóstico, prescrição, avaliação automática ou armazenamento.
export const HDA_REGIONS=[
 {id:'joelho',name:'Joelho',groups:[
   {id:'mecanismo',title:'Início / mecanismo',choices:['TRAUMA TORCIONAL DO JOELHO','TRAUMA DIRETO NO JOELHO','QUEDA DA PRÓPRIA ALTURA','INÍCIO SEM TRAUMA REFERIDO']},
   {id:'caracteristica',title:'Característica da dor',choices:['DOR À MOVIMENTAÇÃO','DOR À DEAMBULAÇÃO','DOR DURANTE ATIVIDADE ESPORTIVA','DOR EM REPOUSO']},
   {id:'limitacao',title:'Limitação funcional',choices:['DIFICULDADE PARA DEAMBULAR','DIFICULDADE PARA APOIAR O MEMBRO','LIMITAÇÃO PARA SUBIR ESCADAS','SEM LIMITAÇÃO FUNCIONAL REFERIDA']},
   {id:'associados',title:'Sintomas associados',choices:['SENSAÇÃO DE INSTABILIDADE','EPISÓDIOS DE BLOQUEIO ARTICULAR','ESTALIDOS ARTICULARES','EDEMA REFERIDO']}
 ]},
 {id:'ombro',name:'Ombro',groups:[
   {id:'mecanismo',title:'Início / mecanismo',choices:['TRAUMA DIRETO NO OMBRO','QUEDA DA PRÓPRIA ALTURA','INÍCIO INSIDIOSO','SINTOMAS APÓS ESFORÇO FÍSICO']},
   {id:'caracteristica',title:'Característica da dor',choices:['DOR À ELEVAÇÃO DO BRAÇO','DOR À ROTAÇÃO DO OMBRO','DOR NOTURNA','DOR EM REPOUSO']},
   {id:'limitacao',title:'Limitação funcional',choices:['DIFICULDADE PARA ELEVAR O MEMBRO','DIFICULDADE PARA VESTIR-SE','DIFICULDADE PARA ATIVIDADES ACIMA DA CABEÇA','SEM LIMITAÇÃO FUNCIONAL REFERIDA']},
   {id:'associados',title:'Sintomas associados',choices:['SENSAÇÃO DE INSTABILIDADE','ESTALIDOS','FRAQUEZA REFERIDA','PARESTESIAS REFERIDAS']}
 ]},
 {id:'tornozelo',name:'Tornozelo',groups:[
   {id:'mecanismo',title:'Início / mecanismo',choices:['ENTORSE DO TORNOZELO','TRAUMA DIRETO NO TORNOZELO','QUEDA DA PRÓPRIA ALTURA','INÍCIO SEM TRAUMA REFERIDO']},
   {id:'caracteristica',title:'Característica da dor',choices:['DOR AO APOIAR O PÉ','DOR À DEAMBULAÇÃO','DOR AO MOVIMENTAR O TORNOZELO','DOR EM REPOUSO']},
   {id:'limitacao',title:'Limitação funcional',choices:['DIFICULDADE PARA DEAMBULAR','DIFICULDADE PARA APOIAR O MEMBRO','INCAPACIDADE DE APOIO REFERIDA','SEM LIMITAÇÃO FUNCIONAL REFERIDA']},
   {id:'associados',title:'Sintomas associados',choices:['EDEMA REFERIDO','EQUIMOSE REFERIDA','SENSAÇÃO DE INSTABILIDADE','EPISÓDIOS RECORRENTES DE ENTORSE']}
 ]}
];
const FORMATS={horas:'HÁ {n} HORAS',dias:'HÁ {n} DIAS',semanas:'HÁ {n} SEMANAS',meses:'HÁ {n} MESES',anos:'HÁ {n} ANOS'};
export function getHdaGroups(id){return HDA_REGIONS.find(x=>x.id===id)?.groups||null;}
export function getConfirmedHdaDetails(region,selections={},duration='',durationUnit='dias',side=''){
 const groups=getHdaGroups(region);
 if(!groups)return [];
 const fragments=[];
 const number=String(duration??'').trim();
 if(/^[1-9]\d{0,3}$/.test(number)&&Object.prototype.hasOwnProperty.call(FORMATS,durationUnit)){
   fragments.push(FORMATS[durationUnit].replace('{n}',number));
 }
 if(side==='DIREITO'||side==='ESQUERDO'||side==='BILATERAL')fragments.push('LADO '+side);
 for(const group of groups){
  const selected=selections?.[group.id];
  if(group.choices.includes(selected))fragments.push(selected);
 }
 return fragments;
}
export function insertHdaDetails(note,fragments,{caps=true}={}){
 const text=String(note??'');
 const selected=Array.isArray(fragments)?fragments.filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim()):[];
 if(!selected.length)return text;
 const header=/^([ \t]*HDA:[ \t]*)([^\n]*)/im;
 const paragraphs=selected.map(v=>caps?v.toLocaleUpperCase('pt-BR'):v);
 if(!header.test(text))return text;
 return text.replace(header,(_match,prefix,line)=>{
  const body=String(line||'').trim();
  const normalizedBody=body.toLocaleLowerCase('pt-BR');
  const unique=[...new Set(paragraphs)].filter(v=>!normalizedBody.includes(v.toLocaleLowerCase('pt-BR')));
  if(!unique.length)return prefix+body;
  const joined=unique.join('; ');
  const suffix=body?body.replace(/[.;,\s]+$/,'')+'. '+joined+'.':joined+'.';
  return prefix+suffix;
 });
}
