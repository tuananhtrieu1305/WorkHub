import { GooeyToaster } from "goey-toast";
import "goey-toast/styles.css";
import "./workHubToast.css";

const WorkHubToaster = () => (
  <GooeyToaster
    position="top-center"
    preset="smooth"
    showTimestamp={false}
    closeButton="top-right"
    duration={4200}
    gap={12}
    offset={18}
    visibleToasts={5}
    maxQueue={8}
    queueOverflow="drop-oldest"
    swipeToDismiss
    closeOnEscape
  />
);

export default WorkHubToaster;
