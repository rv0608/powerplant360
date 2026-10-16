const GROUPS=["Operation","Mechanical","Electrical","DM Plant","C&I","Fire & Safety"];
const CALCS=[{"g":"Operation","id":"boilerEffPT","t":"Boiler Efficiency — from P & T","f":"Direct method: η = steam flow × (hsteam − hfeedwater) ÷ (coal flow × GCV) × 100","fn":"boilerEffPT","check":"heatBalancePT","note":"Simplified direct-method gross estimate: excludes blowdown, spray-water and other heat/flow corrections. Gauge pressures use standard atmosphere 1.01325 bar. Not for acceptance tests.","fields":[{"k":"pms","l":"Main steam pressure","u":"kg/cm²(g)","positive":true},{"k":"tms","l":"Main steam temperature","u":"°C","positive":true},{"k":"pfw","l":"Feedwater pressure","u":"kg/cm²(g)","positive":true},{"k":"tfw","l":"Feedwater temperature","u":"°C","positive":true},{"k":"steam","l":"Main steam flow","u":"TPH","positive":true},{"k":"fuel","l":"Coal consumption","u":"TPH","positive":true},{"k":"gcv","l":"Coal GCV","u":"kcal/kg","positive":true}]},{"g":"Operation","id":"turbineHeatRatePT","t":"Turbine Heat Rate — from P & T","f":"Simplified non-reheat cycle: THR = steam flow × (hsteam − hfeedwater) ÷ generator MW","fn":"turbineHeatRatePT","check":"heatBalancePT","note":"Simplified steam-cycle heat-rate estimate only. Requires flow-balance corrections for extractions, spray, reheat, drains or other cross-boundary flows. Not a guaranteed performance-test result.","fields":[{"k":"pms","l":"Main steam pressure","u":"kg/cm²(g)","positive":true},{"k":"tms","l":"Main steam temperature","u":"°C","positive":true},{"k":"pfw","l":"Feedwater pressure","u":"kg/cm²(g)","positive":true},{"k":"tfw","l":"Feedwater temperature","u":"°C","positive":true},{"k":"steam","l":"Main steam flow","u":"TPH","positive":true},{"k":"mw","l":"Generator load","u":"MW","positive":true}]},{"g":"Operation","id":"phr","t":"Plant Heat Rate","f":"PHR (kcal/kWh) = Coal flow (TPH) × GCV (kcal/kg) ÷ Gross load (MW)","fn":"phr","fields":[{"k":"coal","l":"Coal flow","u":"TPH","positive":true},{"k":"gcv","l":"Coal GCV","u":"kcal/kg","positive":true},{"k":"mw","l":"Gross load","u":"MW","positive":true}]},{"g":"Operation","id":"scc","t":"Specific Coal Consumption","f":"SCC (kg/kWh) = Coal flow (TPH) ÷ Gross load (MW)","fn":"scc","fields":[{"k":"coal","l":"Coal flow","u":"TPH","positive":true},{"k":"mw","l":"Gross load","u":"MW","positive":true}]},{"g":"Operation","id":"plf","t":"Plant Load Factor","f":"PLF (%) = Generation (MWh) ÷ [Capacity (MW) × Period (h)] × 100","fn":"plf","fields":[{"k":"gen","l":"Generation","u":"MWh","positive":true},{"k":"cap","l":"Installed capacity","u":"MW","positive":true},{"k":"hours","l":"Period","u":"h","positive":true}]},{"g":"Operation","id":"aux","t":"Auxiliary Power Consumption","f":"Auxiliary (%) = (Gross MW − Net MW) ÷ Gross MW × 100","fn":"aux","check":"netGross","fields":[{"k":"gross","l":"Gross generation","u":"MW","positive":true},{"k":"net","l":"Net export","u":"MW","min":0}]},{"g":"Operation","id":"evapRatio","t":"Boiler Evaporation Ratio","f":"Evaporation ratio = Steam flow (TPH) ÷ Fuel flow (TPH)","fn":"evapRatio","fields":[{"k":"steam","l":"Steam flow","u":"TPH","positive":true},{"k":"fuel","l":"Fuel flow","u":"TPH","positive":true}]},{"g":"Operation","id":"ssc","t":"Specific Steam Consumption","f":"SSC (kg/kWh) = Steam flow (TPH) ÷ Generator load (MW)","fn":"ssc","fields":[{"k":"steam","l":"Steam flow","u":"TPH","positive":true},{"k":"mw","l":"Generator load","u":"MW","positive":true}]},{"g":"Operation","id":"excessAir","t":"Excess Air from Flue-Gas O₂","f":"Approx. excess air (%) = O₂ ÷ (21 − O₂) × 100","fn":"excessAir","note":"Approximation for dry flue gas and complete combustion; use the approved test method for formal performance testing.","fields":[{"k":"o2","l":"Dry flue-gas O₂","u":"%","min":0,"max":20.9}]},{"g":"Operation","id":"ashGen","t":"Ash Generation","f":"Ash generation (TPH) = Coal flow (TPH) × Ash (%) ÷ 100","fn":"ashGen","fields":[{"k":"coal","l":"Coal flow","u":"TPH","positive":true},{"k":"ash","l":"Coal ash","u":"%","min":0,"max":100}]},{"g":"Operation","id":"blendGcv","t":"Coal Blend GCV","f":"Blend GCV = (Q₁×GCV₁ + Q₂×GCV₂) ÷ (Q₁+Q₂)","fn":"blendGcv","fields":[{"k":"q1","l":"Coal-1 quantity","u":"t","positive":true},{"k":"g1","l":"Coal-1 GCV","u":"kcal/kg","positive":true},{"k":"q2","l":"Coal-2 quantity","u":"t","positive":true},{"k":"g2","l":"Coal-2 GCV","u":"kcal/kg","positive":true}]},{"g":"Operation","id":"turbEff","t":"Turbine Isentropic Efficiency — P & T","f":"η = (h₁ − h₂ actual) ÷ (h₁ − h₂ isentropic) × 100; h₂s is calculated from inlet entropy and exhaust pressure.","fn":"turbEffPT","check":"turbEffPT","fields":[{"k":"pin","l":"Inlet steam pressure","u":"kg/cm²(g)","min":0},{"k":"tin","l":"Inlet steam temperature","u":"°C","min":0,"max":2000},{"k":"pout","l":"Actual exhaust pressure","u":"kg/cm²(a)","positive":true},{"k":"tout","l":"Actual exhaust temperature","u":"°C","min":0,"max":2000}],"note":"For actual wet exhaust steam, pressure and temperature alone cannot determine enthalpy; use measured dryness fraction or a verified heat balance. This calculator rejects saturated states."},{"g":"Operation","id":"safetyValveBlowdown","t":"Safety Valve Blowdown","f":"Blowdown (%) = (Set pressure − Reseating pressure) ÷ Set pressure × 100","fn":"safetyValveBlowdown","check":"safetyValvePressures","note":"Use the approved OEM/code test procedure for actual safety-valve setting and acceptance. This calculator only computes blowdown from measured pressures.","fields":[{"k":"setp","l":"Set pressure","u":"bar(g)","positive":true},{"k":"reseat","l":"Reseating pressure","u":"bar(g)","positive":true}]},{"g":"Operation","id":"steamWaterEnthalpy","t":"Steam / Water Enthalpy (P–T)","f":"IAPWS-IF97: specific enthalpy from pressure (kg/cm² absolute) and temperature","fn":"steamWaterEnthalpy","check":"steamTableRange","note":"Pressure entered is absolute kg/cm²(a). At saturation, P and T alone do not define mixture enthalpy; hf and hg are shown instead.","fields":[{"k":"pkg","l":"Absolute pressure","u":"kg/cm²(a)","positive":true,"max":1019.716},{"k":"temp","l":"Temperature","u":"°C","min":0,"max":2000}]},{"g":"Mechanical","id":"pumpPower","t":"Pump Shaft Power","f":"P (kW) = ρ × 9.81 × Q(m³/h) × Head(m) ÷ [3,600,000 × η]","fn":"pumpPower","fields":[{"k":"rho","l":"Liquid density","u":"kg/m³","positive":true},{"k":"flow","l":"Flow","u":"m³/h","positive":true},{"k":"head","l":"Total head","u":"m","positive":true},{"k":"eff","l":"Pump efficiency","u":"%","positive":true,"max":100}]},{"g":"Mechanical","id":"fanPower","t":"Fan / Blower Shaft Power","f":"P (kW) = Flow (m³/s) × ΔP (Pa) ÷ [1000 × η]","fn":"fanPower","fields":[{"k":"flow","l":"Air flow","u":"m³/s","positive":true},{"k":"dp","l":"Pressure rise","u":"Pa","positive":true},{"k":"eff","l":"Fan efficiency","u":"%","positive":true,"max":100}]},{"g":"Mechanical","id":"pipeVelocity","t":"Pipe Flow Velocity","f":"Velocity (m/s) = Q(m³/h) ÷ 3600 ÷ [πD²/4]","fn":"pipeVelocity","fields":[{"k":"flow","l":"Flow","u":"m³/h","positive":true},{"k":"dia","l":"Internal diameter","u":"mm","positive":true}]},{"g":"Mechanical","id":"tankVol","t":"Cylindrical Tank Volume","f":"Volume (m³) = π × D² ÷ 4 × Liquid height","fn":"tankVol","fields":[{"k":"dia","l":"Tank diameter","u":"m","positive":true},{"k":"h","l":"Liquid height","u":"m","positive":true}]},{"g":"Mechanical","id":"beltCapacity","t":"Belt Conveyor Capacity","f":"Capacity (TPH) = 3.6 × Loaded area × Belt speed × Bulk density × Fill factor","fn":"beltCapacity","fields":[{"k":"area","l":"Loaded cross-section","u":"m²","positive":true},{"k":"speed","l":"Belt speed","u":"m/s","positive":true},{"k":"rho","l":"Bulk density","u":"kg/m³","positive":true},{"k":"fill","l":"Fill factor","u":"decimal","positive":true,"max":1}]},{"g":"Mechanical","id":"conveyorLift","t":"Conveyor Vertical Lift Power","f":"Ideal lift power (kW) = TPH × 9.81 × Lift(m) ÷ [3600 × η]","fn":"conveyorLift","note":"Elevation power only; actual conveyor power also includes friction, belt and idler losses.","fields":[{"k":"tph","l":"Material flow","u":"TPH","positive":true},{"k":"lift","l":"Vertical lift","u":"m","positive":true},{"k":"eff","l":"Drive efficiency","u":"%","positive":true,"max":100}]},{"g":"Mechanical","id":"waterDuty","t":"Water Heat Duty","f":"Heat duty (kW) ≈ Flow (m³/h) × 4.186 × ΔT ÷ 3.6","fn":"waterDuty","fields":[{"k":"flow","l":"Water flow","u":"m³/h","positive":true},{"k":"dt","l":"Temperature change","u":"°C","positive":true}]},{"g":"Mechanical","id":"affinity","t":"Pump / Fan Affinity Laws","f":"Q₂=Q₁(N₂/N₁); H₂=H₁(N₂/N₁)²; P₂=P₁(N₂/N₁)³","fn":"affinity","fields":[{"k":"q1","l":"Original flow","u":"m³/h","positive":true},{"k":"h1","l":"Original head / pressure","u":"same unit","positive":true},{"k":"p1","l":"Original power","u":"kW","positive":true},{"k":"n1","l":"Original speed","u":"rpm","positive":true},{"k":"n2","l":"New speed","u":"rpm","positive":true}]},{"g":"Mechanical","id":"accAbs","t":"ACC Vacuum → Absolute Pressure","f":"Pabs (kPa) = Atmospheric pressure (kPa) − Vacuum (mmHg) × 0.133322","fn":"accAbs","check":"vacuum","fields":[{"k":"patm","l":"Atmospheric pressure","u":"kPa","positive":true},{"k":"vac","l":"Vacuum","u":"mmHg","min":0}]},{"g":"Mechanical","id":"ctPerf","t":"Cooling Tower Range / Approach / Efficiency","f":"Range=Hot−Cold; Approach=Cold−Wet bulb; Efficiency=Range÷(Hot−Wet bulb)×100","fn":"ctPerf","check":"ctTemps","fields":[{"k":"hot","l":"Hot-water temperature","u":"°C"},{"k":"cold","l":"Cold-water temperature","u":"°C"},{"k":"wb","l":"Wet-bulb temperature","u":"°C"}]},{"g":"Electrical","id":"threePhaseKw","t":"3-Phase Active Power","f":"P (kW) = √3 × V × I × PF ÷ 1000","fn":"threePhaseKw","fields":[{"k":"v","l":"Line voltage","u":"V","positive":true},{"k":"i","l":"Line current","u":"A","positive":true},{"k":"pf","l":"Power factor","u":"","positive":true,"max":1}]},{"g":"Electrical","id":"motorOutput","t":"Motor Shaft Output","f":"Output (kW) = √3 × V × I × PF × η ÷ 1000","fn":"motorOutput","fields":[{"k":"v","l":"Line voltage","u":"V","positive":true},{"k":"i","l":"Line current","u":"A","positive":true},{"k":"pf","l":"Power factor","u":"","positive":true,"max":1},{"k":"eff","l":"Motor efficiency","u":"%","positive":true,"max":100}]},{"g":"Electrical","id":"motorCurrent","t":"3-Phase Motor Current","f":"I (A) = Shaft kW × 1000 ÷ (√3 × V × PF × η)","fn":"motorCurrent","fields":[{"k":"kw","l":"Shaft load","u":"kW","positive":true},{"k":"v","l":"Voltage","u":"V","positive":true},{"k":"pf","l":"Power factor","u":"","positive":true,"max":1},{"k":"eff","l":"Efficiency","u":"%","positive":true,"max":100}]},{"g":"Electrical","id":"xfmrCurrent","t":"Transformer Full-Load Current","f":"I (A) = kVA × 1000 ÷ (√3 × Line voltage)","fn":"xfmrCurrent","fields":[{"k":"kva","l":"Transformer rating","u":"kVA","positive":true},{"k":"v","l":"Line voltage","u":"V","positive":true}]},{"g":"Electrical","id":"pfCorrection","t":"Power Factor Correction","f":"Required kVAr = kW × [tan(cos⁻¹ PF₁) − tan(cos⁻¹ PF₂)]","fn":"pfCorrection","check":"pfTarget","fields":[{"k":"kw","l":"Active load","u":"kW","positive":true},{"k":"pf1","l":"Present PF","u":"","positive":true,"max":1},{"k":"pf2","l":"Target PF","u":"","positive":true,"max":1}]},{"g":"Electrical","id":"vUnbalance","t":"Voltage Unbalance","f":"Unbalance (%) = Maximum phase-voltage deviation from average ÷ Average × 100","fn":"vUnbalance","fields":[{"k":"v1","l":"Voltage-1","u":"V","positive":true},{"k":"v2","l":"Voltage-2","u":"V","positive":true},{"k":"v3","l":"Voltage-3","u":"V","positive":true}]},{"g":"DM Plant","id":"roRecovery","t":"RO Recovery","f":"Recovery (%) = Permeate flow ÷ Feed flow × 100","fn":"roRecovery","check":"roFlow","fields":[{"k":"perm","l":"Permeate flow","u":"m³/h","min":0},{"k":"feed","l":"Feed flow","u":"m³/h","positive":true}]},{"g":"DM Plant","id":"roRejection","t":"RO Salt Rejection","f":"Rejection (%) = (Feed TDS − Permeate TDS) ÷ Feed TDS × 100","fn":"roRejection","check":"roTds","fields":[{"k":"feed","l":"Feed TDS","u":"mg/L","positive":true},{"k":"perm","l":"Permeate TDS","u":"mg/L","min":0}]},{"g":"DM Plant","id":"chemDose","t":"Chemical Consumption","f":"Chemical (kg/day) = Flow (m³/h) × Dose (mg/L) × 24 ÷ 1000","fn":"chemDose","fields":[{"k":"flow","l":"Water flow","u":"m³/h","positive":true},{"k":"dose","l":"Dose","u":"mg/L","positive":true}]},{"g":"DM Plant","id":"retention","t":"Tank Retention Time","f":"Retention time (h) = Usable volume (m³) ÷ Flow (m³/h)","fn":"retention","fields":[{"k":"vol","l":"Usable volume","u":"m³","positive":true},{"k":"flow","l":"Flow","u":"m³/h","positive":true}]},{"g":"DM Plant","id":"filterRate","t":"Filter Loading Rate","f":"Loading rate = Flow (m³/h) ÷ Filter area (m²)","fn":"filterRate","fields":[{"k":"flow","l":"Flow","u":"m³/h","positive":true},{"k":"area","l":"Filter area","u":"m²","positive":true}]},{"g":"DM Plant","id":"softenerCapacity","t":"Softener / DM Run Capacity","f":"Treated volume (m³) = Usable exchange capacity (kg as CaCO₃) × 1000 ÷ Hardness (mg/L as CaCO₃)","fn":"softenerCapacity","fields":[{"k":"cap","l":"Usable exchange capacity","u":"kg as CaCO₃","positive":true},{"k":"hard","l":"Feed hardness","u":"mg/L as CaCO₃","positive":true}]},{"g":"C&I","id":"maPv","t":"4–20 mA → Process Value","f":"PV = LRV + [(mA − 4) ÷ 16] × (URV − LRV)","fn":"maPv","check":"range","fields":[{"k":"ma","l":"Signal","u":"mA","min":0,"max":24},{"k":"lrv","l":"Lower range value","u":""},{"k":"urv","l":"Upper range value","u":""}]},{"g":"C&I","id":"pvMa","t":"Process Value → 4–20 mA","f":"mA = 4 + 16 × (PV − LRV) ÷ (URV − LRV)","fn":"pvMa","check":"range","fields":[{"k":"pv","l":"Process value","u":""},{"k":"lrv","l":"Lower range value","u":""},{"k":"urv","l":"Upper range value","u":""}]},{"g":"C&I","id":"dpFlow","t":"DP Transmitter → Flow %","f":"Flow (%) = √(Measured DP ÷ DP span) × 100","fn":"dpFlow","check":"dpSpan","fields":[{"k":"dp","l":"Measured DP","u":"engineering units","min":0},{"k":"span","l":"DP span","u":"same units","positive":true}]},{"g":"C&I","id":"pt100","t":"Pt100 Temperature — Approximation","f":"T (°C) ≈ (R/100 − 1) ÷ 0.00385","fn":"pt100","note":"Linear approximation. Use IEC 60751 / Callendar–Van Dusen for precision calibration work.","fields":[{"k":"r","l":"Measured resistance","u":"Ω","positive":true}]},{"g":"C&I","id":"spanPct","t":"Transmitter Span Percentage","f":"Span (%) = (PV − LRV) ÷ (URV − LRV) × 100","fn":"spanPct","check":"range","fields":[{"k":"pv","l":"Process value","u":""},{"k":"lrv","l":"Lower range value","u":""},{"k":"urv","l":"Upper range value","u":""}]},{"g":"Fire & Safety","id":"fireAutonomy","t":"Fire-Water Tank Autonomy","f":"Autonomy (h) = Usable fire-water volume (m³) ÷ Total demand (m³/h)","fn":"fireAutonomy","fields":[{"k":"vol","l":"Usable volume","u":"m³","positive":true},{"k":"demand","l":"Total demand","u":"m³/h","positive":true}]},{"g":"Fire & Safety","id":"firePump","t":"Fire Pump Shaft Power","f":"Shaft power (kW) = 9.81 × Flow(m³/h) × Head(m) ÷ [3600 × η]","fn":"firePump","fields":[{"k":"flow","l":"Pump flow","u":"m³/h","positive":true},{"k":"head","l":"Total head","u":"m","positive":true},{"k":"eff","l":"Pump efficiency","u":"%","positive":true,"max":100}]},{"g":"Fire & Safety","id":"hydrantFlow","t":"Total Hydrant / Monitor Flow","f":"Total flow (m³/h) = Number × Flow each (L/min) × 60 ÷ 1000","fn":"hydrantFlow","fields":[{"k":"n","l":"Number in service","u":"nos.","positive":true},{"k":"each","l":"Flow each","u":"L/min","positive":true}]},{"g":"Fire & Safety","id":"tankFill","t":"Fire-Water Tank Fill Time","f":"Fill time (h) = Refill volume (m³) ÷ Net inflow (m³/h)","fn":"tankFill","fields":[{"k":"vol","l":"Refill volume","u":"m³","positive":true},{"k":"flow","l":"Net inflow","u":"m³/h","positive":true}]}];
const CONVERTERS={"Pressure":{"bar":100000,"kPa":1000,"MPa":1000000,"kg/cm²":98066.5,"psi":6894.757293,"mmHg":133.322368,"mmWC":9.80665},"Flow":{"m³/h":1,"L/s":3.6,"L/min":0.06,"US gpm":0.227124707},"Power":{"kW":1,"MW":1000,"HP":0.745699872},"Energy":{"kWh":1,"MWh":1000,"GJ":277.7777778,"MJ":0.2777777778,"kcal":0.0011622222},"Mass Flow":{"kg/h":1,"TPH":1000,"kg/s":3600,"lb/h":0.45359237},"Length":{"m":1,"mm":0.001,"cm":0.01,"ft":0.3048,"in":0.0254},"Volume":{"m³":1,"L":0.001,"kL":1,"ft³":0.0283168466,"US gal":0.0037854118},"Specific Energy":{"kJ/kg":1,"MJ/kg":1000,"kcal/kg":4.1868,"Btu/lb":2.326}};

