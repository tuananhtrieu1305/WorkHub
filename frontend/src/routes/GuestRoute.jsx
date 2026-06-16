import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { RoutePageSkeleton } from "../components/common/Skeleton";

const GuestRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <RoutePageSkeleton />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default GuestRoute;
