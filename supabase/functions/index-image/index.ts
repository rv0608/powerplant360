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
      if ((c?.type === "output_text" || c?.type === "text") && typeof c?.text === "string") return c.text;
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

function toBase64(bytes:Uint8Array) {
  let binary = "";
  const step = 0x8000;
  for (let i=0; i<bytes.length; i+=step) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i+step, bytes.length)));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers:corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status:405, headers:corsHeaders });
  }

  let supabaseAdmin:any = null;
  let documentId = "";

  try {
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({error:"Unauthorized"}), {
        status:401, headers:{...corsHeaders,"Content-Type":"application/json"}
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const model = Deno.env.get("OPENAI_MODEL") || "gpt-5.6-luna";

    if (!openaiKey) {
      return new Response(JSON.stringify({error:"AI_NOT_CONFIGURED"}), {
        status:503, headers:{...corsHeaders,"Content-Type":"application/json"}
      });
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global:{headers:{Authorization:auth}}
    });

    const {data:userData,error:userError} = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({error:"Unauthorized"}), {
        status:401, headers:{...corsHeaders,"Content-Type":"application/json"}
      });
    }

    let adminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    try {
      const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
      adminKey = keys?.default || adminKey;
    } catch (_) {}
    if (!adminKey) throw new Error("Supabase server key is unavailable.");

    supabaseAdmin = createClient(supabaseUrl, adminKey);

    const {data:roleRow} = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (String(roleRow?.role || "") !== "admin") {
      return new Response(JSON.stringify({error:"Admin permission required for image indexing."}), {
        status:403, headers:{...corsHeaders,"Content-Type":"application/json"}
      });
    }

    const body = await req.json().catch(() => ({}));
    documentId = String(body?.document_id || "").trim();
    if (!documentId) {
      return new Response(JSON.stringify({error:"document_id is required"}), {
        status:400, headers:{...corsHeaders,"Content-Type":"application/json"}
      });
    }

    const {data:doc,error:docError} = await supabaseAdmin
      .from("documents")
      .select("id,file_name,storage_path,category,mime_type,metadata")
      .eq("id", documentId)
      .single();

    if (docError || !doc) throw new Error("Image document was not found.");

    const fileName = String(doc.file_name || "");
    const mime = String(doc.mime_type || "").toLowerCase();
    const allowed = /^image\/(png|jpeg|webp|gif)$/.test(mime) || /\.(png|jpe?g|webp|gif)$/i.test(fileName);
    if (!allowed) throw new Error("This document is not a supported image file.");

    await supabaseAdmin
      .from("documents")
      .update({processing_status:"processing",updated_at:new Date().toISOString()})
      .eq("id",documentId);

    const {data:blob,error:downloadError} = await supabaseAdmin.storage
      .from("plant-documents")
      .download(doc.storage_path);
    if (downloadError || !blob) throw new Error("Could not download the stored image.");

    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (!bytes.length) throw new Error("Stored image is empty.");
    if (bytes.length > 20 * 1024 * 1024) throw new Error("Image is larger than 20 MB. Resize it before indexing.");

    const actualMime = mime || (fileName.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
    const dataUrl = `data:${actualMime};base64,${toBase64(bytes)}`;

    const instructions = `
You are indexing a private thermal-power-plant engineering image for exact later retrieval.
Transcribe ONLY information visibly supported by the image. Do not infer or correct missing values.

Output plain text only, optimized for search:
- Preserve equipment names, tag numbers, model numbers, units, symbols, and numeric values exactly.
- For a table, output each data row on its own line and repeat the column meaning in key:value form.
- Example row style: "BC-3 | Belt Width: 800 | Rating: 800/3 | 1st Stream Length: 406 m | 2nd Stream Length: 408 m | Total As Per Conveyor: 814 m | Total As Per Belt Spec: 814 m"
- For specification blocks, output one "Parameter: Value" item per line.
- Include visible headings that help identify the equipment/table.
- Ignore logos, decorative text, page furniture, and blank cells unless they carry engineering meaning.
- Never add general engineering knowledge.
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
            {type:"input_text",text:`Category: ${doc.category || "General"}\nFile: ${fileName}\nExtract all searchable engineering data from this image.`},
            {type:"input_image",image_url:dataUrl,detail:"high"}
          ]
        }]
      })
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("Image indexing OpenAI request failed", aiRes.status, t.slice(0,800));
      throw new Error(`Image indexing failed (${aiRes.status}): ${t.slice(0,400)}`);
    }

    const ai = await aiRes.json();
    const extracted = extractResponseText(ai)
      .replace(/^```(?:text)?\s*/i,"")
      .replace(/```$/,"")
      .trim();

    if (!extracted) throw new Error("No searchable engineering text was extracted from the image.");

    const indexedText = `[[PAGE 1]]\n${extracted}`;

    const {error:updateError} = await supabaseAdmin
      .from("documents")
      .update({
        extracted_text:indexedText,
        page_count:1,
        processing_status:"ready",
        updated_at:new Date().toISOString(),
        metadata:{
          ...(doc.metadata || {}),
          image_indexed:true,
          image_indexed_at:new Date().toISOString()
        }
      })
      .eq("id",documentId);
    if (updateError) throw updateError;

    const usage = usageFromResponse(ai);
    const {error:usageError} = await supabaseAdmin.from("api_usage").insert({
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
    if (usageError) console.error("Image index usage tracking failed", usageError.message);

    return new Response(JSON.stringify({
      ok:true,
      document_id:documentId,
      characters:extracted.length
    }), {
      headers:{...corsHeaders,"Content-Type":"application/json"}
    });

  } catch (err) {
    const message = String(err?.message || err);
    console.error("index-image error", message.slice(0,1000));

    if (supabaseAdmin && documentId) {
      try {
        await supabaseAdmin
          .from("documents")
          .update({processing_status:"error",updated_at:new Date().toISOString()})
          .eq("id",documentId);
      } catch (_) {}
    }

    return new Response(JSON.stringify({error:message}), {
      status:500,
      headers:{...corsHeaders,"Content-Type":"application/json"}
    });
  }
});
