
(() => {
  const cfg = window.PP360_CONFIG || {};
  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  }
  let backendSession = null;
  let backendRole = null;
  let passwordRecoveryMode = /(?:[?#&])type=recovery(?:&|$)/i.test(window.location.href);

  function backendConfigured() {
    return cfg.supabaseUrl &&
      cfg.supabaseKey &&
      !String(cfg.supabaseKey).includes('PASTE_YOUR_');
  }

  function client() {
    if (!backendConfigured()) return null;
    if (!window.pp360Supabase) {
      window.pp360Supabase = supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
        auth: {
          storage: window.sessionStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
    }
    return window.pp360Supabase;
  }

  function setAuthLocked(locked) {
    document.body.classList.toggle('auth-locked', Boolean(locked));
    document.body.classList.toggle('auth-ready', !locked);
    if (!locked) {
      document.body.classList.remove('public-login-open', 'public-recovery');
    }
  }

  // Public landing is informational only; portal content remains auth-gated.
  window.openPortalLogin = function () {
    if (!document.body.classList.contains('auth-locked')) return;
    showLoginGate();
    document.body.classList.add('public-login-open');
    document.getElementById('loginEmail')?.focus();
  };

  window.showPublicHome = function () {
    if (passwordRecoveryMode || !document.body.classList.contains('auth-locked')) return;
    document.body.classList.remove('public-login-open');
    document.getElementById('authGate')?.scrollIntoView({block:'start'});
  };

  function showLoginGate(message='') {
    passwordRecoveryMode = false;
    setAuthLocked(true);
    if (message) document.body.classList.add('public-login-open');
    const body = document.getElementById('authGateBody');
    if (!body) return;

    body.innerHTML =
      '<h1>Sign in</h1>' +
      '<p class="auth-help">Admin, Engineer and Viewer accounts use the same secure login.</p>' +
      '<label for="loginEmail">Email</label>' +
      '<input id="loginEmail" type="email" autocomplete="username" placeholder="Email address">' +
      '<label for="loginPassword">Password</label>' +
      '<div class="auth-password-wrap"><input id="loginPassword" type="password" autocomplete="current-password" placeholder="Password"><button type="button" class="auth-password-toggle" aria-label="Show password" aria-pressed="false" onclick="toggleAuthPassword(\'loginPassword\',this)">Show</button></div>' +
      '<button class="auth-primary" onclick="login()">Login</button>' +
      '<button class="auth-link" onclick="showForgotPassword()">Forgot password?</button>' +
      '<div id="loginMsg" class="auth-message">' + esc(message || '') + '</div>';

    if (document.body.classList.contains('public-login-open')) {
      setTimeout(() => document.getElementById('loginEmail')?.focus(), 0);
    }
  }
  window.showLoginGate = showLoginGate;

  // Presentation-only password visibility; never changes credentials or auth logic.
  window.toggleAuthPassword = function (inputId, button) {
    const field = document.getElementById(inputId);
    if (!field || !button) return;
    const visible = field.type === 'password';
    field.type = visible ? 'text' : 'password';
    button.textContent = visible ? 'Hide' : 'Show';
    button.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
    button.setAttribute('aria-pressed', String(visible));
    field.focus({preventScroll:true});
  };


  function showForgotPassword() {
    setAuthLocked(true);
    document.body.classList.add('public-login-open');
    const body = document.getElementById('authGateBody');
    if (!body) return;

    body.innerHTML =
      '<h1>Forgot password</h1>' +
      '<p class="auth-help">Enter your PowerPlant360 account email. We will send a secure password-reset link.</p>' +
      '<label for="resetEmail">Email</label>' +
      '<input id="resetEmail" type="email" autocomplete="email" placeholder="Email address">' +
      '<button class="auth-primary" id="resetRequestBtn" onclick="sendPasswordReset()">Send reset link</button>' +
      '<button class="auth-link" onclick="showLoginGate()">Back to Login</button>' +
      '<div id="resetMsg" class="auth-message"></div>';

    setTimeout(() => document.getElementById('resetEmail')?.focus(), 0);
  }
  window.showForgotPassword = showForgotPassword;

  window.sendPasswordReset = async function () {
    const emailEl = document.getElementById('resetEmail');
    const btn = document.getElementById('resetRequestBtn');
    const msg = document.getElementById('resetMsg');
    const email = emailEl?.value.trim() || '';

    if (!email || !email.includes('@')) {
      if (msg) msg.textContent = 'Enter a valid email address.';
      emailEl?.focus();
      return;
    }

    try {
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
      if (msg) msg.textContent = '';

      const cleanUrl = window.location.origin + window.location.pathname;
      const { error } = await client().auth.resetPasswordForEmail(email, {
        redirectTo: cleanUrl
      });
      if (error) throw error;

      if (msg) msg.textContent = '✓ Reset link sent. Check your email, open the link, and set a new password.';
    } catch (err) {
      if (msg) msg.textContent = 'Could not send reset link: ' + (err?.message || String(err));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Send reset link'; }
    }
  };

  function showPasswordRecoveryGate(message='') {
    passwordRecoveryMode = true;
    setAuthLocked(true);
    document.body.classList.add('public-login-open', 'public-recovery');
    const body = document.getElementById('authGateBody');
    if (!body) return;

    body.innerHTML =
      '<h1>Set new password</h1>' +
      '<p class="auth-help">Create a new password for your PowerPlant360 account.</p>' +
      '<label for="newRecoveryPassword">New password</label>' +
      '<input id="newRecoveryPassword" type="password" autocomplete="new-password" placeholder="Minimum 8 characters">' +
      '<label for="confirmRecoveryPassword">Confirm new password</label>' +
      '<input id="confirmRecoveryPassword" type="password" autocomplete="new-password" placeholder="Re-enter new password">' +
      '<button class="auth-primary" id="saveRecoveryPasswordBtn" onclick="saveRecoveryPassword()">Save new password</button>' +
      '<div id="recoveryMsg" class="auth-message">' + esc(message || '') + '</div>';

    setTimeout(() => document.getElementById('newRecoveryPassword')?.focus(), 0);
  }
  window.showPasswordRecoveryGate = showPasswordRecoveryGate;

  window.saveRecoveryPassword = async function () {
    const p1 = document.getElementById('newRecoveryPassword')?.value || '';
    const p2 = document.getElementById('confirmRecoveryPassword')?.value || '';
    const btn = document.getElementById('saveRecoveryPasswordBtn');
    const msg = document.getElementById('recoveryMsg');

    if (p1.length < 8) {
      if (msg) msg.textContent = 'Password must be at least 8 characters.';
      return;
    }
    if (p1 !== p2) {
      if (msg) msg.textContent = 'Passwords do not match.';
      return;
    }

    try {
      if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
      const { error } = await client().auth.updateUser({password:p1});
      if (error) throw error;

      try { if (backendSession?.user?.id) sessionStorage.removeItem('pp360-session-answers:'+backendSession.user.id); } catch (_) {}
      await client().auth.signOut();
      backendSession = null;
      backendRole = null;
      admin = false;
      docs = [];
      window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
      applySearchRoleUi();
      showLoginGate('✓ Password updated. Please sign in with your new password.');
    } catch (err) {
      if (msg) msg.textContent = 'Password update failed: ' + (err?.message || String(err));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Save new password'; }
    }
  };

  function openAuthenticatedApp() {
    if (!backendSession || !backendRole) {
      showLoginGate();
      return;
    }
    setAuthLocked(false);
    if (typeof show === 'function') show('Home');
    applySearchRoleUi();
  }

  function applySearchRoleUi() {
    window.pp360BackendRole = backendRole;
    window.pp360SignedIn = Boolean(backendSession);
    window.pp360SearchUserId = backendSession?.user?.id || null;
    window.pp360SetHistoryUser?.(backendSession?.user?.id || null);

    const btn = document.getElementById('plantSearchBtn');
    const onlineBtn = document.getElementById('onlineSearchBtn');
    const scopeEl = document.getElementById('scope');
    const headerUser = document.getElementById('headerUser');

    if (headerUser) {
      if (backendSession?.user) {
        const email = String(backendSession.user.email || 'Signed-in user');
        const accountName = email.includes('@') ? email.split('@')[0] : email;
        const roleLabel = backendRole
          ? backendRole.charAt(0).toUpperCase() + backendRole.slice(1)
          : 'Authorized User';

        headerUser.innerHTML =
          '<div class="header-user-identity" title="' + esc(email) + '">' +
            '<strong>' + esc(accountName) + '</strong>' +
            '<small>' + esc(roleLabel) + ' · ' + esc(email) + '</small>' +
          '</div>' +
          '<button class="header-logout" onclick="logout()">Logout</button>';
      } else {
        headerUser.innerHTML = '';
      }
    }

    if (btn) {
      btn.textContent = backendRole === 'admin' || backendRole === 'engineer' || backendRole === 'viewer'
        ? 'Search Plant Data'
        : 'Search';
      btn.title = 'Search authorized plant documents only';
    }

    if (onlineBtn) {
      onlineBtn.style.display = backendRole === 'admin' ? '' : 'none';
      onlineBtn.disabled = false;
      onlineBtn.textContent = 'Online Search';
      onlineBtn.title = 'Search current online references';
    }

    if (scopeEl) {
      if (backendRole === 'admin') {
        scopeEl.textContent = 'Authorized Admin mode: private plant documents enabled. Online Search is available separately.';
      } else if (backendRole === 'engineer' || backendRole === 'viewer') {
        scopeEl.textContent = 'Authorized Plant Data mode: private plant documents enabled.';
      } else {
        scopeEl.textContent = 'Login required for PowerPlant360 access.';
      }
    }

    if (typeof renderTabs === 'function') {
      const activeBtn = document.querySelector('#tabs button.active');
      const activeTab = activeBtn?.textContent?.trim() || 'Home';

      if ((backendRole === 'engineer' || backendRole === 'viewer') && activeTab === 'Admin') {
        if (typeof show === 'function') show('Home');
        else renderTabs('Home');
      } else {
        renderTabs(activeTab);
      }
    }

    // Defense-in-depth: never leave an Admin navigation button visible
    // for signed-in Engineer or Viewer accounts, even if an older app.js
    // is still cached by the browser.
    if (backendRole === 'engineer' || backendRole === 'viewer') {
      document.querySelectorAll('#tabs button').forEach(tabBtn => {
        if (String(tabBtn.textContent || '').trim() === 'Admin') tabBtn.remove();
      });
    }
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
    applySearchRoleUi();
  }

  async function restoreBackendSession() {
    if (!backendConfigured()) {
      showLoginGate('Backend configuration is unavailable.');
      return;
    }

    client().auth.onAuthStateChange(async (event, newSession) => {
      backendSession = newSession;

      if (event === 'PASSWORD_RECOVERY') {
        passwordRecoveryMode = true;
        showPasswordRecoveryGate();
        return;
      }

      if (passwordRecoveryMode) {
        showPasswordRecoveryGate();
        return;
      }

      if (!newSession) {
        backendRole = null;
        admin = false;
        applySearchRoleUi();
        showLoginGate();
        return;
      }

      await refreshBackendRole();
      applySearchRoleUi();

      if (backendRole === 'admin' || backendRole === 'engineer' || backendRole === 'viewer') {
        openAuthenticatedApp();
      } else {
        await client().auth.signOut();
        backendSession = null;
        backendRole = null;
        admin = false;
        applySearchRoleUi();
        showLoginGate('This account does not have a PowerPlant360 role.');
      }
    });

    const { data } = await client().auth.getSession();
    backendSession = data.session;

    if (passwordRecoveryMode) {
      showPasswordRecoveryGate();
      return;
    }

    if (!backendSession) {
      backendRole = null;
      admin = false;
      applySearchRoleUi();
      showLoginGate();
      return;
    }

    await refreshBackendRole();

    if (backendRole === 'admin' || backendRole === 'engineer' || backendRole === 'viewer') {
      openAuthenticatedApp();
    } else {
      await client().auth.signOut();
      backendSession = null;
      backendRole = null;
      admin = false;
      applySearchRoleUi();
      showLoginGate('This account does not have a PowerPlant360 role.');
    }
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
      {category:'CFBC Boiler', terms:['esp','electrostatic precipitator']},
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
      {label:'ID Fan', category:'CFBC Boiler', exact:['id fan','induced draft fan'], vendorQuery:'id fan make'},
      {label:'PA Fan', category:'CFBC Boiler', exact:['pa fan','primary air fan'], vendorQuery:'pa fan make'},
      {label:'SA Fan', category:'CFBC Boiler', exact:['sa fan','secondary air fan'], vendorQuery:'sa fan make'},
      {label:'BFP', category:'CFBC Boiler', exact:['bfp','bfw pump','boiler feed pump','boiler feed water pump'], vendorQuery:'bfp make'},
      {label:'Steam Turbine', category:'Steam Turbine', exact:['steam turbine','turbine'], vendorQuery:'turbine make'},
      {label:'Air Cooled Condenser', category:'Air Cooled Condenser', exact:['acc','air cooled condenser'], vendorQuery:'acc make'},
      {label:'ESP', category:'CFBC Boiler', exact:['esp','electrostatic precipitator'], vendorQuery:'esp make'}
    ];
    return defs.find(d => d.exact.includes(nq)) || null;
  }

  function equipmentSummaryFromDocuments(eq, documents) {
    if (!eq) return null;

    const terms = eq.exact.map(norm);
    const candidates = (documents || [])
      .filter(d => {
        if (eq.category && norm(d.category || '') === norm(eq.category)) return true;
        const hay = norm([
          d.file_name,
          d.document_type,
          (d.metadata && d.metadata.section) || '',
          (d.metadata && d.metadata.source_path) || ''
        ].join(' '));
        return terms.some(t => hay.includes(t));
      })
      .map(d => {
        const hay = norm([
          d.file_name,
          d.document_type,
          (d.metadata && d.metadata.section) || '',
          (d.metadata && d.metadata.source_path) || ''
        ].join(' '));
        let score = 0;
        if (eq.category && norm(d.category || '') === norm(eq.category)) score += 400;
        if (/technical data|datasheet|data sheet|specification|nameplate|offer/.test(hay)) score += 260;
        if (/manual|o&m/.test(hay)) score += 100;
        if (/motor|bearing|actuator|junction box|cable/.test(hay)) score -= 180;
        return {d,score};
      })
      .sort((a,b)=>b.score-a.score);

    for (const item of candidates) {
      const d = item.d;
      const raw = String(d.extracted_text || '').replace(/\s+/g,' ').trim();
      if (!raw) continue;

      const rows = [];
      const add = (label, value) => {
        value = String(value || '').replace(/\s+/g,' ').replace(/[,:;.-]+$/,'').trim();
        if (!value || value.length > 90) return;
        if (rows.some(r => r.label === label && r.value === value)) return;
        rows.push({label,value});
      };

      if (eq.label === 'Air Cooled Condenser') {
        let m;
        m = raw.match(/AIR\s+COOLED\s+CONDENSER\s*\(ACC\).*?DESCRIPTION\s+([A-Z][A-Z &().'-]{3,60}?(?:LIMITED|LTD\.?))(?=\s+\|?\s*General|\s+General|\s+Offer|$)/i);
        if (m) add('Manufacturer', m[1]);

        m = raw.match(/Type\s+of\s+condenser\s*[:=\-]?\s*(.{2,60}?)(?=\s+(?:steam\s+quantity|capacity|design|heat|vacuum|pressure|temperature))/i);
        if (m) add('Type of condenser', m[1]);

        m = raw.match(/steam\s+quantity\s*\(?\s*tph\s*\)?\s*[:=\-]?\s*([0-9.,]+)/i);
        if (m) add('Steam quantity', m[1] + ' TPH');

        m = raw.match(/(?:design\s+)?back\s*pressure\s*[:=\-]?\s*([0-9.,]+\s*(?:bar|mbar|kPa|mmHg|ata)?)/i);
        if (m) add('Back pressure', m[1]);

        m = raw.match(/(?:number\s+of\s+)?(?:fan|fans)\s*[:=\-]?\s*([0-9]{1,3})/i);
        if (m) add('Fans', m[1]);
      }

      const general = [
        ['Make', /\b(?:Make|Manufacturer|OEM)\s*[:=\-]?\s*([^;|]{2,60}?)(?=\s+(?:Model|Type|Rated|Speed|Pressure|Temperature|Capacity|Flow|Head|Power|Voltage|Current|Frequency|Efficiency|Serial|$))/i],
        ['Model / Type', /\b(?:Model|Type)\s*[:=\-]?\s*([^;|]{2,60}?)(?=\s+(?:Make|Rated|Speed|Pressure|Temperature|Capacity|Flow|Head|Power|Voltage|Current|Frequency|Efficiency|Serial|$))/i],
        ['Rated output', /\bRated\s+Output\s*[:=\-]?\s*([0-9.,]+\s*(?:kW|MW)?)/i],
        ['Rated speed', /\bRated\s+Speed\s*[:=\-]?\s*([0-9.,]+\s*(?:RPM|rpm)?)/i],
        ['Capacity / Flow', /\b(?:Rated\s+)?(?:Capacity|Flow)\s*[:=\-]?\s*([0-9.,]+\s*(?:m3\/h|m³\/h|TPH|t\/h|kg\/s)?)/i]
      ];
      for (const [label,re] of general) {
        const m = raw.match(re);
        if (m) add(label,m[1]);
      }

      if (rows.length >= 2) {
        return {
          rows: rows.slice(0,10),
          id:d.id,
          storage_path:d.storage_path,
          file_name:d.file_name,
          category:d.category,
          document_type:d.document_type
        };
      }
    }

    return null;
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

  async function searchPrivateDocuments(q, forcedScope='') {
    if (!backendSession || !client()) return [];
    let query = client()
      .from('documents')
      .select('id,file_name,storage_path,category,document_type,processing_status,extracted_text,page_count,metadata')
      .eq('processing_status', 'ready')
      .not('extracted_text', 'is', null);

    if (forcedScope) query = query.eq('category', forcedScope);

    const { data, error } = await query;
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
      const summary = equipmentSummaryFromDocuments(exactEquipment, data);
      if (summary) {
        return [{
          score:100000,
          direct_rows:summary.rows,
          id:summary.id,
          storage_path:summary.storage_path,
          file_name:summary.file_name,
          page:null,
          text:'',
          category:summary.category,
          document_type:summary.document_type,
          section:'Technical Data',
          source_path:'',
          detail_matched:1,
          detail_total:1,
          detail_ratio:1
        }];
      }

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
  function genericTechnicalRows(q, hits) {
    const nq = norm(q);
    const wantsList = /(details|data|specification|specifications|parameters|technical|nameplate|rating|ratings|surface|dimensions)/.test(nq);
    if (!wantsList) return null;

    const defs = [
      ['Make', /\b(?:Make|Manufacturer|OEM)\s*[:=\-]?\s*([^;|]{1,60}?)(?=\s+(?:Model|Type|Rated|Speed|Pressure|Temperature|Capacity|Flow|Head|Power|Voltage|Current|Frequency|Efficiency|Material|Bearing|Serial|$))/i],
      ['Model / Type', /\b(?:Model|Type)\s*[:=\-]?\s*([^;|]{1,60}?)(?=\s+(?:Make|Rated|Speed|Pressure|Temperature|Capacity|Flow|Head|Power|Voltage|Current|Frequency|Efficiency|Material|Bearing|Serial|$))/i],
      ['Rated output', /\bRated\s+Output\s*[:=\-]?\s*([0-9.,]+\s*(?:kW|MW)?)/i],
      ['Rated speed', /\bRated\s+Speed\s*[:=\-]?\s*([0-9.,]+\s*(?:RPM|rpm)?)/i],
      ['Pressure', /\b(?:Rated|Design|Inlet Steam)?\s*Pressure\s*[:=\-]?\s*([0-9.,]+\s*(?:ata|bar|kg\/?cm2|kg\/?cm²|MPa|kPa)?)/i],
      ['Temperature', /\b(?:Rated|Design|Inlet Steam)?\s*Temperature\s*[:=\-]?\s*([0-9.,]+\s*°?\s*C?)/i],
      ['Capacity / Flow', /\b(?:Rated\s+)?(?:Capacity|Flow)\s*[:=\-]?\s*([0-9.,]+\s*(?:m3\/h|m³\/h|TPH|t\/h|kg\/s)?)/i],
      ['Head', /\b(?:Rated\s+)?Head\s*[:=\-]?\s*([0-9.,]+\s*(?:m|mWC)?)/i],
      ['Power', /\b(?:Rated\s+)?Power\s*[:=\-]?\s*([0-9.,]+\s*(?:kW|MW)?)/i],
      ['Voltage', /\b(?:Rated\s+)?Voltage\s*[:=\-]?\s*([0-9.,]+\s*(?:V|kV)?)/i],
      ['Current', /\b(?:Rated\s+)?Current\s*[:=\-]?\s*([0-9.,]+\s*A?)/i],
      ['Frequency', /\bFrequency\s*[:=\-]?\s*([0-9.,]+\s*Hz?)/i],
      ['Efficiency', /\bEfficiency\s*[:=\-]?\s*([0-9.,]+\s*%?)/i],
      ['Density', /\b(?:Bed\s+Material\s+Density|Bulk\s+Density|Density)\s*[:=\-]?\s*([0-9.,]+\s*(?:kg\/?m3|kg\/?m³|t\/?m3|g\/?cc)?)/i],
      ['Material', /\bMaterial\s*[:=\-]?\s*([^;|]{1,50}?)(?=\s+(?:Make|Model|Type|Rated|Speed|Pressure|Temperature|Capacity|Flow|Head|Power|Voltage|Current|Frequency|Efficiency|Bearing|Serial|$))/i],
      ['Bearing', /\bBearing(?:\s+(?:No|Type))?\s*[:=\-]?\s*([^;|]{1,60}?)(?=\s+(?:Make|Model|Type|Rated|Speed|Pressure|Temperature|Capacity|Flow|Head|Power|Voltage|Current|Frequency|Efficiency|Material|Serial|$))/i]
    ];

    for(const hit of hits || []){
      const raw=String(hit.text||'').replace(/\s+/g,' ').trim();
      if(!raw) continue;
      const rows=[];
      const seen=new Set();
      for(const [label,re] of defs){
        const m=raw.match(re);
        if(!m || !m[1]) continue;
        const value=cleanDisplayedAnswer(m[1]);
        if(!value || value.length>80) continue;
        const key=label+'|'+value;
        if(seen.has(key)) continue;
        seen.add(key);
        rows.push({label,value});
      }
      if(rows.length>=2) return {rows:rows.slice(0,12),hit};
    }
    return null;
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

  function answerHtml(answer) {
    const cleaned = cleanDisplayedAnswer(answer);
    const parts = cleaned.split(/\s*[|•]\s*/).map(x=>x.trim()).filter(Boolean);
    if (parts.length > 1) {
      return '<div class="simple-answer-lines">' + parts.map(x=>'<div>'+esc(x)+'</div>').join('') + '</div>';
    }
    return '<div class="onelineanswer"><b>' + esc(cleaned) + '</b></div>';
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

    if (hits[0] && Array.isArray(hits[0].direct_rows) && hits[0].direct_rows.length) {
      const rows = hits[0].direct_rows.map(r =>
        '<div class="multi-answer-row"><span>' + esc(r.label) + '</span><b>' + esc(r.value) + '</b></div>'
      ).join('');
      const view = hits[0].id
        ? '<div class="result-actions"><button onclick="viewDocument(\'' + hits[0].id + '\')">View related document</button></div>'
        : '';
      return '<div class="card result compactresult"><div class="multi-answer">' + rows + '</div>' + view + '</div>';
    }

    const multi = structuredMultiValueAnswer(q,hits);
    if (multi) {
      const rows = multi.rows.map(r =>
        '<div class="multi-answer-row"><span>' + esc(r.label) + '</span><b>' + esc(r.value) + '</b></div>'
      ).join('');
      const view = multi.hit && multi.hit.id
        ? '<div class="result-actions"><button onclick="viewDocument(\'' + multi.hit.id + '\'' + (multi.hit.page ? ',' + Number(multi.hit.page) : '') + ')">View related document' + (multi.hit.page ? ' · Page ' + Number(multi.hit.page) : '') + '</button></div>'
        : '';
      return '<div class="card result compactresult"><div class="multi-answer">' + rows + '</div>' + view + '</div>';
    }

    const genericRows = genericTechnicalRows(q,hits);
    if (genericRows) {
      const rows = genericRows.rows.map(r =>
        '<div class="multi-answer-row"><span>' + esc(r.label) + '</span><b>' + esc(r.value) + '</b></div>'
      ).join('');
      const view = genericRows.hit && genericRows.hit.id
        ? '<div class="result-actions"><button onclick="viewDocument(\'' + genericRows.hit.id + '\'' + (genericRows.hit.page ? ',' + Number(genericRows.hit.page) : '') + ')">View related document' + (genericRows.hit.page ? ' · Page ' + Number(genericRows.hit.page) : '') + '</button></div>'
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
      ? '<div class="result-actions"><button onclick="viewDocument(\'' + answerHit.id + '\'' + (answerHit.page ? ',' + Number(answerHit.page) : '') + ')">View related document' + (answerHit.page ? ' · Page ' + Number(answerHit.page) : '') + '</button></div>'
      : '';

    return '<div class="card result compactresult">' + answerHtml(answer) + view + '</div>';
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

    v.innerHTML = `<div class="card admin admin-dashboard-card">
      <div class="adminhead admin-dashboard-head">
        <div>
          <h2>Admin</h2>
          <p class="muted">${esc(backendSession.user.email || 'Admin')}</p>
        </div>
      </div>

      <div class="admin-dashboard">
        <aside class="admin-side-nav" aria-label="Admin sections">
          <button class="admin-side-btn" data-admin-nav="upload" onclick="showAdminPanel('upload',this)">
            <span class="admin-nav-icon">⬆</span><span>Upload Documents</span>
          </button>
          <button class="admin-side-btn" data-admin-nav="system" onclick="showAdminPanel('system',this)">
            <span class="admin-nav-icon">▥</span><span>System Status</span>
          </button>
          <button class="admin-side-btn" data-admin-nav="users" onclick="showAdminPanel('users',this)">
            <span class="admin-nav-icon">👥</span><span>User Management</span>
          </button>
          <button class="admin-side-btn" data-admin-nav="backup" onclick="showAdminPanel('backup',this)">
            <span class="admin-nav-icon">◫</span><span>Backup & Recovery</span>
          </button>
          <button class="admin-side-btn active" data-admin-nav="documents" onclick="showAdminPanel('documents',this)">
            <span class="admin-nav-icon">▤</span><span>Stored Documents</span>
          </button>
        </aside>

        <section class="admin-main-panel">
          <div class="admin-panel" data-admin-panel="upload" hidden>
            <div class="admin-panel-heading">
              <h3>Upload Documents</h3>
              <p class="muted">Upload plant files or paste a screenshot directly.</p>
            </div>

            <div id="dropZone" class="dropzone admin-upload-box" tabindex="0">
              <div class="dropicon">⬆️</div>
              <h3>Upload plant files</h3>

              <div class="paste-upload-category">
                <label for="uploadCategory">Department</label>
                <select id="uploadCategory">
                  <option value="">Auto detect from filename</option>
                  ${categories.map(c => `<option>${c}</option>`).join('')}
                </select>
              </div>

              <div class="paste-upload-hint"><b>Paste screenshot:</b> click here, then press <b>Ctrl+V</b></div>
              <p>or</p>
              <label class="uploadchoose">Choose Files
                <input id="file" type="file" multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg" hidden>
              </label>
              <p class="muted">Private storage • PDF, Word, Excel, CSV, TXT and images</p>
            </div>

            <div id="uploadQueue" class="uploadqueue"></div>
          </div>

          <div class="admin-panel" data-admin-panel="system" hidden>
            <div class="admin-panel-heading">
              <h3>System Status</h3>
              <p class="muted">Storage, indexing and AI usage at a glance.</p>
            </div>
            <div class="compact-status-area">
              <div id="storageUsage" class="storage-usage"><div class="muted small">Storage monitor loading…</div></div>
              <div id="apiUsage" class="storage-usage"><div class="muted small">AI Usage & Cost loading…</div></div>
            </div>
          </div>

          <div class="admin-panel" data-admin-panel="users" hidden>
            <div class="admin-panel-heading">
              <h3>User Management</h3>
              <p class="muted">Create and manage Engineer and Viewer accounts.</p>
            </div>

            <div class="user-management-body admin-panel-body-clean">
              <div class="user-create-grid">
                <div>
                  <label for="newUserEmail">Email</label>
                  <input id="newUserEmail" type="email" autocomplete="off" placeholder="engineer@example.com">
                </div>
                <div>
                  <label for="newUserPassword">Temporary password</label>
                  <input id="newUserPassword" type="password" autocomplete="new-password" placeholder="Minimum 8 characters">
                </div>
                <div>
                  <label for="newUserRole">Role</label>
                  <select id="newUserRole">
                    <option value="engineer">Engineer</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
                <div class="user-create-action">
                  <button class="primary" id="createUserBtn" onclick="createManagedUser()">Add User</button>
                </div>
              </div>
              <div id="userManageMsg" class="muted small"></div>
              <div class="user-test-note">For role testing, use an <b>Incognito / Private</b> window.</div>
              <div id="userListWrap" class="user-list-wrap"><div class="muted small">Loading users…</div></div>
            </div>
          </div>

          <div class="admin-panel" data-admin-panel="backup" hidden>
            <div class="admin-panel-heading">
              <h3>Backup & Recovery</h3>
              <p class="muted">Create database and private-file recovery backups.</p>
            </div>

            <div class="backup-body admin-panel-body-clean">
              <div class="backup-grid">
                <div class="backup-option">
                  <h4>Database Backup</h4>
                  <p class="muted small">Metadata, indexed text, users/roles and API usage.</p>
                  <button class="primary" id="backupJsonBtn" onclick="exportProductionBackup()">Export Database Backup</button>
                </div>

                <div class="backup-option">
                  <h4>Private Files Backup</h4>
                  <p class="muted small">Download one department as a recovery ZIP.</p>
                  <select id="backupCategory">
                    <option value="">Select department</option>
                    ${categories.map(c => `<option>${c}</option>`).join('')}
                  </select>
                  <button id="backupZipBtn" onclick="backupDepartmentZip()">Download Department ZIP</button>
                </div>
              </div>

              <div id="backupStatus" class="muted small backup-status"></div>
              <div class="backup-actions">
                <button onclick="window.open('BACKUP_RECOVERY.md','_blank')">Recovery Guide</button>
              </div>
            </div>
          </div>

          <div class="admin-panel active" data-admin-panel="documents">
            <div class="admin-panel-heading">
              <h3>Stored Documents</h3>
              <p class="muted">View and manage uploaded plant documents department-wise.</p>
            </div>

            <div class="department-filter-wrap">
              <div class="department-filter-label">Department</div>
              <div class="department-filter-buttons">
                ${categories.map(c => `<button class="dept-filter-btn" data-category="${esc(c)}" onclick="setAdminDocCategory('${esc(c)}',this)">${esc(c)}</button>`).join('')}
              </div>
              <select id="filterCategory" class="admin-hidden-filter" aria-hidden="true">
                <option value="">All categories</option>
                ${categories.map(c => `<option>${c}</option>`).join('')}
              </select>
            </div>

            <input id="filterType" type="hidden" value="">
            <input id="docSearch" type="hidden" value="">
            <div id="docTableWrap"><div class="admin-doc-placeholder">Select a department above to view its uploaded documents.</div></div>
          </div>
        </section>
      </div>
    </div>`;

    setupDropZone();
    setupAdminClipboardPaste();
    await loadDocsFromBackend();
    await loadApiUsage();
    await loadUserManagement();
  };

  login = async function () {
    const emailEl = document.getElementById('loginEmail');
    const passwordEl = document.getElementById('loginPassword');
    const email = emailEl?.value.trim() || '';
    const password = passwordEl?.value || '';
    const msg = document.getElementById('loginMsg');

    if (!email || !password) {
      if (msg) msg.textContent = 'Enter your email and password.';
      return;
    }

    if (msg) msg.textContent = 'Signing in…';

    const { data, error } = await client().auth.signInWithPassword({ email, password });
    if (error) {
      if (msg) msg.textContent = error.message;
      return;
    }

    backendSession = data.session;
    await refreshBackendRole();

    if (!['admin','engineer','viewer'].includes(String(backendRole || ''))) {
      await client().auth.signOut();
      backendSession = null;
      backendRole = null;
      admin = false;
      applySearchRoleUi();
      showLoginGate('This account does not have a PowerPlant360 role.');
      return;
    }

    if (passwordEl) passwordEl.value = '';
    openAuthenticatedApp();
  };

  logout = async function () {
    try { if (backendSession?.user?.id) sessionStorage.removeItem('pp360-session-answers:'+backendSession.user.id); } catch (_) {}
    backendSession = null;
    backendRole = null;
    admin = false;
    docs = [];
    applySearchRoleUi();
    showLoginGate('You have been logged out.');
    if (client()) await client().auth.signOut();
  };

  function safeRemoteFileName(name) {
    return name.replace(/[^a-zA-Z0-9._-]+/g, '_');
  }

  function setupAdminClipboardPaste() {
    const dz = document.getElementById('dropZone');
    if (!dz || dz.dataset.pasteReady === '1') return;
    dz.dataset.pasteReady = '1';

    dz.addEventListener('click', (e) => {
      if (!e.target.closest('select,option,label,input,button,a')) dz.focus();
    });

    dz.addEventListener('paste', (e) => {
      if (backendRole !== 'admin') return;

      const items = [...(e.clipboardData?.items || [])];
      const imageItems = items.filter(item =>
        item.kind === 'file' && /^image\//i.test(item.type || '')
      );

      if (!imageItems.length) return;

      e.preventDefault();
      e.stopPropagation();

      const category = document.getElementById('uploadCategory')?.value || '';
      if (!category) {
        alert('Please select "Upload to department" before pasting a screenshot.');
        document.getElementById('uploadCategory')?.focus();
        return;
      }

      const now = new Date();
      const stamp =
        now.getFullYear().toString() +
        String(now.getMonth()+1).padStart(2,'0') +
        String(now.getDate()).padStart(2,'0') + '_' +
        String(now.getHours()).padStart(2,'0') +
        String(now.getMinutes()).padStart(2,'0') +
        String(now.getSeconds()).padStart(2,'0');

      const slug = category
        .replace(/[^A-Za-z0-9]+/g,'_')
        .replace(/^_+|_+$/g,'') || 'Plant';

      const files = imageItems.map((item,index) => {
        const blob = item.getAsFile();
        const mime = blob?.type || 'image/png';
        const ext = mime.includes('jpeg') ? 'jpg' : mime.includes('webp') ? 'webp' : 'png';
        const name = slug + '_Screenshot_' + stamp +
          (imageItems.length > 1 ? '_' + (index+1) : '') + '.' + ext;
        return new File([blob], name, {type:mime, lastModified:Date.now()});
      }).filter(Boolean);

      if (!files.length) return;

      dz.classList.add('paste-received');
      setTimeout(() => dz.classList.remove('paste-received'),700);

      processSelectedFiles(files);
    });
  }

  processSelectedFiles = function (files) {
    const q = document.getElementById('uploadQueue');
    if (!q) return;

    const selectedCategory = document.getElementById('uploadCategory')?.value || '';

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
      uploadRealFile(file, id, { category:selectedCategory });
    });
  };

  function isIndexableImageFile(fileOrDoc) {
    const mime = String(fileOrDoc?.type || fileOrDoc?.mime_type || '').toLowerCase();
    const name = String(fileOrDoc?.name || fileOrDoc?.file_name || '').toLowerCase();
    return /^image\/(png|jpeg|webp|gif)$/.test(mime) || /\.(png|jpe?g|webp|gif)$/.test(name);
  }

  function officeExt(fileOrDoc) {
    const name = String(fileOrDoc?.name || fileOrDoc?.file_name || '').toLowerCase();
    return (name.split('.').pop() || '').toLowerCase();
  }

  function isIndexableOfficeFile(fileOrDoc) {
    return ['docx','xlsx','xls','csv','txt'].includes(officeExt(fileOrDoc));
  }

  function pp360DownloadBlob(fileName, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function pp360BackupStamp() {
    const d = new Date();
    return d.getFullYear().toString() +
      String(d.getMonth()+1).padStart(2,'0') +
      String(d.getDate()).padStart(2,'0') + '_' +
      String(d.getHours()).padStart(2,'0') +
      String(d.getMinutes()).padStart(2,'0');
  }

  window.exportProductionBackup = async function () {
    if (backendRole !== 'admin') return;

    const btn = document.getElementById('backupJsonBtn');
    const status = document.getElementById('backupStatus');

    try {
      if (btn) { btn.disabled = true; btn.textContent = 'Preparing…'; }
      if (status) status.textContent = 'Reading database content securely…';

      const [docRes, usageRes, users] = await Promise.all([
        client().from('documents').select('*'),
        client().from('api_usage').select('*'),
        callManageUsers({action:'list'})
      ]);

      if (docRes.error) throw docRes.error;
      if (usageRes.error) throw usageRes.error;

      const payload = {
        format:'PowerPlant360 Backup',
        schema_version:'pp360-backup-v1',
        app_version:window.PP360_VERSION || '1.0.0',
        generated_at:new Date().toISOString(),
        project_ref:'elpokijrtmwkxpfauhnr',
        notes:'Passwords and server-side secrets are intentionally excluded.',
        documents:docRes.data || [],
        users:Array.isArray(users?.users) ? users.users : [],
        api_usage:usageRes.data || []
      };

      const blob = new Blob(
        [JSON.stringify(payload,null,2)],
        {type:'application/json;charset=utf-8'}
      );

      pp360DownloadBlob('PowerPlant360_Database_Backup_' + pp360BackupStamp() + '.json', blob);

      if (status) {
        status.textContent =
          '✓ Database backup created: ' +
          payload.documents.length + ' documents, ' +
          payload.users.length + ' users.';
      }
    } catch (err) {
      if (status) status.textContent = 'Backup failed: ' + (err?.message || String(err));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Export Database Backup'; }
    }
  };

  window.backupDepartmentZip = async function () {
    if (backendRole !== 'admin') return;

    const select = document.getElementById('backupCategory');
    const btn = document.getElementById('backupZipBtn');
    const status = document.getElementById('backupStatus');
    const category = select?.value || '';

    if (!category) {
      if (status) status.textContent = 'Select a department first.';
      select?.focus();
      return;
    }
    if (!window.JSZip) {
      if (status) status.textContent = 'ZIP library is unavailable. Refresh and try again.';
      return;
    }

    try {
      if (btn) { btn.disabled = true; btn.textContent = 'Preparing ZIP…'; }
      if (status) status.textContent = 'Reading ' + category + ' document list…';

      const {data:rows,error} = await client()
        .from('documents')
        .select('id,file_name,storage_path,category,document_type,file_size,mime_type,page_count,metadata,processing_status,created_at,updated_at')
        .eq('category',category)
        .order('created_at',{ascending:true});

      if (error) throw error;
      const list = rows || [];
      if (!list.length) throw new Error('No stored documents found for ' + category + '.');

      const totalBytes = list.reduce((sum,d)=>sum + Number(d.file_size || 0),0);
      if (totalBytes > 100 * 1024 * 1024) {
        const ok = confirm(
          category + ' backup is about ' + formatBytes(totalBytes) +
          '. It may take several minutes and use significant browser memory. Continue?'
        );
        if (!ok) return;
      }

      const zip = new JSZip();
      const fileFolder = zip.folder('files');
      const manifestFiles = [];

      for (let i=0;i<list.length;i++) {
        const d = list[i];
        if (status) {
          status.textContent =
            'Downloading ' + (i+1) + ' / ' + list.length + ': ' + (d.file_name || 'document');
        }

        const entry = {
          ...d,
          backup_name:null,
          backup_error:null
        };

        try {
          const {data:blob,error:downloadError} = await client()
            .storage
            .from('plant-documents')
            .download(d.storage_path);

          if (downloadError) throw downloadError;

          const backupName =
            String(i+1).padStart(3,'0') + '_' +
            safeRemoteFileName(d.file_name || ('document_' + d.id));

          fileFolder.file(backupName, blob);
          entry.backup_name = backupName;
        } catch (fileErr) {
          entry.backup_error = String(fileErr?.message || fileErr);
        }

        manifestFiles.push(entry);
      }

      zip.file('manifest.json', JSON.stringify({
        format:'PowerPlant360 Department Backup',
        schema_version:'pp360-department-backup-v1',
        app_version:window.PP360_VERSION || '1.0.0',
        generated_at:new Date().toISOString(),
        category,
        expected_files:list.length,
        downloaded_files:manifestFiles.filter(x=>!x.backup_error).length,
        failed_files:manifestFiles.filter(x=>x.backup_error).length,
        files:manifestFiles
      },null,2));

      if (status) status.textContent = 'Creating ZIP…';

      const blob = await zip.generateAsync(
        {type:'blob',compression:'STORE'},
        meta => {
          if (status) status.textContent = 'Creating ZIP… ' + Math.round(meta.percent || 0) + '%';
        }
      );

      const slug = category.replace(/[^A-Za-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
      pp360DownloadBlob('PowerPlant360_' + slug + '_Backup_' + pp360BackupStamp() + '.zip', blob);

      const failed = manifestFiles.filter(x=>x.backup_error).length;
      if (status) status.textContent =
        failed
          ? 'ZIP created with ' + failed + ' file error(s). Check manifest.json before relying on this backup.'
          : '✓ Department backup created successfully: ' + list.length + ' files.';
    } catch (err) {
      if (status) status.textContent = 'Backup failed: ' + (err?.message || String(err));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Download Department ZIP'; }
    }
  };

  async function callManageUsers(payload) {
    if (backendRole !== 'admin') throw new Error('Admin permission required.');

    const { data: sessionData } = await client().auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error('Session expired. Please log in again.');

    const endpoint = cfg.supabaseUrl.replace(/\/$/,'') + '/functions/v1/manage-users';
    const res = await fetch(endpoint, {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':'Bearer ' + token,
        'apikey':cfg.supabaseKey
      },
      body:JSON.stringify(payload || {})
    });

    let data = null;
    try { data = await res.json(); } catch (_) {}

    if (!res.ok) {
      throw new Error(String(data?.error || data?.message || ('User management failed with status ' + res.status)));
    }
    return data || {};
  }

  function managedUserDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
  }

  async function loadUserManagement() {
    const wrap = document.getElementById('userListWrap');
    if (!wrap || backendRole !== 'admin') return;

    wrap.innerHTML = '<div class="muted small">Loading users…</div>';

    try {
      const payload = await callManageUsers({action:'list'});
      const users = Array.isArray(payload?.users) ? payload.users : [];

      if (!users.length) {
        wrap.innerHTML = '<div class="notice">No users found.</div>';
        return;
      }

      wrap.innerHTML =
        '<div class="user-table-scroll"><table class="user-table">' +
          '<thead><tr><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Created</th><th scope="col">Last Sign-in</th><th scope="col">Actions</th></tr></thead><tbody>' +
          users.map(u => {
            const role = String(u?.role || 'viewer').toLowerCase();
            const isAdmin = role === 'admin';
            const isCurrent = Boolean(u?.is_current);

            const roleCell = isAdmin
              ? '<span class="badge ok">Admin</span>'
              : '<select class="managed-role-select" onchange="changeManagedUserRole(\'' + esc(u.id) + '\',this.value)">' +
                  '<option value="engineer"' + (role === 'engineer' ? ' selected' : '') + '>Engineer</option>' +
                  '<option value="viewer"' + (role === 'viewer' ? ' selected' : '') + '>Viewer</option>' +
                '</select>';

            const actions = isAdmin
              ? '<span class="muted small">' + (isCurrent ? 'Current Admin · protected' : 'Admin · protected') + '</span>'
              : '<div class="managed-user-actions">' +
                  '<button onclick="copyManagedUserEmail(\'' + esc(String(u.email || '')) + '\')">Copy Email</button>' +
                  '<button class="dangerbtn" onclick="deleteManagedUser(\'' + esc(u.id) + '\',\'' + esc(String(u.email || '')) + '\')">Delete</button>' +
                '</div>';

            return '<tr class="managed-user-row">' +
              '<td data-label="Email" class="managed-user-email"><b>' + esc(String(u.email || '')) + '</b>' + (isCurrent ? '<div class="muted small">Signed in now</div>' : '') + '</td>' +
              '<td data-label="Role">' + roleCell + '</td>' +
              '<td data-label="Created">' + esc(managedUserDate(u?.created_at)) + '</td>' +
              '<td data-label="Last Sign-in">' + esc(managedUserDate(u?.last_sign_in_at)) + '</td>' +
              '<td data-label="Actions" class="managed-user-action-cell">' + actions + '</td>' +
            '</tr>';
          }).join('') +
        '</tbody></table></div>';
    } catch (err) {
      wrap.innerHTML = '<div class="notice"><b>Could not load users.</b><br>' + esc(err?.message || String(err)) + '</div>';
    }
  }
  window.loadUserManagement = loadUserManagement;

  window.createManagedUser = async function () {
    if (backendRole !== 'admin') return;

    const emailEl = document.getElementById('newUserEmail');
    const passwordEl = document.getElementById('newUserPassword');
    const roleEl = document.getElementById('newUserRole');
    const btn = document.getElementById('createUserBtn');
    const msg = document.getElementById('userManageMsg');

    const email = emailEl?.value.trim() || '';
    const password = passwordEl?.value || '';
    const role = roleEl?.value || 'viewer';

    if (!email || !email.includes('@')) {
      if (msg) msg.textContent = 'Enter a valid email address.';
      emailEl?.focus();
      return;
    }
    if (password.length < 8) {
      if (msg) msg.textContent = 'Temporary password must be at least 8 characters.';
      passwordEl?.focus();
      return;
    }

    try {
      if (btn) { btn.disabled = true; btn.textContent = 'Creating…'; }
      if (msg) msg.textContent = 'Creating user securely…';

      await callManageUsers({
        action:'create',
        email,
        password,
        role
      });

      if (passwordEl) passwordEl.value = '';
      if (emailEl) emailEl.value = '';
      if (msg) msg.textContent = '✓ User created. Open PowerPlant360 in an Incognito / Private window to test the login.';
      await loadUserManagement();
    } catch (err) {
      if (msg) msg.textContent = 'User creation failed: ' + (err?.message || String(err));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Add User'; }
    }
  };

  window.changeManagedUserRole = async function(userId, role) {
    if (backendRole !== 'admin') return;
    const msg = document.getElementById('userManageMsg');

    try {
      if (msg) msg.textContent = 'Updating role…';
      await callManageUsers({
        action:'update_role',
        user_id:userId,
        role
      });
      if (msg) msg.textContent = '✓ Role updated.';
      await loadUserManagement();
    } catch (err) {
      if (msg) msg.textContent = 'Role update failed: ' + (err?.message || String(err));
      await loadUserManagement();
    }
  };

  window.deleteManagedUser = async function(userId, email) {
    if (backendRole !== 'admin') return;
    if (!confirm('Delete user ' + email + '?\n\nThis removes the login account and its PowerPlant360 role.')) return;

    const msg = document.getElementById('userManageMsg');
    try {
      if (msg) msg.textContent = 'Deleting user…';
      await callManageUsers({
        action:'delete',
        user_id:userId
      });
      if (msg) msg.textContent = '✓ User deleted.';
      await loadUserManagement();
    } catch (err) {
      if (msg) msg.textContent = 'Delete failed: ' + (err?.message || String(err));
    }
  };

  window.copyManagedUserEmail = async function(email) {
    try {
      await navigator.clipboard.writeText(String(email || ''));
      const msg = document.getElementById('userManageMsg');
      if (msg) msg.textContent = '✓ Email copied. Open PowerPlant360 in an Incognito / Private window for login testing.';
    } catch (_) {
      prompt('Copy this test-user email:', String(email || ''));
    }
  };

  async function invokeSecureIndexer(functionName, documentId) {
    if (backendRole !== 'admin') throw new Error('Admin permission required for indexing.');
    const { data: sessionData } = await client().auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error('Session expired. Please log in again.');

    const endpoint = cfg.supabaseUrl.replace(/\/$/,'') + '/functions/v1/' + functionName;
    const res = await fetch(endpoint, {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':'Bearer ' + token,
        'apikey':cfg.supabaseKey
      },
      body:JSON.stringify({document_id:documentId})
    });

    if (!res.ok) {
      let detail = '';
      try {
        const payload = await res.json();
        detail = String(payload?.error || payload?.message || '').trim();
      } catch (_) {}
      throw new Error(detail || ('Indexing failed with status ' + res.status));
    }
    return await res.json();
  }

  async function runExistingIndexer(id, functionName, label) {
    if (backendRole !== 'admin') return;
    try {
      await client().from('documents').update({
        processing_status:'processing',
        updated_at:new Date().toISOString()
      }).eq('id',id);
      await loadDocsFromBackend();
      await invokeSecureIndexer(functionName, id);
      await loadDocsFromBackend();
      if (document.getElementById('apiUsage')) await loadApiUsage();
      alert(label + ' indexing completed. This file is now searchable as Plant Data.');
    } catch (err) {
      await loadDocsFromBackend();
      alert(label + ' indexing failed: ' + (err.message || String(err)));
    }
  }

  window.indexExistingImage = async function(id) {
    const d = docs.find(x => x.id === id);
    if (!d || !isIndexableImageFile(d)) return;
    if (!confirm('Index searchable engineering data from this image?')) return;
    await runExistingIndexer(id, 'index-image', 'Image');
  };

  window.indexExistingOffice = async function(id) {
    const d = docs.find(x => x.id === id);
    if (!d || !isIndexableOfficeFile(d)) return;
    if (!confirm('Index searchable Plant Data from this Word/Excel/text file?')) return;
    await runExistingIndexer(id, 'index-office', 'Office file');
  };

  async function uploadRealFile(file, id, options = {}) {
    const uploadContext = {
      category: options.category || window.pp360UploadContext?.category || '',
      section: options.section || window.pp360UploadContext?.section || '',
      sourcePath: options.sourcePath || window.pp360UploadContext?.sourcePath || ''
    };
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

      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImage = isIndexableImageFile(file);
      const isOffice = isIndexableOfficeFile(file);

      const { data: insertedRows, error: dbError } = await client().from('documents').insert({
        file_name: file.name,
        storage_path: storagePath,
        category: uploadContext.category || guessCategory(file.name),
        document_type: guessDocType(file.name),
        file_size: file.size,
        mime_type: file.type || null,
        processing_status: (isPdf || isImage || isOffice) ? 'processing' : 'uploaded',
        uploaded_by: s.user.id,
        metadata: {
          original_name: file.name,
          section: uploadContext.section || '',
          source_path: uploadContext.sourcePath || ''
        }
      }).select('id').single();

      if (dbError) {
        await client().storage.from('plant-documents').remove([storagePath]);
        throw dbError;
      }

      bar.style.width = '100%';
      pct.textContent = '100%';

      if (isPdf) {
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
              section: uploadContext.section || '',
              source_path: uploadContext.sourcePath || '',
              extraction_error: String(extractErr.message || extractErr)
            }
          }).eq('id', insertedRows.id);
          status.innerHTML = '<span class="errtext">Upload saved, but PDF text extraction failed: ' + esc(extractErr.message || String(extractErr)) + '</span>';
        }
      } else if (isImage) {
        status.textContent = 'Upload complete. Indexing image table/text for Plant Data search…';
        try {
          await invokeSecureIndexer('index-image', insertedRows.id);
          status.innerHTML = '<span class="oktext">✓ Secure upload + image indexing completed</span>';
        } catch (indexErr) {
          status.innerHTML = '<span class="errtext">Upload saved, but image indexing failed: ' + esc(indexErr.message || String(indexErr)) + '</span>';
        }
      } else if (isOffice) {
        status.textContent = 'Upload complete. Indexing Word/Excel/text data for Plant Data search…';
        try {
          await invokeSecureIndexer('index-office', insertedRows.id);
          status.innerHTML = '<span class="oktext">✓ Secure upload + Office indexing completed</span>';
        } catch (indexErr) {
          status.innerHTML = '<span class="errtext">Upload saved, but Office indexing failed: ' + esc(indexErr.message || String(indexErr)) + '</span>';
        }
      } else {
        status.innerHTML = '<span class="oktext">✓ Secure upload completed</span>';
      }

      if (!options.suppressReload) {
        window.pp360UploadContext = null;
        await loadDocsFromBackend();
      }
      return true;
    } catch (err) {
      if (!options.suppressReload) window.pp360UploadContext = null;
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


  function indexedPdfPageMap(extractedText='') {
    const map = new Map();
    const source = String(extractedText || '');
    const re = /\[\[PAGE (\d+)\]\]\n?/g;
    const matches = [...source.matchAll(re)];

    for (let i=0; i<matches.length; i++) {
      const page = Number(matches[i][1]);
      if (!Number.isInteger(page) || page < 1) continue;
      const start = Number(matches[i].index) + matches[i][0].length;
      const end = i + 1 < matches.length ? Number(matches[i+1].index) : source.length;
      map.set(page, source.slice(start,end).trim());
    }
    return map;
  }

  function weakPdfPages(d) {
    const map = indexedPdfPageMap(d?.extracted_text || '');
    const pageCount = Number(d?.page_count || 0);
    const already = new Set(
      Array.isArray(d?.metadata?.vision_indexed_pages)
        ? d.metadata.vision_indexed_pages.map(Number).filter(x => Number.isInteger(x) && x > 0)
        : []
    );
    const weak = [];

    for (let page=1; page<=pageCount; page++) {
      if (already.has(page)) continue;

      const raw = String(map.get(page) || '');
      const cleaned = raw
        .replace(/shri\s+girija\s+alloy\s*&?\s*power[^\n]*/gi,' ')
        .replace(/private\s+limited/gi,' ')
        .replace(/survey\s+no[^\n]*/gi,' ')
        .replace(/east\s+godavari[^\n]*/gi,' ')
        .replace(/peddapuram[^\n]*/gi,' ')
        .replace(/\bpage\s*\d+\b/gi,' ')
        .replace(/\s+/g,' ')
        .trim();

      const wordCount = cleaned ? cleaned.split(/\s+/).filter(Boolean).length : 0;
      const engineeringSignals = (cleaned.match(/\b(?:kw|rpm|bar|kg|mm|tph|volt|amp|capacity|type|model|make|size|pressure|temperature|flow|efficiency|screen|pump|fan|motor|transformer|conveyor|bearing|valve)\b/gi) || []).length;

      if (cleaned.length < 180 || wordCount < 28 || (cleaned.length < 320 && engineeringSignals < 3)) {
        weak.push(page);
      }
    }

    return weak;
  }

  async function renderPdfPageForVision(pdf, pageNumber) {
    const page = await pdf.getPage(pageNumber);
    const base = page.getViewport({scale:1});
    const maxWidth = 1800;
    const maxHeight = 2400;
    let scale = Math.min(2.2, maxWidth / Math.max(base.width,1), maxHeight / Math.max(base.height,1));
    scale = Math.max(1.35, scale);

    const viewport = page.getViewport({scale});
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', {alpha:false});
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,canvas.width,canvas.height);

    await page.render({canvasContext:ctx,viewport}).promise;
    return canvas.toDataURL('image/jpeg',0.88);
  }

  async function invokeVisionPdfBatch(documentId, renderedPages) {
    const { data: sessionData } = await client().auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error('Session expired. Please log in again.');

    const endpoint = cfg.supabaseUrl.replace(/\/$/,'') + '/functions/v1/vision-index-pdf-page';
    const res = await fetch(endpoint, {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':'Bearer ' + token,
        'apikey':cfg.supabaseKey
      },
      body:JSON.stringify({
        document_id:documentId,
        pages:renderedPages
      })
    });

    if (!res.ok) {
      let detail = '';
      try {
        const payload = await res.json();
        detail = String(payload?.error || payload?.message || '').trim();
      } catch (_) {}
      throw new Error(detail || ('Vision batch indexing failed with status ' + res.status));
    }
    return await res.json();
  }

  function closeVisionPdfModal() {
    document.getElementById('visionPdfModal')?.remove();
  }
  window.closeVisionPdfModal = closeVisionPdfModal;

  async function visionIndexPdf(id) {
    if (backendRole !== 'admin') return;
    const d = docs.find(x => x.id === id);
    if (!d || !isPdfDocument(d)) return;

    if (!window.pdfjsLib) {
      alert('PDF reader library is not available. Press ↻ refresh and try again.');
      return;
    }

    const weak = weakPdfPages(d);
    if (!weak.length) {
      alert('No weak/scanned pages were detected in this PDF.');
      return;
    }

    const batch = weak.slice(0,12);
    const remaining = Math.max(0, weak.length - batch.length);
    const alreadyDone = Array.isArray(d?.metadata?.vision_indexed_pages)
      ? new Set(
          d.metadata.vision_indexed_pages
            .map(Number)
            .filter(x => Number.isInteger(x) && x > 0)
        ).size
      : 0;
    const totalWeak = alreadyDone + weak.length;

    let message = 'Vision Index PDF progress: ' + alreadyDone + ' / ' + totalWeak + ' weak/scanned pages processed.\n\n';
    message += weak.length + ' page(s) remain. This run will process Page(s): ' + batch.join(', ');
    if (remaining) message += '\n\n' + remaining + ' page(s) will remain for another run.';
    message += '\n\nAI vision uses API credit. Continue?';

    if (!confirm(message)) return;

    const modalHtml =
      '<div class="modalback" id="visionPdfModal">' +
        '<div class="vision-modalbox">' +
          '<div class="spreadsheet-preview-head">' +
            '<div><h3>Vision Index PDF</h3><div class="muted small">' + esc(d.file_name) + '</div></div>' +
          '</div>' +
          '<div class="notice"><b>Fast Batch Vision:</b> up to 4 weak pages per AI call. Original PDF is not modified.</div>' +
          '<div class="progress" style="margin-top:14px"><div class="progressbar" id="visionPdfBar" style="width:0%"></div></div>' +
          '<div id="visionPdfPct" class="muted small" style="margin-top:6px">0%</div>' +
          '<div id="visionPdfStatus" class="vision-status">Preparing PDF…</div>' +
          '<div id="visionPdfLog" class="vision-log"></div>' +
        '</div>' +
      '</div>';

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const bar = document.getElementById('visionPdfBar');
    const pct = document.getElementById('visionPdfPct');
    const status = document.getElementById('visionPdfStatus');
    const log = document.getElementById('visionPdfLog');

    let ok = 0;
    let failed = 0;

    try {
      const { data: blob, error: downloadError } = await client().storage
        .from('plant-documents')
        .download(d.storage_path);
      if (downloadError || !blob) throw downloadError || new Error('Could not download PDF.');

      const buf = await blob.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({data:buf}).promise;

      const groupSize = 4;

      for (let start=0; start<batch.length; start+=groupSize) {
        const group = batch.slice(start,start+groupSize);
        const label = group.length === 1
          ? 'page ' + group[0]
          : 'pages ' + group[0] + '–' + group[group.length-1];

        status.textContent = 'Rendering ' + label + '…';

        try {
          const images = await Promise.all(
            group.map(async pageNumber => ({
              page_number:pageNumber,
              image_data:await renderPdfPageForVision(pdf,pageNumber)
            }))
          );

          status.textContent = 'Reading ' + label + ' with AI vision…';
          const result = await invokeVisionPdfBatch(d.id,images);
          const results = Array.isArray(result?.results) ? result.results : [];

          for (const pageNumber of group) {
            const r = results.find(x => Number(x?.page_number) === Number(pageNumber));
            if (r) {
              ok++;
              log.insertAdjacentHTML(
                'beforeend',
                '<div>✓ Page ' + pageNumber +
                  (r?.no_engineering_data ? ' — no engineering data found' : ' — indexed') +
                '</div>'
              );
            } else {
              failed++;
              log.insertAdjacentHTML(
                'beforeend',
                '<div class="errtext">✕ Page ' + pageNumber + ' — no batch result returned</div>'
              );
            }
          }
        } catch (groupErr) {
          failed += group.length;
          for (const pageNumber of group) {
            log.insertAdjacentHTML(
              'beforeend',
              '<div class="errtext">✕ Page ' + pageNumber + ' — ' + esc(groupErr?.message || String(groupErr)) + '</div>'
            );
          }
        }

        const completed = Math.min(start + group.length,batch.length);
        const progress = Math.round((completed/batch.length)*100);
        if (bar) bar.style.width = progress + '%';
        if (pct) pct.textContent = progress + '%';
      }

      await loadDocsFromBackend();
      if (document.getElementById('apiUsage')) await loadApiUsage();

      status.innerHTML =
        '<span class="oktext">Vision indexing completed: ' + ok + ' page(s) indexed' +
        (failed ? ' • ' + failed + ' failed' : '') +
        (remaining ? ' • run again for remaining weak pages' : '') +
        '.</span>';

      log.insertAdjacentHTML(
        'beforeend',
        '<div class="actions" style="margin-top:12px"><button class="primary" onclick="closeVisionPdfModal()">Close</button></div>'
      );
    } catch (err) {
      status.innerHTML = '<span class="errtext">Vision Index PDF failed: ' + esc(err?.message || String(err)) + '</span>';
      log.insertAdjacentHTML(
        'beforeend',
        '<div class="actions" style="margin-top:12px"><button onclick="closeVisionPdfModal()">Close</button></div>'
      );
    }
  }
  window.visionIndexPdf = visionIndexPdf;

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

  window.toggleApiUsage = async function () {
    if (backendRole !== 'admin') return;
    const wrap = document.getElementById('apiUsageWrap');
    if (!wrap) return;
    const opening = wrap.style.display === 'none' || !wrap.style.display;
    wrap.style.display = opening ? 'block' : 'none';
    if (opening) await loadApiUsage();
  };

  async function loadApiUsage() {
    const el = document.getElementById('apiUsage');
    if (!el || !client()) return;

    const { data, error } = await client()
      .from('api_usage')
      .select('created_at,source_type,model,input_tokens,cached_input_tokens,output_tokens,web_search_calls,estimated_cost_usd')
      .order('created_at', { ascending:false });

    if (error) {
      el.innerHTML = '<div class="notice">Could not load API usage: ' + esc(error.message) + '</div>';
      return;
    }

    const rows = data || [];
    const totals = rows.reduce((a,r) => {
      a.input += Number(r.input_tokens || 0);
      a.cached += Number(r.cached_input_tokens || 0);
      a.output += Number(r.output_tokens || 0);
      a.web += Number(r.web_search_calls || 0);
      a.cost += Number(r.estimated_cost_usd || 0);
      if (r.source_type === 'web') a.webAnswers += 1;
      else if (r.source_type === 'index') a.indexJobs += 1;
      else a.plantAnswers += 1;
      return a;
    }, {input:0,cached:0,output:0,web:0,cost:0,webAnswers:0,plantAnswers:0,indexJobs:0});

    const startingCredit = 5.00;
    const remaining = Math.max(0, startingCredit - totals.cost);
    const spentPct = Math.min(100, (totals.cost / startingCredit) * 100);
    const money = n => '$' + Number(n || 0).toFixed(n < 0.01 ? 4 : 2);
    const num = n => Number(n || 0).toLocaleString();

    el.innerHTML = `
      <div class="usage-title"><h3>Plant AI Usage & Estimated Cost</h3><span class="usage-plan">OpenAI API • tracking from this feature onward</span></div>
      <div class="usage-grid">
        <div class="usage-card"><span>AI Requests</span><strong>${num(rows.length)}</strong><small>${num(totals.plantAnswers)} plant • ${num(totals.webAnswers)} online • ${num(totals.indexJobs)} indexing</small></div>
        <div class="usage-card"><span>Input Tokens</span><strong>${num(totals.input)}</strong><small>${num(totals.cached)} cached</small></div>
        <div class="usage-card"><span>Output Tokens</span><strong>${num(totals.output)}</strong><small>generated answers</small></div>
        <div class="usage-card"><span>Web Searches</span><strong>${num(totals.web)}</strong><small>online fallback calls</small></div>
        <div class="usage-card">
          <span>Estimated Spend</span><strong>${money(totals.cost)}</strong>
          <div class="usage-track"><div class="usage-fill ${spentPct >= 90 ? 'danger' : spentPct >= 75 ? 'warn' : 'good'}" style="width:${spentPct.toFixed(2)}%"></div></div>
          <small>${spentPct.toFixed(2)}% of $5 starting credit</small>
        </div>
        <div class="usage-card"><span>Estimated Remaining</span><strong>${money(remaining)}</strong><small>OpenAI Billing is authoritative</small></div>
      </div>
      <p class="muted small">Estimated using GPT-6 Luna reference rates: $0.10/M uncached input, $0.01/M cached input, $0.50/M output, plus $0.01 per web-search call. Actual charges can differ by processing mode or pricing changes.</p>
    `;
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

    const visionPdfs = docs.filter(d => {
      const name = String(d?.file_name || '').toLowerCase();
      const mime = String(d?.mime_type || '').toLowerCase();
      return mime.includes('pdf') || name.endsWith('.pdf');
    });

    const visionStats = visionPdfs.map(d => {
      const pages = Array.isArray(d?.metadata?.vision_indexed_pages)
        ? d.metadata.vision_indexed_pages
            .map(Number)
            .filter(x => Number.isInteger(x) && x > 0)
        : [];
      const processed = new Set(pages).size;
      const remaining = weakPdfPages(d).length;
      const totalWeak = processed + remaining;
      return { d, processed, remaining, totalWeak };
    });

    const visionCompleted = visionStats.filter(x => x.remaining === 0).length;
    const visionPagesProcessed = visionStats.reduce((sum,x) => sum + x.processed,0);
    const visionPagesTotalWeak = visionStats.reduce((sum,x) => sum + x.totalWeak,0);

    const visionPct = visionPdfs.length
      ? Math.min(100,(visionCompleted / visionPdfs.length) * 100)
      : 0;

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
        <div class="usage-card">
          <span>Vision Index Status</span>
          <strong>${visionCompleted} / ${visionPdfs.length} PDFs complete</strong>
          <div class="usage-track"><div class="usage-fill good" style="width:${visionPct.toFixed(1)}%"></div></div>
          <small>${visionPagesProcessed} / ${visionPagesTotalWeak || visionPagesProcessed} weak pages processed • ${visionPct.toFixed(0)}% documents complete</small>
        </div>
      </div>
    `;
  }

  window.showAdminPanel = function(name, button) {
    if (backendRole !== 'admin') return;

    document.querySelectorAll('.admin-panel').forEach(panel => {
      const active = panel.getAttribute('data-admin-panel') === name;
      panel.hidden = !active;
      panel.classList.toggle('active', active);
    });

    document.querySelectorAll('.admin-side-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-admin-nav') === name);
    });

    if (name === 'documents') {
      const select = document.getElementById('filterCategory');
      if (select && !select.value) {
        document.querySelectorAll('.dept-filter-btn').forEach(btn => btn.classList.remove('active'));
      }
      renderDocTable();
    }
    if (name === 'system') {
      renderStorageUsage();
      loadApiUsage();
    }
    if (name === 'users') loadUserManagement();
  };

  window.setAdminDocCategory = function(category, button) {
    const select = document.getElementById('filterCategory');
    if (select) select.value = category || '';

    document.querySelectorAll('.dept-filter-btn').forEach(btn => {
      btn.classList.toggle('active', (btn.getAttribute('data-category') || '') === (category || ''));
    });

    renderDocTable();
  };

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

    if (!fc) {
      wrap.innerHTML = '<div class="admin-doc-placeholder">Select a department above to view its uploaded documents.</div>';
      return;
    }

    if (!list.length) {
      wrap.innerHTML = '<div class="emptydocs"><b>No files in this department.</b><p class="muted">Use Upload Documents to add files.</p></div>';
      return;
    }

    wrap.innerHTML = '<div class="admin-file-list">' +
      list.map(d => {
        const visionPages = Array.isArray(d?.metadata?.vision_indexed_pages)
          ? d.metadata.vision_indexed_pages.map(Number).filter(x => Number.isInteger(x) && x > 0)
          : [];
        const visionCount = new Set(visionPages).size;
        const visionRemaining = isPdfDocument(d) ? weakPdfPages(d).length : 0;
        const visionTotalWeak = visionCount + visionRemaining;
        const visionComplete = isPdfDocument(d) && visionRemaining === 0;

        const visionButtonLabel = visionComplete
          ? 'Vision Complete'
          : (visionCount
              ? 'Vision Index · ' + visionCount + ' / ' + visionTotalWeak
              : 'Vision Index');

        const indexAction =
          ((d.mime_type||'').includes('pdf') || (d.file_name||'').toLowerCase().endsWith('.pdf')) && d.processing_status !== 'ready'
            ? '<button onclick="indexExistingPdf(\'' + d.id + '\')">Index PDF</button>'
            : (
                isPdfDocument(d) && d.processing_status === 'ready'
                  ? (
                      visionComplete
                        ? '<button disabled>' + visionButtonLabel + '</button>'
                        : '<button onclick="visionIndexPdf(\'' + d.id + '\')">' + visionButtonLabel + '</button>'
                    )
                  : (
                      isIndexableImageFile(d) && d.processing_status !== 'ready'
                        ? '<button onclick="indexExistingImage(\'' + d.id + '\')">Index Image</button>'
                        : (
                            isIndexableOfficeFile(d) && d.processing_status !== 'ready'
                              ? '<button onclick="indexExistingOffice(\'' + d.id + '\')">Index Office</button>'
                              : ''
                          )
                    )
              );

        return '<div class="admin-file-row">' +
          '<div class="admin-file-name" title="' + esc(d.file_name || '') + '">' +
            '<b>' + esc(d.file_name || 'Unnamed document') + '</b>' +
          '</div>' +
          '<div class="admin-file-actions">' +
            indexAction +
            '<button onclick="viewDocument(\'' + d.id + '\')">View</button>' +
            '<button onclick="editDoc(\'' + d.id + '\')">Edit</button>' +
            '<button class="dangerbtn" onclick="del(\'' + d.id + '\')">Delete</button>' +
          '</div>' +
        '</div>';
      }).join('') +
    '</div>';
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

  function isPdfDocument(d) {
    const name = String(d?.file_name || '').toLowerCase();
    const mime = String(d?.mime_type || '').toLowerCase();
    return mime.includes('pdf') || name.endsWith('.pdf');
  }

  function isSpreadsheetDocument(d) {
    const name = String(d?.file_name || '').toLowerCase();
    const mime = String(d?.mime_type || '').toLowerCase();
    return /\.(xlsx|xls|csv)$/.test(name) ||
      mime.includes('spreadsheet') ||
      mime.includes('ms-excel') ||
      mime === 'text/csv';
  }

  function spreadsheetQueryTokens() {
    const raw = document.getElementById('q')?.value || '';
    return norm(raw).split(' ').filter(x => x.length >= 2 && !['what','is','the','of','for','show','give','please','data','details','detail'].includes(x));
  }

  function scoreSpreadsheetRows(rows, sheetName, queryTokens) {
    if (!queryTokens.length) return { score:0, matchRow:-1 };
    let bestScore = 0;
    let bestRow = -1;
    const sheetNorm = norm(sheetName || '');
    for (let r=0; r<rows.length; r++) {
      const rowNorm = norm((rows[r] || []).join(' '));
      let score = 0;
      for (const t of queryTokens) {
        if (rowNorm.includes(t)) score += 4;
        if (sheetNorm.includes(t)) score += 2;
      }
      if (queryTokens.every(t => rowNorm.includes(t))) score += 12;
      if (score > bestScore) {
        bestScore = score;
        bestRow = r;
      }
    }
    return { score:bestScore, matchRow:bestRow };
  }

  function closeSpreadsheetPreview() {
    document.getElementById('spreadsheetPreviewModal')?.remove();
    window.pp360SpreadsheetPreview = null;
  }
  window.closeSpreadsheetPreview = closeSpreadsheetPreview;

  function renderSpreadsheetSheet(sheetName, showAll=false) {
    const state = window.pp360SpreadsheetPreview;
    const body = document.getElementById('spreadsheetPreviewBody');
    const meta = document.getElementById('spreadsheetPreviewMeta');
    if (!state || !body) return;

    const rows = state.rowsBySheet[sheetName] || [];
    const matchRow = state.matchesBySheet[sheetName]?.matchRow ?? -1;
    const tokens = state.queryTokens || [];

    let start = 0;
    let end = rows.length;
    if (!showAll && rows.length > 300) {
      if (matchRow >= 0) {
        start = Math.max(0, matchRow - 20);
        end = Math.min(rows.length, start + 120);
      } else {
        end = Math.min(rows.length, 120);
      }
    }

    const visible = rows.slice(start,end);
    const maxCols = Math.min(60, visible.reduce((m,row)=>Math.max(m,(row||[]).length),0));
    let html = '<table class="sheet-preview-table"><tbody>';

    for (let i=0; i<visible.length; i++) {
      const absoluteRow = start + i;
      const row = visible[i] || [];
      const rowText = norm(row.join(' '));
      const rowMatch = tokens.length && tokens.some(t => rowText.includes(t));
      html += '<tr' + (rowMatch ? ' class="sheet-match-row"' : '') + '>';
      html += '<th class="sheet-rownum">' + (absoluteRow + 1) + '</th>';
      for (let c=0; c<maxCols; c++) {
        const val = row[c] == null ? '' : String(row[c]);
        const cellNorm = norm(val);
        const cellMatch = tokens.length && tokens.some(t => cellNorm.includes(t));
        html += '<td' + (cellMatch ? ' class="sheet-match-cell"' : '') + '>' + esc(val) + '</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table>';

    body.innerHTML = html || '<div class="notice">This worksheet has no visible cell data.</div>';

    if (meta) {
      const matchText = matchRow >= 0 ? ' • closest match around row ' + (matchRow + 1) : '';
      const rangeText = rows.length > end-start
        ? ' • showing rows ' + (start + 1) + '–' + end + ' of ' + rows.length
        : ' • ' + rows.length + ' rows';
      meta.innerHTML = '<b>' + esc(sheetName) + '</b>' + matchText + rangeText +
        ((!showAll && rows.length > 300)
          ? ' <button class="linkbtn" onclick="renderSpreadsheetSheet(' + JSON.stringify(sheetName).replace(/"/g,'&quot;') + ',true)">Show all rows</button>'
          : '');
    }

    document.querySelectorAll('.sheet-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.sheet === sheetName);
    });

    setTimeout(() => {
      document.querySelector('#spreadsheetPreviewBody .sheet-match-row')?.scrollIntoView({block:'center'});
    }, 30);
  }
  window.renderSpreadsheetSheet = renderSpreadsheetSheet;

  async function previewSpreadsheet(d) {
    if (!window.XLSX) {
      alert('Spreadsheet viewer is still loading. Please press ↻ refresh and try again.');
      return;
    }

    const existing = document.getElementById('spreadsheetPreviewModal');
    if (existing) existing.remove();

    document.body.insertAdjacentHTML('beforeend', `
      <div class="modalback" id="spreadsheetPreviewModal">
        <div class="spreadsheet-modalbox">
          <div class="spreadsheet-preview-head">
            <div>
              <h3>Supporting Spreadsheet</h3>
              <div class="muted small">${esc(d.file_name || 'Spreadsheet')}</div>
            </div>
            <button onclick="closeSpreadsheetPreview()">Close</button>
          </div>
          <div id="spreadsheetSheetTabs" class="sheet-tabs"></div>
          <div id="spreadsheetPreviewMeta" class="sheet-preview-meta">Loading workbook…</div>
          <div id="spreadsheetPreviewBody" class="spreadsheet-preview-scroll">
            <div class="muted">Opening spreadsheet securely…</div>
          </div>
        </div>
      </div>`);

    try {
      const { data: blob, error } = await client().storage
        .from('plant-documents')
        .download(d.storage_path);
      if (error || !blob) throw error || new Error('Could not read spreadsheet.');

      const buf = await blob.arrayBuffer();
      const wb = XLSX.read(buf, {type:'array', cellDates:true});
      const rowsBySheet = {};
      const matchesBySheet = {};
      const queryTokens = spreadsheetQueryTokens();

      let bestSheet = wb.SheetNames[0] || '';
      let bestScore = -1;

      for (const name of wb.SheetNames) {
        const sheet = wb.Sheets[name];
        const rows = XLSX.utils.sheet_to_json(sheet, {
          header:1,
          defval:'',
          raw:false,
          blankrows:false
        });
        rowsBySheet[name] = rows;
        const match = scoreSpreadsheetRows(rows,name,queryTokens);
        matchesBySheet[name] = match;
        if (match.score > bestScore) {
          bestScore = match.score;
          bestSheet = name;
        }
      }

      window.pp360SpreadsheetPreview = {
        file:d,
        workbook:wb,
        rowsBySheet,
        matchesBySheet,
        queryTokens
      };

      const tabs = document.getElementById('spreadsheetSheetTabs');
      if (tabs) {
        tabs.innerHTML = wb.SheetNames.map(name =>
          '<button class="sheet-tab" data-sheet="' + esc(name) + '" onclick="renderSpreadsheetSheet(' +
          JSON.stringify(name).replace(/"/g,'&quot;') + ')">' + esc(name) + '</button>'
        ).join('');
      }

      if (!bestSheet) throw new Error('No worksheets were found in this workbook.');
      renderSpreadsheetSheet(bestSheet);
    } catch (err) {
      const body = document.getElementById('spreadsheetPreviewBody');
      if (body) body.innerHTML = '<div class="notice">Could not preview spreadsheet: ' + esc(err?.message || String(err)) + '</div>';
    }
  }

  function isVisionIndexedPdfPage(d, page) {
    const pageNum = Number(page);
    if (!Number.isInteger(pageNum) || pageNum < 1) return false;
    const pages = Array.isArray(d?.metadata?.vision_indexed_pages)
      ? d.metadata.vision_indexed_pages.map(Number)
      : [];
    return pages.includes(pageNum);
  }

  function closePdfImagePreview() {
    document.getElementById('pdfImagePreviewModal')?.remove();
  }
  window.closePdfImagePreview = closePdfImagePreview;

  async function openOriginalPdfFromPreview(id, page=null) {
    let d = docs.find(x => x.id === id);
    if (!d) {
      const { data, error } = await client()
        .from('documents')
        .select('id,file_name,storage_path,mime_type,metadata,page_count')
        .eq('id',id)
        .single();
      if (error || !data) {
        alert('Could not find this document.');
        return;
      }
      d = data;
    }

    const { data, error } = await client().storage
      .from('plant-documents')
      .createSignedUrl(d.storage_path,600);

    if (error || !data?.signedUrl) {
      alert('Could not open original PDF.');
      return;
    }

    const pageNum = Number(page);
    const target = Number.isFinite(pageNum) && pageNum > 0
      ? data.signedUrl + '#page=' + Math.floor(pageNum)
      : data.signedUrl;

    const w = window.open(target,'_blank');
    if (!w) window.location.href = target;
  }
  window.openOriginalPdfFromPreview = openOriginalPdfFromPreview;

  async function previewVisionPdfPage(d, page) {
    if (!window.pdfjsLib) {
      alert('PDF preview library is not available. Press ↻ refresh and try again.');
      return;
    }

    const pageNum = Math.floor(Number(page));
    if (!Number.isFinite(pageNum) || pageNum < 1) {
      alert('Exact supporting page is unavailable.');
      return;
    }

    document.getElementById('pdfImagePreviewModal')?.remove();

    document.body.insertAdjacentHTML('beforeend',
      '<div class="modalback" id="pdfImagePreviewModal">' +
        '<div class="pdf-image-modalbox">' +
          '<div class="spreadsheet-preview-head">' +
            '<div><h3>Supporting PDF Page</h3>' +
              '<div class="muted small">' + esc(d.file_name || 'PDF') + ' · Page ' + pageNum + '</div>' +
            '</div>' +
            '<button onclick="closePdfImagePreview()">Close</button>' +
          '</div>' +
          '<div id="pdfImagePreviewBody" class="pdf-image-preview-body">' +
            '<div class="muted">Rendering supporting page…</div>' +
          '</div>' +
          '<div class="actions pdf-preview-actions">' +
            '<button onclick="openOriginalPdfFromPreview(\'' + d.id + '\',' + pageNum + ')">Open original PDF</button>' +
          '</div>' +
        '</div>' +
      '</div>');

    try {
      const { data: blob, error } = await client().storage
        .from('plant-documents')
        .download(d.storage_path);

      if (error || !blob) throw error || new Error('Could not read supporting PDF.');

      const buf = await blob.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({data:buf}).promise;

      if (pageNum > pdf.numPages) throw new Error('Supporting page is outside this PDF.');

      const imageData = await renderPdfPageForVision(pdf,pageNum);
      const body = document.getElementById('pdfImagePreviewBody');
      if (body) {
        body.innerHTML =
          '<img class="pdf-page-preview-image" src="' + imageData + '" alt="Supporting PDF page ' + pageNum + '">';
      }
    } catch (err) {
      const body = document.getElementById('pdfImagePreviewBody');
      if (body) {
        body.innerHTML = '<div class="notice">Could not render supporting page: ' +
          esc(err?.message || String(err)) + '</div>';
      }
    }
  }

  async function viewDocument(id, page=null) {
    let d = docs.find(x => x.id === id);

    if (!d) {
      const { data, error } = await client()
        .from('documents')
        .select('id,file_name,storage_path,mime_type,metadata,page_count')
        .eq('id', id)
        .single();

      if (error || !data) {
        alert('Could not find this document.');
        return;
      }
      d = data;
    }

    if (isSpreadsheetDocument(d)) {
      await previewSpreadsheet(d);
      return;
    }

    if (isPdfDocument(d)) {
      const pageNum = Number(page);
      const pageText = Number.isFinite(pageNum) && pageNum > 0
        ? ' at Page ' + Math.floor(pageNum)
        : '';

      if (isVisionIndexedPdfPage(d,pageNum)) {
        const ok = confirm('Preview supporting PDF' + pageText + ' as an image?');
        if (!ok) return;
        await previewVisionPdfPage(d,pageNum);
        return;
      }

      const ok = confirm('Open supporting PDF' + pageText + '?');
      if (!ok) return;
    }

    const { data, error } = await client().storage
      .from('plant-documents')
      .createSignedUrl(d.storage_path, 600);

    if (error || !data?.signedUrl) {
      alert('Could not open document: ' + (error?.message || 'Signed link was not created.'));
      return;
    }

    const pageNum = Number(page);
    const targetUrl = Number.isFinite(pageNum) && pageNum > 0
      ? data.signedUrl + '#page=' + Math.floor(pageNum)
      : data.signedUrl;

    const w = window.open(targetUrl, '_blank');
    if (!w) {
      window.location.href = targetUrl;
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
    saveSearchHistory();

    if (backendSession && backendRole && ['admin','engineer','viewer'].includes(backendRole)) {
      const forcedScope = document.getElementById('searchScope')?.value || '';
      const hits = await searchPrivateDocuments(raw, forcedScope);
      if (hits.length) {
        renderTabs();
        document.getElementById('view').innerHTML = renderPrivateHits(raw, hits);
        window.pp360RememberSearchAnswer?.(raw);
        return;
      }
    }

    originalSearchAll();
  };

  function safeExternalUrl(value) {
    try {
      const u = new URL(String(value || ''));
      return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : '';
    } catch (_) {
      return '';
    }
  }

  function renderRagAnswer(payload) {
    const lines = Array.isArray(payload?.answer_lines)
      ? payload.answer_lines.filter(Boolean)
      : String(payload?.answer || '').split(/\n+/).map(x=>x.trim()).filter(Boolean);

    const isWeb = payload?.source_type === 'web';
    const isParameterWeb = isWeb && payload?.display_mode === 'parameter_lines';

    let cleanedLines = lines.map(line => String(line || '')
      .replace(/【[^】]+】/g,'')
      .replace(/\[(?:source\s*)?\d+\]/gi,'')
      .replace(/\((?:source\s*)?\d+\)/gi,'')
      .replace(/[\uE000-\uF8FF]/g,'')
      .replace(/\(\s*\)/g,'')
      .replace(/\s+0\s*$/g,'')
      .replace(/\s+/g,' ')
      .trim()).filter(Boolean);

    if (isParameterWeb && cleanedLines.length) {
      cleanedLines = cleanedLines
        .join(' ')
        .replace(/\s+0\s+(?=(?:SO₂\s*\/\s*SOx|SO₂|SO2|SOx|NOx|NO₂|NO2|PM|Applicability)\s*:)/gi,'\n')
        .replace(/\s+(?=(?:SO₂\s*\/\s*SOx|SO₂|SO2|SOx|NOx|NO₂|NO2|PM|Applicability)\s*:)/gi,'\n')
        .split(/\n+/)
        .map(x => x.replace(/\(\s*\)/g,'').replace(/\s+/g,' ').trim())
        .filter(Boolean);
    }

    const onlineLine = cleanedLines.join(' ').trim();

    const rowHtml = cleanedLines.length
      ? '<div class="multi-answer">' + cleanedLines.map(line => {
          const m = line.match(/^([^:]{1,80})\s*:\s*(.+)$/);
          return m
            ? '<div class="multi-answer-row"><span>' + esc(m[1]) + '</span><b>' + esc(m[2]) + '</b></div>'
            : '<div class="simple-answer-lines"><div>' + esc(line) + '</div></div>';
        }).join('') + '</div>'
      : '<div class="onelineanswer"><b>No verified answer found.</b></div>';

    const lineHtml = isParameterWeb
      ? rowHtml
      : (isWeb
          ? '<div class="onelineanswer"><b>' + esc(onlineLine || 'No reliable online reference found.') + '</b></div>'
          : rowHtml);

    const seen = new Set();
    const buttons = [];
    for (const src of (payload?.sources || [])) {
      const id = src?.document_id || src?.id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const fileName = String(src?.file_name || '');
      const isSheet = /\.(xlsx|xls|csv)$/i.test(fileName);
      const page = Number(src?.page);
      const pageEnd = Number(src?.page_end);
      const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : null;
      const safeEnd = Number.isFinite(pageEnd) && pageEnd >= page ? Math.floor(pageEnd) : safePage;
      const pageArg = (!isSheet && safePage) ? ',' + safePage : '';
      const pageLabel = isSheet
        ? ''
        : (safePage
            ? (safeEnd && safeEnd > safePage
                ? ' · Pages ' + safePage + '–' + safeEnd
                : ' · Page ' + safePage)
            : '');
      const buttonLabel = isSheet ? 'View supporting spreadsheet' : 'View supporting document' + pageLabel;
      buttons.push('<button onclick="viewDocument(\'' + id + '\'' + pageArg + ')">' + buttonLabel + '</button>');
      if (buttons.length >= 3) break;
    }

    const plantActions = buttons.length
      ? '<div class="result-actions">' + buttons.join('') + '</div>'
      : '';

    const webLinks = [];
    const webSeen = new Set();
    for (const src of (payload?.web_sources || [])) {
      const url = safeExternalUrl(src?.url);
      if (!url || webSeen.has(url)) continue;
      webSeen.add(url);
      const title = String(src?.title || 'Online source').trim() || 'Online source';
      webLinks.push('<a class="online-source-link" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(title) + '</a>');
      if (webLinks.length >= 5) break;
    }

    const onlineActions = webLinks.length
      ? '<div class="online-sources"><b>Sources</b>' + webLinks.join('') + '</div>'
      : '';

    const badge = isWeb ? 'Online Reference' : 'Plant Data';
    const sourceNote = isWeb
      ? '<div class="online-reference-note">General online information — not verified plant-specific data.</div>'
      : '';

    return '<div class="card result compactresult"><div class="ai-answer-badge">' + badge + '</div>' + sourceNote + lineHtml + (isWeb ? onlineActions : plantActions) + '</div>';
  }

  function startSearchProgress(btn) {
    let value = 6;
    let timer = null;

    const paint = (pct) => {
      const safe = Math.max(0, Math.min(100, Math.round(pct)));
      const fill = document.getElementById('plantSearchProgressFill');
      const label = document.getElementById('plantSearchProgressPct');

      if (fill) fill.style.width = safe + '%';
      if (label) label.textContent = safe + '%';

      if (btn) {
        btn.textContent = safe + '%';
        btn.style.setProperty('--pp-search-progress', safe + '%');
      }
    };

    renderTabs();
    const view = document.getElementById('view');
    if (view) {
      view.innerHTML =
        '<div class="card result compactresult plant-search-progress-card">' +
          '<div class="plant-search-progress-track">' +
            '<div id="plantSearchProgressFill" class="plant-search-progress-fill" style="width:6%"></div>' +
            '<div id="plantSearchProgressPct" class="plant-search-progress-pct">6%</div>' +
          '</div>' +
        '</div>';
    }

    paint(value);

    timer = setInterval(() => {
      if (value >= 92) return;
      if (value < 45) value += 4;
      else if (value < 72) value += 2;
      else value += 1;
      paint(value);
    }, 420);

    return {
      complete() {
        if (timer) clearInterval(timer);
        paint(100);
      },
      stop() {
        if (timer) clearInterval(timer);
      }
    };
  }

  window.pp360Search = async function () {
    const raw = document.getElementById('q')?.value.trim() || '';
    if (!raw) return;

    const scopeValue = document.getElementById('searchScope')?.value || '';
    const btn = document.getElementById('plantSearchBtn');

    if (!scopeValue) {
      renderTabs();
      document.getElementById('view').innerHTML =
        '<div class="card result compactresult"><div class="onelineanswer"><b>Please select a department first.</b></div></div>';
      document.getElementById('searchScope')?.focus();
      return;
    }
    const oldText = btn ? btn.textContent : '';

    // Public users continue to use the built-in/public search.
    if (!backendSession || !backendRole || !['admin','engineer','viewer'].includes(backendRole)) {
      return searchAll();
    }

    let progress = null;

    try {
      if (btn) {
        btn.disabled = true;
        btn.classList.add('search-progress-button');
      }

      progress = startSearchProgress(btn);

      const { data: sessionData } = await client().auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return searchAll();

      const endpoint = cfg.supabaseUrl.replace(/\/$/,'') + '/functions/v1/plant-search';
      const res = await fetch(endpoint, {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'Authorization':'Bearer ' + token,
          'apikey':cfg.supabaseKey
        },
        body:JSON.stringify({question:raw, scope:scopeValue, mode:'plant'})
      });

      if (!res.ok) {
        let detail = '';
        try {
          const errPayload = await res.json();
          detail = String(errPayload?.error || errPayload?.message || '').trim();
        } catch (_) {
          try { detail = (await res.text()).trim(); } catch (_) {}
        }
        const msg = detail || ('Plant AI request failed with status ' + res.status);
        throw new Error(msg);
      }
      const payload = await res.json();
      if (!payload || (!payload.answer && !Array.isArray(payload.answer_lines))) {
        throw new Error('No AI answer returned.');
      }

      history = [raw, ...history.filter(x => norm(x) !== norm(raw))].slice(0,30);
      saveSearchHistory();
      if (progress) progress.complete();
      await new Promise(resolve => setTimeout(resolve, 140));
      renderTabs();
      document.getElementById('view').innerHTML = renderRagAnswer(payload);
      window.pp360RememberSearchAnswer?.(raw);
    } catch (err) {
      if (progress) progress.stop();
      const rawMessage = String(err?.message || err || 'Unknown Plant AI error');
      const safeMessage = rawMessage
        .replace(/sk-[A-Za-z0-9_-]+/g, '[hidden API key]')
        .slice(0, 500);
      renderTabs();
      document.getElementById('view').innerHTML =
        '<div class="card result compactresult"><div class="ai-answer-badge">Plant AI error</div>' +
        '<div class="notice"><b>Plant AI could not complete this search.</b><br>' + esc(safeMessage) + '</div></div>';
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('search-progress-button');
        btn.style.removeProperty('--pp-search-progress');
        btn.textContent = oldText || 'Search Plant Data';
      }
    }
  };

  window.pp360OnlineSearch = async function () {
    if (backendRole !== 'admin') return;

    const raw = document.getElementById('q')?.value.trim() || '';
    const scopeValue = document.getElementById('searchScope')?.value || '';
    const btn = document.getElementById('onlineSearchBtn');

    if (!raw) return;
    if (!scopeValue) {
      renderTabs();
      document.getElementById('view').innerHTML =
        '<div class="card result compactresult"><div class="onelineanswer"><b>Please select a department first.</b></div></div>';
      document.getElementById('searchScope')?.focus();
      return;
    }

    const oldText = btn ? btn.textContent : 'Online Search';

    try {
      if (btn) { btn.disabled = true; btn.textContent = 'Searching…'; }

      renderTabs();
      document.getElementById('view').innerHTML =
        '<div class="card result compactresult">' +
          '<div class="ai-answer-badge">Online Search</div>' +
          '<div class="onelineanswer"><b>Searching current online references…</b></div>' +
          '<div class="muted small" style="margin-top:8px">General online information — not verified plant-specific data.</div>' +
        '</div>';

      const { data: sessionData } = await client().auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Session expired. Please log in again.');

      const endpoint = cfg.supabaseUrl.replace(/\/$/,'') + '/functions/v1/plant-search';
      const res = await fetch(endpoint, {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'Authorization':'Bearer ' + token,
          'apikey':cfg.supabaseKey
        },
        body:JSON.stringify({question:raw, scope:scopeValue, mode:'web'})
      });

      if (!res.ok) {
        let detail = '';
        try {
          const errPayload = await res.json();
          detail = String(errPayload?.error || errPayload?.message || '').trim();
        } catch (_) {}
        throw new Error(detail || ('Online search failed with status ' + res.status));
      }

      const payload = await res.json();
      history = [raw, ...history.filter(x => norm(x) !== norm(raw))].slice(0,30);
      saveSearchHistory();
      renderTabs();
      document.getElementById('view').innerHTML = renderRagAnswer(payload);
      window.pp360RememberSearchAnswer?.(raw);
    } catch (err) {
      const safeMessage = String(err?.message || err || 'Unknown online search error')
        .replace(/sk-[A-Za-z0-9_-]+/g, '[hidden API key]')
        .slice(0,500);
      renderTabs();
      document.getElementById('view').innerHTML =
        '<div class="card result compactresult"><div class="ai-answer-badge">Online Search error</div>' +
        '<div class="notice"><b>Online Search could not complete.</b><br>' + esc(safeMessage) + '</div></div>';
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = oldText || 'Online Search'; }
    }
  };

  const qInput = document.getElementById('q');
  if (qInput) qInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      window.pp360Search();
    }
  });

  restoreBackendSession();

  const headerRefresh = document.getElementById('refreshBtn');
  if (headerRefresh) headerRefresh.onclick = () => window.hardRefreshPP360();

})();
