import React, { useState, useEffect } from 'react';
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
    ChevronRight,
    Shield,
    FolderInput,
    UserPlus,
    Activity,
    AlertTriangle,
    RefreshCw,
    Settings,
} from 'lucide-react';

const SIDEBAR_STORAGE_KEY = 'lumina_sidebar_open_groups';

// FACTS-style grouped sidebar configuration.
// Each group has a label, an icon, and a list of items.
// `roles` on the item gates visibility per role.
const NAV_GROUPS = [
    {
        key: 'overview',
        label: 'Overview',
        icon: LayoutDashboard,
        items: [
            { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['superuser', 'admin', 'teacher', 'parent'] },
        ],
    },
    {
        key: 'admissions',
        label: 'Admissions',
        icon: UserPlus,
        items: [
            { to: '/admissions', label: 'Inquiries & Applications', icon: UserPlus, roles: ['superuser', 'admin'] },
            { to: '/re-enrollment', label: 'Re-Enrollment', icon: RefreshCw, roles: ['superuser', 'admin'] },
        ],
    },
    {
        key: 'people',
        label: 'People',
        icon: Users,
        items: [
            { to: '/students', label: 'Students', icon: GraduationCap, roles: ['superuser', 'admin', 'teacher', 'parent'] },
            { to: '/users', label: 'Staff & Users', icon: Users, roles: ['superuser', 'admin'] },
        ],
    },
    {
        key: 'academics',
        label: 'Academics',
        icon: BookOpen,
        items: [
            { to: '/classes', label: 'Classes', icon: School, roles: ['superuser', 'admin', 'teacher'] },
            { to: '/attendance', label: 'Attendance', icon: CalendarCheck, roles: ['superuser', 'admin', 'teacher', 'parent'] },
            { to: '/gradebook', label: 'Gradebook', icon: BookOpen, roles: ['superuser', 'admin', 'teacher', 'parent'] },
            { to: '/report-cards', label: 'Report Cards', icon: FileText, roles: ['superuser', 'admin', 'teacher'] },
        ],
    },
    {
        key: 'student_services',
        label: 'Student Services',
        icon: Activity,
        items: [
            { to: '/health', label: 'Health Records', icon: Activity, roles: ['superuser', 'admin', 'teacher'] },
            { to: '/discipline', label: 'Discipline', icon: AlertTriangle, roles: ['superuser', 'admin', 'teacher'] },
        ],
    },
    {
        key: 'admin',
        label: 'Administration',
        icon: Settings,
        items: [
            { to: '/schools', label: 'Schools', icon: Building2, roles: ['superuser'] },
            { to: '/import-export', label: 'Import / Export', icon: FolderInput, roles: ['superuser', 'admin'] },
            { to: '/report-template', label: 'Report Designer', icon: FileText, roles: ['superuser'] },
        ],
    },
];

const getInitials = (name) =>
    name
        ?.split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || '??';

const getRoleBadgeStyle = (role) => {
    switch (role) {
        case 'superuser':
            return 'bg-violet-500/20 text-violet-300';
        case 'admin':
            return 'bg-rose-500/20 text-rose-300';
        case 'teacher':
            return 'bg-sky-500/20 text-sky-300';
        case 'parent':
            return 'bg-emerald-500/20 text-emerald-300';
        default:
            return 'bg-slate-500/20 text-slate-300';
    }
};

const getRoleBadgeColor = (role) => {
    switch (role) {
        case 'superuser':
            return 'bg-violet-100 text-violet-700';
        case 'admin':
            return 'bg-rose-100 text-rose-700';
        case 'teacher':
            return 'bg-sky-100 text-sky-700';
        case 'parent':
            return 'bg-emerald-100 text-emerald-700';
        default:
            return 'bg-slate-100 text-slate-600';
    }
};

const NavLink = ({ item, isActive, onNavigate }) => {
    const Icon = item.icon;
    return (
        <Link
            to={item.to}
            onClick={onNavigate}
            className={`nav-item ${isActive ? 'active' : ''}`}
            data-testid={`nav-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`}
        >
            <Icon className="w-[18px] h-[18px] flex-shrink-0" />
            <span>{item.label}</span>
        </Link>
    );
};

