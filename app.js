
const equipment=['CFBC Boiler','Steam Turbine','Air Cooled Condenser','ESP','CHP','AHS','WTP / ETP','Cooling Tower','Electrical','C&I'];

const sampleDocs=[];

const KB = [
{
 keys:['what is cfbc','cfbc','cfbc boiler','circulating fluidized bed combustion'],
 title:'What is a CFBC Boiler?',
 short:'CFBC means Circulating Fluidized Bed Combustion. In a CFBC boiler, fuel burns in a hot circulating bed of solids. Fine particles carried with flue gas are separated in a cyclone and returned to the furnace, which improves fuel burnout and heat transfer.',
 sections:[
  ['How it works','Primary air fluidizes the bed material. Fuel is fed into the furnace and burns while solids circulate through the furnace and cyclone. Separated solids return through the loop seal, maintaining continuous circulation.'],
  ['Main equipment','Furnace/combustor, air distributor/nozzles, PA/SA system, fuel feeding system, cyclone separator, loop seal, superheater/reheater/economizer, air preheater, ID/FD/PA fans and ash handling system.'],
  ['Why CFBC is used','Good fuel flexibility, strong mixing, relatively uniform furnace temperature and the ability to control SOx by adding limestone when the plant design includes limestone injection.'],
  ['Operator focus','Bed temperature, furnace draft, O₂, PA/SA flow and pressure, bed pressure/DP, cyclone/loop-seal condition, fuel feed, steam parameters, fan loading and ash circulation.']
 ],
 source:'Built-in engineering knowledge',
 tags:['boiler','cfbc','combustion']
},
{
 keys:['what is afbc','afbc','afbc boiler'],
 title:'What is an AFBC Boiler?',
 short:'AFBC means Atmospheric Fluidized Bed Combustion. Fuel burns in a bed of hot material fluidized by air at approximately atmospheric pressure. The bed provides strong mixing and good heat transfer.',
 sections:[
  ['CFBC vs AFBC','AFBC generally retains most bed solids within the furnace, while CFBC intentionally circulates a larger quantity of solids through separators and returns them to the furnace.'],
  ['Operator focus','Bed temperature, bed pressure, air distribution, fuel size/feeding, clinker formation, O₂, furnace draft and steam parameters.']
 ],
 source:'Built-in engineering knowledge',
 tags:['boiler','afbc']
},
{
 keys:['bfp','bfp pump','boiler feed pump','what is bfp'],
 title:'Boiler Feed Pump (BFP)',
 short:'A Boiler Feed Pump supplies feedwater to the boiler at sufficient pressure to overcome boiler pressure plus piping, valve and equipment losses.',
 sections:[
  ['Important technical data','Manufacturer, model, pump type, number of stages, rated flow, rated head, speed, efficiency, NPSHr, minimum-flow requirement, bearing type, seal type, coupling and motor rating.'],
  ['Important operating checks','Suction pressure, discharge pressure, flow, bearing temperature, vibration, seal leakage, lube-oil condition, motor current and minimum-flow recirculation.'],
  ['Protection/interlocks','Actual start permissives, trips and alarm settings are plant-specific and must be taken from the approved interlock/protection documents.']
 ],
 source:'Built-in engineering knowledge • Plant-specific values require uploaded approved documents',
 tags:['pump','bfp','boiler']
},
{
 keys:['bfp pump data','bfp technical data','bfp nameplate'],
 title:'BFP Technical Data Search',
 short:'For an authorized user, this query should combine BFP nameplate, datasheet and O&M-manual information into one answer.',
 sections:[
  ['Fields to retrieve','OEM, model, serial number, rated flow, rated head, speed, stages, efficiency, NPSHr, design pressure/temperature, bearing, seal, coupling, minimum-flow value, motor kW, voltage, current and service factor.'],
  ['Current Lite status','This version does not yet parse the actual uploaded PDF/Excel/Word file contents. The secure document-indexing backend is the next integration step.']
 ],
 source:'Plant document search template',
 tags:['bfp','pump','nameplate','technical data']
},
{
 keys:['lhs panel','lhs pressure parts','boiler lhs panel'],
 title:'CFBC Boiler – LHS Pressure Parts',
 short:'The LHS panel page is intended to collect all left-hand-side boiler pressure-part information from your approved drawings, material schedules and inspection records.',
 sections:[
  ['Data to show','Panel/coil identification, tube OD and thickness, material grade, pitch, quantity, panel dimensions, header identification, design pressure, design temperature, weld/joint details and drawing number.'],
  ['Maintenance history','Tube failures, erosion locations, shields/cladding, thickness readings, weld repairs, NDT results and replacement history can be linked here.'],
  ['Safety rule','No generic tube size, material or pressure rating should be presented as your plant value without a verified source document.']
 ],
 source:'Boiler → Pressure Parts template',
 tags:['boiler','pressure parts','lhs panel']
},
{
 keys:['bfp-a interlocks','bfp interlocks','bfp permissives'],
 title:'BFP Interlocks / Permissives',
 short:'The app will display BFP start permissives, running interlocks, alarms and trips from the approved plant logic/interlock document.',
 sections:[
  ['Start permissives','Plant-specific. Examples of categories include suction availability, minimum-flow path readiness, lubrication conditions, electrical readiness and associated valve status.'],
  ['Trips/protections','Actual trip logic and setpoints must come only from approved DCS/PLC logic, cause-and-effect sheets or OEM/protection documents.'],
  ['Current Lite status','Document-content extraction is not yet connected, so this screen deliberately does not invent your plant logic.']
 ],
 source:'Plant-specific document required',
 tags:['bfp','interlock','permissive','trip']
},
{
 keys:['steam turbine','what is steam turbine','turbine'],
 title:'Steam Turbine',
 short:'A steam turbine converts the thermal and pressure energy of steam into rotating mechanical energy, which usually drives an electrical generator.',
 sections:[
  ['Energy conversion','Steam expands through stationary and rotating blade rows. The pressure/enthalpy drop produces torque on the rotor.'],
  ['Operator focus','Main steam pressure/temperature, load, speed, bearing vibration, axial shift, bearing metal temperature, lube-oil pressure/temperature, gland sealing and condenser/ACC backpressure.'],
  ['Key performance terms','Heat rate, turbine efficiency, specific steam consumption and condenser/backpressure performance.']
 ],
 source:'Built-in engineering knowledge',
 tags:['turbine','steam']
},
{
 keys:['acc','air cooled condenser','what is acc'],
 title:'Air Cooled Condenser (ACC)',
 short:'An ACC condenses turbine exhaust steam inside finned tubes using ambient air moved by large fans, avoiding the need for a conventional water-cooled surface condenser and cooling-water circuit.',
 sections:[
  ['Main parts','Steam duct, finned-tube bundles, fan cells, gearboxes/motors, condensate collection, air-removal/ejector system and vacuum system.'],
  ['Operator focus','Turbine backpressure/vacuum, ambient temperature, fan availability/speed, bundle cleanliness, air ingress, ejector performance and condensate temperature.']
 ],
 source:'Built-in engineering knowledge',
 tags:['acc','condenser','turbine']
},
{
 keys:['esp','electrostatic precipitator','what is esp'],
 title:'Electrostatic Precipitator (ESP)',
 short:'An ESP removes fly ash from flue gas by electrically charging particles and collecting them on oppositely charged collecting plates.',
 sections:[
  ['Main parts','Transformer-rectifier sets, discharge electrodes, collecting plates, rappers, insulators, hoppers, heaters and control system.'],
  ['Operator focus','Secondary voltage/current, spark rate, rapper operation, hopper evacuation, insulator condition and gas/ash distribution.']
 ],
 source:'Built-in engineering knowledge',
 tags:['esp','ash','environment']
},
{
 keys:['chp','coal handling plant','what is chp'],
 title:'Coal Handling Plant (CHP)',
 short:'The CHP receives, unloads, conveys, crushes, screens, stores and supplies coal to the boiler bunkers.',
 sections:[
  ['Typical equipment','Wagon tippler/truck unloading, feeders, conveyors, crushers, screens, magnetic separators, metal detectors, stacker-reclaimer and bunker feeding conveyors.'],
  ['Operator focus','Belt tracking, chute choking, crusher condition, coal size, fire/dust control, pull-cord and zero-speed protections.']
 ],
 source:'Built-in engineering knowledge',
 tags:['chp','coal','conveyor']
},
{
 keys:['ahs','ash handling system','ash handling'],
 title:'Ash Handling System (AHS)',
 short:'The ash handling system collects, transports, stores and disposes or utilizes bottom ash and fly ash produced by the boiler/ESP.',
 sections:[
  ['Typical areas','Bottom ash handling, fly-ash hopper evacuation, pneumatic conveying, ash silos, compressors/blowers and ash conditioning/disposal.'],
  ['Operator focus','Hopper levels, conveying pressure/vacuum, line choking, ash temperature, air supply and valve sequencing.']
 ],
 source:'Built-in engineering knowledge',
 tags:['ahs','ash']
},
{
 keys:['cooling tower','what is cooling tower'],
 title:'Cooling Tower',
 short:'A cooling tower rejects heat from circulating water to the atmosphere, mainly through evaporation and sensible heat transfer.',
 sections:[
  ['Key terms','Range = hot-water temperature minus cold-water temperature. Approach = cold-water temperature minus ambient wet-bulb temperature.'],
  ['Operator focus','Hot/cold water temperatures, wet-bulb temperature, fan operation, water flow, basin level, drift, fill condition and water chemistry.']
 ],
 source:'Built-in engineering knowledge',
 tags:['cooling tower','water']
},
{
 keys:['wph','water treatment plant','wtp','dm plant','ro plant'],
 title:'Water Treatment / DM Plant',
 short:'Power-plant water-treatment systems remove suspended solids, dissolved salts and other contaminants so that makeup and cycle-water quality meet plant requirements.',
 sections:[
  ['Common stages','Clarification/filtration, UF where provided, RO, degassing and demineralization/EDI depending on plant design.'],
  ['Operator focus','Pressure drop, conductivity, silica, pH, SDI/turbidity, RO recovery/rejection, chemical dosing and regeneration performance.']
 ],
 source:'Built-in engineering knowledge',
 tags:['wtp','dm','ro','water']
},
{
 keys:['etp','effluent treatment plant'],
 title:'Effluent Treatment Plant (ETP)',
 short:'An ETP treats plant wastewater so that it can be reused or discharged according to the applicable environmental requirements and plant design.',
 sections:[
  ['Typical monitoring','pH, TSS, oil/grease, conductivity/TDS and other parameters specified by the plant/environmental consent.'],
  ['Important note','Required discharge limits are site- and regulation-specific; use the current approved consent/standard rather than generic limits.']
 ],
 source:'Built-in engineering knowledge',
 tags:['etp','water','environment']
},
{
 keys:['what is dcs','dcs','distributed control system'],
 title:'Distributed Control System (DCS)',
 short:'A DCS is the plant-wide automation system used to monitor process signals, execute control logic, regulate loops, generate alarms/trends and provide operator interfaces.',
 sections:[
  ['Typical functions','PID control, sequencing, permissives/interlocks, alarms, trends, event logs, operator commands and historical data.'],
  ['Engineering caution','Actual control logic, alarm limits and trip settings must be verified against approved plant logic and protection documents.']
 ],
 source:'Built-in engineering knowledge',
 tags:['c&i','dcs','control']
},
{
 keys:['what is plc','plc','programmable logic controller'],
 title:'Programmable Logic Controller (PLC)',
 short:'A PLC is an industrial controller that executes programmed logic for machines, packages and plant systems using digital/analog inputs and outputs.',
 sections:[
  ['Typical uses','Conveyors, ash handling, water-treatment skids, compressor packages, auxiliary systems and local equipment sequencing.'],
  ['DCS vs PLC','DCS is often plant/process-oriented with integrated operator control and historian functions; PLCs are commonly used for fast discrete/package control. Actual architecture varies by plant.']
 ],
 source:'Built-in engineering knowledge',
 tags:['c&i','plc','control']
},
{
 keys:['3 phase power','three phase power','motor power formula'],
 title:'Three-Phase Active Power Formula',
 short:'For a balanced three-phase AC system: P(kW) = √3 × V × I × PF × η / 1000 when estimating shaft/output power using efficiency η. For electrical input power, omit η.',
 sections:[
  ['Variables','V = line-to-line voltage (V), I = line current (A), PF = power factor, η = efficiency as a decimal.'],
  ['Use the calculator','Open Calculators → 3-Phase Power for a quick calculation.']
 ],
 source:'Built-in formula library',
 tags:['electrical','formula','power']
},
{
 keys:['boiler efficiency','boiler efficiency formula'],
 title:'Boiler Efficiency',
 short:'Boiler efficiency expresses how much of the fuel heat input is converted into useful steam heat output. It can be assessed by the direct method or by the indirect/loss method.',
 sections:[
  ['Direct method','Efficiency (%) = Useful heat absorbed by steam ÷ Fuel heat input × 100.'],
  ['Important inputs','Steam/feedwater conditions, steam flow, fuel flow and fuel GCV/NCV according to the selected method and standard.'],
  ['Engineering note','For formal performance testing, use the applicable standard and agreed test procedure rather than a simplified app calculation.']
 ],
 source:'Built-in formula library',
 tags:['boiler','efficiency','formula']
},
{
 keys:['turbine heat rate','heat rate'],
 title:'Turbine / Unit Heat Rate',
 short:'Heat rate is the heat input required to generate a unit of electrical energy. Lower heat rate generally indicates better efficiency when compared on the same defined basis.',
 sections:[
  ['Common expression','Heat Rate (kJ/kWh) = Heat input rate (kJ/h) ÷ Electrical output (kW).'],
  ['Caution','Clearly define whether you are calculating turbine-cycle heat rate, gross unit heat rate or net unit heat rate.']
 ],
 source:'Built-in formula library',
 tags:['turbine','performance','formula']
}
];

