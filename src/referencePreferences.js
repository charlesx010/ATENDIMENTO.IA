// Atalhos pessoais: somente identificadores dos catálogos, nunca conteúdo clínico.
export const MAX_REFERENCE_FAVORITES=30;
export const MAX_REFERENCE_RECENTS=6;
const idPattern=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
const scopePattern=/^[A-Za-z0-9_-]{1,120}$/;
const modules=new Set(['prescriptions','emergency']);
const memoryFallback=new Map();
const keyPattern=/^iai-reference-shortcuts:v1:(?:prescriptions|emergency):[A-Za-z0-9_-]{1,120}$/;
const validKey=key=>typeof key==='string'&&keyPattern.test(key);
export function hasReferenceMemory(key){return validKey(key)&&memoryFallback.has(key);}
export function invalidateReferenceMemory(key){
 if(key===null)memoryFallback.clear();
 else if(validKey(key))memoryFallback.delete(key);
}
export function referenceStorageKey(module,scope){
 return modules.has(module)&&typeof scope==='string'&&scopePattern.test(scope)
  ?`iai-reference-shortcuts:v1:${module}:${scope}`:null;
}
export function normalizeReferencePreferences(value){
 const clean=(list,limit)=>Array.isArray(list)?[...new Set(list.filter(id=>typeof id==='string'&&idPattern.test(id)))].slice(0,limit):[];
 return value&&typeof value==='object'&&value.schema===1
  ?{schema:1,favorites:clean(value.favorites,MAX_REFERENCE_FAVORITES),recent:clean(value.recent,MAX_REFERENCE_RECENTS)}
  :{schema:1,favorites:[],recent:[]};
}
export function readReferencePreferences(storage,key){
 if(!validKey(key))return normalizeReferencePreferences(null);
 if(memoryFallback.has(key))return normalizeReferencePreferences(memoryFallback.get(key));
 try{
  const raw=storage?.getItem(key);
  // Corrupted or foreign data must not cause an expensive parse or crash.
  return normalizeReferencePreferences(raw&&raw.length<=12000?JSON.parse(raw):null);
 }catch{return normalizeReferencePreferences(null);}
}
export function writeReferencePreferences(storage,key,value){
 if(!validKey(key))return false;
 const clean=normalizeReferencePreferences(value);
 try{
  storage.setItem(key,JSON.stringify(clean));memoryFallback.delete(key);return true;
 }catch{
  // Only failed writes live in memory; they survive module navigation, not a
  // browser reload. Namespace and bounds prevent cross-account reuse.
  memoryFallback.delete(key);memoryFallback.set(key,clean);
  if(memoryFallback.size>100)memoryFallback.delete(memoryFallback.keys().next().value);
  return false;
 }
}
export function toggleReferenceFavorite(value,id){
 const current=normalizeReferencePreferences(value);
 if(typeof id!=='string'||!idPattern.test(id))return current;
 if(current.favorites.includes(id))return {...current,favorites:current.favorites.filter(item=>item!==id)};
 if(current.favorites.length>=MAX_REFERENCE_FAVORITES)return current;
 return {...current,favorites:[...current.favorites,id]};
}
export function visitReference(value,id){
 const current=normalizeReferencePreferences(value);
 if(typeof id!=='string'||!idPattern.test(id))return current;
 return {...current,recent:[id,...current.recent.filter(item=>item!==id)].slice(0,MAX_REFERENCE_RECENTS)};
}


