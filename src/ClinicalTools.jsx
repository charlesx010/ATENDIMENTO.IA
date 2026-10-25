import React, { useState } from 'react';
import { ClipboardList, FileText, Pill, FlaskConical, ScrollText, HeartHandshake, MoreHorizontal, Copy, Check, ChevronDown, ChevronUp, ClipboardCheck, Sparkles } from 'lucide-react';
import { organizeNotesToSoap, formatOrganizedSoap } from './organizeSoap.js';

const TYPES = [
  { id:'soap', name:'SOAP', Icon:ClipboardList, primary:true },
  { id:'narrativa', name:'Evolução', Icon:FileText, primary:true },
  { id:'receita', name:'Receita', Icon:Pill, primary:true },
  { id:'exames', name:'Exames', Icon:FlaskConical, primary:true },
  { id:'laudo', name:'Laudo', Icon:ScrollText, primary:true },
  { id:'orientacoes', name:'Orientações', Icon:HeartHandshake, primary:true },
  { id:'atestado', name:'Atestado', Icon:FileText },
  { id:'fisioterapia', name:'Fisioterapia', Icon:HeartHandshake },
  { id:'preoperatorio', name:'Pré-operatório', Icon:ClipboardCheck },
  { id:'encaminhamento', name:'Encaminhamento', Icon:FileText },
  { id:'resumo', name:'Resumo', Icon:ClipboardList },
  { id:'soap_organizado', name:'SOAP organizado', Icon:Sparkles },
];

