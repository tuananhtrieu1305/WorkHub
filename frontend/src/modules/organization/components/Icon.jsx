const Icon = ({ name, className = "text-lg leading-none" }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

export default Icon;
