import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { RoutePageSkeleton } from "../components/common/Skeleton";

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <RoutePageSkeleton />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "admin") {
    return <Navigate to="/403" replace />;
  }

  return children;
};

export default AdminRoute;
