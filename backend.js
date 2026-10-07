
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

  async function searchPrivateDocuments(q) {
    if (!backendSession || !client()) return [];
    const { data, error } = await client()
      .from('documents')
      .select('id,file_name,category,document_type,processing_status,extracted_text,page_count')
      .eq('processing_status', 'ready')
      .not('extracted_text', 'is', null);
    if (error || !data) return [];

    const tokens = queryTokens(q);
    if (!tokens.length) return [];

    const hits = [];
    for (const d of data) {
      const raw = d.extracted_text || '';
      const parts = raw.split(/\[\[PAGE (\d+)\]\]\n?/g);
      for (let i = 1; i < parts.length; i += 2) {
        const pageNo = Number(parts[i]);
        const text = parts[i + 1] || '';
        const score = pageMatches(text, tokens, q);
        if (score > 0) {
          hits.push({
            score,
            file_name: d.file_name,
            page: pageNo,
            text,
            category: d.category,
            document_type: d.document_type
          });
        }
      }
    }
    return hits.sort((a,b)=>b.score-a.score).slice(0,6);
  }

  function oneLineFromHit(q, hit) {
    const text = hit.text || '';
    const nq = norm(q);

    if (nq === 'turbine speed' || nq.includes('rated speed')) {
      const rated = text.match(/Rated Speed\s*:?\s*([0-9][0-9\s,.]*)\s*RPM/i);
      if (rated) return 'Rated Speed : ' + String(rated[1]).trim() + ' RPM';
    }

    const tokens = queryTokens(q);
    const snippet = makeSnippet(text, tokens).replace(/\s+/g,' ').trim();
    return snippet.length > 180 ? snippet.slice(0,180) + '…' : snippet;
  }

  function renderPrivateHits(q, hits) {
    const best = hits[0];
    const answer = oneLineFromHit(q, best);

    return `<div class="card result compactresult">
      <div class="onelineanswer">
        <b>${esc(answer)}</b>
      </div>
    </div>`;
  }

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
        <button onclick="logout()">Logout</button>
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
        <button onclick="logout()">Logout</button>
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

  async function uploadRealFile(file, id) {
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
        category: guessCategory(file.name),
        document_type: guessDocType(file.name),
        file_size: file.size,
        mime_type: file.type || null,
        processing_status: file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf') ? 'processing' : 'uploaded',
        uploaded_by: s.user.id,
        metadata: { original_name: file.name }
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
            metadata: { original_name: file.name, extraction_error: String(extractErr.message || extractErr) }
          }).eq('id', insertedRows.id);
          status.innerHTML = '<span class="errtext">Upload saved, but PDF text extraction failed: ' + esc(extractErr.message || String(extractErr)) + '</span>';
        }
      } else {
        status.innerHTML = '<span class="oktext">✓ Secure upload completed</span>';
      }

      await loadDocsFromBackend();
    } catch (err) {
      bar.classList.add('errorbar');
      pct.textContent = 'Error';
      status.innerHTML = '<span class="errtext">✕ ' + esc(err.message || String(err)) + '</span>';
    }
  }


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

  renderDocTable = function () {
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
})();
