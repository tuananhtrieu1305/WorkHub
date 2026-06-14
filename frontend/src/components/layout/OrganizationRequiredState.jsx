import { Link } from "react-router-dom";

const OrganizationRequiredState = () => {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-10">
      <section className="w-full max-w-xl text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-blue-100 bg-white text-blue-600 shadow-sm">
          <span className="material-symbols-outlined text-4xl leading-none">
            domain_add
          </span>
        </span>
        <h1 className="mt-6 text-2xl font-black text-slate-950">
          Không gian này chưa có dữ liệu
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm font-medium leading-6 text-slate-500">
          Bạn cần tạo một tổ chức mới hoặc tham gia bằng link mời để xem bảng tin,
          tin nhắn, tài liệu, công việc và cuộc họp của tổ chức đó.
        </p>
        <Link
          to="/organization"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
        >
          <span className="material-symbols-outlined text-xl leading-none">
            arrow_forward
          </span>
          Đi tới tổ chức
        </Link>
      </section>
    </div>
  );
};

export default OrganizationRequiredState;