let admin=localStorage.getItem('pp360admin')==='1';
let docs=JSON.parse(localStorage.getItem('pp360docs')||'null')||sampleDocs;
let history=JSON.parse(localStorage.getItem('pp360history')||'[]');
const tabs=['Home','Search History','Calculators','DCS Analysis','Mock Interview','Admin'];

const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const norm=s=>s.toLowerCase().replace(/[^\w\s&/-]/g,' ').replace(/\s+/g,' ').trim();

function renderTabs(active='Home'){
 document.getElementById('tabs').innerHTML=tabs.map(x=>`<button class='${x===active?'active':''}' onclick="show('${x}')">${x}</button>`).join('');
}

function show(x){
 renderTabs(x);
 const v=document.getElementById('view');
 if(x==='Home')v.innerHTML=`<div class='grid'>${equipment.map(e=>`<div class='card'><h3>${e}</h3><p class='muted'>Technical data • Manuals • Interlocks • Troubleshooting</p><div class='actions'><button class='primary' onclick="equipmentPage('${e}')">Open</button>${e==='CFBC Boiler'?`<button onclick="searchTerm('lhs panel')">Pressure Parts</button>`:''}</div></div>`).join('')}</div>`;
 if(x==='Search History')v.innerHTML=`<div class='card'><h2>Search History</h2>${history.length?history.map(h=>`<p>🔎 <button class="linkbtn" onclick="searchTerm('${esc(h).replace(/'/g,"\\'")}')">${esc(h)}</button></p>`).join(''):'<p class=muted>No searches yet.</p>'}</div>`;
 if(x==='Calculators')v.innerHTML=`<div class='card'><h2>Engineering Calculator</h2><h3>3-Phase Electrical Input Power</h3><div class=actions><input id=volt type=number placeholder='Voltage V'><input id=amp type=number placeholder='Current A'><input id=pf type=number step=.01 placeholder='Power factor'><button class=primary onclick=calcPower()>Calculate</button></div><p id=calc></p><p class=muted>Formula: P(kW) = √3 × V × I × PF / 1000</p></div>`;
 if(x==='DCS Analysis')v.innerHTML=`<div class='card'><h2>DCS Daily Report Analysis</h2><p>Production version will parse authorized Excel/CSV daily reports, compare parameters against approved limits and detect historical deviations.</p><div class="notice">For safety, the app will not create alarm/trip limits from generic internet values. You will define or upload the approved plant limits.</div><table><tr><th>Parameter</th><th>Reading</th><th>Status</th></tr><tr><td>Main Steam Temp</td><td>Demo</td><td><span class='badge ok'>NORMAL</span></td></tr><tr><td>ID Fan-A Current</td><td>+14% vs 7-day avg</td><td><span class='badge danger'>ATTENTION</span></td></tr></table></div>`;
 if(x==='Mock Interview')v.innerHTML=`<div class='card'><h2>Mock Interview</h2><select id=role><option>Plant Head</option><option>Operations Manager</option><option>Shift Incharge</option><option>Engineer</option><option>Operator</option></select> <select><option>Boiler</option><option>Turbine</option><option>Electrical</option><option>C&I</option><option>CHP/AHS</option><option>WTP/ETP</option></select><p><b>Q:</b> During sudden furnace draft fluctuation in a CFBC boiler, what parameters and equipment would you check first?</p><textarea style='width:100%;min-height:100px' placeholder='Type your answer...'></textarea></div>`;
 if(x==='Admin')adminPage();
}

