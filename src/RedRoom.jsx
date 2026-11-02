import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Activity, AlertOctagon, Calculator, Check, ChevronLeft, Copy, CornerDownRight, Crosshair, ExternalLink, Scale, Search, ShieldAlert, Zap} from 'lucide-react';
import ReferenceShortcuts,{ReferenceFavoriteButton,useReferenceShortcuts} from './referenceShortcuts.jsx';
import {parsePatientWeight} from './patientWeight.js';
import './red-room.css';
import './red-room-calculators.css';
import protocolsData from './data/protocols-v5.json';
import {catalogAstOutput} from './catalogCalculator.js';

const EMERGENCY_WEIGHT_CHIPS = [10, 20, 50, 60, 70, 80, 90, 100];
const ALPHABET = ['Todas', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

async function copyText(text){
  if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return;}
  throw Error('Não foi possível copiar automaticamente neste navegador.');
}

function stripAccents(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}

function formatNumber(value,decimals){
  return Number(value).toLocaleString('pt-BR',{minimumFractionDigits:decimals,maximumFractionDigits:decimals});
}

function CalculatorSummary({summary}){
  if(!summary)return null;
  if(typeof summary==='string')return <div className="rr-calculator-summary"><Calculator size={14}/><span><strong>Referência de cálculo:</strong> {summary}</span></div>;
  const rows=[
    ['Dose adotada',summary.adoptedDose],
    ['Limite máximo',summary.maximum],
    ['Fórmula de conferência',summary.formula],
    ['Apresentação / diluição',summary.concentration],
    ['Entrada',summary.input&&summary.unit?`${summary.input} · resultado em ${summary.unit}`:summary.input]
  ].filter(([,value])=>Boolean(value));
  return <div className="rr-calculator-summary">
    <Calculator size={14}/>
    <div><strong>Referência de cálculo</strong>{rows.map(([label,value])=><span key={label}><b>{label}:</b> {value}</span>)}</div>
  </div>;
}

function calculateOutput(definition,inputs){
  if(definition.ast)return catalogAstOutput(definition,inputs);
  let raw=1;
  for(const factor of definition.factors){
    const value=typeof factor==='number'?factor:Number(inputs[factor]);
    if(!Number.isFinite(value)||value<=0)throw Error('Preencha todos os campos.');
    raw*=value;
  }
  raw/=Number(definition.divisor||1);
  const maximum=Number.isFinite(Number(definition.maximum))?Number(definition.maximum):null;
  const limited=maximum!==null&&raw>maximum;
  const value=limited?maximum:raw;
  const decimals=Number(definition.decimals||0);
  return {
    id:definition.id,
    label:definition.label,
    unit:definition.unit,
    raw,
    value:Number(value.toFixed(decimals)),
    maximum,
    limited,
    decimals
  };
}

function evaluateMedicationForWeight(medication, numericWeight, extraInputs = {}) {
  const calculator = medication.calculator;
  if (!calculator || !Number.isFinite(numericWeight) || numericWeight <= 0) return null;
  const inputs = {};
  for (const field of calculator.inputs) {
    if (field.id === 'weight') {
      inputs.weight = numericWeight;
    } else if (extraInputs[field.id] !== undefined) {
      // Um campo apagado exige nova entrada; não reutilizar silenciosamente o padrão.
      if (String(extraInputs[field.id]).trim() === '') return null;
      inputs[field.id] = Number(extraInputs[field.id]);
    } else if (field.default !== undefined) {
      inputs[field.id] = Number(field.default);
    } else {
      return null;
    }
    const value = inputs[field.id];
    const minimum = Number(field.minimum);
    const maximum = Number(field.maximum);
    if (!Number.isFinite(value)) return null;
    if (Number.isFinite(minimum) && value < minimum) return null;
    if (Number.isFinite(maximum) && value > maximum) return null;
  }
  try {
    const outputs = calculator.outputs.map(out => calculateOutput(out, inputs));
    return {
      inputs,
      outputs,
      primaryOutputId: calculator.primaryOutputId
    };
  } catch {
    return null;
  }
}

function directionsWithResult(directions,result){
  const cleanDir = String(directions||'').replace(/\s*\[Fórmula:[^\]]*\]/gi,'');
  if(!result)return cleanDir;
  const primary=result.outputs.find(item=>item.id===result.primaryOutputId)||result.outputs[0];
  if(!primary)return cleanDir;
  const formatted = `${formatNumber(primary.value,primary.decimals)}`;
  return cleanDir
    .replace(/\[PREENCHER CONFORME PESO\]/g, formatted)
    .replace(/\{RESULTADO_CALCULADORA\}/g, formatted);
}

