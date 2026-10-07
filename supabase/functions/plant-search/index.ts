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
    const model = Deno.env.get("OPENAI_MODEL") || "gpt-5-mini";

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

    const body = await req.json().catch(() => ({}));
    const question = String(body?.question || "").trim();
    const requestedScope = String(body?.scope || "").trim();
    if (!question) {
      return new Response(JSON.stringify({ error: "Question required" }), { status: 400, headers: { ...corsHeaders, "Content-Type":"application/json" }});
    }

    const scope = requestedScope || inferScope(question);
    const ts = tokens(question);

    let query = supabase
      .from("documents")
      .select("id,file_name,category,document_type,extracted_text,page_count,metadata")
      .eq("processing_status", "ready")
      .not("extracted_text", "is", null);

    if (scope) query = query.eq("category", scope);

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
    if (!error && (!docs || !docs.length) && scope) {
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
      return new Response(JSON.stringify({ answer_lines:["No exact plant-document match found."], sources:[] }), {
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
      return new Response(JSON.stringify({ answer_lines:["No exact plant-document match found."], sources:[] }), {
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
      throw new Error(`AI request failed (${aiRes.status}): ${t.slice(0,300)}`);
    }

    const ai = await aiRes.json();
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

    return new Response(JSON.stringify({
      answer_lines:Array.isArray(parsed?.answer_lines) ? parsed.answer_lines : [],
      sources,
      scope:scope || "All Plant"
    }), {
      headers:{ ...corsHeaders, "Content-Type":"application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error:String(err?.message || err) }), {
      status:500,
      headers:{ ...corsHeaders, "Content-Type":"application/json" }
    });
  }
});
