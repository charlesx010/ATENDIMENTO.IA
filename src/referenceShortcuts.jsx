import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Clock,Star,Trash2} from 'lucide-react';
import {MAX_REFERENCE_FAVORITES,hasReferenceMemory,invalidateReferenceMemory,normalizeReferencePreferences,readReferencePreferences,referenceStorageKey,toggleReferenceFavorite,visitReference,writeReferencePreferences} from './referencePreferences.js';
import './reference-shortcuts.css';

const memoryNotice='Não foi possível guardar os atalhos neste navegador. Eles ficam disponíveis enquanto esta página permanecer aberta.';
function browserStorage(){try{return window.localStorage;}catch{return null;}}
export function useReferenceShortcuts(module,scope,items){
 const key=referenceStorageKey(module,scope);
 const load=()=>readReferencePreferences(browserStorage(),key);
 const [state,setState]=useState(()=>({key,value:load()}));
 const [notice,setNotice]=useState('');
 const latest=useRef(state);
 const value=state.key===key?state.value:load();
 const validIds=useMemo(()=>new Set(items.map(item=>item.id)),[items]);
 useEffect(()=>{
  const next={key,value:readReferencePreferences(browserStorage(),key)};
  latest.current=next;setState(next);setNotice(hasReferenceMemory(key)?memoryNotice:'');
  const sync=event=>{
   if(!key||(event.key!==null&&event.key!==key))return;
   invalidateReferenceMemory(event.key);
   const next={key,value:readReferencePreferences(browserStorage(),key)};
   latest.current=next;setState(next);setNotice('');
  };
  window.addEventListener('storage',sync);
  return()=>window.removeEventListener('storage',sync);
 },[key]);
 const forCatalog=useCallback(value=>validIds.size?{...value,favorites:value.favorites.filter(id=>validIds.has(id)),recent:value.recent.filter(id=>validIds.has(id))}:value,[validIds]);
 const update=useCallback(transform=>{
  const previous=forCatalog(latest.current.key===key?latest.current.value:readReferencePreferences(browserStorage(),key));
  const next=normalizeReferencePreferences(transform(previous));
  latest.current={key,value:next};setState(latest.current);
  setNotice(writeReferencePreferences(browserStorage(),key,next)?'':key
   ?memoryNotice
   :'Os atalhos ficam disponíveis somente nesta página.');
 },[key,forCatalog]);
 const toggle=useCallback(id=>{
  if(!validIds.has(id))return;
  const previous=forCatalog(latest.current.key===key?latest.current.value:readReferencePreferences(browserStorage(),key));
  if(!previous.favorites.includes(id)&&previous.favorites.length>=MAX_REFERENCE_FAVORITES){
   setNotice(`Você já tem ${MAX_REFERENCE_FAVORITES} favoritos. Remova um antes de adicionar outro.`);return;
  }
  update(previous=>toggleReferenceFavorite(previous,id));
 },[key,update,validIds,forCatalog]);
 const visit=useCallback(id=>{if(validIds.has(id))update(previous=>visitReference(previous,id));},[update,validIds]);
 const resolve=ids=>ids.map(id=>items.find(item=>item.id===id)).filter(Boolean);
 return {favorites:resolve(value.favorites),recent:resolve(value.recent),isFavorite:id=>value.favorites.includes(id),toggle,visit,
  clearRecent:()=>update(previous=>({...previous,recent:[]})),notice,persistent:Boolean(key)};
}

export function ReferenceFavoriteButton({favorite,onClick,kind}){
 return <button type="button" className="btn outline small reference-favorite" aria-pressed={favorite}
  aria-label={favorite?`Remover ${kind} dos favoritos`:`Favoritar ${kind}`} onClick={onClick}>
  <Star size={16} fill={favorite?'currentColor':'none'}/>{favorite?'Nos favoritos':'Favoritar'}
 </button>;
}
export default function ReferenceShortcuts({shortcuts,onOpen,label}){
 const shortcutsList=(items,kind)=><div className="reference-shortcut-list">{items.map(item=><button key={item.id} type="button"
  className="reference-shortcut" onClick={()=>onOpen(item)} aria-label={`Abrir ${kind}: ${item.name}`}>{item.name}</button>)}</div>;
 return <section className="reference-shortcuts" aria-label={label}>
  <div className="reference-shortcuts-heading"><strong>Seus atalhos</strong><span>{shortcuts.persistent?'Neste navegador, para sua conta.':'Disponíveis nesta página.'} Sem dados de pacientes.</span></div>
  <div className="reference-shortcuts-grid">
   <section><h2><Star size={15}/> Favoritos</h2>
    {shortcuts.favorites.length?<>{shortcutsList(shortcuts.favorites.slice(0,6),'favorito')}
     {shortcuts.favorites.length>6&&<details><summary>Ver mais favoritos ({shortcuts.favorites.length-6})</summary>{shortcutsList(shortcuts.favorites.slice(6),'favorito')}</details>}</>
     :<p>Abra uma ficha e toque em Favoritar para encontrá-la aqui.</p>}
   </section>
   <section><div className="reference-recent-heading"><h2><Clock size={15}/> Recentes</h2>
    {shortcuts.recent.length>0&&<button type="button" className="reference-clear" onClick={shortcuts.clearRecent}><Trash2 size={13}/> Limpar recentes</button>}</div>
    {shortcuts.recent.length?shortcutsList(shortcuts.recent,'recente'):<p>As referências que você abrir aparecerão aqui.</p>}
   </section>
  </div>
  {shortcuts.notice&&<p className="q-feedback" role="status">{shortcuts.notice}</p>}
 </section>;
}


