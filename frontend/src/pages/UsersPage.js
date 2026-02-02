import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog';
import { toast } from 'sonner';
import { 
    Plus,
    Search, 
    Trash2, 
    Users,
    Loader2,
    Shield,
    User,
    GraduationCap,
    UserCheck,
    Edit2,
    Upload,
    X,
    KeyRound
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const roleConfig = {
    superuser: { label: 'Superuser', icon: Shield, color: 'bg-purple-100 text-purple-700' },
    admin: { label: 'Admin', icon: Shield, color: 'bg-destructive/10 text-destructive' },
    teacher: { label: 'Teacher', icon: GraduationCap, color: 'bg-primary/10 text-primary' },
    parent: { label: 'Parent', icon: User, color: 'bg-accent/10 text-accent' }
};

const ALL_PERMISSIONS = [
    { key: 'manage_schools', label: 'Manage Schools', description: 'Create, edit, delete schools' },
    { key: 'manage_users', label: 'Manage Users', description: 'Create, edit, delete users' },
    { key: 'manage_students', label: 'Manage Students', description: 'Create, edit, delete students' },
    { key: 'manage_classes', label: 'Manage Classes', description: 'Create, edit, delete classes' },
    { key: 'manage_attendance', label: 'Manage Attendance', description: 'Mark and edit attendance' },
    { key: 'manage_grades', label: 'Manage Grades', description: 'Enter and edit grades' },
    { key: 'view_reports', label: 'View Reports', description: 'View report cards' },
    { key: 'generate_reports', label: 'Generate Reports', description: 'Generate report cards' },
];

const initialFormData = {
    username: '',
    name: '',
    password: '',
    role: 'teacher',
    permissions: [],
    photo_url: ''
};

export default function UsersPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterRole, setFilterRole] = useState('all');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState(initialFormData);
    const [submitting, setSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);
    const { user: currentUser, isSuperuser, schoolCode } = useAuth();

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

    const handlePhotoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            toast.error('Invalid file type. Please upload a JPG, PNG, GIF, or WebP image.');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error('File too large. Maximum size is 5MB.');
            return;
        }

        setUploading(true);
        try {
            const formDataUpload = new FormData();
            formDataUpload.append('file', file);

            const response = await axios.post(`${API}/upload/photo`, formDataUpload, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setFormData(prev => ({ ...prev, photo_url: response.data.photo_url }));
            toast.success('Photo uploaded successfully');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to upload photo');
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        
        try {
            if (editingUser) {
                // Update role and permissions
                await axios.put(`${API}/users/${editingUser.id}/role`, {
                    role: formData.role,
                    permissions: formData.permissions
                });
                toast.success('User updated successfully');
            } else {
                // Create new user
                await axios.post(`${API}/users`, {
                    ...formData,
                    school_code: schoolCode
                });
                toast.success('User created successfully');
            }
            setIsDialogOpen(false);
            setEditingUser(null);
            setFormData(initialFormData);
            fetchUsers();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to save user');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (user) => {
        setEditingUser(user);
        setFormData({
            username: user.username,
            name: user.name,
            password: '',
            role: user.role,
            permissions: user.permissions || [],
            photo_url: user.photo_url || ''
        });
        setIsDialogOpen(true);
    };

    // Reset credentials dialog state
    const [resetDialogOpen, setResetDialogOpen] = useState(false);
    const [resetUser, setResetUser] = useState(null);
    const [resetData, setResetData] = useState({ username: '', password: '' });
    const [resetting, setResetting] = useState(false);

    const handleResetCredentials = (user) => {
        setResetUser(user);
        setResetData({ username: user.username, password: '' });
        setResetDialogOpen(true);
    };

    const submitResetCredentials = async () => {
        if (!resetData.username && !resetData.password) {
            toast.error('Please provide username or password to reset');
            return;
        }
        
        setResetting(true);
        try {
            const payload = {};
            if (resetData.username && resetData.username !== resetUser.username) {
                payload.username = resetData.username;
            }
            if (resetData.password) {
                payload.password = resetData.password;
            }
            
            if (Object.keys(payload).length === 0) {
                toast.error('No changes to save');
                setResetting(false);
                return;
            }
            
            await axios.put(`${API}/users/${resetUser.id}/credentials`, payload);
            toast.success('Credentials updated successfully');
            setResetDialogOpen(false);
            setResetUser(null);
            setResetData({ username: '', password: '' });
            fetchUsers();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to reset credentials');
        } finally {
            setResetting(false);
        }
    };

    const handleDelete = async (userId) => {
        try {
            await axios.delete(`${API}/users/${userId}`);
            toast.success('User deleted');
            fetchUsers();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to delete user');
        }
    };

    const togglePermission = (permission) => {
        setFormData(prev => ({
            ...prev,
            permissions: prev.permissions.includes(permission)
                ? prev.permissions.filter(p => p !== permission)
                : [...prev.permissions, permission]
        }));
    };

    const filteredUsers = users.filter(u => {
        const matchesSearch = u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             u.username?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesRole = filterRole === 'all' || u.role === filterRole;
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold text-foreground">User Management</h1>
                    <p className="text-muted-foreground">Manage user accounts and permissions</p>
                </div>
                
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) {
                        setEditingUser(null);
                        setFormData(initialFormData);
                    }
                }}>
                    <DialogTrigger asChild>
                        <Button className="rounded-full shadow-md" data-testid="add-user-btn">
                            <Plus className="w-5 h-5 mr-2" />
                            Add User
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg rounded-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>
                                {editingUser ? 'Edit User' : 'Create New User'}
                            </DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                            {!editingUser && (
                                <>
                                    {/* Photo Upload */}
                                    <div className="flex items-center gap-4">
                                        <div className="relative w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden group">
                                            {formData.photo_url ? (
                                                <>
                                                    <img 
                                                        src={formData.photo_url.startsWith('/api') ? `${process.env.REACT_APP_BACKEND_URL}${formData.photo_url}` : formData.photo_url}
                                                        alt="User" 
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => { e.target.style.display = 'none'; }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, photo_url: '' })}
                                                        className="absolute top-0 right-0 w-6 h-6 bg-destructive text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </>
                                            ) : (
                                                <User className="w-8 h-8 text-primary" />
                                            )}
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <Label>Staff Photo</Label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="file"
                                                    ref={fileInputRef}
                                                    onChange={handlePhotoUpload}
                                                    accept="image/jpeg,image/png,image/gif,image/webp"
                                                    className="hidden"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="rounded-xl"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    disabled={uploading}
                                                    data-testid="upload-user-photo-btn"
                                                >
                                                    {uploading ? (
                                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    ) : (
                                                        <Upload className="w-4 h-4 mr-2" />
                                                    )}
                                                    {uploading ? 'Uploading...' : 'Upload'}
                                                </Button>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                JPG, PNG, GIF or WebP. Max 5MB.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Username *</Label>
                                        <Input
                                            value={formData.username}
                                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                            className="rounded-xl"
                                            placeholder="Enter username"
                                            required
                                            data-testid="user-username-input"
                                        />
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <Label>Full Name *</Label>
                                        <Input
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="rounded-xl"
                                            placeholder="Enter full name"
                                            required
                                            data-testid="user-name-input"
                                        />
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <Label>Password *</Label>
                                        <Input
                                            type="password"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            className="rounded-xl"
                                            placeholder="Enter password"
                                            required={!editingUser}
                                            data-testid="user-password-input"
                                        />
                                    </div>
                                </>
                            )}
                            
                            <div className="space-y-2">
                                <Label>Role *</Label>
                                <Select 
                                    value={formData.role}
                                    onValueChange={(value) => setFormData({ ...formData, role: value })}
                                >
                                    <SelectTrigger className="rounded-xl" data-testid="user-role-select">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {isSuperuser && <SelectItem value="superuser">Superuser</SelectItem>}
                                        <SelectItem value="admin">Admin</SelectItem>
                                        <SelectItem value="teacher">Teacher</SelectItem>
                                        <SelectItem value="parent">Parent</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div className="space-y-3">
                                <Label>Permissions</Label>
                                <div className="space-y-2 max-h-48 overflow-y-auto p-3 bg-muted/30 rounded-xl">
                                    {ALL_PERMISSIONS.map((perm) => (
                                        <div 
                                            key={perm.key}
                                            className="flex items-start gap-3 p-2 hover:bg-muted/50 rounded-lg"
                                        >
                                            <Checkbox
                                                id={perm.key}
                                                checked={formData.permissions.includes(perm.key)}
                                                onCheckedChange={() => togglePermission(perm.key)}
                                                disabled={perm.key === 'manage_schools' && !isSuperuser}
                                            />
                                            <div className="flex-1">
                                                <label htmlFor={perm.key} className="text-sm font-medium cursor-pointer">
                                                    {perm.label}
                                                </label>
                                                <p className="text-xs text-muted-foreground">{perm.description}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="flex gap-3 pt-4">
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    className="flex-1 rounded-full"
                                    onClick={() => setIsDialogOpen(false)}
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    type="submit" 
                                    className="flex-1 rounded-full"
                                    disabled={submitting}
                                    data-testid="save-user-btn"
                                >
                                    {submitting ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        editingUser ? 'Update User' : 'Create User'
                                    )}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
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
                {['admin', 'teacher', 'parent'].map((role) => {
                    const config = roleConfig[role];
                    return (
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
                    );
                })}
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
                                    <th>Username</th>
                                    <th>Role</th>
                                    <th>Permissions</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map((user, index) => {
                                    const config = roleConfig[user.role] || roleConfig.parent;
                                    const isCurrentUser = user.id === currentUser?.id;
                                    const canModify = isSuperuser || (user.role !== 'superuser' && user.role !== 'admin');
                                    
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
                                            <td className="text-muted-foreground">{user.username}</td>
                                            <td>
                                                <span className={`text-xs px-3 py-1 rounded-full capitalize ${config.color}`}>
                                                    {user.role === 'superuser' && <Shield className="w-3 h-3 inline mr-1" />}
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="text-xs text-muted-foreground">
                                                    {user.permissions?.length || 0} permissions
                                                </span>
                                            </td>
                                            <td>
                                                <div className="flex gap-1">
                                                    {canModify && !isCurrentUser && (
                                                        <>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm"
                                                                onClick={() => handleEdit(user)}
                                                                data-testid={`edit-user-${user.id}`}
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </Button>
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
                                                        </>
                                                    )}
                                                </div>
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
