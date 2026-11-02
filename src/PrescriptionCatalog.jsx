import React, {useEffect, useMemo, useRef, useState} from 'react';
import {BookOpen, Check, ChevronLeft, Copy, CornerDownRight, Scale, Search, ShieldAlert} from 'lucide-react';
import ReferenceShortcuts,{ReferenceFavoriteButton,useReferenceShortcuts} from './referenceShortcuts.jsx';
import {parsePatientWeight} from './patientWeight.js';
import pediatricData from './data/pediatric-v4.json';
import hospitalData from './data/hospitalar-v4.json';
import hospitalTables from './data/hospital-tables-v45.json';
import {formatPrescriptionRoutes} from './prescriptionFormatting.js';
import {evaluateCatalogAst as evaluateCalculator} from './catalogCalculator.js';
import {dischargeReferenceIds,resolveDischargeReferences} from './dischargeReferences.js';

const PEDIATRIC_WEIGHT_CHIPS = [5, 8, 10, 12, 15, 20, 25, 30];
const ADULT_WEIGHT_CHIPS = [10, 20, 50, 60, 70, 80, 90, 100];
const ALPHABET = ['Todas', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

async function copyText(text){
  if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return;}
  throw Error('Não foi possível copiar automaticamente neste navegador.');
}

function cleanPrescriptionForDisplay(text){
  return formatPrescriptionRoutes(String(text||'')
    .replace(/\s*\[F[oó]rmula Calculadora:[^\]]*\]/gi,'')
    .replace(/\n*---\nVERSÃO DE TESTE DO APP[\s\S]*$/i,'')
    .trim());
}

function stripAccents(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}

function formatCalculatedValue(value){
  if(!Number.isFinite(value)||value<0)throw Error('Resultado inválido.');
  return value.toLocaleString('pt-BR',{maximumFractionDigits:2,useGrouping:false});
}

function fillPediatricPrescription(choice,weight){
  let index=0;
  const calculators=choice?.calculators||[];
  const text=String(choice?.prescription||'').replace(/\{RESULTADO_CALCULADORA\}/g,()=>{
    const calculator=calculators[index++];
    return formatCalculatedValue(evaluateCalculator(calculator?.ast,weight));
  });
  if(index!==calculators.length)throw Error('A quantidade de resultados não corresponde à receita.');
  return cleanPrescriptionForDisplay(text);
}

