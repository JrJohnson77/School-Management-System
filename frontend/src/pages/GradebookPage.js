import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import { 
    BookOpen,
    Loader2,
    Save,
    User,
    Award,
    Users,
    Heart
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TERMS = ['Term 1', 'Term 2', 'Term 3'];
const CURRENT_YEAR = new Date().getFullYear();
const ACADEMIC_YEARS = [
    `${CURRENT_YEAR-1}-${CURRENT_YEAR}`, 
    `${CURRENT_YEAR}-${CURRENT_YEAR+1}`,
    `${CURRENT_YEAR+1}-${CURRENT_YEAR+2}`
];

const getGradeColor = (grade) => {
    if (!grade) return 'text-muted-foreground';
    if (grade.startsWith('A')) return 'text-green-600';
    if (grade.startsWith('B')) return 'text-blue-600';
    if (grade.startsWith('C')) return 'text-yellow-600';
    if (grade.startsWith('D')) return 'text-orange-600';
    return 'text-red-600';
};

const getGradeFromScale = (score, gradeScale) => {
    if (score === null || score === undefined || isNaN(score)) return { grade: '-', description: '-' };
    const rounded = Math.round(score);
    for (const g of gradeScale) {
        if (rounded >= g.min && rounded <= g.max) return g;
    }
    return gradeScale[gradeScale.length - 1] || { grade: '-', description: '-' };
};

const calcWeightedFromWeights = (components, weights) => {
    const homework = parseFloat(components.homework) || 0;
    const groupWork = parseFloat(components.groupWork) || 0;
    const project = parseFloat(components.project) || 0;
    const quiz = parseFloat(components.quiz) || 0;
    const midTerm = parseFloat(components.midTerm) || 0;
    const endOfTerm = parseFloat(components.endOfTerm) || 0;
    
    return (
        homework * ((weights.homework || 0) / 100) +
        groupWork * ((weights.groupWork || 0) / 100) +
        project * ((weights.project || 0) / 100) +
        quiz * ((weights.quiz || 0) / 100) +
        midTerm * ((weights.midTerm || 0) / 100) +
        endOfTerm * ((weights.endOfTerm || 0) / 100)
    );
};

export default function GradebookPage() {
    const [classes, setClasses] = useState([]);
    const [students, setStudents] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [gradingScheme, setGradingScheme] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingSkills, setSavingSkills] = useState(false);
    
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedStudent, setSelectedStudent] = useState('');
    const [selectedTerm, setSelectedTerm] = useState(TERMS[0]);
    const [selectedYear, setSelectedYear] = useState(ACADEMIC_YEARS[0]);
    const [activeTab, setActiveTab] = useState('grades');
    
    const [grades, setGrades] = useState({});
    const [socialSkills, setSocialSkills] = useState({});
    const [existingGradebook, setExistingGradebook] = useState(null);
    const [useMHPSMode, setUseMHPSMode] = useState(false);
    const [template, setTemplate] = useState(null);
    
    const { isAdmin, isTeacher, isParent, schoolCode } = useAuth();

    // Derive template-based values
    const tplSubjects = template?.subjects?.map(s => s.name) || [];
    const tplGradeScale = template?.grade_scale || [];
    const tplWeights = template?.assessment_weights || {};
    const tplComponents = template?.use_weighted_grading
        ? Object.entries(tplWeights).map(([key, weight]) => ({
            key, label: key.replace(/([A-Z])/g, ' $1').trim(), weight
        }))
        : [];
    const tplSocialCategories = template?.social_skills_categories || [];
    const tplSkillRatings = template?.skill_ratings || ['Excellent', 'Good', 'Satisfactory', 'Needs Improvement'];

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (template) {
            setUseMHPSMode(!!template.use_weighted_grading);
            setSubjects(tplSubjects);
        }
    }, [template]);

    useEffect(() => {
        if (selectedClass) {
            fetchStudents();
        }
    }, [selectedClass]);

    useEffect(() => {
        if (selectedStudent && selectedTerm && selectedYear) {
            fetchExistingGrades();
            fetchSocialSkills();
        }
    }, [selectedStudent, selectedTerm, selectedYear]);

    const fetchInitialData = async () => {
        try {
            const requests = [
                axios.get(`${API}/classes`),
                axios.get(`${API}/grading-scheme`),
            ];
            if (schoolCode) {
                requests.push(axios.get(`${API}/report-templates/${schoolCode}`));
            }
            const results = await Promise.all(requests);
            setClasses(results[0].data);
            setGradingScheme(results[1].data.grading_scheme || []);
            if (results[2]?.data) {
                setTemplate(results[2].data);
            }
        } catch (error) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const fetchStudents = async () => {
        try {
            const response = await axios.get(`${API}/students?class_id=${selectedClass}`);
            setStudents(response.data.filter(s => s.class_id === selectedClass));
        } catch (error) {
            toast.error('Failed to load students');
        }
    };

    const fetchExistingGrades = async () => {
        try {
            const response = await axios.get(
                `${API}/gradebook?student_id=${selectedStudent}&term=${selectedTerm}&academic_year=${selectedYear}`
            );
            if (response.data.length > 0) {
                const existing = response.data[0];
                setExistingGradebook(existing);
                
                const gradesObj = {};
                existing.subjects.forEach(s => {
                    if (useMHPSMode) {
                        gradesObj[s.subject] = {
                            homework: s.homework ?? '',
                            groupWork: s.groupWork ?? '',
                            project: s.project ?? '',
                            quiz: s.quiz ?? '',
                            midTerm: s.midTerm ?? '',
                            endOfTerm: s.endOfTerm ?? '',
                            comment: s.comment || ''
                        };
                    } else {
                        gradesObj[s.subject] = {
                            score: s.score ?? '',
                            comment: s.comment || ''
                        };
                    }
                });
                setGrades(gradesObj);
            } else {
                setExistingGradebook(null);
                const emptyGrades = {};
                subjects.forEach(subj => {
                    if (useMHPSMode) {
                        emptyGrades[subj] = {
                            homework: '', groupWork: '', project: '',
                            quiz: '', midTerm: '', endOfTerm: '', comment: ''
                        };
                    } else {
                        emptyGrades[subj] = { score: '', comment: '' };
                    }
                });
                setGrades(emptyGrades);
            }
        } catch (error) {
            console.error('Error fetching grades:', error);
        }
    };

    const fetchSocialSkills = async () => {
        try {
            const response = await axios.get(
                `${API}/social-skills/${selectedStudent}?term=${selectedTerm}&academic_year=${selectedYear}`
            );
            setSocialSkills(response.data.skills || {});
        } catch (error) {
            setSocialSkills({});
        }
    };

    const handleGradeChange = (subject, field, value) => {
        setGrades(prev => ({
            ...prev,
            [subject]: {
                ...prev[subject],
                [field]: value
            }
        }));
    };

    const handleSkillChange = (skill, rating) => {
        setSocialSkills(prev => ({
            ...prev,
            [skill]: rating
        }));
    };

    const handleSave = async () => {
        if (!selectedStudent) {
            toast.error('Please select a student');
            return;
        }

        setSaving(true);
        try {
            const subjectsData = subjects.map(subject => {
                const gradeData = grades[subject] || {};
                
                if (useMHPSMode) {
                    return {
                        subject,
                        homework: gradeData.homework ? parseFloat(gradeData.homework) : null,
                        groupWork: gradeData.groupWork ? parseFloat(gradeData.groupWork) : null,
                        project: gradeData.project ? parseFloat(gradeData.project) : null,
                        quiz: gradeData.quiz ? parseFloat(gradeData.quiz) : null,
                        midTerm: gradeData.midTerm ? parseFloat(gradeData.midTerm) : null,
                        endOfTerm: gradeData.endOfTerm ? parseFloat(gradeData.endOfTerm) : null,
                        comment: gradeData.comment || ''
                    };
                } else {
                    return {
                        subject,
                        score: gradeData.score ? parseFloat(gradeData.score) : 0,
                        comment: gradeData.comment || ''
                    };
                }
            });

            await axios.post(`${API}/gradebook`, {
                student_id: selectedStudent,
                class_id: selectedClass,
                term: selectedTerm,
                academic_year: selectedYear,
                subjects: subjectsData
            });

            toast.success('Grades saved successfully!');
            fetchExistingGrades();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to save grades');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveSocialSkills = async () => {
        if (!selectedStudent) {
            toast.error('Please select a student');
            return;
        }

        setSavingSkills(true);
        try {
            await axios.post(`${API}/social-skills`, {
                student_id: selectedStudent,
                term: selectedTerm,
                academic_year: selectedYear,
                skills: socialSkills
            });

            toast.success('Social skills saved successfully!');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to save social skills');
        } finally {
            setSavingSkills(false);
        }
    };

    const selectedStudentData = students.find(s => s.id === selectedStudent);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6" data-testid="gradebook-page">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Gradebook</h1>
                    <p className="text-muted-foreground">Enter and manage student grades</p>
                </div>
                {(isAdmin || isTeacher) && (
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={useMHPSMode}
                                onCheckedChange={(checked) => {
                                    setUseMHPSMode(checked);
                                    setSubjects(checked ? MHPS_SUBJECTS : STANDARD_SUBJECTS);
                                    setGrades({});
                                }}
                                data-testid="mhps-mode-toggle"
                            />
                            <Label className="text-sm">MHPS Mode</Label>
                        </div>
                    </div>
                )}
            </div>

            {/* Selection Controls */}
            <Card className="rounded-3xl border-border/50 shadow-sm">
                <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label>Class *</Label>
                            <Select value={selectedClass} onValueChange={setSelectedClass}>
                                <SelectTrigger className="rounded-xl" data-testid="gradebook-class-select">
                                    <SelectValue placeholder="Select class" />
                                </SelectTrigger>
                                <SelectContent>
                                    {classes.map(cls => (
                                        <SelectItem key={cls.id} value={cls.id}>
                                            {cls.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="space-y-2">
                            <Label>Student *</Label>
                            <Select 
                                value={selectedStudent} 
                                onValueChange={setSelectedStudent}
                                disabled={!selectedClass}
                            >
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
                        
                        <div className="space-y-2">
                            <Label>Term</Label>
                            <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TERMS.map(term => (
                                        <SelectItem key={term} value={term}>{term}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="space-y-2">
                            <Label>Academic Year</Label>
                            <Select value={selectedYear} onValueChange={setSelectedYear}>
                                <SelectTrigger className="rounded-xl">
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

            {/* Student Info Card */}
            {selectedStudentData && (
                <Card className="rounded-3xl border-border/50 shadow-sm bg-primary/5">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                                <User className="w-8 h-8 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">
                                    {selectedStudentData.first_name} {selectedStudentData.last_name}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    {selectedStudentData.student_id && `ID: ${selectedStudentData.student_id} • `}
                                    Age: {selectedStudentData.age} • {selectedStudentData.gender}
                                    {selectedStudentData.house && ` • ${selectedStudentData.house}`}
                                </p>
                            </div>
                            {existingGradebook && (
                                <div className="ml-auto text-right">
                                    <div className="flex items-center gap-2">
                                        <Award className={`w-5 h-5 ${getGradeColor(existingGradebook.overall_grade)}`} />
                                        <span className={`text-2xl font-bold ${getGradeColor(existingGradebook.overall_grade)}`}>
                                            {existingGradebook.overall_grade}
                                        </span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        Overall: {existingGradebook.overall_score?.toFixed(1)}%
                                    </p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Tabs for Grades and Social Skills */}
            {selectedStudent && (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 rounded-2xl h-12 max-w-md">
                        <TabsTrigger value="grades" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            <BookOpen className="w-4 h-4 mr-2" />
                            Academic Grades
                        </TabsTrigger>
                        <TabsTrigger value="social-skills" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            <Heart className="w-4 h-4 mr-2" />
                            Social Skills
                        </TabsTrigger>
                    </TabsList>

                    {/* Academic Grades Tab */}
                    <TabsContent value="grades" className="mt-6">
                        <Card className="rounded-3xl border-border/50 shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <BookOpen className="w-5 h-5" />
                                    {useMHPSMode ? 'MHPS Assessment Entry' : 'Subject Grades'}
                                </CardTitle>
                                {useMHPSMode && (
                                    <p className="text-sm text-muted-foreground">
                                        Weights: HW 5% | GW 5% | Project 10% | Quiz 10% | Mid-Term 30% | End of Term 40%
                                    </p>
                                )}
                            </CardHeader>
                            <CardContent>
                                {useMHPSMode ? (
                                    <div className="space-y-4">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b">
                                                        <th className="text-left p-2 w-32">Subject</th>
                                                        {tplComponents.map(comp => (
                                                            <th key={comp.key} className="text-center p-2 w-20">
                                                                <div>{comp.label}</div>
                                                                <div className="text-xs text-muted-foreground">({comp.weight}%)</div>
                                                            </th>
                                                        ))}
                                                        <th className="text-center p-2 w-20 bg-primary/10">Weighted</th>
                                                        <th className="text-center p-2 w-16 bg-primary/10">Grade</th>
                                                        <th className="text-left p-2 w-40">Comment</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {subjects.map(subject => {
                                                        const gradeData = grades[subject] || {};
                                                        const weightedScore = calcWeightedFromWeights(gradeData, tplWeights);
                                                        const gradeInfo = getGradeFromScale(weightedScore, tplGradeScale);
                                                        
                                                        return (
                                                            <tr key={subject} className="border-b hover:bg-muted/50">
                                                                <td className="p-2 font-medium">{subject}</td>
                                                                {tplComponents.map(comp => (
                                                                    <td key={comp.key} className="p-1">
                                                                        <Input
                                                                            type="number"
                                                                            min="0"
                                                                            max="100"
                                                                            value={gradeData[comp.key] ?? ''}
                                                                            onChange={(e) => handleGradeChange(subject, comp.key, e.target.value)}
                                                                            className="w-16 h-8 text-center rounded-lg text-sm"
                                                                            placeholder="-"
                                                                        />
                                                                    </td>
                                                                ))}
                                                                <td className="p-2 text-center font-bold bg-primary/5">
                                                                    {weightedScore > 0 ? weightedScore.toFixed(1) : '-'}
                                                                </td>
                                                                <td className={`p-2 text-center font-bold bg-primary/5 ${getGradeColor(gradeInfo.grade)}`}>
                                                                    {gradeInfo.grade}
                                                                </td>
                                                                <td className="p-1">
                                                                    <Input
                                                                        value={gradeData.comment || ''}
                                                                        onChange={(e) => handleGradeChange(subject, 'comment', e.target.value)}
                                                                        className="h-8 rounded-lg text-sm"
                                                                        placeholder="Comment..."
                                                                    />
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {subjects.map(subject => (
                                            <div key={subject} className="p-4 rounded-2xl bg-muted/30">
                                                <Label className="font-medium">{subject}</Label>
                                                <div className="grid grid-cols-3 gap-2 mt-2">
                                                    <div className="col-span-1">
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            value={grades[subject]?.score ?? ''}
                                                            onChange={(e) => handleGradeChange(subject, 'score', e.target.value)}
                                                            className="rounded-xl"
                                                            placeholder="Score"
                                                        />
                                                    </div>
                                                    <div className="col-span-2">
                                                        <Input
                                                            value={grades[subject]?.comment || ''}
                                                            onChange={(e) => handleGradeChange(subject, 'comment', e.target.value)}
                                                            className="rounded-xl"
                                                            placeholder="Comment"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="flex justify-end mt-6">
                                    <Button
                                        onClick={handleSave}
                                        disabled={saving || !selectedStudent}
                                        className="rounded-full px-8"
                                        data-testid="save-grades-btn"
                                    >
                                        {saving ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : (
                                            <Save className="w-4 h-4 mr-2" />
                                        )}
                                        Save Grades
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Social Skills Tab */}
                    <TabsContent value="social-skills" className="mt-6">
                        <Card className="rounded-3xl border-border/50 shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Heart className="w-5 h-5" />
                                    Social Skills & Attitudes Assessment
                                </CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    Rate the student's social skills and attitudes
                                </p>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Work and Personal Ethics */}
                                    <div className="space-y-4">
                                        <h4 className="font-bold flex items-center gap-2">
                                            <Users className="w-4 h-4" />
                                            Work and Personal Ethics
                                        </h4>
                                        {SOCIAL_SKILLS.workEthics.map(skill => (
                                            <div key={skill} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                                                <Label className="text-sm">{skill}</Label>
                                                <Select
                                                    value={socialSkills[skill] || ''}
                                                    onValueChange={(value) => handleSkillChange(skill, value)}
                                                >
                                                    <SelectTrigger className="w-40 rounded-xl h-8">
                                                        <SelectValue placeholder="Select..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {SKILL_RATINGS.map(rating => (
                                                            <SelectItem key={rating} value={rating}>{rating}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Respect */}
                                    <div className="space-y-4">
                                        <h4 className="font-bold flex items-center gap-2">
                                            <Heart className="w-4 h-4" />
                                            Respect
                                        </h4>
                                        {SOCIAL_SKILLS.respect.map(skill => (
                                            <div key={skill} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                                                <Label className="text-sm">{skill}</Label>
                                                <Select
                                                    value={socialSkills[skill] || ''}
                                                    onValueChange={(value) => handleSkillChange(skill, value)}
                                                >
                                                    <SelectTrigger className="w-40 rounded-xl h-8">
                                                        <SelectValue placeholder="Select..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {SKILL_RATINGS.map(rating => (
                                                            <SelectItem key={rating} value={rating}>{rating}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        ))}

                                        <div className="mt-6 p-4 rounded-xl bg-primary/5 text-sm">
                                            <h5 className="font-bold mb-2">Rating Key:</h5>
                                            <ul className="space-y-1 text-muted-foreground">
                                                <li><strong>Excellent</strong> - Consistently demonstrates exemplary behavior</li>
                                                <li><strong>Good</strong> - Regularly demonstrates positive behavior</li>
                                                <li><strong>Satisfactory</strong> - Generally meets expectations</li>
                                                <li><strong>Needs Improvement</strong> - Requires support and guidance</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end mt-6">
                                    <Button
                                        onClick={handleSaveSocialSkills}
                                        disabled={savingSkills || !selectedStudent}
                                        className="rounded-full px-8"
                                        data-testid="save-social-skills-btn"
                                    >
                                        {savingSkills ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : (
                                            <Save className="w-4 h-4 mr-2" />
                                        )}
                                        Save Social Skills
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            )}

            {/* Grading Key */}
            {useMHPSMode && (
                <Card className="rounded-3xl border-border/50 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-sm">MHPS Grading Scale</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-4 md:grid-cols-8 gap-2 text-xs">
                            {MHPS_GRADE_SCALE.map(g => (
                                <div key={g.grade} className="text-center p-2 rounded-xl bg-muted/50">
                                    <div className={`font-bold ${getGradeColor(g.grade)}`}>{g.grade}</div>
                                    <div className="text-muted-foreground">{g.min}-{g.max}</div>
                                    <div className="text-muted-foreground truncate">{g.description}</div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
