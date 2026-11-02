import { authenticatedAccount, UsageAccessError } from '../lib/usage-policy.mjs';
import { parseTemplateLibrary, TEMPLATE_LIMITS } from '../../src/workspace/templates.js';

const HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUEST_LIMIT = TEMPLATE_LIMITS.fileBytes + 256;
const json = (value, status = 200, extra = {}) => new Response(JSON.stringify(value), { status, headers: { ...HEADERS, ...extra } });
class TemplatesError extends Error {
  constructor(message = 'Não foi possível acessar seus modelos. Verifique a configuração da biblioteca na nuvem.', status = 503, code = 'templates_unavailable') { super(message); this.status = status; this.code = code; }
}
function cleanLibrary(value) {
  const templates = parseTemplateLibrary(value);
  const library = { schema: 1, kind: 'documentation-checklists', templates };
  if (new TextEncoder().encode(JSON.stringify(library)).length > TEMPLATE_LIMITS.fileBytes) throw Error('A biblioteca excede o limite de tamanho.');
  return library;
}
function publicRow(row) {
  if (!row) return { version: null, library: null, updatedAt: null };
  if (!UUID.test(row.version || '') || typeof row.updated_at !== 'string' || !Number.isFinite(Date.parse(row.updated_at))) throw new TemplatesError();
  try { return { version: row.version, library: cleanLibrary(row.library), updatedAt: row.updated_at }; }
  catch { throw new TemplatesError(); }
}
async function readOwn(account) {
  const { data, error } = await account.client.from('personal_template_libraries').select('version,library,updated_at').eq('user_id', account.userId).maybeSingle();
  if (error) throw new TemplatesError();
  return data;
}
async function saveOwn(account, expectedVersion, library) {
  const { data, error } = await account.client.rpc('save_personal_template_library', { p_user: account.userId, p_expected: expectedVersion, p_library: library });
  if (error || !data || !['saved', 'conflict'].includes(data.status)) throw new TemplatesError();
  return data;
}
async function removeOwn(account, expectedVersion) {
  const { data, error } = await account.client.rpc('delete_personal_template_library', { p_user: account.userId, p_expected: expectedVersion });
  if (error || !data || !['deleted', 'conflict'].includes(data.status)) throw new TemplatesError();
  return data;
}
async function parseBody(request, method) {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) throw new TemplatesError('Envie um arquivo JSON válido.', 415, 'invalid_template_library');
  if (Number(request.headers.get('content-length') || 0) > REQUEST_LIMIT) throw new TemplatesError('A biblioteca excede o limite de tamanho.', 413, 'invalid_template_library');
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > REQUEST_LIMIT) throw new TemplatesError('A biblioteca excede o limite de tamanho.', 413, 'invalid_template_library');
  let body;
  try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new TemplatesError('O conteúdo enviado não é JSON válido.', 400, 'invalid_template_library'); }
  const keys = method === 'PUT' ? ['expectedVersion', 'library'] : ['expectedVersion'];
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== keys.length || Object.keys(body).some(key => !keys.includes(key))) {
    throw new TemplatesError('Campos da biblioteca inválidos.', 400, 'invalid_template_library');
  }
  if (!(method === 'PUT' && body.expectedVersion === null) && (typeof body.expectedVersion !== 'string' || !UUID.test(body.expectedVersion))) throw new TemplatesError('Versão da biblioteca inválida.', 400, 'invalid_template_library');
  if (method === 'PUT') {
    try { body.library = cleanLibrary(body.library); }
    catch (error) { throw new TemplatesError(error.message, 400, 'invalid_template_library'); }
  }
  return body;
}
export function createPersonalTemplatesHandler({ env = process.env, authenticate = authenticatedAccount, read = readOwn, save = saveOwn, remove = removeOwn } = {}) {
  return async request => {
    if (!['GET', 'PUT', 'DELETE'].includes(request.method)) return json({ error: 'Método não permitido.' }, 405, { allow: 'GET, PUT, DELETE' });
    const authorization = request.headers.get('authorization') || '';
    if (!/^Bearer \S{20,10000}$/.test(authorization)) return json({ error: 'Entre na sua conta para acessar seus modelos.', code: 'unauthorized' }, 401);
    try {
      const account = await authenticate(authorization.slice(7), env);
      if (!account?.userId) throw new TemplatesError('Conta não habilitada.', 403, 'forbidden');
      if (request.method === 'GET') return json(publicRow(await read(account)));
      const body = await parseBody(request, request.method);
      const result = request.method === 'PUT' ? await save(account, body.expectedVersion, body.library) : await remove(account, body.expectedVersion);
      if (result.status === 'conflict') return json({ error: 'A biblioteca foi alterada em outro aparelho. Preserve sua cópia antes de carregar a versão da nuvem.', code: 'template_conflict', remote: publicRow(result.row) }, 409);
      if (request.method === 'DELETE' && result.status !== 'deleted') throw new TemplatesError();
      if (request.method === 'DELETE') return new Response(null, { status: 204, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
      if (result.status !== 'saved' || !result.row) throw new TemplatesError();
      return json(publicRow(result.row));
    } catch (error) {
      if (error instanceof UsageAccessError) return json({ error: error.status === 503 ? 'O acesso à biblioteca está indisponível. Verifique a configuração do servidor.' : error.message, code: error.status === 503 ? 'templates_unavailable' : error.code }, error.status);
      if (error instanceof TemplatesError) return json({ error: error.message, code: error.code }, error.status);
      return json({ error: 'Não foi possível acessar seus modelos agora. A biblioteca local foi preservada.', code: 'templates_unavailable' }, 503);
    }
  };
}
export default createPersonalTemplatesHandler();
