import Icon from "./Icon";
import SectionShell from "./SectionShell";

const OrganizationActionSection = ({ onOpenCreate, onOpenJoin }) => (
  <SectionShell>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.82fr)] lg:items-center">
      <div>
        <h2 className="text-2xl font-black text-slate-950">
          Tạo hoặc tham gia tổ chức
        </h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onOpenCreate}
          className="organization-action-card group flex items-center gap-4 rounded-3xl bg-blue-50 px-5 py-5 text-left ring-1 ring-blue-100 transition hover:-translate-y-0.5 hover:bg-blue-100/70 active:scale-[0.99]"
        >
          <span className="flex size-12 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-sm ring-1 ring-blue-100">
            <Icon name="add_business" />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-black text-slate-950">
              Tạo tổ chức mới
            </span>
            <span className="mt-1 block text-sm font-semibold text-slate-600">
              Mở form tạo
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={onOpenJoin}
          className="organization-action-card group flex items-center gap-4 rounded-3xl bg-emerald-50 px-5 py-5 text-left ring-1 ring-emerald-100 transition hover:-translate-y-0.5 hover:bg-emerald-100/70 active:scale-[0.99]"
        >
          <span className="flex size-12 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-100">
            <Icon name="group_add" />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-black text-slate-950">
              Tham gia tổ chức
            </span>
            <span className="mt-1 block text-sm font-semibold text-slate-600">
              Nhập link mời
            </span>
          </span>
        </button>
      </div>
    </div>
  </SectionShell>
);

export default OrganizationActionSection;
