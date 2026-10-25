import { createClient } from '@supabase/supabase-js';

const respond=(data,status=200)=>new Response(JSON.stringify(data),{
  status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
});

// Nova senha de conta convidada: atualiza Auth e somente depois marca o
// primeiro acesso como concluido, ambos no servidor.
export default async(request)=>{
  if(request.method!=='POST')return respond({error:'Método não permitido'},405);
  if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return respond({error:'Serviço indisponível'},503);
  const auth=request.headers.get('authorization')||'';
  if(!auth.startsWith('Bearer '))return respond({error:'Faça login novamente'},401);
  const token=auth.slice(7);
  if(token.length>10000)return respond({error:'Token inválido'},401);
  let newPassword;
  try{
    const raw=await request.text();
    if(raw.length>2000)return respond({error:'Solicitação inválida'},400);
    newPassword=JSON.parse(raw).password;
  }catch{return respond({error:'Solicitação inválida'},400)}
  if(typeof newPassword!=='string'||newPassword.length<12||newPassword.length>128)
    return respond({error:'Use uma senha entre 12 e 128 caracteres.'},400);

  const service=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{
    auth:{persistSession:false,autoRefreshToken:false}
  });
  try{
    const {data:identity,error:authError}=await service.auth.getUser(token);
    if(authError||!identity?.user)return respond({error:'Sessão inválida'},401);
    const {data:profile,error:profileError}=await service.from('profiles')
      .select('enabled,must_change_password').eq('user_id',identity.user.id).single();
    if(profileError||!profile?.enabled)return respond({error:'Conta desativada'},403);
    if(!profile.must_change_password)return respond({error:'Troca inicial não solicitada'},409);
    const {error:passwordError}=await service.auth.admin.updateUserById(identity.user.id,{password:newPassword});
    if(passwordError) return respond({error:'Não foi possível alterar a senha. Tente outra.'},400);
    const {error:doneError}=await service.from('profiles')
      .update({must_change_password:false}).eq('user_id',identity.user.id);
    if(doneError)return respond({error:'Senha alterada, mas não foi possível finalizar. Contate o administrador.'},503);
    return respond({success:true});
  }catch{return respond({error:'Não foi possível atualizar a senha.'},503)}
};
