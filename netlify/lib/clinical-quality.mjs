// Verificações determinísticas, sem IA, para rascunhos de casos fictícios.
// Não estabelecem diagnóstico ou conduta: impedem aplicação automática de
// respostas sem história e sinalizam perda de detalhes críticos.
const HEADING=/^(QUEIXA|HDA|EXAME F[IÍ]SICO|RX\s*\/\s*EXAMES|CONDUTA)\s*:\s*(.*)$/iu;
const REQ=['QUEIXA','HDA','EXAME FÍSICO','CONDUTA'];
const normalise=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleUpperCase('pt-BR');
export function clinicalSections(text=''){
 const out={};
 let current='';
 for(const line of String(text||'').replace(/\r/g,'').split('\n')){
  const cleaned=line.trim();
  const found=HEADING.exec(cleaned);
  if(found){
   current=normalise(found[1]).replace(/\s+/g,' ').replace('EXAME FISICO','EXAME FÍSICO');
   if(!Object.hasOwn(out,current))out[current]='';
   if(found[2].trim())out[current]=[out[current],found[2].trim()].filter(Boolean).join(' ');
  }else if(current&&cleaned){
   out[current]=[out[current],cleaned].filter(Boolean).join(' ');
  }
 }
 return out;
}
function meaningfulNarrative(text){
 const clean=normalise(text).replace(/\[(?:PREENCHER|CONFIRMAR|DADOS INSUFICIENTES)\]/g,'')
  .replace(/[—.\s]/g,' ').trim();
 if(!clean||/^(?:SEM (?:DADOS|HISTORIA|INFORMACOES)|NAO (?:INFORMADO|FORNECIDO|RELATADO)|DADOS (?:AUSENTES|INSUFICIENTES)|A CONFIRMAR|PREENCHER)(?:[. !]*)$/.test(clean))return false;
 return clean.replace(/[^A-Z0-9]/g,'').length>=8;
}
export function reviewClinicalEvolution(evolution,sourceText=''){
 const sections=clinicalSections(evolution);
 const errors=[],warnings=[];
 for(const name of REQ){
  if(!Object.hasOwn(sections,name))errors.push('Ausência da seção '+name+'.');
 }
 if(!meaningfulNarrative(sections.HDA)){
  errors.push('A evolução veio sem história clínica aproveitável (HDA).');
 }
 const input=normalise(sourceText),out=normalise(evolution);
 const inputHas=(phrase)=>new RegExp('\\b'+phrase+'\\b','u').test(input);
 const outputHas=(phrase)=>new RegExp('\\b'+phrase+'\\b','u').test(out);
 const leftInput=inputHas('ESQUERD[AO]')||/ESQUERD[AO]/u.test(input);
 const rightInput=/DIREIT[AO]/u.test(input);
 const leftOutput=/ESQUERD[AO]/u.test(out);
 const rightOutput=/DIREIT[AO]/u.test(out);
 // Se a entrada só continha um lado, o aparecimento do oposto na evolução
 // é um risco objetivo, mas uma hipótese contralateral pode ser pertinente:
 // avise e mantenha a decisão médica, em vez de modificar silenciosamente.
 if(leftInput&&!rightInput&&rightOutput)warnings.push('Verifique a lateralidade: a evolução cita DIREITO, mas o relato citou ESQUERDO.');
 if(rightInput&&!leftInput&&leftOutput)warnings.push('Verifique a lateralidade: a evolução cita ESQUERDO, mas o relato citou DIREITO.');
 if(leftInput&&!rightInput&&!leftOutput)warnings.push('Lateralidade ESQUERDA do relato não localizada na evolução.');
 if(rightInput&&!leftInput&&!rightOutput)warnings.push('Lateralidade DIREITA do relato não localizada na evolução.');
 for(const m of input.matchAll(/\b\d+(?:[,.]\d+)?\s*(?:MG|MCG|UI|ML)\b/gu)){
  const amount=m[0].replace(/\s+/g,' ').trim();
  if(!out.includes(amount))warnings.push('Confira a quantidade ou dose '+amount+' informada no relato.');
 }
 // Conferir números e duração: omitir 'há 3 dias' pode alterar o sentido clínico.
 const durations=[...input.matchAll(/\b\d+(?:[,.]\d+)?\s*(?:HORAS?|DIAS?|SEMANAS?|MESES?|ANOS?)\b/gu)];
 for(const item of durations.slice(0,4)){
  const phrase=item[0].replace(/\s+/g,' ').trim();
  if(!out.includes(phrase))warnings.push('Tempo ou duração '+phrase+' não identificado na evolução.');
 }
 // Também sinalizar negativas novas, não presentes na fonte, sem afirmar
 // automaticamente que são erros: outras formulações podem ser equivalentes.
 for(const negative of ['SEM FEBRE','NEGA FEBRE','SEM TRAUMA','NEGA TRAUMA','SEM ALERGIAS','NEGA ALERGIAS']){
  if(out.includes(negative)&&!input.includes(negative)){
   warnings.push('Verifique negativa '+negative+' presente na evolução, mas não localizada no relato.');
  }
 }
 for(const negative of ['NEGA FEBRE','SEM FEBRE','NEGA TRAUMA','SEM TRAUMA','SEM ALERGIAS','NEGA ALERGIAS']){
  if(input.includes(negative)&&!out.includes(negative)){
   warnings.push('Negativa importante não identificada: '+negative+'.');
  }
 }
 if(sections.HDA&&sections['EXAME FÍSICO']&&normalise(sections.HDA)===normalise(sections['EXAME FÍSICO']))
  warnings.push('HDA e exame físico repetem exatamente o mesmo texto.');
 return {ok:errors.length===0,errors,warnings:[...new Set(warnings)].slice(0,8)};
}
