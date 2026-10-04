/* Pure scenario accounting. All coefficients come from data/model-inputs.json and data/foods.json,
   each traced to a public source (USDA FoodData Central, Poore & Nemecek 2018, USDA ERS, NIH ODS). */
(function(root) {
  'use strict';
  const DEFAULT = Object.freeze({reduction:0,coverage:100,replacement:'mixed',lane:'appetite',plannedShare:30,profile:'adult',sex:'male',unit:'acres'});
  const PRESETS = Object.freeze({
    today:{label:'Today',state:{...DEFAULT}},
    monday:{label:'Meatless Monday',state:{...DEFAULT,reduction:14,replacement:'plants'}},
    half:{label:'Half the beef',state:{...DEFAULT,reduction:50}},
    lifter:{label:'Lifter swaps to chicken',state:{...DEFAULT,reduction:100,lane:'planned',replacement:'chicken'}},
    plants:{label:'Plants, leucine target',state:{...DEFAULT,reduction:100,lane:'planned',replacement:'plants'}}
  });
  // Replacement plates: each component replaces an equal share of the beef serving.
  const PLATES = Object.freeze({
    tofu:{label:'Tofu',parts:{tofu:1}},
    beans:{label:'Black beans',parts:{beans:1}},
    lentils:{label:'Lentils',parts:{lentils:1}},
    plants:{label:'Tofu + beans + lentils',parts:{tofu:1/3,beans:1/3,lentils:1/3}},
    chicken:{label:'Chicken breast',parts:{chicken:1}},
    eggs:{label:'Eggs',parts:{eggs:1}},
    mixed:{label:'Half chicken, half plants',parts:{chicken:.5,tofu:1/6,beans:1/6,lentils:1/6}}
  });
  const PROFILES=['adolescent','adult','older','oldest','pregnancy','lactation'];
  const clamp=(n,a,b,f)=>Number.isFinite(Number(n))?Math.max(a,Math.min(b,Number(n))):f;
  function sanitize(value={}) {
    const s={...DEFAULT};
    for (const [key,min,max] of [['reduction',0,100],['coverage',0,100],['plannedShare',0,100]]) s[key]=clamp(value[key]??DEFAULT[key],min,max,DEFAULT[key]);
    for (const [key,allowed] of Object.entries({replacement:Object.keys(PLATES),lane:['appetite','planned','mixed'],profile:PROFILES,sex:['female','male'],unit:['acres','km2','mi2']})) if(allowed.includes(value[key]))s[key]=value[key];
    if (['pregnancy','lactation'].includes(s.profile))s.sex='female';
    return s;
  }
  const NUTRIENTS=['kcal','protein','fiber','leucine','isoleucine','valine','lysine','methionine','phenylalanine','threonine','tryptophan','histidine','iron','zinc','copper','selenium','b12'];
  // Nutrients and land for `grams` of one food. Land = protein grams x P&N m² per 100 g protein.
  function portion(food,grams) {
    const out={grams};
    for(const n of NUTRIENTS)out[n]=(food.per100g[n]||0)*grams/100;
    out.land=out.protein/100*food.landFactor.m2_per_100g_protein;
    return out;
  }
  function add(a,b){const o={...a};for(const k of NUTRIENTS.concat('grams','land'))o[k]=(o[k]||0)+b[k];return o;}
  const driFor=(s,inputs)=>inputs.dri[s.profile][['pregnancy','lactation'].includes(s.profile)?'female':s.sex];
  // One beef serving replaced. Appetite lane: same plate weight as the beef (volumetrics).
  // Planned lane: portion sized so the plate reaches the profile's per-meal leucine target.
  function swap(state,inputs,foods) {
    const s=sanitize(state),g=inputs.servingGrams,beef=portion(foods.beef,g),target=driFor(s,inputs).leucineMeal;
    const planned=s.lane==='planned'?1:s.lane==='mixed'?s.plannedShare/100:0;
    let plate={};const parts={};
    for(const [key,share] of Object.entries(PLATES[s.replacement].parts)) {
      const food=foods[key],sizePlanned=target/food.per100g.leucine*100;
      const p=portion(food,share*(g*(1-planned)+sizePlanned*planned));
      parts[key]=p;plate=add(plate,p);
    }
    plate.parts=parts;
    return {beef,plate,planned};
  }
  function calculate(state,inputs,foods) {
    const s=sanitize(state),shift=s.reduction/100*s.coverage/100,{beef,plate,planned}=swap(s,inputs,foods);
    const base=inputs.baseline.beefLandKm2,ratio=plate.land/beef.land;
    const pasture=base*inputs.baseline.pastureShare*(1-shift),feed=base*(1-inputs.baseline.pastureShare)*(1-shift);
    const replacement=base*shift*ratio,total=pasture+feed+replacement;
    const dri=driFor(s,inputs);
    return {shift,planned,beef,plate,ratio,pasture,feed,replacement,total,base,freed:base-total,changePercent:(total/base-1)*100,dri};
  }
  const UNIT={km2:1,mi2:1/2.589988110336,acres:247.10538146716534};
  const convert=(km2,unit)=>km2*(UNIT[unit]||1);
  function fromQuery(search) {return sanitize(Object.fromEntries(new URLSearchParams(search)));}
  function toQuery(state) {return new URLSearchParams(Object.entries(sanitize(state)).map(([k,v])=>[k,String(v)])).toString();}
  const api={DEFAULT,PRESETS,PLATES,sanitize,portion,swap,calculate,convert,fromQuery,toQuery};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.Food55=api;
})(typeof window!=='undefined'?window:globalThis);