function equipmentPage(e){
 renderTabs();
 const equipmentUpload = admin ? `
   <div class="equipment-uploadbar">
     <div>
       <b>${esc(e)} Documents</b>
       <div class="muted small">Upload individual files now, or choose a complete manual ZIP package for this system.</div>
     </div>
     <div class="actions">
       <button onclick="openEquipmentUpload('${e.replace(/'/g,"\\'")}')">Upload Documents</button>
       <button class="primary" onclick="openEquipmentPackagePicker('${e.replace(/'/g,"\\'")}')">Upload Manual Package (.zip)</button>
     </div>
     <input id="equipmentPackageInput" type="file" accept=".zip,application/zip" hidden onchange="equipmentPackageSelected(this)">
   </div>` : '';
 document.getElementById('view').innerHTML=`<div class=card><span class=badge>${e}</span><h2>${e}</h2>${equipmentUpload}<div class=actions>${['Technical Data','O&M Manuals','Nameplate','Interlocks','SOP','Troubleshooting','Startup / Loading Curves','Calculations','Documents','Notes'].map(b=>`<button onclick="equipmentAction('${e}','${b}')">${b}</button>`).join('')}</div>${e==='CFBC Boiler'?'<h3>Pressure Parts</h3><button class=primary onclick="pressurePartsPage()">Pressure Parts</button>':''}</div>`;
}

