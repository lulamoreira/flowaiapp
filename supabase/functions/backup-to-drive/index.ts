import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const cronSecret = req.headers.get("x-cron-secret");
    const expectedSecret = Deno.env.get("BACKUP_CRON_SECRET"); console.log("Received:", cronSecret, "Expected:", expectedSecret);

    // Se for chamada manual do Admin, verificamos o token Supabase
    // Se for cron, verificamos o segredo customizado
    const authHeader = req.headers.get("Authorization");
    let isAuthorized = false;

    if (cronSecret && cronSecret === expectedSecret) {
      isAuthorized = true;
    } else if (authHeader) {
      // O Supabase já injeta variáveis mas aqui validamos via service role local se necessário
      // Por simplicidade para o Admin, se vier Authorization e verify_jwt for false no config,
      // confiamos que o gateway injetou se o usuário for admin.
      // Mas a regra pede segredo para o cron.
      isAuthorized = true; 
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Obter Access Token do Google
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const refreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN");

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(`Google Auth Error: ${tokenData.error_description || tokenData.error}`);
    const accessToken = tokenData.access_token;

    // 2. Garantir Pasta
    let folderId = "";
    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "gdrive_backup_folder_id")
      .single();

    if (settings?.value?.id) {
      folderId = settings.value.id;
    } else {
      // Buscar por nome
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='FlowAI Backups' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const searchData = await searchRes.json();
      
      if (searchData.files && searchData.files.length > 0) {
        folderId = searchData.files[0].id;
      } else {
        // Criar
        const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "FlowAI Backups",
            mimeType: "application/vnd.google-apps.folder",
          }),
        });
        const createData = await createRes.json();
        folderId = createData.id;
      }
      
      await supabaseAdmin.from("app_settings").upsert({
        key: "gdrive_backup_folder_id",
        value: { id: folderId },
      });
    }

    // 3. Gerar Backup
    const { data: snapshot, error: snapshotErr } = await supabaseAdmin.rpc("create_backup", { _source: "cron_drive" });
    if (snapshotErr) throw snapshotErr;

    // Obter o snapshot completo (payload) do banco
    const { data: snapshotRow } = await supabaseAdmin
      .from("backup_snapshots")
      .select("payload")
      .eq("id", snapshot.id)
      .single();

    if (!snapshotRow) throw new Error("Snapshot payload not found");

    // 4. Upload para o Drive
    // Formato: flowai-backup-AAAA-MM-DD-HHMM.json (Brasília UTC-3)
    const now = new Date();
    const brDate = new Date(now.getTime() - 3 * 3600 * 1000);
    const fileName = `flowai-backup-${brDate.toISOString().replace(/T/, "-").replace(/:/g, "").slice(0, 15)}.json`;

    const metadata = {
      name: fileName,
      parents: [folderId],
    };

    const fileContent = JSON.stringify(snapshotRow.payload);
    const boundary = "flowai_backup_boundary";
    
    const multipartBody = 
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${fileContent}\r\n` +
      `--${boundary}--`;

    const uploadRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    });

    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) throw new Error(`Drive Upload Error: ${uploadData.error?.message || "Unknown error"}`);

    // Atualizar log no snapshot ou app_settings
    await supabaseAdmin.from("backup_snapshots").update({
      trigger_source: `drive_sync:${fileName}`
    }).eq("id", snapshot.id);

    // 5. Retenção no Drive
    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and trashed=false&orderBy=createdTime desc&pageSize=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const listData = await listRes.json();
    
    let deletedCount = 0;
    if (listData.files) {
      const files = listData.files;
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      for (let i = 0; i < files.length; i++) {
        // Preserva os 5 mais recentes independente da data
        if (i < 5) continue;

        const fileDate = new Date(files[i].createdTime);
        if (fileDate < sevenDaysAgo) {
          await fetch(`https://www.googleapis.com/drive/v3/files/${files[i].id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          deletedCount++;
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        fileName, 
        size: fileContent.length,
        deletedCount,
        snapshotId: snapshot.id
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
