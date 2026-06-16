const toId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value._id?.toString?.() || value.toString?.() || null;
};

const hasOrganizationPermission = (user, permissionKey) => {
  if (user?.activeOrganizationIsOwner) return true;
  return Boolean(user?.activeOrganizationPermissions?.[permissionKey]);
};

const canManageDocuments = (user) =>
  hasOrganizationPermission(user, "manageDocuments");

const canManageDocumentFolders = (user) =>
  canManageDocuments(user) ||
  hasOrganizationPermission(user, "manageDocumentFolders");

const canShareDocuments = (user) =>
  canManageDocuments(user) ||
  hasOrganizationPermission(user, "shareDocuments");

export const canViewDocumentInsights = (user) =>
  canManageDocuments(user) ||
  hasOrganizationPermission(user, "viewDocumentInsights");

export const canManageAllDocuments = canManageDocuments;

export const canManageDocumentPortal = (user) =>
  canManageDocuments(user) || canManageDocumentFolders(user);

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

const sameOrganization = (user, resource) => {
  const userOrganizationId = toId(user?.activeOrganizationId);
  const resourceOrganizationId = toId(resource?.organizationId);
  return Boolean(userOrganizationId && resourceOrganizationId && userOrganizationId === resourceOrganizationId);
};

const isOrganizationVisible = (resource) =>
  resource?.permissions?.visibility === "organization";

const isOwnerOrCreator = (user, resource) => {
  const userId = toId(user?._id);
  return (
    userId &&
    (toId(resource?.ownerId) === userId || toId(resource?.createdBy) === userId)
  );
};

export const canReadFolder = (user, folder) => {
  if (!user || !folder || folder.deletedAt) return false;
  if (!sameOrganization(user, folder)) return false;
  if (canManageDocuments(user) || canManageDocumentFolders(user)) return true;
  if (isOwnerOrCreator(user, folder)) return true;
  if (isOrganizationVisible(folder) && sameOrganization(user, folder)) return true;
  return hasExplicitRole(user, folder.permissions, ["viewer", "editor"]);
};

export const canUploadToFolder = (user, folder) => {
  if (!user || !folder || folder.deletedAt) return false;
  if (!sameOrganization(user, folder)) return false;
  if (canManageDocuments(user) || canManageDocumentFolders(user)) return true;
  if (isOwnerOrCreator(user, folder)) return true;
  if (isOrganizationVisible(folder)) return true;
  return hasExplicitRole(user, folder.permissions, ["editor"]);
};

export const canManageFolder = (user, folder) => {
  if (!user || !folder || folder.deletedAt) return false;
  if (!sameOrganization(user, folder)) return false;
  if (canManageDocuments(user) || canManageDocumentFolders(user)) return true;
  return isOwnerOrCreator(user, folder);
};

export const canRead = (user, document) => {
  if (!user || !document || document.deletedAt || document.status === "deleted") return false;
  if (!sameOrganization(user, document)) return false;
  if (canManageDocuments(user)) return true;
  if (isOwnerOrCreator(user, document)) return true;
  if (isOrganizationVisible(document) && sameOrganization(user, document)) return true;
  return hasExplicitRole(user, document.permissions, ["viewer", "editor"]);
};

export const canEdit = (user, document) => {
  if (!user || !document || document.deletedAt || document.status === "deleted") return false;
  if (!sameOrganization(user, document)) return false;
  if (canManageDocuments(user)) return true;
  if (isOwnerOrCreator(user, document)) return true;
  return hasExplicitRole(user, document.permissions, ["editor"]);
};

export const canDelete = canEdit;
export const canShare = (user, document) => {
  if (!user || !document || document.deletedAt || document.status === "deleted") return false;
  if (!sameOrganization(user, document)) return false;
  return canEdit(user, document) || canShareDocuments(user);
};

export const canViewVersion = (user, document, version) => {
  if (!version || toId(version.documentId) !== toId(document?._id)) return false;
  return canRead(user, document);
};

export default {
  canReadFolder,
  canUploadToFolder,
  canManageFolder,
  canManageAllDocuments,
  canManageDocumentPortal,
  canRead,
  canEdit,
  canDelete,
  canShare,
  canViewVersion,
  canViewDocumentInsights,
};
