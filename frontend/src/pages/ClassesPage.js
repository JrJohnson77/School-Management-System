import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { 
    Plus, 
    Search, 
    Edit2, 
    Trash2, 
    School,
    Loader2,
    Users,
    User,
    MapPin
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const initialFormData = {
    name: '',
    grade_level: '',
    teacher_id: '',
    room_number: '',
    academic_year: new Date().getFullYear().toString()
};

export default function ClassesPage() {
    const [classes, setClasses] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingClass, setEditingClass] = useState(null);
    const [formData, setFormData] = useState(initialFormData);
    const [submitting, setSubmitting] = useState(false);
    const { isAdmin, isTeacher, user } = useAuth();
    
    // Check if user has manage_classes permission
    const canManageClasses = isAdmin || (isTeacher && user?.permissions?.includes('manage_classes'));

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [classesRes, studentsRes] = await Promise.all([
                axios.get(`${API}/classes`),
                axios.get(`${API}/students`)
            ]);
            setClasses(classesRes.data);
            setStudents(studentsRes.data);
            
            if (isAdmin || isTeacher) {
                const teachersRes = await axios.get(`${API}/teachers`).catch(() => ({ data: [] }));
                setTeachers(teachersRes.data);
            }
        } catch (error) {
            toast.error('Failed to load classes');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        
        // Convert "none" values back to empty strings for backend
        const submitData = {
            ...formData,
            teacher_id: formData.teacher_id === 'none' ? '' : formData.teacher_id,
        };
        
        try {
            if (editingClass) {
                await axios.put(`${API}/classes/${editingClass.id}`, submitData);
                toast.success('Class updated successfully');
            } else {
                await axios.post(`${API}/classes`, submitData);
                toast.success('Class created successfully');
            }
            setIsDialogOpen(false);
            setEditingClass(null);
            setFormData(initialFormData);
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to save class');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (cls) => {
        setEditingClass(cls);
        setFormData({
            name: cls.name,
            grade_level: cls.grade_level,
            teacher_id: cls.teacher_id || '',
            room_number: cls.room_number || '',
            academic_year: cls.academic_year
        });
        setIsDialogOpen(true);
    };

    const handleDelete = async (classId) => {
        if (!window.confirm('Are you sure you want to delete this class?')) return;
        
        try {
            await axios.delete(`${API}/classes/${classId}`);
            toast.success('Class deleted');
            fetchData();
        } catch (error) {
            toast.error('Failed to delete class');
        }
    };

    const getStudentCount = (classId) => {
        return students.filter(s => s.class_id === classId).length;
    };

    const getTeacherName = (teacherId) => {
        const teacher = teachers.find(t => t.id === teacherId);
        return teacher?.name || 'Not assigned';
    };

    const filteredClasses = classes.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.grade_level.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div data-testid="classes-page">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold text-foreground">Classes</h1>
                    <p className="text-muted-foreground">Manage class assignments and schedules</p>
                </div>
                
                {canManageClasses && (
                    <Dialog open={isDialogOpen} onOpenChange={(open) => {
                        setIsDialogOpen(open);
                        if (!open) {
                            setEditingClass(null);
                            setFormData(initialFormData);
                        }
                    }}>
                        <DialogTrigger asChild>
                            <Button className="rounded-full shadow-md" data-testid="add-class-btn">
                                <Plus className="w-5 h-5 mr-2" />
                                Add Class
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-3xl">
                            <DialogHeader>
                                <DialogTitle>
                                    {editingClass ? 'Edit Class' : 'Create New Class'}
                                </DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <Label>Class Name *</Label>
                                    <Input
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="rounded-xl"
                                        placeholder="e.g., Class 1A"
                                        required
                                        data-testid="class-name-input"
                                    />
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Grade Level *</Label>
                                        <Select 
                                            value={formData.grade_level}
                                            onValueChange={(value) => setFormData({ ...formData, grade_level: value })}
                                        >
                                            <SelectTrigger className="rounded-xl" data-testid="class-grade-select">
                                                <SelectValue placeholder="Select grade" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {['K', '1', '2', '3', '4', '5', '6'].map(grade => (
                                                    <SelectItem key={grade} value={grade}>Grade {grade}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Academic Year *</Label>
                                        <Select 
                                            value={formData.academic_year}
                                            onValueChange={(value) => setFormData({ ...formData, academic_year: value })}
                                        >
                                            <SelectTrigger className="rounded-xl" data-testid="class-year-select">
                                                <SelectValue placeholder="Select year" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {[2024, 2025, 2026].map(year => (
                                                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                
                                <div className="space-y-2">
                                    <Label>Assigned Teacher</Label>
                                    <Select 
                                        value={formData.teacher_id}
                                        onValueChange={(value) => setFormData({ ...formData, teacher_id: value })}
                                    >
                                        <SelectTrigger className="rounded-xl" data-testid="class-teacher-select">
                                            <SelectValue placeholder="Select teacher" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">No teacher assigned</SelectItem>
                                            {teachers.map(teacher => (
                                                <SelectItem key={teacher.id} value={teacher.id}>{teacher.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                
                                <div className="space-y-2">
                                    <Label>Room Number</Label>
                                    <Input
                                        value={formData.room_number}
                                        onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                                        className="rounded-xl"
                                        placeholder="e.g., Room 101"
                                        data-testid="class-room-input"
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
                                        data-testid="save-class-btn"
                                    >
                                        {submitting ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            editingClass ? 'Update Class' : 'Create Class'
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {/* Search */}
            <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                    placeholder="Search classes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 rounded-xl h-12"
                    data-testid="search-classes-input"
                />
            </div>

            {/* Classes Grid */}
            {filteredClasses.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredClasses.map((cls, index) => (
                        <Card 
                            key={cls.id}
                            className="rounded-3xl border-border/50 shadow-sm card-hover opacity-0 animate-fade-in"
                            style={{ animationDelay: `${index * 50}ms` }}
                            data-testid={`class-card-${cls.id}`}
                        >
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-14 h-14 rounded-2xl bg-secondary/20 flex items-center justify-center">
                                        <School className="w-7 h-7 text-secondary-foreground" />
                                    </div>
                                    <span className="text-xs px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">
                                        Grade {cls.grade_level}
                                    </span>
                                </div>
                                
                                <h3 className="font-bold text-xl mb-1">{cls.name}</h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Academic Year {cls.academic_year}
                                </p>
                                
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <User className="w-4 h-4" />
                                        <span>{getTeacherName(cls.teacher_id)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Users className="w-4 h-4" />
                                        <span>{getStudentCount(cls.id)} students</span>
                                    </div>
                                    {cls.room_number && (
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <MapPin className="w-4 h-4" />
                                            <span>{cls.room_number}</span>
                                        </div>
                                    )}
                                </div>
                                
                                {canManageClasses && (
                                    <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="flex-1 rounded-full"
                                            onClick={() => handleEdit(cls)}
                                            data-testid={`edit-class-${cls.id}`}
                                        >
                                            <Edit2 className="w-4 h-4 mr-1" />
                                            Edit
                                        </Button>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="rounded-full text-destructive hover:bg-destructive/10"
                                            onClick={() => handleDelete(cls.id)}
                                            data-testid={`delete-class-${cls.id}`}
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
                            <School className="empty-state-icon" />
                            <h3 className="text-lg font-semibold mb-2">No classes found</h3>
                            <p className="text-muted-foreground">
                                {searchQuery 
                                    ? 'Try adjusting your search query' 
                                    : 'Create your first class to get started'}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
