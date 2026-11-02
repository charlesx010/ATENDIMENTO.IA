import {validatePublicConfiguration} from '../../shared/public-configuration.js';
export function createPublicConfigHandler({env=process.env}={}){
 return async request=>{
  const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
  if(request.method!=='GET')return new Response(JSON.stringify({error:'Método não permitido.'}),{status:405,headers});
  const publicConfig=validatePublicConfiguration({url:env.SUPABASE_URL||env.VITE_SUPABASE_URL,anonKey:env.SUPABASE_ANON_KEY||env.SUPABASE_PUBLISHABLE_KEY||env.VITE_SUPABASE_ANON_KEY});
  // Projeção explícita; nunca serializar env nem incluir service_role/Groq.
  const loginReady=Boolean(publicConfig&&env.SUPABASE_SERVICE_ROLE_KEY&&env.SUPABASE_URL&&(env.SUPABASE_ANON_KEY||env.SUPABASE_PUBLISHABLE_KEY));
  return new Response(JSON.stringify({configured:Boolean(publicConfig),supabase:publicConfig,loginReady,
   error:publicConfig?null:'Configuração pública do Supabase ausente ou inválida no servidor.'}),{status:publicConfig?200:503,headers});
 };
}
export default createPublicConfigHandler();
