import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog';
import { toast } from 'sonner';
import { 
    Search, 
    Trash2, 
    Users,
    Loader2,
    Shield,
    User,
    GraduationCap,
    UserCheck
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const roleConfig = {
    admin: { label: 'Admin', icon: Shield, color: 'bg-destructive/10 text-destructive' },
    teacher: { label: 'Teacher', icon: GraduationCap, color: 'bg-primary/10 text-primary' },
    parent: { label: 'Parent', icon: User, color: 'bg-accent/10 text-accent' }
};

export default function UsersPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterRole, setFilterRole] = useState('');
    const { user: currentUser } = useAuth();

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await axios.get(`${API}/users`);
            setUsers(response.data);
        } catch (error) {
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (userId, newRole) => {
        try {
            await axios.put(`${API}/users/${userId}/role`, { role: newRole });
            toast.success('Role updated successfully');
            fetchUsers();
        } catch (error) {
            toast.error('Failed to update role');
        }
    };

    const handleDelete = async (userId) => {
        try {
            await axios.delete(`${API}/users/${userId}`);
            toast.success('User deleted');
            fetchUsers();
        } catch (error) {
            toast.error('Failed to delete user');
        }
    };

    const filteredUsers = users.filter(u => {
        const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             u.email.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesRole = !filterRole || filterRole === 'all' || u.role === filterRole;
        return matchesSearch && matchesRole;
    });

    const userCounts = {
        total: users.length,
        admin: users.filter(u => u.role === 'admin').length,
        teacher: users.filter(u => u.role === 'teacher').length,
        parent: users.filter(u => u.role === 'parent').length
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div data-testid="users-page">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-extrabold text-foreground">User Management</h1>
                <p className="text-muted-foreground">Manage user accounts and permissions</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <Card className="rounded-2xl border-border/50 shadow-sm">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                            <Users className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{userCounts.total}</p>
                            <p className="text-xs text-muted-foreground">Total Users</p>
                        </div>
                    </CardContent>
                </Card>
                {Object.entries(roleConfig).map(([role, config]) => (
                    <Card key={role} className="rounded-2xl border-border/50 shadow-sm">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${config.color}`}>
                                <config.icon className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{userCounts[role]}</p>
                                <p className="text-xs text-muted-foreground">{config.label}s</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                        placeholder="Search users..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-12 rounded-xl h-12"
                        data-testid="search-users-input"
                    />
                </div>
                <Select value={filterRole} onValueChange={setFilterRole}>
                    <SelectTrigger className="w-full md:w-48 rounded-xl h-12" data-testid="filter-role-select">
                        <SelectValue placeholder="All Roles" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="admin">Admins</SelectItem>
                        <SelectItem value="teacher">Teachers</SelectItem>
                        <SelectItem value="parent">Parents</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Users List */}
            {filteredUsers.length > 0 ? (
                <Card className="rounded-3xl border-border/50 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full data-table">
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Joined</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map((user, index) => {
                                    const config = roleConfig[user.role] || roleConfig.parent;
                                    const isCurrentUser = user.id === currentUser?.id;
                                    
                                    return (
                                        <tr 
                                            key={user.id}
                                            className="opacity-0 animate-fade-in"
                                            style={{ animationDelay: `${index * 30}ms` }}
                                            data-testid={`user-row-${user.id}`}
                                        >
                                            <td>
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${config.color}`}>
                                                        {user.name?.split(' ').map(n => n?.[0] || '').join('').slice(0, 2) || '??'}
                                                    </div>
                                                    <div>
                                                        <span className="font-medium">{user.name}</span>
                                                        {isCurrentUser && (
                                                            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                                                You
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="text-muted-foreground">{user.email}</td>
                                            <td>
                                                <Select 
                                                    value={user.role} 
                                                    onValueChange={(value) => handleRoleChange(user.id, value)}
                                                    disabled={isCurrentUser}
                                                >
                                                    <SelectTrigger 
                                                        className={`w-32 rounded-full h-8 text-xs ${config.color} border-0`}
                                                        data-testid={`role-select-${user.id}`}
                                                    >
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="admin">Admin</SelectItem>
                                                        <SelectItem value="teacher">Teacher</SelectItem>
                                                        <SelectItem value="parent">Parent</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </td>
                                            <td className="text-muted-foreground text-sm">
                                                {new Date(user.created_at).toLocaleDateString()}
                                            </td>
                                            <td>
                                                {!isCurrentUser && (
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm"
                                                                className="text-destructive hover:bg-destructive/10"
                                                                data-testid={`delete-user-${user.id}`}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent className="rounded-2xl">
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Delete User</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Are you sure you want to delete {user.name}? This action cannot be undone.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
                                                                <AlertDialogAction 
                                                                    className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                                    onClick={() => handleDelete(user.id)}
                                                                >
                                                                    Delete
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            ) : (
                <Card className="rounded-3xl border-border/50 shadow-sm">
                    <CardContent className="py-16">
                        <div className="empty-state">
                            <Users className="empty-state-icon" />
                            <h3 className="text-lg font-semibold mb-2">No users found</h3>
                            <p className="text-muted-foreground">
                                Try adjusting your search or filters
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
