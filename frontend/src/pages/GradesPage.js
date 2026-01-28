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
    FileText,
    Loader2,
    TrendingUp,
    Award
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const gradeTypes = ['exam', 'quiz', 'assignment', 'homework'];
const subjects = ['Math', 'English', 'Science', 'Social Studies', 'Art', 'Music', 'Physical Education'];
const terms = ['Term 1', 'Term 2', 'Term 3', 'Final'];

const initialFormData = {
    student_id: '',
    class_id: '',
    subject: '',
    grade_type: '',
    score: '',
    max_score: '100',
    date: new Date().toISOString().split('T')[0],
    term: '',
    comments: ''
};

export default function GradesPage() {
    const [grades, setGrades] = useState([]);
    const [students, setStudents] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterSubject, setFilterSubject] = useState('');
    const [filterTerm, setFilterTerm] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingGrade, setEditingGrade] = useState(null);
    const [formData, setFormData] = useState(initialFormData);
    const [submitting, setSubmitting] = useState(false);
    const { isAdmin, isTeacher, isParent } = useAuth();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [gradesRes, studentsRes, classesRes] = await Promise.all([
                axios.get(`${API}/grades`),
                axios.get(`${API}/students`),
                axios.get(`${API}/classes`).catch(() => ({ data: [] }))
            ]);
            setGrades(gradesRes.data);
            setStudents(studentsRes.data);
            setClasses(classesRes.data);
        } catch (error) {
            toast.error('Failed to load grades');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        
        try {
            const payload = {
                ...formData,
                score: parseFloat(formData.score),
                max_score: parseFloat(formData.max_score)
            };
            
            if (editingGrade) {
                await axios.put(`${API}/grades/${editingGrade.id}`, payload);
                toast.success('Grade updated successfully');
            } else {
                await axios.post(`${API}/grades`, payload);
                toast.success('Grade added successfully');
            }
            setIsDialogOpen(false);
            setEditingGrade(null);
            setFormData(initialFormData);
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to save grade');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (grade) => {
        setEditingGrade(grade);
        setFormData({
            student_id: grade.student_id,
            class_id: grade.class_id,
            subject: grade.subject,
            grade_type: grade.grade_type,
            score: grade.score.toString(),
            max_score: grade.max_score.toString(),
            date: grade.date,
            term: grade.term,
            comments: grade.comments || ''
        });
        setIsDialogOpen(true);
    };

    const handleDelete = async (gradeId) => {
        if (!window.confirm('Are you sure you want to delete this grade?')) return;
        
        try {
            await axios.delete(`${API}/grades/${gradeId}`);
            toast.success('Grade deleted');
            fetchData();
        } catch (error) {
            toast.error('Failed to delete grade');
        }
    };

    const getStudentName = (studentId) => {
        const student = students.find(s => s.id === studentId);
        return student ? `${student.first_name} ${student.last_name}` : 'Unknown';
    };

    const getClassName = (classId) => {
        const cls = classes.find(c => c.id === classId);
        return cls?.name || '-';
    };

    const getGradeColor = (score, maxScore) => {
        const percentage = (score / maxScore) * 100;
        if (percentage >= 90) return 'text-accent';
        if (percentage >= 80) return 'text-primary';
        if (percentage >= 70) return 'text-secondary-foreground';
        if (percentage >= 60) return 'text-orange-500';
        return 'text-destructive';
    };

    const getGradeLetter = (score, maxScore) => {
        const percentage = (score / maxScore) * 100;
        if (percentage >= 90) return 'A';
        if (percentage >= 80) return 'B';
        if (percentage >= 70) return 'C';
        if (percentage >= 60) return 'D';
        return 'F';
    };

    const filteredGrades = grades.filter(g => {
        const studentName = getStudentName(g.student_id).toLowerCase();
        const matchesSearch = studentName.includes(searchQuery.toLowerCase()) || 
                             g.subject.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesSubject = !filterSubject || g.subject === filterSubject;
        const matchesTerm = !filterTerm || g.term === filterTerm;
        return matchesSearch && matchesSubject && matchesTerm;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div data-testid="grades-page">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold text-foreground">Grades</h1>
                    <p className="text-muted-foreground">
                        {isParent ? 'View your children\'s academic performance' : 'Manage student grades and assessments'}
                    </p>
                </div>
                
                {(isAdmin || isTeacher) && (
                    <Dialog open={isDialogOpen} onOpenChange={(open) => {
                        setIsDialogOpen(open);
                        if (!open) {
                            setEditingGrade(null);
                            setFormData(initialFormData);
                        }
                    }}>
                        <DialogTrigger asChild>
                            <Button className="rounded-full shadow-md" data-testid="add-grade-btn">
                                <Plus className="w-5 h-5 mr-2" />
                                Add Grade
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg rounded-3xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>
                                    {editingGrade ? 'Edit Grade' : 'Add New Grade'}
                                </DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <Label>Student *</Label>
                                    <Select 
                                        value={formData.student_id}
                                        onValueChange={(value) => {
                                            const student = students.find(s => s.id === value);
                                            setFormData({ 
                                                ...formData, 
                                                student_id: value,
                                                class_id: student?.class_id || ''
                                            });
                                        }}
                                    >
                                        <SelectTrigger className="rounded-xl" data-testid="grade-student-select">
                                            <SelectValue placeholder="Select student" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {students.map(student => (
                                                <SelectItem key={student.id} value={student.id}>
                                                    {student.first_name} {student.last_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Subject *</Label>
                                        <Select 
                                            value={formData.subject}
                                            onValueChange={(value) => setFormData({ ...formData, subject: value })}
                                        >
                                            <SelectTrigger className="rounded-xl" data-testid="grade-subject-select">
                                                <SelectValue placeholder="Select subject" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {subjects.map(subject => (
                                                    <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Type *</Label>
                                        <Select 
                                            value={formData.grade_type}
                                            onValueChange={(value) => setFormData({ ...formData, grade_type: value })}
                                        >
                                            <SelectTrigger className="rounded-xl" data-testid="grade-type-select">
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {gradeTypes.map(type => (
                                                    <SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Score *</Label>
                                        <Input
                                            type="number"
                                            value={formData.score}
                                            onChange={(e) => setFormData({ ...formData, score: e.target.value })}
                                            className="rounded-xl"
                                            min="0"
                                            step="0.5"
                                            required
                                            data-testid="grade-score-input"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Max Score *</Label>
                                        <Input
                                            type="number"
                                            value={formData.max_score}
                                            onChange={(e) => setFormData({ ...formData, max_score: e.target.value })}
                                            className="rounded-xl"
                                            min="1"
                                            required
                                            data-testid="grade-max-score-input"
                                        />
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Date *</Label>
                                        <Input
                                            type="date"
                                            value={formData.date}
                                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                            className="rounded-xl"
                                            required
                                            data-testid="grade-date-input"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Term *</Label>
                                        <Select 
                                            value={formData.term}
                                            onValueChange={(value) => setFormData({ ...formData, term: value })}
                                        >
                                            <SelectTrigger className="rounded-xl" data-testid="grade-term-select">
                                                <SelectValue placeholder="Select term" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {terms.map(term => (
                                                    <SelectItem key={term} value={term}>{term}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                
                                <div className="space-y-2">
                                    <Label>Comments</Label>
                                    <Textarea
                                        value={formData.comments}
                                        onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                                        className="rounded-xl"
                                        rows={2}
                                        data-testid="grade-comments-input"
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
                                        data-testid="save-grade-btn"
                                    >
                                        {submitting ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            editingGrade ? 'Update Grade' : 'Add Grade'
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                        placeholder="Search by student or subject..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-12 rounded-xl h-12"
                        data-testid="search-grades-input"
                    />
                </div>
                <Select value={filterSubject} onValueChange={setFilterSubject}>
                    <SelectTrigger className="w-full md:w-48 rounded-xl h-12" data-testid="filter-subject-select">
                        <SelectValue placeholder="All Subjects" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Subjects</SelectItem>
                        {subjects.map(subject => (
                            <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={filterTerm} onValueChange={setFilterTerm}>
                    <SelectTrigger className="w-full md:w-40 rounded-xl h-12" data-testid="filter-term-select">
                        <SelectValue placeholder="All Terms" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Terms</SelectItem>
                        {terms.map(term => (
                            <SelectItem key={term} value={term}>{term}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Grades List */}
            {filteredGrades.length > 0 ? (
                <Card className="rounded-3xl border-border/50 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full data-table">
                            <thead>
                                <tr>
                                    <th>Student</th>
                                    <th>Subject</th>
                                    <th>Type</th>
                                    <th>Score</th>
                                    <th>Grade</th>
                                    <th>Term</th>
                                    <th>Date</th>
                                    {(isAdmin || isTeacher) && <th>Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredGrades.map((grade, index) => (
                                    <tr 
                                        key={grade.id}
                                        className="opacity-0 animate-fade-in"
                                        style={{ animationDelay: `${index * 30}ms` }}
                                        data-testid={`grade-row-${grade.id}`}
                                    >
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                                                    {getStudentName(grade.student_id).split(' ').map(n => n[0]).join('')}
                                                </div>
                                                <span className="font-medium">{getStudentName(grade.student_id)}</span>
                                            </div>
                                        </td>
                                        <td>{grade.subject}</td>
                                        <td>
                                            <span className="capitalize text-xs px-2 py-1 rounded-full bg-muted">
                                                {grade.grade_type}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`font-bold ${getGradeColor(grade.score, grade.max_score)}`}>
                                                {grade.score}/{grade.max_score}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`font-bold text-lg ${getGradeColor(grade.score, grade.max_score)}`}>
                                                {getGradeLetter(grade.score, grade.max_score)}
                                            </span>
                                        </td>
                                        <td>{grade.term}</td>
                                        <td className="text-muted-foreground">{grade.date}</td>
                                        {(isAdmin || isTeacher) && (
                                            <td>
                                                <div className="flex gap-1">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm"
                                                        onClick={() => handleEdit(grade)}
                                                        data-testid={`edit-grade-${grade.id}`}
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </Button>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm"
                                                        className="text-destructive hover:bg-destructive/10"
                                                        onClick={() => handleDelete(grade.id)}
                                                        data-testid={`delete-grade-${grade.id}`}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            ) : (
                <Card className="rounded-3xl border-border/50 shadow-sm">
                    <CardContent className="py-16">
                        <div className="empty-state">
                            <FileText className="empty-state-icon" />
                            <h3 className="text-lg font-semibold mb-2">No grades found</h3>
                            <p className="text-muted-foreground">
                                {searchQuery || filterSubject || filterTerm
                                    ? 'Try adjusting your filters' 
                                    : isParent 
                                        ? 'No grades recorded for your children yet' 
                                        : 'Start adding grades to track student performance'}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
