// Catálogo inicial de queixas ortopédicas a partir dos modelos fornecidos pelo médico.
// Isto NÃO é base de condutas nem laudo de exame. Somente perguntas/achados
// de documentação, cuja resposta depende de confirmação pelo profissional.
export const COMPLAINTS = [
 {id:'joelho',label:'Joelho',pattern:/\b(?:joelh[oa]s?|gonalgia|patel(?:a|ar|ofemoral)|menisc(?:o|al))\b/i},
 {id:'ombro',label:'Ombro',pattern:/\b(?:ombros?|glenoumeral|manguito)\b/i},
 {id:'mao',label:'Mão',pattern:/\b(?:m[aã]os?|metacarpos?)\b/i},
 {id:'dedo',label:'Dedo',pattern:/\b(?:dedos?|falanges?)\b/i},
 {id:'tornozelo',label:'Tornozelo',pattern:/\b(?:tornozelos?|tnz|maleolares?|mal[eé]olo)\b/i},
 {id:'pe',label:'Pé',pattern:/(?:^|[^\p{L}])(?:pé|pés|pe|pes|podod[aá]ctilo)(?=$|[^\p{L}])/iu},
 {id:'punho',label:'Punho',pattern:/\b(?:punhos?|carpo)\b/i},
 {id:'cotovelo',label:'Cotovelo',pattern:/\b(?:cotovelos?)\b/i},
 {id:'quadril',label:'Quadril',pattern:/\b(?:quadris|quadril|coxofemoral|transtrocanteriana)\b/i},
 {id:'coluna',label:'Coluna lombar',pattern:/\b(?:lombalgias?|lombares?|lombar|coluna)\b/i}
];
export const KNEE_GROUPS = [
 {id:'dor',title:'Dor à palpação',choices:['DOR À PALPAÇÃO DO JOELHO','SEM DOR À PALPAÇÃO DO JOELHO']},
 {id:'edema',title:'Edema',choices:['SEM EDEMA','EDEMA PRESENTE']},
 {id:'hematoma',title:'Hematoma',choices:['SEM HEMATOMA','HEMATOMA PRESENTE']},
 {id:'adm',title:'Amplitude de movimento',choices:['ADM PRESERVADA','ADM LIMITADA PELA DOR']},
 {id:'derrame',title:'Derrame articular',choices:['SEM DERRAME ARTICULAR','DERRAME ARTICULAR PRESENTE']},
 {id:'extensor',title:'Mecanismo extensor',choices:['MECANISMO EXTENSOR PRESERVADO','MECANISMO EXTENSOR ALTERADO']},
 {id:'ligamentos',title:'Estabilidade ligamentar',choices:['SEM INSTABILIDADE NOS TESTES REALIZADOS','INSTABILIDADE LIGAMENTAR IDENTIFICADA']},
 {id:'apoio',title:'Capacidade de apoio',choices:['APOIO PRESERVADO','APOIO LIMITADO PELA DOR','SEM CAPACIDADE DE APOIO']},
 {id:'nv',title:'Avaliação neurovascular',choices:['NEUROVASCULAR PRESERVADO','ALTERAÇÃO NEUROVASCULAR IDENTIFICADA']},
 {id:'perfusao',title:'Perfusão distal',choices:['BOA PERFUSÃO DISTAL','PERFUSÃO DISTAL ALTERADA']}
];

export function identifyComplaint(source){
  const value=String(source||'').normalize('NFC');
  const matched=COMPLAINTS.find(x=>x.pattern.test(value));
  return matched?{id:matched.id,label:matched.label}:null;
}
export function confirmedKneeFindings(selections){
  return confirmedRegionFindings('joelho',selections);
}

/*
 * Modelos documentais inspirados pelos resumos TEOT 2021 fornecidos pelo usuário.
 * Nomes de testes não equivalem a diagnósticos. "Não informado" é o padrão.
 * Fonte: Joelho p.3-4; Ombro p.3-4; Tornozelo p.3-4.
 * Validação editorial/clínica pendente antes de usar com pacientes reais.
 */
