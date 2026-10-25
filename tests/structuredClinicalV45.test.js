import test from 'node:test';
import assert from 'node:assert/strict';
import {
 DEEP_FIELDS,deepJsonSchema,assembleClinicalEvolution,validateDeepResult,brazilianClinicalPrompt
} from '../netlify/lib/deep-clinical.mjs';

const base={
 queixa:'DOR EM COTOVELO ESQUERDO',
 hda:'PACIENTE FICTÍCIO REFERE QUEDA DE MOTOCICLETA HÁ 3 DIAS, EVOLUINDO COM DOR NO COTOVELO ESQUERDO, BLOQUEIO E LIMITAÇÃO DA PRONOSSUPINAÇÃO.',
 exame_fisico:'LIMITAÇÃO À MOBILIZAÇÃO DO COTOVELO ESQUERDO. AVALIAÇÃO NEUROVASCULAR NÃO INFORMADA.',
 exames_registrados:'',
 conduta_registrada:'INFORMA QUE FORAM SOLICITADOS EXAMES PRÉ-OPERATÓRIOS.',
 hipoteses:'SUSPEITA DE FRATURA DA CABEÇA DO RÁDIO; NECESSÁRIO CONFIRMAR IMAGEM.',
 diferenciais:'LUXAÇÃO DO COTOVELO OU LESÃO ASSOCIADA, CONFORME EXAME E IMAGEM.',
 investigacao:'CONFIRMAR DOCUMENTAÇÃO RADIOLÓGICA, EXAME NEUROVASCULAR E ARCO DE MOVIMENTO.',
 tratamento:'AVALIAR IMOBILIZAÇÃO E NECESSIDADE DE ABORDAGEM ESPECIALIZADA DE ACORDO COM EXAMES.',
 medicacao:'CONFIRMAR ALERGIAS E COMORBIDADES ANTES DE CONSIDERAR ANALGESIA.',
 reabilitacao:'CONSIDERAR REABILITAÇÃO APÓS DEFINIÇÃO DA LESÃO E ESTABILIDADE.',
 afastamento:'EXIGE AVALIAÇÃO FUNCIONAL E ATIVIDADE LABORAL.',
 alertas:'ALTERAÇÕES NEUROVASCULARES, DOR DESPROPORCIONAL OU PIORA FUNCIONAL EXIGEM REAVALIAÇÃO URGENTE.',
 pendencias:'IMAGENS; STATUS NEUROVASCULAR; OCUPAÇÃO; ALERGIAS.'
};
const raw='RELATO ORIGINAL:\nPaciente fictício caiu de moto há 3 dias, refere cotovelo esquerdo doloroso e bloqueio do movimento. Diz que solicitaram exames pré-operatórios.';

test('Saída estruturada monta todas as seções da evolução sem depender de títulos escritos pela IA',()=>{
 const r=validateDeepResult(base,raw);
 assert.equal(r.ok,true);
 assert.match(r.text,/QUEIXA: DOR EM COTOVELO ESQUERDO/);
 assert.match(r.text,/HDA: PACIENTE FICTÍCIO REFERE QUEDA/);
 assert.match(r.text,/EXAME FÍSICO: LIMITAÇÃO/);
 assert.match(r.text,/CONDUTA: INFORMA QUE FORAM SOLICITADOS/);
 assert.match(r.documents.hipoteses,/SUSPEITA/);
 assert.match(r.documents.diferenciais,/LUXAÇÃO/);
 assert.match(r.documents.investigacao,/NEUROVASCULAR/);
 assert.match(r.documents.tratamento,/IMOBILIZAÇÃO/);
});
test('Se a IA não escreveu a HDA, mantém literalmente a transcrição e avisa para revisar',()=>{
 const r=assembleClinicalEvolution({...base,hda:''},raw);
 assert.equal(r.ok,true);
 assert.match(r.text,/HDA: \[TRANSCRIÇÃO ORIGINAL SEM CLASSIFICAÇÃO/);
 assert.match(r.text,/caiu de moto há 3 dias/);
 assert.ok(r.warnings.some(x=>x.includes('não organizou a HDA')));
});
test('Exame e resultados ausentes continuam vazios; nenhuma hipótese vira fato na conduta',()=>{
 const r=validateDeepResult({...base,exame_fisico:'',exames_registrados:'',conduta_registrada:''},raw);
 assert.equal(r.ok,true);
 assert.match(r.text,/EXAME FÍSICO:\n\nRX \/ EXAMES:\n\nCONDUTA:$/);
 assert.doesNotMatch(r.text,/FRATURA CONFIRMADA/);
 assert.match(r.documents.hipoteses,/SUSPEITA/);
});
test('Sem relato aproveitável não gera história inventada',()=>{
 const bad=assembleClinicalEvolution({...base,hda:''},'');
 assert.equal(bad.ok,false);
});
test('JSON estrito exige todos os campos clínicos e nunca faz sugestão ser fato registrado',()=>{
 assert.equal(deepJsonSchema().required.length,14);
 assert.equal(deepJsonSchema().additionalProperties,false);
 assert.equal(validateDeepResult({...base,hipoteses:undefined},raw).ok,false);
});
test('Prompt instrui separação factual, diferenciais e terapêutica condicionada',()=>{
 const p=brazilianClinicalPrompt({caps:true});
 assert.match(p,/HDA ROBUSTA/);
 assert.match(p,/exame_fisico/);
 assert.match(p,/diferenciais/);
 assert.match(p,/não forneça dose|não forneça dose|não forneça dose|sem idade|posologia/i);
});
