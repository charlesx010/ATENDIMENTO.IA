import React, { useId, useRef, useState } from 'react';
import { BookOpen, Check, Copy, Download, FilePlus2, Pencil, Search, Trash2, Upload, X } from 'lucide-react';
import { TEMPLATE_LIMITS, createTemplate, duplicateTemplate, exportTemplateLibrary, filterTemplates, parseTemplateLibrary, updateTemplate } from './templates.js';

function saveFile(text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'meus-modelos-documentacao.json'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const emptyForm = () => ({ title: '', category: '', body: '' });

export default function TemplateLibrary({ templates, setTemplates, onApply, onStatus = () => {} }) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const fileInput = useRef(null);
  const formId = useId();
  const commitTemplates=items=>setTemplates(parseTemplateLibrary({schema:1,kind:'documentation-checklists',templates:items}));
  const results = filterTemplates(templates, query);
  const report = message => { setError(''); onStatus(message); };
  const fail = message => { setError(message); onStatus(message); };
  function startEdit(template) {
    setError(''); setEditing(template?.id || 'new');
    setForm(template ? { title: template.title, category: template.category, body: template.body } : emptyForm());
  }
  function save(event) {
    event.preventDefault();
    try {
      if (editing === 'new') {
        if (templates.length >= TEMPLATE_LIMITS.count) throw Error(`Você pode manter até ${TEMPLATE_LIMITS.count} modelos nesta biblioteca.`);
        const item = createTemplate(form);
        commitTemplates([...templates,item]);
      } else {
        const original = templates.find(item => item.id === editing);
        if (!original) throw Error('O modelo não está mais disponível. Abra-o novamente.');
        const updated = updateTemplate(original, form);
        commitTemplates(templates.map(item => item.id === updated.id ? updated : item));
      }
      setEditing(null); setForm(emptyForm()); report('Modelo salvo nesta aba. Exporte sua biblioteca para guardá-lo.');
    } catch (cause) { fail(cause.message); }
  }
  function duplicate(template) {
    try {
      if (templates.length >= TEMPLATE_LIMITS.count) throw Error(`O limite é ${TEMPLATE_LIMITS.count} modelos.`);
      const copy = duplicateTemplate(template);
      commitTemplates([...templates,copy]); report('Cópia criada. Você pode adaptá-la antes de usar.');
    } catch (cause) { fail(cause.message); }
  }
  function remove(template) {
    if (!window.confirm(`Excluir o modelo “${template.title}” desta aba? A consulta atual não será alterada.`)) return;
    commitTemplates(templates.filter(item => item.id !== template.id));
    if (editing === template.id) setEditing(null);
    report('Modelo removido da biblioteca desta aba.');
  }
  async function importFile(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    try {
      if (file.size > TEMPLATE_LIMITS.fileBytes) throw Error('O arquivo de modelos deve ter até 200 KB.');
      const imported = parseTemplateLibrary(JSON.parse(await file.text()));
      if (!window.confirm(`Importar ${imported.length} modelo(s) substituirá toda a biblioteca desta aba. Exporte os modelos atuais antes, se quiser preservá-los. Continuar?`)) return;
      setTemplates(imported); setEditing(null); report('Biblioteca importada. Estes modelos são roteiros, não prontuários nem condutas validadas.');
    } catch (cause) { fail(cause instanceof SyntaxError ? 'Arquivo JSON inválido. Nenhum modelo atual foi alterado.' : cause.message); }
  }
  function exportFile() {
    try { saveFile(exportTemplateLibrary(templates)); report('Biblioteca exportada. Guarde somente roteiros sem dados de pacientes.'); }
    catch (cause) { fail(cause.message); }
  }
  return <section className="t-library" aria-label="Meus modelos de documentação">
    <div className="w-heading"><div><div className="w-eyebrow">SEU JEITO DE DOCUMENTAR</div><h1>Meus modelos</h1><p>Roteiros reutilizáveis para lembrar o que registrar, sem preencher achados por você.</p></div><button className="w-button primary" onClick={() => startEdit()} disabled={templates.length >= TEMPLATE_LIMITS.count}><FilePlus2 size={17}/> Criar modelo</button></div>
    <section className="w-card t-library-note"><h2><BookOpen size={19}/> Comece pela estrutura, preserve os fatos</h2><p>Os modelos são checklists de documentação. Não incluem resultados normais, diagnósticos ou tratamentos prontos. Personalize apenas instruções e campos, sem dados de pacientes.</p><p className="w-muted">As edições ficam nesta aba até você escolher Salvar modelos na conta. Para continuar em outro aparelho, carregue a biblioteca da conta. Você também pode exportar um backup.</p><div className="w-actions"><button className="w-button" onClick={exportFile}><Download size={16}/> Exportar modelos</button><button className="w-button" onClick={() => fileInput.current?.click()}><Upload size={16}/> Importar modelos</button></div><input ref={fileInput} type="file" accept=".json,application/json" aria-label="Importar biblioteca de modelos JSON" onChange={importFile} hidden/></section>
    {error && <div className="w-alert" role="alert">{error}</div>}
    {editing && <form className="w-card t-template-form" onSubmit={save} aria-labelledby={`${formId}-title`}>
      <div className="w-section-heading"><h2 id={`${formId}-title`}>{editing === 'new' ? 'Criar roteiro pessoal' : 'Editar roteiro'}</h2><button className="w-button" type="button" onClick={() => setEditing(null)} aria-label="Fechar edição do modelo"><X size={16}/></button></div>
      <label className="w-field">Nome do modelo<input value={form.title} onChange={e => setForm(value => ({ ...value, title: e.target.value }))} maxLength={TEMPLATE_LIMITS.title} placeholder="Ex.: Meu roteiro de retorno" required/></label>
      <label className="w-field">Categoria<input value={form.category} onChange={e => setForm(value => ({ ...value, category: e.target.value }))} maxLength={TEMPLATE_LIMITS.category} placeholder="Ex.: Consulta geral" required/></label>
      <label className="w-field">Roteiro e perguntas para registrar<textarea rows={9} value={form.body} onChange={e => setForm(value => ({ ...value, body: e.target.value }))} maxLength={TEMPLATE_LIMITS.body} placeholder="Liste os campos a conferir. Evite respostas pré-preenchidas ou dados de pacientes." required/></label>
      <p className="w-muted">{form.body.length} / {TEMPLATE_LIMITS.body} caracteres. Usar um roteiro não confirma nenhum achado da consulta.</p>
      <div className="w-actions"><button className="w-button primary" type="submit"><Check size={16}/> Salvar modelo</button><button className="w-button" type="button" onClick={() => setEditing(null)}>Cancelar edição</button></div>
    </form>}
    <label className="w-field t-search"><span><Search size={16}/> Buscar nos modelos</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nome, categoria ou trecho do roteiro"/></label>
    <p className="w-muted" aria-live="polite">{results.length} de {templates.length} modelo(s) · limite de {TEMPLATE_LIMITS.count}</p>
    <div className="t-template-grid">{results.map(template => <article className="w-card t-template-card" key={template.id}>
      <span className="w-eyebrow">{template.category}</span><h2>{template.title}</h2>
      <details><summary>Conferir roteiro completo</summary><pre className="t-template-body">{template.body}</pre></details>
      <div className="w-actions"><button className="w-button primary" onClick={() => onApply(template)}>Usar como guia</button><button className="w-button" onClick={() => startEdit(template)} aria-label={`Editar ${template.title}`}><Pencil size={16}/> Editar</button><button className="w-button" onClick={() => duplicate(template)} aria-label={`Duplicar ${template.title}`}><Copy size={16}/> Duplicar</button><button className="w-button" onClick={() => remove(template)} aria-label={`Excluir ${template.title}`}><Trash2 size={16}/> Excluir</button></div>
    </article>)}</div>
    {!results.length && <div className="w-card w-empty"><BookOpen/><h2>{templates.length ? 'Nenhum roteiro encontrado' : 'Sua biblioteca está vazia'}</h2><p>{templates.length ? 'Tente outro nome, categoria ou trecho.' : 'Crie um modelo ou importe uma biblioteca que você já exportou.'}</p></div>}
  </section>;
}
