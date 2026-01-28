import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { 
    Plus, 
    Search, 
    Edit2, 
    Trash2, 
    GraduationCap,
    Loader2,
    User,
    Calendar,
    MapPin,
    Phone
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const initialFormData = {
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: '',
    grade_level: '',
    class_id: '',
    parent_id: '',
    address: '',
    emergency_contact: '',
    notes: ''
};

export default function StudentsPage() {
    const [students, setStudents] = useState([]);
    const [classes, setClasses] = useState([]);
    const [parents, setParents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [formData, setFormData] = useState(initialFormData);
    const [submitting, setSubmitting] = useState(false);
    const { isAdmin, isTeacher, isParent } = useAuth();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [studentsRes, classesRes] = await Promise.all([
                axios.get(`${API}/students`),
                axios.get(`${API}/classes`).catch(() => ({ data: [] }))
            ]);
            setStudents(studentsRes.data);
            setClasses(classesRes.data);
            
            if (isAdmin || isTeacher) {
                const parentsRes = await axios.get(`${API}/parents`).catch(() => ({ data: [] }));
                setParents(parentsRes.data);
            }
        } catch (error) {
            toast.error('Failed to load students');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        
        try {
            if (editingStudent) {
                await axios.put(`${API}/students/${editingStudent.id}`, formData);
                toast.success('Student updated successfully');
            } else {
                await axios.post(`${API}/students`, formData);
                toast.success('Student added successfully');
            }
            setIsDialogOpen(false);
            setEditingStudent(null);
            setFormData(initialFormData);
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to save student');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (student) => {
        setEditingStudent(student);
        setFormData({
            first_name: student.first_name,
            last_name: student.last_name,
            date_of_birth: student.date_of_birth,
            gender: student.gender,
            grade_level: student.grade_level,
            class_id: student.class_id || '',
            parent_id: student.parent_id || '',
            address: student.address || '',
            emergency_contact: student.emergency_contact || '',
            notes: student.notes || ''
        });
        setIsDialogOpen(true);
    };

    const handleDelete = async (studentId) => {
        if (!window.confirm('Are you sure you want to delete this student?')) return;
        
        try {
            await axios.delete(`${API}/students/${studentId}`);
            toast.success('Student deleted');
            fetchData();
        } catch (error) {
            toast.error('Failed to delete student');
        }
    };

    const filteredStudents = students.filter(s => 
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.grade_level.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getClassName = (classId) => {
        const cls = classes.find(c => c.id === classId);
        return cls?.name || '-';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div data-testid="students-page">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold text-foreground">Students</h1>
                    <p className="text-muted-foreground">
                        {isParent ? 'View your children\'s information' : 'Manage student records'}
                    </p>
                </div>
                
                {(isAdmin || isTeacher) && (
                    <Dialog open={isDialogOpen} onOpenChange={(open) => {
                        setIsDialogOpen(open);
                        if (!open) {
                            setEditingStudent(null);
                            setFormData(initialFormData);
                        }
                    }}>
                        <DialogTrigger asChild>
                            <Button className="rounded-full shadow-md" data-testid="add-student-btn">
                                <Plus className="w-5 h-5 mr-2" />
                                Add Student
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl rounded-3xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>
                                    {editingStudent ? 'Edit Student' : 'Add New Student'}
                                </DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>First Name *</Label>
                                        <Input
                                            value={formData.first_name}
                                            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                            className="rounded-xl"
                                            required
                                            data-testid="student-first-name-input"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Last Name *</Label>
                                        <Input
                                            value={formData.last_name}
                                            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                            className="rounded-xl"
                                            required
                                            data-testid="student-last-name-input"
                                        />
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Date of Birth *</Label>
                                        <Input
                                            type="date"
                                            value={formData.date_of_birth}
                                            onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                                            className="rounded-xl"
                                            required
                                            data-testid="student-dob-input"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Gender *</Label>
                                        <Select 
                                            value={formData.gender}
                                            onValueChange={(value) => setFormData({ ...formData, gender: value })}
                                        >
                                            <SelectTrigger className="rounded-xl" data-testid="student-gender-select">
                                                <SelectValue placeholder="Select gender" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Male">Male</SelectItem>
                                                <SelectItem value="Female">Female</SelectItem>
                                                <SelectItem value="Other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Grade Level *</Label>
                                        <Select 
                                            value={formData.grade_level}
                                            onValueChange={(value) => setFormData({ ...formData, grade_level: value })}
                                        >
                                            <SelectTrigger className="rounded-xl" data-testid="student-grade-select">
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
                                        <Label>Class</Label>
                                        <Select 
                                            value={formData.class_id}
                                            onValueChange={(value) => setFormData({ ...formData, class_id: value })}
                                        >
                                            <SelectTrigger className="rounded-xl" data-testid="student-class-select">
                                                <SelectValue placeholder="Select class" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="">No class</SelectItem>
                                                {classes.map(cls => (
                                                    <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Parent/Guardian</Label>
                                    <Select 
                                        value={formData.parent_id}
                                        onValueChange={(value) => setFormData({ ...formData, parent_id: value })}
                                    >
                                        <SelectTrigger className="rounded-xl" data-testid="student-parent-select">
                                            <SelectValue placeholder="Select parent" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="">No parent assigned</SelectItem>
                                            {parents.map(parent => (
                                                <SelectItem key={parent.id} value={parent.id}>{parent.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                
                                <div className="space-y-2">
                                    <Label>Address</Label>
                                    <Input
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                        className="rounded-xl"
                                        data-testid="student-address-input"
                                    />
                                </div>
                                
                                <div className="space-y-2">
                                    <Label>Emergency Contact</Label>
                                    <Input
                                        value={formData.emergency_contact}
                                        onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                                        className="rounded-xl"
                                        placeholder="Phone number"
                                        data-testid="student-emergency-input"
                                    />
                                </div>
                                
                                <div className="space-y-2">
                                    <Label>Notes</Label>
                                    <Textarea
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        className="rounded-xl"
                                        rows={3}
                                        data-testid="student-notes-input"
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
                                        data-testid="save-student-btn"
                                    >
                                        {submitting ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            editingStudent ? 'Update Student' : 'Add Student'
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
                    placeholder="Search students..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 rounded-xl h-12"
                    data-testid="search-students-input"
                />
            </div>

            {/* Students Grid */}
            {filteredStudents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredStudents.map((student, index) => (
                        <Card 
                            key={student.id}
                            className="rounded-3xl border-border/50 shadow-sm card-hover opacity-0 animate-fade-in"
                            style={{ animationDelay: `${index * 50}ms` }}
                            data-testid={`student-card-${student.id}`}
                        >
                            <CardContent className="p-6">
                                <div className="flex items-start gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                                        {student.first_name?.[0]}{student.last_name?.[0]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-lg truncate">
                                            {student.first_name} {student.last_name}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                                                Grade {student.grade_level}
                                            </span>
                                            <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                                                {student.gender}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="mt-4 space-y-2 text-sm">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Calendar className="w-4 h-4" />
                                        <span>{student.date_of_birth}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <GraduationCap className="w-4 h-4" />
                                        <span>{getClassName(student.class_id)}</span>
                                    </div>
                                    {student.emergency_contact && (
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Phone className="w-4 h-4" />
                                            <span>{student.emergency_contact}</span>
                                        </div>
                                    )}
                                </div>
                                
                                {(isAdmin || isTeacher) && (
                                    <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="flex-1 rounded-full"
                                            onClick={() => handleEdit(student)}
                                            data-testid={`edit-student-${student.id}`}
                                        >
                                            <Edit2 className="w-4 h-4 mr-1" />
                                            Edit
                                        </Button>
                                        {isAdmin && (
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="rounded-full text-destructive hover:bg-destructive/10"
                                                onClick={() => handleDelete(student.id)}
                                                data-testid={`delete-student-${student.id}`}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        )}
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
                            <GraduationCap className="empty-state-icon" />
                            <h3 className="text-lg font-semibold mb-2">No students found</h3>
                            <p className="text-muted-foreground">
                                {searchQuery 
                                    ? 'Try adjusting your search query' 
                                    : isParent 
                                        ? 'No children assigned to your account' 
                                        : 'Add your first student to get started'}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