function calculationAudit(result){
  if(!result)return '';
  return result.outputs.map(item=>{
    const finalValue=`${formatNumber(item.value,item.decimals)} ${item.unit}`;
    if(!item.limited)return `${item.label}: ${finalValue}`;
    return `${item.label}: ${finalValue} (teto de segurança aplicado: ${formatNumber(item.maximum,item.decimals)} ${item.unit})`;
  }).join(' | ');
}

function protocolText(protocol,calculations){
  const rb = protocol.resumoBolso;
  const pocketHeader = rb ? [
    `RESUMO DE BOLSO (5 SEGUNDOS):`,
    `- Ação Minuto Zero: ${rb.acao_minuto_zero}`,
    `- Alvo Terapêutico: ${rb.alvo_terapeutico}`,
    `- Armadilha / Contraindicação: ${rb.armadilha_contraindicacao}`
  ].join('\n') : '';

  const steps=(protocol.steps||[]).map((step,index)=>`${index+1}. ${step}`).join('\n');
  const medications=(protocol.medications||[]).map((item,index)=>{
    const result=calculations[item.id];
    return [
      `${index+1}) ${item.name} ------------------- (${item.quantity||'conforme protocolo'})`,
      item.route,
      directionsWithResult(item.directions,result),
      result?`   >> [Dose Calculada: ${calculationAudit(result)}]`:''
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  const orientacoes = Array.isArray(protocol.orientacoes) && protocol.orientacoes.length
    ? `\nORIENTAÇÕES DE SEGURANÇA:\n` + protocol.orientacoes.map(o=>`- ${o}`).join('\n')
    : '';

  return [
    `PROTOCOLO DE EMERGÊNCIA: ${protocol.name} (${protocol.cid10||'Sem CID'})`,
    pocketHeader ? `\n${pocketHeader}` : '',
    steps ? `\nCONDUTA PASSO A PASSO:\n${steps}` : '',
    medications ? `\nPRESCRIÇÃO DE EMERGÊNCIA:\n${medications}` : '',
    orientacoes,
    protocol.criteriosAlta?.length ? '\nCRITÉRIOS DE ALTA:\n'+[].concat(protocol.criteriosAlta).join('\n') : '',
    protocol.criteriosInternacao?.length ? '\nCRITÉRIOS DE INTERNAÇÃO:\n'+[].concat(protocol.criteriosInternacao).join('\n') : ''
  ].filter(Boolean).join('\n');
}

function ProtocolDetail({
  protocol,
  onClose,
  patientWeight='',
  onWeightChange=()=>{},
  onInsertInConduct=null,
  onOpenDischarge=null,
  favorite=false,onFavorite=()=>{}
}){
  const [reviewed,setReviewed]=useState(false);
  const [copied,setCopied]=useState(false);
  const [inserted,setInserted]=useState(false);
  const [copyError,setCopyError]=useState('');
  useEffect(()=>{setReviewed(false);setCopied(false);setInserted(false);setCopyError('');},[patientWeight]);
  const [extraParams,setExtraParams]=useState({});

  useEffect(()=>{
    setReviewed(false);
    setCopied(false);
    setInserted(false);
    setCopyError('');
    setExtraParams({});
  },[protocol]);

  const {value:numericWeight,error:weightError}=parsePatientWeight(patientWeight);

  // Calcula automaticamente TODAS as medicações do protocolo sempre que o peso ou slider mudar!
  const calculations = useMemo(()=>{
    const map = {};
    for (const item of protocol.medications || []) {
      if (item.calculator) {
        const res = evaluateMedicationForWeight(item, numericWeight, extraParams[item.id] || {});
        if (res) map[item.id] = res;
      }
    }
    return map;
  },[protocol, numericWeight, extraParams]);

  const requiredMedications=useMemo(()=>protocol.medications.filter(item=>Boolean(item.calculator)),[protocol]);
  const allCalculated=requiredMedications.every(item=>Boolean(calculations[item.id]));
  const remaining=requiredMedications.filter(item=>!calculations[item.id]).length;

  function updateExtraParam(medId, fieldId, value) {
    setReviewed(false);
    setCopied(false);
    setInserted(false);
    setCopyError('');
    setExtraParams(prev => ({
      ...prev,
      [medId]: {
        ...(prev[medId] || {}),
        [fieldId]: value
      }
    }));
  }

  async function copyProtocol(){
    if(!reviewed||!allCalculated)return;
    setCopyError('');
    try{await copyText(protocolText(protocol,calculations));setCopied(true);}catch{setCopied(false);setCopyError('Não foi possível copiar. Selecione o conteúdo do protocolo e copie manualmente.');}
  }

  function insertProtocol(){
    if(!reviewed||!allCalculated||!onInsertInConduct)return;
    onInsertInConduct(protocolText(protocol,calculations), protocol.name);
    setInserted(true);
  }

  const rb = protocol.resumoBolso;
  const canOpenDischarge = Boolean(onOpenDischarge && protocol.idReceitaAlta && /(ADU-|PED-)/i.test(protocol.idReceitaAlta));

  return <section className="rr-detail" aria-label={'Protocolo '+protocol.name}>
    <button type="button" className="btn outline small rr-mobile-back" onClick={onClose}><ChevronLeft size={15}/> Trocar protocolo</button>

    <header className="rr-detail-header">
      <div>
        <p className="rx-eyebrow">Sala Vermelha · Guia de Bolso & PC · {protocol.id}</p>
        <h1>{protocol.name}</h1>
        <p>{protocol.cid10?`CID-10: ${protocol.cid10}`:''}{protocol.idReceitaAlta?` · Alta vinculada: ${protocol.idReceitaAlta}`:''}</p>
      </div>
      <div className="rr-header-badges">
        <span>{protocol.medications.length} medicações</span>
        {canOpenDischarge&&<button
          type="button"
          className="btn outline small rr-discharge-btn"
          onClick={()=>onOpenDischarge(protocol.idReceitaAlta)}>
          <ExternalLink size={14}/> Abrir Receita de Alta
        </button>}
      </div>
    </header>

    <ReferenceFavoriteButton kind="protocolo" favorite={favorite} onClick={onFavorite}/>
    {/* STICKY PATIENT WEIGHT BAR — Calcula todas as medicações de uma vez */}
    <section className="rr-sticky-weight-bar" aria-label="Calculadora automática por peso">
      <div className="rr-weight-input-row">
        <label className="rr-weight-main-label">
          <span><Scale size={16}/> Peso do Paciente (kg) — calcula todo o protocolo:</span>
          <input
            type="text"
            inputMode="decimal"
            value={patientWeight}
            onChange={e=>{onWeightChange(e.target.value);setReviewed(false);setCopied(false);setInserted(false);setCopyError('');}}
            placeholder="Digite o peso (ex: 70)"
            aria-label="Peso do paciente em quilogramas"
            aria-invalid={Boolean(weightError)} aria-describedby={weightError?'rr-detail-weight-error':undefined}
          />
        </label>
        <div className="rr-weight-chips" role="group" aria-label="Pesos rápidos">
          {EMERGENCY_WEIGHT_CHIPS.map(w=><button
            key={w}
            type="button"
            className={numericWeight===w?'rr-weight-chip active':'rr-weight-chip'}
            onClick={()=>{onWeightChange(String(w));setReviewed(false);setCopied(false);setInserted(false);setCopyError('');}}>
            {w} kg
          </button>)}
        </div>
      </div>
    </section>

    {weightError&&<p className="q-feedback" id="rr-detail-weight-error" role="alert">{weightError}</p>}
    {/* VISÃO DE 5 SEGUNDOS — PADRÃO SEMAFÓRICO DE BOLSO */}
    {rb && (rb.acao_minuto_zero || rb.alvo_terapeutico || rb.armadilha_contraindicacao) ? (
      <section className="rr-pocket-summary" aria-label="Resumo de Bolso de 5 Segundos">
        <div className="rr-pocket-card rr-pocket-zero">
          <div className="rr-pocket-title"><Zap size={16}/> <strong>AÇÃO NO MINUTO ZERO</strong></div>
          <p>{rb.acao_minuto_zero}</p>
        </div>
        <div className="rr-pocket-card rr-pocket-target">
          <div className="rr-pocket-title"><Crosshair size={16}/> <strong>ALVO TERAPÊUTICO</strong></div>
          <p>{rb.alvo_terapeutico}</p>
        </div>
        <div className="rr-pocket-card rr-pocket-trap">
          <div className="rr-pocket-title"><AlertOctagon size={16}/> <strong>ARMADILHA / CONTRAINDICAÇÃO</strong></div>
          <p>{rb.armadilha_contraindicacao}</p>
        </div>
      </section>
    ) : null}

    {/* PRESCRIÇÃO + CALCULADORA DE MEDICAÇÕES CRÍTICAS (PRIORIDADE VISUAL) */}
    <section className="rr-section">
      <div className="rr-section-head">
        <h2>Medicações e Calculadora Crítica ({protocol.medications.length} itens)</h2>
        {numericWeight>0 ? <span className="rr-active-weight-pill">Calculado p/ {numericWeight} kg</span> : <span className="rr-inactive-weight-pill">Toque em um peso acima p/ calcular</span>}
      </div>
      <div className="rr-medications">
        {protocol.medications.map((item, idx)=>{
          const result=calculations[item.id];
          const primaryOutput = result?.outputs?.find(o=>o.id===result.primaryOutputId) || result?.outputs?.[0];
          const extraFields = (item.calculator?.inputs || []).filter(f => f.id !== 'weight');

          return <article key={item.id} className={result?'rr-med-card is-calculated':'rr-med-card'}>
            <div className="rr-med-top">
              <div>
                <span className="rr-med-num">Item {idx+1}</span>
                <h3>{item.name}</h3>
              </div>
              {primaryOutput ? (
                <div className="rr-med-dose-badge" aria-live="polite">
                  <small>{primaryOutput.label}</small>
                  <strong>{formatNumber(primaryOutput.value, primaryOutput.decimals)} {primaryOutput.unit}</strong>
                  {primaryOutput.limited && <span className="rr-limit-tag">Teto máx. atingido</span>}
                </div>
              ) : item.quantity ? (
                <span className="rr-med-qty">{item.quantity}</span>
              ) : null}
            </div>

            <p>{item.route}</p><p className="rr-med-directions">{directionsWithResult(item.directions,result)}</p>

            <CalculatorSummary summary={item.calculatorSummary}/>

            {/* Controles extras de titulação (ex: Dose mcg/kg/min em BIC ou %SCQ em Queimados) */}
            {extraFields.length > 0 && (
              <div className="rr-titration-box">
                {extraFields.map(field => {
                  const currentVal = extraParams[item.id]?.[field.id] ?? field.default ?? '';
                  return (
                    <label key={field.id} className="rr-titration-control">
                      <div className="rr-titration-head">
                        <span><Calculator size={14}/> Titular {field.label}: <strong>{currentVal} {field.unit}</strong></span>
                        {field.maximum!==undefined&&<small>Faixa de entrada: {field.minimum} a {field.maximum} {field.unit}</small>}
                      </div>
                      <div className="rr-titration-inputs">
                        {field.maximum!==undefined&&<input
                          type="range"
                          min={field.minimum}
                          max={field.maximum}
                          step={field.step || 0.05}
                          value={currentVal}
                          onChange={e => updateExtraParam(item.id, field.id, e.target.value)}
                        />}
                        <input
                          type="number"
                          inputMode="decimal"
                          min={field.minimum}
                          max={field.maximum}
                          step={field.step || 0.05}
                          value={currentVal}
                          onChange={e => updateExtraParam(item.id, field.id, e.target.value)}
                        />
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {/* Caso tenha múltiplos outputs (ex: Alteplase Total + Bolus + Infusão 60min) */}
            {result && result.outputs.length > 1 && (
              <div className="rr-multi-outputs">
                {result.outputs.map(out => (
                  <div key={out.id} className="rr-multi-output-pill">
                    <span>{out.label}:</span>
                    <strong>{formatNumber(out.value, out.decimals)} {out.unit}</strong>
                  </div>
                ))}
              </div>
            )}

            {/* Tabela Rápida de Bolso sempre visível (10kg a 100kg) */}
            {item.pocketTable && item.pocketTable !== 'Dose adulta padronizada no protocolo' && (
              <div className="rr-pocket-table-bar">
                <strong>Tabela de Bolso:</strong> <span>{item.pocketTable}</span>
              </div>
            )}
          </article>;
        })}
      </div>
    </section>

    {/* MANEJO PASSO A PASSO EM ACORDEÃO RETRÁTIL (Evita rolagem excessiva no celular) */}
    {protocol.steps?.length ? (
      <details className="rr-section rr-accordion" open={window.innerWidth>=1024}>
        <summary><h2>Conduta e Manejo Passo a Passo ({protocol.steps.length} etapas)</h2><span>Toque para expandir/recolher</span></summary>
        <div className="rr-steps">
          {protocol.steps.map((step,index)=><article key={index}><span>{index+1}</span><div><strong>Passo {index+1}</strong><p>{step}</p></div></article>)}
        </div>
      </details>
    ) : null}

    {protocol.orientacoes?.length ? (
      <section className="rr-section rr-orientacoes-box">
        <h2>Orientações Rápidas de Segurança e Monitorização</h2>
        <ul>
          {protocol.orientacoes.map((ori, i) => <li key={i}>{ori}</li>)}
        </ul>
      </section>
    ) : null}

    {[['Critérios de alta',protocol.criteriosAlta],['Critérios de internação',protocol.criteriosInternacao]].map(([title,items])=>items?.length?<section className="rr-section" key={title}><h2>{title}</h2><ul>{[].concat(items).map((item,i)=><li key={i}>{item}</li>)}</ul></section>:null)}
    {requiredMedications.length ? (
      <p className={allCalculated?'rr-ready':'rr-warning'}>
        {allCalculated?<Check size={17}/>:<ShieldAlert size={17}/>}
        {allCalculated
          ? `Todas as doses críticas foram calculadas para ${numericWeight} kg. Revise antes de copiar.`
          : `Preencha o peso e os parâmetros adicionais de ${remaining} medicação(ões) para liberar a cópia.`}
      </p>
    ) : null}

    <label className="rx-review-check">
      <input
        type="checkbox"
        checked={reviewed}
        disabled={!allCalculated}
        onChange={event=>{setReviewed(event.target.checked);setCopied(false);setInserted(false);setCopyError('');}}
      />
      <span>Revisei integralmente este protocolo e conferi manualmente todos os cálculos, doses, diluições e limites antes de copiar.</span>
    </label>

    {copyError&&<p className="q-feedback" role="alert">{copyError}</p>}
    <div className="rx-detail-actions">
      <p><ShieldAlert size={16}/> Confira estabilidade hemodinâmica, função renal e contraindicações antes de prescrever.</p>
      <div className="rx-action-buttons">
        {onInsertInConduct && (
          <button className="btn outline" type="button" disabled={inserted||!reviewed||!allCalculated} onClick={insertProtocol}>
            {inserted?<><Check size={16}/> Inserido na Consulta</>:<><CornerDownRight size={16}/> Enviar p/ Conduta da Consulta</>}
          </button>
        )}
        <button className="btn primary" type="button" disabled={!reviewed||!allCalculated} onClick={copyProtocol}>
          {copied?<><Check size={16}/> Copiado</> :<><Copy size={16}/> Copiar protocolo e medicações</>}
        </button>
      </div>
    </div>
  </section>;
}

export default function RedRoom({
  patientWeight='',
  onWeightChange=()=>{},
  onInsertInConduct=null,
  onOpenDischarge=null,
  initialReferenceId='',
  onClearInitialReference=()=>{},
  preferenceScope
}){
  const catalogRef=useRef(null);
  const weightError=parsePatientWeight(patientWeight).error;
  function showList(){setSelected(null);catalogRef.current?.scrollIntoView({block:'start'});}
  const [protocols]=useState(()=>Array.isArray(protocolsData.protocols)?protocolsData.protocols:[]);
  const [query,setQuery]=useState('');
  const [referenceUnavailable,setReferenceUnavailable]=useState(false);
  const [letter,setLetter]=useState('Todas');
  const [selected,setSelected]=useState(()=> (window.innerWidth>=1024 && Array.isArray(protocolsData.protocols) && protocolsData.protocols.length) ? protocolsData.protocols[0] : null);

  const shortcuts=useReferenceShortcuts('emergency',preferenceScope,protocols);
  function openProtocol(protocol,resetFilters=false){
    if(resetFilters){setQuery('');setLetter('Todas');}
    setSelected(protocol);shortcuts.visit(protocol.id);
  }

  useEffect(()=>{
    if(!initialReferenceId)return;
    const protocol=protocols.find(item=>item.id===initialReferenceId);
    setReferenceUnavailable(!protocol);
    if(protocol)openProtocol(protocol,true);else setSelected(null);
    onClearInitialReference();
    catalogRef.current?.scrollIntoView({block:'start'});
  },[initialReferenceId,protocols]);

  const normalizedQuery=stripAccents(query.toLocaleLowerCase('pt-BR').trim());
  const results=useMemo(()=>protocols.filter(protocol=>{
    if(letter!=='Todas'){
      const firstChar = stripAccents(protocol.name.trim()).charAt(0).toUpperCase();
      if(firstChar !== letter) return false;
    }
    if(!normalizedQuery)return true;
    const searchable=stripAccents([protocol.name,protocol.cid10,protocol.tags,...protocol.medications.map(item=>item.name)].join(' ').toLocaleLowerCase('pt-BR'));
    return searchable.includes(normalizedQuery);
  }),[protocols,normalizedQuery,letter]);

  return <section ref={catalogRef} className="rr-catalog" aria-label="Protocolos da sala vermelha">
    <div className="q-intro">
      <div>
        <h1>Sala Vermelha — Guia de Bolso & Calculadora Crítica (A a Z)</h1>
        <p>{protocols.length} protocolos · banco 4.5 · resumo de bolso, conduta e calculadoras por peso. Infusões exigem a dose informada pelo médico.</p>
      </div>
      <span className="rr-badge"><Activity size={14}/> {protocols.length} Protocolos de Emergência</span>
    </div>

    {referenceUnavailable&&<p className="q-feedback" role="status">Este protocolo não está disponível. Pesquise na Sala vermelha para continuar.</p>}
    <div className="rr-controls-bar">
      <div className="rr-controls-grid">
        <label className="rr-search-input">
          <Search size={16}/>
          <input
            value={query}
            onChange={event=>{setQuery(event.target.value);setLetter('Todas');setSelected(null);}}
            placeholder="Pesquisar protocolo, droga vasoativa (ex: Noradrenalina, Tridil, Alteplase) ou CID-10..."
            aria-label="Pesquisar protocolo, medicamento ou CID"
          />
        </label>
        <label className="rx-global-weight-inline rr-global-weight">
          <span><Scale size={14}/> Peso (kg):</span>
          <input
            type="text"
            inputMode="decimal"
            value={patientWeight}
            onChange={e=>onWeightChange(e.target.value)}
            placeholder="Ex: 70"
            aria-label="Peso global do paciente em kg"
            aria-invalid={Boolean(weightError)} aria-describedby={weightError?'rr-global-weight-error':undefined}
          />
        </label>
      </div>

      <div className="rx-alpha-bar" role="toolbar" aria-label="Filtro por letra inicial">
        {ALPHABET.map(ch=><button
          key={ch}
          type="button"
          className={letter===ch?'rx-alpha-btn active':'rx-alpha-btn'}
          aria-pressed={letter===ch}
          onClick={()=>{setLetter(ch);setQuery('');showList();}}>
          {ch}
        </button>)}
      </div>
    </div>

    {weightError&&<p className="q-feedback" id="rr-global-weight-error" role="alert">{weightError}</p>}
    <ReferenceShortcuts label="Atalhos da Sala Vermelha" shortcuts={shortcuts} onOpen={protocol=>openProtocol(protocol,true)}/>
    <div className={selected?'rx-master-detail has-selection':'rx-master-detail'}>
      <div className="rx-master-list">
        {!protocols.length?<p className="q-feedback">Nenhum protocolo disponível.</p>:null}
        {protocols.length&&!results.length?<p className="q-feedback">Nenhum protocolo encontrado para "{query}".</p>:null}
        <div className="rr-list">
          {results.map(protocol=><button
            type="button"
            className={selected?.id===protocol.id?'rr-card active':'rr-card'}
            key={protocol.id}
            onClick={()=>openProtocol(protocol)}>
            <div>
              <h2>{protocol.name}</h2>
              <p>{protocol.cid10||'CID não informado'} · {protocol.medications.length} medicações</p>
            </div>
            <span>{protocol.id}</span>
          </button>)}
        </div>
      </div>

      <div className="rx-detail-pane">
        {selected ? (
          <ProtocolDetail
            protocol={selected}
            favorite={shortcuts.isFavorite(selected.id)} onFavorite={()=>shortcuts.toggle(selected.id)}
            onClose={showList}
            patientWeight={patientWeight}
            onWeightChange={onWeightChange}
            onInsertInConduct={onInsertInConduct}
            onOpenDischarge={onOpenDischarge}
          />
        ) : (
          <div className="rx-empty-selection">
            <Activity size={28}/>
            <h3>Selecione um protocolo de Sala Vermelha ao lado</h3>
            <p>Visualize a Ação no Minuto Zero, o Alvo Terapêutico, as Armadilhas e calcule automaticamente todas as medicações críticas pelo peso.</p>
          </div>
        )}
      </div>
    </div>
  </section>;
}