function TreatmentDraft({entry,onClose,patientWeight='',onWeightChange=()=>{},onInsertInConduct=null,favorite=false,onFavorite=()=>{}}){
  const [choice,setChoice]=useState(entry.options?.[0]||null);
  const [reviewed,setReviewed]=useState(false);
  const [copied,setCopied]=useState(false);
  const [inserted,setInserted]=useState(false);
  const [copyError,setCopyError]=useState('');
  useEffect(()=>{setReviewed(false);setCopied(false);setInserted(false);setCopyError('');},[patientWeight]);

  useEffect(()=>{
    setChoice(entry.options?.[0]||null);
    setReviewed(false);
    setCopied(false);
    setInserted(false);
    setCopyError('');
  },[entry]);

  const requiresCalculator=Boolean(choice?.requiresCalculator);
  const {value:numericWeight,error:weightError}=parsePatientWeight(patientWeight);
  const calculationComplete=!requiresCalculator||(Number.isFinite(numericWeight)&&numericWeight>0);
  let displayedPrescription=cleanPrescriptionForDisplay(choice?.prescription||'');
  let calculationError='';
  let calculatedBadge='';

  if(requiresCalculator&&calculationComplete){
    try{
      displayedPrescription=fillPediatricPrescription(choice,numericWeight);
      if(choice?.calculators?.[0]){
        const c0=choice.calculators[0];
        const v0=formatCalculatedValue(evaluateCalculator(c0.ast,numericWeight));
        calculatedBadge=`${v0} ${c0.unit||'mL'}`;
      }
    }catch(error){
      calculationError=error.message;
    }
  }

  const pocketTable = choice?.pocketTable || choice?.calculators?.[0]?.pocketTable || '';
  const weightChips = entry.setting === 'Pediatria' ? PEDIATRIC_WEIGHT_CHIPS : ADULT_WEIGHT_CHIPS;

  async function copyPrescription(){
    if(!choice||!reviewed||!calculationComplete||calculationError)return;
    setCopyError('');
    try{await copyText(displayedPrescription);setCopied(true);}catch{setCopied(false);setCopyError('Não foi possível copiar. Selecione o texto da receita e copie manualmente.');}
  }

  function insertPrescription(){
    if(!choice||!reviewed||!calculationComplete||calculationError||!onInsertInConduct)return;
    onInsertInConduct(displayedPrescription, entry.name);
    setInserted(true);
  }

  return <section className="rx-detail" aria-label={"Ficha terapêutica de "+entry.name}>
    <button type="button" className="btn outline small rx-mobile-back" onClick={onClose}><ChevronLeft size={15}/> Trocar patologia</button>
    <header>
      <div>
        <p className="rx-eyebrow">{entry.audience} · {entry.setting}{entry.cid10?` · CID-10: ${entry.cid10}`:''}</p>
        <h2>{entry.name}</h2>
        {entry.category==='CLASSE_FARMACOLOGICA'&&<p>Classe farmacológica · opções alternativas para seleção individual.</p>}
        {entry.tags?<p className="rx-tags-line">Busca rápida: {entry.tags}</p>:null}
      </div>
      <span>{entry.status}</span>
    </header>
    <ReferenceFavoriteButton kind="receita" favorite={favorite} onClick={onFavorite}/>
    {!entry.options?<p className="rx-notice"><ShieldAlert size={16}/> Esta condição ainda não possui opções terapêuticas liberadas para revisão.</p>:<>
      <p className="rx-gate"><ShieldAlert size={16}/>{entry.gate}</p>
      <div className="rx-choice-row">
        {entry.options.map(option=><button
          key={option.id}
          type="button"
          className={choice?.id===option.id?'selected':''}
          onClick={()=>{setChoice(option);setReviewed(false);setCopied(false);setInserted(false);setCopyError('');}}>
          <strong>{option.title}</strong>
          <span>{option.note}</span>
        </button>)}
      </div>

      {requiresCalculator&&<section className="rx-weight-calculator">
        <div className="rx-weight-top">
          <label>
            <span><Scale size={14}/> Peso do paciente (kg)</span>
            <input
              type="text"
              inputMode="decimal"
              value={patientWeight}
              onChange={e=>{onWeightChange(e.target.value);setReviewed(false);setCopied(false);setInserted(false);setCopyError('');}}
              placeholder={entry.setting==='Pediatria'?'Ex.: 14,5':'Ex.: 70'}
              aria-label="Peso do paciente em quilogramas"
              aria-invalid={Boolean(weightError)} aria-describedby={weightError?'rx-detail-weight-error':undefined}
            />
          </label>
          {calculatedBadge&&!calculationError?<div className="rx-calc-badge" aria-live="polite">
            <small>Dose calculada p/ {patientWeight} kg</small>
            <strong>{calculatedBadge}</strong>
          </div>:null}
        </div>
        {weightError&&<p className="q-feedback" id="rx-detail-weight-error" role="alert">{weightError}</p>}
        <div className="rx-weight-chips" role="group" aria-label="Atalhos de peso">
          {weightChips.map(w=><button
            key={w}
            type="button"
            className={numericWeight===w?'rx-weight-chip active':'rx-weight-chip'}
            onClick={()=>{onWeightChange(String(w));setReviewed(false);setCopied(false);setInserted(false);setCopyError('');}}>
            {w} kg
          </button>)}
        </div>
        {pocketTable?<div className="rx-pocket-table">
          <strong>Tabela Rápida de Bolso:</strong> <span>{pocketTable}</span>
        </div>:null}
        <p><ShieldAlert size={16}/>{calculationComplete&&!calculationError?'Dose calculada automaticamente para o peso informado. Confira o limite máximo antes de copiar.':'Informe ou toque em um peso acima para calcular automaticamente a dose.'}</p>
        {calculationError&&<p className="q-feedback">{calculationError}</p>}
      </section>}

      <section className="rx-prescription">
        <div className="rx-prescription-head">
          <h3>{choice.title}</h3>
          {calculatedBadge?<span className="rx-inline-dose">{calculatedBadge}</span>:null}
        </div>
        <pre>{displayedPrescription}</pre>
      </section>

      {entry.clinicalDetails&&<section className="rx-gate" aria-label="Informações da condição"><div>{Object.entries(entry.clinicalDetails).filter(([,value])=>value).map(([key,value])=><p key={key}><strong>{{retorno:'Retorno',retornar_imediatamente_se:'Retornar imediatamente se',seguranca_plantonista:'Segurança',encaminhar_internar:'Encaminhar / internar',atestado_sugerido:'Atestado sugerido'}[key]}:</strong> {value}</p>)}</div></section>}
      <label className="rx-review-check">
        <input
          type="checkbox"
          checked={reviewed}
          disabled={!calculationComplete||Boolean(calculationError)}
          onChange={e=>{setReviewed(e.target.checked);setCopied(false);setInserted(false);setCopyError('');}}
        />
        <span>Revisei indicação, peso, cálculos, alergias, contraindicações, interações, diagnóstico e dados do paciente antes de copiar.</span>
      </label>

      {copyError&&<p className="q-feedback" role="alert">{copyError}</p>}
      <div className="rx-detail-actions">
        <p><ShieldAlert size={16}/> O texto copiado sai limpo (sem tags de fórmula ou rodapé de teste) pronto para colar no prontuário.</p>
        <div className="rx-action-buttons">
          {onInsertInConduct&&<button
            className="btn outline"
            type="button"
            disabled={inserted||!reviewed||!calculationComplete||Boolean(calculationError)}
            onClick={insertPrescription}>
            {inserted?<><Check size={16}/> Inserido na Consulta</>:<><CornerDownRight size={16}/> Enviar p/ Conduta da Consulta</>}
          </button>}
          <button
            className="btn primary"
            type="button"
            disabled={!reviewed||!calculationComplete||Boolean(calculationError)}
            onClick={copyPrescription}>
            {requiresCalculator&&!calculationComplete?<><ShieldAlert size={16}/> Informe o peso</>:copied?<><Check size={16}/> Copiado</> :<><Copy size={16}/> Copiar receituário</>}
          </button>
        </div>
      </div>
    </>}
  </section>;
}

