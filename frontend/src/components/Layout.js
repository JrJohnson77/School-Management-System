import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Toaster } from 'sonner';
import {
    LayoutDashboard,
    Users,
    GraduationCap,
    School,
    CalendarCheck,
    BookOpen,
    FileText,
    Building2,
    LogOut,
    Menu,
    X,
    ChevronDown,
    Shield,
    FolderInput,
    Bell
} from 'lucide-react';

const NavItem = ({ to, icon: Icon, label, isCollapsed, isActive }) => (
    <Link
        to={to}
        className={`nav-item ${isActive ? 'active' : ''} ${isCollapsed ? 'justify-center px-3' : ''}`}
        data-testid={`nav-${label.toLowerCase().replace(/\s/g, '-')}`}
    >
        <Icon className="w-[18px] h-[18px] flex-shrink-0" />
        {!isCollapsed && <span>{label}</span>}
    </Link>
);

export const Layout = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { user, logout, isSuperuser, isAdmin, isTeacher, isParent, schoolCode } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const getInitials = (name) => {
        return name
            ?.split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2) || '??';
    };

    const getRoleBadgeStyle = (role) => {
        switch (role) {
            case 'superuser': return 'bg-violet-500/20 text-violet-300';
            case 'admin': return 'bg-rose-500/20 text-rose-300';
            case 'teacher': return 'bg-sky-500/20 text-sky-300';
            case 'parent': return 'bg-emerald-500/20 text-emerald-300';
            default: return 'bg-slate-500/20 text-slate-300';
        }
    };

    const getRoleBadgeColor = (role) => {
        switch (role) {
            case 'superuser': return 'bg-violet-100 text-violet-700';
            case 'admin': return 'bg-rose-100 text-rose-700';
            case 'teacher': return 'bg-sky-100 text-sky-700';
            case 'parent': return 'bg-emerald-100 text-emerald-700';
            default: return 'bg-slate-100 text-slate-600';
        }
    };

    const navItems = [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['superuser', 'admin', 'teacher', 'parent'] },
        { to: '/schools', icon: Building2, label: 'Schools', roles: ['superuser'] },
        { to: '/students', icon: GraduationCap, label: 'Students', roles: ['superuser', 'admin', 'teacher', 'parent'] },
        { to: '/classes', icon: School, label: 'Classes', roles: ['superuser', 'admin', 'teacher'] },
        { to: '/attendance', icon: CalendarCheck, label: 'Attendance', roles: ['superuser', 'admin', 'teacher', 'parent'] },
        { to: '/gradebook', icon: BookOpen, label: 'Gradebook', roles: ['superuser', 'admin', 'teacher', 'parent'] },
        { to: '/report-cards', icon: FileText, label: 'Report Cards', roles: ['superuser', 'admin', 'teacher'] },
        { to: '/import-export', icon: FolderInput, label: 'Import/Export', roles: ['superuser', 'admin'] },
        { to: '/users', icon: Users, label: 'Users', roles: ['superuser', 'admin'] },
    ];

    const filteredNavItems = navItems.filter(item => item.roles.includes(user?.role));

    return (
        <div className="min-h-screen bg-background">
            <Toaster position="top-right" richColors />
            
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div 
                    className="mobile-overlay opacity-100"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`sidebar ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                <div className="flex flex-col h-full">
                    {/* Logo */}
                    <div className="flex items-center justify-between px-5 py-5">
                        <Link to="/dashboard" className="flex items-center gap-3">
                            <img src="/lumina-logo.png" alt="Lumina-SIS" className="w-9 h-9 object-contain rounded-lg" />
                            <div>
                                <h1 className="font-extrabold text-white text-base tracking-tight">Lumina-SIS</h1>
                                <p className="text-[11px] font-medium" style={{ color: 'hsl(var(--sidebar-muted))' }}>{schoolCode}</p>
                            </div>
                        </Link>
                        <button 
                            className="md:hidden p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                            style={{ color: 'hsl(var(--sidebar-muted))' }}
                            onClick={() => setSidebarOpen(false)}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="sidebar-divider" />

                    {/* Navigation */}
                    <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
                        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'hsl(var(--sidebar-muted))' }}>
                            Menu
                        </p>
                        {filteredNavItems.map((item) => (
                            <NavItem
                                key={item.to}
                                {...item}
                                isActive={location.pathname === item.to}
                            />
                        ))}
                    </nav>

                    {/* User section */}
                    <div className="sidebar-divider" />
                    <div className="p-3">
                        <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'hsl(var(--sidebar-fg) / 0.04)' }}>
                            <Avatar className="w-9 h-9">
                                <AvatarFallback className={`text-xs font-bold ${getRoleBadgeStyle(user?.role)}`}>
                                    {getInitials(user?.name)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-white truncate">{user?.name}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    {user?.role === 'superuser' && <Shield className="w-3 h-3 text-violet-400" />}
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold capitalize ${getRoleBadgeStyle(user?.role)}`}>
                                        {user?.role}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <div className="main-content">
                {/* Top bar */}
                <header className="flex items-center justify-between mb-6">
                    <button
                        className="md:hidden p-2 hover:bg-muted rounded-lg transition-colors"
                        onClick={() => setSidebarOpen(true)}
                        data-testid="mobile-menu-btn"
                    >
                        <Menu className="w-5 h-5" />
                    </button>

                    <div className="flex-1 md:flex-none" />

                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button 
                                    variant="ghost" 
                                    className="flex items-center gap-2 rounded-lg h-10 px-2 hover:bg-muted"
                                    data-testid="user-menu-btn"
                                >
                                    <Avatar className="w-8 h-8">
                                        <AvatarFallback className={`text-xs font-bold ${getRoleBadgeColor(user?.role)}`}>
                                            {getInitials(user?.name)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="hidden md:inline text-sm font-medium">{user?.name}</span>
                                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 rounded-xl">
                                <DropdownMenuLabel>
                                    <div className="flex flex-col">
                                        <span className="font-semibold">{user?.name}</span>
                                        <span className="text-xs font-normal text-muted-foreground">{user?.username}</span>
                                        <span className="text-xs font-normal text-muted-foreground">School: {schoolCode}</span>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                    onClick={handleLogout}
                                    className="text-destructive focus:text-destructive cursor-pointer"
                                    data-testid="logout-btn"
                                >
                                    <LogOut className="w-4 h-4 mr-2" />
                                    Sign out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </header>

                {/* Page content */}
                <main>
                    {children}
                </main>
            </div>
        </div>
    );
};
