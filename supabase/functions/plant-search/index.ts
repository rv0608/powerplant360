import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STOP = new Set([
  "what","is","the","of","for","show","give","please","data","details","detail",
  "plant","system","equipment","and","or","to","in","on","a","an","my","our"
]);

function norm(s = "") {
  return String(s).toLowerCase().replace(/[^a-z0-9&/._ -]+/g, " ").replace(/\s+/g, " ").trim();
}

function tokens(q: string) {
  return [...new Set(norm(q).split(" ").filter(x => x.length > 2 && !STOP.has(x)))].slice(0, 8);
}

function inferScope(q: string) {
  const n = norm(q);
  const routes = [
    ["Steam Turbine", ["steam turbine","turbine","governor","turbine gear","gearbox","gear box"]],
    ["Air Cooled Condenser", ["air cooled condenser","acc"]],
    ["CFBC Boiler", ["cfbc","boiler","bfp","bfw pump","pa fan","sa fan","id fan","esp","superheater","economizer","economiser","evaporator","steam drum","bed material"]],
    ["CHP", ["chp","coal handling"]],
    ["AHS", ["ahs","ash handling"]],
    ["WTP / ETP", ["wtp","etp","water treatment","effluent treatment"]],
    ["Cooling Tower", ["cooling tower"]],
    ["Electrical", ["transformer","generator","switchgear","electrical"]],
    ["C&I", ["c&i","instrument","transmitter","dcs","plc"]],
  ];
  return routes.find(([, terms]) => terms.some((t: string) => n.includes(t)))?.[0] || "";
}

function splitPages(extracted = "") {
  const parts = String(extracted).split(/\[\[PAGE (\d+)\]\]\n?/g);
  const out: Array<{page:number|null,text:string}> = [];
  for (let i = 1; i < parts.length; i += 2) {
    out.push({ page: Number(parts[i]), text: parts[i + 1] || "" });
  }
  if (!out.length && extracted) out.push({ page: null, text: extracted });
  return out;
}

function scoreChunk(question: string, text: string, fileName: string, category: string, sourcePath: string) {
  const q = norm(question);
  const ts = tokens(question);
  const hay = norm([text, fileName, category, sourcePath].join(" "));
  let score = 0;

  if (q && hay.includes(q)) score += 160;
  for (const t of ts) {
    const count = hay.split(t).length - 1;
    score += Math.min(count, 8) * 22;
    if (norm(fileName).includes(t)) score += 50;
    if (norm(sourcePath).includes(t)) score += 35;
  }

  // Avoid common sub-equipment mix-ups unless explicitly requested.
  const nq = norm(question);
  if (/\bbfp\b|bfw pump|boiler feed pump/.test(nq) && !/\bmotor\b/.test(nq) && /motor/.test(norm(fileName + " " + sourcePath))) score -= 220;
  if (/\b(pa|sa|id) fan\b/.test(nq) && !/\bmotor\b/.test(nq) && /motor/.test(norm(fileName + " " + sourcePath))) score -= 220;

  return score;
}

function extractResponseText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const item of payload?.output || []) {
    for (const c of item?.content || []) {
      if ((c?.type === "output_text" || c?.type === "text") && typeof c?.text === "string") return c.text;
    }
  }
  return "";
}

