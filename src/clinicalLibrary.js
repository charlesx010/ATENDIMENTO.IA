// Biblioteca genérica para assistência documental. Frases opcionais precisam
// ser confirmadas pelo médico antes de entrar no texto de exame físico.
export const REGIONS=[
 {id:'ombro',name:'Ombro',findings:['ARCO DE MOVIMENTO LIMITADO PELA DOR','DOR À PALPAÇÃO','SEM EDEMA OU HEMATOMA','NEUROVASCULAR PRESERVADO','PERFUSÃO DISTAL PRESERVADA','SEM DEFORMIDADE EVIDENTE']},
 {id:'mao',name:'Mão / Dedos',findings:['DOR À PALPAÇÃO E MOBILIZAÇÃO','SEM EDEMA OU HEMATOMA','ADM PRESERVADA','NEUROVASCULAR PRESERVADO','BOA PERFUSÃO DISTAL','SEM ROTAÇÃO OU ENCURTAMENTO']},
 {id:'punho',name:'Punho',findings:['DOR À PALPAÇÃO E MOBILIZAÇÃO','ADM LIMITADA PELA DOR','SEM EDEMA OU HEMATOMA','NEUROVASCULAR PRESERVADO','BOA PERFUSÃO DISTAL']},
 {id:'cotovelo',name:'Cotovelo',findings:['DOR À PALPAÇÃO E MOBILIZAÇÃO','ADM LIMITADA PELA DOR','PRONOSSUPINAÇÃO PRESERVADA','SEM EDEMA OU HEMATOMA','NEUROVASCULAR PRESERVADO','BOA PERFUSÃO DISTAL']},
 {id:'joelho',name:'Joelho',findings:['DOR À PALPAÇÃO','ADM LIMITADA PELA DOR','SEM EDEMA OU HEMATOMA','SEM DERRAME ARTICULAR','MECANISMO EXTENSOR PRESERVADO','NEUROVASCULAR PRESERVADO','BOA PERFUSÃO DISTAL']},
 {id:'tornozelo',name:'Tornozelo / Pé',findings:['DOR À PALPAÇÃO E MOBILIZAÇÃO','SEM EDEMA OU HEMATOMA','ADM PRESERVADA','NEUROVASCULAR PRESERVADO','BOA PERFUSÃO DISTAL']},
 {id:'quadril',name:'Quadril',findings:['DOR À PALPAÇÃO E MOBILIZAÇÃO','ADM LIMITADA PELA DOR','NEUROVASCULAR PRESERVADO','BOA PERFUSÃO DISTAL','SEM EDEMA OU HEMATOMA']},
 {id:'coluna',name:'Coluna lombar',findings:['DEAMBULAÇÃO SEM AUXÍLIO','SEM CLAUDICAÇÃO','DOR À PALPAÇÃO LOMBAR','ADM PRESERVADA','LASÈGUE POSITIVO','LASÈGUE NEGATIVO']},
 {id:'geral',name:'Exame geral',findings:['BOM ESTADO GERAL','CONSCIENTE E ORIENTADO','RESPIRAÇÃO SEM DESCONFORTO','PERFUSÃO PERIFÉRICA PRESERVADA']}
];
export const DOCUMENT_TYPES=[
 {id:'receita',name:'Receita',icon:'pill'},
 {id:'exames',name:'Exames',icon:'flask-conical'},
 {id:'laudo',name:'Laudo',icon:'file-text'},
 {id:'encaminhamento',name:'Encaminhamento',icon:'send'},
 {id:'atestado',name:'Atestado',icon:'calendar-check'},
 {id:'orientacoes',name:'Orientações',icon:'heart-handshake'},
 {id:'declaracao',name:'Declaração',icon:'file-check'}
];
export function buildDocument(type,{caps=true,clinicalText=''}={}){
 const fragments={
  receita:[
   'RECEITUÁRIO — RASCUNHO',
   'MEDICAMENTO E APRESENTAÇÃO: [PREENCHER]',
   'POSOLOGIA, VIA E HORÁRIOS: [PREENCHER]',
   'DURAÇÃO / QUANTIDADE: [PREENCHER]',
   'ORIENTAÇÕES: [PREENCHER]',
   'DATA E ASSINATURA: [PREENCHER]'
  ],
  exames:[
   'SOLICITAÇÃO DE EXAMES — RASCUNHO',
   'EXAME(S) SOLICITADO(S): [PREENCHER]',
   'JUSTIFICATIVA CLÍNICA: [PREENCHER]',
   'PRIORIDADE: [PREENCHER]',
   'DATA E IDENTIFICAÇÃO: [PREENCHER]'
  ],
  laudo:[
   'LAUDO MÉDICO — RASCUNHO',
   'HISTÓRICO CLÍNICO CONFIRMADO: [PREENCHER]',
   'ACHADOS OBJETIVOS E EXAMES: [PREENCHER]',
   'DIAGNÓSTICO / HIPÓTESE, CONFORME CONFIRMADO: [PREENCHER]',
   'LIMITAÇÕES FUNCIONAIS: [PREENCHER]',
   'CONCLUSÃO: [PREENCHER]',
   'IDENTIFICAÇÃO E ASSINATURA: [PREENCHER]'
  ],
  encaminhamento:[
   'ENCAMINHAMENTO MÉDICO — RASCUNHO',
   'DESTINO / ESPECIALIDADE: [PREENCHER]',
   'MOTIVO: [PREENCHER]',
   'HISTÓRICO E EXAMES PERTINENTES: [PREENCHER]',
   'FINALIDADE / PRIORIDADE: [PREENCHER]',
   'IDENTIFICAÇÃO E ASSINATURA: [PREENCHER]'
  ],
  atestado:[
   'ATESTADO MÉDICO — RASCUNHO',
   'ATESTO QUE [IDENTIFICAÇÃO DO PACIENTE], APÓS AVALIAÇÃO MÉDICA, NECESSITA DE AFASTAMENTO POR [DURAÇÃO], A PARTIR DE [DATA].',
   'CID (SE PERTINENTE E AUTORIZADO): [PREENCHER]',
   'LOCAL, DATA, CRM E ASSINATURA: [PREENCHER]'
  ],
  orientacoes:[
   'ORIENTAÇÕES — RASCUNHO',
   'MOTIVO DO ATENDIMENTO: [PREENCHER]',
   'ORIENTAÇÕES REALMENTE FORNECIDAS: [PREENCHER]',
   'ALERTAS E RETORNO: [PREENCHER]',
   'ACOMPANHAMENTO: [PREENCHER]'
  ],
  declaracao:[
   'DECLARAÇÃO MÉDICA — RASCUNHO',
   'ATESTO PARA OS DEVIDOS FINS QUE [IDENTIFICAÇÃO E EVENTO CONFIRMADOS].',
   'INFORMAÇÕES PERTINENTES: [PREENCHER]',
   'LOCAL, DATA E ASSINATURA: [PREENCHER]'
  ]
 };
 const lines=fragments[type]||['DOCUMENTO — RASCUNHO','[PREENCHER]'];
 // Somente um bloco separado como material de consulta, sem preencher condutas
 // com base em informação insuficiente.
 if(clinicalText.trim())lines.push('','TRECHO DA EVOLUÇÃO PARA CONSULTA (REVISAR E COPIAR SOMENTE O NECESSÁRIO):',clinicalText.trim());
 const text=lines.join('\n');
 return caps?text.toLocaleUpperCase('pt-BR'):text;
}
