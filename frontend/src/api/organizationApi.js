import axiosClient from "./axiosClient";

export const getMyOrganizations = async () => {
  const { data } = await axiosClient.get("/organizations");
  return data;
};

export const createOrganization = async (payload) => {
  const { data } = await axiosClient.post("/organizations", payload);
  return data;
};

export const previewOrganizationJoin = async (inviteLink) => {
  const { data } = await axiosClient.post("/organizations/join/preview", {
    inviteLink,
  });
  return data;
};

export const joinOrganization = async (inviteLink, payload = {}) => {
  const { data } = await axiosClient.post("/organizations/join", {
    inviteLink,
    ...payload,
  });
  return data;
};

export const joinOrganizationByCode = async (inviteCode, payload = {}) => {
  const { data } = await axiosClient.post(
    `/organizations/join/${inviteCode}`,
    payload,
  );
  return data;
};

export const switchOrganization = async (organizationId) => {
  const { data } = await axiosClient.patch("/organizations/switch", {
    organizationId,
  });
  return data;
};

export const getOrganizationMembers = async (organizationId, params = {}) => {
  const { data } = await axiosClient.get(
    `/organizations/${organizationId}/members`,
    { params },
  );
  return data;
};

export const getOrganizationDetail = async (organizationId) => {
  const { data } = await axiosClient.get(`/organizations/${organizationId}`);
  return data;
};

export const getOrganizationOverview = async (organizationId) => {
  const { data } = await axiosClient.get(
    `/organizations/${organizationId}/overview`,
  );
  return data;
};

export const getOrganizationInvite = async (organizationId) => {
  const { data } = await axiosClient.get(
    `/organizations/${organizationId}/invite`,
  );
  return data;
};

export const getOrganizationRoles = async (organizationId, params = {}) => {
  const { data } = await axiosClient.get(`/organizations/${organizationId}/roles`, {
    params,
  });
  return data;
};

export const createOrganizationRole = async (organizationId, payload) => {
  const { data } = await axiosClient.post(
    `/organizations/${organizationId}/roles`,
    payload,
  );
  return data;
};

export const updateOrganizationRole = async (organizationId, roleId, payload) => {
  const { data } = await axiosClient.patch(
    `/organizations/${organizationId}/roles/${roleId}`,
    payload,
  );
  return data;
};

export const deleteOrganizationRole = async (organizationId, roleId) => {
  await axiosClient.delete(`/organizations/${organizationId}/roles/${roleId}`);
};

export const reorderOrganizationRoles = async (organizationId, roleIds) => {
  const { data } = await axiosClient.patch(
    `/organizations/${organizationId}/roles/reorder`,
    { roleIds },
  );
  return data;
};

export const getOrganizationRoleMembers = async (
  organizationId,
  roleId,
  params = {},
) => {
  const { data } = await axiosClient.get(
    `/organizations/${organizationId}/roles/${roleId}/members`,
    { params },
  );
  return data;
};

export const updateOrganizationRoleMembers = async (
  organizationId,
  roleId,
  payload,
) => {
  const { data } = await axiosClient.patch(
    `/organizations/${organizationId}/roles/${roleId}/members`,
    payload,
  );
  return data;
};

export const updateOrganizationMember = async (
  organizationId,
  memberId,
  payload,
) => {
  const { data } = await axiosClient.patch(
    `/organizations/${organizationId}/members/${memberId}`,
    payload,
  );
  return data;
};

export const getOrganizationInvites = async (organizationId, params = {}) => {
  const { data } = await axiosClient.get(
    `/organizations/${organizationId}/invites`,
    { params },
  );
  return data;
};

export const getOrganizationJoinRequests = async (organizationId) => {
  const { data } = await axiosClient.get(
    `/organizations/${organizationId}/join-requests`,
  );
  return data;
};

export const createOrganizationInvite = async (organizationId, payload) => {
  const { data } = await axiosClient.post(
    `/organizations/${organizationId}/invites`,
    payload,
  );
  return data;
};

export const updateOrganizationInvite = async (
  organizationId,
  inviteId,
  payload,
) => {
  const { data } = await axiosClient.patch(
    `/organizations/${organizationId}/invites/${inviteId}`,
    payload,
  );
  return data;
};

export const deleteOrganizationInvite = async (organizationId, inviteId) => {
  await axiosClient.delete(`/organizations/${organizationId}/invites/${inviteId}`);
};

export const pauseOrganizationInvites = async (organizationId, payload) => {
  const { data } = await axiosClient.patch(
    `/organizations/${organizationId}/invites/pause`,
    payload,
  );
  return data;
};

export const updateOrganizationSettings = async (organizationId, payload) => {
  const { data } = await axiosClient.patch(
    `/organizations/${organizationId}/settings`,
    payload,
  );
  return data;
};

export const updateOrganization = async (organizationId, payload) => {
  const { data } = await axiosClient.patch(
    `/organizations/${organizationId}`,
    payload,
  );
  return data;
};

export const updateOrganizationLogo = async (organizationId, file) => {
  const formData = new FormData();
  formData.append("logo", file);
  const { data } = await axiosClient.patch(
    `/organizations/${organizationId}/logo`,
    formData,
  );
  return data;
};

export const updateOrganizationBanner = async (organizationId, file) => {
  const formData = new FormData();
  formData.append("banner", file);
  const { data } = await axiosClient.patch(
    `/organizations/${organizationId}/banner`,
    formData,
  );
  return data;
};

export const updateOrganizationFavorite = async (organizationId, isFavorite) => {
  const { data } = await axiosClient.patch(
    `/organizations/${organizationId}/favorite`,
    { isFavorite },
  );
  return data;
};

export const reviewOrganizationJoinRequest = async (
  organizationId,
  memberId,
  action,
) => {
  const { data } = await axiosClient.patch(
    `/organizations/${organizationId}/members/${memberId}/review`,
    { action },
  );
  return data;
};

export const leaveOrganization = async (organizationId) => {
  const { data } = await axiosClient.delete(
    `/organizations/${organizationId}/members/me`,
  );
  return data;
};

export const transferOrganizationOwnership = async (organizationId, payload) => {
  const { data } = await axiosClient.patch(
    `/organizations/${organizationId}/owner`,
    payload,
  );
  return data;
};
