/* Pure scenario accounting. Fixtures in scenario-inputs.json are illustrative. */
(function(root) {
  'use strict';
  const DEFAULT = Object.freeze({reduction:0,coverage:100,replacement:'tofu',lane:'appetite',plannedShare:50,energy:0,profile:'adult',sex:'female',unit:'index'});
  const PRESETS = Object.freeze({
    today:{label:'Today / reference',state:{...DEFAULT}},
    monday:{label:'One day a week',state:{...DEFAULT,reduction:14,replacement:'mixed'}},
    half:{label:'Half the beef',state:{...DEFAULT,reduction:50,replacement:'beans'}},
    planned:{label:'Muscle-minded',state:{...DEFAULT,reduction:50,replacement:'tofu',lane:'planned'}}
  });
  const clamp=(n,a,b,f)=>Number.isFinite(Number(n))?Math.max(a,Math.min(b,Number(n))):f;
  function sanitize(value={}) {
    const s={...DEFAULT};
    for (const [key,min,max] of [['reduction',0,100],['coverage',0,100],['plannedShare',0,100],['energy',-10,10]]) s[key]=clamp(value[key]??DEFAULT[key],min,max,DEFAULT[key]);
    for (const [key,allowed] of Object.entries({replacement:['tofu','beans','chicken','mixed'],lane:['appetite','planned','mixed'],profile:['adult','adolescent','older','oldest','pregnancy','lactation'],sex:['female','male'],unit:['index','km2','mi2','acres']})) if(allowed.includes(value[key]))s[key]=value[key];
    if (['pregnancy','lactation'].includes(s.profile))s.sex='female';
    return s;
  }
  function calculate(state,inputs) {
    const s=sanitize(state),shift=s.reduction/100*s.coverage/100;
    const plannedShare=s.lane==='planned'?1:s.lane==='mixed'?s.plannedShare/100:0;
    const portion=1+plannedShare*(inputs.plannedPortionMultiplier-1);
    const pasture=inputs.baselineIndex*inputs.pastureShare*(1-shift);
    const feed=inputs.baselineIndex*inputs.feedShare*(1-shift);
    const replacement=inputs.baselineIndex*shift*inputs.replacementLandRatios[s.replacement]*portion*(1+s.energy/100);
    const total=pasture+feed+replacement,avoided=inputs.baselineIndex*shift;
    return {shift,plannedShare,portion,pasture,feed,replacement,total,avoided,net:total-inputs.baselineIndex,changePercent:(total/inputs.baselineIndex-1)*100};
  }
  function areaValue(result,unit,inputs) {
    if(unit==='index')return result.total;
    if(inputs.status!=='verified'||!Number.isFinite(inputs.baselineAreaKm2)||inputs.baselineAreaKm2<=0)return null;
    const km2=result.total/inputs.baselineIndex*inputs.baselineAreaKm2;
    return km2*({km2:1,mi2:1/2.589988110336,acres:247.10538146716534}[unit]||1);
  }
  function fromQuery(search) {return sanitize(Object.fromEntries(new URLSearchParams(search)));}
  function toQuery(state) {return new URLSearchParams(Object.entries(sanitize(state)).map(([k,v])=>[k,String(v)])).toString();}
  const api={DEFAULT,PRESETS,sanitize,calculate,areaValue,fromQuery,toQuery};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.Food55=api;
})(typeof window!=='undefined'?window:globalThis);
