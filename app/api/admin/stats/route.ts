import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { CATEGORY_FINALISTS } from '@/src/data/categories_phase2';
import { isAuthorized } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  if (!await isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const phaseParam = searchParams.get('phase');
    const phase = phaseParam ? Number(phaseParam) : Number(process.env.NEXT_PUBLIC_VOTING_PHASE || 1);

    // 1. Fetch categories
    const { data: catData, error: catError } = await supabaseAdmin
      .from('categories')
      .select('id, title, emoji, description')
      .order('id', { ascending: true });

    if (catError) throw new Error(catError.message);

    // 2. Fetch nominees
    const { data: nomData, error: nomError } = await supabaseAdmin
      .from('nominees')
      .select('id, nickname, profile_image_url, is_visible, roblox_user, roblox_user_id');

    if (nomError) throw new Error(nomError.message);

    // 3. Fetch votes filtered by phase
    const { data: votesData, error: votesError } = await supabaseAdmin
      .from('votes')
      .select('user_id, category_id, nominee_id')
      .eq('phase', phase);

    if (votesError) throw new Error(votesError.message);

    // 4. Fetch profiles (soundboard_disabled may not exist yet, handle gracefully)
    let profData: unknown[] = [];
    let profError: unknown = null;
    try {
      const result = await supabaseAdmin
        .from('profiles')
        .select('id, roblox_user, roblox_display_name, roblox_avatar_url, roblox_verified_at, tiktok_user, link_status, rejection_reason, is_admin, testimonial, testimonial_approved, minecraft_rank');
      profData = result.data || [];
      profError = result.error;
    } catch (e) {
      profError = e;
    }

    // Try adding soundboard_disabled if first query worked
    if (!profError) {
      try {
        const result2 = await supabaseAdmin
          .from('profiles')
          .select('id, soundboard_disabled');
        if (!result2.error && result2.data) {
          const sbMap = new Map(result2.data.map((r: { id: string; soundboard_disabled: boolean }) => [r.id, r.soundboard_disabled]));
          (profData as Record<string, unknown>[]).forEach((p: Record<string, unknown>) => {
            p.soundboard_disabled = sbMap.get(p.id as string) || false;
          });
        }
      } catch {}
    }

    // Fetch granular permissions
    if (!profError) {
      try {
        const permCols = 'id, perm_upload_images, perm_upload_videos, perm_upload_audio, perm_tts_text, perm_tts_record, perm_edit_nickname, perm_trigger_sounds, perm_trigger_media, perm_trigger_animations, perm_edit_sounds';
        const result3 = await supabaseAdmin.from('profiles').select(permCols);
        if (!result3.error && result3.data) {
          const permMap = new Map(result3.data.map((r: Record<string, unknown>) => [r.id, r]));
          (profData as Record<string, unknown>[]).forEach((p: Record<string, unknown>) => {
            const perms = permMap.get(p.id as string) as Record<string, unknown> | undefined;
            if (perms) {
              for (const col of ['perm_upload_images','perm_upload_videos','perm_upload_audio','perm_tts_text','perm_tts_record','perm_edit_nickname','perm_trigger_sounds','perm_trigger_media','perm_trigger_animations','perm_edit_sounds']) {
                p[col] = perms[col] ?? true;
              }
            }
          });
        }
      } catch {}
    }

    const hasProfilesTable = !profError;
    
    interface DbCategory {
      id: number;
      title: string;
      emoji: string;
      description: string;
    }

    interface DbNominee {
      id: string;
      nickname: string | null;
      profile_image_url: string | null;
      is_visible: boolean;
      roblox_user: string | null;
      roblox_user_id: number | string | null;
    }

    interface DbVote {
      user_id: string;
      category_id: number;
      nominee_id: string;
    }

    interface DbProfile {
      id: string;
      roblox_user: string | null;
      roblox_display_name: string | null;
      roblox_avatar_url: string | null;
      roblox_verified_at: string | null;
      tiktok_user: string | null;
      link_status: 'none' | 'pending' | 'approved' | 'rejected';
      rejection_reason: string | null;
      is_admin: boolean;
      soundboard_disabled: boolean;
      perm_upload_images: boolean;
      perm_upload_videos: boolean;
      perm_upload_audio: boolean;
      perm_tts_text: boolean;
      perm_tts_record: boolean;
      perm_edit_nickname: boolean;
      perm_trigger_sounds: boolean;
      perm_trigger_media: boolean;
      perm_trigger_animations: boolean;
      perm_edit_sounds: boolean;
      testimonial: string | null;
      testimonial_approved: boolean;
    }

    const categories = (catData || []) as DbCategory[];
    const nominees = (nomData || []) as DbNominee[];
    const votes = (votesData || []) as DbVote[];
    const profilesList = hasProfilesTable ? ((profData || []) as DbProfile[]) : [];

    // 5. Fetch auth users
    const { data: { users: authUsers }, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });
    if (authUsersError) throw new Error(authUsersError.message);

    // 6. Fetch interview history
    const { data: historyList } = await supabaseAdmin
      .from('interview_history')
      .select('user_id, already_interviewed');

    // --- PROCESS VOTE STATS ---
    const voteCounts: Record<number, Record<string, number>> = {};
    categories.forEach((cat: DbCategory) => {
      voteCounts[cat.id] = {};
    });

    votes?.forEach((vote: DbVote) => {
      const catId = Number(vote.category_id);
      const nomId = String(vote.nominee_id);
      if (voteCounts[catId]) {
        voteCounts[catId][nomId] = (voteCounts[catId][nomId] || 0) + 1;
      }
    });

    const categoryStats = categories.map((cat: DbCategory) => {
      const allowedNomineeIds = phase === 2 ? (CATEGORY_FINALISTS[cat.id] || []) : null;

      // Get vote counts for all nominees in this category
      const nomineesVotes = nominees
        .filter((nom: DbNominee) => !allowedNomineeIds || allowedNomineeIds.includes(nom.id))
        .map((nom: DbNominee) => {
          const count = voteCounts[cat.id]?.[nom.id] || 0;
          return {
            id: nom.id,
            nickname: nom.nickname || nom.roblox_user || 'Pollito',
            profile_image_url: nom.profile_image_url,
            roblox_user: nom.roblox_user,
            votes: count,
          };
        })
        .sort((a, b) => b.votes - a.votes);

      const totalCategoryVotes = nomineesVotes.reduce((sum: number, n) => sum + n.votes, 0);

      return {
        id: cat.id,
        title: cat.title,
        emoji: cat.emoji,
        totalVotes: totalCategoryVotes,
        nominees: nomineesVotes,
      };
    });

    // --- PROCESS USER LIST ---
    const processedUsers = authUsers.map((authUser) => {
      let robloxProfile = profilesList.find((p) => p.id === authUser.id);
      
      // Fallback to auth metadata
      if (!robloxProfile && authUser.user_metadata?.roblox_profile) {
        const metaProfile = authUser.user_metadata.roblox_profile;
        robloxProfile = {
          id: metaProfile.id ?? authUser.id,
          roblox_user: metaProfile.roblox_user,
          roblox_display_name: metaProfile.roblox_display_name,
          roblox_avatar_url: metaProfile.roblox_avatar_url,
          roblox_verified_at: metaProfile.roblox_verified_at,
          tiktok_user: null,
          link_status: 'none',
          rejection_reason: null,
          is_admin: false,
          soundboard_disabled: false,
          perm_upload_images: true,
          perm_upload_videos: true,
          perm_upload_audio: true,
          perm_tts_text: true,
          perm_tts_record: true,
          perm_edit_nickname: true,
          perm_trigger_sounds: true,
          perm_trigger_media: true,
          perm_trigger_animations: true,
          perm_edit_sounds: true,
          testimonial: null,
          testimonial_approved: false,
        };
      }

      const userVotes = votes?.filter((v) => v.user_id === authUser.id) || [];
      const votedCategoriesCount = userVotes.length;

      const userVotesDetail = userVotes.map((v) => {
        const category = categories.find((c) => c.id === v.category_id);
        const nominee = nominees.find((n) => n.id === v.nominee_id);
        return {
          categoryId: v.category_id,
          categoryTitle: category?.title || `Categoría ${v.category_id}`,
          categoryEmoji: category?.emoji || '🏆',
          nomineeId: v.nominee_id,
          nomineeName: nominee?.nickname || nominee?.roblox_user || 'Desconocido',
        };
      }).sort((a, b) => a.categoryId - b.categoryId);

      const historyItem = historyList?.find((h) => h.user_id === authUser.id);

      return {
        id: authUser.id,
        email: authUser.email || 'N/A',
        createdAt: authUser.created_at,
        lastSignInAt: authUser.last_sign_in_at || '',
        hasVerifiedRoblox: !!robloxProfile,
        robloxUser: robloxProfile?.roblox_user || null,
        robloxDisplayName: robloxProfile?.roblox_display_name || null,
        robloxAvatarUrl: robloxProfile?.roblox_avatar_url || null,
        robloxVerifiedAt: robloxProfile?.roblox_verified_at || null,
        tiktokUser: robloxProfile?.tiktok_user || null,
        linkStatus: robloxProfile?.link_status || 'none',
        rejectionReason: robloxProfile?.rejection_reason || null,
        minecraftRank: (robloxProfile as any)?.minecraft_rank || null,
        isAdmin: robloxProfile?.is_admin || false,
        soundboardDisabled: robloxProfile?.soundboard_disabled || false,
        permUploadImages: robloxProfile?.perm_upload_images ?? true,
        permUploadVideos: robloxProfile?.perm_upload_videos ?? true,
        permUploadAudio: robloxProfile?.perm_upload_audio ?? true,
        permTtsText: robloxProfile?.perm_tts_text ?? true,
        permTtsRecord: robloxProfile?.perm_tts_record ?? true,
        permEditNickname: robloxProfile?.perm_edit_nickname ?? true,
        permTriggerSounds: robloxProfile?.perm_trigger_sounds ?? true,
        permTriggerMedia: robloxProfile?.perm_trigger_media ?? true,
        permTriggerAnimations: robloxProfile?.perm_trigger_animations ?? true,
        permEditSounds: robloxProfile?.perm_edit_sounds ?? true,
        testimonial: robloxProfile?.testimonial || null,
        testimonialApproved: robloxProfile?.testimonial_approved || false,
        alreadyInterviewed: !!historyItem?.already_interviewed,
        votedCount: votedCategoriesCount,
        votedPercentage: categories.length > 0 ? Math.round((votedCategoriesCount / categories.length) * 100) : 0,
        totalCategories: categories.length,
        votes: userVotesDetail,
      };
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Summary
    const totalUsersCount = authUsers.length;
    const verifiedUsersCount = processedUsers.filter((u) => u.hasVerifiedRoblox).length;
    const totalVotesCount = votes?.length || 0;
    const completedVotersCount = processedUsers.filter((u) => u.votedCount >= categories.length).length;

    return NextResponse.json({
      summary: {
        totalUsers: totalUsersCount,
        verifiedUsers: verifiedUsersCount,
        totalVotes: totalVotesCount,
        completedVoters: completedVotersCount,
      },
      categoryStats,
      users: processedUsers,
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
    console.error('Stats endpoint failed:', err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
