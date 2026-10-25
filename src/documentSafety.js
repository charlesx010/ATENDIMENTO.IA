import {buildFinalPackage} from './consultationPackage.js';

export const MEDICATION_ROUTES=[
 {id:'oral',label:'Via oral'},
 {id:'intramuscular',label:'Via intramuscular'},
 {id:'intravenosa',label:'Via intravenosa'},
 {id:'subcutanea',label:'Via subcutânea'},
 {id:'topica',label:'Via tópica'},
 {id:'outra',label:'Outra via — descrita no texto'}
];
export const MEDICATION_CHECK_IDS=['clinical','structure','destination'];
export const INJECTABLE_ROUTES=['intramuscular','intravenosa','subcutanea'];

export function hasBlockingPlaceholder(value=''){
 return /\[(?:PREENCHER|CONFIRMAR|REVISAR)[^\]]*\]/i.test(String(value));
}
export function isInjectableRoute(route=''){
 return INJECTABLE_ROUTES.includes(route);
}
export function medicationReady({route='',checks={},source,text}={}){
 if(text!==undefined&&source!==text)return false;
 if(!MEDICATION_ROUTES.some(item=>item.id===route))return false;
 if(!MEDICATION_CHECK_IDS.every(id=>checks[id]===true))return false;
 return !isInjectableRoute(route)||checks.injectable===true;
}
export function documentBlockers(section,{outdated=false,reviewed={},medication={}}={}){
 const blockers=[];
 if(outdated)blockers.push('A análise está desatualizada após alteração do relato.');
 if(section.id==='pendencias')blockers.push('Resolva estes dados no documento correspondente.');
 if(hasBlockingPlaceholder(section.text))blockers.push('Há campo [PREENCHER], [CONFIRMAR] ou [REVISAR].');
 if(reviewed[section.id]!==true&&reviewed[section.id]!==section.text)blockers.push('Marque a revisão deste documento.');
 if(section.id==='medicacao'&&!medicationReady({...medication,text:section.text}))blockers.push('Confirme via, estrutura da prescrição e verificações clínicas.');
 return blockers;
}
export function formatDocumentForCopy(section,{medication={}}={}){
 if(section.id!=='medicacao')return section.label+'\n'+section.text;
 const route=MEDICATION_ROUTES.find(item=>item.id===medication.route)?.label||'Via não definida';
 return section.label+'\nVIA CONFERIDA PELO MÉDICO: '+route+'\n'+section.text;
}
export function buildReviewedPackage(input,reviewState={}){
 return buildFinalPackage(input).filter(section=>documentBlockers(section,reviewState).length===0);
}
export function reviewedPackageAsText(input,reviewState={}){
 return buildReviewedPackage(input,reviewState).map(section=>formatDocumentForCopy(section,reviewState)).join('\n\n');
}
