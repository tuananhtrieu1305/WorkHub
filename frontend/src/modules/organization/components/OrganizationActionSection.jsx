import OrganizationQuickActionButton from "./OrganizationQuickActionButton";

const OrganizationActionSection = ({ onOpenCreate, onOpenJoin }) => (
  <section className="grid gap-3 sm:grid-cols-2">
    <OrganizationQuickActionButton
      description="Thiết lập không gian làm việc mới"
      label="Tạo tổ chức mới"
      onClick={onOpenCreate}
      variant="create"
    />
    <OrganizationQuickActionButton
      description="Dán link mời hoặc mã invite"
      label="Tham gia tổ chức"
      onClick={onOpenJoin}
      variant="join"
    />
  </section>
);

export default OrganizationActionSection;
