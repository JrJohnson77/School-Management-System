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
    Heart,
    Plus,
    Trash2,
    ChevronDown,
    ChevronRight
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
    // Dynamic: iterate over all weight keys
    let total = 0;
    for (const [key, weightPct] of Object.entries(weights)) {
        const score = parseFloat(components[key]) || 0;
        total += score * ((weightPct || 0) / 100);
    }
    return total;
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
    const [savingSettings, setSavingSettings] = useState(false);
    const [expandedSubject, setExpandedSubject] = useState(null);
    
    const { isAdmin, isTeacher, isParent, schoolCode, isSuperuser } = useAuth();

    // Default configuration constants
    const DEFAULT_WEIGHTS = { homework: 5, groupWork: 5, project: 10, quiz: 10, midTerm: 30, endOfTerm: 40 };
    
    const DEFAULT_SUBJECTS = [
        'English Language',
        'Mathematics',
        'Science',
        'Social Studies',
        'Religious Education',
        'Physical Education',
        'Creative Arts',
        'Music',
        'ICT',
        'French'
    ];

    // Derive template-based values with defaults
    const tplSubjects = template?.subjects?.length > 0 
        ? template.subjects.map(s => s.name) 
        : DEFAULT_SUBJECTS;
    const tplGradeScale = template?.grade_scale || [];
    const tplWeights = template?.assessment_weights && Object.keys(template.assessment_weights).length > 0
        ? template.assessment_weights
        : DEFAULT_WEIGHTS;
    const tplComponents = Object.entries(tplWeights).map(([key, weight]) => ({
        key, 
        label: key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim(),
        weight
    }));
    const tplSocialCategories = template?.social_skills_categories || [];
    const tplSkillRatings = template?.skill_ratings || [
        { code: 'EX', label: 'Excellent' },
        { code: 'VG', label: 'Very Good' },
        { code: 'G', label: 'Good' },
        { code: 'NI', label: 'Needs Improvement' }
    ];
    // Handle legacy format (array of strings) and new format (array of objects)
    const normalizedRatings = tplSkillRatings.map(r => 
        typeof r === 'string' ? { code: r, label: r } : r
    );

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (template) {
            setUseMHPSMode(true); // Always use weighted mode
            if (template.subjects?.length > 0) {
                setSubjects(template.subjects.map(s => s.name));
            } else {
                setSubjects(DEFAULT_SUBJECTS);
            }
        } else {
            // Use defaults when no template
            setUseMHPSMode(true);
            setSubjects(DEFAULT_SUBJECTS);
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
                        const entry = { comment: s.comment || '' };
                        // Dynamically load all component keys from template
                        tplComponents.forEach(comp => {
                            entry[comp.key] = s[comp.key] ?? '';
                        });
                        gradesObj[s.subject] = entry;
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
                        const entry = { comment: '' };
                        tplComponents.forEach(comp => {
                            entry[comp.key] = '';
                        });
                        emptyGrades[subj] = entry;
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

    // Save gradebook settings (weights, ratings, subjects)
    const handleSaveSettings = async () => {
        setSavingSettings(true);
        try {
            // Get current template and update it
            const updatedTemplate = {
                ...template,
                subjects: template?.subjects || [],
                assessment_weights: template?.assessment_weights || DEFAULT_WEIGHTS,
                use_weighted_grading: template?.use_weighted_grading || false,
                skill_ratings: template?.skill_ratings || [],
                social_skills_categories: template?.social_skills_categories || [],
                grade_scale: template?.grade_scale || []
            };
            
            await axios.put(`${API}/report-templates/${schoolCode}`, updatedTemplate);
            toast.success('Gradebook settings saved successfully!');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to save settings');
        } finally {
            setSavingSettings(false);
        }
    };

    const DEFAULT_CORE_SUBJECTS = [
        { name: 'English Language', is_core: true, weights: DEFAULT_WEIGHTS },
        { name: 'Mathematics', is_core: true, weights: DEFAULT_WEIGHTS },
        { name: 'Science', is_core: true, weights: DEFAULT_WEIGHTS },
        { name: 'Social Studies', is_core: true, weights: DEFAULT_WEIGHTS },
        { name: 'Religious Education', is_core: false, weights: DEFAULT_WEIGHTS },
        { name: 'Physical Education', is_core: false, weights: DEFAULT_WEIGHTS },
        { name: 'Creative Arts', is_core: false, weights: DEFAULT_WEIGHTS },
        { name: 'Music', is_core: false, weights: DEFAULT_WEIGHTS },
        { name: 'ICT', is_core: false, weights: DEFAULT_WEIGHTS },
        { name: 'French', is_core: false, weights: DEFAULT_WEIGHTS }
    ];

    const DEFAULT_ACHIEVEMENT_STANDARDS = [
        { min: 86, max: 100, grade: 'HP', description: 'Highly Proficient' },
        { min: 75, max: 85, grade: 'P', description: 'Proficient' },
        { min: 60, max: 74, grade: 'AP', description: 'Approaching Proficiency' },
        { min: 50, max: 59, grade: 'D', description: 'Developing' },
        { min: 0, max: 49, grade: 'B', description: 'Beginning' }
    ];

    const DEFAULT_SKILL_RATINGS = [
        { code: 'EX', label: 'Excellent' },
        { code: 'VG', label: 'Very Good' },
        { code: 'G', label: 'Good' },
        { code: 'NI', label: 'Needs Improvement' }
    ];

    const DEFAULT_SOCIAL_SKILLS = [
        { category_name: 'Work Habits & Attitude', skills: [
            'Completes Assignments',
            'Follows Instructions',
            'Punctuality'
        ]},
        { category_name: 'Social Behavior', skills: [
            'Deportment',
            'Courteous in Speech and Action',
            'Respect for Teacher',
            'Respect for Peers'
        ]}
    ];

    // Apply default configuration
    const applyDefaultConfig = () => {
        setTemplate({
            ...template,
            subjects: DEFAULT_CORE_SUBJECTS,
            assessment_weights: DEFAULT_WEIGHTS,
            use_weighted_grading: true,
            grade_scale: DEFAULT_ACHIEVEMENT_STANDARDS,
            skill_ratings: DEFAULT_SKILL_RATINGS,
            social_skills_categories: DEFAULT_SOCIAL_SKILLS
        });
        toast.success('Default configuration applied! Click Save to persist.');
    };

    // Update subject weights
    const updateSubjectWeights = (subjectIndex, weightKey, value) => {
        const newSubjects = [...(template?.subjects || [])];
        if (!newSubjects[subjectIndex].weights) {
            newSubjects[subjectIndex].weights = { ...DEFAULT_WEIGHTS };
        }
        newSubjects[subjectIndex].weights[weightKey] = parseFloat(value) || 0;
        setTemplate({ ...template, subjects: newSubjects });
    };

    // Add new subject
    const addSubject = () => {
        const newSubjects = [...(template?.subjects || [])];
        newSubjects.push({
            name: 'New Subject',
            is_core: false,
            weights: { ...DEFAULT_WEIGHTS }
        });
        setTemplate({ ...template, subjects: newSubjects });
    };

    // Remove subject
    const removeSubject = (index) => {
        const newSubjects = [...(template?.subjects || [])].filter((_, i) => i !== index);
        setTemplate({ ...template, subjects: newSubjects });
    };

    // Update subject name
    const updateSubjectName = (index, name) => {
        const newSubjects = [...(template?.subjects || [])];
        newSubjects[index] = { ...newSubjects[index], name };
        setTemplate({ ...template, subjects: newSubjects });
    };

    // Update subject is_core
    const updateSubjectCore = (index, is_core) => {
        const newSubjects = [...(template?.subjects || [])];
        newSubjects[index] = { ...newSubjects[index], is_core };
        setTemplate({ ...template, subjects: newSubjects });
    };

    // Add rating
    const addRating = () => {
        const newRatings = [...(template?.skill_ratings || normalizedRatings)];
        newRatings.push({ code: '', label: '' });
        setTemplate({ ...template, skill_ratings: newRatings });
    };

    // Remove rating
    const removeRating = (index) => {
        const newRatings = [...(template?.skill_ratings || normalizedRatings)].filter((_, i) => i !== index);
        setTemplate({ ...template, skill_ratings: newRatings });
    };

    // Update rating
    const updateRating = (index, field, value) => {
        const newRatings = [...(template?.skill_ratings || normalizedRatings)];
        newRatings[index] = { ...newRatings[index], [field]: value };
        setTemplate({ ...template, skill_ratings: newRatings });
    };

    // Achievement standards (grade scale) management
    const addAchievementStandard = () => {
        const newScale = [...(template?.grade_scale || DEFAULT_ACHIEVEMENT_STANDARDS)];
        newScale.push({ min: 0, max: 0, grade: '', description: '' });
        setTemplate({ ...template, grade_scale: newScale });
    };

    const removeAchievementStandard = (index) => {
        const newScale = [...(template?.grade_scale || [])].filter((_, i) => i !== index);
        setTemplate({ ...template, grade_scale: newScale });
    };

    const updateAchievementStandard = (index, field, value) => {
        const newScale = [...(template?.grade_scale || DEFAULT_ACHIEVEMENT_STANDARDS)];
        newScale[index] = { ...newScale[index], [field]: field === 'min' || field === 'max' ? parseInt(value) || 0 : value };
        setTemplate({ ...template, grade_scale: newScale });
    };

    // Social skills categories management
    const addSkillCategory = () => {
        const newCategories = [...(template?.social_skills_categories || [])];
        newCategories.push({ category_name: 'New Category', skills: [''] });
        setTemplate({ ...template, social_skills_categories: newCategories });
    };

    const removeSkillCategory = (index) => {
        const newCategories = [...(template?.social_skills_categories || [])].filter((_, i) => i !== index);
        setTemplate({ ...template, social_skills_categories: newCategories });
    };

    const updateCategoryName = (index, name) => {
        const newCategories = [...(template?.social_skills_categories || [])];
        newCategories[index] = { ...newCategories[index], category_name: name };
        setTemplate({ ...template, social_skills_categories: newCategories });
    };

    const addSkillToCategory = (categoryIndex) => {
        const newCategories = [...(template?.social_skills_categories || [])];
        newCategories[categoryIndex].skills = [...newCategories[categoryIndex].skills, ''];
        setTemplate({ ...template, social_skills_categories: newCategories });
    };

    const removeSkillFromCategory = (categoryIndex, skillIndex) => {
        const newCategories = [...(template?.social_skills_categories || [])];
        newCategories[categoryIndex].skills = newCategories[categoryIndex].skills.filter((_, i) => i !== skillIndex);
        setTemplate({ ...template, social_skills_categories: newCategories });
    };

    const updateSkillInCategory = (categoryIndex, skillIndex, value) => {
        const newCategories = [...(template?.social_skills_categories || [])];
        newCategories[categoryIndex].skills[skillIndex] = value;
        setTemplate({ ...template, social_skills_categories: newCategories });
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
                        {template?.use_weighted_grading && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Award className="w-4 h-4" />
                                <span>Weighted grading enabled</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Selection Controls */}
            <Card className="rounded-2xl border-border shadow-sm">
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
                <Card className="rounded-2xl border-border shadow-sm bg-primary/5">
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
                    <TabsList className="grid w-full rounded-2xl h-12 grid-cols-2 max-w-md">
                        <TabsTrigger value="grades" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            <BookOpen className="w-4 h-4 mr-2" />
                            Academic Grades
                        </TabsTrigger>
                    </TabsList>

                    {/* Academic Grades Tab */}
                    <TabsContent value="grades" className="mt-6">
                        <Card className="rounded-2xl border-border shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <BookOpen className="w-5 h-5" />
                                    MHPS Assessment Entry
                                </CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    Weights: HW 5% | GW 5% | Project 10% | Quiz 10% | Mid-Term 30% | End of Term 40%
                                </p>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b bg-muted/30">
                                                    <th className="text-left p-2 w-40 font-semibold">Subject</th>
                                                    {tplComponents.map(comp => (
                                                        <th key={comp.key} className="text-center p-2 w-16">
                                                            <div className="font-semibold">{comp.label}</div>
                                                            <div className="text-[10px] text-muted-foreground font-normal">({comp.weight}%)</div>
                                                        </th>
                                                    ))}
                                                    <th className="text-center p-2 w-20 bg-primary/10 font-semibold">Weighted</th>
                                                    <th className="text-center p-2 w-16 bg-primary/10 font-semibold">Grade</th>
                                                    <th className="text-left p-2 font-semibold">Comment</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {subjects.map(subject => {
                                                    const gradeData = grades[subject] || {};
                                                    const weightedScore = calcWeightedFromWeights(gradeData, tplWeights);
                                                    const gradeInfo = getGradeFromScale(weightedScore, tplGradeScale);
                                                    
                                                    return (
                                                        <tr key={subject} className="border-b hover:bg-muted/30">
                                                            <td className="p-2 font-medium">{subject}</td>
                                                            {tplComponents.map(comp => (
                                                                <td key={comp.key} className="p-1">
                                                                    <Input
                                                                        type="number"
                                                                        min="0"
                                                                        max="100"
                                                                        value={gradeData[comp.key] ?? ''}
                                                                        onChange={(e) => handleGradeChange(subject, comp.key, e.target.value)}
                                                                        className="w-14 h-8 text-center rounded-lg text-sm"
                                                                        placeholder="-"
                                                                    />
                                                                </td>
                                                            ))}
                                                            <td className="p-2 text-center font-bold bg-primary/5">
                                                                {weightedScore > 0 ? weightedScore.toFixed(1) : '-'}
                                                            </td>
                                                            <td className={`p-2 text-center font-bold bg-primary/5 ${getGradeColor(gradeInfo.grade)}`}>
                                                                {gradeInfo.grade || 'U'}
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
                        <Card className="rounded-2xl border-border shadow-sm">
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
                                {/* Default skills list - always show these */}
                                <div className="space-y-3">
                                    {[
                                        'Completes Assignments',
                                        'Follows Instructions',
                                        'Punctuality',
                                        'Deportment',
                                        'Courteous in Speech and Action',
                                        'Respect for Teacher',
                                        'Respect for Peers'
                                    ].map(skill => (
                                        <div key={skill} className="flex items-center justify-between p-4 rounded-xl bg-muted/30">
                                            <Label className="text-sm font-medium">{skill}</Label>
                                            <Select
                                                value={socialSkills[skill] || ''}
                                                onValueChange={(value) => handleSkillChange(skill, value)}
                                            >
                                                <SelectTrigger className="w-48 rounded-xl h-9">
                                                    <SelectValue placeholder="Select rating..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="EX">EX - Excellent</SelectItem>
                                                    <SelectItem value="VG">VG - Very Good</SelectItem>
                                                    <SelectItem value="G">G - Good</SelectItem>
                                                    <SelectItem value="NI">NI - Needs Improvement</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ))}
                                </div>

                                {/* Rating Key */}
                                <div className="mt-6 p-4 rounded-xl bg-primary/5">
                                    <h5 className="font-bold mb-2 text-sm">Rating Key:</h5>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                        <div className="px-3 py-1.5 rounded-lg bg-background text-sm">
                                            <strong>EX</strong> = Excellent
                                        </div>
                                        <div className="px-3 py-1.5 rounded-lg bg-background text-sm">
                                            <strong>VG</strong> = Very Good
                                        </div>
                                        <div className="px-3 py-1.5 rounded-lg bg-background text-sm">
                                            <strong>G</strong> = Good
                                        </div>
                                        <div className="px-3 py-1.5 rounded-lg bg-background text-sm">
                                            <strong>NI</strong> = Needs Improvement
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
                <Card className="rounded-2xl border-border shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-sm">MHPS Grading Scale</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-4 md:grid-cols-8 gap-2 text-xs">
                            {tplGradeScale.map(g => (
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
