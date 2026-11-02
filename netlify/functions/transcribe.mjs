import { createClient } from '@supabase/supabase-js';

// Apenas o servidor usa a chave OpenAI. O áudio é processado em memória,
// nunca gravado no Supabase, no Netlify Blobs ou nos logs do aplicativo.
const reply = (body, status=200) => new Response(JSON.stringify(body), {
  status, headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  }
});
const MAX_BYTES = 1_500_000;
const MAX_SECONDS = 120;
const ALLOWED_MIME = ['audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/wav','audio/x-wav'];
function getExtension(type) {
  if(type.includes('mp4'))return '.m4a';
  if(type.includes('ogg'))return '.ogg';
  if(type.includes('wav'))return '.wav';
  if(type.includes('mpeg'))return '.mp3';
  return '.webm';
}
export default async (request) => {
  if(request.method!=='POST') return reply({error:'Método inválido'},405);
 if(process.env.LEGACY_PAID_AI_ENABLED!=='true')return reply({error:'IA paga legada desativada por segurança.'},503);
  // Nenhuma chamada paga ocorre se a nova chave e a base não estiverem configuradas.
  if(!process.env.OPENAI_API_KEY || !process.env.SUPABASE_URL ||
     !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return reply({error:'IA desativada. A chave de servidor ainda não foi configurada.'},503);
  }
  const bearer=request.headers.get('authorization')||'';
  const token=bearer.startsWith('Bearer ')?bearer.slice(7):'';
  if(!token || token.length>10000)return reply({error:'Faça login para transcrever.'},401);
  const contentType=request.headers.get('content-type')||'';
  if(!contentType.startsWith('multipart/form-data;'))return reply({error:'Formato inválido.'},415);
  const declaredLength=Number(request.headers.get('content-length')||0);
  if(declaredLength>2_000_000)return reply({error:'Gravação acima do limite do teste.'},413);

  const service=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{
    auth:{persistSession:false,autoRefreshToken:false}
  });
  try{
    const {data:identity,error:authError}=await service.auth.getUser(token);
    if(authError||!identity?.user) return reply({error:'Sessão expirada. Entre novamente.'},401);
    const {data:profile,error:profileError}=await service.from('profiles')
      .select('role,enabled,ai_enabled,monthly_limit_usd')
      .eq('user_id',identity.user.id).single();
    if(profileError || !profile?.enabled) return reply({error:'Acesso não habilitado.'},403);
    if(!profile.ai_enabled || Number(profile.monthly_limit_usd)<=0)
      return reply({error:'IA desativada para esta conta. Ative um limite financeiro na Administração.'},403);

    // Contas administrativas precisam de sessão AAL2 também no backend.
    if(profile.role==='admin'){
      let claims;
      try{claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));}
      catch{return reply({error:'Token inválido'},401);}
      if(claims.sub!==identity.user.id || claims.aal!=='aal2')
        return reply({error:'Confirme o segundo fator para acessar a IA.'},403);
    }

    const form=await request.formData();
    if(form.get('consent')!=='test_audio_only')
      return reply({error:'Confirme que o áudio é fictício e pode ser enviado à OpenAI.'},400);
    const duration=Number(form.get('duration_seconds'));
    if(!Number.isFinite(duration)||duration<1||duration>MAX_SECONDS)
      return reply({error:'Duração inválida. O teste permite até dois minutos.'},400);
    const file=form.get('audio');
    if(!file || typeof file.size!=='number' || typeof file.arrayBuffer!=='function')
      return reply({error:'Nenhum áudio recebido.'},400);
    if(file.size<512||file.size>MAX_BYTES)
      return reply({error:'Arquivo de áudio inválido ou muito grande.'},413);
    const mime=(file.type||'').split(';')[0].toLowerCase();
    if(!ALLOWED_MIME.includes(mime))
      return reply({error:'Formato de áudio não aceito.'},415);

    // Reserva conservadora de US$ 0,02 por pedido, em transação atômica no banco.
    // Isso não substitui limites e orçamento na conta da OpenAI.
    const {data:reserved,error:reserveError}=await service.rpc('reserve_transcription_budget',{
      p_user_id:identity.user.id
    });
    if(reserveError || reserved!==true)
      return reply({error:'Limite mensal de IA atingido ou não autorizado. Nenhuma chamada enviada.'},429);

    const submission=new FormData();
    submission.append('model','gpt-transcribe');
    submission.append('prompt','Consulta médica fictícia em português brasileiro. Preserve fielmente nomes de medicamentos, números e termos clínicos falados. Não acrescente dados.');
    submission.append('file',file,'gravacao'+getExtension(mime));

    const response=await fetch('https://api.openai.com/v1/audio/transcriptions',{
      method:'POST',
      headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},
      body:submission,
      signal:AbortSignal.timeout(45000)
    });
    if(!response.ok){
      const message=response.status===401 ? 'Chave da OpenAI inválida. Verifique o Netlify.'
        : response.status===429 ? 'Limite ou saldo da OpenAI insuficiente.'
        : 'A transcrição não pôde ser concluída. Verifique as configurações da OpenAI.';
      return reply({error:message},502);
    }
    const result=await response.json();
    const transcript=typeof result?.text==='string'?result.text.trim():'';
    if(!transcript || transcript.length>30000)
      return reply({error:'A transcrição retornou vazia ou inválida. Tente novamente.'},502);
    return reply({text:transcript,model:'gpt-transcribe',note:'Texto gerado automaticamente: revise antes de inserir nas anotações.'});
  }catch(e){
    return reply({error:e?.name==='TimeoutError'
      ? 'A transcrição demorou demais. Nenhum texto foi salvo.'
      : 'Não foi possível completar a transcrição. Nenhum texto foi salvo.'},503);
  }
};
