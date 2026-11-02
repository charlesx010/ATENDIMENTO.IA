import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase.js';
import { ConsultationSync } from './sync.js';
export function useConsultationSync({ enabled, userId, doc, setDoc, onRemoteApplied, isEditing = false }) {
  const local = useRef(doc), controller = useRef(null), seen = useRef(JSON.stringify(doc));
  local.current = doc;
  const pending=useRef(isEditing), onRemote=useRef(onRemoteApplied);pending.current=isEditing;onRemote.current=onRemoteApplied;
  const [state, setState] = useState({ phase: 'disabled', remote: null });
  useEffect(() => {
    if (!enabled || !userId || !supabase) return;
    const store = {
      async read() {
        const { data, error } = await supabase.from('workspace_sessions').select('version,payload,expires_at').eq('user_id', userId).maybeSingle();
        if (error) throw error;
        return data;
      },
      async remove(version) {
        const {data,error} = await supabase.rpc('delete_workspace',{p_expected:version});
        if(error)throw error; return data === true;
      },
      async save(version, payload) {
        const { data, error } = await supabase.rpc('save_workspace', { p_expected: version, p_payload: payload });
        if (error) throw error;
        return data;
      }
    };
    seen.current = JSON.stringify(local.current);
    const c = new ConsultationSync({ store, getLocal: () => local.current, isEditing: () => pending.current,
      applyRemote: value => { onRemote.current?.(); local.current = value; seen.current = JSON.stringify(value); setDoc(value); }, onState: setState });
    controller.current = c;
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (navigator.onLine) c.tick(); else if (c.active && !['conflict','expired'].includes(c.state.phase)) c.emit('offline');
    }, 4000);
    const reconnect = () => c.tick();
    window.addEventListener('online', reconnect);
    window.addEventListener('focus', reconnect);
    return () => { clearInterval(timer); window.removeEventListener('online', reconnect); window.removeEventListener('focus', reconnect); c.stop(); controller.current = null; };
  }, [enabled, userId, setDoc]);
  useEffect(() => {
    const current = JSON.stringify(doc);
    if (current === seen.current) return;
    seen.current = current;
    controller.current?.changed();
    const timer = setTimeout(() => { if(navigator.onLine) controller.current?.tick(); },600);
    return () => clearTimeout(timer);
  }, [doc]);
  return { ...state, connect: () => controller.current?.connect(), reload: () => controller.current?.useRemote(), retry: () => controller.current?.tick(), clear: () => controller.current?.clear(), detach: () => controller.current?.detach() };
}
