import {copyFile,mkdir,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';

const target='public/ocr';
await rm(target,{recursive:true,force:true});
await mkdir(join(target,'tesseract'),{recursive:true});
await mkdir(join(target,'tesseract-core'),{recursive:true});
await mkdir(join(target,'tessdata'),{recursive:true});
await mkdir(join(target,'pdf'),{recursive:true});

await copyFile('node_modules/tesseract.js/dist/worker.min.js',join(target,'tesseract','worker.min.js'));
const coreFiles=await readdir('node_modules/tesseract.js-core');
for(const name of coreFiles){
 if(/^tesseract-core.*\.(?:js|wasm)$/.test(name))
  await copyFile(join('node_modules/tesseract.js-core',name),join(target,'tesseract-core',name));
}

async function findLanguageFile(directory){
 for(const entry of await readdir(directory,{withFileTypes:true})){
  const path=join(directory,entry.name);
  if(entry.isDirectory()){const nested=await findLanguageFile(path);if(nested)return nested;}
  else if(entry.name==='por.traineddata.gz')return path;
 }
 return '';
}
const language=await findLanguageFile('node_modules/@tesseract.js-data/por');
if(!language)throw Error('Arquivo de idioma português do OCR não encontrado.');
await copyFile(language,join(target,'tessdata','por.traineddata.gz'));
await copyFile('node_modules/pdfjs-dist/build/pdf.worker.min.mjs',join(target,'pdf','pdf.worker.min.mjs'));
