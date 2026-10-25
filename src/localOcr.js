export const OCR_LIMITS={maxBytes:8*1024*1024,maxPdfPages:12,maxScannedPages:3,maxTextChars:12000};
export const ACCEPTED_EXAM_TYPES=['image/jpeg','image/png','image/webp','application/pdf','text/plain'];

export function validateExamFile(file){
 if(!file)return 'Selecione um arquivo.';
 if(!ACCEPTED_EXAM_TYPES.includes(file.type))return 'Formato não aceito. Use JPG, PNG, WEBP, PDF ou TXT.';
 if(file.size>OCR_LIMITS.maxBytes)return 'Arquivo acima de 8 MB.';
 return '';
}

export function cleanOcrText(value){
 return String(value||'')
  .replace(/\r/g,'')
  .replace(/[ \t]+\n/g,'\n')
  .replace(/\n{3,}/g,'\n\n')
  .replace(/[ \t]{2,}/g,' ')
  .trim()
  .slice(0,OCR_LIMITS.maxTextChars);
}

async function createPortugueseWorker(onProgress){
 const {createWorker}=await import('tesseract.js');
 const worker=await createWorker('por',1,{
  workerPath:'/ocr/tesseract/worker.min.js',
  langPath:'/ocr/tessdata',
  corePath:'/ocr/tesseract-core',
  gzip:true,
  workerBlobURL:false,
  logger:event=>{
   if(event?.status==='recognizing text'&&Number.isFinite(event.progress))onProgress?.(Math.round(event.progress*100));
  }
 });
 await worker.setParameters({preserve_interword_spaces:'1'});
 return worker;
}

async function recognizeImages(images,onProgress){
 const worker=await createPortugueseWorker(value=>onProgress?.({stage:'ocr',progress:value}));
 try{
  const chunks=[];let confidence=0;
  for(let index=0;index<images.length;index+=1){
   onProgress?.({stage:'page',page:index+1,total:images.length,progress:0});
   const result=await worker.recognize(images[index]);
   chunks.push(cleanOcrText(result?.data?.text));
   confidence+=Number(result?.data?.confidence||0);
  }
  return {text:cleanOcrText(chunks.filter(Boolean).join('\n\n')),confidence:images.length?Math.round(confidence/images.length):0};
 }finally{
  await worker.terminate();
  for(const image of images)if(typeof image==='string'&&image.startsWith('blob:'))URL.revokeObjectURL(image);
 }
}

async function extractPdf(file,onProgress){
 const pdfjs=await import('pdfjs-dist');
 pdfjs.GlobalWorkerOptions.workerSrc='/ocr/pdf/pdf.worker.min.mjs';
 const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false});
 const pdf=await task.promise;
 try{
  const pageCount=Math.min(pdf.numPages,OCR_LIMITS.maxPdfPages);
  const textParts=[];
  for(let number=1;number<=pageCount;number+=1){
   onProgress?.({stage:'pdf-text',page:number,total:pageCount,progress:Math.round(number/pageCount*100)});
   const page=await pdf.getPage(number);
   const content=await page.getTextContent();
   textParts.push(content.items.map(item=>String(item.str||'')+(item.hasEOL?'\n':' ')).join(''));
   page.cleanup();
  }
  const directText=cleanOcrText(textParts.join('\n\n'));
  if(directText.length>=80)return {text:directText,method:'pdf-text',confidence:null,pages:pageCount,truncated:pdf.numPages>pageCount};

  const scanCount=Math.min(pdf.numPages,OCR_LIMITS.maxScannedPages);
  const images=[];
  for(let number=1;number<=scanCount;number+=1){
   onProgress?.({stage:'render',page:number,total:scanCount,progress:Math.round(number/scanCount*100)});
   const page=await pdf.getPage(number);
   const viewport=page.getViewport({scale:1.7});
   const canvas=document.createElement('canvas');
   canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
   const context=canvas.getContext('2d',{alpha:false});
   context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
   await page.render({canvasContext:context,viewport}).promise;
   const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('Não foi possível preparar a página.')),'image/png'));
   images.push(URL.createObjectURL(blob));page.cleanup();
  }
  const recognized=await recognizeImages(images,onProgress);
  return {...recognized,method:'pdf-ocr',pages:scanCount,truncated:pdf.numPages>scanCount};
 }finally{
  if(typeof task.destroy==='function')await task.destroy();
 }
}

export async function extractLocalText(file,onProgress){
 const error=validateExamFile(file);if(error)throw Error(error);
 if(file.type==='text/plain')return {text:cleanOcrText(await file.text()),method:'text',confidence:null,pages:1,truncated:false};
 if(file.type==='application/pdf')return extractPdf(file,onProgress);
 const recognized=await recognizeImages([file],onProgress);
 return {...recognized,method:'image-ocr',pages:1,truncated:false};
}

export function extractionMessage(result){
 if(!result?.text)return 'Nenhum texto legível foi encontrado. Melhore a iluminação ou cole o texto manualmente.';
 const base=result.method==='pdf-text'?'Texto do PDF extraído localmente.'
  :result.method==='pdf-ocr'?'PDF escaneado lido por OCR local.'
  :'Imagem lida por OCR local.';
 const confidence=Number.isFinite(result.confidence)?' Confiança aproximada: '+result.confidence+'%.':'';
 const truncated=result.truncated?' Apenas as primeiras páginas permitidas foram processadas.':'';
 return base+confidence+truncated+' Revise o conteúdo antes de inserir.';
}
