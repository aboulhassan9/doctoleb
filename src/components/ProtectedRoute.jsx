import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children, requiredRole = null }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    if (user.role === 'patient') return <Navigate to="/dashboard" replace />;
    if (user.role === 'doctor') return <Navigate to="/doctor-dashboard" replace />;
    if (user.role === 'predoctor') return <Navigate to="/predoctor-dashboard" replace />;
    if (user.role === 'secretary') return <Navigate to="/dashboard" replace />;
    return <Navigate to="/login" replace />;
  }

  return children;
}
