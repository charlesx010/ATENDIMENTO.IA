import { createClient } from '@supabase/supabase-js';

export const configured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY && !import.meta.env.VITE_SUPABASE_URL.includes('SEU-PROJETO'));
export const supabase = configured ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
}) : null;

export function accountEmail(username) {
  return `${username.toLowerCase()}@login.prontuario.invalid`;
}
export function validUsername(value) {
  return /^[a-z][a-z0-9_-]{2,29}$/.test(value);
}
export function newPayload() {
  return { specialty: 'Ortopedia e Traumatologia', patient: { name:'', age:'', sex:'', date:'', crm:'' }, notes:'', soap:{}, documents:{}, docType:'', draft:'' };
}
