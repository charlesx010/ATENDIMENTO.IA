// Documentos instantâneos: 100% locais, sem token/API de IA.
// Campos clínicos só são extraídos de seções fornecidas pelo médico.
// Não gera diagnóstico, tratamento, doses, CID, afastamento ou atestado automaticamente.
const PLACEHOLDER='[PREENCHER]';
const EMPTY_HEADERS=new Set(['', '-', '—']);
export const QUICK_ACTIONS=[
 {id:'receita',name:'Receita',clinical:true},
 {id:'exames',name:'Pedido de exames',clinical:true},
 {id:'laudo',name:'Laudo',clinical:true},
 {id:'encaminhamento',name:'Encaminhamento',clinical:true},
 {id:'fisioterapia',name:'Fisioterapia',clinical:true},
 {id:'orientacoes',name:'Orientações',clinical:true},
 {id:'atestado',name:'Atestado',clinical:true},
 {id:'declaracao',name:'Declaração',clinical:true},
 {id:'conduta',name:'Conduta ortopédica',clinical:false}
];

// Lê seções em uma ou várias linhas, mesmo que "HDA:" esteja sozinha em uma
// linha e a história venha nas linhas seguintes. Nunca supõe informação ausente.
const HEADER_RE=/^(QUEIXA(?: PRINCIPAL)?|QP|HDA|HIST[OÓ]RIA DA DOEN[CÇ]A ATUAL|HIST[OÓ]RIA CL[IÍ]NICA|EXAME F[IÍ]SICO|EF|RX\s*\/\s*EXAMES|RX|EXAMES|CONDUTA|CD|TRATAMENTO|INFORMA[CÇ][OÕ]ES A CLASSIFICAR)\s*[:\-–]\s*(.*)$/iu;
function normalizeHeading(value){
 const h=value.toLocaleUpperCase('pt-BR').replace(/\s+/g,' ').trim();
 if(['QUEIXA','QUEIXA PRINCIPAL','QP'].includes(h))return 'QUEIXA';
 if(['HDA','HISTÓRIA DA DOENÇA ATUAL','HISTORIA DA DOENÇA ATUAL','HISTÓRIA CLÍNICA','HISTORIA CLÍNICA'].includes(h))return 'HDA';
 if(['EXAME FÍSICO','EXAME FISICO','EF'].includes(h))return 'EXAME';
 if(['RX','RX / EXAMES','EXAMES'].includes(h))return 'RX';
 if(['CONDUTA','CD','TRATAMENTO'].includes(h))return 'CONDUTA';
 return 'RELATO';
}
export function parseNoteSections(note=''){
 const parts={};
 let active=null;
 for(const rawLine of String(note||'').replace(/\r/g,'').split('\n')){
  const line=rawLine.trim();
  const found=HEADER_RE.exec(line);
  if(found){
   active=normalizeHeading(found[1]);
   const content=found[2].trim();
   if(content&&!EMPTY_HEADERS.has(content)){
    parts[active]=[parts[active],content].filter(Boolean).join(' ');
   }
   continue;
  }
  if(!line)continue;
  if(active)parts[active]=[parts[active],line].filter(Boolean).join(' ');
 }
 return parts;
}
// Caso a evolução ainda esteja vazia ou desatualizada, aproveita o relato
// original literalmente, sem atribuir-lhe diagnósticos ou achados de exame.
// Se a HDA já existe, jamais a substitui pelo bruto.
export function mergeDocumentContext(clinicalText='',rawText=''){
 const note=parseNoteSections(clinicalText);
 const raw=String(rawText||'').trim();
 if(!raw)return note;
 const rawSections=parseNoteSections(raw);
 for(const key of ['QUEIXA','HDA','EXAME','RX','CONDUTA']){
  if(!note[key]&&rawSections[key])note[key]=rawSections[key];
 }
 if(!note.HDA){
  const unstructured=raw.split(/\n+/).map(line=>line.trim()).filter(line=>line&&!HEADER_RE.test(line)).join(' ').trim();
  if(unstructured)note.RELATO=[note.RELATO,unstructured].filter(Boolean).join(' ');
 }
 if(!note.RELATO&&rawSections.RELATO)note.RELATO=rawSections.RELATO;
 return note;
}

