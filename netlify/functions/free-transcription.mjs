import { authenticatedAccount, reserveUsage, reserveLegacyUsage, usageDenied, UsageAccessError } from '../lib/usage-policy.mjs';

const respond = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers }
});
const MAX_BYTES = 3600000;
export function createTranscriptionHandler({ env = process.env, fetcher = fetch, authenticate = authenticatedAccount, limiter = reserveUsage } = {}) {
  const featureEnabled = () => {
    const configured = env.GROQ_TRANSCRIPTION_ENABLED;
    return (configured === undefined ? env.FREE_TRANSCRIPTION_ENABLED === 'true' : configured === 'true') && Boolean(env.GROQ_API_KEY);
  };
  return async request => {
    if (request.method === 'GET') return respond({ available: featureEnabled(), provider: 'Groq Whisper', freePlanRequired: true });
    if (request.method !== 'POST') return respond({ error: 'Método não permitido.' }, 405);
    if (!featureEnabled()) return respond({ error: 'Whisper gratuito ainda não configurado. Use o reconhecimento do navegador.' }, 503);
    const header = request.headers.get('authorization') || '';
    if (!/^Bearer \S{20,10000}$/.test(header)) return respond({ error: 'Faça login.' }, 401);
    const token = header.slice(7);
    if (request.headers.get('x-clinical-consent') !== 'fictitious_only') return respond({ error: 'Confirme que o áudio é totalmente fictício.' }, 400);
    const mime = (request.headers.get('content-type') || '').split(';')[0].toLowerCase();
    if (!['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav'].includes(mime)) return respond({ error: 'Formato de áudio não aceito.' }, 415);
    if (Number(request.headers.get('content-length') || 0) > MAX_BYTES) return respond({ error: 'Áudio muito grande.' }, 413);
    try {
      const account = await authenticate(token, env);
      if (!account) return respond({ error: 'Conta não habilitada.' }, 403);
      const buffer = await request.arrayBuffer();
      if (buffer.byteLength < 1500 || buffer.byteLength > MAX_BYTES) return respond({ error: 'Áudio vazio ou acima de 3,6 MB.' }, 413);
      const usage = await reserveLegacyUsage(account, 'transcription', env, limiter);
      if (!usage?.allowed) {
        const denied = usageDenied(usage);
        return respond(denied.body, 429, denied.headers);
      }
      const extensions = { 'audio/mp4': 'mp4', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/webm': 'webm' };
      const form = new FormData();
      form.append('file', new Blob([buffer], { type: mime }), 'dictation.' + extensions[mime]);
      form.append('model', 'whisper-large-v3');
      form.append('language', 'pt');
      form.append('temperature', '0');
      form.append('response_format', 'verbose_json');
      form.append('prompt', 'Atendimento médico fictício em português brasileiro. Transcreva literalmente, preservando negações, números, doses, datas e lateralidade (direito/esquerdo). Vocabulário: anamnese, exame físico, joelho, ombro, tornozelo, punho, quadril, coluna, fratura, entorse, luxação, mobilidade, neurovascular, radiografia, tomografia, ressonância magnética, Lasègue, Jobe, fisioterapia.');
      const response = await fetcher('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST', headers: { authorization: 'Bearer ' + env.GROQ_API_KEY }, body: form, signal: AbortSignal.timeout(35000)
      });
      if (!response.ok) {
        if (response.status === 429) return respond({ error: 'Cota gratuita do Whisper atingida. Use o microfone do navegador.' }, 429);
        return respond({ error: 'Transcrição por IA indisponível. Nenhum texto foi substituído.' }, 502);
      }
      const body = await response.json();
      const text = String(body?.text || '').trim();
      if (!text || text.length > 12000) return respond({ error: 'Sem transcrição aproveitável. Confira o áudio.' }, 502);
      const segments = Array.isArray(body?.segments) ? body.segments : [];
      const lowConfidence = segments.filter(segment => Number(segment?.avg_logprob) < -0.5 || Number(segment?.no_speech_prob) > 0.35).length;
      const qualityWarnings = [];
      if (lowConfidence) qualityWarnings.push('Um ou mais trechos tiveram baixa confiança. Compare com o áudio e corrija antes de inserir.');
      if (body?.language && body.language !== 'pt') qualityWarnings.push('O idioma detectado não foi português. Revise toda a transcrição.');
      return respond({ text, provider: 'groq-whisper-large-v3', requiresReview: true, needsReview: true, qualityWarnings });
    } catch (error) {
      if (error instanceof UsageAccessError) return respond({ error: error.message, code: error.code }, error.status);
      return respond({ error: error?.name === 'TimeoutError' ? 'A transcrição demorou demais. Tente o microfone do navegador.' : 'Falha na transcrição. Nenhum áudio foi salvo pelo aplicativo.' }, 503);
    }
  };
}
export default createTranscriptionHandler();
