import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body:any,status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers:{...corsHeaders,"Content-Type":"application/json"}
  });
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST") return json({error:"Method not allowed"},405);

  try{
    const auth=req.headers.get("Authorization")||"";
    if(!auth.startsWith("Bearer ")) return json({error:"Unauthorized"},401);

    const supabaseUrl=Deno.env.get("SUPABASE_URL")!;
    const anonKey=Deno.env.get("SUPABASE_ANON_KEY")!;

    let adminKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
    try{
      const keys=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
      adminKey=keys?.default||adminKey;
    }catch(_){}
    if(!adminKey) throw new Error("Supabase server key is unavailable.");

    const userClient=createClient(supabaseUrl,anonKey,{
      global:{headers:{Authorization:auth}}
    });
    const admin=createClient(supabaseUrl,adminKey);

    const {data:userData,error:userError}=await userClient.auth.getUser();
    if(userError||!userData?.user) return json({error:"Unauthorized"},401);

    const callerId=userData.user.id;
    const {data:callerRole,error:roleError}=await admin
      .from("user_roles")
      .select("role")
      .eq("user_id",callerId)
      .maybeSingle();

    if(roleError) throw roleError;
    if(String(callerRole?.role||"")!=="admin"){
      return json({error:"Admin permission required."},403);
    }

    const body=await req.json().catch(()=>({}));
    const action=String(body?.action||"list").trim();

    if(action==="list"){
      const {data:listData,error:listError}=await admin.auth.admin.listUsers({
        page:1,
        perPage:1000
      });
      if(listError) throw listError;

      const users=listData?.users||[];
      const ids=users.map((u:any)=>u.id);
      let roleRows:any[]=[];

      if(ids.length){
        const {data,error}=await admin
          .from("user_roles")
          .select("user_id,role")
          .in("user_id",ids);
        if(error) throw error;
        roleRows=data||[];
      }

      const roleMap=new Map(roleRows.map((r:any)=>[r.user_id,r.role]));
      const result=users.map((u:any)=>({
        id:u.id,
        email:u.email||"",
        role:roleMap.get(u.id)||"viewer",
        created_at:u.created_at||null,
        last_sign_in_at:u.last_sign_in_at||null,
        email_confirmed_at:u.email_confirmed_at||null,
        is_current:u.id===callerId
      }));

      return json({users:result});
    }

    if(action==="create"){
      const email=String(body?.email||"").trim().toLowerCase();
      const password=String(body?.password||"");
      const role=String(body?.role||"viewer").trim().toLowerCase();

      if(!email||!email.includes("@")) return json({error:"Enter a valid email address."},400);
      if(password.length<8) return json({error:"Temporary password must be at least 8 characters."},400);
      if(!["engineer","viewer"].includes(role)) return json({error:"Role must be Engineer or Viewer."},400);

      const {data:createData,error:createError}=await admin.auth.admin.createUser({
        email,
        password,
        email_confirm:true,
        user_metadata:{created_via:"PowerPlant360 Admin"}
      });
      if(createError) return json({error:createError.message},400);

      const newUser=createData?.user;
      if(!newUser?.id) throw new Error("User account was not created.");

      const {error:insertRoleError}=await admin
        .from("user_roles")
        .upsert({user_id:newUser.id,role},{onConflict:"user_id"});

      if(insertRoleError){
        await admin.auth.admin.deleteUser(newUser.id).catch(()=>{});
        throw insertRoleError;
      }

      return json({
        ok:true,
        user:{
          id:newUser.id,
          email:newUser.email||email,
          role,
          created_at:newUser.created_at||null,
          last_sign_in_at:newUser.last_sign_in_at||null,
          email_confirmed_at:newUser.email_confirmed_at||null,
          is_current:false
        }
      });
    }

    if(action==="update_role"){
      const userId=String(body?.user_id||"").trim();
      const role=String(body?.role||"").trim().toLowerCase();

      if(!userId) return json({error:"User ID is required."},400);
      if(!["engineer","viewer"].includes(role)) return json({error:"Role must be Engineer or Viewer."},400);
      if(userId===callerId) return json({error:"Your Admin role cannot be changed here."},400);

      const {data:targetRole,error:targetRoleError}=await admin
        .from("user_roles")
        .select("role")
        .eq("user_id",userId)
        .maybeSingle();
      if(targetRoleError) throw targetRoleError;
      if(String(targetRole?.role||"")==="admin"){
        return json({error:"Admin accounts are protected from role changes."},400);
      }

      const {error:updateError}=await admin
        .from("user_roles")
        .upsert({user_id:userId,role},{onConflict:"user_id"});
      if(updateError) throw updateError;

      return json({ok:true});
    }

    if(action==="delete"){
      const userId=String(body?.user_id||"").trim();
      if(!userId) return json({error:"User ID is required."},400);
      if(userId===callerId) return json({error:"You cannot delete your own Admin account."},400);

      const {data:targetRole,error:targetRoleError}=await admin
        .from("user_roles")
        .select("role")
        .eq("user_id",userId)
        .maybeSingle();
      if(targetRoleError) throw targetRoleError;
      if(String(targetRole?.role||"")==="admin"){
        return json({error:"Admin accounts are protected from deletion."},400);
      }

      const {error:deleteError}=await admin.auth.admin.deleteUser(userId);
      if(deleteError) throw deleteError;

      return json({ok:true});
    }

    return json({error:"Unsupported action."},400);
  }catch(err){
    const message=String(err?.message||err);
    console.error("manage-users error",message.slice(0,1000));
    return json({error:message},500);
  }
});
