import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function extractResponseText(payload:any) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const item of payload?.output || []) {
    for (const c of item?.content || []) {
      if ((c?.type === "output_text" || c?.type === "text") && typeof c?.text === "string") {
        return c.text;
      }
    }
  }
  return "";
}

function usageFromResponse(payload:any) {
  const u = payload?.usage || {};
  return {
    input_tokens:Number(u?.input_tokens || 0),
    cached_input_tokens:Number(u?.input_tokens_details?.cached_tokens || 0),
    output_tokens:Number(u?.output_tokens || 0)
  };
}

function estimateCostUsd(u:any) {
  const input = Number(u?.input_tokens || 0);
  const cached = Math.min(input, Number(u?.cached_input_tokens || 0));
  const uncached = Math.max(0, input - cached);
  const output = Number(u?.output_tokens || 0);
  return (
    (uncached * 0.10 / 1_000_000) +
    (cached * 0.01 / 1_000_000) +
    (output * 0.50 / 1_000_000)
  );
}

function mergeVisionPage(existing:string, pageNumber:number, visionText:string) {
  const source = String(existing || "");
  const markerRe = /\[\[PAGE (\d+)\]\]\n?/g;
  const matches = [...source.matchAll(markerRe)];

  if (!matches.length) {
    return `[[PAGE ${pageNumber}]]\n[VISION INDEX]\n${visionText}`;
  }

  const blocks:Array<{page:number,text:string}> = [];
  for (let i=0; i<matches.length; i++) {
    const m = matches[i];
    const start = Number(m.index) + m[0].length;
    const end = i + 1 < matches.length ? Number(matches[i+1].index) : source.length;
    blocks.push({
      page:Number(m[1]),
      text:source.slice(start,end).trim()
    });
  }

  let found = false;
  for (const block of blocks) {
    if (block.page !== pageNumber) continue;
    found = true;
    const original = block.text
      .replace(/\n?\[VISION INDEX\][\s\S]*$/i, "")
      .trim();
    block.text = [original, "[VISION INDEX]", visionText].filter(Boolean).join("\n");
  }

  if (!found) {
    blocks.push({page:pageNumber,text:`[VISION INDEX]\n${visionText}`});
    blocks.sort((a,b) => a.page - b.page);
  }

  return blocks.map(b => `[[PAGE ${b.page}]]\n${b.text}`).join("\n\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", {headers:corsHeaders});
  if (req.method !== "POST") {
    return new Response("Method not allowed", {status:405,headers:corsHeaders});
  }

  try {
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({error:"Unauthorized"}), {
        status:401,
        headers:{...corsHeaders,"Content-Type":"application/json"}
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const model = Deno.env.get("OPENAI_MODEL") || "gpt-6-luna";

    if (!openaiKey) {
      return new Response(JSON.stringify({error:"AI_NOT_CONFIGURED"}), {
        status:503,
        headers:{...corsHeaders,"Content-Type":"application/json"}
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global:{headers:{Authorization:auth}}
    });

    const {data:userData,error:userError} = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({error:"Unauthorized"}), {
        status:401,
        headers:{...corsHeaders,"Content-Type":"application/json"}
      });
    }

    let adminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    try {
      const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
      adminKey = keys?.default || adminKey;
    } catch (_) {}
    if (!adminKey) throw new Error("Supabase server key is unavailable.");

    const admin = createClient(supabaseUrl, adminKey);

    const {data:roleRow} = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (String(roleRow?.role || "") !== "admin") {
      return new Response(JSON.stringify({error:"Admin permission required for PDF vision indexing."}), {
        status:403,
        headers:{...corsHeaders,"Content-Type":"application/json"}
      });
    }

    const body = await req.json().catch(() => ({}));
    const documentId = String(body?.document_id || "").trim();
    const pageNumber = Number(body?.page_number);
    const imageData = String(body?.image_data || "").trim();

    if (!documentId || !Number.isInteger(pageNumber) || pageNumber < 1 || !imageData) {
      return new Response(JSON.stringify({error:"document_id, page_number and image_data are required."}), {
        status:400,
        headers:{...corsHeaders,"Content-Type":"application/json"}
      });
    }

    if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(imageData)) {
      return new Response(JSON.stringify({error:"Invalid page image format."}), {
        status:400,
        headers:{...corsHeaders,"Content-Type":"application/json"}
      });
    }

    if (imageData.length > 12_000_000) {
      return new Response(JSON.stringify({error:"Rendered page image is too large. Please retry with a lower render scale."}), {
        status:413,
        headers:{...corsHeaders,"Content-Type":"application/json"}
      });
    }

    const {data:doc,error:docError} = await admin
      .from("documents")
      .select("id,file_name,category,mime_type,extracted_text,metadata,page_count")
      .eq("id",documentId)
      .single();

    if (docError || !doc) throw new Error("PDF document was not found.");

    const fileName = String(doc.file_name || "");
    const mime = String(doc.mime_type || "").toLowerCase();
    if (!(mime.includes("pdf") || fileName.toLowerCase().endsWith(".pdf"))) {
      throw new Error("Vision Index PDF can only process PDF documents.");
    }

    if (doc.page_count && pageNumber > Number(doc.page_count)) {
      throw new Error("Page number is outside this PDF.");
    }

    const instructions = `
You are indexing one scanned page from a private thermal-power-plant engineering PDF.
Transcribe ONLY information visibly supported by this page image. Never infer missing values.

Output plain text optimized for later search:
- Preserve equipment names, tag numbers, headings, model numbers, units, symbols and numeric values exactly as visible.
- For a technical table, write the table heading first, then one "Parameter: Value" line per row.
- If one row contains multiple engineering fields, keep them on one clear line separated by " | ".
- Preserve distinctions such as Pre-Screen/Post-Screen, Primary/Secondary, Pump/Motor, A/B equipment, and units.
- Ignore decorative logos, repeated company headers, page furniture and empty cells unless they carry engineering meaning.
- Do not add general engineering knowledge, explanations, calculations or corrections.
- If the page has no meaningful engineering text/table, output exactly: NO_ENGINEERING_DATA
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
        input:[{
          role:"user",
          content:[
            {
              type:"input_text",
              text:`Document: ${fileName}\nDepartment: ${doc.category || "General"}\nPDF page: ${pageNumber}\nExtract searchable engineering data from this scanned page.`
            },
            {
              type:"input_image",
              image_url:imageData,
              detail:"high"
            }
          ]
        }],
        text:{verbosity:"low"}
      })
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("Vision PDF OpenAI request failed", aiRes.status, t.slice(0,800));
      throw new Error(`Vision indexing failed (${aiRes.status}): ${t.slice(0,400)}`);
    }

    const ai = await aiRes.json();
    let extracted = extractResponseText(ai)
      .replace(/^```(?:text)?\s*/i,"")
      .replace(/```$/,"")
      .trim();

    if (!extracted) extracted = "NO_ENGINEERING_DATA";

    const currentPages = Array.isArray(doc?.metadata?.vision_indexed_pages)
      ? doc.metadata.vision_indexed_pages.map((x:any) => Number(x)).filter((x:number) => Number.isInteger(x) && x > 0)
      : [];

    const nextPages = [...new Set([...currentPages,pageNumber])].sort((a,b)=>a-b);
    const mergedText = extracted === "NO_ENGINEERING_DATA"
      ? String(doc.extracted_text || "")
      : mergeVisionPage(String(doc.extracted_text || ""), pageNumber, extracted);

    const nextMetadata = {
      ...(doc.metadata || {}),
      vision_indexed_pages:nextPages,
      vision_indexed_at:new Date().toISOString()
    };

    const {error:updateError} = await admin
      .from("documents")
      .update({
        extracted_text:mergedText,
        processing_status:"ready",
        metadata:nextMetadata,
        updated_at:new Date().toISOString()
      })
      .eq("id",documentId);

    if (updateError) throw updateError;

    const usage = usageFromResponse(ai);
    const {error:usageError} = await admin.from("api_usage").insert({
      user_id:userData.user.id,
      scope:String(doc.category || "General"),
      source_type:"index",
      model,
      input_tokens:usage.input_tokens,
      cached_input_tokens:usage.cached_input_tokens,
      output_tokens:usage.output_tokens,
      web_search_calls:0,
      estimated_cost_usd:Number(estimateCostUsd(usage).toFixed(6))
    });
    if (usageError) console.error("Vision PDF usage tracking failed", usageError.message);

    return new Response(JSON.stringify({
      ok:true,
      document_id:documentId,
      page_number:pageNumber,
      characters:extracted === "NO_ENGINEERING_DATA" ? 0 : extracted.length,
      no_engineering_data:extracted === "NO_ENGINEERING_DATA"
    }), {
      headers:{...corsHeaders,"Content-Type":"application/json"}
    });

  } catch (err) {
    const message = String(err?.message || err);
    console.error("vision-index-pdf-page error", message.slice(0,1000));
    return new Response(JSON.stringify({error:message}), {
      status:500,
      headers:{...corsHeaders,"Content-Type":"application/json"}
    });
  }
});
