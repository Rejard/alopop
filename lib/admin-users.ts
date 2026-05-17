import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

const ACTIVE_WINDOW_DAYS = 30;
const INACTIVE_WINDOW_DAYS = 90;
const MAX_PAGE_SIZE = 100;

export type AdminUsersQuery = {
  q?: string;
  role?: string;
  activity?: string;
  apiKey?: string;
  page?: number;
  pageSize?: number;
};

const adminUserSelect = {
  id: true,
  inviteCode: true,
  googleId: true,
  email: true,
  username: true,
  avatar_url: true,
  statusMessage: true,
  walletBalance: true,
  isAi: true,
  aiOwnerId: true,
  isAdmin: true,
  isAgent: true,
  openaiKey: true,
  geminiKey: true,
  anthropicKey: true,
  createdAt: true,
  roomMembers: {
    select: {
      joinedAt: true,
      isHost: true,
      room: {
        select: {
          sponsorMode: true,
          sponsorPrice: true,
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
    take: 20,
  },
  sentTransactions: {
    select: { createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
  receivedTransactions: {
    select: { createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
  friendsAdded: {
    select: { createdAt: true, status: true },
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
  addedBy: {
    select: { createdAt: true, status: true },
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
  pushSubscriptions: {
    select: { createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
  eventRewards: {
    select: { createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
  eventUsages: {
    select: { updatedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: 1,
  },
  offlineMessages: {
    select: { createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
  _count: {
    select: {
      roomMembers: true,
      friendsAdded: true,
      addedBy: true,
      pushSubscriptions: true,
      eventRewards: true,
      eventUsages: true,
      offlineMessages: true,
    },
  },
} satisfies Prisma.UserSelect;

type AdminUserRecord = Prisma.UserGetPayload<{ select: typeof adminUserSelect }>;
type ActivityStatus = 'ACTIVE_ESTIMATE' | 'QUIET_ESTIMATE' | 'INACTIVE_ESTIMATE';

function clampPageSize(pageSize: number | undefined) {
  if (!pageSize || Number.isNaN(pageSize)) return 25;
  return Math.min(Math.max(Math.floor(pageSize), 1), MAX_PAGE_SIZE);
}

function clampPage(page: number | undefined) {
  if (!page || Number.isNaN(page)) return 1;
  return Math.max(Math.floor(page), 1);
}

function maskEmail(email: string | null) {
  if (!email) return null;
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(local.length - visible.length, 1))}@${domain}`;
}

function isQaUser(user: Pick<AdminUserRecord, 'email' | 'username' | 'statusMessage'>) {
  return Boolean(
    user.email?.endsWith('@qa-sim.alopop.test') ||
      user.username.includes('QA') ||
      user.statusMessage?.includes('QA_SIM_STABLE'),
  );
}

function maxDate(...dates: Array<Date | null | undefined>) {
  const times = dates
    .filter((date): date is Date => date instanceof Date)
    .map((date) => date.getTime());
  if (times.length === 0) return null;
  return new Date(Math.max(...times));
}

function getLatestActivityAt(user: AdminUserRecord) {
  return maxDate(
    user.createdAt,
    user.roomMembers[0]?.joinedAt,
    user.sentTransactions[0]?.createdAt,
    user.receivedTransactions[0]?.createdAt,
    user.friendsAdded[0]?.createdAt,
    user.addedBy[0]?.createdAt,
    user.pushSubscriptions[0]?.createdAt,
    user.eventRewards[0]?.createdAt,
    user.eventUsages[0]?.updatedAt,
    user.offlineMessages[0]?.createdAt,
  );
}

function getActivityStatus(latestActivityAt: Date | null, now = new Date()): ActivityStatus {
  if (!latestActivityAt) return 'INACTIVE_ESTIMATE';
  const ageMs = now.getTime() - latestActivityAt.getTime();
  const activeMs = ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const inactiveMs = INACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  if (ageMs <= activeMs) return 'ACTIVE_ESTIMATE';
  if (ageMs <= inactiveMs) return 'QUIET_ESTIMATE';
  return 'INACTIVE_ESTIMATE';
}

function getRoleWhere(role: string | undefined): Prisma.UserWhereInput {
  switch (role) {
    case 'admin':
      return { isAdmin: true };
    case 'ai':
      return { isAi: true };
    case 'agent':
      return { isAgent: true };
    case 'qa':
      return {
        OR: [
          { email: { endsWith: '@qa-sim.alopop.test' } },
          { username: { contains: 'QA' } },
          { statusMessage: { contains: 'QA_SIM_STABLE' } },
        ],
      };
    case 'regular':
      return { isAdmin: false, isAi: false, isAgent: false };
    default:
      return {};
  }
}

function getApiKeyWhere(apiKey: string | undefined): Prisma.UserWhereInput {
  if (apiKey === 'has') {
    return {
      OR: [
        { openaiKey: { not: null } },
        { geminiKey: { not: null } },
        { anthropicKey: { not: null } },
      ],
    };
  }
  if (apiKey === 'none') {
    return {
      openaiKey: null,
      geminiKey: null,
      anthropicKey: null,
    };
  }
  return {};
}

function buildWhere(query: AdminUsersQuery): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [getRoleWhere(query.role), getApiKeyWhere(query.apiKey)];
  const q = query.q?.trim();
  if (q) {
    and.push({
      OR: [
        { username: { contains: q } },
        { email: { contains: q } },
        { inviteCode: { contains: q } },
        { id: { contains: q } },
      ],
    });
  }
  return { AND: and };
}

function toSafeMember(user: AdminUserRecord) {
  const latestActivityAt = getLatestActivityAt(user);
  const hasOpenaiKey = Boolean(user.openaiKey);
  const hasGeminiKey = Boolean(user.geminiKey);
  const hasAnthropicKey = Boolean(user.anthropicKey);
  const sponsorHostRooms = user.roomMembers.filter((member) => member.isHost && member.room.sponsorMode).length;

  return {
    id: user.id,
    username: user.username,
    emailMasked: maskEmail(user.email),
    hasGoogleAccount: Boolean(user.googleId),
    avatar_url: user.avatar_url,
    walletBalance: user.walletBalance,
    isAdmin: user.isAdmin,
    isAi: user.isAi,
    aiOwnerId: user.aiOwnerId,
    isAgent: user.isAgent,
    isQaUser: isQaUser(user),
    createdAt: user.createdAt.toISOString(),
    latestActivityAt: latestActivityAt?.toISOString() || null,
    activityStatus: getActivityStatus(latestActivityAt),
    hasOpenaiKey,
    hasGeminiKey,
    hasAnthropicKey,
    hasAnyApiKey: hasOpenaiKey || hasGeminiKey || hasAnthropicKey,
    sponsorHostRooms,
    counts: {
      rooms: user._count.roomMembers,
      friendsAdded: user._count.friendsAdded,
      addedBy: user._count.addedBy,
      pushSubscriptions: user._count.pushSubscriptions,
      eventRewards: user._count.eventRewards,
      eventUsages: user._count.eventUsages,
      offlineNotices: user._count.offlineMessages,
    },
  };
}

function applyDerivedFilters(members: ReturnType<typeof toSafeMember>[], query: AdminUsersQuery) {
  if (!query.activity || query.activity === 'all') return members;
  return members.filter((member) => member.activityStatus === query.activity);
}

export async function getAdminUsersOverview(query: AdminUsersQuery) {
  const page = clampPage(query.page);
  const pageSize = clampPageSize(query.pageSize);
  const where = buildWhere(query);

  const [allRawUsers, listRawUsers] = await Promise.all([
    prisma.user.findMany({
      select: adminUserSelect,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.findMany({
      where,
      select: adminUserSelect,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const allMembers = allRawUsers.map(toSafeMember);
  const listMembers = listRawUsers.map(toSafeMember);
  const filteredMembers = applyDerivedFilters(listMembers, query);
  const start = (page - 1) * pageSize;
  const members = filteredMembers.slice(start, start + pageSize);

  const sponsorHostUserIds = new Set(
    allRawUsers
      .filter((user) => user.roomMembers.some((member) => member.isHost && member.room.sponsorMode))
      .map((user) => user.id),
  );

  const activeEstimate = allMembers.filter((member) => member.activityStatus === 'ACTIVE_ESTIMATE').length;
  const quietEstimate = allMembers.filter((member) => member.activityStatus === 'QUIET_ESTIMATE').length;
  const inactiveEstimate = allMembers.filter((member) => member.activityStatus === 'INACTIVE_ESTIMATE').length;
  const apiKeyHolders = allMembers.filter((member) => member.hasAnyApiKey).length;
  const googleAccounts = allMembers.filter((member) => member.hasGoogleAccount).length;

  return {
    generatedAt: new Date().toISOString(),
    caveats: {
      activity: `현재 DB에는 lastActiveAt/status/withdrawnAt/suspendedAt 전용 컬럼이 없습니다. 활동 상태는 가입일, 방 참여, 지갑 거래, 이벤트 사용, 푸시 구독, 친구 관계, 오프라인 알림 기록으로 추정합니다. 활동 기준: ${ACTIVE_WINDOW_DAYS}일 이내, 비활동 기준: ${INACTIVE_WINDOW_DAYS}일 초과.`,
      privacy: '구글 ID, API 키 원문, AI 프롬프트, agent token, 채팅 내용은 응답에서 제외합니다. 구글 이메일은 식별정보라 마스킹된 값만 제공합니다.',
    },
    stats: {
      totalUsers: allMembers.length,
      activity: {
        activeEstimate,
        quietEstimate,
        inactiveEstimate,
      },
      roles: {
        admins: allMembers.filter((member) => member.isAdmin).length,
        regularUsers: allMembers.filter((member) => !member.isAdmin && !member.isAi && !member.isAgent).length,
        aiUsers: allMembers.filter((member) => member.isAi).length,
        agents: allMembers.filter((member) => member.isAgent).length,
        qaUsers: allMembers.filter((member) => member.isQaUser).length,
      },
      access: {
        googleAccounts,
        apiKeyHolders,
        eventOnlyUsers: allMembers.length - apiKeyHolders,
      },
      sponsor: {
        sponsorHosts: sponsorHostUserIds.size,
        sponsoredRooms: allMembers.reduce((sum, member) => sum + member.sponsorHostRooms, 0),
      },
      wallet: {
        negativeBalances: allMembers.filter((member) => member.walletBalance < 0).length,
        zeroBalances: allMembers.filter((member) => member.walletBalance === 0).length,
        lowBalances: allMembers.filter((member) => member.walletBalance > 0 && member.walletBalance < 100).length,
      },
    },
    members,
    pagination: {
      page,
      pageSize,
      total: filteredMembers.length,
      totalPages: Math.max(Math.ceil(filteredMembers.length / pageSize), 1),
    },
    filters: {
      q: query.q || '',
      role: query.role || 'all',
      activity: query.activity || 'all',
      apiKey: query.apiKey || 'all',
    },
  };
}
