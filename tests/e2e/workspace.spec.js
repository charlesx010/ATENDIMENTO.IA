import {test,expect} from '@playwright/test';
for(const width of [1440,390,360]) {
  test(`captura, revisão, exportação e catálogo em ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('/demo');
    await page.getByRole('button',{name:'Carregar exemplo fictício'}).click();
    const source=await page.getByRole('textbox',{name:'Relato original',exact:true}).inputValue();
    await page.getByRole('button',{name:'Organizar prontuário',exact:true}).click();
    await expect(page.getByRole('button',{name:'Gerar resumo e prontuário',exact:true})).toBeDisabled();
    await page.getByRole('button',{name:'Organizar sem IA',exact:true}).click();
    await expect(page.getByRole('button',{name:'Copiar prontuário',exact:true})).toBeDisabled();
    await page.getByLabel('Conferi o relato, negações, números, lateralidade e campos ausentes.').check();
    await expect(page.getByRole('button',{name:'Copiar prontuário',exact:true})).toBeEnabled();
    const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Baixar texto',exact:true}).click();
    const file=await downloading;expect(file.suggestedFilename()).toBe('prontuario-revisado.txt');
    const stream=await file.createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);
    expect(Buffer.concat(chunks).toString()).toContain('joelho direito');
    await page.getByRole('tab',{name:'1 Capturar'}).click();
    await page.getByRole('textbox',{name:'Relato original',exact:true}).fill(source+' Informação nova.');
    await page.getByRole('tab',{name:'3 Revisar'}).click();
    await expect(page.getByRole('button',{name:'Copiar prontuário',exact:true})).toBeDisabled();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByRole('button',{name:'Receituário',exact:true}).click();
    await page.getByRole('textbox',{name:'Pesquisar doença ou indicação'}).fill('Faringo');
    await page.getByRole('button',{name:/Faringoamigdalite/}).click();
    await expect(page.getByRole('button',{name:'Copiar receituário'})).toBeDisabled();
    expect(errors).toEqual([]);
  });
}
test('microfone simulado insere texto, não duplica e preserva relato ao recusar descarte',async({page})=>{
  await page.addInitScript(()=>{
    window.SpeechRecognition=class {
      start(){setTimeout(()=>{this.onstart?.();const r=[{transcript:'Paciente fictício relata dor no joelho direito.'}];r.isFinal=true;this.onresult?.({results:[r]});},10)}
      stop(){setTimeout(()=>this.onend?.(),0)} abort(){}
    };
  });
  await page.goto('/demo');
  await page.getByLabel('Entendi e autorizo apenas um teste fictício').check();
  await page.getByRole('button',{name:'Iniciar',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Transcrição gratuita para revisão'})).toHaveValue('Paciente fictício relata dor no joelho direito.');
  await page.getByRole('button',{name:'Parar',exact:true}).click();
  await expect(page.getByRole('button',{name:'Acrescentar à evolução'})).toBeVisible();
  page.once('dialog',dialog=>dialog.dismiss());
  await page.getByRole('tab',{name:'2 Organizar'}).click();
  await expect(page.getByRole('button',{name:'Acrescentar à evolução'})).toBeVisible();
  await page.getByRole('button',{name:'Acrescentar à evolução'}).click();
  await expect(page.getByRole('textbox',{name:'Relato original',exact:true})).toHaveValue('Paciente fictício relata dor no joelho direito.');
});
test('anexo TXT fictício passa por revisão e é inserido sem provedor externo',async({page})=>{
  await page.goto('/demo');
  await page.getByText('Anexar exame ou laudo fictício · OCR local',{exact:true}).click();
  await page.locator('.q-file-button input').setInputFiles({name:'exame-ficticio.txt',mimeType:'text/plain',buffer:Buffer.from('EXAME FICTÍCIO. Resultado informado apenas para teste.')});
  await expect(page.getByLabel('Texto extraído — revisar antes de inserir')).toHaveValue('EXAME FICTÍCIO. Resultado informado apenas para teste.');
  await page.getByRole('button',{name:'Inserir exame no atendimento'}).click();
  expect(await page.getByRole('textbox',{name:'Relato original',exact:true}).inputValue()).toContain('EXAME FICTÍCIO.');
});
test('backup é restaurado sem conservar aprovação e modal permite cancelar pelo teclado',async({page})=>{
  await page.goto('/demo');await page.getByRole('button',{name:'Configuração',exact:true}).click();
  const backup={schema:2,patient:'Teste backup',source:'Paciente fictício com dor.',summary:'Resumo de teste',soap:{subjective:'Dor relatada',objective:'',assessment:'',plan:''},pending:'',reviewed:true,generatedFrom:'Paciente fictício com dor.',origin:'manual'};
  await page.getByLabel('Arquivo JSON exportado pelo aplicativo').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await expect(page.getByRole('textbox',{name:'Relato original',exact:true})).toHaveValue(backup.source);
  await page.getByRole('tab',{name:'3 Revisar'}).click();await expect(page.getByRole('button',{name:'Copiar prontuário',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Nova consulta',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('entrada nova aceita usuário e mantém demonstração acessível sem configuração',async({page})=>{
 await page.goto('/');await expect(page.getByRole('heading',{name:'Uma consulta mais simples.'})).toBeVisible();
 await page.getByLabel('Nome de usuário').fill('charles');await page.getByRole('button',{name:'Continuar',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Entrar como charles'})).toBeVisible();
 await page.getByRole('button',{name:'Abrir demonstração gratuita'}).click();
 await expect(page.getByRole('heading',{name:'Uma consulta, bem organizada.'})).toBeVisible();
});
