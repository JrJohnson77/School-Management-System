import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { 
    BookOpen,
    Loader2,
    Save,
    User,
    Award,
    TrendingUp
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TERMS = ['Term 1', 'Term 2', 'Term 3'];
const CURRENT_YEAR = new Date().getFullYear();
const ACADEMIC_YEARS = [`${CURRENT_YEAR-1}/${CURRENT_YEAR}`, `${CURRENT_YEAR}/${CURRENT_YEAR+1}`];

const getGradeColor = (grade) => {
    if (!grade) return 'text-muted-foreground';
    if (grade.startsWith('A')) return 'text-green-600';
    if (grade.startsWith('B')) return 'text-blue-600';
    if (grade.startsWith('C')) return 'text-yellow-600';
    if (grade.startsWith('D')) return 'text-orange-600';
    return 'text-red-600';
};

export default function GradebookPage() {
    const [classes, setClasses] = useState([]);
    const [students, setStudents] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [gradingScheme, setGradingScheme] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedStudent, setSelectedStudent] = useState('');
    const [selectedTerm, setSelectedTerm] = useState(TERMS[0]);
    const [selectedYear, setSelectedYear] = useState(ACADEMIC_YEARS[0]);
    
    const [grades, setGrades] = useState({});
    const [existingGradebook, setExistingGradebook] = useState(null);
    
    const { isAdmin, isTeacher, isParent } = useAuth();

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (selectedClass) {
            fetchStudents();
        }
    }, [selectedClass]);

    useEffect(() => {
        if (selectedStudent && selectedTerm && selectedYear) {
            fetchExistingGrades();
        }
    }, [selectedStudent, selectedTerm, selectedYear]);

    const fetchInitialData = async () => {
        try {
            const [classesRes, subjectsRes, schemeRes] = await Promise.all([
                axios.get(`${API}/classes`),
                axios.get(`${API}/subjects`),
                axios.get(`${API}/grading-scheme`)
            ]);
            setClasses(classesRes.data);
            setSubjects(subjectsRes.data.subjects || []);
            setGradingScheme(schemeRes.data.grading_scheme || []);
            
            if (classesRes.data.length > 0) {
                setSelectedClass(classesRes.data[0].id);
            }
        } catch (error) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const fetchStudents = async () => {
        try {
            const response = await axios.get(`${API}/students`, {
                params: { class_id: selectedClass }
            });
            setStudents(response.data);
            if (response.data.length > 0) {
                setSelectedStudent(response.data[0].id);
            } else {
                setSelectedStudent('');
            }
        } catch (error) {
            console.error('Failed to fetch students');
        }
    };

    const fetchExistingGrades = async () => {
        try {
            const response = await axios.get(`${API}/gradebook`, {
                params: {
                    student_id: selectedStudent,
                    term: selectedTerm,
                    academic_year: selectedYear
                }
            });
            
            if (response.data.length > 0) {
                const existing = response.data[0];
                setExistingGradebook(existing);
                
                // Populate grades from existing data
                const gradesMap = {};
                existing.subjects.forEach(subj => {
                    gradesMap[subj.subject] = {
                        score: subj.score,
                        comment: subj.comment || ''
                    };
                });
                setGrades(gradesMap);
            } else {
                setExistingGradebook(null);
                // Initialize empty grades
                const emptyGrades = {};
                subjects.forEach(subj => {
                    emptyGrades[subj] = { score: '', comment: '' };
                });
                setGrades(emptyGrades);
            }
        } catch (error) {
            console.error('Failed to fetch grades');
        }
    };

    const handleScoreChange = (subject, value) => {
        const score = value === '' ? '' : Math.min(100, Math.max(0, parseFloat(value) || 0));
        setGrades(prev => ({
            ...prev,
            [subject]: { ...prev[subject], score }
        }));
    };

    const handleCommentChange = (subject, value) => {
        setGrades(prev => ({
            ...prev,
            [subject]: { ...prev[subject], comment: value }
        }));
    };

    const getGradeForScore = (score) => {
        if (score === '' || score === undefined) return null;
        const numScore = parseFloat(score);
        for (const scheme of gradingScheme) {
            if (numScore >= scheme.min && numScore <= scheme.max) {
                return scheme;
            }
        }
        return null;
    };

    const calculateOverall = () => {
        const validScores = Object.values(grades)
            .map(g => parseFloat(g.score))
            .filter(s => !isNaN(s));
        
        if (validScores.length === 0) return null;
        
        const avg = validScores.reduce((a, b) => a + b, 0) / validScores.length;
        return getGradeForScore(avg);
    };

    const handleSave = async () => {
        if (!selectedStudent || !selectedClass) {
            toast.error('Please select a class and student');
            return;
        }

        const subjectGrades = Object.entries(grades)
            .filter(([_, data]) => data.score !== '' && data.score !== undefined)
            .map(([subject, data]) => ({
                subject,
                score: parseFloat(data.score),
                comment: data.comment || ''
            }));

        if (subjectGrades.length === 0) {
            toast.error('Please enter at least one grade');
            return;
        }

        setSaving(true);
        try {
            await axios.post(`${API}/gradebook`, {
                student_id: selectedStudent,
                class_id: selectedClass,
                term: selectedTerm,
                academic_year: selectedYear,
                subjects: subjectGrades
            });
            toast.success('Grades saved successfully');
            fetchExistingGrades();
        } catch (error) {
            toast.error('Failed to save grades');
        } finally {
            setSaving(false);
        }
    };

    const selectedStudentData = students.find(s => s.id === selectedStudent);
    const overallGrade = calculateOverall();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div data-testid="gradebook-page">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold text-foreground">Gradebook</h1>
                    <p className="text-muted-foreground">
                        {isParent ? 'View your children\'s grades' : 'Enter and manage student grades'}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <Card className="rounded-3xl border-border/50 shadow-sm mb-6">
                <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <Label className="mb-2 block">Class</Label>
                            <Select value={selectedClass} onValueChange={setSelectedClass}>
                                <SelectTrigger className="rounded-xl" data-testid="gradebook-class-select">
                                    <SelectValue placeholder="Select class" />
                                </SelectTrigger>
                                <SelectContent>
                                    {classes.map(cls => (
                                        <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div>
                            <Label className="mb-2 block">Student</Label>
                            <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                                <SelectTrigger className="rounded-xl" data-testid="gradebook-student-select">
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
                        
                        <div>
                            <Label className="mb-2 block">Term</Label>
                            <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                                <SelectTrigger className="rounded-xl" data-testid="gradebook-term-select">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TERMS.map(term => (
                                        <SelectItem key={term} value={term}>{term}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div>
                            <Label className="mb-2 block">Academic Year</Label>
                            <Select value={selectedYear} onValueChange={setSelectedYear}>
                                <SelectTrigger className="rounded-xl" data-testid="gradebook-year-select">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {ACADEMIC_YEARS.map(year => (
                                        <SelectItem key={year} value={year}>{year}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {selectedStudentData && (
                <>
                    {/* Student Info Card */}
                    <Card className="rounded-3xl border-border/50 shadow-sm mb-6">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                                        {selectedStudentData.first_name?.[0]}{selectedStudentData.last_name?.[0]}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold">
                                            {selectedStudentData.first_name} {selectedStudentData.middle_name || ''} {selectedStudentData.last_name}
                                        </h2>
                                        <p className="text-muted-foreground">
                                            Age: {selectedStudentData.age} years • {selectedStudentData.house || 'No house'}
                                        </p>
                                    </div>
                                </div>
                                
                                {overallGrade && (
                                    <div className="text-right">
                                        <div className="flex items-center gap-2">
                                            <Award className="w-5 h-5 text-primary" />
                                            <span className="text-sm text-muted-foreground">Overall Grade</span>
                                        </div>
                                        <div className={`text-3xl font-bold ${getGradeColor(overallGrade.grade)}`}>
                                            {overallGrade.grade}
                                        </div>
                                        <p className="text-sm text-muted-foreground">{overallGrade.domain}</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Grades Entry */}
                    <Card className="rounded-3xl border-border/50 shadow-sm mb-6">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BookOpen className="w-5 h-5 text-primary" />
                                Subject Grades - {selectedTerm} ({selectedYear})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {subjects.map((subject, index) => {
                                    const gradeData = grades[subject] || { score: '', comment: '' };
                                    const gradeInfo = getGradeForScore(gradeData.score);
                                    
                                    return (
                                        <div 
                                            key={subject}
                                            className="grid grid-cols-12 gap-4 items-start p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                                            data-testid={`grade-row-${index}`}
                                        >
                                            <div className="col-span-3">
                                                <Label className="font-medium">{subject}</Label>
                                            </div>
                                            <div className="col-span-2">
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={gradeData.score}
                                                    onChange={(e) => handleScoreChange(subject, e.target.value)}
                                                    className="rounded-xl text-center"
                                                    placeholder="0-100"
                                                    disabled={isParent}
                                                    data-testid={`grade-score-${index}`}
                                                />
                                            </div>
                                            <div className="col-span-2 text-center">
                                                {gradeInfo && (
                                                    <div>
                                                        <span className={`text-2xl font-bold ${getGradeColor(gradeInfo.grade)}`}>
                                                            {gradeInfo.grade}
                                                        </span>
                                                        <p className="text-xs text-muted-foreground">{gradeInfo.points} pts</p>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="col-span-5">
                                                <Textarea
                                                    value={gradeData.comment}
                                                    onChange={(e) => handleCommentChange(subject, e.target.value)}
                                                    className="rounded-xl text-sm"
                                                    placeholder="Teacher's comment for this subject..."
                                                    rows={1}
                                                    disabled={isParent}
                                                    data-testid={`grade-comment-${index}`}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            
                            {(isAdmin || isTeacher) && (
                                <div className="mt-6 flex justify-end">
                                    <Button 
                                        onClick={handleSave}
                                        className="rounded-full shadow-md"
                                        disabled={saving}
                                        data-testid="save-gradebook-btn"
                                    >
                                        {saving ? (
                                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                        ) : (
                                            <Save className="w-5 h-5 mr-2" />
                                        )}
                                        Save Grades
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Grading Scheme Reference */}
                    <Card className="rounded-3xl border-border/50 shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-primary" />
                                Grading Scheme
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                {gradingScheme.map((scheme, index) => (
                                    <div 
                                        key={index}
                                        className="p-3 rounded-xl bg-muted/50 text-center"
                                    >
                                        <div className={`text-xl font-bold ${getGradeColor(scheme.grade)}`}>
                                            {scheme.grade}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            {scheme.min}-{scheme.max}%
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {scheme.points} pts
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}

            {!selectedStudentData && students.length === 0 && (
                <Card className="rounded-3xl border-border/50 shadow-sm">
                    <CardContent className="py-16">
                        <div className="empty-state">
                            <BookOpen className="empty-state-icon" />
                            <h3 className="text-lg font-semibold mb-2">No students in this class</h3>
                            <p className="text-muted-foreground">
                                Add students to this class to start entering grades
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
