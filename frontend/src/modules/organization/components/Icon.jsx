const Icon = ({ name, className = "text-lg leading-none", ...props }) => (
  <span {...props} className={`material-symbols-outlined ${className}`}>
    {name}
  </span>
);

export default Icon;
