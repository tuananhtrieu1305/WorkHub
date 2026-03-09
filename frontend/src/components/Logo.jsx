import Logo_Icon from "../assets/react.svg";
const Logo = (props) => {
  const { theme } = props;
  return (
    <div className="flex justify-center items-center gap-[15px]">
      <figure className="max-w-[32px]">
        <img srcSet={`${Logo_Icon} 2x`} alt="logo" />
      </figure>
      <span
        className={`poppins-bold leading-[32px] ${
          theme == "dark" ? "text-white" : "text-black"
        }`}
      >
        Logo Here
      </span>
    </div>
  );
};

export default Logo;
