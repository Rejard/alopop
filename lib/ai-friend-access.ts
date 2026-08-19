type AiFriendAccessInput = {
  currentUserId: string;
  aiOwnerId: string | null | undefined;
  hasActiveFriendship: boolean;
  currentUserInRoom: boolean;
  aiUserInRoom: boolean;
};

export function canAccessAiFriend(input: AiFriendAccessInput) {
  if (input.aiOwnerId === input.currentUserId) return true;
  if (input.hasActiveFriendship) return true;
  return input.currentUserInRoom && input.aiUserInRoom;
}

export function canStartAutonomousAiWork(
  currentUserId: string,
  aiOwnerId: string | null | undefined,
  isAgent: boolean,
) {
  return isAgent && aiOwnerId === currentUserId;
}
