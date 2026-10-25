import {useCallback, useEffect, useRef, useState} from 'react';
import {supabase} from './supabase.js';
import {expiresAt, parseTemporaryPayload} from './temporarySession.js';

export function useTemporarySession({enabled, userId, snapshot, onRestore}) {
  const [phase, setPhase] = useState(enabled ? 'checking' : 'disabled');
  const [active, setActive] = useState(false);
  const [meta, setMeta] = useState(null);
  const versionRef = useRef(null);
  const latestRef = useRef(snapshot);
  useEffect(() => { latestRef.current = snapshot; }, [snapshot]);

  const check = useCallback(async () => {
    if (!enabled || !userId) { setPhase('disabled'); return; }
    setPhase('checking');
    const {data, error} = await supabase.from('clinical_sessions').select('version,updated_at,expires_at').eq('user_id', userId).maybeSingle();
    if (error) { setPhase('error'); return; }
    versionRef.current = data?.version ?? null;
    setMeta(data || null); setPhase(data ? 'available' : 'idle');
  }, [enabled, userId]);

  useEffect(() => { setActive(false); versionRef.current = null; check(); }, [check]);

  const save = useCallback(async (allowInactive = false) => {
    if (!enabled || !userId || (!active && !allowInactive)) return false;
    const payload = latestRef.current;
    try {
      const expires_at = expiresAt();
      if (versionRef.current === null) {
        const {data, error} = await supabase.from('clinical_sessions').insert({user_id:userId, payload, version:1, expires_at}).select('version,updated_at,expires_at').maybeSingle();
        if (error) { setPhase('conflict'); return false; }
        versionRef.current = data.version; setMeta(data); setPhase('synced'); return true;
      }
      const expected = versionRef.current;
      const {data, error} = await supabase.from('clinical_sessions').update({payload, version:expected + 1, expires_at}).eq('user_id', userId).eq('version', expected).select('version,updated_at,expires_at').maybeSingle();
      if (error) { setPhase('error'); return false; }
      if (!data) { setPhase('conflict'); return false; }
      versionRef.current = data.version; setMeta(data); setPhase('synced'); return true;
    } catch { setPhase('error'); return false; }
  }, [active, enabled, userId]);

  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setTimeout(() => { save(); }, 1000);
    return () => window.clearTimeout(timer);
  }, [active, snapshot, save]);

  const activate = useCallback(async () => {
    if (!window.confirm('Ativar a sincronização temporária desta consulta? Somente o texto digitado, transcrito e os documentos gerados serão guardados na sua conta por até 24 horas. Áudio e imagens não são enviados.')) return false;
    setActive(true); return save(true);
  }, [save]);

  const resume = useCallback(async () => {
    if (!window.confirm('Carregar a consulta temporária salvará os dados desta aba. Continuar?')) return false;
    const {data, error} = await supabase.from('clinical_sessions').select('payload,version,updated_at,expires_at').eq('user_id', userId).maybeSingle();
    const payload = !error && parseTemporaryPayload(data?.payload);
    if (!payload) { setPhase(error ? 'error' : 'idle'); return false; }
    versionRef.current = data.version; setMeta(data); onRestore(payload); setActive(true); setPhase('synced'); return true;
  }, [onRestore, userId]);

  const clearRemote = useCallback(async () => {
    if (!enabled || !userId) return true;
    const {error} = await supabase.from('clinical_sessions').delete().eq('user_id', userId);
    if (error) { setPhase('error'); return false; }
    versionRef.current = null; setMeta(null); setActive(false); setPhase('idle'); return true;
  }, [enabled, userId]);

  return {phase, active, meta, activate, resume, reload:check, saveNow:save, clearRemote};
}