let pendingEquipmentUpload = '';

function openEquipmentUpload(e){
 pendingEquipmentUpload = e || '';
 window.pp360UploadContext={category:pendingEquipmentUpload || 'General', section:''};
 show('Admin');
 setTimeout(()=>{
   const input=document.getElementById('file');
   if(input){
     input.dataset.category = pendingEquipmentUpload;
     input.click();
   }
 },120);
}

function openEquipmentPackagePicker(e){
 pendingEquipmentUpload = e || '';
 window.pp360UploadContext={category:pendingEquipmentUpload || 'General', section:''};
 const input=document.getElementById('equipmentPackageInput');
 if(input){
   input.dataset.category = pendingEquipmentUpload;
   input.click();
 }
}

async function ensurePackageUploader(){
 if(typeof window.handleEquipmentPackageUpload==='function') return true;
 await new Promise(r=>setTimeout(r,600));
 if(typeof window.handleEquipmentPackageUpload==='function') return true;
 try{
   if('serviceWorker' in navigator){
     const rs=await navigator.serviceWorker.getRegistrations();
     await Promise.all(rs.map(r=>r.unregister()));
   }
   if('caches' in window){
     const keys=await caches.keys();
     await Promise.all(keys.map(k=>caches.delete(k)));
   }
 }catch(e){}
 return false;
}

