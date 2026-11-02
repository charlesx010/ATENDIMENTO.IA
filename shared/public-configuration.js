// Contrato compartilhado: somente URL e credencial pública podem chegar ao navegador.
export function validatePublicConfiguration(value) {
  if(!value || typeof value.url!=='string' || typeof value.anonKey!=='string') return null;
  let url;try{url=new URL(value.url)}catch{return null;}
  const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if(url.protocol!=='https:'&&!(local&&url.protocol==='http:'))return null;
  if(url.username||url.password||url.search||url.hash||!['','/'].includes(url.pathname)||/SEU-PROJETO/i.test(url.hostname))return null;
  const key=value.anonKey.trim();
  if(key.length>8192||/\s/.test(key)||key.startsWith('sb_secret_'))return null;
  let publicKey=/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(key);
  if(!publicKey){try{const parts=key.split('.');if(parts.length!==3)return null;const claims=JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));publicKey=claims.role==='anon';}catch{return null;}}
  return publicKey?{url:url.origin,anonKey:key}:null;
}
export async function resolveRuntimeConfiguration({existing=null,fetcher=fetch,timeoutMs=6000}={}) {
  const configured=validatePublicConfiguration(existing);if(configured)return configured;
  const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),timeoutMs);
  try{
    const r=await fetcher('/api/public-config',{cache:'no-store',signal:abort.signal});
    if(!r.ok)return null;
    return validatePublicConfiguration((await r.json())?.supabase);
  }catch{return null;}finally{clearTimeout(timer);}
}
