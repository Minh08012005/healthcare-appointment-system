import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { getPostLoginPath } from "../auth/authPaths";

/**
 * Public/patient-facing entry point of MEDICARE at "/"
 * - Authenticated Patient: redirects to /patient (Patient Home)
 * - Authenticated Staff: redirects to their respective workspace (Doctor, Reception, Lab, Admin)
 * - Guest / Unauthenticated: redirects safely to /news (MEDICARE public content portal under PublicLayout)
 */
function PublicEntryRedirect() {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (user?.role === "Bệnh nhân") {
    return <Navigate to="/patient" replace />;
  }

  if (user && user.role !== "Bệnh nhân") {
    return <Navigate to={getPostLoginPath(user.role)} replace />;
  }

  return <Navigate to="/news" replace />;
}

export default PublicEntryRedirect;
