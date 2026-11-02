import React from 'react';
import {canExport} from './model.js';
export default function ReviewedDocument({doc,format='soap'}) {
  if(!canExport(doc))return null;
  return <article className="w-print-document"><header><h1>Registro de atendimento</h1>{doc.patient&&<p>Identificador: {doc.patient}</p>}<p>Documento revisado pelo usuário · {new Date().toLocaleDateString('pt-BR')}</p></header>
    {doc.summary&&<section><h2>Resumo</h2><p>{doc.summary}</p></section>}
    {Object.entries({subjective:'História relatada',objective:'Exame e resultados informados',assessment:'Avaliação informada',plan:'Conduta informada'}).map(([key,label],index)=><section key={key}><h2>{format==='soap'?['S','O','A','P'][index]+' — ':''}{label}</h2><p>{doc.soap[key]||'Não informado'}</p></section>)}
    {doc.pending&&<section><h2>Pendências para conferência</h2><p>{doc.pending}</p></section>}
    <footer>Prontuário.IA · Documento de teste. A organização assistida não substitui a responsabilidade do profissional.</footer>
  </article>;
}