const from=(value)=>String(value||'').trim()||PLACEHOLDER;
const cleanLine=(text)=>String(text||'').trim().replace(/\s+/g,' ');

export function getConfirmedRequests(note){
 const {CONDUTA}=parseNoteSections(note);
 if(!CONDUTA)return [];
 // Somente trechos explícitos iniciados com SOLICITO, sem inventar finalidade.
 return CONDUTA.split(/\s*\+\s*|;\s*/u).map(cleanLine)
   .filter(s=>/^SOLICITO (?:RADIOGRAFIA|TOMOGRAFIA|RESSONÂNCIA|ULTRASSONOGRAFIA|EXAME|HEMOGRAMA|DOSAGEM|AVALIAÇÃO)/iu.test(s));
}
export function getConfirmedGuidance(note){
 const {CONDUTA}=parseNoteSections(note);
 if(!CONDUTA)return [];
 // Instruções já confirmadas e redigidas: não transforma planos em atos concluídos.
 return CONDUTA.split(/\s*\+\s*|;\s*/u).map(cleanLine)
   .filter(s=>/^ORIENTO\b|^FORNEÇO ORIENTAÇÕES\b/iu.test(s));
}
function joinNote(lines,caps){const result=lines.join('\n').trim();return caps?result.toLocaleUpperCase('pt-BR'):result;}
function evidence(lines,parts){
 if(parts['HDA'])lines.push('HISTÓRIA INFORMADA: '+parts.HDA);
 else if(parts['RELATO'])lines.push('RELATO CLÍNICO NÃO CLASSIFICADO (REVISAR): '+parts.RELATO);
 if(parts['EXAME'])lines.push('EXAME FÍSICO REGISTRADO: '+parts.EXAME);
 if(parts['RX'])lines.push('EXAMES / RESULTADOS INFORMADOS: '+parts.RX);
}
export function buildQuickDocument(type,{caps=true,clinicalText='',rawText=''}={}){
 const parts=mergeDocumentContext(clinicalText,rawText);
 const complaint=from(parts.QUEIXA||parts.HDA||parts.RELATO);
 const lines=[];
 switch(type){
 case 'receita':
  lines.push('RECEITUÁRIO — RASCUNHO','MEDICAMENTO E APRESENTAÇÃO: '+PLACEHOLDER,
   'DOSE, VIA E INTERVALO: '+PLACEHOLDER,'DURAÇÃO E QUANTIDADE: '+PLACEHOLDER,
   'ORIENTAÇÕES ESPECÍFICAS: '+PLACEHOLDER,'DATA, CRM E ASSINATURA: '+PLACEHOLDER);
  break;
 case 'exames':
  lines.push('PEDIDO DE EXAMES — RASCUNHO',
   'EXAME(S) SOLICITADO(S): '+from(getConfirmedRequests(clinicalText||rawText).join('; ')),
   'MOTIVO CLÍNICO: '+complaint,
   'JUSTIFICATIVA E REGIÃO ANATÔMICA: '+PLACEHOLDER,
   'PRIORIDADE: '+PLACEHOLDER,'DATA, CRM E ASSINATURA: '+PLACEHOLDER);
  break;
 case 'laudo':
  lines.push('LAUDO MÉDICO — RASCUNHO','QUEIXA: '+complaint);
  evidence(lines,parts);
  lines.push('DIAGNÓSTICO CONFIRMADO (SE HOUVER): '+PLACEHOLDER,
   'LIMITAÇÕES FUNCIONAIS ATESTADAS: '+PLACEHOLDER,
   'CONCLUSÃO CLÍNICA: '+PLACEHOLDER,
   'LOCAL, DATA, CRM E ASSINATURA: '+PLACEHOLDER);
  break;
 case 'encaminhamento':
  lines.push('ENCAMINHAMENTO MÉDICO — RASCUNHO',
   'ESPECIALIDADE / DESTINO: '+PLACEHOLDER,
   'MOTIVO DO ENCAMINHAMENTO: '+complaint);
  evidence(lines,parts);
  lines.push('OBJETIVO / PRIORIDADE: '+PLACEHOLDER,
   'LOCAL, DATA, CRM E ASSINATURA: '+PLACEHOLDER);
  break;
 case 'fisioterapia':
  lines.push('ENCAMINHAMENTO PARA FISIOTERAPIA — RASCUNHO',
   'QUEIXA / JUSTIFICATIVA: '+complaint,
   'NECESSIDADE E OBJETIVOS CONFIRMADOS: '+PLACEHOLDER,
   'PLANO DEFINIDO PELO MÉDICO: '+PLACEHOLDER,
   'LOCAL, DATA, CRM E ASSINATURA: '+PLACEHOLDER);
  break;
 case 'orientacoes':
  lines.push('ORIENTAÇÕES DE ATENDIMENTO — RASCUNHO',
   'MOTIVO DO ATENDIMENTO: '+complaint,
   'ORIENTAÇÕES EFETIVAMENTE FORNECIDAS: '+from(getConfirmedGuidance(clinicalText||rawText).join('; ')),
   'SINAIS DE ALERTA E RETORNO: '+PLACEHOLDER,
   'ACOMPANHAMENTO: '+PLACEHOLDER);
  break;
 case 'atestado':
  lines.push('ATESTADO MÉDICO — RASCUNHO',
   'PACIENTE: '+PLACEHOLDER,
   'TEXTO DO ATESTADO (APÓS AVALIAÇÃO): '+PLACEHOLDER,
   'AFASTAMENTO E PERÍODO, SE INDICADOS: '+PLACEHOLDER,
   'CID APENAS SE CABÍVEL E AUTORIZADO: '+PLACEHOLDER,
   'LOCAL, DATA, CRM E ASSINATURA: '+PLACEHOLDER);
  break;
 case 'declaracao':
  lines.push('DECLARAÇÃO MÉDICA — RASCUNHO',
   'PESSOA E FATO OBJETIVAMENTE CONFIRMADOS: '+PLACEHOLDER,
   'INFORMAÇÕES PERTINENTES: '+PLACEHOLDER,
   'LOCAL, DATA, CRM E ASSINATURA: '+PLACEHOLDER);
  break;
 default: return '';
 }
 return joinNote(lines,caps);
}

export const AI_DOCUMENT_LINKS={
 laudo:'laudo',encaminhamento:'encaminhamento',fisioterapia:'fisioterapia',
 orientacoes:'orientacoes',exames:'exames',receita:'medicacao',atestado:'afastamento'
};
export function buildContextualDocument(type,{aiDocuments={},...context}={}){
 const base=buildQuickDocument(type,context);
 const key=AI_DOCUMENT_LINKS[type];
 const suggestion=typeof aiDocuments?.[key]==='string'?aiDocuments[key].trim():'';
 if(!suggestion)return base;
 const label=type==='receita'
  ?'POSSIBILIDADES FARMACOLÓGICAS PARA AVALIAÇÃO — NÃO É PRESCRIÇÃO'
  :type==='atestado'
  ?'ANÁLISE DE POSSÍVEL AFASTAMENTO — NÃO É ATESTADO'
  :type==='exames'
  ?'EXAMES A CONSIDERAR — NÃO SÃO PEDIDOS EMITIDOS'
  :'PROPOSTA DE IA NÃO VALIDADA — REVISAR COM O MÉDICO';
 return [base,'',label+':',suggestion].join('\n');
}
