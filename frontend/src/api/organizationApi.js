import axiosClient from "./axiosClient";

export const getMyOrganizations = async () => {
  const { data } = await axiosClient.get("/organizations");
  return data;
};

export const createOrganization = async (payload) => {
  const { data } = await axiosClient.post("/organizations", payload);
  return data;
};

export const joinOrganization = async (inviteLink) => {
  const { data } = await axiosClient.post("/organizations/join", {
    inviteLink,
  });
  return data;
};

export const joinOrganizationByCode = async (inviteCode) => {
  const { data } = await axiosClient.post(`/organizations/join/${inviteCode}`);
  return data;
};

export const switchOrganization = async (organizationId) => {
  const { data } = await axiosClient.patch("/organizations/switch", {
    organizationId,
  });
  return data;
};

export const getOrganizationMembers = async (organizationId) => {
  const { data } = await axiosClient.get(
    `/organizations/${organizationId}/members`,
  );
  return data;
};

export const getOrganizationInvite = async (organizationId) => {
  const { data } = await axiosClient.get(
    `/organizations/${organizationId}/invite`,
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

export const leaveOrganization = async (organizationId) => {
  const { data } = await axiosClient.delete(
    `/organizations/${organizationId}/members/me`,
  );
  return data;
};
