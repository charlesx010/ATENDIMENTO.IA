import {test,expect} from '@playwright/test';
async function localNote(page){await page.goto('/demo');await page.getByRole('button',{name:'Carregar exemplo fictício'}).click();await page.getByRole('button',{name:'Organizar prontuário',exact:true}).click();await page.getByRole('button',{name:'Organizar sem IA',exact:true}).click();}
test('roteiro pessoal orienta captura sem contaminar relato e continua após navegar',async({page})=>{
 await page.setViewportSize({width:390,height:900});await page.goto('/demo');
 await page.getByRole('button',{name:'Modelos',exact:true}).click();
 await page.getByRole('button',{name:'Usar como guia',exact:true}).first().click();
 await expect(page.locator('.w-capture-guide')).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Relato original',exact:true})).toHaveValue('');
 await page.getByRole('button',{name:'Modelos',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Meus modelos'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Meu uso',exact:true}).click();
 await expect(page.getByText('Não há assinatura, pagamento ou renovação ativados nesta versão.',{exact:false})).toBeVisible();
});
test('versão anterior restaura conteúdo sem herdar aprovação',async({page})=>{
 await localNote(page);
 await page.getByLabel('Resumo factual',{exact:true}).fill('Resumo fictício editado');
 await page.getByLabel('Conferi o relato, negações, números, lateralidade e campos ausentes.').check();
 await expect(page.getByRole('button',{name:'Copiar prontuário',exact:true})).toBeEnabled();
 page.on('dialog',dialog=>dialog.accept());
 await page.getByRole('region',{name:'Versões do rascunho'}).getByRole('button',{name:'Restaurar',exact:true}).first().click();
 await expect(page.getByLabel('Resumo factual',{exact:true})).toHaveValue('');
 await expect(page.getByRole('button',{name:'Copiar prontuário',exact:true})).toBeDisabled();
});
test('impressão contém somente documento revisado e formatos não inventam fatos',async({page})=>{
 await localNote(page);
 await expect(page.getByRole('button',{name:'Imprimir / salvar PDF'})).toBeDisabled();
 await page.getByLabel('Conferi o relato, negações, números, lateralidade e campos ausentes.').check();
 await page.getByLabel('Formato de saída').selectOption('narrative');
 await expect(page.getByRole('button',{name:'Imprimir / salvar PDF'})).toBeEnabled();
 await page.emulateMedia({media:'print'});
 await expect(page.locator('.w-main')).toBeHidden();await expect(page.locator('.w-print-document')).toBeVisible();
 await expect(page.locator('.w-print-document')).toContainText('joelho direito');
 await expect(page.locator('.w-print-document')).not.toContainText('Carregar exemplo fictício');
});
test('nova consulta elimina resultados OCR da consulta anterior',async({page})=>{
 await page.goto('/demo');await page.getByText('Anexar exame ou laudo fictício · OCR local',{exact:true}).click();
 await page.locator('.q-file-button input').setInputFiles({name:'ficticio.txt',mimeType:'text/plain',buffer:Buffer.from('EXAME FICTÍCIO DO CASO ANTERIOR')});
 await expect(page.getByLabel('Texto extraído — revisar antes de inserir')).toHaveValue('EXAME FICTÍCIO DO CASO ANTERIOR');
 page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'Nova consulta',exact:true}).click();await page.getByRole('button',{name:'Limpar e começar'}).click();
 await page.getByText('Anexar exame ou laudo fictício · OCR local',{exact:true}).click();
 await expect(page.getByLabel('Texto extraído — revisar antes de inserir')).toHaveValue('');
 await expect(page.getByRole('textbox',{name:'Relato original',exact:true})).toHaveValue('');
});
test('modelo personalizado pode ser criado, exportado e restaurado',async({page})=>{
 await page.goto('/demo');await page.getByRole('button',{name:'Modelos',exact:true}).click();
 await page.getByRole('button',{name:'Criar modelo',exact:true}).click();
 await page.getByLabel('Nome do modelo',{exact:true}).fill('Roteiro da equipe');await page.getByLabel('Categoria',{exact:true}).fill('Geral');
 await page.getByLabel('Roteiro e perguntas para registrar').fill('Registrar motivo informado, achados realmente examinados e conduta decidida.');
 await page.getByRole('button',{name:'Salvar modelo',exact:true}).click();await expect(page.getByRole('heading',{name:'Roteiro da equipe'})).toBeVisible();
 const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar modelos',exact:true}).click();const file=await downloading;
 const stream=await file.createReadStream();const chunks=[];for await(const c of stream)chunks.push(c);const content=Buffer.concat(chunks);
 expect(JSON.parse(content.toString()).templates.some(t=>t.title==='Roteiro da equipe')).toBe(true);
 page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'Excluir Roteiro da equipe',exact:true}).click();await expect(page.getByRole('heading',{name:'Roteiro da equipe'})).toBeHidden();
 await page.getByLabel('Importar biblioteca de modelos JSON').setInputFiles({name:'modelos.json',mimeType:'application/json',buffer:content});
 await expect(page.getByRole('heading',{name:'Roteiro da equipe'})).toBeVisible();
});
