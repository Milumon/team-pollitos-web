import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAuthorized } from '@/lib/adminAuth';
import { logAdminAction } from '@/lib/auditLogger';

// GET: Obtener un sonido por ID (autenticado, sin restricción de privacidad)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const token = authHeader.substring('Bearer '.length);
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Falta el parámetro id' }, { status: 400 });
    }

    const { data: sound, error } = await supabaseAdmin
      .from('soundboard_sounds')
      .select('id, name, url, is_public, owner_user_id')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!sound) {
      return NextResponse.json({ error: 'Sonido no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ sound });
  } catch (error) {
    console.error('[Sounds GET by ID Error]:', error);
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE: Eliminar un sonido (solo administradores)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const authHeader = request.headers.get('Authorization');
    let adminEmail = 'admin-token@system';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring('Bearer '.length);
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (user?.email) adminEmail = user.email;
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Falta el parámetro id' }, { status: 400 });
    }

    // 1. Obtener la información del sonido para saber el file_path y el name
    const { data: sound, error: fetchError } = await supabaseAdmin
      .from('soundboard_sounds')
      .select('name, file_path')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!sound) {
      return NextResponse.json({ error: 'Sonido no encontrado' }, { status: 404 });
    }

    // 2. Eliminar el archivo físico de Supabase Storage
    const { error: storageError } = await supabaseAdmin.storage
      .from('soundboard-files')
      .remove([sound.file_path]);

    if (storageError) {
      console.warn('[Storage Delete Warning]:', storageError.message);
      // Continuamos incluso si falla el storage, para no dejar huérfana la base de datos
    }

    // 3. Eliminar la fila de la base de datos
    const { error: dbError } = await supabaseAdmin
      .from('soundboard_sounds')
      .delete()
      .eq('id', id);

    if (dbError) throw dbError;

    // 4. Registrar log de auditoría
    await logAdminAction(adminEmail, 'Sonido eliminado', {
      sound_id: id,
      name: sound.name,
      file_path: sound.file_path,
    });

    return NextResponse.json({ success: true, message: 'Sonido eliminado correctamente' });
  } catch (error) {
    console.error('[Sounds DELETE Error]:', error);
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido al eliminar el sonido';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

// PATCH: Actualizar nombre o cooldown de un sonido
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const authHeader = request.headers.get('Authorization');
    let adminEmail = 'admin-token@system';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring('Bearer '.length);
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (user?.email) adminEmail = user.email;
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Falta el parámetro id' }, { status: 400 });
    }

    const contentType = request.headers.get('content-type') || '';
    let name: unknown;
    let cooldownSeconds: unknown;
    let isPublic: unknown;
    let trimStart: unknown;
    let trimEnd: unknown;
    let file: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      name = formData.get('name');
      cooldownSeconds = formData.get('cooldownSeconds');
      isPublic = formData.get('isPublic');
      trimStart = formData.get('trimStart');
      trimEnd = formData.get('trimEnd');
      const uploadedFile = formData.get('file');
      file = uploadedFile instanceof File ? uploadedFile : null;
    } else {
      const body = await request.json();
      name = body.name;
      cooldownSeconds = body.cooldownSeconds;
      isPublic = body.isPublic;
      trimStart = body.trimStart;
      trimEnd = body.trimEnd;
    }

    const updates: Record<string, string | number | boolean | null> = {};
    if (name !== undefined && name !== null) {
      const normalizedName = String(name).trim();
      if (normalizedName) updates.name = normalizedName;
    }
    if (cooldownSeconds !== undefined && cooldownSeconds !== null) {
      updates.cooldown_seconds = cooldownSeconds === null ? 0 : Math.max(0, parseInt(String(cooldownSeconds)) || 0);
    }
    if (isPublic !== undefined && isPublic !== null) {
      updates.is_public = isPublic === true || isPublic === 'true';
    }
    if (trimStart !== undefined && trimStart !== null) {
      updates.trim_start = parseFloat(String(trimStart));
    }
    if (trimEnd !== undefined && trimEnd !== null) {
      updates.trim_end = parseFloat(String(trimEnd));
    }

    if (file) {
      const { data: currentSound, error: fetchError } = await supabaseAdmin
        .from('soundboard_sounds')
        .select('file_path')
        .eq('id', id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!currentSound?.file_path) {
        return NextResponse.json({ error: 'No se pudo localizar el archivo existente' }, { status: 404 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabaseAdmin.storage
        .from('soundboard-files')
        .upload(currentSound.file_path, buffer, {
          contentType: file.type || 'audio/mpeg',
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabaseAdmin.storage
        .from('soundboard-files')
        .getPublicUrl(currentSound.file_path);

      updates.url = publicUrl;
      updates.updated_at = new Date().toISOString();
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No se enviaron campos para actualizar' }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const { data: updatedSound, error: dbError } = await supabaseAdmin
      .from('soundboard_sounds')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (dbError) throw dbError;

    // Registrar log de auditoría
    await logAdminAction(adminEmail, 'Sonido actualizado', {
      sound_id: id,
      updates,
    });

    return NextResponse.json({ success: true, sound: updatedSound });
  } catch (error) {
    console.error('[Sounds PATCH Error]:', error);
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido al actualizar el sonido';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