const empty = (value) => String(value ?? '').trim();
const blank = '[Preencher e conferir]';
const field = (label,value) => label + ': ' + empty(value);
function makeDraft(type, payload) {
  const patient = payload.patient || {};
  const soap = payload.soap || {};
  const notes = empty(payload.notes);
  const header = [
    empty(patient.name) ? 'PACIENTE: ' + empty(patient.name) : null,
    empty(patient.age) ? 'IDADE: ' + empty(patient.age) : null,
    empty(patient.date) ? 'DATA: ' + empty(patient.date) : null,
  ].filter(Boolean).join('\n');
  const withHeader = (title, body) => [title,header,body].filter(Boolean).join('\n\n');
  switch(type) {
    case 'soap':
      return withHeader('EVOLUÇÃO MÉDICA — SOAP', [
        field('S — Subjetivo',soap.subjective),
        field('O — Objetivo / exame físico',soap.objective),
        field('A — Avaliação / hipóteses',soap.assessment),
        field('P — Plano / conduta',soap.plan),
        notes ? '\nANOTAÇÕES NÃO CLASSIFICADAS (REVISAR):\n' + notes : ''
      ].filter(Boolean).join('\n\n'));
    case 'narrativa':
      return withHeader('EVOLUÇÃO MÉDICA — NARRATIVA', [
        field('História e queixas',notes), field('Exame físico',''),
        field('Avaliação clínica',''), field('Conduta e seguimento','')
      ].join('\n\n'));
    case 'receita':
      return withHeader('RECEITUÁRIO — RASCUNHO', [
        'MEDICAMENTO / APRESENTAÇÃO: ' + blank,
        'POSOLOGIA E VIA: ' + blank,
        'DURAÇÃO / QUANTIDADE: ' + blank,
        'ORIENTAÇÕES E ALERTAS: ' + blank,
        '\nDATA, IDENTIFICAÇÃO E ASSINATURA DO PRESCRITOR: ' + blank
      ].join('\n'));
    case 'exames':
      return withHeader('SOLICITAÇÃO DE EXAMES — RASCUNHO', [
        field('Exame(s) solicitado(s)',''),field('Justificativa / hipótese clínica',''),
        field('Prioridade e informações adicionais',''),
        '\nIDENTIFICAÇÃO E ASSINATURA DO PRESCRITOR: '+blank
      ].join('\n'));
    case 'laudo':
      return withHeader('LAUDO MÉDICO — RASCUNHO', [
        field('História clínica pertinente',''), field('Achados objetivos / exames',''),
        field('Diagnóstico (CID apenas se confirmado)',''),
        field('Limitações funcionais e conclusão',''),
        '\nDATA E IDENTIFICAÇÃO PROFISSIONAL: '+blank
      ].join('\n\n'));
    case 'orientacoes':
      return withHeader('ORIENTAÇÕES AO PACIENTE — RASCUNHO', [
        field('Diagnóstico ou motivo da consulta',''),field('Cuidados e orientações fornecidas',''),
        field('Medicações conforme prescrição revisada',''),
        field('Sinais de alerta e quando buscar assistência',''),
        field('Retorno e acompanhamento','')
      ].join('\n\n'));
    case 'atestado':
      return withHeader('ATESTADO MÉDICO — RASCUNHO', [
        'Atesto, mediante avaliação médica, que '+(empty(patient.name)||blank)+' necessita de afastamento por '+blank+' dia(s), a contar de '+blank+'.',
        '\nCID (somente quando houver autorização do paciente e indicação): '+blank,
        '\nLOCAL, DATA, CRM E ASSINATURA: '+blank
      ].join('\n'));
    case 'fisioterapia':
      return withHeader('ENCAMINHAMENTO PARA FISIOTERAPIA — RASCUNHO', [
        field('Região acometida / condição clínica',''),field('Achados e limitações funcionais',''),
        field('Objetivos da reabilitação',''),field('Restrições e precauções',''),
        field('Avaliação / plano a critério da fisioterapia',''),
        '\nIDENTIFICAÇÃO DO MÉDICO: '+blank
      ].join('\n\n'));
    case 'preoperatorio':
      return withHeader('AVALIAÇÃO PRÉ-OPERATÓRIA — RASCUNHO', [
        field('Procedimento proposto e caráter da cirurgia',''),
        field('Comorbidades, medicamentos e alergias',''),
        field('Anamnese, capacidade funcional e sinais vitais',''),
        field('Exame físico e exames complementares pertinentes',''),
        field('Avaliação e estratificação de risco fundamentada',''),
        field('Pendências, otimização e encaminhamentos',''),
        '\nCONCLUSÃO APÓS AVALIAÇÃO MÉDICA: '+blank
      ].join('\n\n'));
    case 'encaminhamento':
      return withHeader('ENCAMINHAMENTO MÉDICO — RASCUNHO', [
        field('Especialidade / serviço de destino',''),
        field('Motivo e história clínica',''),field('Exame físico e exames relevantes',''),
        field('Hipótese diagnóstica (se houver)',''),
        field('Urgência e finalidade do encaminhamento',''),
        '\nIDENTIFICAÇÃO E ASSINATURA DO MÉDICO: '+blank
      ].join('\n\n'));
    case 'resumo':
      return withHeader('RESUMO DA CONSULTA — RASCUNHO', [
        'REGISTROS FORNECIDOS PELO MÉDICO (NÃO INTERPRETADOS):\n'+(notes||blank),
        '\nDIAGNÓSTICOS CONFIRMADOS: '+blank,
        'CONDUTAS REALIZADAS: '+blank,
        'PENDÊNCIAS E SEGUIMENTO: '+blank,
      ].join('\n'));
    default: return '';
  }
}

const SOAP_FIELDS = [
  ['subjective','S · Subjetivo','Queixas, HDA e informações relatadas'],
  ['objective','O · Objetivo','Exame físico e achados comprovados'],
  ['assessment','A · Avaliação','Hipóteses ou diagnóstico informado'],
  ['plan','P · Plano','Conduta definida e seguimento']
];