const NavGroup = ({ group, isOpen, onToggle, role, currentPath, onNavigate }) => {
    const visibleItems = group.items.filter((item) => item.roles.includes(role));
    if (visibleItems.length === 0) return null;
    const GroupIcon = group.icon;
    const isAnyActive = visibleItems.some((i) => currentPath === i.to);

    return (
        <div className="space-y-1">
            <button
                type="button"
                onClick={() => onToggle(group.key)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                    isAnyActive ? 'text-white' : ''
                }`}
                style={{ color: isAnyActive ? '#fff' : 'hsl(var(--sidebar-muted))' }}
                data-testid={`sidebar-group-${group.key}`}
            >
                <div className="flex items-center gap-2.5">
                    <GroupIcon className="w-4 h-4 flex-shrink-0" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">{group.label}</span>
                </div>
                {isOpen ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                )}
            </button>
            {isOpen && (
                <div className="space-y-0.5 ml-1.5 pl-1.5 border-l" style={{ borderColor: 'hsl(var(--sidebar-fg) / 0.08)' }}>
                    {visibleItems.map((item) => (
                        <NavLink
                            key={item.to}
                            item={item}
                            isActive={currentPath === item.to}
                            onNavigate={onNavigate}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const loadOpenGroups = () => {
    try {
        const raw = localStorage.getItem(SIDEBAR_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return new Set(parsed);
    } catch (_e) {
        // ignore parse errors
    }
    return null;
};

const persistOpenGroups = (groupsSet) => {
    try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(Array.from(groupsSet)));
    } catch (_e) {
        // ignore quota errors
    }
};

export const Layout = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { user, logout, schoolCode } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    // initialize open groups: persisted state OR group containing current route
    const [openGroups, setOpenGroups] = useState(() => {
        const persisted = loadOpenGroups();
        if (persisted) return persisted;
        const active = NAV_GROUPS.find((g) => g.items.some((i) => location.pathname === i.to));
        return new Set(active ? [active.key] : ['overview', 'academics']);
    });

    // Persist any change
    useEffect(() => {
        persistOpenGroups(openGroups);
    }, [openGroups]);

    // When the route changes, ensure its parent group is open
    useEffect(() => {
        const active = NAV_GROUPS.find((g) => g.items.some((i) => location.pathname === i.to));
        if (active && !openGroups.has(active.key)) {
            setOpenGroups((prev) => {
                const next = new Set(prev);
                next.add(active.key);
                return next;
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const toggleGroup = (key) => {
        setOpenGroups((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const closeMobileSidebar = () => setSidebarOpen(false);

    return (
        <div className="min-h-screen bg-background">
            <Toaster position="top-right" richColors />

            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="mobile-overlay opacity-100"
                    onClick={closeMobileSidebar}
                />
            )}

            {/* Sidebar */}
            <aside className={`sidebar ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`} data-testid="sidebar">
                <div className="flex flex-col h-full">
                    {/* Logo */}
                    <div className="flex items-center justify-between px-5 py-5">
                        <Link to="/dashboard" className="flex items-center gap-3" onClick={closeMobileSidebar}>
                            <img src="/lumina-logo.png" alt="Lumina-SIS" className="w-9 h-9 object-contain rounded-lg" />
                            <div>
                                <h1 className="font-extrabold text-white text-base tracking-tight">Lumina-SIS</h1>
                                <p className="text-[11px] font-medium" style={{ color: 'hsl(var(--sidebar-muted))' }}>{schoolCode}</p>
                            </div>
                        </Link>
                        <button
                            className="md:hidden p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                            style={{ color: 'hsl(var(--sidebar-muted))' }}
                            onClick={closeMobileSidebar}
                            data-testid="sidebar-close-btn"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="sidebar-divider" />

                    {/* Grouped Navigation */}
                    <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto" data-testid="sidebar-nav">
                        {NAV_GROUPS.map((group) => (
                            <NavGroup
                                key={group.key}
                                group={group}
                                isOpen={openGroups.has(group.key)}
                                onToggle={toggleGroup}
                                role={user?.role}
                                currentPath={location.pathname}
                                onNavigate={closeMobileSidebar}
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
