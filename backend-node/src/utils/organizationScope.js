import ApiError from "./apiError.js";

export const toId = (value) => {
  if (!value) return "";
  return String(value._id || value.id || value);
};

export const getRequestOrganizationId = (req) =>
  toId(req?.organizationId || req?.user?.activeOrganizationId);

export const hasActiveOrganization = (req) =>
  Boolean(getRequestOrganizationId(req));

export const requireActiveOrganization = (req) => {
  const organizationId = getRequestOrganizationId(req);
  if (!organizationId) {
    throw new ApiError(
      409,
      "Please create or join an organization before using this feature",
      "NO_ACTIVE_ORGANIZATION",
    );
  }
  return organizationId;
};

export const isResourceInOrganization = (resource, organizationId) => {
  const resourceOrganizationId = toId(resource?.organizationId);
  const targetOrganizationId = toId(organizationId);
  return Boolean(resourceOrganizationId && targetOrganizationId) &&
    resourceOrganizationId === targetOrganizationId;
};

export const assertResourceInActiveOrganization = (req, resource, label) => {
  if (!resource || !isResourceInOrganization(resource, getRequestOrganizationId(req))) {
    throw new ApiError(404, `${label} not found`);
  }
};

export const emptyPage = (page = 1, size = 10) => ({
  content: [],
  totalElements: 0,
  totalPages: 0,
  currentPage: Number(page) || 1,
  pageSize: Number(size) || 10,
});