export default function ClinicalTools({payload,onUpdate,caps=false,format='SOAP'}) {
  const [more,setMore]=useState(false);
  const [soapOpen,setSoapOpen]=useState(false);
  const [feedback,setFeedback]=useState('');
  const [soapPreview,setSoapPreview]=useState(null);
  const docType = payload.docType || '';
  const selected = TYPES.find(x=>x.id===docType);
  const ordered = format==='Narrativo' ? [TYPES[1],TYPES[0],...TYPES.slice(2)] : TYPES;
  const hasDocument = (type) => Object.prototype.hasOwnProperty.call(payload.documents||{},type) || (payload.docType===type && typeof payload.draft==='string' && payload.draft.length>0);
  const documentText = docType && Object.prototype.hasOwnProperty.call(payload.documents||{},docType)
    ? String(payload.documents[docType]??'') : (payload.draft||'');
  const legacyAvailable = Object.prototype.hasOwnProperty.call(payload.documents||{},'rascunho');
  function generate(type){
    if(type==='soap_organizado' && !hasDocument(type)) {prepareSoapPreview();return;}
    const exists=hasDocument(type);
    onUpdate(p=>{
      const documents={...(p.documents||{})};
      // Importa documentos de versoes anteriores, evitando apagar o rascunho atual.
      if(!Object.prototype.hasOwnProperty.call(documents,p.docType||'rascunho') && typeof p.draft==='string' && p.draft.length>0){
        documents[p.docType||'rascunho']=p.draft;
      }
      if(!Object.prototype.hasOwnProperty.call(documents,type)){
        const template=type==='rascunho' ? (documents.rascunho||'') : makeDraft(type,p);
        documents[type]=caps?template.toLocaleUpperCase('pt-BR'):template;
      }
      return {...p,documents,docType:type,draft:documents[type]};
    });
    setFeedback(exists?'Documento existente reaberto sem alterações.':'Novo modelo criado. Outros documentos permanecem salvos.');
  }
  function replaceTemplate(){
    if(!docType||docType==='rascunho'||docType==='soap_organizado')return;
    if(!window.confirm('Recriar este modelo apagará somente o texto atual deste documento. Continuar?'))return;
    onUpdate(p=>{
      const fresh=makeDraft(docType,p);
      const next=caps?fresh.toLocaleUpperCase('pt-BR'):fresh;
      return {...p,documents:{...(p.documents||{}),[docType]:next},draft:next,docType};
    });
    setFeedback('Modelo recriado. Confira antes de utilizar.');
  }
  function editDocument(value){
    onUpdate(p=>{
      const current=p.docType||'rascunho';
      return {...p,docType:current,draft:value,documents:{...(p.documents||{}),[current]:value}};
    });
    setFeedback('');
  }
  function prepareSoapPreview(){
    const source=String(payload.notes||'');
    if(!source.trim()){
      setFeedback('Insira ou dite anotações fictícias antes de organizar em SOAP.');
      setSoapPreview(null);
      return;
    }
    const organized=organizeNotesToSoap(source);
    const output=formatOrganizedSoap(organized,payload.patient||{});
    setSoapPreview({notesSnapshot:source,organized,output});
    setFeedback('');
  }
  function applySoapPreview(){
    if(!soapPreview)return;
    if(String(payload.notes||'')!==soapPreview.notesSnapshot){
      setFeedback('As anotações mudaram. Gere outra prévia para não usar texto antigo.');
      return;
    }
    const existing=payload.documents?.soap_organizado;
    if(existing && !window.confirm('Substituir apenas o SOAP organizado anterior? O SOAP manual, receitas, exames e anotações originais serão preservados.'))return;
    const output=caps?soapPreview.output.toLocaleUpperCase('pt-BR'):soapPreview.output;
    onUpdate(p=>({
      ...p,
      documents:{...(p.documents||{}),soap_organizado:output},
      docType:'soap_organizado',
      draft:output
    }));
    setSoapPreview(null);
    setFeedback('Rascunho SOAP organizado salvo separadamente. Revise antes de utilizar.');
  }
  function updateSoap(key,value){
    onUpdate(p=>({...p,soap:{...(p.soap||{}),[key]:value}}));
    setFeedback('');
  }
  async function copyDraft(){
    try{
      await navigator.clipboard.writeText(documentText);
      setFeedback('Documento copiado.');
    }catch{setFeedback('Não foi possível copiar. Selecione e copie o texto manualmente.');}
  }
  return <section className="panel clinical-tools" aria-label="Documentos clínicos">
    <div className="panel-heading"><div><h3><FileText size={18}/> Documentos em um toque</h3><p>Escolha um modelo para gerar um rascunho editável. Nenhuma conduta é inventada automaticamente.</p></div></div>
    <div className="clin-section-title">Documentos rápidos</div>
    <div className="clin-tool-grid">
      {ordered.filter(x=>x.primary).map(({id,name,Icon})=><button key={id} className={'clin-tool'+(docType===id?' selected':'')} type="button" onClick={()=>generate(id)}><Icon size={20}/><span>{name}</span>{hasDocument(id)&&<Check className="clin-saved-mark" size={12}/>}</button>)}
    </div>
    <div className="clin-soap-organizer">
      <div>
        <strong><Sparkles size={17}/> Organizar anotações em SOAP</strong>
        <p>Gratuito, sem IA: só separa trechos literais identificáveis. Não interpreta exames, cria diagnósticos ou prescreve.</p>
      </div>
      <button className="btn outline" type="button" onClick={prepareSoapPreview} disabled={!empty(payload.notes)}>
        <ClipboardList size={16}/> Preparar SOAP
      </button>
    </div>
    {soapPreview&&<div className="clin-soap-preview">
      <strong>Prévia para revisão — ainda não salva</strong>
      <p>{soapPreview.organized.classifiedCount} trecho(s) classificados · {soapPreview.organized.unclassifiedCount} sem classificação.</p>
      {soapPreview.notesSnapshot!==String(payload.notes||'')&&<p className="clin-soap-warning">As anotações foram alteradas. Gere uma nova prévia antes de salvar.</p>}
      <textarea rows="12" readOnly aria-label="Prévia SOAP literal sem IA" value={soapPreview.output}/>
      <div className="clin-soap-preview-actions">
        <button type="button" className="btn primary" disabled={soapPreview.notesSnapshot!==String(payload.notes||'')} onClick={applySoapPreview}>
          <Check size={16}/> Criar SOAP organizado
        </button>
        <button type="button" className="btn outline" onClick={()=>setSoapPreview(null)}>Cancelar</button>
      </div>
      <p className="clin-disclaimer">O texto original permanece nas anotações. O documento SOAP manual não será substituído. Campos sem informação permanecem vazios.</p>
    </div>}
    <button className="clin-more" type="button" aria-expanded={more} onClick={()=>setMore(x=>!x)}><MoreHorizontal size={18}/> {more?'Ocultar documentos adicionais':'Mais documentos'} {more?<ChevronUp size={16}/>:<ChevronDown size={16}/>}</button>
    {more&&legacyAvailable&&<button className="clin-more" type="button" onClick={()=>generate("rascunho")}>Abrir rascunho anterior salvo</button>}
    {more&&<div className="clin-tool-grid">{ordered.filter(x=>!x.primary).map(({id,name,Icon})=><button key={id} className={'clin-tool'+(docType===id?' selected':'')} type="button" onClick={()=>generate(id)}><Icon size={20}/><span>{name}</span>{hasDocument(id)&&<Check className="clin-saved-mark" size={12}/>}</button>)}</div>}
    <div className="clin-soap">
      <button className="clin-section-toggle" onClick={()=>setSoapOpen(x=>!x)} type="button" aria-expanded={soapOpen}><ClipboardList size={17}/> Campos SOAP opcionais {soapOpen?<ChevronUp size={16}/>:<ChevronDown size={16}/>}</button>
      {soapOpen&&<div className="clin-soap-grid">{SOAP_FIELDS.map(([key,label,placeholder])=><label key={key}>{label}<textarea rows="3" placeholder={placeholder} value={payload.soap?.[key]||''} onChange={e=>updateSoap(key,e.target.value)}/></label>)}</div>}
    </div>
    <div className="clin-result-head"><div><strong>{docType==='soap_organizado'?'SOAP organizado — revisar': selected ? selected.name+' — rascunho' : docType==='rascunho'?'Rascunho anterior':'Editor de documentos'}</strong><small>{documentText.length} caracteres · Documento salvo junto com a consulta</small></div><button className="btn outline small" type="button" onClick={copyDraft} disabled={!empty(documentText)}><Copy size={15}/> Copiar</button></div>
    {docType&&docType!=='rascunho'&&docType!=='soap_organizado'&&hasDocument(docType)&&<button className="clin-more" type="button" onClick={replaceTemplate}>Recriar este modelo (apaga a edição deste documento)</button>}
    <textarea aria-label="Editor de documento médico" className="draft-editor clin-editor" rows="13" value={documentText} onChange={e=>editDocument(e.target.value)} placeholder="Selecione SOAP, Evolução, Receita ou outro modelo acima. Cada documento é preservado separadamente."/>
    {feedback&&<p className="clin-feedback"><Check size={15}/> {feedback}</p>}
    <p className="clin-disclaimer">Modelos estruturais, sem inteligência artificial. Preencha dados faltantes, confira tudo e assine apenas após avaliação profissional. Não utilize dados reais nesta versão de testes.</p>
  </section>;
}
