import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function ProtectedRoute({ children }) {
  const { isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--vsm-black)] text-[var(--vsm-grey)]">
        <Loader2 size={28} className="animate-spin text-[var(--vsm-red)]" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
