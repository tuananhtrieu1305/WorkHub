import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import UserProfileModal from "../../profile/UserProfileModal";
import Icon from "./Icon";
import MemberAvatar from "./MemberAvatar";
import { PanelListSkeleton } from "../../../components/common/Skeleton";

const getMemberUserId = (member = {}) =>
  String(member.user?._id || member.user?.id || member.userId || "");

const getMemberRoles = (member = {}) =>
  Array.isArray(member.roles) && member.roles.length
    ? member.roles
    : [
        {
          id: member.roleId,
          key: member.role,
          name: member.roleLabel || "Thành viên",
          color: member.roleColor || "#2563eb",
        },
      ];

const MemberIdentityButton = ({ member, onOpenProfile }) => (
  <button
    type="button"
    onClick={() => onOpenProfile?.(member)}
    className="flex min-w-0 items-center gap-3 rounded-xl text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
  >
    <MemberAvatar member={member} />
    <div className="min-w-0">
      <p className="truncate text-sm font-black text-slate-950">
        {member.user?.fullName || "Người dùng"}
      </p>
      <p className="truncate text-xs font-semibold text-slate-500">
        {member.user?.email}
      </p>
    </div>
  </button>
);

const MemberRow = ({ member, onOpenProfile }) => (
  <div className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
    <MemberIdentityButton member={member} onOpenProfile={onOpenProfile} />
    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
      <span
        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-black ${
          member.user?.isOnline
            ? "bg-emerald-50 text-emerald-700"
            : "bg-slate-100 text-slate-500"
        }`}
      >
        <span
          className={`size-2 rounded-full ${
            member.user?.isOnline ? "bg-emerald-500" : "bg-slate-300"
          }`}
        />
        {member.user?.isOnline ? "Online" : "Offline"}
      </span>
      {member.user?.position && (
        <span className="truncate rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
          {member.user.position}
        </span>
      )}
      {getMemberRoles(member).map((role) => (
        <span
          key={role.id || role.key || role.name}
          className="rounded-lg px-2.5 py-1 text-xs font-black ring-1"
          style={{
            backgroundColor: `${role.color || "#2563eb"}18`,
            borderColor: `${role.color || "#2563eb"}2e`,
            color: role.color || "#2563eb",
          }}
        >
          {role.name || "Thành viên"}
        </span>
      ))}
    </div>
  </div>
);

const OrganizationMembersPanel = ({
  activeMembers,
  canManage,
  isLoadingMembers,
  onReviewRequest,
  pendingMembers,
  reviewingMemberId,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profileModalUser, setProfileModalUser] = useState(null);
  const currentUserId = String(user?._id || user?.id || "");

  const openMemberProfile = (member) => {
    const memberUserId = getMemberUserId(member);
    if (!memberUserId) return;
    if (memberUserId === currentUserId) {
      navigate("/profile");
      return;
    }
    setProfileModalUser(member.user);
  };

  return (
  <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h4 className="text-lg font-black text-slate-950">Thành viên</h4>
      <span className="inline-flex w-fit items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">
        <Icon name="groups" className="text-base leading-none" />
        {activeMembers.length} active
      </span>
    </div>

    <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-slate-200">
      {isLoadingMembers ? (
        <PanelListSkeleton count={3} />
      ) : (
        <div className="divide-y divide-slate-100">
          {activeMembers.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              onOpenProfile={openMemberProfile}
            />
          ))}
        </div>
      )}
    </div>

    {canManage && pendingMembers.length > 0 && (
      <div className="mt-5">
        <h5 className="text-sm font-black text-slate-950">
          Yêu cầu tham gia đang chờ duyệt
        </h5>
        <div className="mt-3 overflow-hidden rounded-2xl ring-1 ring-slate-200">
          <div className="divide-y divide-slate-100">
            {pendingMembers.map((member) => (
              <div
                key={member.id}
                className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <MemberIdentityButton
                  member={member}
                  onOpenProfile={openMemberProfile}
                />
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => onReviewRequest(member.id, "approve")}
                    disabled={Boolean(reviewingMemberId)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Icon
                      name={
                        reviewingMemberId === `${member.id}:approve`
                          ? "progress_activity"
                          : "check"
                      }
                      className="text-base leading-none"
                    />
                    Duyệt
                  </button>
                  <button
                    type="button"
                    onClick={() => onReviewRequest(member.id, "reject")}
                    disabled={Boolean(reviewingMemberId)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Icon
                      name={
                        reviewingMemberId === `${member.id}:reject`
                          ? "progress_activity"
                          : "close"
                      }
                      className="text-base leading-none"
                    />
                    Từ chối
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}
    <UserProfileModal
      open={Boolean(profileModalUser)}
      userId={profileModalUser?._id || profileModalUser?.id}
      userPreview={profileModalUser}
      onClose={() => setProfileModalUser(null)}
    />
  </div>
  );
};

export default OrganizationMembersPanel;
