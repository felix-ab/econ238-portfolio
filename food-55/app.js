/* All interaction and rendering run in the browser. No backend or analytics. */
(async function() {
  'use strict';
  const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
  const M=window.Food55;
  const num=(n,d=0)=>Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
  const big=n=>{const a=Math.abs(n);return a>=1e9?num(n/1e9,2)+' billion':a>=1e6?num(n/1e6,1)+' million':num(n);};
  const UNIT_LABEL={acres:'acres',km2:'km²',mi2:'sq mi'};
  let inputs,foods,grid,state=M.fromQuery(location.search),result,drawMap=()=>{};
  let activePreset=Object.keys(M.PRESETS).find(k=>M.toQuery(M.PRESETS[k].state)===M.toQuery(state))||null;
  const notes={
    appetite:'People eat about the same weight of food they always do (volumetrics). Plants arrive with fewer calories, more fiber and less leucine.',
    planned:'Portions are sized to deliver the same leucine as the beef serving. Plants need much bigger plates to get there.',
    mixed:'A share of eaters plan for leucine; the rest eat by appetite. Set the share below.'
  };
  try {
    const [a,b,c]=await Promise.all(['data/model-inputs.json','data/foods.json','data/grid.json'].map(u=>fetch(u).then(r=>{if(!r.ok)throw Error(u);return r.json();})));
    inputs=a;foods=b;grid=c;
  }catch(error) {
    $('#land-total').textContent='—';$('#metric-caption').textContent='Data could not load. Reload to try again.';
    $$('.settings input,.settings button,.settings select').forEach(el=>el.disabled=true);console.error(error);return;
  }
  function syncControls() {
    for(const key of ['reduction','coverage','replacement','plannedShare','profile','sex','unit'])$('#'+key).value=state[key];
    for(const key of ['reduction','coverage','plannedShare']) {
      const el=$('#'+key);$('#'+key+'-output').textContent=state[key]+'%';
      el.style.setProperty('--range-progress',(state[key]-Number(el.min))/(Number(el.max)-Number(el.min))*100+'%');
    }
    $$('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preset===activePreset)));
    $$('[data-lane]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lane===state.lane)));
    $('#mix-controls').hidden=state.lane!=='mixed';$('#lane-note').textContent=notes[state.lane];
    $('#sex').disabled=['pregnancy','lactation'].includes(state.profile);
    $('#scenario-label').textContent=(activePreset?M.PRESETS[activePreset].label:'Custom scenario').toUpperCase();
  }
  // Paired bars: beef (magenta) and the swap (cyan) overprint in multiply.
  function bars(rows) {
    return rows.map(r=>{
      const max=Math.max(r.beef,r.swap,r.target||0)*1.08||1,w=v=>Math.min(100,v/max*100);
      const target=r.target?`<i class="target" style="left:${w(r.target)}%" title="Target ${r.fmt(r.target)}"></i>`:'';
      const flag=r.target&&r.swap<r.target?' short':'';
      return `<div class="nrow${flag}"><span class="nlabel">${r.label}${r.sub?`<small>${r.sub}</small>`:''}</span><span class="ntrack"><b class="nbar beef" style="width:${w(r.beef)}%"></b><b class="nbar swap" style="width:${w(r.swap)}%"></b>${target}</span><span class="nvals"><em class="m">${r.fmt(r.beef)}</em><em class="c">${r.fmt(r.swap)}</em></span></div>`;
    }).join('');
  }
  function renderNutrition(r) {
    const b=r.beef,p=r.plate,d=r.dri,g=v=>num(v,1)+' g',pct=(v,need)=>num(v/need*100)+'%';
    $('#plate-name').textContent=M.PLATES[state.replacement].label.toLowerCase();
    $('#plate-grams').textContent=num(p.grams)+' g';
    $('#bars-meal').innerHTML=bars([
      {label:'Leucine',sub:`per-meal target ${d.leucineMeal} g`,beef:b.leucine,swap:p.leucine,target:d.leucineMeal,fmt:v=>num(v,2)+' g'},
      {label:'Protein',beef:b.protein,swap:p.protein,fmt:g},
      {label:'Calories',beef:b.kcal,swap:p.kcal,fmt:v=>num(v)},
      {label:'Fiber',beef:b.fiber,swap:p.fiber,fmt:g},
      {label:'Food on the plate',beef:b.grams,swap:p.grams,fmt:v=>num(v)+' g'}
    ]);
    const eaa=['leucine','isoleucine','valine','lysine','methionine','phenylalanine','threonine','tryptophan','histidine'];
    const ratios=eaa.map(k=>[k,p[k]/b[k]]).sort((x,y)=>x[1]-y[1]);
    $('#bars-eaa').innerHTML=eaa.map(k=>{const v=p[k]/b[k]*100;return `<div class="eaa${v<100?' short':''}"><span>${k}</span><span class="eaa-track"><b style="height:${Math.min(v,160)/1.6}%"></b></span><em>${num(v)}%</em></div>`;}).join('');
    $('#eaa-note').textContent=`Lowest: ${ratios[0][0]}, at ${num(ratios[0][1]*100)}% of what the beef delivered. Muscle is built only as far as the scarcest essential amino acid allows.`;
    const sexLabel=['pregnancy','lactation'].includes(state.profile)?'':(state.sex==='male'?'male, ':'female, ');
    $('#micro-who').textContent=sexLabel+$('#profile').selectedOptions[0].textContent.toLowerCase();
    $('#bars-micro').innerHTML=bars([
      {label:'Vitamin B12',sub:'cobalt is only used inside B12',beef:b.b12/d.b12*100,swap:p.b12/d.b12*100,fmt:v=>num(v)+'%'},
      {label:'Zinc',beef:b.zinc/d.zinc*100,swap:p.zinc/d.zinc*100,fmt:v=>num(v)+'%'},
      {label:'Iron',sub:'plant iron is non-heme, absorbed less',beef:b.iron/d.iron*100,swap:p.iron/d.iron*100,fmt:v=>num(v)+'%'},
      {label:'Copper',beef:b.copper/d.copper*100,swap:p.copper/d.copper*100,fmt:v=>num(v)+'%'},
      {label:'Selenium',beef:b.selenium/d.selenium*100,swap:p.selenium/d.selenium*100,fmt:v=>num(v)+'%'},
      {label:'Protein',beef:b.protein/d.protein*100,swap:p.protein/d.protein*100,fmt:v=>num(v)+'%'}
    ]);
  }
  function update(writeURL=true) {
    state=M.sanitize(state);result=M.calculate(state,inputs,foods);syncControls();
    const u=state.unit,r=result;
    $('#land-total').textContent=big(M.convert(r.total,u));
    $('#land-unit-label').textContent=UNIT_LABEL[u];
    $('#land-delta').textContent=r.shift===0?'Today’s baseline':`${r.changePercent>0?'+':''}${num(r.changePercent,1)}% vs today`;
    $('#freed').textContent=big(M.convert(r.freed,u));$('#freed-unit').textContent=UNIT_LABEL[u]+' no longer needed';
    $('#freed-compare').textContent=r.freed>0?`≈ ${num(r.freed/inputs.compare.km2,1)}× the area of ${inputs.compare.label}`:'Move a slider to swap out beef';
    const leu=r.plate.leucine,t=r.dri.leucineMeal;
    $('#meal-leucine').textContent=num(leu,2)+' g';$('#meal-leucine-note').textContent=leu>=t?`Clears the ${t} g target`:`Short of the ${t} g target by ${num(t-leu,2)} g`;
    $('#meal-leucine').closest('div').classList.toggle('short',leu<t);
    $('#meal-kcal').textContent=`${r.plate.kcal>=r.beef.kcal?'+':'−'}${num(Math.abs(r.plate.kcal-r.beef.kcal))}`;
    $('#meal-kcal-note').textContent=`kcal vs ${num(r.beef.kcal)} for the beef`;
    for(const key of ['pasture','feed','replacement','total'])$('#ledger-'+key).textContent=num(M.convert(r[key],u));
    for(const key of ['pasture','feed'])$('#ledger-base-'+key).textContent=num(M.convert(r.base*(key==='pasture'?inputs.baseline.pastureShare:1-inputs.baseline.pastureShare),u));
    $('#ledger-base-total').textContent=num(M.convert(r.base,u));
    $$('.ledger-unit').forEach(el=>el.textContent=UNIT_LABEL[u]);
    $('#ratio-note').textContent=`One replacement plate needs ${num(r.ratio*100,1)}% of the land of the beef serving it replaces (${num(r.plate.land,2)} vs ${num(r.beef.land,2)} m² of land for a year).`;
    renderNutrition(r);drawMap(r);$('#share-status').textContent='';
    if(writeURL)history.replaceState(null,'',location.pathname+'?'+M.toQuery(state)+location.hash);
  }
  let frame=0;const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>update());};
  for(const key of ['reduction','coverage','replacement','plannedShare','profile','sex','unit']) {
    $('#'+key).addEventListener(['reduction','coverage','plannedShare'].includes(key)?'input':'change',e=>{state[key]=e.target.value;activePreset=null;schedule();});
  }
  $$('[data-preset]').forEach(b=>b.addEventListener('click',()=>{activePreset=b.dataset.preset;state={...M.PRESETS[activePreset].state,unit:state.unit,profile:state.profile,sex:state.sex};update();}));
  $$('[data-lane]').forEach(b=>b.addEventListener('click',()=>{state.lane=b.dataset.lane;activePreset=null;update();}));
  $('#reset').addEventListener('click',()=>{state={...M.DEFAULT};activePreset='today';update();});
  $('#share').addEventListener('click',async()=>{
    const url=location.origin+location.pathname+'?'+M.toQuery(state);
    try{await navigator.clipboard.writeText(url);$('#share-status').textContent='Scenario link copied.';}
    catch{const box=document.createElement('input');box.value=url;box.setAttribute('aria-label','Copy this scenario link');box.style.width='100%';$('#share-status').replaceChildren(document.createTextNode('Copy this link: '),box);box.select();}
  });
  $('#export').addEventListener('click',()=>{
    const {beef,plate,...rest}=result;delete plate.parts;
    const data={scenario:state,landKm2:{pasture:rest.pasture,feed:rest.feed,replacement:rest.replacement,total:rest.total,freed:rest.freed},perServing:{beef,replacement:plate},inputs,foods};
    const blob=new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='FOOD-55-scenario.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    $('#share-status').textContent='Scenario exported with every input.';
  });
  window.addEventListener('popstate',()=>{state=M.fromQuery(location.search);activePreset=null;update(false);});
  update(false);

  try {
    const response=await fetch('data/land-110m.json');if(!response.ok)throw Error('World boundaries missing');
    const topology=await response.json(),land=topojson.feature(topology,topology.objects.land);
    const svg=d3.select('#world-map'),width=1000,height=570;
    const projection=d3.geoEqualEarth().fitExtent([[13,38],[987,529]],{type:'Sphere'}),path=d3.geoPath(projection);
    // Equal-area projection: a fixed number of px² per km² everywhere. Earth's surface = 510.07 million km².
    const pxPerKm2=path.area({type:'Sphere'})/510072000;
    const radius=km2=>Math.sqrt(Math.max(0,km2)*pxPerKm2/Math.PI);
    const defs=svg.append('defs');
    const filter=defs.append('filter').attr('id','print-grain').attr('x','0%').attr('y','0%').attr('width','100%').attr('height','100%');
    filter.append('feTurbulence').attr('type','fractalNoise').attr('baseFrequency','1.1').attr('numOctaves',2).attr('seed',19).attr('result','grain');
    filter.append('feColorMatrix').attr('in','grain').attr('type','matrix').attr('values','0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 2.4 -0.55').attr('result','grainAlpha');
    filter.append('feComposite').attr('in','SourceGraphic').attr('in2','grainAlpha').attr('operator','in');
    const zoomable=svg.append('g').attr('class','zoomable');
    zoomable.append('path').attr('class','projection-border').attr('d',path({type:'Sphere'}));
    zoomable.append('path').attr('class','graticule').attr('d',path(d3.geoGraticule10()));
    zoomable.append('path').attr('class','land').attr('d',path(land));
    // Context: cattle outside the US, by head count only. Not a land claim.
    const world=zoomable.append('g').attr('class','ink-layer world-cattle').attr('data-map-layer','world');
    world.selectAll('circle').data(grid.world).join('circle').each(function(c){const [x,y]=projection([c[0],c[1]]);this.setAttribute('cx',x);this.setAttribute('cy',y);this.setAttribute('r',Math.sqrt(c[2])*0.0022);});
    // US cells: [lon, lat, cattle head, maize ha, soy ha, pulses ha]
    const cells=grid.us.map(c=>{const [x,y]=projection([c[0],c[1]]);return {lon:c[0],lat:c[1],x,y,ct:c[2],mz:c[3],sy:c[4],pu:c[5]};});
    const sum=k=>cells.reduce((s,c)=>s+c[k],0),tot={ct:sum('ct'),mz:sum('mz'),sy:sum('sy'),pu:sum('pu')};
    for(const c of cells){c.wct=c.ct/tot.ct;c.wmz=c.mz/tot.mz;c.wsy=c.sy/tot.sy;c.wpu=c.pu/tot.pu;c.wfeed=(c.mz+c.sy)/(tot.mz+tot.sy);}
    const layer=(key,cls)=>zoomable.append('g').attr('class','ink-layer ink-texture '+cls).attr('data-map-layer',key).attr('filter','url(#print-grain)');
    const groups={pasture:layer('pasture','ink-magenta'),feed:layer('feed','ink-key'),replacement:layer('replacement','ink-cyan')};
    const circles={};
    for(const [key,g]of Object.entries(groups))circles[key]=g.selectAll('circle').data(cells).join('circle').attr('cx',c=>c.x).attr('cy',c=>c.y).attr('r',0).nodes();
    // Where each replacement food's land sits: soy fields for tofu, pulse fields for beans and lentils, feed fields for chicken and eggs.
    const where={tofu:'wsy',beans:'wpu',lentils:'wpu',chicken:'wfeed',eggs:'wfeed'};
    const zoom=d3.zoom().scaleExtent([1,12]).extent([[0,0],[width,height]]).translateExtent([[0,0],[width,height]]).filter(e=>e.type==='dblclick'||(e.type==='wheel'&&e.ctrlKey)||e.type==='mousedown'&&e.button===0||e.type.startsWith('touch')).on('zoom',e=>zoomable.attr('transform',e.transform));
    svg.call(zoom).on('wheel.zoom',null);
    const xs=cells.filter(c=>c.lon>-130).map(c=>c.x),ys=cells.filter(c=>c.lon>-130).map(c=>c.y);
    const [x0,x1,y0,y1]=[Math.min(...xs),Math.max(...xs),Math.min(...ys),Math.max(...ys)],k=Math.min(width/(x1-x0),height/(y1-y0))*.88;
    const usView=d3.zoomIdentity.translate(width/2,height/2).scale(k).translate(-(x0+x1)/2,-(y0+y1)/2);
    svg.call(zoom.transform,usView);
    $('#zoom-in').addEventListener('click',()=>svg.call(zoom.scaleBy,1.4));$('#zoom-out').addEventListener('click',()=>svg.call(zoom.scaleBy,1/1.4));
    $('#zoom-us').addEventListener('click',()=>svg.transition().duration(500).call(zoom.transform,usView));
    $('#zoom-world').addEventListener('click',()=>svg.transition().duration(500).call(zoom.transform,d3.zoomIdentity));
    $$('[data-layer]').forEach(el=>el.addEventListener('change',()=>zoomable.select(`[data-map-layer="${el.dataset.layer}"]`).attr('display',el.checked?null:'none')));
    $('#texture').addEventListener('change',()=>svg.classed('flat-ink',!$('#texture').checked));
    let perCell=null;
    drawMap=r=> {
      const repShare={};for(const [key,p]of Object.entries(r.plate.parts))repShare[key]=r.plate.land>0?p.land/r.plate.land:0;
      perCell=cells.map(c=>{let rep=0;for(const [key,s]of Object.entries(repShare))rep+=r.replacement*s*c[where[key]];return {pasture:r.pasture*c.wct,feed:r.feed*c.wmz,replacement:rep};});
      for(const key of Object.keys(circles)){const nodes=circles[key];for(let i=0;i<nodes.length;i++)nodes[i].setAttribute('r',radius(perCell[i][key]).toFixed(3));}
      $('#map-description').textContent=`United States map. Dot area equals land area at true scale: ${num(r.pasture)} km² of beef pasture placed by cattle density, ${num(r.feed)} km² of beef feed cropland placed by maize fields, ${num(r.replacement)} km² of replacement-food cropland.`;
    };
    // Tooltip: nearest half-degree US cell.
    const index=new Map(cells.map((c,i)=>[c.lon+','+c.lat,i]));
    svg.on('pointermove',e=>{
      const t=d3.zoomTransform(svg.node()),[mx,my]=d3.pointer(e,svg.node()),ll=projection.invert(t.invert([mx,my])),tip=$('#map-tooltip');
      const key=ll&&(Math.floor(ll[0]*2)/2+.25)+','+(Math.floor(ll[1]*2)/2+.25),i=index.get(key);
      if(i===undefined||!perCell){tip.hidden=true;return;}
      const c=cells[i],p=perCell[i],u=state.unit,rect=$('#map-wrap').getBoundingClientRect();
      tip.hidden=false;tip.innerHTML=`<b>${Math.abs(c.lat).toFixed(2)}°${c.lat>0?'N':'S'}, ${Math.abs(c.lon).toFixed(2)}°W</b><span class="m">Beef pasture ${num(M.convert(p.pasture,u))} ${UNIT_LABEL[u]}</span><span class="k">Beef feed crops ${num(M.convert(p.feed,u))} ${UNIT_LABEL[u]}</span><span class="c">Replacement crops ${num(M.convert(p.replacement,u))} ${UNIT_LABEL[u]}</span><small>${num(c.ct)} cattle · ${num(c.mz)} ha maize · ${num(c.sy)} ha soy in this cell</small>`;
      tip.style.left=Math.min(e.clientX-rect.left+14,rect.width-240)+'px';tip.style.top=Math.max(10,e.clientY-rect.top-96)+'px';
    }).on('pointerleave',()=>$('#map-tooltip').hidden=true);
    drawMap(result);
    document.documentElement.dataset.ready='true';
  } catch(error) {
    $('#map-failure').hidden=false;$('#world-map').hidden=true;
    $$('#zoom-in,#zoom-out,#zoom-us,#zoom-world,#texture,[data-layer]').forEach(el=>el.disabled=true);console.error(error);
    document.documentElement.dataset.ready='partial';
  }
})();
