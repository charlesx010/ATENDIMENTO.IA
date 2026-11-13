// Regras de conta do painel administrativo, separadas da Function para teste sem rede.

export function newAccountProfile({ userId, username, displayName }) {
  return {
    user_id: userId, username, display_name: displayName, role: 'medico', enabled: true,
    must_change_password: true, consultation_enabled: true, ai_enabled: false, monthly_limit_usd: 0
  };
}

// O banco cria um perfil automático (gatilho em auth.users) com nome de usuário gerado.
// Um INSERT simples colidia com esse perfil e a conta recém-criada era apagada.
// O upsert por user_id substitui o perfil automático e também atende bancos sem o gatilho.
export async function provisionAccountProfile(service, account) {
  const { error } = await service.from('profiles').upsert(newAccountProfile(account), { onConflict: 'user_id' });
  return error || null;
}

// Somente campos que o administrador pode alterar em contas de profissionais.
export function accountChanges(body) {
  const allowed = {};
  if (typeof body?.enabled === 'boolean') allowed.enabled = body.enabled;
  if (typeof body?.consultationEnabled === 'boolean') allowed.consultation_enabled = body.consultationEnabled;
  if (typeof body?.aiEnabled === 'boolean') allowed.ai_enabled = body.aiEnabled;
  if (typeof body?.monthlyLimit === 'number' && Number.isFinite(body.monthlyLimit) && body.monthlyLimit >= 0 && body.monthlyLimit <= 10000) allowed.monthly_limit_usd = body.monthlyLimit;
  return allowed;
}
