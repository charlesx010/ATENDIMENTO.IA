const trim=v=>String(v||'').trim();
export function buildClinicalSource({raw='',narrative='',complement='',narrativeReviewed=false}={}){
 const primary=trim(raw),note=trim(narrative),extra=trim(complement);
 const blocks=[];
 if(primary)blocks.push('RELATO ORIGINAL:\n'+primary);
 if(note&&(!primary||narrativeReviewed))blocks.push('EVOLUÇÃO EDITADA:\n'+note);
 if(extra)blocks.push('COMPLEMENTO:\n'+extra);
 return blocks.join('\n\n');
}
export function clinicalInputFingerprint({raw='',narrative='',complement='',narrativeReviewed=false}={}){
 return JSON.stringify([trim(raw),narrativeReviewed?trim(narrative):'',trim(complement),narrativeReviewed]);
}