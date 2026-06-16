import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { RoutePageSkeleton } from "../components/common/Skeleton";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <RoutePageSkeleton />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