async function equipmentPackageSelected(input){
 const file=input?.files?.[0];
 if(!file) return;
 const category=input.dataset.category || pendingEquipmentUpload || 'General';
 if(await ensurePackageUploader()){
   window.handleEquipmentPackageUpload(file, category);
   return;
 }
 alert('PowerPlant360 needs one automatic refresh to load the ZIP uploader. The page will reload now; then select the ZIP again.');
 const u=new URL(window.location.href);
 u.searchParams.set('build','24');
 u.searchParams.set('reload',Date.now().toString());
 window.location.replace(u.toString());
}

function pressurePartsPage(){
 renderTabs();
 document.getElementById('view').innerHTML=`<div class="card">
   <span class="badge">CFBC Boiler</span>
   <h2>Pressure Parts</h2>
   <p class="muted">Upload all boiler pressure-parts manuals, drawings, datasheets, inspection records and maintenance documents here.</p>
   ${admin?`<div class="equipment-uploadbar">
     <div>
       <b>CFBC Boiler → Pressure Parts</b>
       <div class="muted small">These files will be tagged to the Pressure Parts section for more accurate search.</div>
     </div>
     <div class="actions">
       <button onclick="openPressurePartsUpload()">Upload Documents</button>
       <button class="primary" onclick="openPressurePartsPackagePicker()">Upload Manual Package (.zip)</button>
     </div>
     <input id="pressurePartsPackageInput" type="file" accept=".zip,application/zip" hidden onchange="pressurePartsPackageSelected(this)">
   </div>`:''}
   <div class="notice"><b>Search behavior:</b> panel/coil/header/tube names will search Pressure Parts documents first, then other CFBC Boiler documents.</div>
 </div>`;
}

function openPressurePartsUpload(){
 window.pp360UploadContext={category:'CFBC Boiler', section:'Pressure Parts'};
 show('Admin');
 setTimeout(()=>{
   const input=document.getElementById('file');
   if(input) input.click();
 },120);
}

function openPressurePartsPackagePicker(){
 window.pp360UploadContext={category:'CFBC Boiler', section:'Pressure Parts'};
 const input=document.getElementById('pressurePartsPackageInput');
 if(input) input.click();
}

async function pressurePartsPackageSelected(input){
 const file=input?.files?.[0];
 if(!file) return;
 if(await ensurePackageUploader()){
   window.handleEquipmentPackageUpload(file,'CFBC Boiler','Pressure Parts');
   return;
 }
 alert('PowerPlant360 needs one automatic refresh to load the ZIP uploader. The page will reload now; then select the ZIP again.');
 const u=new URL(window.location.href);
 u.searchParams.set('build','24');
 u.searchParams.set('reload',Date.now().toString());
 window.location.replace(u.toString());
}

function equipmentAction(e,b){
 if(typeof window.renderEquipmentDocuments==='function' && admin){
   window.renderEquipmentDocuments(e,b);
   return;
 }
 if(b==='Technical Data') { searchTerm(e); return; }
 document.getElementById('view').innerHTML=`<div class="card"><span class="badge">${esc(e)}</span><h2>${esc(b)}</h2><p>Plant documents are available after Admin sign-in.</p></div>`;
}

function searchTerm(t){
 document.getElementById('q').value=t;
 searchAll();
}

function scoreEntry(entry,q){
 let score=0;
 const words=q.split(' ').filter(Boolean);
 for(const key of entry.keys){
   const k=norm(key);
   if(q===k) score+=100;
   else if(k.includes(q)||q.includes(k)) score+=45;
   for(const w of words) if(k.includes(w)) score+=5;
 }
 for(const tag of (entry.tags||[])) if(q.includes(norm(tag))) score+=8;
 return score;
}

function findKnowledge(q){
 const ranked=KB.map(x=>({x,score:scoreEntry(x,q)})).sort((a,b)=>b.score-a.score);
 return ranked[0]&&ranked[0].score>=10?ranked[0].x:null;
}

