
(() => {
  const cfg = window.PP360_CONFIG || {};
  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  }
  let backendSession = null;
  let backendRole = null;

  function backendConfigured() {
    return cfg.supabaseUrl &&
      cfg.supabaseKey &&
      !String(cfg.supabaseKey).includes('PASTE_YOUR_');
  }

  function client() {
    if (!backendConfigured()) return null;
    if (!window.pp360Supabase) {
      window.pp360Supabase = supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
    }
    return window.pp360Supabase;
  }

  async function refreshBackendRole() {
    admin = false;
    backendRole = null;
    if (!backendSession || !client()) return;
    const { data, error } = await client()
      .from('user_roles')
      .select('role')
      .eq('user_id', backendSession.user.id)
      .maybeSingle();
    if (!error && data) {
      backendRole = data.role;
      admin = data.role === 'admin';
    }
  }

  async function restoreBackendSession() {
    if (!backendConfigured()) return;
    const { data } = await client().auth.getSession();
    backendSession = data.session;
    await refreshBackendRole();
    const scope = document.getElementById('scope');
    if (scope) {
      scope.textContent = admin
        ? 'Authorized Admin mode: private plant documents enabled.'
        : 'Public mode: built-in general engineering knowledge. Plant files require authorization.';
    }
    client().auth.onAuthStateChange(async (_event, newSession) => {
      backendSession = newSession;
      await refreshBackendRole();
    });
  }


  async function extractPdfText(file) {
    if (!window.pdfjsLib) throw new Error('PDF reader library is not available.');
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const pages = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      const text = tc.items.map(x => x.str).join(' ').replace(/\s+/g, ' ').trim();
      pages.push({ page: p, text });
    }
    const combined = pages.map(x => `[[PAGE ${x.page}]]\n${x.text}`).join('\n\n');
    return { pages, combined, pageCount: pdf.numPages };
  }

  function queryTokens(q) {
    return norm(q).split(' ').filter(w => w.length >= 2);
  }

  function pageMatches(pageText, tokens, rawQuery='') {
    const t = pageText.toLowerCase();
    let score = 0;
    const phrase = norm(rawQuery);
    if (phrase.length > 2 && t.includes(phrase)) score += 40;
    for (const token of tokens) {
      const n = t.split(token).length - 1;
      if (n > 0) score += Math.min(n, 8);
    }
    return score;
  }

  function makeSnippet(text, tokens) {
    if (!text) return '';
    const lower = text.toLowerCase();
    let pos = -1;
    for (const token of tokens) {
      const p = lower.indexOf(token);
      if (p >= 0 && (pos < 0 || p < pos)) pos = p;
    }
    if (pos < 0) pos = 0;
    const start = Math.max(0, pos - 220);
    const end = Math.min(text.length, pos + 520);
    return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '');
  }

  function findExplicitEquipmentVendor(q, documents) {
    const nq = norm(q);
    if (!/(make|manufacturer|oem)/.test(nq)) return null;

    const defs = [
      {
        label:'PA FAN',
        wants:['pa fan','primary air fan'],
        patterns:[
          /ID\s*\/\s*SA\s*\/\s*PA\s+Fan\s*[^A-Za-z0-9]{1,4}\s*([A-Za-z][A-Za-z0-9&().,' -]{2,60}?)(?=\s+(?:O\s*&\s*M|Section|Fan manual|1\.|$))/i,
          /PA\s+Fan\s*[^A-Za-z0-9]{1,4}\s*([A-Za-z][A-Za-z0-9&().,' -]{2,60}?)(?=\s+(?:O\s*&\s*M|Section|Manual|Drawing|Curves?|$))/i
        ]
      },
      {
        label:'SA FAN',
        wants:['sa fan','secondary air fan'],
        patterns:[
          /ID\s*\/\s*SA\s*\/\s*PA\s+Fan\s*[^A-Za-z0-9]{1,4}\s*([A-Za-z][A-Za-z0-9&().,' -]{2,60}?)(?=\s+(?:O\s*&\s*M|Section|Fan manual|1\.|$))/i,
          /SA\s+Fan\s*[^A-Za-z0-9]{1,4}\s*([A-Za-z][A-Za-z0-9&().,' -]{2,60}?)(?=\s+(?:O\s*&\s*M|Section|Manual|Drawing|Curves?|$))/i
        ]
      },
      {
        label:'ID FAN',
        wants:['id fan','induced draft fan'],
        patterns:[
          /ID\s*\/\s*SA\s*\/\s*PA\s+Fan\s*[^A-Za-z0-9]{1,4}\s*([A-Za-z][A-Za-z0-9&().,' -]{2,60}?)(?=\s+(?:O\s*&\s*M|Section|Fan manual|1\.|$))/i,
          /ID\s+Fan\s*[^A-Za-z0-9]{1,4}\s*([A-Za-z][A-Za-z0-9&().,' -]{2,60}?)(?=\s+(?:O\s*&\s*M|Section|Manual|Drawing|Curves?|$))/i
        ]
      },
      {
        label:'BFP',
        wants:['bfp','bfw pump','boiler feed pump','boiler feed water pump'],
        patterns:[
          /BFW\s+Pump\s*[^A-Za-z0-9]{1,4}\s*([A-Za-z][A-Za-z0-9&().,' -]{2,60}?)(?=\s+(?:O\s*&\s*M|Section|Index sheet|Technical Documents|Pump Manual|$))/i,
          /Boiler\s+Feed(?:\s+Water)?\s+Pump\s*[^A-Za-z0-9]{1,4}\s*([A-Za-z][A-Za-z0-9&().,' -]{2,60}?)(?=\s+(?:O\s*&\s*M|Section|Manual|$))/i
        ]
      }
    ];

    const def = defs.find(d => d.wants.some(w => nq.includes(w)));
    if (!def) return null;

    for (const d of documents || []) {
      const raw = String(d.extracted_text || '').replace(/\s+/g,' ').trim();
      if (!raw) continue;

      for (const re of def.patterns) {
        const m = raw.match(re);
        if (!m) continue;

        let vendor = (m[1] || '').trim()
          .replace(/^[^A-Za-z0-9]+/,'').replace(/[,:;.-]+$/,'')
          .replace(/\s+/g,' ')
          .trim();

        if (!vendor || /motor|bearing|actuator|gearbox|coupling/i.test(vendor)) continue;

        return {
          answer: def.label + ' Make : ' + vendor,
          id: d.id,
          storage_path: d.storage_path,
          file_name: d.file_name,
          category: d.category,
          document_type: d.document_type
        };
      }
    }
    return null;
  }

  function isBedMaterialQuery(q) {
    const nq = norm(q);
    return /\bbed material\b/.test(nq) || /\bbed ash\b/.test(nq);
  }

  function querySubEquipment(q) {
    const nq = norm(q);
    const defs = [
      {key:'BFP', terms:['bfp','bfw pump','boiler feed pump','boiler feed water pump'], docTerms:['bfp','bfw pump','boiler feed pump','boiler feed water pump','ksb']},
      {key:'PA FAN', terms:['pa fan','primary air fan'], docTerms:['pa fan','primary air fan','andrew yule']},
      {key:'SA FAN', terms:['sa fan','secondary air fan'], docTerms:['sa fan','secondary air fan','andrew yule']},
      {key:'ID FAN', terms:['id fan','induced draft fan'], docTerms:['id fan','induced draft fan','andrew yule']},
      {key:'TURBINE', terms:['steam turbine','turbine'], docTerms:['steam turbine','turbine','siemens']},
      {key:'ESP', terms:['esp','electrostatic precipitator'], docTerms:['esp','electrostatic precipitator','thermax']}
    ];
    return defs.find(d => d.terms.some(t => nq.includes(t))) || null;
  }

  function isExcludedSubEquipmentDocument(q, subEquipment, d) {
    if (!subEquipment) return false;
    const nq = norm(q);
    const hay = norm([
      d.file_name,
      d.document_type,
      (d.metadata && d.metadata.section) || '',
      (d.metadata && d.metadata.source_path) || ''
    ].join(' '));

    if (subEquipment.key === 'BFP') {
      const asksMotor = /\bmotor\b/.test(nq);
      const asksRtd = /\brtd\b|temperature sensor|vsf/.test(nq);

      if (!asksMotor && /bfw pump motor|bfp motor|motor datasheet|motor/.test(hay)) return true;
      if (!asksRtd && /rtd|vsf brg|vsfc brg/.test(hay)) return true;

      // For pump mechanical queries, prefer the pump manual / technical documents.
      if (/bearing|seal|shaft|impeller|coupling|stage|npsh|head/.test(nq)) {
        if (/electrical|ems2|logic|p&id|pid/.test(hay)) return true;
      }
    }
    return false;
  }

  function preferredSubEquipmentReference(q, subEquipment, documents) {
    if (!subEquipment) return null;
    const nq = norm(q);
    const isBfpMechanical = subEquipment.key === 'BFP' && /bearing|seal|shaft|impeller|coupling|stage|npsh|head/.test(nq);
    if (!isBfpMechanical) return null;

    const ranked = (documents || [])
      .filter(d => !isExcludedSubEquipmentDocument(q, subEquipment, d))
      .map(d => {
        const hay = norm([
          d.file_name,
          d.document_type,
          (d.metadata && d.metadata.section) || '',
          (d.metadata && d.metadata.source_path) || ''
        ].join(' '));
        let score = 0;
        if (/operation instruction.*manual for pump|manual for pump|pump manual/.test(hay)) score += 500;
        if (/technical documents|technical data|datasheet/.test(hay)) score += 450;
        if (/ksb/.test(hay)) score += 120;
        if (/bfp|bfw pump|boiler feed pump/.test(hay)) score += 100;
        return {d,score};
      })
      .filter(x => x.score > 0)
      .sort((a,b)=>b.score-a.score);

    return ranked.length ? ranked[0].d : null;
  }

  function queryEquipmentCategory(q) {
    const nq = norm(q);
    const routes = [
      {category:'Steam Turbine', terms:['steam turbine','turbine','governor','turbine gear','gear box','gearbox']},
      {category:'CFBC Boiler', terms:['cfbc','boiler','bed material','bed ash','pa fan','sa fan','id fan','bfp','bfw pump','superheater','economiser','economizer','evaporator','steam drum']},
      {category:'Air Cooled Condenser', terms:['acc','air cooled condenser']},
      {category:'ESP', terms:['esp','electrostatic precipitator']},
      {category:'CHP', terms:['chp','coal handling']},
      {category:'AHS', terms:['ahs','ash handling']},
      {category:'WTP / ETP', terms:['wtp','etp','water treatment','effluent treatment']},
      {category:'Cooling Tower', terms:['cooling tower']},
      {category:'Electrical', terms:['transformer','generator','switchgear','electrical']},
      {category:'C&I', terms:['c&i','instrument','transmitter','dcs','plc']}
    ];
    return routes.find(r => r.terms.some(t => nq.includes(t)))?.category || '';
  }

  function technicalDataIntent(q) {
    const nq = norm(q);
    return /(make|manufacturer|oem|model|type|speed|rpm|pressure|temperature|temp|capacity|flow|output|power|rating|current|amps|voltage|frequency|head|efficiency|npsh|density|bulk density|diameter|material|serial|gear|gearbox|gear box|bearing|coupling)/.test(nq);
  }

  function queryDetailTokens(q) {
    const generic = new Set([
      'what','is','the','of','for','show','give','please','data','details','detail',
      'cfbc','boiler','steam','turbine','plant','system','equipment','fan','pump'
    ]);
    return queryTokens(q).filter(t => !generic.has(t));
  }

  function tokenPresentFlexible(hay, token) {
    if (!hay || !token) return false;
    const h = norm(hay);
    const t = norm(token);
    if (h.includes(t)) return true;

    // Common compound-word forms: gear box / gearbox / gear-box, name plate / nameplate.
    const compactH = h.replace(/[\s\-_/]+/g,'');
    const compactT = t.replace(/[\s\-_/]+/g,'');
    return compactT.length >= 3 && compactH.includes(compactT);
  }

  function detailCoverage(q, hay) {
    const details = queryDetailTokens(q);
    if (!details.length) return {matched:0,total:0,ratio:1};
    let matched = 0;
    for (const t of details) if (tokenPresentFlexible(hay,t)) matched++;
    return {matched,total:details.length,ratio:matched/details.length};
  }

  function focusedSnippet(q, text) {
    const raw = String(text || '').replace(/\s+/g,' ').trim();
    if (!raw) return '';
    const low = raw.toLowerCase();
    const details = queryDetailTokens(q);
    const tokens = details.length ? details : queryTokens(q);

    let pos = -1;
    for (const t of tokens) {
      const p = low.indexOf(t.toLowerCase());
      if (p >= 0 && (pos < 0 || p < pos)) pos = p;
    }
    if (pos < 0) return '';

    const start = Math.max(0,pos-90);
    const end = Math.min(raw.length,pos+260);
    let out = (start>0?'…':'') + raw.slice(start,end).trim() + (end<raw.length?'…':'');
    return out.length>260 ? out.slice(0,260)+'…' : out;
  }

  function exactEquipmentQuery(q) {
    const nq = norm(q);
    const defs = [
      {label:'ID Fan', exact:['id fan','induced draft fan'], vendorQuery:'id fan make'},
      {label:'PA Fan', exact:['pa fan','primary air fan'], vendorQuery:'pa fan make'},
      {label:'SA Fan', exact:['sa fan','secondary air fan'], vendorQuery:'sa fan make'},
      {label:'BFP', exact:['bfp','bfw pump','boiler feed pump','boiler feed water pump'], vendorQuery:'bfp make'},
      {label:'Steam Turbine', exact:['steam turbine','turbine'], vendorQuery:'turbine make'},
      {label:'ESP', exact:['esp','electrostatic precipitator'], vendorQuery:'esp make'}
    ];
    return defs.find(d => d.exact.includes(nq)) || null;
  }

  function equipmentPrimaryReference(eq, documents) {
    if (!eq) return null;

    const vendor = findExplicitEquipmentVendor(eq.vendorQuery, documents);
    if (vendor) {
      return {
        answer: eq.label + ' : ' + vendor.answer.replace(/^.*?\sMake\s*:\s*/i,''),
        id: vendor.id,
        storage_path: vendor.storage_path,
        file_name: vendor.file_name,
        category: vendor.category,
        document_type: vendor.document_type
      };
    }

    const terms = eq.exact.map(norm);
    let best = null;
    for (const d of documents || []) {
      const hay = norm([
        d.file_name,
        d.document_type,
        (d.metadata && d.metadata.section) || '',
        (d.metadata && d.metadata.source_path) || ''
      ].join(' '));

      if (!terms.some(t => hay.includes(t))) continue;

      let score = 0;
      if (/manual|o&m|technical data|datasheet|specification|drawing/.test(hay)) score += 100;
      if (/motor|bearing|actuator|cable|junction box/.test(hay)) score -= 120;
      if (/vendor manuals|auxiliaries/.test(hay)) score += 50;

      if (!best || score > best.score) best = {score,d};
    }

    if (!best) return null;
    return {
      answer: eq.label + ' : ' + (best.d.file_name || 'Plant document'),
      id: best.d.id,
      storage_path: best.d.storage_path,
      file_name: best.d.file_name,
      category: best.d.category,
      document_type: best.d.document_type
    };
  }

  function definitionQueryTerm(q) {
    const raw = String(q || '').trim();
    const n = norm(raw);
    const patterns = [
      /^what\s+is\s+(.+)$/i,
      /^define\s+(.+)$/i,
      /^meaning\s+of\s+(.+)$/i,
      /^full\s+form\s+of\s+(.+)$/i,
      /^what\s+does\s+(.+?)\s+mean$/i
    ];
    for (const re of patterns) {
      const m = raw.match(re);
      if (m && m[1]) return m[1].trim().replace(/[?.!]+$/,'');
    }
    return '';
  }

  function explicitDefinitionFromDocuments(q, documents) {
    const term = definitionQueryTerm(q);
    if (!term) return null;

    const esc = term.replace(/[.*+?^()|[\]\\]/g,'\\$&');

    const patterns = [
      new RegExp('\\b' + esc + '\\b\\s+(?:means|stands\\s+for|is\\s+defined\\s+as|refers\\s+to)\\s+([^.;]{3,180})','i'),
      new RegExp('\\b' + esc + '\\b\\s*[-–—:ñ]\\s*([A-Za-z][A-Za-z0-9&(),/ .-]{3,120})(?=\\s{2,}|[.;]|$)','i'),
      new RegExp('([A-Za-z][A-Za-z0-9&(),/ .-]{3,120})\\s*\\(\\s*' + esc + '\\s*\\)','i')
    ];

    for (const d of documents || []) {
      const raw = String(d.extracted_text || '').replace(/\s+/g,' ').trim();
      if (!raw) continue;

      for (let i=0;i<patterns.length;i++) {
        const m = raw.match(patterns[i]);
        if (!m) continue;

        let expansion = (m[1] || '').trim().replace(/[,:;.-]+$/,'').trim();
        if (!expansion || expansion.length < 3 || expansion.length > 180) continue;

        // Avoid table/interlock noise masquerading as a definition.
        if (/\bNA\b|potential free|interlock|outlet|close|open/i.test(expansion) && i===1) continue;

        const label = term.toUpperCase();
        return {
          answer: label + ' : ' + expansion,
          id: d.id,
          storage_path: d.storage_path,
          file_name: d.file_name,
          category: d.category,
          document_type: d.document_type
        };
      }
    }
    return null;
  }

  function explicitBedMaterialDensity(q, documents) {
    const nq = norm(q);
    if (!/bed material/.test(nq) || !/density|bulk density/.test(nq)) return null;

    const patterns = [
      /bed\s+material.{0,120}?(?:bulk\s+)?density\s*[:=\-]?\s*([0-9][0-9., ]*(?:kg\/?m3|kg\/?m\^3|kg\s*\/\s*m3|kg\s*\/\s*m³|t\/?m3|g\/?cc)?)/i,
      /(?:bulk\s+)?density\s*[:=\-]?\s*([0-9][0-9., ]*(?:kg\/?m3|kg\/?m\^3|kg\s*\/\s*m3|kg\s*\/\s*m³|t\/?m3|g\/?cc)?).{0,120}?bed\s+material/i
    ];

    let fallbackDoc = null;

    for (const d of documents || []) {
      if (norm(d.category || '') !== 'cfbc boiler') continue;

      const metaHay = norm([
        d.file_name,
        d.document_type,
        (d.metadata && d.metadata.section) || '',
        (d.metadata && d.metadata.source_path) || ''
      ].join(' '));

      // Keep a sensible reference document in case the value isn't extractable.
      if (!fallbackDoc && /design specification|technical data|specification|operation|description/.test(metaHay)) {
        fallbackDoc = d;
      }

      const raw = String(d.extracted_text || '').replace(/\s+/g,' ').trim();
      if (!raw || !/bed\s+material/i.test(raw)) continue;

      for (const re of patterns) {
        const m = raw.match(re);
        if (!m) continue;
        const value = (m[1] || '').trim().replace(/\s+/g,' ');
        if (!value) continue;

        return {
          answer:'Bed Material Density : ' + value,
          id:d.id,
          storage_path:d.storage_path,
          file_name:d.file_name,
          category:d.category,
          document_type:d.document_type
        };
      }

      if (!fallbackDoc) fallbackDoc = d;
    }

    if (fallbackDoc) {
      return {
        answer:'Bed Material Density : Exact value not found in searchable text. Open the related Boiler technical document.',
        id:fallbackDoc.id,
        storage_path:fallbackDoc.storage_path,
        file_name:fallbackDoc.file_name,
        category:fallbackDoc.category,
        document_type:fallbackDoc.document_type
      };
    }

    return {
      answer:'Bed Material Density : No exact plant-document match found.',
      id:null,
      storage_path:null,
      file_name:'',
      category:'CFBC Boiler',
      document_type:''
    };
  }

  async function searchPrivateDocuments(q) {
    if (!backendSession || !client()) return [];
    const { data, error } = await client()
      .from('documents')
      .select('id,file_name,storage_path,category,document_type,processing_status,extracted_text,page_count,metadata')
      .eq('processing_status', 'ready')
      .not('extracted_text', 'is', null);
    if (error || !data) return [];

    const tokens = queryTokens(q);
    if (!tokens.length) return [];

    const bedDensity = explicitBedMaterialDensity(q, data);
    if (bedDensity) {
      return [{
        score:100000,
        direct_answer:bedDensity.answer,
        id:bedDensity.id,
        storage_path:bedDensity.storage_path,
        file_name:bedDensity.file_name,
        page:null,
        text:'',
        category:bedDensity.category,
        document_type:bedDensity.document_type,
        section:'Technical Data',
        source_path:'',
        detail_matched:1,
        detail_total:1,
        detail_ratio:1
      }];
    }

    const exactEquipment = exactEquipmentQuery(q);
    if (exactEquipment) {
      const ref = equipmentPrimaryReference(exactEquipment, data);
      if (ref) {
        return [{
          score: 100000,
          direct_answer: ref.answer,
          id: ref.id,
          storage_path: ref.storage_path,
          file_name: ref.file_name,
          page: null,
          text: '',
          category: ref.category,
          document_type: ref.document_type,
          section: 'Vendor Manuals / Auxiliaries',
          source_path: '',
          detail_matched: 1,
          detail_total: 1,
          detail_ratio: 1
        }];
      }
    }

    const definitionTerm = definitionQueryTerm(q);
    if (definitionTerm) {
      const def = explicitDefinitionFromDocuments(q, data);
      if (!def) return [];
      return [{
        score: 100000,
        direct_answer: def.answer,
        id: def.id,
        storage_path: def.storage_path,
        file_name: def.file_name,
        page: null,
        text: '',
        category: def.category,
        document_type: def.document_type,
        section: '',
        source_path: '',
        detail_matched: 1,
        detail_total: 1,
        detail_ratio: 1
      }];
    }

    const explicitVendor = findExplicitEquipmentVendor(q, data);
    const routedCategory = queryEquipmentCategory(q);
    const subEquipment = querySubEquipment(q);
    const wantsTechnicalData = technicalDataIntent(q);

    const pressurePartTerms = ['panel','pressure part','tube','coil','header','superheater','economiser','economizer','evaporator','water wall','drum','downcomer','riser','sh','economiser coil','economizer coil'];
    const wantsPressureParts = pressurePartTerms.some(t => norm(q).includes(t));

    const hits = [];
    for (const d of data) {
      if (isExcludedSubEquipmentDocument(q, subEquipment, d)) continue;

      const dSection = norm((d.metadata && d.metadata.section) || '');
      const dName = norm(d.file_name || '');
      const dType = norm(d.document_type || '');
      const dCategory = norm(d.category || '');
      const qn = norm(q);

      let docBoost = 0;

      if (isBedMaterialQuery(q)) {
        const bedHay = [dName,dType,dSection,(d.metadata && d.metadata.source_path) || ''].join(' ');
        if (/design specification|technical data|specification|operation|description/.test(bedHay)) docBoost += 650;
        if (/rav|rotary air valve|motor|actuator|valve|instrument|junction box/.test(bedHay)) docBoost -= 900;
      }

      // Route sub-equipment questions (BFP, PA/SA/ID Fan, etc.) to their own files first.
      if (subEquipment) {
        const subHay = [dName,dType,dSection,(d.metadata && d.metadata.source_path) || ''].join(' ');
        const subMatch = subEquipment.docTerms.some(t => subHay.includes(norm(t)));
        if (subMatch) docBoost += 700;
        else docBoost -= 350;

        // Explicitly penalize sibling fan/pump documents when the requested sub-equipment is absent.
        if (subEquipment.key === 'BFP' && /pa fan|sa fan|id fan|primary air fan|secondary air fan|induced draft fan/.test(subHay) && !/bfp|bfw pump|boiler feed pump/.test(subHay)) {
          docBoost -= 900;
        }
        if (/ FAN$/.test(subEquipment.key) && /bfp|bfw pump|boiler feed pump/.test(subHay) && !subEquipment.docTerms.some(t => subHay.includes(norm(t)))) {
          docBoost -= 900;
        }
      }

      // Route equipment questions to their own document set first.
      if (routedCategory) {
        if (norm(routedCategory) === dCategory) docBoost += 500;
        else docBoost -= 250;
      }

      // For equipment-detail questions prefer datasheets / technical-data documents.
      if (wantsTechnicalData) {
        const techHay = [dType,dSection,dName,(d.metadata && d.metadata.source_path) || ''].join(' ');
        if (/technical data|datasheet|data sheet|design specification|specification|nameplate/.test(techHay)) docBoost += 320;
      }

      if (dCategory && qn.includes(dCategory)) docBoost += 140;

      const sectionRules = [
        {terms:['pressure part','panel','tube','coil','header','superheater','economiser','economizer','evaporator','water wall','drum','downcomer','riser'], sections:['pressure parts']},
        {terms:['drawing','p&id','pid','ga','layout','diagram'], sections:['drawings & p&ids']},
        {terms:['interlock','permissive','logic','bms','plc','cause effect'], sections:['interlocks & logic']},
        {terms:['electrical','instrument','transmitter','sensor','switch','cable','mcc','vfd'], sections:['electrical & c&i']},
        {terms:['fan','pump','valve','feeder','motor','actuator','burner','esp','cems','swas'], sections:['vendor manuals / auxiliaries']},
        {terms:['operation','startup','shutdown','loading'], sections:['operation']},
        {terms:['maintenance','maintainance','lubrication','spare'], sections:['maintenance']},
        {terms:['design','specification','technical data','datasheet','density','bulk density','bed material'], sections:['technical data']},
        {terms:['description'], sections:['description']}
      ];
      for (const r of sectionRules) {
        if (r.terms.some(t => qn.includes(t)) && r.sections.some(sec => dSection.includes(sec))) docBoost += 180;
      }

      for (const token of tokens) {
        if (dName.includes(token)) docBoost += 22;
        if (dType.includes(token)) docBoost += 12;
        if (dSection.includes(token)) docBoost += 18;
      }
      const raw = d.extracted_text || '';
      const parts = raw.split(/\[\[PAGE (\d+)\]\]\n?/g);
      for (let i = 1; i < parts.length; i += 2) {
        const pageNo = Number(parts[i]);
        const text = parts[i + 1] || '';
        const pageHay = [text,d.file_name,dSection,(d.metadata && d.metadata.source_path) || ''].join(' ');
        const coverage = detailCoverage(q,pageHay);
        const hasDetails = coverage.total > 0;

        // For descriptive multi-word queries, require at least one meaningful detail term
        // in the same document/page. This prevents "turbine" alone from matching every turbine page.
        const routedTechDoc = routedCategory &&
          norm(routedCategory) === dCategory &&
          wantsTechnicalData &&
          /technical data|datasheet|data sheet|design specification|specification|nameplate/.test(
            [dType,dSection,dName,(d.metadata && d.metadata.source_path) || ''].join(' ')
          );

        const subHayPage = norm([text,d.file_name,(d.metadata && d.metadata.source_path) || '',dSection].join(' '));
        const subRelevant = !subEquipment || subEquipment.docTerms.some(t => subHayPage.includes(norm(t)));

        if (subEquipment && !subRelevant && !routedTechDoc) continue;
        if (hasDetails && coverage.matched === 0 && !routedTechDoc) continue;

        let score = pageMatches(text, tokens, q) + docBoost;
        score += coverage.matched * 90;
        if (coverage.ratio === 1 && coverage.total > 0) score += 180;
        if (routedTechDoc) score += 220;

        const section = dSection;
        if (wantsPressureParts && section === 'pressure parts') score += 180;
        if (score > 0) {
          hits.push({
            score,
            id: d.id,
            storage_path: d.storage_path,
            file_name: d.file_name,
            page: pageNo,
            text,
            category: d.category,
            document_type: d.document_type,
            section: (d.metadata && d.metadata.section) || '',
            source_path: (d.metadata && d.metadata.source_path) || '',
            detail_matched: coverage.matched,
            detail_total: coverage.total,
            detail_ratio: coverage.ratio
          });
        }
      }
    }
    const ranked = hits.sort((a,b)=>b.score-a.score).slice(0,30);

    if (!ranked.length && subEquipment) {
      const preferred = preferredSubEquipmentReference(q, subEquipment, data);
      if (preferred) {
        ranked.push({
          score: 90000,
          direct_answer: subEquipment.key + ' : Exact data not found in searchable text. Open the pump manual / technical document.',
          id: preferred.id,
          storage_path: preferred.storage_path,
          file_name: preferred.file_name,
          page: null,
          text: '',
          category: preferred.category,
          document_type: preferred.document_type,
          section: (preferred.metadata && preferred.metadata.section) || '',
          source_path: (preferred.metadata && preferred.metadata.source_path) || '',
          detail_matched: 0,
          detail_total: 1,
          detail_ratio: 0
        });
      }
    }

    if (explicitVendor) {
      ranked.unshift({
        score: 100000,
        direct_answer: explicitVendor.answer,
        id: explicitVendor.id,
        storage_path: explicitVendor.storage_path,
        file_name: explicitVendor.file_name,
        page: null,
        text: '',
        category: explicitVendor.category,
        document_type: explicitVendor.document_type,
        section: 'Vendor Manuals / Auxiliaries',
        source_path: ''
      });
    }
    return ranked;
  }

  function oneLineFromHit(q, hit) {
    const text = (hit.text || '').replace(/\s+/g,' ').trim();
    const nq = norm(q);

    const groups = [
      {terms:['model','type'], labels:['Model','Type']},
      {terms:['speed','rpm'], labels:['Rated Speed','Speed']},
      {terms:['pressure'], labels:['Rated Pressure','Design Pressure','Inlet Steam Pressure','Pressure']},
      {terms:['temperature','temp'], labels:['Rated Temperature','Design Temperature','Inlet Steam Temperature','Temperature','Temp']},
      {terms:['capacity','flow'], labels:['Rated Capacity','Capacity','Flow']},
      {terms:['output','power','rating'], labels:['Rated Output','Output','Rated Power','Power','Rating']},
      {terms:['current','amps','amp'], labels:['Rated Current','Current','Amps']},
      {terms:['voltage','volt'], labels:['Rated Voltage','Voltage']},
      {terms:['frequency','hz'], labels:['Frequency']},
      {terms:['head'], labels:['Rated Head','Head']},
      {terms:['efficiency'], labels:['Efficiency']},
      {terms:['npsh','npshr'], labels:['NPSHr','NPSH']},
      {terms:['density','bulk density'], labels:['Bed Material Density','Bulk Density','Density']},
      {terms:['diameter','dia'], labels:['Diameter','Dia']},
      {terms:['material'], labels:['Material']},
      {terms:['make','manufacturer','oem'], labels:['Make','Manufacturer','OEM']},
      {terms:['serial','sr no','sr number'], labels:['Sr. Number','Serial Number','Sr No']},
      {terms:['bearing temperature','bearing temp'], labels:['Bearing Temperature','Bearing Temp']}
    ];

    function escapeRegex(v) {
      return v.replace(/[.*+?^()|[\]\\]/g,'\\$&');
    }

    function extract(label) {
      const re = new RegExp('\\b' + escapeRegex(label) + '\\s*[:=\\-]?\\s*([^;|]{1,90})','i');
      const m = text.match(re);
      if (!m) return null;
      let value = m[1].trim();
      value = value.replace(/\s+(Rated|Design|Make|Model|Type|Voltage|Current|Speed|Pressure|Temperature|Capacity|Output|Power|Rating)\b.*$/i,'').trim();
      if (!value || value.length > 80) return null;
      return label + ' : ' + value;
    }

    for (const group of groups) {
      if (group.terms.includes('material') && /density|bulk density/.test(nq)) continue;
      if (group.terms.some(term => nq.includes(term))) {
        for (const label of group.labels) {
          const result = extract(label);
          if (result) return result;
        }
      }
    }

    const tokens = queryTokens(q);
    const snippet = makeSnippet(text, tokens).replace(/\s+/g,' ').trim();
    if (!snippet) return 'No exact value found in the uploaded documents.';
    return snippet.length > 160 ? snippet.slice(0,160) + '…' : snippet;
  }

  function equipmentVendorFromText(q, hits) {
    const nq = norm(q);
    if (!/(make|manufacturer|oem)/.test(nq)) return '';

    const defs = [
      {label:'PA FAN', terms:['pa fan','primary air fan'], grouped:['id/sa/pa fan','pa/sa/id fan','id sa pa fan','pa sa id fan']},
      {label:'SA FAN', terms:['sa fan','secondary air fan'], grouped:['id/sa/pa fan','pa/sa/id fan','id sa pa fan','pa sa id fan']},
      {label:'ID FAN', terms:['id fan','induced draft fan'], grouped:['id/sa/pa fan','pa/sa/id fan','id sa pa fan','pa sa id fan']},
      {label:'BFP', terms:['bfp','bfw pump','boiler feed pump','boiler feed water pump'], grouped:['bfw pump','bfp']},
      {label:'ESP', terms:['esp','electrostatic precipitator'], grouped:['esp']},
      {label:'STEAM TURBINE', terms:['steam turbine','turbine'], grouped:['steam turbine','turbine']}
    ];
    const eq = defs.find(d => d.terms.some(t => nq.includes(t)));
    if (!eq) return '';

    const stopWords = /\b(o\s*&\s*m|manual|drawing|datasheet|data sheet|section|volume|technical|documents?|curves?|index|specification)\b/i;
    let best = null;

    for (const hit of hits) {
      const raw = String(hit.text || '').replace(/\s+/g,' ').trim();
      if (!raw) continue;
      const low = raw.toLowerCase();

      const anchors = [...eq.terms, ...eq.grouped];
      for (const anchor of anchors) {
        let from = 0;
        while (true) {
          const p = low.indexOf(anchor, from);
          if (p < 0) break;
          const seg = raw.slice(Math.max(0,p-40), Math.min(raw.length,p+180));
          const segLow = seg.toLowerCase();

          // Ignore grouped motor entries such as "PA/SA/ID Fan/BFWP Motor — ABB".
          if (/\bmotor\b/.test(segLow) && !/\bfan\s*[-–—:]\s*/i.test(seg)) {
            from = p + anchor.length;
            continue;
          }

          const escaped = anchor.replace(/[.*+?^()|[\]\\]/g,'\\$&');
          const rel = new RegExp(escaped + '\\s*(?:[-–—:]|\\bis\\b|\\bby\\b)\\s*([^.;|]{2,70})','i');
          const m = seg.match(rel);
          if (m) {
            let vendor = (m[1] || '').trim()
              .replace(stopWords, '')
              .replace(/\s{2,}.*/,'')
              .replace(/[,:;.-]+$/,'')
              .trim();

            if (vendor && vendor.length <= 55 && !/bearing|motor|actuator|gearbox|coupling/i.test(vendor)) {
              let score = Number(hit.score || 0) + 500;
              if ((hit.section || '').toLowerCase().includes('vendor')) score += 100;
              if (/andrew yule|ksb|siemens|thermax|yokogawa|forbes marshall|abb|rotex|schroedahl|tyco|valvetech|amrit|kwality|mil control/i.test(vendor)) score += 80;
              if (!best || score > best.score) best = {score,vendor};
            }
          }
          from = p + anchor.length;
        }
      }
    }

    return best ? eq.label + ' Make : ' + best.vendor : '';
  }

  function equipmentVendorFromPath(q, hits) {
    const nq = norm(q);
    if (!/(make|manufacturer|oem)/.test(nq)) return '';

    const aliases = [
      {label:'PA FAN', terms:['pa fan','primary air fan']},
      {label:'SA FAN', terms:['sa fan','secondary air fan']},
      {label:'ID FAN', terms:['id fan','induced draft fan']},
      {label:'BFP', terms:['bfp','bfw pump','boiler feed pump','boiler feed water pump']}
    ];
    const eq = aliases.find(x => x.terms.some(t => nq.includes(t)));
    if (!eq) return '';

    const knownVendors = [
      'Andrew Yule','KSB Pump Ltd','KSB','ABB','Siemens','Thermax',
      'Yokogawa','Forbes Marshall','Rotex','Schroedahl','Tyco Sanmar',
      'Valvetech','Amrit Enterprises','Kwality Conveyor','MIL Control'
    ];

    let best = null;
    for (const hit of hits) {
      const path = String(hit.source_path || '');
      const name = String(hit.file_name || '');
      const hay = (path + ' ' + name).toLowerCase();

      const eqPos = eq.terms.map(t => hay.indexOf(t)).filter(x => x >= 0).sort((a,b)=>a-b)[0];
      if (eqPos == null) continue;

      let score = Number(hit.score || 0) + 250;
      for (const vendor of knownVendors) {
        const vp = hay.indexOf(vendor.toLowerCase());
        if (vp < 0) continue;
        const dist = Math.abs(vp - eqPos);
        const candidateScore = score + Math.max(0, 180 - dist);
        if (!best || candidateScore > best.score) best = {score:candidateScore, vendor};
      }

      // Generic "equipment - vendor" folder/file pattern.
      const raw = path || name;
      for (const term of eq.terms) {
        const re = new RegExp(term.replace(/[.*+?^()|[\]\\]/g,'\\$&') + '\\s*[-–—_]\\s*([^/\\\\]{2,60})','i');
        const m = raw.match(re);
        if (m) {
          let vendor = (m[1] || '').trim()
            .replace(/\.(pdf|docx?|xlsx?|xls|html?)$/i,'')
            .replace(/\b(o\s*&\s*m|manual|drawing|datasheet|data sheet)\b.*$/i,'')
            .trim();
          if (vendor && vendor.length <= 50) {
            const candidateScore = score + 160;
            if (!best || candidateScore > best.score) best = {score:candidateScore, vendor};
          }
        }
      }
    }

    return best ? eq.label + ' Make : ' + best.vendor : '';
  }

  function equipmentAnchoredFieldAnswer(q, hits) {
    const nq = norm(q);
    const equipmentAliases = [
      ['pa fan',['pa fan','primary air fan']],
      ['sa fan',['sa fan','secondary air fan']],
      ['id fan',['id fan','induced draft fan']],
      ['bfp',['bfp','bfw pump','boiler feed pump','boiler feed water pump']],
      ['steam turbine',['steam turbine','turbine']],
      ['esp',['esp','electrostatic precipitator']]
    ];

    const fieldDefs = [
      {terms:['make','manufacturer','oem'], labels:['Make','Manufacturer','OEM']},
      {terms:['model','type'], labels:['Model','Type']},
      {terms:['speed','rpm'], labels:['Rated Speed','Speed']},
      {terms:['capacity','flow'], labels:['Rated Capacity','Capacity','Flow']},
      {terms:['head'], labels:['Rated Head','Head']},
      {terms:['power','output','rating'], labels:['Rated Output','Rated Power','Power','Output','Rating']},
      {terms:['pressure'], labels:['Rated Pressure','Design Pressure','Pressure']},
      {terms:['temperature','temp'], labels:['Rated Temperature','Design Temperature','Temperature','Temp']}
    ];

    const field = fieldDefs.find(d => d.terms.some(t => nq.includes(t)));
    if (!field) return '';

    let eq = null;
    for (const item of equipmentAliases) {
      if (item[1].some(a => nq.includes(a))) { eq = item; break; }
    }
    if (!eq) return '';

    const escRe = v => v.replace(/[.*+?^()|[\]\\]/g,'\\$&');
    const allLabels = fieldDefs.flatMap(d=>d.labels).sort((a,b)=>b.length-a.length);
    const stopAlt = allLabels.map(escRe).join('|');

    let best = null;

    for (const hit of hits) {
      const text = (hit.text || '').replace(/\s+/g,' ').trim();
      const lower = text.toLowerCase();

      const anchors = [];
      for (const alias of eq[1]) {
        let from=0;
        while(true){
          const pos=lower.indexOf(alias,from);
          if(pos<0) break;
          anchors.push({alias,pos});
          from=pos+alias.length;
        }
      }
      if(!anchors.length) continue;

      for(const a of anchors){
        const segmentStart=Math.max(0,a.pos-100);
        const segmentEnd=Math.min(text.length,a.pos+700);
        const segment=text.slice(segmentStart,segmentEnd);
        const segLower=segment.toLowerCase();

        // Reject segments that are clearly subcomponent-only blocks unless equipment name is prominent.
        const badTerms=['bearing housing','bearing no','motor make','actuator make','gearbox make','coupling make'];
        let base=Number(hit.score||0)+150;
        if(segLower.includes(a.alias+' specifications')||segLower.includes(a.alias+' specification')) base+=220;
        if(segLower.includes('technical data')||segLower.includes('datasheet')) base+=80;
        if((hit.file_name||'').toLowerCase().includes(a.alias.replace(/\s+/g,'')) || (hit.file_name||'').toLowerCase().includes(a.alias)) base+=60;
        if(badTerms.some(t=>segLower.includes(t))) base-=120;

        for(const label of field.labels){
          const re=new RegExp('\\b'+escRe(label)+'\\s*[:=\\-]?\\s*(.{1,80}?)(?=\\s+(?:'+stopAlt+')\\s*[:=\\-]?|$)','ig');
          let m;
          while((m=re.exec(segment))!==null){
            let value=(m[1]||'').trim().replace(/[.,;]+$/,'').trim();
            if(!value || value.length>60) continue;

            const before=segLower.slice(Math.max(0,m.index-140),m.index);
            let score=base;

            // Strongly prefer field values close to the equipment anchor.
            const dist=Math.abs((segmentStart+m.index)-a.pos);
            score+=Math.max(0,120-Math.floor(dist/4));

            // Penalize bearing/motor/actuator context before the field.
            if(/bearing|motor|actuator|gearbox|coupling/.test(before)) score-=180;

            if(!best || score>best.score) best={score,label,value,equipment:eq[0]};
          }
        }
      }
    }

    if(!best) return '';
    const prefix = best.equipment==='bfp' ? 'BFP' : best.equipment.toUpperCase();
    if(field.terms.includes('model') || field.terms.includes('type')) return prefix+' Model : '+best.value;
    if(field.terms.includes('make') || field.terms.includes('manufacturer') || field.terms.includes('oem')) return prefix+' Make : '+best.value;
    return best.label+' : '+best.value;
  }

  function contextualFieldAnswer(q, hits) {
    const nq = norm(q);
    const defs = [
      {terms:['make','manufacturer','oem'], labels:['Make','Manufacturer','OEM']},
      {terms:['model','type'], labels:['Model','Type']},
      {terms:['speed','rpm'], labels:['Rated Speed','Speed']},
      {terms:['pressure'], labels:['Rated Pressure','Design Pressure','Inlet Steam Pressure','Pressure']},
      {terms:['temperature','temp'], labels:['Rated Temperature','Design Temperature','Inlet Steam Temperature','Temperature','Temp']},
      {terms:['capacity','flow'], labels:['Rated Capacity','Capacity','Flow']},
      {terms:['output','power','rating'], labels:['Rated Output','Output','Rated Power','Power','Rating']},
      {terms:['current','amps','amp'], labels:['Rated Current','Current','Amps']},
      {terms:['voltage','volt'], labels:['Rated Voltage','Voltage']},
      {terms:['frequency','hz'], labels:['Frequency']},
      {terms:['head'], labels:['Rated Head','Head']},
      {terms:['efficiency'], labels:['Efficiency']},
      {terms:['npsh','npshr'], labels:['NPSHr','NPSH']},
      {terms:['density','bulk density'], labels:['Bed Material Density','Bulk Density','Density']},
      {terms:['diameter','dia'], labels:['Diameter','Dia']},
      {terms:['material'], labels:['Material']},
      {terms:['serial','sr no','sr number'], labels:['Sr. Number','Serial Number','Sr No']}
    ];
    const def = defs.find(d => d.terms.some(t => nq.includes(t)));
    if (!def) return '';

    const stop = new Set(['what','is','the','of','for','data','value','details','detail','rated','show','give','please']);
    if (def.terms.includes('density') || def.terms.includes('bulk density')) stop.add('material');
    def.terms.forEach(t => t.split(' ').forEach(w => stop.add(w)));
    const subjects = nq.split(' ').filter(w => w.length > 2 && !stop.has(w));
    const allLabels = defs.flatMap(d => d.labels).sort((a,b)=>b.length-a.length);
    const escRe = v => v.replace(/[.*+?^()|[\]\\]/g,'\\$&');
    const stopAlt = allLabels.map(escRe).join('|');

    function extractFromSegment(segment, baseScore) {
      let best = null;
      for (const label of def.labels) {
        const re = new RegExp('\\b' + escRe(label) + '\\s*[:=\\-]?\\s*(.{1,90}?)(?=\\s+(?:' + stopAlt + ')\\s*[:=\\-]?|$)','ig');
        let m;
        while ((m = re.exec(segment)) !== null) {
          let value = (m[1] || '').trim().replace(/[.,;]+$/,'').trim();
          if (!value || value.length > 70) continue;
          const score = baseScore + (label === def.labels[0] ? 10 : 0);
          if (!best || score > best.score) best = {score, label, value};
        }
      }
      return best;
    }

    let best = null;
    for (const hit of hits) {
      const text = (hit.text || '').replace(/\s+/g,' ').trim();
      const lower = text.toLowerCase();
      const segments = [];

      if (subjects.length) {
        for (const subject of subjects) {
          let from = 0;
          while (true) {
            const pos = lower.indexOf(subject, from);
            if (pos < 0) break;
            const start = Math.max(0, pos - 80);
            const end = Math.min(text.length, pos + 900);
            const segment = text.slice(start, end);
            const segLower = segment.toLowerCase();
            let score = Number(hit.score || 0) + 100;
            if (segLower.includes(subject + ' specifications') || segLower.includes(subject + ' specification')) score += 200;
            if (segLower.includes(subject + ' technical data') || segLower.includes(subject + ' data')) score += 120;
            if (norm(hit.category || '').includes(subject)) score += 40;
            segments.push({segment, score});
            from = pos + subject.length;
          }
        }
      }

      if (!segments.length) segments.push({segment:text, score:Number(hit.score || 0)});

      for (const item of segments) {
        const found = extractFromSegment(item.segment, item.score);
        if (found && (!best || found.score > best.score)) best = found;
      }
    }

    if (!best) return '';
    if (def.terms.includes('model') || def.terms.includes('type')) {
      const subject = subjects.length ? subjects.map(w => w.charAt(0).toUpperCase()+w.slice(1)).join(' ') + ' ' : '';
      return subject + 'Model : ' + best.value;
    }
    return best.label + ' : ' + best.value;
  }
  function structuredMultiValueAnswer(q, hits) {
    const nq = norm(q);
    if (!/(heating surface|surface area|heating area)/.test(nq)) return null;

    const candidates = hits || [];
    for (const hit of candidates) {
      const raw = String(hit.text || '').replace(/\s+/g,' ').trim();
      if (!raw || !/heating surface|surface area/i.test(raw)) continue;

      const fields = [
        {label:'Furnace panels & enclosure panels', re:/Furnace\s+panels\s+and\s+Encl\.?\s*Panels\s*Sq\.?\s*mt\s*([0-9.,]+)/i},
        {label:'Economizer', re:/Economi[sz]er\s*Sq\.?\s*mt\s*([0-9.,]+)/i},
        {label:'Total evaporating heating surface', re:/Total\s+Heating\s+Surface\s*Sq\.?\s*mt\s*([0-9.,]+)/i},
        {label:'Superheater heating surface', re:/Super\s*Heater\s+Heating\s+Surface\s+Area\s*[^0-9]{0,20}([0-9.,]+)/i}
      ];

      const rows=[];
      for(const f of fields){
        const m=raw.match(f.re);
        if(m && m[1]) rows.push({label:f.label,value:m[1]+' m²'});
      }

      if(rows.length>=2){
        return {
          rows,
          hit
        };
      }
    }
    return null;
  }

  function cleanDisplayedAnswer(value) {
    let s = String(value || '').replace(/\s+/g,' ').trim();

    // Remove repeated document headers / page-number noise from displayed answers.
    const boilerplate = [
      /Shri\s+GIRIJA\s+Alloy(?:s)?\s*&\s*Power\s*\(I\)\s*(?:Private\s+Limited|Pvt\.?\s*Ltd\.?)\s*\d*/ig,
      /Shri\s+Girija\s+Alloy(?:s)?\s*&\s*Power\s*\(I\)\s*(?:Private\s+Limited|Pvt\.?\s*Ltd\.?)\s*\d*/ig,
      /Operation\s*&\s*Maintenance\s+Manual\s*\d*/ig,
      /THERMAX\s+PROJECT\s+NO\.?\s*[:.-]?\s*PC\s*\d+[–-]?\d*/ig
    ];
    for (const re of boilerplate) s = s.replace(re,' ');

    // Remove isolated page numbers left between the label and actual value.
    s = s.replace(/(:\s*)\d{1,3}\s+(?=[A-Z][A-Z0-9 &/()-]{3,})/g,'$1');

    return s
      .replace(/\s+/g,' ')
      .replace(/\s+([,:;])/g,'$1')
      .replace(/:\s*:/g,':')
      .trim();
  }

  function renderPrivateHits(q, hits) {
    if (!hits || !hits.length) {
      return '<div class="card result compactresult"><div class="onelineanswer"><b>No exact plant-document match found.</b></div></div>';
    }

    let answer = '';
    let answerHit = null;

    const multi = structuredMultiValueAnswer(q,hits);
    if (multi) {
      const rows = multi.rows.map(r =>
        '<div class="multi-answer-row"><span>' + esc(r.label) + '</span><b>' + esc(r.value) + '</b></div>'
      ).join('');
      const view = multi.hit && multi.hit.id
        ? '<div class="result-actions"><button onclick="viewDocument(\'' + multi.hit.id + '\')">View related document</button></div>'
        : '';
      return '<div class="card result compactresult"><div class="multi-answer">' + rows + '</div>' + view + '</div>';
    }

    if (hits[0].direct_answer) {
      answer = hits[0].direct_answer;
      answerHit = hits[0];
    }

    // Field/value questions can use the structured extractors.
    const nq = norm(q);
    const isFieldQuery = /(make|manufacturer|oem|model|type|speed|rpm|pressure|temperature|temp|capacity|flow|output|power|rating|current|amps|voltage|frequency|head|efficiency|npsh|density|bulk density|diameter|material|serial)/.test(nq);

    if (!answer && isFieldQuery) {
      const vendor = equipmentVendorFromText(q,hits) || equipmentVendorFromPath(q,hits);
      if (vendor) {
        answer = vendor;
        answerHit = hits.find(h => {
          const hay = [h.text,h.file_name,h.source_path,h.section].join(' ');
          const c = detailCoverage(q,hay);
          return c.total===0 || c.matched>0;
        }) || hits[0];
      }
    }

    if (!answer && isFieldQuery) {
      const structured = equipmentAnchoredFieldAnswer(q,hits) || contextualFieldAnswer(q,hits);
      if (structured) {
        answer = structured;
        answerHit = hits[0];
      }
    }

    // For non-field queries, do NOT show an arbitrary page beginning.
    // Return a focused snippet from the same strong hit that will be opened by View.
    if (!answer) {
      const routedCategory = queryEquipmentCategory(q);
      const subEquipment = querySubEquipment(q);
      const strongHit =
        hits.find(h => subEquipment && subEquipment.docTerms.some(t => norm([h.file_name,h.source_path,h.section,h.text].join(' ')).includes(norm(t))) && h.detail_matched > 0) ||
        hits.find(h => routedCategory && norm(h.category || '') === norm(routedCategory) && h.detail_matched > 0) ||
        hits.find(h => routedCategory && norm(h.category || '') === norm(routedCategory) && /technical data|datasheet|specification/i.test([h.document_type,h.section,h.file_name,h.source_path].join(' '))) ||
        hits.find(h => {
          if (!h.detail_total) return true;
          return h.detail_matched > 0;
        });

      if (strongHit) {
        const snippet = focusedSnippet(q,strongHit.text);
        if (snippet) {
          answer = snippet;
          answerHit = strongHit;
        }
      }
    }

    if (!answer || !answerHit) {
      return '<div class="card result compactresult"><div class="onelineanswer"><b>No exact plant-document match found.</b></div></div>';
    }

    answer = cleanDisplayedAnswer(answer);

    const view = answerHit.id
      ? '<div class="result-actions"><button onclick="viewDocument(\'' + answerHit.id + '\')">View related document</button></div>'
      : '';

    return '<div class="card result compactresult"><div class="onelineanswer"><b>' + esc(answer) + '</b></div>' + view + '</div>';
  }
  function matchesEquipmentSection(d, sectionName) {
    const name = norm(d.file_name || '');
    const type = norm(d.document_type || '');
    const section = norm((d.metadata && d.metadata.section) || '');
    const path = norm((d.metadata && d.metadata.source_path) || '');
    const hay = [name,type,section,path].join(' ');

    if (sectionName === 'Documents') return true;
    if (sectionName === 'O&M Manuals') {
      return /o&m|o & m|manual|operation|maintenance|maintainance|vendor manual|description/.test(hay);
    }
    if (sectionName === 'Technical Data') {
      return /technical data|datasheet|data sheet|design specification|specification|nameplate/.test(hay);
    }
    if (sectionName === 'Nameplate') {
      return /nameplate/.test(hay);
    }
    if (sectionName === 'Interlocks') {
      return /interlock|permissive|logic|cause effect|bms|plc/.test(hay);
    }
    if (sectionName === 'SOP') {
      return /sop|standard operating|procedure/.test(hay);
    }
    if (sectionName === 'Startup / Loading Curves') {
      return /startup|start up|loading curve|load curve|performance curve|fan curve|pump curve/.test(hay);
    }
    if (sectionName === 'Troubleshooting') {
      return /troubleshoot|fault|failure|problem|maintenance|inspection/.test(hay);
    }
    if (sectionName === 'Notes') {
      return /note|record|inspection|maintenance record/.test(hay);
    }
    return false;
  }

  function equipmentSectionLabel(d) {
    const section = (d.metadata && d.metadata.section) || '';
    if (section) return section;
    return d.document_type || 'Other';
  }

  window.renderEquipmentDocuments = async function(category, sectionName) {
    const v = document.getElementById('view');
    if (!v) return;

    v.innerHTML = `<div class="card">
      <span class="badge">${esc(category)}</span>
      <h2>${esc(sectionName)}</h2>
      <p class="muted">Loading uploaded plant documents…</p>
    </div>`;

    if (!backendSession || !client()) {
      v.innerHTML = `<div class="card"><span class="badge">${esc(category)}</span><h2>${esc(sectionName)}</h2><div class="notice">Please sign in as Admin to view private plant documents.</div></div>`;
      return;
    }

    const { data, error } = await client()
      .from('documents')
      .select('*')
      .eq('category', category)
      .order('file_name', { ascending:true });

    if (error) {
      v.innerHTML = `<div class="card"><span class="badge">${esc(category)}</span><h2>${esc(sectionName)}</h2><div class="notice">Could not load documents: ${esc(error.message)}</div></div>`;
      return;
    }

    const all = data || [];
    const filtered = all.filter(d => matchesEquipmentSection(d, sectionName));
    const groups = {};
    for (const d of filtered) {
      const key = equipmentSectionLabel(d);
      (groups[key] ||= []).push(d);
    }

    const groupHtml = Object.entries(groups)
      .sort((x,y)=>x[0].localeCompare(y[0]))
      .map(([group,items]) => `
        <details class="docgroup" open>
          <summary><b>${esc(group)}</b> <span class="muted">(${items.length})</span></summary>
          <div class="equipment-doc-list">
            ${items.map(d=>`
              <div class="equipment-doc-row">
                <div class="equipment-doc-main">
                  <b>${esc(d.file_name)}</b>
                  <div class="muted small">${esc(d.document_type || 'Other')} • ${formatBytes(d.file_size || 0)}${d.page_count ? ' • '+d.page_count+' pages' : ''}</div>
                </div>
                <div class="actions">
                  <button onclick="viewDocument('${d.id}')">View</button>
                </div>
              </div>`).join('')}
          </div>
        </details>`).join('');

    v.innerHTML = `<div class="card">
      <div class="equipment-doc-head">
        <div>
          <span class="badge">${esc(category)}</span>
          <h2>${esc(sectionName)}</h2>
          <p class="muted">${filtered.length} matching document${filtered.length===1?'':'s'} from ${all.length} uploaded for this equipment.</p>
        </div>
        <button onclick="equipmentPage('${String(category).replace(/'/g,"\\'")}')">Back</button>
      </div>
      ${filtered.length ? groupHtml : '<div class="notice">No matching documents found in this section yet. Use <b>Documents</b> to view all uploaded files for this equipment.</div>'}
    </div>`;
  };


  window.hardRefreshPP360 = async function () {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch (e) {}
    const u = new URL(window.location.href);
    u.searchParams.set('refresh', Date.now().toString());
    window.location.replace(u.toString());
  };

  adminPage = async function () {
    const v = document.getElementById('view');

    if (!backendConfigured()) {
      v.innerHTML = `<div class="card admin">
        <h2>Backend setup required</h2>
        <div class="notice">Supabase is connected in the code, but the publishable key still needs to be added once in <b>config.js</b>.</div>
        <p>After that, refresh this page and use your Supabase Admin email/password.</p>
      </div>`;
      return;
    }

    if (!backendSession) {
      v.innerHTML = `<div class="card admin">
        <h2>Admin Login</h2>
        <div class="notice">Use your PowerPlant360 Supabase admin email and password.</div>
        <label>Email</label>
        <input id="loginEmail" type="email" placeholder="Admin email" class="fullinput">
        <label>Password</label>
        <input id="loginPassword" type="password" placeholder="Password" class="fullinput">
        <div class="actions"><button class="primary" onclick="login()">Login</button></div>
        <p id="loginMsg" class="muted"></p>
      </div>`;
      return;
    }

    if (backendRole !== 'admin') {
      v.innerHTML = `<div class="card">
        <h2>Authorized User</h2>
        <p>You are signed in, but this account does not have Admin upload/delete permission.</p>
        <div class="admin-actions">
          <button onclick="hardRefreshPP360()" title="Hard Refresh" aria-label="Hard Refresh">↻</button>
          <button onclick="logout()">Logout</button>
        </div>
      </div>`;
      return;
    }

    admin = true;
    document.getElementById('scope').textContent =
      'Authorized Admin mode: private plant documents enabled.';

    v.innerHTML = `<div class="card admin">
      <div class="adminhead">
        <div>
          <h2>Admin Document Manager</h2>
          <p class="muted">Signed in as ${esc(backendSession.user.email || 'Admin')}</p>
        </div>
        <div class="admin-actions">
          <button onclick="hardRefreshPP360()" title="Hard Refresh" aria-label="Hard Refresh">↻</button>
          <button onclick="logout()">Logout</button>
        </div>
      </div>

      <div id="dropZone" class="dropzone" tabindex="0">
        <div class="dropicon">⬆️</div>
        <h3>Drag & drop files here</h3>
        <p>or</p>
        <label class="uploadchoose">Choose Files
          <input id="file" type="file" multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg" hidden>
        </label>
        <p class="muted">Private storage • PDF, Word, Excel, CSV, TXT and images</p>
      </div>

      <div id="uploadQueue" class="uploadqueue"></div>

      <div class="notice"><b>Real backend enabled:</b> files are stored privately in Supabase Storage and metadata is stored in the database. The progress bar shows actual network upload progress.</div>

      <div id="storageUsage" class="storage-usage"><div class="muted small">Storage monitor loading…</div></div>

      <div class="doc-toolbar">
        <div>
          <label>Category filter</label>
          <select id="filterCategory" onchange="renderDocTable()">
            <option value="">All categories</option>
            ${categories.map(c => `<option>${c}</option>`).join('')}
          </select>
        </div>
        <div>
          <label>Document type</label>
          <select id="filterType" onchange="renderDocTable()">
            <option value="">All document types</option>
            ${docTypes.map(t => `<option>${t}</option>`).join('')}
          </select>
        </div>
        <div class="grow">
          <label>Search files</label>
          <input id="docSearch" oninput="renderDocTable()" placeholder="Search filename...">
        </div>
      </div>

      <h3>Stored Plant Documents</h3>
      <div id="docTableWrap"><p class="muted">Loading documents…</p></div>
    </div>`;

    setupDropZone();
    await loadDocsFromBackend();
  };

  login = async function () {
    const email = document.getElementById('loginEmail')?.value.trim();
    const password = document.getElementById('loginPassword')?.value || '';
    const msg = document.getElementById('loginMsg');
    if (msg) msg.textContent = 'Signing in…';

    const { data, error } = await client().auth.signInWithPassword({ email, password });
    if (error) {
      if (msg) msg.textContent = error.message;
      return;
    }

    backendSession = data.session;
    await refreshBackendRole();
    await adminPage();
  };

  logout = async function () {
    if (client()) await client().auth.signOut();
    backendSession = null;
    backendRole = null;
    admin = false;
    docs = [];
    document.getElementById('scope').textContent =
      'Public mode: built-in general engineering knowledge. Plant files require authorization.';
    show('Home');
  };

  function safeRemoteFileName(name) {
    return name.replace(/[^a-zA-Z0-9._-]+/g, '_');
  }

  processSelectedFiles = function (files) {
    const q = document.getElementById('uploadQueue');
    if (!q) return;

    files.forEach(file => {
      const id = safeId();
      q.insertAdjacentHTML('beforeend', `
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
      uploadRealFile(file, id);
    });
  };

  async function uploadRealFile(file, id, options = {}) {
    const bar = document.getElementById(id + '_bar');
    const pct = document.getElementById(id + '_pct');
    const status = document.getElementById(id + '_status');

    try {
      const { data: sessionData } = await client().auth.getSession();
      const s = sessionData.session;
      if (!s) throw new Error('Session expired. Please log in again.');

      const storagePath =
        new Date().toISOString().slice(0, 10) + '/' +
        Date.now() + '-' + crypto.randomUUID() + '-' + safeRemoteFileName(file.name);

      const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/');
      const uploadUrl =
        cfg.supabaseUrl + '/storage/v1/object/plant-documents/' + encodedPath;

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', uploadUrl, true);
        xhr.setRequestHeader('Authorization', 'Bearer ' + s.access_token);
        xhr.setRequestHeader('apikey', cfg.supabaseKey);
        xhr.setRequestHeader('x-upsert', 'false');
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

        xhr.upload.onprogress = e => {
          if (e.lengthComputable) {
            const p = Math.max(1, Math.min(99, Math.round((e.loaded / e.total) * 100)));
            bar.style.width = p + '%';
            pct.textContent = p + '%';
            status.textContent = 'Uploading to secure storage…';
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error('Upload failed: ' + (xhr.responseText || xhr.status)));
        };
        xhr.onerror = () => reject(new Error('Network upload failed.'));
        xhr.send(file);
      });

      const { data: insertedRows, error: dbError } = await client().from('documents').insert({
        file_name: file.name,
        storage_path: storagePath,
        category: (window.pp360UploadContext && window.pp360UploadContext.category) || guessCategory(file.name),
        document_type: guessDocType(file.name),
        file_size: file.size,
        mime_type: file.type || null,
        processing_status: file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf') ? 'processing' : 'uploaded',
        uploaded_by: s.user.id,
        metadata: {
          original_name: file.name,
          section: (window.pp360UploadContext && window.pp360UploadContext.section) || '',
          source_path: (window.pp360UploadContext && window.pp360UploadContext.sourcePath) || ''
        }
      }).select('id').single();

      if (dbError) {
        await client().storage.from('plant-documents').remove([storagePath]);
        throw dbError;
      }

      bar.style.width = '100%';
      pct.textContent = '100%';

      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        status.textContent = 'Upload complete. Extracting PDF text page by page…';
        try {
          const extracted = await extractPdfText(file);
          const { error: extractError } = await client().from('documents').update({
            extracted_text: extracted.combined,
            page_count: extracted.pageCount,
            processing_status: 'ready',
            updated_at: new Date().toISOString()
          }).eq('id', insertedRows.id);
          if (extractError) throw extractError;
          status.innerHTML = '<span class="oktext">✓ Secure upload + PDF indexing completed</span>';
        } catch (extractErr) {
          await client().from('documents').update({
            processing_status: 'error',
            updated_at: new Date().toISOString(),
            metadata: {
              original_name: file.name,
              section: (window.pp360UploadContext && window.pp360UploadContext.section) || '',
              source_path: (window.pp360UploadContext && window.pp360UploadContext.sourcePath) || '',
              extraction_error: String(extractErr.message || extractErr)
            }
          }).eq('id', insertedRows.id);
          status.innerHTML = '<span class="errtext">Upload saved, but PDF text extraction failed: ' + esc(extractErr.message || String(extractErr)) + '</span>';
        }
      } else {
        status.innerHTML = '<span class="oktext">✓ Secure upload completed</span>';
      }

      if (!options.suppressReload) await loadDocsFromBackend();
      return true;
    } catch (err) {
      bar.classList.add('errorbar');
      pct.textContent = 'Error';
      status.innerHTML = '<span class="errtext">✕ ' + esc(err.message || String(err)) + '</span>';
      return false;
    }
  }


  function packageMimeType(name) {
    const ext = (name.split('.').pop() || '').toLowerCase();
    const map = {
      pdf:'application/pdf',
      doc:'application/msword',
      docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls:'application/vnd.ms-excel',
      xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv:'text/csv',
      txt:'text/plain',
      png:'image/png',
      jpg:'image/jpeg',
      jpeg:'image/jpeg',
      html:'text/html',
      htm:'text/html'
    };
    return map[ext] || 'application/octet-stream';
  }

  function inferPackageSection(path, fallbackSection='') {
    if (fallbackSection) return fallbackSection;
    const p = norm(path);
    if (/pressure[ -]?part|superheater|economi[sz]er|evaporator|water wall|steam drum|header|downcomer|riser/.test(p)) return 'Pressure Parts';
    if (/drawing|p&id|pid|ga |layout|diagram/.test(p)) return 'Drawings & P&IDs';
    if (/interlock|permissive|logic|bms|plc|cause effect/.test(p)) return 'Interlocks & Logic';
    if (/e ?& ?i|electrical|instrument|transmitter|sensor|switch|cable|mcc|vfd/.test(p)) return 'Electrical & C&I';
    if (/vendor|fan|pump|valve|feeder|motor|actuator|burner|esp|cems|swas/.test(p)) return 'Vendor Manuals / Auxiliaries';
    if (/operation|startup|shutdown|loading/.test(p)) return 'Operation';
    if (/maintenance|maintainance|lubrication|spare/.test(p)) return 'Maintenance';
    if (/design|specification|technical data|datasheet/.test(p)) return 'Technical Data';
    if (/description/.test(p)) return 'Description';
    return 'General';
  }

  window.handleEquipmentPackageUpload = async function(zipFile, category='General', fixedSection='') {
    if (!window.JSZip) {
      alert('ZIP reader is not loaded. Please use Hard Refresh and try again.');
      return;
    }
    if (!backendSession || backendRole !== 'admin') {
      alert('Please sign in as Admin before uploading a manual package.');
      return;
    }

    const v = document.getElementById('view');
    if (!v) return;
    v.innerHTML = `<div class="card">
      <span class="badge">${esc(category)}</span>
      <h2>Manual Package Upload</h2>
      <div class="notice">The ZIP stays on this computer. PowerPlant360 extracts supported documents locally and uploads the individual files securely.</div>
      <div id="packageSummary" class="uploaditem">
        <div class="uploadrow"><div><b>${esc(zipFile.name)}</b><div class="muted small">${formatBytes(zipFile.size)}</div></div><div id="pkgPct">0%</div></div>
        <div class="progress"><div id="pkgBar" class="progressbar" style="width:0%"></div></div>
        <div id="pkgStatus" class="uploadstatus muted">Reading ZIP package…</div>
      </div>
      <div id="packageCurrent"></div>
    </div>`;

    const pkgBar=document.getElementById('pkgBar');
    const pkgPct=document.getElementById('pkgPct');
    const pkgStatus=document.getElementById('pkgStatus');
    const current=document.getElementById('packageCurrent');

    try {
      const zip = await JSZip.loadAsync(zipFile);
      const allowed = new Set(['pdf','doc','docx','xls','xlsx','csv','txt','png','jpg','jpeg','html','htm']);
      const entries = Object.values(zip.files).filter(z => {
        if (z.dir) return false;
        const n=z.name || '';
        if (n.includes('__MACOSX/') || /(^|\/)\./.test(n)) return false;
        const ext=(n.split('.').pop() || '').toLowerCase();
        return allowed.has(ext);
      });

      if (!entries.length) throw new Error('No supported documents were found inside this ZIP.');

      let ok=0, failed=0;
      pkgStatus.textContent = entries.length + ' supported files found. Starting secure upload…';

      for (let i=0;i<entries.length;i++) {
        const entry=entries[i];
        const baseName=(entry.name.split('/').pop() || ('file-'+(i+1))).trim();
        const section=inferPackageSection(entry.name, fixedSection);
        const blob=await entry.async('blob');
        const file=new File([blob],baseName,{type:packageMimeType(baseName),lastModified:Date.now()});

        const itemId='pkg_current_file';
        current.innerHTML=`
          <div class="uploaditem" id="${itemId}">
            <div class="uploadrow">
              <div><b>${esc(baseName)}</b><div class="muted small">${esc(section)} • ${esc(entry.name)}</div></div>
              <div class="uploadpct" id="${itemId}_pct">0%</div>
            </div>
            <div class="progress"><div class="progressbar" id="${itemId}_bar" style="width:0%"></div></div>
            <div class="uploadstatus muted" id="${itemId}_status">Preparing…</div>
          </div>`;

        window.pp360UploadContext={category,section,sourcePath:entry.name};
        const success=await uploadRealFile(file,itemId,{suppressReload:true});
        if(success) ok++; else failed++;

        const pct=Math.round(((i+1)/entries.length)*100);
        pkgBar.style.width=pct+'%';
        pkgPct.textContent=pct+'%';
        pkgStatus.textContent='Processed '+(i+1)+' of '+entries.length+' files • '+ok+' successful'+(failed?' • '+failed+' failed':'');
      }

      window.pp360UploadContext=null;
      await loadDocsFromBackend();
      pkgBar.style.width='100%';
      pkgPct.textContent='100%';
      pkgStatus.innerHTML='<span class="oktext">✓ Package completed: '+ok+' files uploaded'+(failed?' • '+failed+' failed':'')+'</span>';
      current.innerHTML='<div class="notice"><b>Package organization complete.</b> Open Admin to review all uploaded documents, or return to the equipment page and search the indexed PDFs.</div>';
    } catch (err) {
      window.pp360UploadContext=null;
      pkgStatus.innerHTML='<span class="errtext">✕ Package processing failed: '+esc(err.message || String(err))+'</span>';
    }
  };


  async function indexExistingPdf(id) {
    const d = docs.find(x => x.id === id);
    if (!d) return;
    if (!confirm('Index this PDF now?')) return;

    try {
      const { error: markError } = await client()
        .from('documents')
        .update({ processing_status:'processing', updated_at:new Date().toISOString() })
        .eq('id', id);
      if (markError) throw markError;

      await loadDocsFromBackend();

      const { data: blob, error: downloadError } =
        await client().storage.from('plant-documents').download(d.storage_path);
      if (downloadError) throw downloadError;

      const extracted = await extractPdfText(blob);

      const { error: updateError } = await client()
        .from('documents')
        .update({
          extracted_text: extracted.combined,
          page_count: extracted.pageCount,
          processing_status:'ready',
          updated_at:new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) throw updateError;
      await loadDocsFromBackend();
      alert('PDF indexing completed.');
    } catch (err) {
      await client().from('documents').update({
        processing_status:'error',
        updated_at:new Date().toISOString()
      }).eq('id', id);
      await loadDocsFromBackend();
      alert('PDF indexing failed: ' + (err.message || String(err)));
    }
  }

  window.indexExistingPdf = indexExistingPdf;

  async function loadDocsFromBackend() {
    const { data, error } = await client()
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      const wrap = document.getElementById('docTableWrap');
      if (wrap) wrap.innerHTML =
        '<div class="notice">Could not load documents: ' + esc(error.message) + '</div>';
      return;
    }

    docs = data || [];
    renderDocTable();
  }

  function renderStorageUsage() {
    const el = document.getElementById('storageUsage');
    if (!el) return;

    const storageLimit = 1024 * 1024 * 1024; // Supabase Free: 1 GB Storage
    const databaseLimit = 500 * 1024 * 1024; // Supabase Free: 500 MB database quota
    const storageUsed = docs.reduce((sum, d) => sum + Number(d.file_size || 0), 0);

    const encoder = new TextEncoder();
    const indexBytes = docs.reduce((sum, d) => {
      const txt = d.extracted_text || '';
      return sum + (txt ? encoder.encode(txt).length : 0);
    }, 0);

    const storagePct = Math.min(100, (storageUsed / storageLimit) * 100);
    const indexPct = Math.min(100, (indexBytes / databaseLimit) * 100);
    const remaining = Math.max(0, storageLimit - storageUsed);

    const level = p => p >= 90 ? 'danger' : p >= 75 ? 'warn' : 'good';
    const note = storagePct >= 90
      ? 'Storage is nearly full. Upgrade or remove old documents before large uploads.'
      : storagePct >= 75
        ? 'Storage is above 75%. Plan additional capacity soon.'
        : 'Storage capacity is healthy.';

    el.innerHTML = `
      <div class="usage-title"><h3>Storage & Index Capacity</h3><span class="usage-plan">Supabase Free-plan reference</span></div>
      <div class="usage-grid">
        <div class="usage-card"><span>Documents</span><strong>${docs.length}</strong><small>uploaded files</small></div>
        <div class="usage-card">
          <span>File Storage</span><strong>${formatBytes(storageUsed)} / 1 GB</strong>
          <div class="usage-track"><div class="usage-fill ${level(storagePct)}" style="width:${storagePct.toFixed(1)}%"></div></div>
          <small>${storagePct.toFixed(1)}% used</small>
        </div>
        <div class="usage-card">
          <span>Search Index</span><strong>${formatBytes(indexBytes)} / 500 MB</strong>
          <div class="usage-track"><div class="usage-fill ${level(indexPct)}" style="width:${indexPct.toFixed(1)}%"></div></div>
          <small>Estimated extracted-text size, not total DB size</small>
        </div>
        <div class="usage-card"><span>Storage Remaining</span><strong>${formatBytes(remaining)}</strong><small>${esc(note)}</small></div>
      </div>
    `;
  }

  renderDocTable = function () {
    renderStorageUsage();
    const wrap = document.getElementById('docTableWrap');
    if (!wrap) return;

    const fc = document.getElementById('filterCategory')?.value || '';
    const ft = document.getElementById('filterType')?.value || '';
    const qs = (document.getElementById('docSearch')?.value || '').toLowerCase();

    const list = docs.filter(d =>
      (!fc || d.category === fc) &&
      (!ft || d.document_type === ft) &&
      (!qs || (d.file_name || '').toLowerCase().includes(qs))
    );

    if (!list.length) {
      wrap.innerHTML = '<div class="emptydocs"><b>No files found.</b><p class="muted">Drag files into the upload box above.</p></div>';
      return;
    }

    wrap.innerHTML = `<div class="table-scroll"><table class="doctable">
      <tr>
        <th>Name</th><th>Category</th><th>Type</th><th>Size</th>
        <th>Uploaded</th><th>Status</th><th>Actions</th>
      </tr>
      ${list.map(d => `<tr>
        <td><b>${esc(d.file_name)}</b></td>
        <td>${esc(d.category || 'General')}</td>
        <td>${esc(d.document_type || 'Other')}</td>
        <td>${formatBytes(d.file_size)}</td>
        <td>${d.created_at ? new Date(d.created_at).toLocaleString() : '—'}</td>
        <td><span class="badge ok">${esc(d.processing_status || 'uploaded')}</span></td>
        <td class="nowrap">
          ${((d.mime_type||'').includes('pdf') || (d.file_name||'').toLowerCase().endsWith('.pdf')) && d.processing_status !== 'ready'
            ? `<button onclick="indexExistingPdf('${d.id}')">Index PDF</button>`
            : ''}
          <button onclick="viewDocument('${d.id}')">View</button>
          <button onclick="editDoc('${d.id}')">Edit</button>
          <button class="dangerbtn" onclick="del('${d.id}')">Delete</button>
        </td>
      </tr>`).join('')}
    </table></div>`;
  };

  editDoc = function (id) {
    const d = docs.find(x => x.id === id);
    if (!d) return;

    document.getElementById('view').insertAdjacentHTML('beforeend', `
      <div class="modalback" id="editModal">
        <div class="modalbox">
          <h3>Edit File Details</h3>
          <label>File name</label>
          <input value="${esc(d.file_name)}" disabled>
          <label>Category</label>
          <select id="editCategory">
            ${categories.map(c => `<option ${c === d.category ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
          <label>Document type</label>
          <select id="editType">
            ${docTypes.map(t => `<option ${t === d.document_type ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
          <div class="actions modalactions">
            <button class="primary" onclick="saveDocEdit('${d.id}')">Save</button>
            <button onclick="closeEdit()">Cancel</button>
          </div>
        </div>
      </div>`);
  };

  saveDocEdit = async function (id) {
    const category = document.getElementById('editCategory').value;
    const document_type = document.getElementById('editType').value;

    const { error } = await client()
      .from('documents')
      .update({
        category,
        document_type,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      alert('Update failed: ' + error.message);
      return;
    }

    closeEdit();
    await loadDocsFromBackend();
  };

  async function viewDocument(id) {
    let d = docs.find(x => x.id === id);

    if (!d) {
      const { data, error } = await client()
        .from('documents')
        .select('id,file_name,storage_path')
        .eq('id', id)
        .single();

      if (error || !data) {
        alert('Could not find this document.');
        return;
      }
      d = data;
    }

    const { data, error } = await client().storage
      .from('plant-documents')
      .createSignedUrl(d.storage_path, 600);

    if (error || !data?.signedUrl) {
      alert('Could not open document: ' + (error?.message || 'Signed link was not created.'));
      return;
    }

    const w = window.open(data.signedUrl, '_blank');
    if (!w) {
      window.location.href = data.signedUrl;
    }
  }

  window.viewDocument = viewDocument;
  del = async function (id) {
    const d = docs.find(x => x.id === id);
    if (!d) return;
    if (!confirm('Delete this plant document permanently?')) return;

    const { error: storageError } =
      await client().storage.from('plant-documents').remove([d.storage_path]);

    if (storageError) {
      alert('Storage delete failed: ' + storageError.message);
      return;
    }

    const { error: dbError } =
      await client().from('documents').delete().eq('id', id);

    if (dbError) {
      alert('Metadata delete failed: ' + dbError.message);
      return;
    }

    await loadDocsFromBackend();
  };


  const originalSearchAll = searchAll;
  searchAll = async function () {
    const raw = document.getElementById('q').value.trim();
    if (!raw) return;

    history = [raw, ...history.filter(x => norm(x) !== norm(raw))].slice(0, 30);
    localStorage.setItem('pp360history', JSON.stringify(history));

    if (backendSession && backendRole && ['admin','engineer','viewer'].includes(backendRole)) {
      const hits = await searchPrivateDocuments(raw);
      if (hits.length) {
        renderTabs();
        document.getElementById('view').innerHTML = renderPrivateHits(raw, hits);
        return;
      }
    }

    originalSearchAll();
  };

  restoreBackendSession();

  const headerRefresh = document.getElementById('refreshBtn');
  if (headerRefresh) headerRefresh.onclick = () => window.hardRefreshPP360();

})();
