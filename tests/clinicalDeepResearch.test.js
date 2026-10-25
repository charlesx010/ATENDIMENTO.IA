import test from 'node:test';
import assert from 'node:assert/strict';
import {inferPublicTopic,lookupEvidence,parsePubmedXml,evidenceInstructions} from '../netlify/lib/clinical-evidence.mjs';
import {DEEP_FIELDS,deepJsonSchema,brazilianClinicalPrompt,normalizeBrazilianText,validateDeepResult} from '../netlify/lib/deep-clinical.mjs';

const CASE='PACIENTE FICTÍCIO COM DOR NO JOELHO DIREITO HÁ 3 DIAS APÓS TRAUMA';
const data={
 queixa:'DOR NO JOELHO DIREITO',
 hda:'PACIENTE REFERE DOR APÓS TRAUMA HÁ 3 DIAS.',
 exame_fisico:'DOR À PALPAÇÃO.',
 exames_registrados:'',
 conduta_registrada:'',
 hipoteses:'SUSPEITA DE LESÃO DE PARTES MOLES; A CONFIRMAR.',
 diferenciais:'LESÃO MENISCAL, A AVALIAR CONFORME EXAME.',
 investigacao:'CONSIDERAR TESTES MENISCAIS E CRITÉRIOS PARA RADIOGRAFIA.',
 tratamento:'MEDIDAS NÃO FARMACOLÓGICAS A AVALIAR, SEM MEDICAMENTO DEFINIDO.',
 medicacao:'AVALIAR SEGURANÇA FARMACOLÓGICA.',
 reabilitacao:'AVALIAR SE HÁ NECESSIDADE DE FISIOTERAPIA.',
 afastamento:'SEM DADOS OCUPACIONAIS SUFICIENTES PARA DEFINIR PRAZO.',
 alertas:'AVALIAR URGÊNCIA SE HOUVER SINAIS NEUROVASCULARES.',
 pendencias:'CONFIRMAR A INTENSIDADE DA DOR E A CAPACIDADE DE APOIO.'
};
test('Esquema clínico separa HDA, exame, diagnóstico diferencial e conduta',()=>{
 assert.equal(DEEP_FIELDS.length,14);
 assert.ok(DEEP_FIELDS.includes('hda'));
 assert.ok(DEEP_FIELDS.includes('diferenciais'));
 const schema=deepJsonSchema();
 assert.deepEqual(schema.required,DEEP_FIELDS);
 assert.equal(schema.additionalProperties,false);
 assert.match(brazilianClinicalPrompt({caps:true}),/português brasileiro/i);
 assert.match(brazilianClinicalPrompt({caps:true}),/HDA ROBUSTA/);
});
test('Análise monta a evolução e disponibiliza hipóteses, diferenciais e plano sem laudo repetido',()=>{
 const result=validateDeepResult(data,CASE);
 assert.equal(result.ok,true);
 assert.match(result.text,/HDA:/);
 assert.match(result.documents.hipoteses,/PARTES MOLES/);
 assert.match(result.documents.diferenciais,/LESÃO MENISCAL/);
 assert.match(result.documents.tratamento,/MEDIDAS NÃO FARMACOLÓGICAS/);
 assert.equal(result.documents.laudo,undefined);
});
test('HDA ausente preserva transcrição original de maneira explicitamente não classificada',()=>{
 const r=validateDeepResult({...data,hda:''},'RELATO ORIGINAL:\\nPaciente fictício sofreu trauma de joelho há 3 dias.');
 assert.equal(r.ok,true);
 assert.match(r.text,/TRANSCRIÇÃO ORIGINAL SEM CLASSIFICAÇÃO/);
 assert.ok(r.warnings.some(v=>v.includes('não organizou a HDA')));
 assert.equal(validateDeepResult({...data,hda:''},'').ok,false);
});
test('Padroniza termos portugueses comuns para pt-BR',()=>{
 assert.equal(normalizeBrazilianText('UTENTE COM ECOGRAFIA E OXIGÉNIO'), 'PACIENTE COM ULTRASSONOGRAFIA E OXIGÊNIO');
});
test('Tema PubMed é pré-aprovado e nunca contém o relato clínico',()=>{
 const topic=inferPublicTopic(CASE+' Nome fictício XXXXXX');
 assert.equal(topic.query,'knee injuries');
 assert.equal(inferPublicTopic('queixa genérica incomum sem região'),null);
});
const XML='<PubmedArticleSet><PubmedArticle><MedlineCitation><PMID>12345</PMID><Article><ArticleTitle>Review of knee injury treatments</ArticleTitle><Journal><JournalIssue><PubDate><Year>2025</Year></PubDate></JournalIssue></Journal><Abstract><AbstractText Label="RESULTS">Review results from trials with important limitations in knee pain assessment and treatment.</AbstractText></Abstract></Article></MedlineCitation></PubmedArticle></PubmedArticleSet>';
test('Busca de PubMed encaminha somente tema genérico e devolve link verificável',async()=>{
 const seen=[];
 const fetcher=async url=>{
  seen.push(url);
  if(url.includes('esearch.fcgi'))return {ok:true,json:async()=>({esearchresult:{idlist:['12345']}})};
  return {ok:true,text:async()=>XML};
 };
 const answer=await lookupEvidence(CASE+' ID privado de teste 123-SECRET',{fetcher});
 assert.equal(answer.status,'found');
 assert.equal(answer.sources[0].pmid,'12345');
 assert.equal(answer.sources[0].url,'https://pubmed.ncbi.nlm.nih.gov/12345/');
 assert.ok(!seen.join(' ').includes('ID privado de teste'));
 assert.ok(!seen.join(' ').includes('JOELHO DIREITO'));
 assert.match(evidenceInstructions(answer),/PMID 12345/);
});
test('Pesquisa indisponível não impede a geração clínica',async()=>{
 const answer=await lookupEvidence(CASE,{fetcher:async()=>{throw Error('falha de rede');}});
 assert.equal(answer.status,'unavailable');
 assert.deepEqual(answer.sources,[]);
});
test('Extrator XML não aceita fontes sem resumo científico',()=>{
 assert.equal(parsePubmedXml('<PubmedArticle><PMID>12345</PMID><ArticleTitle>Título</ArticleTitle></PubmedArticle>').length,0);
});