export const SHOULDER_GROUPS = [
 {id:'dor',title:'Palpação',choices:['DOR À PALPAÇÃO DO OMBRO','SEM DOR À PALPAÇÃO DO OMBRO']},
 {id:'adm',title:'Amplitude de movimento',choices:['ADM PRESERVADA','ADM LIMITADA PELA DOR']},
 {id:'edema',title:'Edema',choices:['SEM EDEMA','EDEMA PRESENTE']},
 {id:'deformidade',title:'Deformidade',choices:['SEM DEFORMIDADE EVIDENTE','DEFORMIDADE EVIDENTE']},
 {id:'nv',title:'Avaliação neurovascular',choices:['NEUROVASCULAR PRESERVADO','ALTERAÇÃO NEUROVASCULAR IDENTIFICADA']},
 {id:'neer',title:'Teste de Neer',choices:['TESTE DE NEER NEGATIVO','TESTE DE NEER POSITIVO']},
 {id:'hawkins',title:'Teste de Hawkins',choices:['TESTE DE HAWKINS NEGATIVO','TESTE DE HAWKINS POSITIVO']},
 {id:'jobe',title:'Teste de Jobe',choices:['TESTE DE JOBE NEGATIVO','TESTE DE JOBE POSITIVO']},
 {id:'patte',title:'Teste de Patte',choices:['TESTE DE PATTE NEGATIVO','TESTE DE PATTE POSITIVO']},
 {id:'lift_off',title:'Lift-off (Gerber)',choices:['TESTE LIFT-OFF NEGATIVO','TESTE LIFT-OFF POSITIVO']}
];

export const ANKLE_GROUPS = [
 {id:'dor',title:'Palpação',choices:['DOR À PALPAÇÃO DO TORNOZELO','SEM DOR À PALPAÇÃO DO TORNOZELO']},
 {id:'edema',title:'Edema',choices:['SEM EDEMA','EDEMA PRESENTE']},
 {id:'hematoma',title:'Hematoma',choices:['SEM HEMATOMA','HEMATOMA PRESENTE']},
 {id:'adm',title:'Amplitude de movimento',choices:['ADM PRESERVADA','ADM LIMITADA PELA DOR']},
 {id:'apoio',title:'Capacidade de apoio',choices:['APOIO PRESERVADO','APOIO LIMITADO PELA DOR','SEM CAPACIDADE DE APOIO']},
 {id:'nv',title:'Avaliação neurovascular',choices:['NEUROVASCULAR PRESERVADO','ALTERAÇÃO NEUROVASCULAR IDENTIFICADA']},
 {id:'perfusao',title:'Perfusão distal',choices:['BOA PERFUSÃO DISTAL','PERFUSÃO DISTAL ALTERADA']},
 {id:'gaveta',title:'Gaveta anterior do tornozelo',choices:['GAVETA ANTERIOR DO TORNOZELO NEGATIVA','GAVETA ANTERIOR DO TORNOZELO POSITIVA']},
 {id:'varo',title:'Estresse em varo',choices:['ESTRESSE EM VARO NEGATIVO','ESTRESSE EM VARO POSITIVO']},
 {id:'valgo',title:'Estresse em valgo',choices:['ESTRESSE EM VALGO NEGATIVO','ESTRESSE EM VALGO POSITIVO']},
 {id:'pillings',title:'Teste de compressão lateral da perna (Pillings)',choices:['TESTE DE COMPRESSÃO LATERAL DA PERNA NEGATIVO','TESTE DE COMPRESSÃO LATERAL DA PERNA POSITIVO']},
 {id:'thompson',title:'Thompson — descrever resposta observada',choices:['FLEXÃO PLANTAR PRESENTE À COMPRESSÃO DO TRÍCEPS SURAL','AUSÊNCIA DE FLEXÃO PLANTAR À COMPRESSÃO DO TRÍCEPS SURAL']}
];

export const KNEE_EXTENDED_GROUPS = [
 ...KNEE_GROUPS,
 {id:'mcmurray',title:'Teste de McMurray',choices:['TESTE DE MCMURRAY NEGATIVO','TESTE DE MCMURRAY POSITIVO']},
 {id:'apley',title:'Teste de Apley',choices:['TESTE DE APLEY NEGATIVO','TESTE DE APLEY POSITIVO']},
 {id:'lachman',title:'Teste de Lachman',choices:['TESTE DE LACHMAN NEGATIVO','TESTE DE LACHMAN POSITIVO']},
 {id:'gaveta_anterior',title:'Gaveta anterior do joelho',choices:['GAVETA ANTERIOR DO JOELHO NEGATIVA','GAVETA ANTERIOR DO JOELHO POSITIVA']},
 {id:'gaveta_posterior',title:'Gaveta posterior do joelho',choices:['GAVETA POSTERIOR DO JOELHO NEGATIVA','GAVETA POSTERIOR DO JOELHO POSITIVA']}
];

const GROUPS_BY_REGION={joelho:KNEE_EXTENDED_GROUPS,ombro:SHOULDER_GROUPS,tornozelo:ANKLE_GROUPS};
export function getFindingGroups(region){ return GROUPS_BY_REGION[String(region||'')]||null; }
export function confirmedRegionFindings(region,selections){
 const groups=getFindingGroups(region);
 if(!groups)return [];
 return groups.flatMap(group=>group.choices.includes(selections?.[group.id])?[selections[group.id]]:[]);
}
