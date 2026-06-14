import {
  getAvatarReferrerPolicy,
  getAvatarUrl,
} from "../../../utils/avatar";
import { getInitials } from "../organizationUtils";

const OrganizationLogo = ({
  organization,
  className = "size-14",
  labelClassName = "text-base",
  active = false,
}) => {
  const logoUrl = getAvatarUrl(organization?.logoUrl);

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={organization?.name || "Organization"}
        referrerPolicy={getAvatarReferrerPolicy(logoUrl)}
        className={`${className} shrink-0 rounded-2xl object-cover ring-1 ${
          active ? "ring-blue-200" : "ring-slate-200"
        }`}
      />
    );
  }

  return (
    <div
      className={`${className} ${labelClassName} flex shrink-0 items-center justify-center rounded-2xl font-black ring-1 ${
        active
          ? "bg-blue-600 text-white ring-blue-500"
          : "bg-white text-blue-700 ring-blue-100"
      }`}
    >
      {getInitials(organization?.name)}
    </div>
  );
};

export default OrganizationLogo;