function renderAnswer(r,q){
 const sec=(r.sections||[]).map((s,i)=>`<details ${i===0?'open':''}><summary>${esc(s[0])}</summary><p>${esc(s[1])}</p></details>`).join('');
 const online=`https://www.google.com/search?q=${encodeURIComponent(q+' power plant engineering')}`;
 return `<div class='card result'>
   <div class="answerhead"><span class=badge>${admin?'Authorized mode':'Public knowledge'}</span><span class="confidence">Source shown below</span></div>
   <h2>${esc(r.title)}</h2>
   <div class="quickanswer"><b>Quick answer</b><p>${esc(r.short)}</p></div>
   ${sec}
   <div class="sourcebox"><b>Source:</b> ${esc(r.source)}</div>
   <div class="actions"><button onclick="location.href='${online}'">Search online references</button>${admin?'<button onclick="show(\'Admin\')">Plant documents</button>':''}</div>
 </div>`;
}

function renderNoAnswer(q){
 const online=`https://www.google.com/search?q=${encodeURIComponent(q+' power plant engineering')}`;
 return `<div class='card result'>
   <span class=badge>${admin?'Authorized mode':'Public knowledge'}</span>
   <h2>No verified built-in answer found</h2>
   <p>I don't have a verified built-in entry for <b>${esc(q)}</b> yet.</p>
   ${admin?'<p>Your uploaded filenames are visible to the demo, but their PDF/Excel/Word contents are <b>not yet indexed</b>. Therefore I will not pretend that I found plant-specific data.</p>':'<p>Public mode does not expose plant manuals, interlocks, nameplates or DCS reports.</p>'}
   <div class="notice">Next backend step: extract and index authorized PDF, Word and Excel content so this same search box can answer with document name + page/sheet reference.</div>
   <div class=actions><button class=primary onclick="location.href='${online}'">Search online references</button>${admin?'<button onclick="show(\'Admin\')">Open Admin Documents</button>':''}</div>
 </div>`;
}

function searchAll(){
 let raw=document.getElementById('q').value.trim();
 let q=norm(raw);
 if(!q)return;
 history=[raw,...history.filter(x=>norm(x)!==q)].slice(0,30);
 localStorage.setItem('pp360history',JSON.stringify(history));
 const r=findKnowledge(q);
 renderTabs();
 document.getElementById('view').innerHTML=r?renderAnswer(r,raw):renderNoAnswer(raw);
}



const categories=[
 'CFBC Boiler','Steam Turbine','Air Cooled Condenser','ESP','CHP','AHS',
 'WTP / ETP','Cooling Tower','Electrical','C&I','Operations','General'
];

const docTypes=[
 'O&M Manual','Nameplate Data','Interlocks','SOP','Startup Curve',
 'Loading Curve','DCS Report','Drawing','Datasheet','Inspection Report',
 'Maintenance Record','Other'
];

function adminPage(){
 let v=document.getElementById('view');
 if(!admin){
   v.innerHTML=`<div class='card admin'><h2>Admin Login</h2>
   <div class="notice">Lite demo authentication only. Do not use this password system for a public deployment.</div>
   <p>Demo password: <b>admin123</b></p>
   <input id=pass type=password placeholder='Password'>
   <button class=primary onclick=login()>Login</button></div>`;
   return;
 }

 v.innerHTML=`<div class='card admin'>
 <h2>Admin Document Manager</h2>

 <div id="dropZone" class="dropzone" tabindex="0">
   <div class="dropicon">⬆️</div>
   <h3>Drag & drop files here</h3>
   <p>or</p>
   <label class="uploadchoose">Choose Files
     <input id="file" type="file" multiple
       accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg" hidden>
   </label>
   <p class="muted">PDF, Word, Excel, CSV, TXT and images</p>
 </div>

 <div id="uploadQueue" class="uploadqueue"></div>

 <div class="notice">
 <b>Lite V1.3:</b> file metadata is saved in this browser after local processing.
 The actual document contents are still not stored on a server.
 </div>

 <div class="doc-toolbar">
   <div>
     <label>Category filter</label>
     <select id="filterCategory" onchange="renderDocTable()">
       <option value="">All categories</option>
       ${categories.map(c=>`<option>${c}</option>`).join('')}
     </select>
   </div>
   <div>
     <label>Document type</label>
     <select id="filterType" onchange="renderDocTable()">
       <option value="">All document types</option>
       ${docTypes.map(t=>`<option>${t}</option>`).join('')}
     </select>
   </div>
   <div class="grow">
     <label>Search files</label>
     <input id="docSearch" oninput="renderDocTable()" placeholder="Search filename...">
   </div>
 </div>

 <h3>Uploaded / Added Files</h3>
 <div id="docTableWrap"></div>

 <p><button onclick=logout()>Logout</button></p>
 </div>`;

 setupDropZone();
 renderDocTable();
}

