import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAuthorized } from '@/lib/adminAuth';
import { logAdminAction } from '@/lib/auditLogger';
import { isOverlayAuthorized } from '@/lib/overlayAuth';

// GET: Listar todos los sonidos del soundboard (público / filtrado por privacidad)
export async function GET(request: NextRequest) {
  try {
    if (isOverlayAuthorized(request)) {
      const { data: sounds, error } = await supabaseAdmin
        .from('soundboard_sounds')
        .select('id,name,url')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return NextResponse.json({ sounds: sounds ?? [] });
    }

    const isAdminUser = await isAuthorized(request);
    
    let query = supabaseAdmin
      .from('soundboard_sounds')
      .select('*');

    if (!isAdminUser) {
      // Return public sounds + user's own sounds (even if private)
      const authHeader = request.headers.get('Authorization');
      let userId = '';
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring('Bearer '.length);
        const { data: { user } } = await supabaseAdmin.auth.getUser(token);
        if (user?.id) userId = user.id;
      }
      if (userId) {
        query = query.or(`is_public.eq.true,owner_user_id.eq.${userId}`);
      } else {
        query = query.eq('is_public', true);
      }
    }

    const { data: sounds, error } = await query.order('created_at', { ascending: true });

    if (error) throw error;

    // Enrich with owner profiles
    const ownerIds = [...new Set((sounds || []).map((s: { owner_user_id: string | null }) => s.owner_user_id).filter(Boolean))] as string[];
    const ownerMap: Record<string, { roblox_user: string | null; roblox_display_name: string | null; roblox_avatar_url: string | null }> = {};
    if (ownerIds.length > 0) {
      const { data: owners } = await supabaseAdmin
        .from('profiles')
        .select('id, roblox_user, roblox_display_name, roblox_avatar_url')
        .in('id', ownerIds);
      if (owners) {
        owners.forEach((o: { id: string; roblox_user: string | null; roblox_display_name: string | null; roblox_avatar_url: string | null }) => {
          ownerMap[o.id] = o;
        });
      }
    }

    const enriched = (sounds || []).map((s: Record<string, unknown>) => ({
      ...s,
      profiles: s.owner_user_id ? ownerMap[s.owner_user_id as string] ?? null : null,
    }));

    return NextResponse.json({ sounds: enriched });
  } catch (error) {
    console.error('[Sounds GET Error]:', error);
    return NextResponse.json({ error: 'Error al obtener los sonidos del soundboard' }, { status: 500 });
  }
}

// POST: Crear/Subir un nuevo sonido (solo administradores)
export async function POST(request: NextRequest) {
  if (!await isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const authHeader = request.headers.get('Authorization');
    let adminEmail = 'admin-token@system';
    let adminUserId = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring('Bearer '.length);
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (user?.email) adminEmail = user.email;
      if (user?.id) adminUserId = user.id;
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const name = formData.get('name') as string | null;
    const idInput = formData.get('id') as string | null;
    const cooldownSecondsInput = formData.get('cooldownSeconds');
    const cooldownSeconds = cooldownSecondsInput ? Math.max(0, parseInt(String(cooldownSecondsInput)) || 0) : 0;

    if (!file || !name || !name.trim() || !idInput || !idInput.trim()) {
      return NextResponse.json({ error: 'Faltan parámetros obligatorios (file, name, id)' }, { status: 400 });
    }

    // Sanitizar ID para que actúe como un slug seguro
    const id = idInput
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (!id) {
      return NextResponse.json({ error: 'El ID proporcionado no contiene caracteres válidos' }, { status: 400 });
    }

    // Validar tipo de archivo (MIME)
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/mp4', 'audio/webm', 'audio/x-m4a', 'audio/ogg'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: `Formato de audio no soportado (${file.type}). Usar MP3, WAV, M4A, OGG o WebM.` 
      }, { status: 400 });
    }

    // Validar tamaño de archivo (máximo 2 MB)
    const maxSizeBytes = 2 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return NextResponse.json({ error: 'El archivo es demasiado pesado (máximo 2 MB)' }, { status: 400 });
    }

    // Verificar si ya existe un sonido con ese mismo ID
    const { data: existingSound, error: checkError } = await supabaseAdmin
      .from('soundboard_sounds')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (checkError) throw checkError;
    if (existingSound) {
      return NextResponse.json({ error: `Ya existe un sonido registrado con el ID "${id}"` }, { status: 409 });
    }

    // Subir el archivo físico a Supabase Storage
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const fileExtension = file.name.split('.').pop() || 'mp3';
    const storagePath = `sounds/${id}-${Date.now()}.${fileExtension}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('soundboard-files')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('[Storage Upload Error]:', uploadError);
      return NextResponse.json({ error: `Error al subir archivo al Storage: ${uploadError.message}` }, { status: 500 });
    }

    // Obtener la URL pública del archivo
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('soundboard-files')
      .getPublicUrl(storagePath);

    // Guardar los datos en la tabla soundboard_sounds
    const { data: sound, error: dbError } = await supabaseAdmin
      .from('soundboard_sounds')
      .insert({
        id,
        name: name.trim(),
        file_path: storagePath,
        url: publicUrl,
        cooldown_seconds: cooldownSeconds,
        owner_user_id: adminUserId || null,
      })
      .select()
      .single();

    if (dbError) {
      // Rollback: intentar eliminar el archivo subido si falla la DB
      await supabaseAdmin.storage.from('soundboard-files').remove([storagePath]);
      throw dbError;
    }

    // Registrar log de auditoría
    await logAdminAction(adminEmail, 'Sonido subido', {
      sound_id: id,
      name: name.trim(),
      storage_path: storagePath,
    });

    return NextResponse.json({ success: true, sound });
  } catch (error) {
    console.error('[Sounds POST Error]:', error);
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido al subir el sonido';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
