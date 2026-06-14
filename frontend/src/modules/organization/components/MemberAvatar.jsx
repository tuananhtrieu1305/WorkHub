import {
  getAvatarReferrerPolicy,
  getAvatarUrl,
} from "../../../utils/avatar";
import { getInitials } from "../organizationUtils";

const MemberAvatar = ({ member }) => {
  const user = member?.user || {};
  const avatarUrl = getAvatarUrl(user.avatar);

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={user.fullName || "Member"}
        referrerPolicy={getAvatarReferrerPolicy(avatarUrl)}
        className="size-10 shrink-0 rounded-xl object-cover ring-1 ring-slate-200"
      />
    );
  }

  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-black text-blue-700 ring-1 ring-blue-100">
      {getInitials(user.fullName || user.email || "U")}
    </div>
  );
};

export default MemberAvatar;