export default function PrescriptionCatalog({
  patientWeight='',
  onWeightChange=()=>{},
  initialQuery='',
  onClearInitialQuery=()=>{},
  onInsertInConduct=null,
  initialReferenceId='',
  onClearInitialReference=()=>{},
  preferenceScope
}){
  const catalogRef=useRef(null);
  const weightError=parsePatientWeight(patientWeight).error;
  function showList(){setSelected(null);catalogRef.current?.scrollIntoView({block:'start'});}
  const [linkedIds,setLinkedIds]=useState(()=>dischargeReferenceIds(initialQuery));
  const [query,setQuery]=useState(()=>dischargeReferenceIds(initialQuery).length?'':initialQuery||'');
  const [setting,setSetting]=useState('Todos');
  const [letter,setLetter]=useState('Todas');
  const [selected,setSelected]=useState(null);
  const [catalog,setCatalog]=useState([]);
  const [catalogError,setCatalogError]=useState(false);
  const [referenceUnavailable,setReferenceUnavailable]=useState(false);
  const [loadAttempt,setLoadAttempt]=useState(0);
  const shortcuts=useReferenceShortcuts('prescriptions',preferenceScope,catalog);
  function openEntry(entry,resetFilters=false){
    if(resetFilters){setLinkedIds([]);setQuery('');setSetting('Todos');setLetter('Todas');}
    setSelected(entry);shortcuts.visit(entry.id);
  }

  useEffect(()=>{
    if(initialQuery){
      const ids=dischargeReferenceIds(initialQuery);
      setLinkedIds(ids);setQuery(ids.length?'':initialQuery);setSetting('Todos');setLetter('Todas');setSelected(null);
      onClearInitialQuery?.();
    }
  },[initialQuery]);

  useEffect(()=>{
    let active=true;
    setCatalogError(false);
    const files=Array.from({length:26},(_,index)=>'/assets/prescriptions/part-'+String(index+1).padStart(2,'0')+'.json?v=45');
    const load=async url=>{
      const response=await fetch(url,{cache:'no-store'});
      if(!response.ok)throw Error('catalog');
      return response.json();
    };
    Promise.all(files.map(load)).then(parts=>{
      if(!active)return;
      const adultItems = parts.flat().filter(item=>item.audience!=='Pediatria');
      const allItems = [...adultItems, ...pediatricData, ...hospitalData];
      setCatalog(allItems);
      if(allItems.length>0 && !initialQuery && !initialReferenceId && window.innerWidth>=1024){
        setSelected(allItems[0]);
      }
    }).catch(()=>{if(active)setCatalogError(true);});
    return ()=>{active=false;};
  },[loadAttempt]);

  useEffect(()=>{
    if(!initialReferenceId||!catalog.length)return;
    const entry=catalog.find(item=>item.id===initialReferenceId);
    setReferenceUnavailable(!entry);
    if(entry)openEntry(entry,true);else setSelected(null);
    onClearInitialReference();
    catalogRef.current?.scrollIntoView({block:'start'});
  },[initialReferenceId,catalog]);

  const linked=useMemo(()=>resolveDischargeReferences(catalog,linkedIds),[catalog,linkedIds]);
  const normalizedQuery = stripAccents(query.toLocaleLowerCase('pt-BR').trim());
  const referenceTables=hospitalTables.filter(table=>stripAccents(JSON.stringify(table).toLocaleLowerCase('pt-BR')).includes(normalizedQuery));

  const results=useMemo(()=>catalog.filter(item=>{
    if(linkedIds.length&&!linkedIds.includes(item.id)) return false;
    if(setting!=='Todos' && item.setting!==setting) return false;
    if(letter!=='Todas'){
      const firstChar = stripAccents(item.name.trim()).charAt(0).toUpperCase();
      if(firstChar !== letter) return false;
    }
    if(!normalizedQuery) return true;
    const searchable = stripAccents([item.name, item.cid10, item.tags, item.id, ...(item.options||[]).map(option=>option.title)].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR'));
    return searchable.includes(normalizedQuery);
  }),[catalog,normalizedQuery,setting,letter,linkedIds]);

  const counts = useMemo(()=>({
    Todos: catalog.length,
    'Atenção básica': catalog.filter(x=>x.setting==='Atenção básica').length,
    Pediatria: catalog.filter(x=>x.setting==='Pediatria').length,
    Urgência: catalog.filter(x=>x.setting==='Urgência').length
  }),[catalog]);

  return <section ref={catalogRef} className="rx-catalog" aria-label="Catálogo de receitas">
    <div className="q-intro">
      <div>
        <h1>Receituário Pronto e Uso Hospitalar (A a Z)</h1>
        <p>Pesquise por doença, CID-10, sintoma ou nome comercial. Banco 4.5 · esquemas domiciliares, prescrição na unidade e cálculo por peso quando aplicável.</p>
      </div>
    </div>

    {referenceUnavailable&&<p className="q-feedback" role="status">Esta referência não está disponível. Pesquise no catálogo para continuar.</p>}
    {linkedIds.length>0&&<div className="q-feedback" role="status">
      <p>Receitas vinculadas ao protocolo. Selecione a opção adequada após revisão.</p>
      {catalog.length>0&&linked.missing.length>0&&<p role="alert">Referências indisponíveis: {linked.missing.join(', ')}. Nenhuma substituição foi selecionada automaticamente.</p>}
      <button type="button" className="btn outline small" onClick={()=>{setLinkedIds([]);setQuery('');setSetting('Todos');setLetter('Todas');setSelected(null);}}>Ver catálogo completo</button>
    </div>}
    <div className="rx-controls-bar">
      <div className="rx-controls">
        <label className="rx-search-box">
          <Search size={16}/>
          <input
            value={query}
            onChange={e=>{setLinkedIds([]);setSelected(null);setLetter('Todas');setQuery(e.target.value);}}
            placeholder="Buscar patologia, CID-10 (ex: J45, A90) ou medicamento (ex: Rocefin, Amoxicilina)..."
            aria-label="Pesquisar doença, CID ou medicação"
          />
        </label>
        {setting!=='Referencias'&&<label className="rx-global-weight-inline">
          <span><Scale size={14}/> Peso (kg):</span>
          <input
            type="text"
            inputMode="decimal"
            value={patientWeight}
            onChange={e=>onWeightChange(e.target.value)}
            placeholder="Ex: 15 ou 70"
            aria-label="Peso global do paciente em kg"
            aria-invalid={Boolean(weightError)} aria-describedby={weightError?'rx-global-weight-error':undefined}
          />
        </label>}
      </div>

      <div className="rx-category-pills" role="tablist" aria-label="Módulos do receituário">
        {[
          {id:'Todos', label:`Todos (${counts.Todos})`},
          {id:'Atenção básica', label:`🏠 Adulto Casa (${counts['Atenção básica']})`},
          {id:'Pediatria', label:`🧸 Pediatria Casa (${counts.Pediatria})`},
          {id:'Urgência', label:`💉 Uso Hospitalar / Injetáveis (${counts.Urgência})`},
          {id:'Referencias', label:`Consulta rápida (${hospitalTables.length})`}
        ].map(tab=><button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={setting===tab.id}
          className={setting===tab.id?'rx-cat-pill active':'rx-cat-pill'}
          onClick={()=>{setSetting(tab.id);setLetter('Todas');setQuery('');setLinkedIds([]);showList();}}>
          {tab.label}
        </button>)}
      </div>

      {setting!=='Referencias'&&<div className="rx-alpha-bar" role="toolbar" aria-label="Filtro por letra inicial">
        {ALPHABET.map(ch=><button
          key={ch}
          type="button"
          className={letter===ch?'rx-alpha-btn active':'rx-alpha-btn'}
          aria-pressed={letter===ch}
          onClick={()=>{setLetter(ch);setQuery('');setLinkedIds([]);showList();}}>
          {ch}
        </button>)}
      </div>}
    </div>

    {weightError&&<p className="q-feedback" id="rx-global-weight-error" role="alert">{weightError}</p>}
    <ReferenceShortcuts label="Atalhos do receituário" shortcuts={shortcuts} onOpen={entry=>openEntry(entry,true)}/>
    {setting==='Urgência'&&<p className="q-feedback">Selecione um grupo hospitalar para ver as medicações e as opções de prescrição. As tabelas ficam na aba Consulta rápida.</p>}
    {setting==='Referencias'&&<section className="rx-reference-tables" aria-label="Tabelas de consulta rápida"><h2>Tabelas de consulta rápida</h2>{referenceTables.length===0&&<p>Nenhuma tabela encontrada.</p>}{referenceTables.map(table=><details key={table.id}><summary>{table.titulo}</summary>{table.itens.map((row,index)=><article key={index}>{Object.entries(row).map(([key,value])=><p key={key}><strong>{key.replaceAll('_',' ')}:</strong> {typeof value==='string'?value:JSON.stringify(value)}</p>)}</article>)}</details>)}</section>}
    {setting!=='Referencias'&&<div className={selected?'rx-master-detail has-selection':'rx-master-detail'}>
      <div className="rx-master-list">
        {!catalogError&&!catalog.length&&<p className="q-feedback">Carregando catálogo...</p>}
        {catalogError&&<div className="q-feedback" role="alert"><p>Não foi possível carregar o catálogo.</p><button type="button" className="btn outline small" onClick={()=>setLoadAttempt(n=>n+1)}>Tentar carregar novamente</button></div>}
        {!!catalog.length&&!results.length&&<p className="q-feedback">Nenhuma condição encontrada para "{query}".</p>}
        <div className="rx-list">
          {results.map(item=><button
            type="button"
            className={selected?.id===item.id?'rx-card active':'rx-card'}
            key={item.id}
            onClick={()=>openEntry(item)}>
            <div>
              <h2>{item.name}</h2>
              <p>{item.audience} · {item.setting}{item.cid10?` · ${item.cid10}`:''}</p>
            </div>
            <span>{item.options?.length||1} {item.options?.length===1?'opção':'opções'}</span>
          </button>)}
        </div>
      </div>

      <div className="rx-detail-pane">
        {selected ? (
          <TreatmentDraft
            entry={selected}
            favorite={shortcuts.isFavorite(selected.id)} onFavorite={()=>shortcuts.toggle(selected.id)}
            onClose={showList}
            patientWeight={patientWeight}
            onWeightChange={onWeightChange}
            onInsertInConduct={onInsertInConduct}
          />
        ) : (
          <div className="rx-empty-selection">
            <BookOpen size={28}/>
            <h3>Selecione uma patologia ou grupo</h3>
            <p>Escolha qualquer condição na lista para abrir os esquemas terapêuticos, calcular doses por peso e copiar o receituário limpo.</p>
          </div>
        )}
      </div>
    </div>}
  </section>;
}
