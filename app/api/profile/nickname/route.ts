import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { isValidMemberDisplayName } from '@/lib/memberDisplayName';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

let cachedBotId: number | null = null;
const ROBLOX_NOT_FRIEND_MESSAGE = 'No tienes agregado a MilumonRT como amigo en Roblox. Agrégalo y vuelve a intentarlo.';

async function getBotUserId(cookie: string): Promise<number | null> {
  if (cachedBotId) return cachedBotId;
  try {
    const res = await fetch('https://users.roblox.com/v1/users/authenticated', {
      headers: {
        'Cookie': `.ROBLOSECURITY=${cookie}`,
      },
    });
    if (res.ok) {
      const data = await res.json();
      cachedBotId = Number(data.id);
      return cachedBotId;
    }
  } catch (err) {
    console.error('Error fetching bot authenticated user:', err);
  }
  return null;
}

// Auxiliar para obtener el token CSRF de Roblox
async function getRobloxCsrfToken(cookie: string): Promise<string | null> {
  try {
    const res = await fetch('https://auth.roblox.com/v2/logout', {
      method: 'POST',
      headers: {
        'Cookie': `.ROBLOSECURITY=${cookie}`,
      },
    });
    return res.headers.get('x-csrf-token');
  } catch (err) {
    console.error('Error al obtener CSRF token de Roblox:', err);
    return null;
  }
}

// Auxiliar para llamar a la API de etiquetas de Roblox
async function setRobloxContactTag(
  targetUserId: number,
  userTag: string,
  cookie: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const makeRequest = (token?: string) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Cookie': `.ROBLOSECURITY=${cookie}`,
      };
      if (token) {
        headers['x-csrf-token'] = token;
      }
      return fetch('https://contacts.roblox.com/v1/user/tag', {
        method: 'POST',
        headers,
        body: JSON.stringify({ targetUserId, userTag }),
      });
    };

    let response = await makeRequest();

    if (response.status === 403) {
      const token = response.headers.get('x-csrf-token');
      if (token) {
        console.log('CSRF token obtenido del error 403:', token);
        response = await makeRequest(token);
      } else {
        const fallbackToken = await getRobloxCsrfToken(cookie);
        if (fallbackToken) {
          response = await makeRequest(fallbackToken);
        }
      }
    }

    if (response.status === 429) {
      return { success: false, error: 'Roblox está saturado (Rate Limit 429). Intenta de nuevo en unos minutos.' };
    }

    if (!response.ok) {
      const text = await response.text();
      console.error(`Roblox API Error (${response.status}):`, text);
      if (response.status === 403 && text.includes('"code":3') && text.toLowerCase().includes('not a friend')) {
        return { success: false, error: ROBLOX_NOT_FRIEND_MESSAGE };
      }
      return { success: false, error: `Error de Roblox (${response.status}): ${text || 'desconocido'}` };
    }

    return { success: true };
  } catch (err) {
    console.error('Error en setRobloxContactTag:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Error de red con la API de Roblox.' };
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Validar autenticación
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Sesión no válida o expirada.' }, { status: 401 });
    }

    const token = authHeader.substring('Bearer '.length);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Sesión no válida o expirada.' }, { status: 401 });
    }

    // 2. Obtener perfil actual del usuario
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'No se encontró tu perfil de usuario.' }, { status: 404 });
    }

    // 3. Validar membresía aprobada
    if (profile.link_status !== 'approved') {
      return NextResponse.json({ error: 'Debés ser miembro oficial aprobado para cambiar tu nickname.' }, { status: 403 });
    }

    if (profile.perm_edit_nickname === false) {
      return NextResponse.json({ error: 'No tenés permiso para cambiar tu apodo.' }, { status: 403 });
    }

    if (!profile.roblox_user_id) {
      return NextResponse.json({ error: 'Tu perfil no está vinculado a una cuenta de Roblox válida.' }, { status: 400 });
    }

    // 4. Validar cuerpo de la petición
    const body = await request.json();
    const nicknameInput = String(body.nickname || '').trim();

    if (!nicknameInput) {
      return NextResponse.json({ error: 'El nombre no puede estar vacío.' }, { status: 400 });
    }

    if (!isValidMemberDisplayName(nicknameInput)) {
      return NextResponse.json(
        { error: 'El nickname debe tener entre 3 y 15 caracteres y solo puede contener letras, números, espacios y un guion bajo en posición intermedia.' },
        { status: 400 }
      );
    }

    // 5. Validar cooldown de 24 horas
    if (profile.last_nickname_updated_at) {
      const lastUpdate = new Date(profile.last_nickname_updated_at).getTime();
      const diffMs = Date.now() - lastUpdate;
      const cooldownMs = 24 * 60 * 60 * 1000; // 24 horas en milisegundos

      if (diffMs < cooldownMs) {
        const remainingMs = cooldownMs - diffMs;
        const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
        const remainingMinutes = Math.ceil((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

        let timeMsg = '';
        if (remainingHours > 0) {
          timeMsg = `${remainingHours} ${remainingHours === 1 ? 'hora' : 'horas'} y ${remainingMinutes} ${remainingMinutes === 1 ? 'minuto' : 'minutos'}`;
        } else {
          timeMsg = `${remainingMinutes} ${remainingMinutes === 1 ? 'minuto' : 'minutos'}`;
        }

        return NextResponse.json(
          { error: `Estás en cooldown. Podrás volver a cambiar tu nickname en ${timeMsg}.` },
          { status: 429 }
        );
      }
    }

    // 6. Configurar el tag final
    const finalTag = `🐣 ${nicknameInput} 🐣`;

    // 7. Sincronizar con la API de Roblox usando la cookie configurada en el servidor
    const robloxCookie = process.env.ROBLOSECURITY_COOKIE;
    if (!robloxCookie) {
      console.error('Falta la variable de entorno ROBLOSECURITY_COOKIE en el servidor.');
      return NextResponse.json(
        { error: 'El servidor no tiene configurada la cookie del bot de Roblox. Contactá a un administrador.' },
        { status: 500 }
      );
    }

    // Sanitizar cookie de advertencias típicas de Roblox si fuese necesario
    const cleanCookie = robloxCookie.trim();

    // Validar que el usuario no sea el propio bot de Roblox (el streamer)
    const botId = await getBotUserId(cleanCookie);
    if (botId && Number(profile.roblox_user_id) === botId) {
      return NextResponse.json(
        { error: 'El dueño del bot (streamer) no puede configurar su propio tag de contacto en Roblox.' },
        { status: 403 }
      );
    }

    const robloxResult = await setRobloxContactTag(Number(profile.roblox_user_id), finalTag, cleanCookie);

    if (!robloxResult.success) {
      const errorMessage = robloxResult.error === ROBLOX_NOT_FRIEND_MESSAGE
        ? robloxResult.error
        : `No se pudo actualizar tu tag en Roblox. Detalle: ${robloxResult.error || 'error desconocido.'}`;
      return NextResponse.json(
        { error: errorMessage },
        { status: 502 }
      );
    }

    // 8. Actualizar perfil en Supabase únicamente si la llamada a Roblox fue exitosa
    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        roblox_display_name: finalTag,
        last_nickname_updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error al actualizar perfil en Supabase tras etiquetar en Roblox:', updateError.message);
      return NextResponse.json(
        { error: `Se actualizó el tag en Roblox, pero falló el registro local en la base de datos: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Nickname POST failed:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
