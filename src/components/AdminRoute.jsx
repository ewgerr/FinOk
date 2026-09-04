import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import AccessDenied from "@/components/AccessDenied";

export default function AdminRoute() {
  const { user, isAuthenticated, isLoadingAuth, authChecked, authError } = useAuth();
  const location = useLocation();

  if (isLoadingAuth || !authChecked) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError || !isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  const allowedRoles = ["SUPER_ADMIN", "ADMIN", "MANAGER", "ACCOUNTANT", "VIEWER"];
  if (!allowedRoles.includes(user?.role)) {
    return <AccessDenied />;
  }

  return <Outlet />;
}