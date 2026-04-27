const toId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value._id?.toString?.() || value.toString?.() || null;
};

const isAdmin = (user) => user?.role === "admin";

const hasExplicitRole = (user, permissions, allowedRoles) => {
  const userId = toId(user?._id);
  return Boolean(
    permissions?.users?.some((entry) => {
      return (
        toId(entry.userId) === userId &&
        allowedRoles.includes(entry.role)
      );
    }),
  );
};

const sameDepartment = (user, resource) => {
  const userDepartmentId = toId(user?.departmentId);
  const resourceDepartmentId = toId(resource?.departmentId);
  return Boolean(userDepartmentId && resourceDepartmentId && userDepartmentId === resourceDepartmentId);
};

const isOwnerOrCreator = (user, resource) => {
  const userId = toId(user?._id);
  return (
    userId &&
    (toId(resource?.ownerId) === userId || toId(resource?.createdBy) === userId)
  );
};

export const canReadFolder = (user, folder) => {
  if (!user || !folder || folder.deletedAt) return false;
  if (isAdmin(user) || isOwnerOrCreator(user, folder)) return true;
  if (folder.permissions?.visibility === "department" && sameDepartment(user, folder)) return true;
  return hasExplicitRole(user, folder.permissions, ["viewer", "editor"]);
};

export const canUploadToFolder = (user, folder) => {
  if (!user || !folder || folder.deletedAt) return false;
  if (isAdmin(user) || isOwnerOrCreator(user, folder)) return true;
  return hasExplicitRole(user, folder.permissions, ["editor"]);
};

export const canRead = (user, document) => {
  if (!user || !document || document.deletedAt || document.status === "deleted") return false;
  if (isAdmin(user) || isOwnerOrCreator(user, document)) return true;
  if (document.permissions?.visibility === "department" && sameDepartment(user, document)) return true;
  return hasExplicitRole(user, document.permissions, ["viewer", "editor"]);
};

export const canEdit = (user, document) => {
  if (!user || !document || document.deletedAt || document.status === "deleted") return false;
  if (isAdmin(user) || isOwnerOrCreator(user, document)) return true;
  return hasExplicitRole(user, document.permissions, ["editor"]);
};

export const canDelete = canEdit;
export const canShare = canEdit;

export const canViewVersion = (user, document, version) => {
  if (!version || toId(version.documentId) !== toId(document?._id)) return false;
  return canRead(user, document);
};

export default {
  canReadFolder,
  canUploadToFolder,
  canRead,
  canEdit,
  canDelete,
  canShare,
  canViewVersion,
};
