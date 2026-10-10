import JSZip from "https://esm.sh/jszip@3.10.1";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function decodeXml(s:string) {
  return String(s || "")
    .replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&")
    .replace(/&quot;/g,'"').replace(/&apos;/g,"'");
}

function docxText(xml:string) {
  return decodeXml(String(xml || "")
    .replace(/<w:tab\/?\s*>/g,"\t")
    .replace(/<w:br\/?\s*>/g,"\n")
    .replace(/<\/w:p>/g,"\n")
    .replace(/<\/w:tr>/g,"\n")
    .replace(/<\/w:tc>/g," | ")
    .replace(/<[^>]+>/g,"")
    .replace(/[ \t]+\n/g,"\n")
    .replace(/\n{3,}/g,"\n\n")
    .replace(/[ \t]{2,}/g," ")
    .trim());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", {headers:corsHeaders});
  if (req.method !== "POST") return new Response("Method not allowed",{status:405,headers:corsHeaders});

  let admin:any = null;
  let documentId = "";
  try {
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:{...corsHeaders,"Content-Type":"application/json"}});
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {global:{headers:{Authorization:auth}}});
    const {data:userData,error:userError} = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:{...corsHeaders,"Content-Type":"application/json"}});
    }

    let adminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    try {
      const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
      adminKey = keys?.default || adminKey;
    } catch (_) {}
    if (!adminKey) throw new Error("Supabase server key is unavailable.");
    admin = createClient(supabaseUrl, adminKey);

    const {data:roleRow} = await admin.from("user_roles").select("role").eq("user_id",userData.user.id).maybeSingle();
    if (String(roleRow?.role || "") !== "admin") {
      return new Response(JSON.stringify({error:"Admin permission required for Office indexing."}),{status:403,headers:{...corsHeaders,"Content-Type":"application/json"}});
    }

    const body = await req.json().catch(()=>({}));
    documentId = String(body?.document_id || "").trim();
    if (!documentId) throw new Error("document_id is required.");

    const {data:doc,error:docError} = await admin.from("documents")
      .select("id,file_name,storage_path,category,mime_type,metadata").eq("id",documentId).single();
    if (docError || !doc) throw new Error("Document was not found.");

    const name = String(doc.file_name || "");
    const ext = (name.split(".").pop() || "").toLowerCase();
    const supported = ["docx","xlsx","xls","csv","txt"].includes(ext);
    if (!supported) throw new Error("Supported Office types are DOCX, XLS, XLSX, CSV and TXT.");

    await admin.from("documents").update({processing_status:"processing",updated_at:new Date().toISOString()}).eq("id",documentId);

    const {data:blob,error:downloadError} = await admin.storage.from("plant-documents").download(doc.storage_path);
    if (downloadError || !blob) throw new Error("Could not download the stored file.");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (!bytes.length) throw new Error("Stored file is empty.");

    let extracted = "";
    if (ext === "txt" || ext === "csv") {
      extracted = new TextDecoder().decode(bytes);
    } else if (ext === "docx") {
      const zip = await JSZip.loadAsync(bytes);
      const parts:string[] = [];
      const names = Object.keys(zip.files).filter(n =>
        n === "word/document.xml" ||
        /^word\/header\d*\.xml$/i.test(n) ||
        /^word\/footer\d*\.xml$/i.test(n) ||
        n === "word/footnotes.xml"
      );
      for (const n of names) {
        const xml = await zip.file(n)?.async("string");
        if (xml) {
          const t = docxText(xml);
          if (t) parts.push(t);
        }
      }
      extracted = parts.join("\n\n");
    } else {
      const wb = XLSX.read(bytes,{type:"array",cellDates:true});
      const parts:string[] = [];
      for (const sheetName of wb.SheetNames) {
        const sheet = wb.Sheets[sheetName];
        if (!sheet) continue;
        const csv = XLSX.utils.sheet_to_csv(sheet,{blankrows:false});
        if (csv.trim()) parts.push(`[[SHEET ${sheetName}]]\n${csv.trim()}`);
      }
      extracted = parts.join("\n\n");
    }

    extracted = String(extracted || "")
      .replace(/\u0000/g," ")
      .replace(/[ \t]+\n/g,"\n")
      .replace(/\n{4,}/g,"\n\n\n")
      .trim();
    if (!extracted) throw new Error("No searchable text could be extracted from this file.");

    const indexedText = `[[PAGE 1]]\n${extracted}`;
    const {error:updateError} = await admin.from("documents").update({
      extracted_text:indexedText,
      page_count:1,
      processing_status:"ready",
      updated_at:new Date().toISOString(),
      metadata:{...(doc.metadata || {}),office_indexed:true,office_indexed_at:new Date().toISOString()}
    }).eq("id",documentId);
    if (updateError) throw updateError;

    return new Response(JSON.stringify({ok:true,document_id:documentId,characters:extracted.length}),{
      headers:{...corsHeaders,"Content-Type":"application/json"}
    });
  } catch (err) {
    const message = String(err?.message || err);
    console.error("index-office error",message.slice(0,1000));
    if (admin && documentId) {
      try { await admin.from("documents").update({processing_status:"error",updated_at:new Date().toISOString()}).eq("id",documentId); } catch (_) {}
    }
    return new Response(JSON.stringify({error:message}),{status:500,headers:{...corsHeaders,"Content-Type":"application/json"}});
  }
});