function setupDropZone(){
 const dz=document.getElementById('dropZone');
 const input=document.getElementById('file');
 if(!dz||!input)return;

 ['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{
   e.preventDefault(); e.stopPropagation(); dz.classList.add('dragover');
 }));

 ['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{
   e.preventDefault(); e.stopPropagation(); dz.classList.remove('dragover');
 }));

 dz.addEventListener('drop',e=>{
   const files=[...e.dataTransfer.files];
   if(files.length) processSelectedFiles(files);
 });

 input.addEventListener('change',()=>{
   const files=[...input.files];
   if(files.length) processSelectedFiles(files);
   input.value='';
 });

 dz.addEventListener('keydown',e=>{
   if(e.key==='Enter'||e.key===' '){
     e.preventDefault();
     input.click();
   }
 });
}

function formatBytes(bytes){
 if(bytes===0)return '0 B';
 const k=1024, sizes=['B','KB','MB','GB'];
 const i=Math.floor(Math.log(bytes)/Math.log(k));
 return (bytes/Math.pow(k,i)).toFixed(i?1:0)+' '+sizes[i];
}

function safeId(){
 return 'up_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
}

function processSelectedFiles(files){
 const q=document.getElementById('uploadQueue');
 if(!q)return;

 files.forEach(file=>{
   const id=safeId();
   q.insertAdjacentHTML('beforeend',`
     <div class="uploaditem" id="${id}">
       <div class="uploadrow">
         <div>
           <b>${esc(file.name)}</b>
           <div class="muted small">${formatBytes(file.size)}</div>
         </div>
         <div class="uploadpct" id="${id}_pct">0%</div>
       </div>
       <div class="progress">
         <div class="progressbar" id="${id}_bar" style="width:0%"></div>
       </div>
       <div class="uploadstatus muted" id="${id}_status">Waiting…</div>
     </div>`);
   readFileWithProgress(file,id);
 });
}

function readFileWithProgress(file,id){
 const reader=new FileReader();
 const bar=document.getElementById(id+'_bar');
 const pct=document.getElementById(id+'_pct');
 const status=document.getElementById(id+'_status');

 reader.onloadstart=()=>{ status.textContent='Reading file…'; };

 reader.onprogress=e=>{
   if(e.lengthComputable){
     const p=Math.max(1,Math.min(99,Math.round((e.loaded/e.total)*100)));
     bar.style.width=p+'%';
     pct.textContent=p+'%';
     status.textContent='Processing locally…';
   }
 };

 reader.onload=()=>{
   bar.style.width='100%';
   pct.textContent='100%';
   status.innerHTML='<span class="oktext">✓ Completed</span>';

   const row={
     id:'doc_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),
     name:file.name,
     category:guessCategory(file.name),
     type:guessDocType(file.name),
     size:file.size,
     sizeText:formatBytes(file.size),
     uploadedAt:new Date().toLocaleString(),
     status:'100% complete'
   };

   docs.push(row);
   saveDocs();
   renderDocTable();
 };

 reader.onerror=()=>{
   bar.classList.add('errorbar');
   pct.textContent='Error';
   status.innerHTML='<span class="errtext">✕ Could not read this file</span>';
 };

 reader.readAsArrayBuffer(file);
}

function guessCategory(name){
 const n=name.toLowerCase();
 if(n.includes('boiler')||n.includes('cfbc')) return 'CFBC Boiler';
 if(n.includes('turbine')) return 'Steam Turbine';
 if(n.includes('acc')||n.includes('condenser')) return 'Air Cooled Condenser';
 if(n.includes('esp')) return 'ESP';
 if(n.includes('chp')||n.includes('coal')||n.includes('conveyor')) return 'CHP';
 if(n.includes('ash')||n.includes('ahs')) return 'AHS';
 if(n.includes('wtp')||n.includes('dm')||n.includes('ro')||n.includes('etp')) return 'WTP / ETP';
 if(n.includes('cooling')) return 'Cooling Tower';
 if(n.includes('electrical')||n.includes('motor')||n.includes('transformer')||n.includes('mcc')) return 'Electrical';
 if(n.includes('dcs')||n.includes('plc')||n.includes('instrument')||n.includes('c&i')) return 'C&I';
 if(n.includes('daily')||n.includes('operation')||n.includes('dcs report')) return 'Operations';
 return 'General';
}