(function(){
  function esc(v){
    return String(v == null ? '' : v).replace(/[&<>"']/g,function(ch){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
    });
  }

  function fmt(n){
    if(!Number.isFinite(n)) return '—';
    var a=Math.abs(n);
    if(a!==0 && (a>=1000000 || a<0.001)) return n.toExponential(4);
    var d=a>=1000?2:(a>=10?3:4);
    return Number(n.toFixed(d)).toLocaleString(undefined,{maximumFractionDigits:4});
  }

  function enthalpyPTGauge(gaugeKgCm2,tempC){
    if(typeof xsteam2==='undefined' || !xsteam2 || typeof xsteam2.h_pT!=='function') throw new Error('IF97 steam-table engine unavailable.');
    var pMPa=gaugeKgCm2*0.0980665+0.101325;
    var kelvin=tempC+273.15;
    var sat=(pMPa<22.064 && typeof xsteam2.Tsat_p==='function') ? xsteam2.Tsat_p(pMPa) : NaN;
    if(Number.isFinite(sat) && Math.abs(kelvin-sat)<0.05) throw new Error('At saturation specify steam quality; P and T alone are insufficient.');
    var h=xsteam2.h_pT(pMPa,kelvin);
    if(!Number.isFinite(h)) throw new Error('Pressure / temperature outside the IF97 calculation region.');
    return h;
  }

  function calcValue(fn,v){
    switch(fn){
      case 'phr': return [['Plant Heat Rate',v.coal*v.gcv/v.mw,'kcal/kWh']];
      case 'scc': return [['SCC',v.coal/v.mw,'kg/kWh']];
      case 'plf': return [['PLF',v.gen/(v.cap*v.hours)*100,'%']];
      case 'aux': return [['Auxiliary Consumption',(v.gross-v.net)/v.gross*100,'%']];
      case 'boilerEffPT':
      case 'turbineHeatRatePT':
        var hs=enthalpyPTGauge(v.pms,v.tms);
        var hf=enthalpyPTGauge(v.pfw,v.tfw);
        if(!(hs>hf)) throw new Error('Main steam enthalpy must exceed feedwater enthalpy.');
        var output=[['Main Steam Enthalpy',hs,'kJ/kg'],['Feedwater Enthalpy',hf,'kJ/kg'],['Enthalpy Difference',hs-hf,'kJ/kg']];
        if(fn==='boilerEffPT') output.push(['Estimated Boiler Efficiency',v.steam*(hs-hf)/(4.1868*v.fuel*v.gcv)*100,'%']);
        else {var thr=v.steam*(hs-hf)/v.mw;output.push(['Estimated Turbine Heat Rate',thr,'kJ/kWh']);output.push(['Estimated Turbine Heat Rate',thr/4.1868,'kcal/kWh']);}
        return output;
      case 'boilerEff': return [['Boiler Efficiency',v.steam*(v.hs-v.hfw)/(v.fuel*v.gcv)*100,'%']];
      case 'evapRatio': return [['Evaporation Ratio',v.steam/v.fuel,'kg steam/kg fuel']];
      case 'ssc': return [['SSC',v.steam/v.mw,'kg/kWh']];
      case 'excessAir': return [['Approx. Excess Air',v.o2/(21-v.o2)*100,'%']];
      case 'ashGen': return [['Ash Generation',v.coal*v.ash/100,'TPH']];
      case 'blendGcv': return [['Blended GCV',(v.q1*v.g1+v.q2*v.g2)/(v.q1+v.q2),'kcal/kg']];
      case 'turbEffPT':
        if(typeof xsteam2==='undefined' || !xsteam2 || typeof xsteam2.s_pT!=='function' || typeof xsteam2.h_ps!=='function') throw new Error('IF97 steam-table engine unavailable.');
        var p1=v.pin*0.0980665+0.101325, p2=v.pout*0.0980665;
        var t1=v.tin+273.15,t2=v.tout+273.15;
        var s1=xsteam2.s_pT(p1,t1);
        var h1=xsteam2.h_pT(p1,t1), h2=xsteam2.h_pT(p2,t2),h2s=xsteam2.h_ps(p2,s1);
        var ts1=p1<22.064?xsteam2.Tsat_p(p1):NaN,ts2=p2<22.064?xsteam2.Tsat_p(p2):NaN;
        if((Number.isFinite(ts1)&&Math.abs(t1-ts1)<0.05)||(Number.isFinite(ts2)&&Math.abs(t2-ts2)<0.05)) throw new Error('At saturation, P and T alone cannot define enthalpy. Provide steam quality or a verified heat balance.');
        if(![s1,h1,h2,h2s].every(Number.isFinite) || !(h1>h2s) || !(h1>h2)) throw new Error('Invalid turbine state or pressure/temperature combination.');
        return [['Inlet Enthalpy',h1,'kJ/kg'],['Actual Exhaust Enthalpy',h2,'kJ/kg'],['Isentropic Exhaust Enthalpy',h2s,'kJ/kg'],['Inlet Entropy',s1,'kJ/kg·K'],['Isentropic Efficiency',(h1-h2)/(h1-h2s)*100,'%']];
      case 'turbEff': return [['Isentropic Efficiency',(v.hin-v.hout)/(v.hin-v.his)*100,'%']];
      case 'safetyValveBlowdown':
        return [
          ['Blowdown',(v.setp-v.reseat)/v.setp*100,'%'],
          ['Pressure Drop',v.setp-v.reseat,'bar']
        ];
      case 'turbineHeatRate':
        var thr=v.steam*(v.hms-v.hfw)/v.mw;
        return [
          ['Turbine Heat Rate',thr,'kcal/kWh'],
          ['Turbine Heat Rate',thr*4.1868,'kJ/kWh']
        ];

      case 'pumpPower': return [['Pump Shaft Power',v.rho*9.81*v.flow*v.head/(3600000*(v.eff/100)),'kW']];
      case 'fanPower': return [['Fan Shaft Power',v.flow*v.dp/(1000*(v.eff/100)),'kW']];
      case 'pipeVelocity':
        var d=v.dia/1000;
        return [['Velocity',(v.flow/3600)/(Math.PI*d*d/4),'m/s']];
      case 'tankVol':
        var vol=Math.PI*v.dia*v.dia/4*v.h;
        return [['Tank Volume',vol,'m³'],['Equivalent Water',vol*1000,'litres']];
      case 'beltCapacity': return [['Conveyor Capacity',3.6*v.area*v.speed*v.rho*v.fill,'TPH']];
      case 'conveyorLift': return [['Lift Power',v.tph*9.81*v.lift/(3600*(v.eff/100)),'kW']];
      case 'waterDuty': return [['Heat Duty',v.flow*4.186*v.dt/3.6,'kW']];
      case 'affinity':
        var r=v.n2/v.n1;
        return [['New Flow',v.q1*r,'m³/h'],['New Head / Pressure',v.h1*r*r,'same unit'],['New Power',v.p1*r*r*r,'kW']];
      case 'accAbs': return [['Absolute Pressure',v.patm-v.vac*0.133322,'kPa(a)']];
      case 'ctPerf':
        return [['Range',v.hot-v.cold,'°C'],['Approach',v.cold-v.wb,'°C'],['Cooling Tower Efficiency',(v.hot-v.cold)/(v.hot-v.wb)*100,'%']];

      case 'threePhaseKw': return [['Active Power',Math.sqrt(3)*v.v*v.i*v.pf/1000,'kW']];
      case 'motorOutput': return [['Motor Shaft Output',Math.sqrt(3)*v.v*v.i*v.pf*(v.eff/100)/1000,'kW']];
      case 'motorCurrent': return [['Estimated Current',v.kw*1000/(Math.sqrt(3)*v.v*v.pf*(v.eff/100)),'A']];
      case 'xfmrCurrent': return [['Full-Load Current',v.kva*1000/(Math.sqrt(3)*v.v),'A']];
      case 'pfCorrection': return [['Required Capacitor',v.kw*(Math.tan(Math.acos(v.pf1))-Math.tan(Math.acos(v.pf2))),'kVAr']];
      case 'vUnbalance':
        var avg=(v.v1+v.v2+v.v3)/3;
        var dev=Math.max(Math.abs(v.v1-avg),Math.abs(v.v2-avg),Math.abs(v.v3-avg));
        return [['Voltage Unbalance',dev/avg*100,'%']];

      case 'roRecovery': return [['RO Recovery',v.perm/v.feed*100,'%']];
      case 'roRejection': return [['Salt Rejection',(v.feed-v.perm)/v.feed*100,'%']];
      case 'chemDose': return [['Chemical Consumption',v.flow*v.dose*24/1000,'kg/day']];
      case 'retention': return [['Retention Time',v.vol/v.flow,'hours']];
      case 'filterRate': return [['Filter Loading',v.flow/v.area,'m³/m²·h']];
      case 'softenerCapacity': return [['Estimated Treated Volume',v.cap*1000/v.hard,'m³']];

      case 'maPv': return [['Process Value',v.lrv+(v.ma-4)/16*(v.urv-v.lrv),'']];
      case 'pvMa': return [['Transmitter Signal',4+16*(v.pv-v.lrv)/(v.urv-v.lrv),'mA']];
      case 'dpFlow': return [['Flow',Math.sqrt(v.dp/v.span)*100,'% of range']];
      case 'pt100': return [['Approx. Temperature',(v.r/100-1)/0.00385,'°C']];
      case 'spanPct': return [['Span',(v.pv-v.lrv)/(v.urv-v.lrv)*100,'%']];

      case 'fireAutonomy': return [['Autonomy',v.vol/v.demand,'hours'],['Autonomy',v.vol/v.demand*60,'minutes']];
      case 'firePump': return [['Estimated Shaft Power',9.81*v.flow*v.head/(3600*(v.eff/100)),'kW']];
      case 'hydrantFlow': return [['Total Flow',v.n*v.each*60/1000,'m³/h']];
      case 'tankFill': return [['Fill Time',v.vol/v.flow,'hours']];
    }
    return [];
  }

  function checkCalc(c,v){
    switch(c.check){
      case 'netGross': return v.net<=v.gross ? '' : 'Net export cannot be greater than gross generation.';
      case 'steamEnthalpy': return v.hs>v.hfw ? '' : 'Steam enthalpy must be greater than feedwater enthalpy.';
      case 'turbEffPT':
        if(v.pin<0 || v.pout<=0 || v.pout>=v.pin+1.033227) return 'Exhaust absolute pressure must be below inlet absolute pressure.';
        return '';
      case 'turbEnthalpy': return (v.hin>v.hout && v.hin>v.his) ? '' : 'Inlet enthalpy must be greater than both exhaust enthalpies.';
      case 'safetyValvePressures': return v.reseat<v.setp ? '' : 'Reseating pressure must be lower than set pressure.';
      case 'turbineHeatRateInputs': return v.hms>v.hfw ? '' : 'Main steam enthalpy must be greater than feedwater enthalpy.';
      case 'heatBalancePT':
        if(v.pms<0 || v.pfw<0) return 'Gauge pressure must not be negative for these operating calculations.';
        if(v.tms<0 || v.tfw<0 || v.tms>2000 || v.tfw>2000) return 'Temperatures must be between 0 and 2000 °C.';
        if(v.pms*0.0980665+0.101325>100 || v.pfw*0.0980665+0.101325>100) return 'Pressure exceeds supported 100 MPa IF97 limit.';
        return '';
      case 'steamTableRange':
        if(v.pkg<=0 || v.pkg*0.0980665>100) return 'Pressure must be within the IF97 range (max 100 MPa).';
        if(v.temp<0 || v.temp>2000) return 'Temperature must be between 0 and 2000 °C.';
        return '';
      case 'vacuum': return (v.patm-v.vac*0.133322)>0 ? '' : 'Vacuum entered is greater than the available atmospheric pressure.';
      case 'ctTemps': return (v.hot>v.cold && v.cold>=v.wb) ? '' : 'Expected relationship: Hot water > Cold water ≥ Wet-bulb temperature.';
      case 'pfTarget': return v.pf2>v.pf1 ? '' : 'Target power factor should be greater than present power factor.';
      case 'roFlow': return v.perm<=v.feed ? '' : 'Permeate flow cannot exceed feed flow.';
      case 'roTds': return v.perm<=v.feed ? '' : 'Permeate TDS cannot exceed feed TDS for this calculation.';
      case 'range': return v.urv!==v.lrv ? '' : 'Upper and lower range values must be different.';
      case 'dpSpan': return v.dp<=v.span ? '' : 'Measured DP should not exceed the entered DP span.';
      default: return '';
    }
  }

  const FAVORITES_KEY='pp360_calc_favorites';

  function getFavorites(){
    try{
      var raw=JSON.parse(localStorage.getItem(FAVORITES_KEY)||'[]');
      return Array.isArray(raw) ? raw.filter(function(id){return CALCS.some(function(c){return c.id===id;});}) : [];
    }catch(_){
      return [];
    }
  }

  function saveFavorites(ids){
    try{ localStorage.setItem(FAVORITES_KEY,JSON.stringify(ids)); }catch(_){}
  }

  function isFavorite(id){
    return getFavorites().indexOf(id)>=0;
  }

  function toggleFavorite(id){
    var ids=getFavorites();
    var i=ids.indexOf(id);
    if(i>=0) ids.splice(i,1); else ids.push(id);
    saveFavorites(ids);

    var active=document.querySelector('[data-calc-group].active');
    var group=active ? active.getAttribute('data-calc-group') : '';
    if(group==='__favorites__'){
      showGroup('__favorites__',active);
    }else{
      document.querySelectorAll('[data-favorite-calc="'+id+'"]').forEach(function(btn){
        var fav=isFavorite(id);
        btn.classList.toggle('active',fav);
        btn.textContent=fav?'★':'☆';
        btn.setAttribute('aria-label',fav?'Remove from favorites':'Add to favorites');
        btn.title=fav?'Remove from favorites':'Add to favorites';
      });
      updateFavoriteCount();
    }
  }

  function updateFavoriteCount(){
    var btn=document.querySelector('[data-calc-group="__favorites__"]');
    if(btn){
      var count=getFavorites().length;
      btn.textContent='★ Favorites'+(count?' ('+count+')':'');
    }
  }

  function cardHtml(c){
    var fields=c.fields.map(function(f){
      var unit=f.u ? ' <small>('+esc(f.u)+')</small>' : '';
      var min=f.min!=null ? ' min="'+f.min+'"' : '';
      var max=f.max!=null ? ' max="'+f.max+'"' : '';
      return '<label><span>'+esc(f.l)+unit+'</span><input type="number" step="any" inputmode="decimal" data-key="'+esc(f.k)+'"'+min+max+' placeholder="Value"></label>';
    }).join('');

    var fav=isFavorite(c.id);
    return '<div class="power-calc-card" data-calc-id="'+esc(c.id)+'">'+
      '<div class="power-calc-card-head"><h4>'+esc(c.t)+'</h4>'+
      '<button type="button" class="calc-favorite-btn '+(fav?'active':'')+'" data-favorite-calc="'+esc(c.id)+'" aria-label="'+(fav?'Remove from favorites':'Add to favorites')+'" title="'+(fav?'Remove from favorites':'Add to favorites')+'">'+(fav?'★':'☆')+'</button></div>'+
      '<div class="power-calc-fields">'+fields+'</div>'+
      '<button class="primary calc-run-btn" type="button" data-run-calc="'+esc(c.id)+'">Calculate</button>'+
      '<div class="power-calc-result" aria-live="polite">Enter values and calculate.</div>'+
      '<div class="power-calc-formula">'+esc(c.f)+'</div>'+
      (c.note?'<div class="power-calc-note">'+esc(c.note)+'</div>':'')+
      '</div>';
  }

  window.renderEngineeringTools=function(){
    var view=document.getElementById('view');
    if(!view) return;

    var groupButtons='<button type="button" data-calc-group="__favorites__">★ Favorites</button>'+
      GROUPS.map(function(g,i){
        return '<button type="button" class="'+(i===0?'active':'')+'" data-calc-group="'+esc(g)+'">'+esc(g)+'</button>';
      }).join('');

    view.innerHTML=
      '<div class="card engineering-tools">'+
        '<div class="tools-head">'+
          '<div><h2>Power Plant Calculator & Converter</h2><p class="muted">Department-wise formulas for daily plant engineering work.</p></div>'+
          '<div class="tool-mode-tabs">'+
            '<button class="active" type="button" data-tool-mode="calc">Calculators</button>'+
            '<button type="button" data-tool-mode="convert">Unit Converter</button>'+
          '</div>'+
        '</div>'+
        '<div id="calculatorMode">'+
          '<div class="calc-search-row"><label for="calcSearch">Find a calculator</label><input id="calcSearch" type="search" placeholder="Search heat rate, pump, steam, electrical…" autocomplete="off" aria-controls="calcCards"><button type="button" id="calcSearchClear" aria-label="Clear calculator search">Clear</button></div>'+ 
          '<div class="calc-dept-buttons">'+groupButtons+'</div>'+
          '<div id="calcCards"></div>'+
        '</div>'+
        '<div id="converterMode" hidden>'+
          '<div class="converter-layout">'+
            '<div class="converter-card">'+
              '<label>Conversion type</label>'+
              '<select id="convType">'+
                '<option>Pressure</option><option>Temperature</option><option>Flow</option><option>Power</option><option>Energy</option><option>Mass Flow</option><option>Length</option><option>Volume</option><option>Specific Energy</option>'+
              '</select>'+
              '<label>Value</label><input id="convValue" type="number" step="any" inputmode="decimal" placeholder="Enter value">'+
              '<div class="converter-units">'+
                '<div><label>From</label><select id="convFrom"></select></div>'+
                '<div class="converter-arrow">→</div>'+
                '<div><label>To</label><select id="convTo"></select></div>'+
              '</div>'+
              '<button class="primary" type="button" id="convertBtn">Convert</button>'+
              '<div id="convResult" class="calc-result-box muted" aria-live="polite">Enter a value to convert.</div>'+
            '</div>'+
            '<div class="converter-note"><b>Plant unit conversions</b><p class="muted">Pressure • Temperature • Flow • Power • Energy • Mass flow • Length • Volume • GCV / specific energy</p><p class="muted small">For condenser vacuum, use Mechanical → ACC Vacuum because atmospheric pressure is included.</p></div>'+
          '</div>'+
        '</div>'+
        '<div class="engineering-calc-note">Engineering convenience calculations only. For performance guarantees, protection settings, statutory design, or acceptance tests, use the approved OEM/design standard and plant procedure.</div>'+
      '</div>';

    document.querySelectorAll('[data-tool-mode]').forEach(function(btn){
      btn.addEventListener('click',function(){
        var mode=btn.getAttribute('data-tool-mode');
        document.querySelectorAll('[data-tool-mode]').forEach(function(x){x.classList.toggle('active',x===btn);});
        document.getElementById('calculatorMode').hidden=mode!=='calc';
        document.getElementById('converterMode').hidden=mode!=='convert';
      });
    });

    document.querySelectorAll('[data-calc-group]').forEach(function(btn){
      btn.addEventListener('click',function(){
        var search=document.getElementById('calcSearch');if(search) search.value='';
        showGroup(btn.getAttribute('data-calc-group'),btn);
      });
    });

    var search=document.getElementById('calcSearch');
    search.addEventListener('input',function(){
      var q=search.value.trim();
      if(q)showGroup('__search__',null);
      else showGroup(GROUPS[0],document.querySelector('[data-calc-group="'+GROUPS[0]+'"]'));
    });
    document.getElementById('calcSearchClear').addEventListener('click',function(){
      search.value='';showGroup(GROUPS[0],document.querySelector('[data-calc-group="'+GROUPS[0]+'"]'));search.focus();
    });

    updateFavoriteCount();
    showGroup(GROUPS[0],document.querySelector('[data-calc-group="'+GROUPS[0]+'"]'));

    document.getElementById('convType').addEventListener('change',renderUnits);
    document.getElementById('convFrom').addEventListener('change',convert);
    document.getElementById('convTo').addEventListener('change',convert);
    document.getElementById('convValue').addEventListener('input',convert);
    document.getElementById('convertBtn').addEventListener('click',convert);
    renderUnits();
  };

  function showGroup(group,button){
    var calculatorMode=document.getElementById('calculatorMode');
    if(calculatorMode) calculatorMode.classList.remove('calc-detail-open');
    document.querySelectorAll('[data-calc-group]').forEach(function(x){x.classList.toggle('active',x===button);});
    var list;
    var title=group;
    if(group==='__search__'){
      var query=(document.getElementById('calcSearch')?.value||'').trim().toLowerCase();
      list=CALCS.filter(function(c){return (c.t+' '+c.g+' '+c.id).toLowerCase().includes(query);});
      title='Search Results';
    }else if(group==='__favorites__'){
      var favIds=getFavorites();
      list=favIds.map(function(id){return CALCS.find(function(c){return c.id===id;});}).filter(Boolean);
      title='Favorites';
    }else{
      list=CALCS.filter(function(c){return c.g===group;});
    }

    var wrap=document.getElementById('calcCards');
    if(!wrap) return;

    if(group==='__search__' && !list.length){
      wrap.innerHTML='<div class="calc-group-title"><h3>Search Results</h3><span>0 calculators</span></div><p class="muted" role="status">No matching calculators. Try another name or department.</p>';
      return;
    }

    if(group==='__favorites__' && !list.length){
      wrap.innerHTML='<div class="calc-group-title"><h3>Favorites</h3><span>0 calculators</span></div>'+
        '<div class="calc-favorites-empty"><b>No favorites yet.</b><p class="muted">Tap ☆ on any calculator to add it here for quick access.</p></div>';
      updateFavoriteCount();
      return;
    }

    // Start with a compact calculator picker; render the form only after selection.
    wrap.innerHTML='<div class="calc-group-title"><h3>'+esc(title)+'</h3><span>'+list.length+' calculators</span></div>'+
      '<div class="calc-picker-grid" aria-label="Choose a calculator">'+
        list.map(function(c){
          return '<button type="button" class="calc-picker-btn" data-open-calc="'+esc(c.id)+'" aria-expanded="false">'+
            '<span>'+esc(c.t)+'</span><span aria-hidden="true">›</span></button>';
        }).join('')+
      '</div><div id="calcDetail" class="calc-detail" hidden></div>';

    wrap.querySelectorAll('[data-open-calc]').forEach(function(btn){
      btn.addEventListener('click',function(){
        var id=btn.getAttribute('data-open-calc');
        var detail=wrap.querySelector('#calcDetail');
        var selected=list.find(function(c){return c.id===id;});
        if(!detail||!selected) return;
        if(!detail.hidden && detail.getAttribute('data-selected-calc')===id){
          if(calculatorMode) calculatorMode.classList.remove('calc-detail-open');
          detail.hidden=true;
          detail.innerHTML='';
          detail.removeAttribute('data-selected-calc');
          btn.setAttribute('aria-expanded','false');
          btn.classList.remove('active');
          return;
        }
        wrap.querySelectorAll('[data-open-calc]').forEach(function(b){
          b.classList.toggle('active',b===btn);
          b.setAttribute('aria-expanded',b===btn?'true':'false');
        });
        detail.innerHTML='<div class="calc-detail-toolbar"><button type="button" class="calc-close-btn">← All calculators</button></div>'+cardHtml(selected);
        detail.setAttribute('data-selected-calc',id);
        detail.hidden=false;
        if(calculatorMode) calculatorMode.classList.add('calc-detail-open');
        detail.querySelector('.calc-close-btn').addEventListener('click',function(){
          detail.hidden=true;
          detail.innerHTML='';
          detail.removeAttribute('data-selected-calc');
          if(calculatorMode) calculatorMode.classList.remove('calc-detail-open');
          btn.classList.remove('active');
          btn.setAttribute('aria-expanded','false');
          btn.focus();
        });
        detail.querySelector('[data-run-calc]').addEventListener('click',function(){runCalc(id);});
        detail.querySelector('[data-favorite-calc]').addEventListener('click',function(){toggleFavorite(id);});
        detail.scrollIntoView({behavior:'auto',block:'start'});
      });
    });
    updateFavoriteCount();
  }

  window.openEngineeringCalculator=function(id){
    var calc=CALCS.find(function(c){return c.id===id;});
    if(!calc) return false;
    var group=document.querySelectorAll('[data-calc-group]');
    var target=Array.from(group).find(function(b){return b.getAttribute('data-calc-group')===calc.g;});
    if(!target) return false;
    target.click();
    var picker=Array.from(document.querySelectorAll('[data-open-calc]')).find(function(b){return b.getAttribute('data-open-calc')===id;});
    if(!picker) return false;
    picker.click();return true;
  };

  function steamWaterResult(v){
    if(typeof xsteam2==='undefined' || !xsteam2 || typeof xsteam2.h_pT!=='function'){
      throw new Error('Steam-table engine is unavailable. Refresh the page and try again.');
    }

    var pMPa=v.pkg*0.0980665;
    var tK=v.temp+273.15;
    var h=xsteam2.h_pT(pMPa,tK);

    var tsK=xsteam2.Tsat_p(pMPa);
    var tsC=Number.isFinite(tsK) ? tsK-273.15 : NaN;
    var hf=xsteam2.hL_p(pMPa);
    var hg=xsteam2.hV_p(pMPa);
    var hfg=(Number.isFinite(hf)&&Number.isFinite(hg)) ? hg-hf : NaN;

    var nearSat=Number.isFinite(tsC) && Math.abs(v.temp-tsC)<0.05;
    var state='Single-phase water / steam';
    if(Number.isFinite(tsC)){
      if(nearSat) state='At saturation — mixture enthalpy depends on steam quality';
      else if(v.temp<tsC) state='Compressed / subcooled water';
      else state='Superheated steam';
    }else if(pMPa>=22.064){
      state='Supercritical / single-phase region';
    }

    var rows=[];
    if(Number.isFinite(h) && !nearSat){
      rows.push(['Specific Enthalpy',h,'kJ/kg']);
      rows.push(['Specific Enthalpy',h/4.1868,'kcal/kg']);
    }
    if(Number.isFinite(tsC)) rows.push(['Saturation Temperature',tsC,'°C']);
    if(Number.isFinite(hf)) rows.push(['Saturated Water Enthalpy hf',hf,'kJ/kg']);
    if(Number.isFinite(hfg)) rows.push(['Latent Heat hfg',hfg,'kJ/kg']);
    if(Number.isFinite(hg)) rows.push(['Saturated Steam Enthalpy hg',hg,'kJ/kg']);

    if(!rows.length) throw new Error('Entered pressure/temperature is outside the IF97 calculation range.');

    return {rows:rows,state:state,nearSat:nearSat};
  }

  function runCalc(id){
    var c=CALCS.find(function(x){return x.id===id;});
    var card=document.querySelector('.power-calc-card[data-calc-id="'+id+'"]');
    if(!c||!card) return;
    var out=card.querySelector('.power-calc-result');
    var v={};

    for(var i=0;i<c.fields.length;i++){
      var f=c.fields[i];
      var input=card.querySelector('[data-key="'+f.k+'"]');
      var raw=input ? input.value : '';
      var n=Number(raw);

      if(raw==='' || !Number.isFinite(n)){
        out.innerHTML='<span class="calc-error">Enter all required values.</span>';
        if(input) input.focus();
        return;
      }
      if(f.positive && n<=0){
        out.innerHTML='<span class="calc-error">'+esc(f.l)+' must be greater than 0.</span>';
        if(input) input.focus();
        return;
      }
      if(f.min!=null && n<f.min){
        out.innerHTML='<span class="calc-error">'+esc(f.l)+' must be at least '+f.min+'.</span>';
        if(input) input.focus();
        return;
      }
      if(f.max!=null && n>f.max){
        out.innerHTML='<span class="calc-error">'+esc(f.l)+' must not exceed '+f.max+'.</span>';
        if(input) input.focus();
        return;
      }
      v[f.k]=n;
    }

    var msg=checkCalc(c,v);
    if(msg){
      out.innerHTML='<span class="calc-error">'+esc(msg)+'</span>';
      return;
    }

    try{
      if(c.fn==='steamWaterEnthalpy'){
        var steamResult=steamWaterResult(v);
        out.innerHTML='<div class="steam-state-line">'+esc(steamResult.state)+'</div>'+
          steamResult.rows.map(function(r){
            return '<div class="calc-result-line"><span>'+esc(r[0])+'</span><strong>'+fmt(r[1])+(r[2]?' '+esc(r[2]):'')+'</strong></div>';
          }).join('')+
          (steamResult.nearSat?'<div class="power-calc-note">At saturation, enter steam quality/dryness fraction in a dedicated saturation calculation to obtain mixture enthalpy.</div>':'');
        return;
      }

      var rows=calcValue(c.fn,v);
      if(!rows.length || rows.some(function(r){return !Number.isFinite(r[1]);})) throw new Error('Invalid');
      out.innerHTML=rows.map(function(r){
        return '<div class="calc-result-line"><span>'+esc(r[0])+'</span><strong>'+fmt(r[1])+(r[2]?' '+esc(r[2]):'')+'</strong></div>';
      }).join('');
    }catch(err){
      out.innerHTML='<span class="calc-error">'+esc(err&&err.message ? err.message : 'Unable to calculate with these values.')+'</span>';
    }
  }

  function unitsFor(type){
    if(type==='Temperature') return ['°C','°F','K'];
    return Object.keys(CONVERTERS[type]||{});
  }

  function renderUnits(){
    var type=document.getElementById('convType').value;
    var units=unitsFor(type);
    var from=document.getElementById('convFrom');
    var to=document.getElementById('convTo');
    from.innerHTML=units.map(function(u,i){return '<option '+(i===0?'selected':'')+'>'+esc(u)+'</option>';}).join('');
    to.innerHTML=units.map(function(u,i){return '<option '+(i===1?'selected':'')+'>'+esc(u)+'</option>';}).join('');
    convert();
  }

  function toC(v,u){
    if(u==='°C') return v;
    if(u==='°F') return (v-32)*5/9;
    return v-273.15;
  }

  function fromC(v,u){
    if(u==='°C') return v;
    if(u==='°F') return v*9/5+32;
    return v+273.15;
  }

  function convert(){
    var type=document.getElementById('convType').value;
    var input=document.getElementById('convValue');
    var from=document.getElementById('convFrom').value;
    var to=document.getElementById('convTo').value;
    var out=document.getElementById('convResult');

    if(input.value===''){
      out.classList.add('muted');
      out.textContent='Enter a value to convert.';
      return;
    }

    var value=Number(input.value);
    if(!Number.isFinite(value)){
      out.textContent='Enter a valid number.';
      return;
    }

    var result;
    if(type==='Temperature'){
      var c=toC(value,from);
      if(c < -273.15){
        out.innerHTML='<span class="calc-error">Temperature cannot be below absolute zero.</span>';
        return;
      }
      result=fromC(c,to);
    }else{
      var map=CONVERTERS[type];
      result=value*map[from]/map[to];
    }

    out.classList.remove('muted');
    out.innerHTML=fmt(value)+' '+esc(from)+' = <strong>'+fmt(result)+' '+esc(to)+'</strong>';
  }
})();