function collectWebSources(payload: any) {
  const out: Array<{title:string,url:string}> = [];
  const seen = new Set<string>();

  const push = (title:any, url:any) => {
    const u = String(url || "").trim();
    if (!/^https?:\/\//i.test(u) || seen.has(u)) return;
    seen.add(u);
    out.push({ title:String(title || u).trim().slice(0,160), url:u });
  };

  for (const item of payload?.output || []) {
    for (const c of item?.content || []) {
      for (const a of c?.annotations || []) {
        const uc = a?.url_citation || a;
        if (a?.type === "url_citation" || uc?.url) push(uc?.title, uc?.url);
      }
    }
    for (const src of item?.sources || []) push(src?.title, src?.url);
  }

  for (const src of payload?.sources || []) push(src?.title, src?.url);
  return out.slice(0, 6);
}

function isNoExact(lines:any) {
  const list = Array.isArray(lines) ? lines : [];
  if (!list.length) return true;
  return list.every((x:any) => /no exact plant-document match found/i.test(String(x || "")));
}

function isRegulatoryQuery(q:string) {
  return /\b(limit|limits|standard|standards|norm|norms|cpcb|moef|moefcc|emission|emissions|sox|so2|nox|no2|pm|particulate)\b/i.test(q);
}

function countWebSearchCalls(payload:any) {
  return (payload?.output || []).filter((x:any) =>
    String(x?.type || "").toLowerCase().includes("web_search_call")
  ).length;
}

function usageFromResponse(payload:any, webSearchCalls=0) {
  const u = payload?.usage || {};
  return {
    input_tokens: Number(u?.input_tokens || 0),
    cached_input_tokens: Number(u?.input_tokens_details?.cached_tokens || 0),
    output_tokens: Number(u?.output_tokens || 0),
    web_search_calls: Number(webSearchCalls || 0)
  };
}

function combineUsage(...items:any[]) {
  return items.reduce((a:any, x:any) => ({
    input_tokens:a.input_tokens + Number(x?.input_tokens || 0),
    cached_input_tokens:a.cached_input_tokens + Number(x?.cached_input_tokens || 0),
    output_tokens:a.output_tokens + Number(x?.output_tokens || 0),
    web_search_calls:a.web_search_calls + Number(x?.web_search_calls || 0)
  }), {input_tokens:0,cached_input_tokens:0,output_tokens:0,web_search_calls:0});
}

// Conservative list-rate estimate used by the Admin dashboard.
// Actual OpenAI Billing remains authoritative.
function estimateCostUsd(u:any) {
  const input = Number(u?.input_tokens || 0);
  const cached = Math.min(input, Number(u?.cached_input_tokens || 0));
  const uncached = Math.max(0, input - cached);
  const output = Number(u?.output_tokens || 0);
  const web = Number(u?.web_search_calls || 0);
  return (
    (uncached * 0.10 / 1_000_000) +
    (cached * 0.01 / 1_000_000) +
    (output * 0.50 / 1_000_000) +
    (web * 0.01)
  );
}

async function webFallback(openaiKey:string, model:string, question:string, scope:string) {
  const regulatory = isRegulatoryQuery(question);
  const webInstructions = `
You are PowerPlant360, a thermal power-plant engineering assistant.
The selected department is: ${scope}.

The plant's private documents did not contain a verified answer, so answer from current public web sources.
Rules:
- Clearly treat the answer as general/online information, not as verified plant-specific data.
- Never claim an online value is this plant's actual value.
- If the question asks for a plant-specific make, model, setting, rating, serial number, exact design value, or exact operating limit, state that the plant-specific value is not verified and then give only useful general context if available.
- Prefer manufacturer/OEM documentation, standards bodies, government/academic sources, and established engineering references.
- For ordinary questions: return exactly ONE concise plain-text line, normally under 35 words.
- For regulatory/limit/standard/norm/emission questions: return 2–4 plain-text parameter lines. Start each line with one of these exact labels when relevant: "SO₂/SOx :", "NOx :", "PM :", "Applicability :". Never place two labels on the same line.
- Do not use bullets, markdown, headings, bold markers, tables, inline URLs, or source names in the answer text.
- Source links will be shown separately by the app.
- If the question asks about limits, standards, norms, CPCB/MoEFCC, SO₂/SOx, NOx, PM or emissions, prioritize official Indian sources such as CPCB and MoEFCC over secondary sites.
- For such regulatory questions, include the applicability condition in the same line (for example commissioning period, unit size/capacity, fuel/category, or rule/amendment) whenever the source provides it.
- Never present one generic emission limit as universally applicable when the regulation has multiple categories.
`.trim();

  const res = await fetch("https://api.openai.com/v1/responses", {
    method:"POST",
    headers:{
      "Authorization":`Bearer ${openaiKey}`,
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      model,
      instructions:webInstructions,
      tools:[{ type:"web_search", search_context_size:"medium" }],
      tool_choice:"auto",
      input:`Department: ${scope}\nRegulatory/limit question: ${regulatory ? "yes" : "no"}\nQuestion: ${question}`
    })
  });

  if (!res.ok) {
    const t = await res.text();
    console.error("Plant AI web search failed", res.status, t.slice(0,800));
    throw new Error(`Web search failed (${res.status}): ${t.slice(0,500)}`);
  }

  const payload = await res.json();
  const answer = extractResponseText(payload).trim();

  const cleanWebLine = (value:string) => String(value || "")
    .replace(/\[[^\]]+\]\([^\)]+\)/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/【[^】]+】/g, "")
    .replace(/\[(?:source\s*)?\d+\]/gi, "")
    .replace(/\((?:source\s*)?\d+\)/gi, "")
    .replace(/[\uE000-\uF8FF]/g, "")
    .replace(/^[\s•*-]+/, "")
    .replace(/[\*_#>~]+/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+0\s*$/g, "")
    .trim();

  let answerLines:string[] = [];

  if (regulatory) {
    const regulatoryText = answer
      .replace(/\(\s*\)/g, "")
      .replace(/\s+0\s+(?=(?:SO₂\s*\/\s*SOx|SO₂|SO2|SOx|NOx|NO₂|NO2|PM|Applicability)\s*:)/gi, "\n")
      .replace(/;\s*(?=(?:SO₂\s*\/\s*SOx|SO₂|SO2|SOx|NOx|NO₂|NO2|PM|Applicability)\s*:)/gi, "\n")
      .replace(/\s+(?=(?:SO₂\s*\/\s*SOx|SO₂|SO2|SOx|NOx|NO₂|NO2|PM|Applicability)\s*:)/gi, "\n");

    answerLines = regulatoryText
      .split(/\n+/)
      .map(cleanWebLine)
      .filter(Boolean);
  } else {
    const cleanLine = cleanWebLine(answer);
    answerLines = [cleanLine || "No reliable online reference found."];
  }

  return {
    answer_lines: answerLines.length ? answerLines : ["No reliable online reference found."],
    sources: [],
    web_sources: collectWebSources(payload),
    source_type: "web",
    display_mode: regulatory ? "parameter_lines" : "one_line",
    scope,
    __usage: usageFromResponse(payload, countWebSearchCalls(payload))
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type":"application/json" }});
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const model = Deno.env.get("OPENAI_MODEL") || "gpt-6-luna";

    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "AI_NOT_CONFIGURED" }), { status: 503, headers: { ...corsHeaders, "Content-Type":"application/json" }});
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth } }
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type":"application/json" }});
    }

    let adminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    try {
      const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
      adminKey = keys?.default || adminKey;
    } catch (_) {}
    const supabaseAdmin = adminKey ? createClient(supabaseUrl, adminKey) : null;

    let callerRole = "";
    if (supabaseAdmin) {
      const { data: roleRow } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      callerRole = String(roleRow?.role || "");
    }
    const allowOnlineWeb = callerRole === "admin";

    const recordUsage = async (usage:any, sourceType:string, scopeValue:string) => {
      if (!supabaseAdmin || !usage) return;
      const row = {
        user_id:userData.user.id,
        scope:scopeValue,
        source_type:sourceType,
        model,
        input_tokens:Number(usage.input_tokens || 0),
        cached_input_tokens:Number(usage.cached_input_tokens || 0),
        output_tokens:Number(usage.output_tokens || 0),
        web_search_calls:Number(usage.web_search_calls || 0),
        estimated_cost_usd:Number(estimateCostUsd(usage).toFixed(6))
      };
      const { error: usageError } = await supabaseAdmin.from("api_usage").insert(row);
      if (usageError) console.error("api_usage insert failed", usageError.message);
    };

    const body = await req.json().catch(() => ({}));
    const question = String(body?.question || "").trim();
    const requestedScope = String(body?.scope || "").trim();
    if (!question) {
      return new Response(JSON.stringify({ error: "Question required" }), { status: 400, headers: { ...corsHeaders, "Content-Type":"application/json" }});
    }

    if (!requestedScope) {
      return new Response(JSON.stringify({ error: "Department scope required" }), {
        status:400,
        headers:{ ...corsHeaders, "Content-Type":"application/json" }
      });
    }

    const scope = requestedScope;
    const ts = tokens(question);

    let query = supabase
      .from("documents")
      .select("id,file_name,category,document_type,extracted_text,page_count,metadata")
      .eq("processing_status", "ready")
      .not("extracted_text", "is", null);

    query = query.eq("category", scope);

    // Limit candidate documents using lexical terms before page scoring.
    if (ts.length) {
      const safe = ts.slice(0, 4).map(t => t.replace(/[,%()]/g, ""));
      const clauses = safe.flatMap(t => [
        `extracted_text.ilike.%${t}%`,
        `file_name.ilike.%${t}%`
      ]);
      query = query.or(clauses.join(","));
    }

    let { data: docs, error } = await query.limit(40);

    // If scoped lexical retrieval is too strict, retry within the scope without token filter.
    if (!error && (!docs || !docs.length)) {
      const retry = await supabase
        .from("documents")
        .select("id,file_name,category,document_type,extracted_text,page_count,metadata")
        .eq("processing_status", "ready")
        .eq("category", scope)
        .not("extracted_text", "is", null)
        .limit(30);
      docs = retry.data;
      error = retry.error;
    }

    if (error) throw error;
    if (!docs?.length) {
      if (!allowOnlineWeb) {
return new Response(JSON.stringify({
          answer_lines:["No exact plant-document match found."],
          sources:[],
          web_sources:[],
          source_type:"plant",
          scope
        }), {
          headers:{ ...corsHeaders, "Content-Type":"application/json" }
        });
      }
      if (!allowOnlineWeb) {
return new Response(JSON.stringify({
          answer_lines:["No exact plant-document match found."],
          sources:[],
          web_sources:[],
          source_type:"plant",
          scope
        }), {
          headers:{ ...corsHeaders, "Content-Type":"application/json" }
        });
      }
      const online = await webFallback(openaiKey, model, question, scope);
      await recordUsage(online.__usage, "web", scope);
      delete online.__usage;
      return new Response(JSON.stringify(online), {
        headers:{ ...corsHeaders, "Content-Type":"application/json" }
      });
    }

    const chunks: Array<any> = [];
    for (const d of docs) {
      const sourcePath = String(d?.metadata?.source_path || "");
      for (const p of splitPages(d.extracted_text || "")) {
        const text = String(p.text || "").replace(/\s+/g, " ").trim();
        if (!text) continue;
        const score = scoreChunk(question, text, d.file_name || "", d.category || "", sourcePath);
        if (score <= 0) continue;
        chunks.push({
          score,
          document_id:d.id,
          file_name:d.file_name,
          category:d.category,
          document_type:d.document_type,
          page:p.page,
          text:text.slice(0, 2200)
        });
      }
    }

    chunks.sort((a,b) => b.score - a.score);
    const top = chunks.slice(0, 8);

    if (!top.length) {
      const online = await webFallback(openaiKey, model, question, scope);
      await recordUsage(online.__usage, "web", scope);
      delete online.__usage;
      return new Response(JSON.stringify(online), {
        headers:{ ...corsHeaders, "Content-Type":"application/json" }
      });
    }

    const context = top.map((c, i) =>
      `[SOURCE ${i}]\nEquipment: ${c.category || ""}\nDocument: ${c.file_name || ""}\nPage: ${c.page ?? ""}\nText: ${c.text}`
    ).join("\n\n");

    const instructions = `
You are PowerPlant360, a thermal power-plant document assistant.
Answer ONLY from the supplied plant-document context. Do not use outside knowledge for plant-specific values.
If the context does not support the requested answer, say exactly: "No exact plant-document match found."

Rules:
- One requested value: return one concise line "Parameter : Value".
- Multiple values/specifications: return one parameter per line.
- Never dump raw PDF paragraphs.
- Remove company headers, page headers, revision tables, and irrelevant text.
- Keep equipment identity strict: pump != pump motor; fan != fan motor; actuator/bearing/gearbox data must not replace parent-equipment data unless asked.
- Use units exactly as supported by the context.
- Do not invent, infer, average, or correct values.
- For limits/standards/norms/emissions questions, answer from plant documents ONLY if an explicit numeric limit and its applicability/condition are present in the supplied context. Otherwise return exactly: "No exact plant-document match found."
- Return JSON only in this shape:
{"answer_lines":["..."],"source_indices":[0,1]}
source_indices must contain only the source numbers that directly support the answer.
`.trim();

    const aiRes = await fetch("https://api.openai.com/v1/responses", {
      method:"POST",
      headers:{
        "Authorization":`Bearer ${openaiKey}`,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        model,
        instructions,
        input:`Question: ${question}\n\nPlant-document context:\n${context}`
      })
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("Plant AI OpenAI request failed", aiRes.status, t.slice(0,800));
      throw new Error(`AI request failed (${aiRes.status}): ${t.slice(0,500)}`);
    }

    const ai = await aiRes.json();
    const plantUsage = usageFromResponse(ai, 0);
    const raw = extractResponseText(ai).trim();
    let parsed:any;
    try {
      parsed = JSON.parse(raw.replace(/^\`\`\`json\s*/i,"").replace(/\`\`\`$/,"").trim());
    } catch {
      parsed = { answer_lines: raw.split(/\n+/).map((x:string)=>x.trim()).filter(Boolean), source_indices:[0] };
    }

    const sourceIndices = Array.isArray(parsed?.source_indices) ? parsed.source_indices : [0];
    const seen = new Set<string>();
    const sources = sourceIndices
      .map((i:number) => top[i])
      .filter(Boolean)
      .filter((x:any) => {
        if (seen.has(x.document_id)) return false;
        seen.add(x.document_id);
        return true;
      })
      .slice(0,3)
      .map((x:any) => ({
        document_id:x.document_id,
        file_name:x.file_name,
        page:x.page
      }));

    const answerLines = Array.isArray(parsed?.answer_lines) ? parsed.answer_lines : [];
    if (isNoExact(answerLines)) {
      if (!allowOnlineWeb) {
        await recordUsage(plantUsage, "plant", scope);
        return new Response(JSON.stringify({
          answer_lines:["No exact plant-document match found."],
          sources:[],
          web_sources:[],
          source_type:"plant",
          scope
        }), {
          headers:{ ...corsHeaders, "Content-Type":"application/json" }
        });
      }

      const online = await webFallback(openaiKey, model, question, scope);
      await recordUsage(online.__usage, "web", scope);
      delete online.__usage;
      return new Response(JSON.stringify(online), {
        headers:{ ...corsHeaders, "Content-Type":"application/json" }
      });
    }

    await recordUsage(plantUsage, "plant", scope);

    return new Response(JSON.stringify({
      answer_lines:answerLines,
      sources,
      web_sources:[],
      source_type:"plant",
      scope
    }), {
      headers:{ ...corsHeaders, "Content-Type":"application/json" }
    });
  } catch (err) {
    console.error("plant-search error", String(err?.message || err).slice(0,1000));
    return new Response(JSON.stringify({ error:String(err?.message || err) }), {
      status:500,
      headers:{ ...corsHeaders, "Content-Type":"application/json" }
    });
  }
});
