import {test,expect} from '@playwright/test';

for (const width of [1440,390]) {
  test(`área original é padrão e preserva funções em ${width}px`, async ({page}) => {
    await page.setViewportSize({width,height:1000});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('/demo');
    await expect(page.getByRole('heading',{name:'Atendimento simplificado'})).toBeVisible();
    await expect(page.getByRole('button',{name:'Simplificado',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Completo',exact:true})).toBeVisible();
    const source='Paciente fictício refere dor no joelho direito após corrida. Ao exame: edema discreto. Conduta: retorno para reavaliação.';
    await page.getByRole('textbox',{name:'Transcrição / relato editável',exact:true}).fill(source);
    await page.getByRole('textbox',{name:'Informações complementares',exact:true}).fill('Sem outros achados informados.');
    await page.getByRole('button',{name:'Completo',exact:true}).click();
    await expect(page.getByRole('textbox',{name:'Digite, cole ou revise informações da consulta',exact:true})).toHaveValue(source);
    await page.getByRole('button',{name:'Gerar evolução',exact:true}).click();
    expect(await page.getByRole('textbox',{name:'Evolução clínica editável',exact:true}).inputValue()).toContain('JOELHO DIREITO');
    await page.getByRole('button',{name:'Complementar história (HDA)',exact:true}).click();
    await expect(page.getByRole('combobox',{name:'Escolher modelo de história clínica'})).toBeVisible();
    await expect(page.getByRole('button',{name:'Complementar exame físico',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Complementar conduta / tratamento',exact:true})).toBeVisible();
    await expect(page.getByRole('heading',{name:'Gerar documentos — grátis'})).toBeVisible();
    await expect(page.getByRole('heading',{name:'Central de documentos finais'})).toBeVisible();
    await page.getByRole('button',{name:'Receituário pronto',exact:true}).click();
    await page.getByRole('textbox',{name:'Pesquisar doença ou indicação'}).fill('Faringo');
    await page.getByRole('button',{name:/Faringoamigdalite/}).click();
    await expect(page.getByRole('button',{name:'Copiar receituário'})).toBeDisabled();
    expect(errors).toEqual([]);
  });
}

test('nova área exige escolha explícita e cancelamento preserva rascunho original',async({page})=>{
  await page.goto('/demo');
  await page.getByRole('textbox',{name:'Transcrição / relato editável',exact:true}).fill('Relato fictício que precisa ser preservado.');
  page.once('dialog',dialog=>dialog.dismiss());
  await page.getByRole('button',{name:'Experimentar nova área',exact:true}).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByRole('textbox',{name:'Transcrição / relato editável',exact:true})).toHaveValue('Relato fictício que precisa ser preservado.');
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Experimentar nova área',exact:true}).click();
  await expect(page).toHaveURL(/\/demo\/novo$/);
  await expect(page.getByRole('heading',{name:'Uma consulta, bem organizada.'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Voltar ao atendimento original',exact:true})).toBeVisible();
});
