// Organização local, sem APIs ou modelos de linguagem.
// Só classifica trechos LITERAIS; jamais diagnostica, prescreve ou infere achados.
// Tudo o que não for identificável continua visível em "Não classificados".

const SECTION_PATTERNS = [
  ['subjective', /^(?:s|subjetivo|hda|hist[oó]ria da doen[cç]a atual|queixa principal|qp)\s*[:\-–]\s*/i],
  ['objective', /^(?:o|objetivo|exame f[ií]sico|exame cl[ií]nico|sinais vitais)\s*[:\-–]\s*/i],
  ['assessment', /^(?:a|avalia[cç][aã]o|hip[oó]tese diagn[oó]stica|impress[aã]o diagn[oó]stica|diagn[oó]stico)\s*[:\-–]\s*/i],
  ['plan', /^(?:p|plano|conduta|tratamento proposto|seguimento)\s*[:\-–]\s*/i],
];

const START_PATTERNS = [
  ['subjective', /^(?:paciente\s+(?:refere|relata|queixa(?:-se)?|informa|descreve|nega|com\s+(?:dor|queixa|dificuldade|limita[cç][aã]o))|refere|relata|queixa(?:-se)?|informa|nega|sem\s+hist[oó]rico|apresenta\s+(?:dor|dificuldade|queixa)|hist[oó]ria\s+de\s+(?:dor|queixa))\b/i],
  ['objective', /^(?:ao\s+exame|à\s+palpa[cç][aã]o|a\s+palpa[cç][aã]o|exame\s+f[ií]sico|sinais\s+vitais)\b/i],
  ['assessment', /^(?:hip[oó]tese\s+diagn[oó]stica|impress[aã]o\s+diagn[oó]stica|diagn[oó]stico\s+(?:informado|confirmado))\b/i],
  ['plan', /^(?:solicit[oa]|prescrev[oa]|encaminh[oa]|orient[oa]|conduta\s+proposta|retorno\s+em\b|foi\s+(?:solicitado|prescrito|encaminhado))\b/i],
];

const KEYS=['subjective','objective','assessment','plan'];

function normalizeSource(source){
  return String(source??'')
    .replace(/\r\n?/g,'\n')
    .replace(/^\s*DITADO DO NAVEGADOR \(REVISAR\):\s*/gim,'')
    .replace(/^\s*TRANSCRIÇÃO BRUTA \(REVISAR\):\s*/gim,'')
    .trim();
}
function splitStatements(source){
  // Não quebra números decimais (ex.: 2.5 mg), nem siglas.
  return normalizeSource(source)
    .split(/\n+|(?<=[!?])\s+(?=[\p{L}])|(?<=\.)\s+(?=[\p{L}])/u)
    .map(chunk=>chunk.trim())
    .filter(Boolean);
}

export function organizeNotesToSoap(rawNotes){
  const sections={subjective:[],objective:[],assessment:[],plan:[],unclassified:[]};
  const statements=splitStatements(rawNotes);
  let explicitSection=null;
  for(const statement of statements){
    let phrase=statement;
    let labeledSection=null;
    for(const [key,regex] of SECTION_PATTERNS){
      const match=phrase.match(regex);
      if(match){
        labeledSection=key;
        explicitSection=key;
        phrase=phrase.slice(match[0].length).trim();
        break;
      }
    }
    if(!phrase)continue;
    // Sem marcador expresso, apenas palavras introdutórias inequívocas
    // definem S/O/A/P; caso contrário preserva o contexto da seção expressa,
    // ou classifica como "não identificado".
    const direct=START_PATTERNS.find(([,regex])=>regex.test(phrase));
    const chosen=labeledSection||direct?.[0]||explicitSection||'unclassified';
    sections[chosen].push(phrase);
  }
  return {sections,source:normalizeSource(rawNotes),statementCount:statements.length,
    classifiedCount:KEYS.reduce((sum,k)=>sum+sections[k].length,0),
    unclassifiedCount:sections.unclassified.length};
}

export function formatOrganizedSoap(result,patient={}){
  const s=result?.sections||{};
  const data=[
    'EVOLUÇÃO SOAP — ORGANIZAÇÃO LITERAL (SEM IA)',
    'RASCUNHO — REVISÃO MÉDICA OBRIGATÓRIA',
    patient.name?'PACIENTE: '+String(patient.name):'',
    patient.age?'IDADE: '+String(patient.age):'',
    patient.date?'DATA: '+String(patient.date):'',
    '',
    'S — SUBJETIVO:',
    (s.subjective||[]).join(' ') || '',
    '',
    'O — OBJETIVO / EXAME FÍSICO:',
    (s.objective||[]).join(' ') || '',
    '',
    'A — AVALIAÇÃO / HIPÓTESES:',
    (s.assessment||[]).join(' ') || '',
    '',
    'P — PLANO / CONDUTA:',
    (s.plan||[]).join(' ') || '',
    '',
    'ANOTAÇÕES NÃO CLASSIFICADAS — REVISAR:',
    (s.unclassified||[]).join(' ') || '(nenhuma)',
    '',
    'AVISO: Campos vazios não significam achados normais. Todo texto acima deriva das anotações informadas e deve ser conferido. Não é diagnóstico nem conduta automática.'
  ];
  return data.join('\n').replace(/\n{3,}/g,'\n\n').trim();
}
