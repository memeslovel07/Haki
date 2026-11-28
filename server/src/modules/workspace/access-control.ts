export function workspaceRepositoryAccessWhere(userId: string) {
  return {
    OR: [
      { ownerId: userId },
      {
        visibility: "PUBLIC" as const,
        owner: {
          teamMemberships: {
            some: {
              status: "ACTIVE" as const,
              team: { members: { some: { userId, status: "ACTIVE" as const } } },
            },
          },
        },
      },
    ],
  };
}
