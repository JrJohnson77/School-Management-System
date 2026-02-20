import { useState } from 'react';
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
    FolderInput
} from 'lucide-react';

const NavItem = ({ to, icon: Icon, label, isCollapsed, isActive }) => (
    <Link
        to={to}
        className={`nav-item ${isActive ? 'active' : ''} ${isCollapsed ? 'justify-center px-3' : ''}`}
        data-testid={`nav-${label.toLowerCase().replace(/\s/g, '-')}`}
    >
        <Icon className="w-5 h-5 flex-shrink-0" />
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

    const getRoleBadgeColor = (role) => {
        switch (role) {
            case 'superuser': return 'bg-purple-100 text-purple-700';
            case 'admin': return 'bg-destructive/10 text-destructive';
            case 'teacher': return 'bg-primary/10 text-primary';
            case 'parent': return 'bg-accent/10 text-accent';
            default: return 'bg-muted text-muted-foreground';
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
                    <div className="flex items-center justify-between p-4 border-b border-border/50">
                        <Link to="/dashboard" className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                                <GraduationCap className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="font-extrabold text-primary text-lg">EduManager</h1>
                                <p className="text-xs text-muted-foreground">{schoolCode}</p>
                            </div>
                        </Link>
                        <button 
                            className="md:hidden p-2 hover:bg-muted rounded-lg"
                            onClick={() => setSidebarOpen(false)}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                        {filteredNavItems.map((item) => (
                            <NavItem
                                key={item.to}
                                {...item}
                                isActive={location.pathname === item.to}
                            />
                        ))}
                    </nav>

                    {/* User section */}
                    <div className="p-4 border-t border-border/50">
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                            <Avatar className="w-10 h-10">
                                <AvatarFallback className={`font-bold ${getRoleBadgeColor(user?.role)}`}>
                                    {getInitials(user?.name)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm truncate">{user?.name}</p>
                                <div className="flex items-center gap-1">
                                    {user?.role === 'superuser' && <Shield className="w-3 h-3 text-purple-600" />}
                                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${getRoleBadgeColor(user?.role)}`}>
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
                <header className="flex items-center justify-between mb-8">
                    <button
                        className="md:hidden p-2 hover:bg-muted rounded-xl"
                        onClick={() => setSidebarOpen(true)}
                        data-testid="mobile-menu-btn"
                    >
                        <Menu className="w-6 h-6" />
                    </button>

                    <div className="flex-1 md:flex-none" />

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button 
                                variant="ghost" 
                                className="flex items-center gap-2 rounded-full"
                                data-testid="user-menu-btn"
                            >
                                <Avatar className="w-8 h-8">
                                    <AvatarFallback className={`text-sm font-bold ${getRoleBadgeColor(user?.role)}`}>
                                        {getInitials(user?.name)}
                                    </AvatarFallback>
                                </Avatar>
                                <span className="hidden md:inline font-medium">{user?.name}</span>
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-xl">
                            <DropdownMenuLabel>
                                <div className="flex flex-col">
                                    <span>{user?.name}</span>
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
                </header>

                {/* Page content */}
                <main>
                    {children}
                </main>
            </div>
        </div>
    );
};
