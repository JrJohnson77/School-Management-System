import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { 
    Plus, 
    Search, 
    Edit2, 
    Trash2, 
    Building2,
    Loader2,
    Users,
    GraduationCap,
    FileText
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const initialFormData = {
    school_code: '',
    name: '',
    address: '',
    phone: '',
    email: '',
    logo_url: '',
    is_active: true
};

export default function SchoolsPage() {
    const [schools, setSchools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingSchool, setEditingSchool] = useState(null);
    const [formData, setFormData] = useState(initialFormData);
    const [submitting, setSubmitting] = useState(false);
    const { isSuperuser } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        fetchSchools();
    }, []);

    const fetchSchools = async () => {
        try {
            const response = await axios.get(`${API}/schools`);
            setSchools(response.data);
        } catch (error) {
            toast.error('Failed to load schools');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        
        try {
            if (editingSchool) {
                await axios.put(`${API}/schools/${editingSchool.id}`, formData);
                toast.success('School updated successfully');
            } else {
                await axios.post(`${API}/schools`, formData);
                toast.success('School created successfully');
            }
            setIsDialogOpen(false);
            setEditingSchool(null);
            setFormData(initialFormData);
            fetchSchools();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to save school');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (school) => {
        setEditingSchool(school);
        setFormData({
            school_code: school.school_code,
            name: school.name,
            address: school.address || '',
            phone: school.phone || '',
            email: school.email || '',
            logo_url: school.logo_url || '',
            is_active: school.is_active
        });
        setIsDialogOpen(true);
    };

    const handleDelete = async (schoolId) => {
        if (!window.confirm('Are you sure you want to delete this school? This will affect all associated data.')) return;
        
        try {
            await axios.delete(`${API}/schools/${schoolId}`);
            toast.success('School deleted');
            fetchSchools();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to delete school');
        }
    };

    const filteredSchools = schools.filter(s => 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.school_code.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!isSuperuser) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <p className="text-muted-foreground">Access denied. Superuser privileges required.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div data-testid="schools-page">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold text-foreground">School Management</h1>
                    <p className="text-muted-foreground">Create and manage school accounts</p>
                </div>
                
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) {
                        setEditingSchool(null);
                        setFormData(initialFormData);
                    }
                }}>
                    <DialogTrigger asChild>
                        <Button className="rounded-full shadow-md" data-testid="add-school-btn">
                            <Plus className="w-5 h-5 mr-2" />
                            Add School
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg rounded-3xl">
                        <DialogHeader>
                            <DialogTitle>
                                {editingSchool ? 'Edit School' : 'Create New School'}
                            </DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>School Code *</Label>
                                    <Input
                                        value={formData.school_code}
                                        onChange={(e) => setFormData({ ...formData, school_code: e.target.value.toUpperCase() })}
                                        className="rounded-xl uppercase"
                                        placeholder="e.g., ABC123"
                                        required
                                        disabled={!!editingSchool}
                                        data-testid="school-code-input"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>School Name *</Label>
                                    <Input
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="rounded-xl"
                                        placeholder="School name"
                                        required
                                        data-testid="school-name-input"
                                    />
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <Label>Address</Label>
                                <Input
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    className="rounded-xl"
                                    placeholder="School address"
                                    data-testid="school-address-input"
                                />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Phone</Label>
                                    <Input
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="rounded-xl"
                                        placeholder="Phone number"
                                        data-testid="school-phone-input"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Email</Label>
                                    <Input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="rounded-xl"
                                        placeholder="school@example.com"
                                        data-testid="school-email-input"
                                    />
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
                                <div>
                                    <Label>Active Status</Label>
                                    <p className="text-sm text-muted-foreground">Enable or disable school access</p>
                                </div>
                                <Switch
                                    checked={formData.is_active}
                                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                                    data-testid="school-active-switch"
                                />
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
                                    data-testid="save-school-btn"
                                >
                                    {submitting ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        editingSchool ? 'Update School' : 'Create School'
                                    )}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Search */}
            <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                    placeholder="Search schools..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 rounded-xl h-12"
                    data-testid="search-schools-input"
                />
            </div>

            {/* Schools Grid */}
            {filteredSchools.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredSchools.map((school, index) => (
                        <Card 
                            key={school.id}
                            className={`rounded-3xl border-border/50 shadow-sm card-hover opacity-0 animate-fade-in ${!school.is_active ? 'opacity-60' : ''}`}
                            style={{ animationDelay: `${index * 50}ms` }}
                            data-testid={`school-card-${school.id}`}
                        >
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                                        <Building2 className="w-7 h-7 text-primary" />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                                            school.is_active 
                                                ? 'bg-green-100 text-green-700' 
                                                : 'bg-red-100 text-red-700'
                                        }`}>
                                            {school.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="mb-4">
                                    <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary font-mono font-bold">
                                        {school.school_code}
                                    </span>
                                </div>
                                
                                <h3 className="font-bold text-xl mb-2">{school.name}</h3>
                                
                                {school.address && (
                                    <p className="text-sm text-muted-foreground mb-2">{school.address}</p>
                                )}
                                
                                <div className="space-y-1 text-sm text-muted-foreground">
                                    {school.phone && <p>📞 {school.phone}</p>}
                                    {school.email && <p>✉️ {school.email}</p>}
                                </div>
                                
                                {school.school_code !== 'JTECH' && (
                                    <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="flex-1 rounded-full"
                                            onClick={() => navigate(`/report-template?school=${school.school_code}`)}
                                            data-testid={`design-template-${school.id}`}
                                        >
                                            <FileText className="w-4 h-4 mr-1" />
                                            Template
                                        </Button>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="flex-1 rounded-full"
                                            onClick={() => handleEdit(school)}
                                            data-testid={`edit-school-${school.id}`}
                                        >
                                            <Edit2 className="w-4 h-4 mr-1" />
                                            Edit
                                        </Button>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="rounded-full text-destructive hover:bg-destructive/10"
                                            onClick={() => handleDelete(school.id)}
                                            data-testid={`delete-school-${school.id}`}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card className="rounded-3xl border-border/50 shadow-sm">
                    <CardContent className="py-16">
                        <div className="empty-state">
                            <Building2 className="empty-state-icon" />
                            <h3 className="text-lg font-semibold mb-2">No schools found</h3>
                            <p className="text-muted-foreground">
                                {searchQuery 
                                    ? 'Try adjusting your search query' 
                                    : 'Create your first school to get started'}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
