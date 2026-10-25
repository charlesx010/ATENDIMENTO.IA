import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFinalPackage,packageAsText} from '../src/consultationPackage.js';

test('pacote final inclui apenas seções preenchidas e rotula medicação como rascunho',()=>{
 const input={narrative:'Evolução revisada.',documents:{medicacao:'Possibilidade terapêutica.',exames:'',orientacoes:'Retorno se piora.'},pending:'Confirmar alergias.'};
 const sections=buildFinalPackage(input);
 assert.deepEqual(sections.map(item=>item.id),['evolucao','medicacao','orientacoes','pendencias']);
 const text=packageAsText(input);
 assert.match(text,/RASCUNHO DE MEDICAÇÃO — NÃO É RECEITA EMITIDA/);
 assert.match(text,/DADOS A CONFIRMAR/);
 assert.doesNotMatch(text,/EXAMES A CONSIDERAR/);
});
