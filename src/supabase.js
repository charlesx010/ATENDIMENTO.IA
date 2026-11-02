import { createClient } from '@supabase/supabase-js';
import {validatePublicConfiguration,resolveRuntimeConfiguration} from '../shared/public-configuration.js';
export let configured=false;
export let supabase=null;
export function configurePublicClient(value){
 const publicConfig=validatePublicConfiguration(value);
 if(!publicConfig)return false;
 try{
  const client=createClient(publicConfig.url,publicConfig.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  supabase=client;configured=true;return true;
 }catch{return false;}
}
configurePublicClient({url:import.meta.env.VITE_SUPABASE_URL,anonKey:import.meta.env.VITE_SUPABASE_ANON_KEY});
export async function initializeSupabase(){
 if(configured)return true;
 const publicConfig=await resolveRuntimeConfiguration();
 return configurePublicClient(publicConfig);
}
export function accountEmail(username){return `${username.toLowerCase()}@login.prontuario.invalid`;}
export function validUsername(value){return /^[a-z][a-z0-9_-]{2,29}$/.test(value);}
export function newPayload(){return {specialty:'Ortopedia e Traumatologia',patient:{name:'',age:'',sex:'',date:'',crm:''},notes:'',soap:{},documents:{},docType:'',draft:''};}
