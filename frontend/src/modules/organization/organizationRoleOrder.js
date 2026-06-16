export const getDropPlacement = (event, element, fallback = "before") => {
  if (!element?.getBoundingClientRect) return fallback;

  const clientY = Number(event?.clientY);
  if (!Number.isFinite(clientY)) return fallback;

  const rect = element.getBoundingClientRect();
  if (!rect || !Number.isFinite(rect.top) || !Number.isFinite(rect.height)) {
    return fallback;
  }

  return clientY > rect.top + rect.height / 2 ? "after" : "before";
};

export const moveRole = (
  roles = [],
  sourceRoleId,
  targetRoleId,
  placement = "before",
) => {
  if (
    !Array.isArray(roles) ||
    !sourceRoleId ||
    !targetRoleId ||
    sourceRoleId === targetRoleId
  ) {
    return roles;
  }

  const sourceIndex = roles.findIndex((role) => role.id === sourceRoleId);
  const targetIndex = roles.findIndex((role) => role.id === targetRoleId);
  if (sourceIndex < 0 || targetIndex < 0) return roles;

  const nextRoles = [...roles];
  const [movedRole] = nextRoles.splice(sourceIndex, 1);
  const nextTargetIndex = nextRoles.findIndex((role) => role.id === targetRoleId);
  if (nextTargetIndex < 0) return roles;

  const insertIndex = placement === "after" ? nextTargetIndex + 1 : nextTargetIndex;
  nextRoles.splice(insertIndex, 0, movedRole);

  return nextRoles.every((role, index) => role.id === roles[index]?.id)
    ? roles
    : nextRoles;
};
