import {createClient} from '@supabase/supabase-js';

const respond=(value,status=200)=>new Response(JSON.stringify(value),{
 status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}
});
const featureEnabled=()=>{
 const configured=process.env.GROQ_TRANSCRIPTION_ENABLED;
 return (configured===undefined?process.env.FREE_TRANSCRIPTION_ENABLED==='true':configured==='true')&&Boolean(process.env.GROQ_API_KEY);
};
const MAX_BYTES=3600000;
export default async function handler(request){
 if(request.method==='GET')return respond({available:featureEnabled(),provider:'Groq Whisper',freePlanRequired:true});
 if(request.method!=='POST')return respond({error:'Método não permitido.'},405);
 if(!featureEnabled())return respond({error:'Whisper gratuito ainda não configurado. Use o reconhecimento do navegador.'},503);
 const header=request.headers.get('authorization')||'';
 if(!/^Bearer [^\s]+$/.test(header))return respond({error:'Faça login.'},401);
 const token=header.slice(7);
 if(token.length<20||token.length>10000)return respond({error:'Sessão inválida.'},401);
 if(request.headers.get('x-clinical-consent')!=='fictitious_only')
  return respond({error:'Confirme que o áudio é totalmente fictício.'},400);
 const mime=(request.headers.get('content-type')||'').split(';')[0].toLowerCase();
 if(!['audio/webm','audio/mp4','audio/ogg','audio/mpeg','audio/wav'].includes(mime))
  return respond({error:'Formato de áudio não aceito.'},415);
 if(Number(request.headers.get('content-length')||0)>MAX_BYTES)return respond({error:'Áudio muito grande.'},413);
 try{
  const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{
    auth:{persistSession:false,autoRefreshToken:false}
  });
  const {data,error}=await supabase.auth.getUser(token);
  if(error||!data?.user)return respond({error:'Sessão expirada.'},401);
  const {data:profile,error:pe}=await supabase.from('profiles')
   .select('role,enabled,must_change_password').eq('user_id',data.user.id).single();
  if(pe||!profile?.enabled||profile.must_change_password)
   return respond({error:'Conta não habilitada.'},403);
  if(profile.role==='admin'){
   let claims;
   try{claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));}
   catch{return respond({error:'Sessão inválida.'},401);}
   if(claims.sub!==data.user.id||claims.aal!=='aal2')
    return respond({error:'Confirme a autenticação em duas etapas.'},403);
  }
  const buffer=await request.arrayBuffer();
  if(buffer.byteLength<1500||buffer.byteLength>MAX_BYTES)
   return respond({error:'Áudio vazio ou acima de 3,6 MB.'},413);
  const name=mime==='audio/mp4'?'dictation.mp4':mime==='audio/ogg'?'dictation.ogg':'dictation.webm';
  const form=new FormData();
  form.append('file',new Blob([buffer],{type:mime}),name);
  form.append('model','whisper-large-v3');
  form.append('language','pt');
  form.append('temperature','0');
  form.append('response_format','verbose_json');
  form.append('prompt','Atendimento médico fictício em português brasileiro. Transcreva literalmente, preservando negações, números, doses, datas e lateralidade (direito/esquerdo). Vocabulário: anamnese, exame físico, joelho, ombro, tornozelo, punho, quadril, coluna, fratura, entorse, luxação, mobilidade, neurovascular, radiografia, tomografia, ressonância magnética, Lasègue, Jobe, fisioterapia.');
  const response=await fetch('https://api.groq.com/openai/v1/audio/transcriptions',{
   method:'POST',headers:{authorization:'Bearer '+process.env.GROQ_API_KEY},
   body:form,signal:AbortSignal.timeout(35000)
  });
  if(!response.ok){
   if(response.status===429)return respond({error:'Cota gratuita do Whisper atingida. Use o microfone do navegador.'},429);
   return respond({error:'Transcrição por IA indisponível. Nenhum texto foi substituído.'},502);
  }
  const body=await response.json();
  const text=String(body?.text||'').trim();
  if(!text||text.length>12000)return respond({error:'Sem transcrição aproveitável. Confira o áudio.'},502);
  const segments=Array.isArray(body?.segments)?body.segments:[];
  const lowConfidence=segments.filter(segment=>Number(segment?.avg_logprob)<-0.5||Number(segment?.no_speech_prob)>0.35).length;
  const qualityWarnings=[];
  if(lowConfidence)qualityWarnings.push('Um ou mais trechos tiveram baixa confiança. Compare com o áudio e corrija antes de inserir.');
  if(body?.language&&body.language!=='pt')qualityWarnings.push('O idioma detectado não foi português. Revise toda a transcrição.');
  return respond({text,provider:'groq-whisper-large-v3',requiresReview:true,needsReview:true,qualityWarnings});
 }catch(e){
  return respond({error:e?.name==='TimeoutError'?'A transcrição demorou demais. Tente o microfone do navegador.':'Falha na transcrição. Nenhum áudio foi salvo pelo aplicativo.'},503);
 }
}
