import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Layout } from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import StudentsPage from "./pages/StudentsPage";
import ClassesPage from "./pages/ClassesPage";
import AttendancePage from "./pages/AttendancePage";
import GradebookPage from "./pages/GradebookPage";
import ReportCardsPage from "./pages/ReportCardsPage";
import UsersPage from "./pages/UsersPage";
import { Loader2 } from "lucide-react";

const ProtectedRoute = ({ children, allowedRoles }) => {
    const { isAuthenticated, loading, user } = useAuth();
    
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }
    
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }
    
    if (allowedRoles && !allowedRoles.includes(user?.role)) {
        return <Navigate to="/dashboard" replace />;
    }
    
    return <Layout>{children}</Layout>;
};

const PublicRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();
    
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }
    
    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace />;
    }
    
    return children;
};

function AppRoutes() {
    return (
        <Routes>
            <Route 
                path="/login" 
                element={
                    <PublicRoute>
                        <LoginPage />
                    </PublicRoute>
                } 
            />
            <Route 
                path="/dashboard" 
                element={
                    <ProtectedRoute>
                        <DashboardPage />
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/students" 
                element={
                    <ProtectedRoute>
                        <StudentsPage />
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/classes" 
                element={
                    <ProtectedRoute allowedRoles={['admin', 'teacher']}>
                        <ClassesPage />
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/attendance" 
                element={
                    <ProtectedRoute>
                        <AttendancePage />
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/gradebook" 
                element={
                    <ProtectedRoute>
                        <GradebookPage />
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/report-cards" 
                element={
                    <ProtectedRoute allowedRoles={['admin', 'teacher']}>
                        <ReportCardsPage />
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/users" 
                element={
                    <ProtectedRoute allowedRoles={['admin']}>
                        <UsersPage />
                    </ProtectedRoute>
                } 
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    );
}

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <AppRoutes />
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;
