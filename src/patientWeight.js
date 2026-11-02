// Parse only a positive decimal in kilograms. Preserve the entered text in the
// input; never reinterpret a negative sign, scientific notation or unit suffix.
export function parsePatientWeight(input){
 const text=String(input??'').trim();
 if(!text)return {value:null,error:''};
 const validFormat=/^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(text);
 const value=validFormat?Number(text.replace(',','.')):NaN;
 if(!Number.isFinite(value)||value<=0)return {value:null,error:'Peso inválido. Informe um número positivo em kg, com vírgula ou ponto decimal, sem sinal, letras ou unidades.'};
 return {value,error:''};
}


