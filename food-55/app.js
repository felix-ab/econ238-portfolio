/* All interaction and rendering run in the browser. No backend or analytics. */
(async function() {
  'use strict';
  const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
  const M=window.Food55,fmt=n=>Number(n).toLocaleString('en-US',{minimumFractionDigits:1,maximumFractionDigits:1});
  const pct=n=>`${Number(n.toFixed(1))}%`,signed=n=>`${n>0?'+':''}${fmt(n)}`;
  let inputs,state=M.fromQuery(location.search),result,drawMap=()=>{},mapReady=false;
  let initialPreset=Object.keys(M.PRESETS).find(k=>JSON.stringify(M.PRESETS[k].state)===JSON.stringify(state));
  let activePreset=initialPreset||null;
  const notes={appetite:'Use customary portions. Nutrient shortfalls must be reported, not silently corrected.',planned:'Plan portions around nutritional goals. The prototype uses an arbitrary portion multiplier; nutrient feasibility is not yet calculated.',mixed:'Blend both behavior lanes. This share is a chosen scenario, not a measured population statistic.'};
  try {
    const response=await fetch('data/scenario-inputs.json');
    if(!response.ok)throw Error('Input file missing');inputs=await response.json();
    if(inputs.status!=='illustrative'||inputs.baselineIndex!==100||Math.abs(inputs.feedShare+inputs.pastureShare-1)>1e-9)throw Error('Unsupported input contract');
  }catch(error) {
    $('#land-total').textContent='—';$('#metric-caption').textContent='Scenario inputs could not load. Reload to try again.';
    $$('.settings input,.settings button,.settings select').forEach(el=>el.disabled=true);console.error(error);return;
  }
  function syncControls() {
    for(const key of ['reduction','coverage','replacement','plannedShare','energy','profile','sex','unit'])$('#'+key).value=state[key];
    for(const key of ['reduction','coverage','plannedShare','energy']) {
      const el=$('#'+key);$('#'+key+'-output').textContent=(key==='energy'&&state[key]>0?'+':'')+state[key]+'%';
      el.style.setProperty('--range-progress',(state[key]-Number(el.min))/(Number(el.max)-Number(el.min))*100+'%');
    }
    $$('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preset===activePreset)));
    $$('[data-lane]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lane===state.lane)));
    $('#mix-controls').hidden=state.lane!=='mixed';$('#lane-note').textContent=notes[state.lane];
    $('#sex').disabled=['pregnancy','lactation'].includes(state.profile);
    $('#scenario-label').textContent=(activePreset?M.PRESETS[activePreset].label:'Custom scenario').toUpperCase();
  }
  function update(writeURL=true) {
    state=M.sanitize(state);result=M.calculate(state,inputs);syncControls();
    const area=M.areaValue(result,state.unit,inputs);
    $('#land-total').textContent=area===null?'—':fmt(area);
    $('#land-unit-label').textContent={index:'INDEX',km2:'km²',mi2:'MI²',acres:'ACRES'}[state.unit];
    $('#metric-caption').textContent=area===null?`Area estimate pending. Current illustrative index: ${fmt(result.total)}.`:'Illustrative baseline = 100. No measured area loaded.';
    $('#land-delta').textContent=`${signed(result.changePercent)}% vs reference`;
    $('#effective-shift').textContent=pct(result.shift*100);
    $('#replacement-total').textContent=fmt(result.replacement);$('#net-change').textContent=signed(result.net);
    for(const key of ['pasture','feed','replacement','total'])$('#ledger-'+key).textContent=fmt(result[key]);
    $('#avoided-note').textContent=`Gross avoided beef demand: ${fmt(result.avoided)} index points. This is not restored land.`;
    const profileText=$('#profile').selectedOptions[0].textContent;
    $('#nutrition-description').textContent=`${profileText}; ${state.sex} reference category. Protein, leucine, all nine essential amino acids and micronutrients still need a whole-day audit. No adequacy result is available.`;
    drawMap(result);$('#share-status').textContent='';
    if(writeURL)history.replaceState(null,'',location.pathname+'?'+M.toQuery(state)+location.hash);
  }
  for(const key of ['reduction','coverage','replacement','plannedShare','energy','profile','sex','unit']) {
    $('#'+key).addEventListener(['reduction','coverage','plannedShare','energy'].includes(key)?'input':'change',e=>{state[key]=e.target.value;activePreset=null;update();});
  }
  $$('[data-preset]').forEach(b=>b.addEventListener('click',()=>{activePreset=b.dataset.preset;state={...M.PRESETS[activePreset].state,unit:state.unit};update();}));
  $$('[data-lane]').forEach(b=>b.addEventListener('click',()=>{state.lane=b.dataset.lane;activePreset=null;update();}));
  $('#reset').addEventListener('click',()=>{state={...M.DEFAULT};activePreset='today';update();});
  $('#share').addEventListener('click',async()=>{
    const url=location.origin+location.pathname+'?'+M.toQuery(state);
    try{await navigator.clipboard.writeText(url);$('#share-status').textContent='Scenario link copied.';}
    catch{const box=document.createElement('input');box.value=url;box.setAttribute('aria-label','Copy this scenario link');box.style.width='100%';$('#share-status').replaceChildren(document.createTextNode('Copy this link: '),box);box.select();}
  });
  $('#export').addEventListener('click',()=>{
    const data={status:inputs.status,warning:inputs.provenance,inputsVersion:inputs.version,state:state,results:{...result,indexBaseline:inputs.baselineIndex,areaKm2:null,nutrientAdequacy:'not evaluated',spatialMeaning:'schematic, not geolocated'},inputs:inputs};
    const blob=new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='FOOD-55-illustrative-scenario.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    $('#share-status').textContent='Illustrative scenario exported with assumptions.';
  });
  window.addEventListener('popstate',()=>{state=M.fromQuery(location.search);activePreset=null;update(false);});
  update(false);
  try {
    const response=await fetch('data/land-110m.json');if(!response.ok)throw Error('World boundaries missing');
    const topology=await response.json(),land=topojson.feature(topology,topology.objects.land);
    const svg=d3.select('#world-map'),width=1000,height=570;
    const projection=d3.geoEqualEarth().fitExtent([[13,38],[987,529]],{type:'Sphere'}),path=d3.geoPath(projection);
    const defs=svg.append('defs');defs.append('clipPath').attr('id','land-clip').append('path').attr('d',path(land));
    const filter=defs.append('filter').attr('id','print-grain').attr('x','0%').attr('y','0%').attr('width','100%').attr('height','100%');
    filter.append('feTurbulence').attr('type','fractalNoise').attr('baseFrequency','.68').attr('numOctaves',2).attr('seed',19).attr('result','grain');
    filter.append('feColorMatrix').attr('in','grain').attr('type','matrix').attr('values','0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 3.2 -1.05').attr('result','grainAlpha');
    filter.append('feComposite').attr('in','SourceGraphic').attr('in2','grainAlpha').attr('operator','in');
    const inks={pasture:'#e93086',feed:'#454541',replacement:'#00adcf',avoided:'#f3d518'};
    for (const [key,color] of Object.entries(inks)) {
      const pattern=defs.append('pattern').attr('id','ink-'+key).attr('patternUnits','userSpaceOnUse').attr('width',5).attr('height',5).attr('patternTransform',key==='replacement'?'rotate(25)':'rotate(-12)');
      pattern.append('rect').attr('width',5).attr('height',5).attr('fill',color).attr('opacity',.67);
      if(key==='feed')pattern.append('path').attr('d','M0,0L5,5 M-2,3L2,7 M3,-2L7,2').attr('stroke',color).attr('stroke-width',1.3);
      else pattern.append('circle').attr('cx',2.5).attr('cy',2.5).attr('r',key==='avoided'?1.15:1.7).attr('fill',color);
    }
    const zoomable=svg.append('g').attr('class','zoomable');
    zoomable.append('path').attr('class','projection-border').attr('d',path({type:'Sphere'}));
    zoomable.append('path').attr('class','graticule').attr('d',path(d3.geoGraticule10()));
    zoomable.append('path').attr('class','land').attr('d',path(land));
    const layers=zoomable.append('g').attr('clip-path','url(#land-clip)');
    // Contiguous patch fields are a visual fixture, not agricultural spatial data.
    const nx=200,ny=114,sx=width/nx,sy=height/ny;
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');
    const landPath=new Path2D(path(land));
    const anchors=[[-99,37,115],[-60,-16,80],[24,8,100],[65,45,135],[106,23,90],[136,-26,75]].map(([lon,lat,r])=>[...projection([lon,lat]),r]);
    const cells=[];let seed=713;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    for(let y=0;y<ny;y++)for(let x=0;x<nx;x++) {
      const px=(x+.5)*sx,py=(y+.5)*sy;
      if(!context.isPointInPath(landPath,px,py))continue;
      let score=0;for(const [ax,ay,r]of anchors)score+=Math.exp(-((px-ax)**2+(py-ay)**2)/(r*r));
      score+=.13*Math.sin(px*.048)*Math.cos(py*.057)+.08*random();
      cells.push({i:y*nx+x,x,y,score});
    }
    cells.sort((a,b)=>b.score-a.score);
    const baseline=cells.slice(0,Math.round(cells.length*.42));
    // Feed and pasture occupy disjoint cells in the numerical reference fixture.
    const feedCells=baseline.filter((c,i)=>i%4===0),pastureCells=baseline.filter((c,i)=>i%4!==0);
    const cropOrder=[...cells].sort((a,b)=>(Math.sin(a.x*.035)+Math.cos(a.y*.045)+a.score*.3)-(Math.sin(b.x*.035)+Math.cos(b.y*.045)+b.score*.3));
    const contour=d3.contours().size([nx,ny]).thresholds([.5]),contourPath=d3.geoPath(d3.geoIdentity().scale(sx));
    function shape(list) {if(!list.length)return '';const values=new Float64Array(nx*ny);for(const c of list)values[c.i]=1;return contourPath(contour(values)[0]);}
    const originalShape=shape(baseline);
    const layerPaths={};
    for(const key of ['avoided','pasture','feed','replacement'])layerPaths[key]=layers.append('path').attr('class','ink-layer ink-texture').attr('data-map-layer',key).attr('fill','url(#ink-'+key+')').attr('filter','url(#print-grain)');
    const reference=layers.append('path').attr('class','reference-outline').attr('d',originalShape).attr('display','none');
    const continentLabels=[['NORTH AMERICA',-115,52],['SOUTH AMERICA',-56,-49],['EUROPE',14,59],['AFRICA',23,-38],['ASIA',87,58],['OCEANIA',148,-45]];
    for(const [name,lon,lat]of continentLabels) {const [x,y]=projection([lon,lat]);zoomable.append('text').attr('x',x).attr('y',y).attr('text-anchor','middle').attr('fill','#66665f').attr('font-size',7).attr('font-family','monospace').attr('letter-spacing',1).attr('pointer-events','none').text(name);}
    const zoom=d3.zoom().scaleExtent([1,4]).extent([[0,0],[width,height]]).translateExtent([[0,0],[width,height]]).filter(e=>e.type==='dblclick'||(e.type==='wheel'&&e.ctrlKey)||e.type==='mousedown'&&e.button===0).on('zoom',e=>zoomable.attr('transform',e.transform));
    svg.call(zoom).on('wheel.zoom',null);
    $('#zoom-in').addEventListener('click',()=>svg.call(zoom.scaleBy,1.4));$('#zoom-out').addEventListener('click',()=>svg.call(zoom.scaleBy,1/1.4));$('#zoom-reset').addEventListener('click',()=>svg.call(zoom.transform,d3.zoomIdentity));
    $('#compare').addEventListener('click',()=>{const enabled=$('#compare').getAttribute('aria-pressed')!=='true';$('#compare').setAttribute('aria-pressed',String(enabled));reference.attr('display',enabled?null:'none');$('#compare').textContent=enabled?'Reference outline on':'Compare reference';});
    $$('[data-layer]').forEach(el=>el.addEventListener('change',()=>layerPaths[el.dataset.layer].attr('display',el.checked?null:'none')));
    $('#texture').addEventListener('change',()=>{svg.classed('flat-ink',!$('#texture').checked);for(const [key,p]of Object.entries(layerPaths))p.attr('fill',$('#texture').checked?'url(#ink-'+key+')':inks[key]);});
    const descriptions={pasture:'Remaining beef pasture',feed:'Remaining beef feed cropland',replacement:'New replacement-food land demand',avoided:'Gross avoided beef land demand'};
    for(const [key,p]of Object.entries(layerPaths)) {
      p.on('pointermove',function(e){const tip=$('#map-tooltip'),rect=$('#map-wrap').getBoundingClientRect();tip.hidden=false;tip.textContent=`${descriptions[key]}: ${fmt(result[key])} index points. Schematic placement; not measured locations.`;tip.style.left=Math.min(e.clientX-rect.left+12,rect.width-230)+'px';tip.style.top=Math.max(10,e.clientY-rect.top-66)+'px';}).on('pointerleave',()=>$('#map-tooltip').hidden=true);
    }
    drawMap=r=> {
      const keep=1-r.shift,pk=Math.round(pastureCells.length*keep),fk=Math.round(feedCells.length*keep);
      const avoided=[...pastureCells.slice(pk),...feedCells.slice(fk)];
      layerPaths.pasture.attr('d',shape(pastureCells.slice(0,pk)));layerPaths.feed.attr('d',shape(feedCells.slice(0,fk)));
      layerPaths.avoided.attr('d',shape(avoided));layerPaths.replacement.attr('d',shape(cropOrder.slice(0,Math.round(baseline.length*r.replacement/100))));
      $('#map-description').textContent=`Illustrative world canvas. Scenario index ${fmt(r.total)}, with ${fmt(r.pasture)} pasture, ${fmt(r.feed)} feed and ${fmt(r.replacement)} replacement-food points. Patches are schematic and do not show real locations or calibrated area.`;
    };
    mapReady=true;drawMap(result);
    document.documentElement.dataset.ready='true';
  } catch(error) {
    $('#map-failure').hidden=false;$('#world-map').hidden=true;
    $$('#zoom-in,#zoom-out,#zoom-reset,#compare,#texture,[data-layer]').forEach(el=>el.disabled=true);console.error(error);
    document.documentElement.dataset.ready='partial';
  }
})();
