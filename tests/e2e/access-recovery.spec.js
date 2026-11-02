import { test, expect } from '@playwright/test';

test('demonstração permanece acessível sem uma sessão de backend', async ({ page }) => {
  await page.route('**/auth/v1/**', route => route.abort());
  await page.goto('/demo/novo');
  await expect(page.getByRole('heading', { name: 'Uma consulta, bem organizada.' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Relato original', exact: true })).toBeVisible();
});

test('falha de renderização recebe tela segura sem expor a exceção nem recarregar automaticamente', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get() { throw new Error('conteudo-sensivel-nao-deve-aparecer'); } });
  });
  await page.goto('/demo/novo');
  await expect(page.getByRole('heading', { name: 'O aplicativo encontrou um problema' })).toBeVisible();
  await expect(page.getByText('Não recarregamos a página automaticamente.')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('conteudo-sensivel-nao-deve-aparecer');
  let confirmation = '';
  page.once('dialog', dialog => { confirmation = dialog.message(); dialog.dismiss(); });
  await page.getByRole('button', { name: 'Recarregar aplicativo' }).click();
  expect(confirmation).toContain('rascunho');
  await expect(page.getByRole('heading', { name: 'O aplicativo encontrou um problema' })).toBeVisible();
});
