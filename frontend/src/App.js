import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Layout } from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import SchoolsPage from "./pages/SchoolsPage";
import StudentsPage from "./pages/StudentsPage";
import ClassesPage from "./pages/ClassesPage";
import AttendancePage from "./pages/AttendancePage";
import GradebookPage from "./pages/GradebookPage";
import ReportsPage from "./pages/ReportsPage";
import UsersPage from "./pages/UsersPage";
import ImportExportPage from "./pages/ImportExportPage";
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
    
    // Superuser has access to everything
    if (user?.role === 'superuser') {
        return <Layout>{children}</Layout>;
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
                path="/schools" 
                element={
                    <ProtectedRoute allowedRoles={['superuser']}>
                        <SchoolsPage />
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
                    <ProtectedRoute allowedRoles={['superuser', 'admin', 'teacher']}>
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
                    <ProtectedRoute allowedRoles={['superuser', 'admin', 'teacher']}>
                        <ReportsPage />
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/import-export" 
                element={
                    <ProtectedRoute allowedRoles={['superuser', 'admin']}>
                        <ImportExportPage />
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/users" 
                element={
                    <ProtectedRoute allowedRoles={['superuser', 'admin']}>
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
