const SectionShell = ({ children, className = "" }) => (
  <section
    className={`rounded-[1.75rem] bg-white/95 p-5 shadow-sm ring-1 ring-slate-200/80 backdrop-blur sm:p-6 ${className}`}
  >
    {children}
  </section>
);

export default SectionShell;