function guessDocType(name){
 const n=name.toLowerCase();
 if(n.includes('o&m')||n.includes('manual')) return 'O&M Manual';
 if(n.includes('nameplate')) return 'Nameplate Data';
 if(n.includes('interlock')||n.includes('permissive')) return 'Interlocks';
 if(n.includes('sop')) return 'SOP';
 if(n.includes('startup')) return 'Startup Curve';
 if(n.includes('loading')||n.includes('load curve')) return 'Loading Curve';
 if(n.includes('dcs')||n.includes('daily report')) return 'DCS Report';
 if(n.includes('drawing')||n.includes('ga')||n.includes('pid')||n.includes('p&id')) return 'Drawing';
 if(n.includes('datasheet')||n.includes('data sheet')) return 'Datasheet';
 if(n.includes('inspection')) return 'Inspection Report';
 if(n.includes('maintenance')) return 'Maintenance Record';
 return 'Other';
}

function saveDocs(){
 localStorage.setItem('pp360docs',JSON.stringify(docs));
}

function renderDocTable(){
 const wrap=document.getElementById('docTableWrap');
 if(!wrap)return;

 const fc=document.getElementById('filterCategory')?.value||'';
 const ft=document.getElementById('filterType')?.value||'';
 const qs=(document.getElementById('docSearch')?.value||'').toLowerCase();

 const list=docs.filter(d=>{
   const cat=d.category||d.cat||'General';
   const typ=d.type||'Other';
   return (!fc||cat===fc) &&
          (!ft||typ===ft) &&
          (!qs||(d.name||'').toLowerCase().includes(qs));
 });

 if(!list.length){
   wrap.innerHTML=`<div class="emptydocs">
     <b>No files found.</b>
     <p class="muted">Drag files into the upload box above.</p>
   </div>`;
   return;
 }

 wrap.innerHTML=`
 <div class="table-scroll">
 <table class="doctable">
   <tr>
     <th>Name</th>
     <th>Category</th>
     <th>Type</th>
     <th>Size</th>
     <th>Uploaded</th>
     <th>Status</th>
     <th>Actions</th>
   </tr>
   ${list.map(d=>{
     const idx=docs.indexOf(d);
     return `<tr>
       <td><b>${esc(d.name)}</b></td>
       <td>${esc(d.category||d.cat||'General')}</td>
       <td>${esc(d.type||'Other')}</td>
       <td>${esc(d.sizeText||'—')}</td>
       <td>${esc(d.uploadedAt||'—')}</td>
       <td><span class="badge ok">${esc(d.status||'Complete')}</span></td>
       <td class="nowrap">
         <button onclick="editDoc(${idx})">Edit</button>
         <button class="dangerbtn" onclick="del(${idx})">Delete</button>
       </td>
     </tr>`;
   }).join('')}
 </table>
 </div>`;
}

function editDoc(i){
 const d=docs[i];
 if(!d)return;

 document.getElementById('view').insertAdjacentHTML('beforeend',`
 <div class="modalback" id="editModal">
   <div class="modalbox">
     <h3>Edit File Details</h3>

     <label>File name</label>
     <input id="editName" value="${esc(d.name)}">

     <label>Category</label>
     <select id="editCategory">
       ${categories.map(c=>`<option ${c===(d.category||d.cat)?'selected':''}>${c}</option>`).join('')}
     </select>

     <label>Document type</label>
     <select id="editType">
       ${docTypes.map(t=>`<option ${t===(d.type||'Other')?'selected':''}>${t}</option>`).join('')}
     </select>

     <div class="actions modalactions">
       <button class="primary" onclick="saveDocEdit(${i})">Save</button>
       <button onclick="closeEdit()">Cancel</button>
     </div>
   </div>
 </div>`);
}

function saveDocEdit(i){
 docs[i].name=document.getElementById('editName').value.trim()||docs[i].name;
 docs[i].category=document.getElementById('editCategory').value;
 docs[i].type=document.getElementById('editType').value;
 saveDocs();
 closeEdit();
 renderDocTable();
}

function closeEdit(){
 document.getElementById('editModal')?.remove();
}

function login(){
 if(document.getElementById('pass').value==='admin123'){
   admin=true;localStorage.setItem('pp360admin','1');
   document.getElementById('scope').textContent='Authorized demo mode: document manager enabled.';
   adminPage();
 } else alert('Incorrect demo password');
}
function logout(){admin=false;localStorage.removeItem('pp360admin');document.getElementById('scope').textContent='Public mode: built-in general engineering knowledge. Plant files require authorization.';show('Home')}
function del(i){
 if(confirm('Delete this file entry from the Lite app?')){
   docs.splice(i,1);
   saveDocs();
   renderDocTable();
 }
}
function calcPower(){let p=Math.sqrt(3)*(+volt.value)*(+amp.value)*(+pf.value)/1000;document.getElementById('calc').innerHTML=`<b>Power = ${isFinite(p)?p.toFixed(2):0} kW</b>`}

document.getElementById('q').addEventListener('keydown',e=>{if(e.key==='Enter')searchAll()});
document.getElementById('theme').onclick=()=>document.body.classList.toggle('dark');
// Service worker disabled in local-test build. It will be enabled after HTTPS deployment.
renderTabs();show('Home');
