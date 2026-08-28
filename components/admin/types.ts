export type AdminUser = {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string;
  hasVerifiedRoblox: boolean;
  robloxUser: string | null;
  robloxDisplayName: string | null;
  robloxAvatarUrl: string | null;
  robloxVerifiedAt: string | null;
  tiktokUser: string | null;
  linkStatus: 'none' | 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
  minecraftRank?: 'pollito_admin' | 'pollito_moderador' | 'pollito_oficial' | 'pollito_invitado' | string | null;
  votedCount: number;
  totalCategories: number;
  votedPercentage: number;
  isAdmin: boolean;
  soundboardDisabled: boolean;
  permUploadImages: boolean;
  permUploadVideos: boolean;
  permUploadAudio: boolean;
  permTtsText: boolean;
  permTtsRecord: boolean;
  permEditNickname: boolean;
  permTriggerSounds: boolean;
  permTriggerMedia: boolean;
  permTriggerAnimations: boolean;
  permEditSounds: boolean;
  testimonial: string | null;
  testimonialApproved: boolean;
  votes: { categoryId: number; nomineeName: string }[];
};

export type AdminStats = {
  summary: {
    totalUsers: number;
    verifiedUsers: number;
    totalVotes: number;
    completedVoters: number;
  };
  users: AdminUser[];
};

export function getAdminUserStatusLabel(status: AdminUser['linkStatus']) {
  return {
    none: 'Sin verificar',
    pending: 'Pendiente',
    approved: 'Aprobado',
    rejected: 'Rechazado',
  }[status] || 'Sin verificar';
}

export type AdminDashboard = {
  summary: {
    totalUsers: number;
    approvedUsers: number;
    newUsers: number;
    interactions: number;
    pendingApplications: number;
    pendingUploads: number;
  };
  recentAccesses: {
    userId: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    lastSignInAt: string;
  }[];
  topUsers: { userId: string; name: string; avatarUrl: string | null; count: number }[];
  topSounds: { soundId: string; name: string; count: number }[];
  topUploads: { userId: string; name: string; avatarUrl: string | null; count: number }[];
};
