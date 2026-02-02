import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { 
    FileText,
    Loader2,
    Printer,
    Users,
    GraduationCap,
    BookOpen,
    ClipboardList,
    Download
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TERMS = ['Term 1', 'Term 2', 'Term 3'];
const CURRENT_YEAR = new Date().getFullYear();
const ACADEMIC_YEARS = [
    `${CURRENT_YEAR-1}-${CURRENT_YEAR}`, 
    `${CURRENT_YEAR}-${CURRENT_YEAR+1}`,
    `${CURRENT_YEAR+1}-${CURRENT_YEAR+2}`
];

const SUBJECTS = [
    'English Language', 'Mathematics', 'Science', 'Social Studies', 
    'Religious Education', 'Physical Education', 'Creative Arts', 
    'Music', 'ICT', 'French'
];

// ==================== CLASS LIST REPORT ====================
const ClassListReport = ({ students, classInfo }) => {
    return (
        <div className="report-page bg-white p-8 max-w-4xl mx-auto print:shadow-none">
            <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
                <h1 className="text-2xl font-bold">CLASS LIST</h1>
                <h2 className="text-xl">{classInfo?.name || 'Class'}</h2>
                <p className="text-sm text-gray-600">Grade {classInfo?.grade_level} | Academic Year {classInfo?.academic_year}</p>
                {classInfo?.teacher_name && (
                    <p className="text-sm mt-1">Class Teacher: {classInfo.teacher_name}</p>
                )}
            </div>
            
            <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="border border-gray-300 p-2 text-left w-10">#</th>
                        <th className="border border-gray-300 p-2 text-left">Student ID</th>
                        <th className="border border-gray-300 p-2 text-left">Name</th>
                        <th className="border border-gray-300 p-2 text-center">Gender</th>
                        <th className="border border-gray-300 p-2 text-center">Age</th>
                        <th className="border border-gray-300 p-2 text-left">House</th>
                        <th className="border border-gray-300 p-2 text-left">Parent Contact</th>
                    </tr>
                </thead>
                <tbody>
                    {students.map((student, index) => (
                        <tr key={student.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="border border-gray-300 p-2">{index + 1}</td>
                            <td className="border border-gray-300 p-2 font-mono text-xs">{student.student_id || '-'}</td>
                            <td className="border border-gray-300 p-2 font-medium">
                                {student.first_name} {student.middle_name || ''} {student.last_name}
                            </td>
                            <td className="border border-gray-300 p-2 text-center">{student.gender?.[0] || '-'}</td>
                            <td className="border border-gray-300 p-2 text-center">{student.age || '-'}</td>
                            <td className="border border-gray-300 p-2">{student.house || '-'}</td>
                            <td className="border border-gray-300 p-2">{student.emergency_contact || '-'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            
            <div className="mt-6 flex justify-between text-sm text-gray-600">
                <p>Total Students: {students.length}</p>
                <p>Male: {students.filter(s => s.gender === 'Male').length} | Female: {students.filter(s => s.gender === 'Female').length}</p>
            </div>
            
            <div className="mt-8 text-right text-xs text-gray-400">
                Generated on {new Date().toLocaleDateString()}
            </div>
        </div>
    );
};

// ==================== GRADEBOOK REPORT ====================
const GradebookReport = ({ students, grades, classInfo, term, academicYear }) => {
    // Flatten grades from gradebook entries - each entry has a subjects array
    const flattenedGrades = [];
    grades.forEach(entry => {
        if (entry.subjects && Array.isArray(entry.subjects)) {
            entry.subjects.forEach(subj => {
                flattenedGrades.push({
                    student_id: entry.student_id,
                    term: entry.term,
                    subject: subj.subject,
                    score: subj.score,
                    grade: subj.grade,
                    comment: subj.comment
                });
            });
        }
    });

    // Group grades by student
    const getStudentGrades = (studentId) => {
        const studentGrades = flattenedGrades.filter(g => g.student_id === studentId);
        const gradeMap = {};
        studentGrades.forEach(g => {
            gradeMap[g.subject] = g;
        });
        return gradeMap;
    };

    // Calculate average for a student
    const calculateAverage = (studentId) => {
        const studentGrades = flattenedGrades.filter(g => g.student_id === studentId);
        if (studentGrades.length === 0) return '-';
        const total = studentGrades.reduce((sum, g) => sum + (g.score || 0), 0);
        return (total / studentGrades.length).toFixed(1);
    };

    return (
        <div className="report-page bg-white p-4 max-w-6xl mx-auto print:shadow-none overflow-x-auto">
            <div className="text-center border-b-2 border-gray-800 pb-4 mb-4">
                <h1 className="text-2xl font-bold">GRADEBOOK REPORT</h1>
                <h2 className="text-xl">{classInfo?.name || 'Class'}</h2>
                <p className="text-sm text-gray-600">{term} | Academic Year {academicYear}</p>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300 text-xs">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="border border-gray-300 p-1 text-left w-8">#</th>
                            <th className="border border-gray-300 p-1 text-left min-w-[150px]">Student Name</th>
                            {SUBJECTS.map(subject => (
                                <th key={subject} className="border border-gray-300 p-1 text-center" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', height: '100px' }}>
                                    {subject}
                                </th>
                            ))}
                            <th className="border border-gray-300 p-1 text-center font-bold">Avg</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map((student, index) => {
                            const studentGrades = getStudentGrades(student.id);
                            return (
                                <tr key={student.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="border border-gray-300 p-1">{index + 1}</td>
                                    <td className="border border-gray-300 p-1 font-medium">
                                        {student.first_name} {student.last_name}
                                    </td>
                                    {SUBJECTS.map(subject => (
                                        <td key={subject} className="border border-gray-300 p-1 text-center">
                                            {studentGrades[subject]?.score ?? '-'}
                                        </td>
                                    ))}
                                    <td className="border border-gray-300 p-1 text-center font-bold bg-gray-100">
                                        {calculateAverage(student.id)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                    <h4 className="font-bold mb-2">Grading Key:</h4>
                    <div className="grid grid-cols-4 gap-1 text-xs">
                        <span>A+ (90-100)</span>
                        <span>A (85-89)</span>
                        <span>A- (80-84)</span>
                        <span>B (75-79)</span>
                        <span>B- (70-74)</span>
                        <span>C (65-69)</span>
                        <span>C- (60-64)</span>
                        <span>D (55-59)</span>
                        <span>D- (50-54)</span>
                        <span>E (40-49)</span>
                        <span>U (0-39)</span>
                    </div>
                </div>
                <div className="text-right">
                    <p>Total Students: {students.length}</p>
                    <p className="text-xs text-gray-400 mt-2">Generated on {new Date().toLocaleDateString()}</p>
                </div>
            </div>
        </div>
    );
};

// ==================== TERM REPORT CARD ====================
const TermReportCard = ({ data, classInfo, term, academicYear, gradingScheme }) => {
    const { student, grades, attendance_summary, position } = data;
    
    const getTermDates = () => {
        const year = parseInt(academicYear.split('/')[0]);
        if (term === 'Term 1') {
            return { start: `Sep 1, ${year}`, end: `Dec 15, ${year}` };
        } else if (term === 'Term 2') {
            return { start: `Jan 10, ${year + 1}`, end: `Apr 15, ${year + 1}` };
        } else {
            return { start: `Apr 27, ${year + 1}`, end: `Aug 31, ${year + 1}` };
        }
    };

    const termDates = getTermDates();
    
    const attendanceRate = attendance_summary?.total_days > 0 
        ? ((attendance_summary.present / attendance_summary.total_days) * 100).toFixed(1)
        : '0.0';

    // Calculate totals
    const totalScore = grades.reduce((sum, g) => sum + (g.score || 0), 0);
    const averageScore = grades.length > 0 ? (totalScore / grades.length).toFixed(1) : '0.0';

    return (
        <div className="report-card bg-white p-8 max-w-4xl mx-auto mb-8 print:shadow-none print:mb-0 print:page-break-after-always" style={{ fontFamily: 'Arial, sans-serif' }}>
            {/* Header */}
            <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
                <div className="flex justify-center items-center gap-4 mb-2">
                    <span className="text-4xl">🎓</span>
                    <div>
                        <h1 className="text-2xl font-bold">END OF TERM REPORT</h1>
                        <p className="text-lg">{term} - Academic Year {academicYear}</p>
                    </div>
                </div>
            </div>
            
            {/* Student Info */}
            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                <div className="space-y-1">
                    <p><strong>Student Name:</strong> {student.first_name} {student.middle_name || ''} {student.last_name}</p>
                    <p><strong>Student ID:</strong> {student.student_id || '-'}</p>
                    <p><strong>Class:</strong> {classInfo?.name || '-'}</p>
                </div>
                <div className="space-y-1">
                    <p><strong>Age:</strong> {student.age} years</p>
                    <p><strong>Gender:</strong> {student.gender}</p>
                    <p><strong>House:</strong> {student.house || '-'}</p>
                </div>
            </div>
            
            {/* Grades Table */}
            <table className="w-full border-collapse border border-gray-300 text-sm mb-6">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="border border-gray-300 p-2 text-left">Subject</th>
                        <th className="border border-gray-300 p-2 text-center w-16">Score</th>
                        <th className="border border-gray-300 p-2 text-center w-16">Grade</th>
                        <th className="border border-gray-300 p-2 text-left">Comment</th>
                    </tr>
                </thead>
                <tbody>
                    {SUBJECTS.map(subject => {
                        const grade = grades.find(g => g.subject === subject);
                        const gradeInfo = gradingScheme?.find(gs => 
                            grade && grade.score >= gs.min && grade.score <= gs.max
                        );
                        return (
                            <tr key={subject}>
                                <td className="border border-gray-300 p-2">{subject}</td>
                                <td className="border border-gray-300 p-2 text-center">{grade?.score ?? '-'}</td>
                                <td className="border border-gray-300 p-2 text-center font-bold">{gradeInfo?.grade || '-'}</td>
                                <td className="border border-gray-300 p-2 text-xs">{grade?.comment || '-'}</td>
                            </tr>
                        );
                    })}
                </tbody>
                <tfoot>
                    <tr className="bg-gray-100 font-bold">
                        <td className="border border-gray-300 p-2">Average</td>
                        <td className="border border-gray-300 p-2 text-center">{averageScore}</td>
                        <td className="border border-gray-300 p-2 text-center" colSpan={2}>
                            Position: {position?.position || '-'} of {position?.total || '-'}
                        </td>
                    </tr>
                </tfoot>
            </table>
            
            {/* Attendance & Comments */}
            <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="border border-gray-300 p-4">
                    <h4 className="font-bold mb-2">Attendance Summary</h4>
                    <p>Days Present: {attendance_summary?.present || 0}</p>
                    <p>Days Absent: {attendance_summary?.absent || 0}</p>
                    <p>Attendance Rate: {attendanceRate}%</p>
                </div>
                <div className="border border-gray-300 p-4">
                    <h4 className="font-bold mb-2">Teacher's Comment</h4>
                    <p className="text-sm italic">{student.teacher_comment || 'Good progress this term.'}</p>
                </div>
            </div>
            
            {/* Signatures */}
            <div className="grid grid-cols-3 gap-4 mt-8 pt-4 border-t border-gray-300">
                <div className="text-center">
                    <div className="border-b border-gray-400 mb-1 h-8"></div>
                    <p className="text-sm">Class Teacher</p>
                </div>
                <div className="text-center">
                    <div className="border-b border-gray-400 mb-1 h-8"></div>
                    <p className="text-sm">Head Teacher</p>
                </div>
                <div className="text-center">
                    <div className="border-b border-gray-400 mb-1 h-8"></div>
                    <p className="text-sm">Parent/Guardian</p>
                </div>
            </div>
        </div>
    );
};

// ==================== MAIN REPORTS PAGE ====================
export default function ReportsPage() {
    const [classes, setClasses] = useState([]);
    const [students, setStudents] = useState([]);
    const [grades, setGrades] = useState([]);
    const [gradingScheme, setGradingScheme] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedTerm, setSelectedTerm] = useState(TERMS[0]);
    const [selectedYear, setSelectedYear] = useState(ACADEMIC_YEARS[0]);
    const [reportCards, setReportCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [activeTab, setActiveTab] = useState('class-list');
    const printRef = useRef();
    const { isAdmin, isTeacher } = useAuth();

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const [classesRes, schemeRes] = await Promise.all([
                axios.get(`${API}/classes`),
                axios.get(`${API}/grading-scheme`)
            ]);
            setClasses(classesRes.data);
            setGradingScheme(schemeRes.data.grading_scheme || []);
        } catch (error) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const fetchClassData = async () => {
        if (!selectedClass) {
            toast.error('Please select a class');
            return;
        }
        
        setGenerating(true);
        try {
            const [studentsRes, gradesRes] = await Promise.all([
                axios.get(`${API}/students?class_id=${selectedClass}`),
                axios.get(`${API}/gradebook?class_id=${selectedClass}&term=${selectedTerm}&academic_year=${selectedYear}`)
            ]);
            
            const classStudentsList = studentsRes.data.filter(s => s.class_id === selectedClass);
            setStudents(classStudentsList);
            setGrades(gradesRes.data);
            
            if (classStudentsList.length === 0) {
                toast.info('No students found in this class');
            } else {
                toast.success(`Loaded ${classStudentsList.length} students`);
            }
        } catch (error) {
            toast.error('Failed to fetch class data');
        } finally {
            setGenerating(false);
        }
    };

    const generateTermReports = async () => {
        if (!selectedClass) {
            toast.error('Please select a class');
            return;
        }
        
        setGenerating(true);
        try {
            const response = await axios.get(
                `${API}/report-cards/class/${selectedClass}?term=${selectedTerm}&academic_year=${selectedYear}`
            );
            setReportCards(response.data);
            toast.success(`Generated ${response.data.length} report cards`);
        } catch (error) {
            toast.error('Failed to generate report cards');
        } finally {
            setGenerating(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const selectedClassInfo = classes.find(c => c.id === selectedClass);
    const classStudents = students.filter(s => s.class_id === selectedClass);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6" data-testid="reports-page">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
                    <p className="text-muted-foreground">Generate various reports for your classes</p>
                </div>
            </div>

            {/* Report Type Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 rounded-2xl h-12">
                    <TabsTrigger value="class-list" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <Users className="w-4 h-4 mr-2" />
                        Class List
                    </TabsTrigger>
                    <TabsTrigger value="gradebook" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <BookOpen className="w-4 h-4 mr-2" />
                        Gradebook
                    </TabsTrigger>
                    <TabsTrigger value="term-reports" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <FileText className="w-4 h-4 mr-2" />
                        Term Reports
                    </TabsTrigger>
                </TabsList>

                {/* Selection Controls */}
                <Card className="mt-6 rounded-3xl border-border/50 shadow-sm">
                    <CardContent className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <Label>Select Class *</Label>
                                <Select value={selectedClass} onValueChange={setSelectedClass}>
                                    <SelectTrigger className="rounded-xl" data-testid="report-class-select">
                                        <SelectValue placeholder="Select a class" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {classes.map(cls => (
                                            <SelectItem key={cls.id} value={cls.id}>
                                                {cls.name} (Grade {cls.grade_level})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            {(activeTab === 'gradebook' || activeTab === 'term-reports') && (
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
                            )}
                            
                            {(activeTab === 'gradebook' || activeTab === 'term-reports') && (
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
                            )}
                            
                            <div className="flex items-end gap-2">
                                <Button
                                    onClick={activeTab === 'term-reports' ? generateTermReports : fetchClassData}
                                    disabled={!selectedClass || generating}
                                    className="rounded-full flex-1"
                                    data-testid="generate-report-btn"
                                >
                                    {generating ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <FileText className="w-4 h-4 mr-2" />
                                    )}
                                    Generate
                                </Button>
                                {((activeTab === 'class-list' && classStudents.length > 0) ||
                                  (activeTab === 'gradebook' && classStudents.length > 0) ||
                                  (activeTab === 'term-reports' && reportCards.length > 0)) && (
                                    <Button
                                        variant="outline"
                                        onClick={handlePrint}
                                        className="rounded-full"
                                        data-testid="print-report-btn"
                                    >
                                        <Printer className="w-4 h-4 mr-2" />
                                        Print
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Report Content */}
                <TabsContent value="class-list" className="mt-6">
                    {classStudents.length > 0 ? (
                        <div ref={printRef} className="print-content">
                            <ClassListReport 
                                students={classStudents} 
                                classInfo={selectedClassInfo}
                            />
                        </div>
                    ) : (
                        <Card className="rounded-3xl border-border/50 shadow-sm">
                            <CardContent className="py-16">
                                <div className="text-center">
                                    <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                                    <h3 className="text-lg font-semibold mb-2">No Data</h3>
                                    <p className="text-muted-foreground">
                                        Select a class and click Generate to view the class list
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="gradebook" className="mt-6">
                    {classStudents.length > 0 ? (
                        <div ref={printRef} className="print-content">
                            <GradebookReport 
                                students={classStudents} 
                                grades={grades}
                                classInfo={selectedClassInfo}
                                term={selectedTerm}
                                academicYear={selectedYear}
                            />
                        </div>
                    ) : (
                        <Card className="rounded-3xl border-border/50 shadow-sm">
                            <CardContent className="py-16">
                                <div className="text-center">
                                    <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                                    <h3 className="text-lg font-semibold mb-2">No Data</h3>
                                    <p className="text-muted-foreground">
                                        Select a class, term, and year then click Generate to view gradebook
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="term-reports" className="mt-6">
                    {reportCards.length > 0 ? (
                        <div ref={printRef} className="print-content space-y-8">
                            {reportCards.map((data, index) => (
                                <TermReportCard
                                    key={data.student.id}
                                    data={data}
                                    classInfo={selectedClassInfo}
                                    term={selectedTerm}
                                    academicYear={selectedYear}
                                    gradingScheme={gradingScheme}
                                />
                            ))}
                        </div>
                    ) : (
                        <Card className="rounded-3xl border-border/50 shadow-sm">
                            <CardContent className="py-16">
                                <div className="text-center">
                                    <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                                    <h3 className="text-lg font-semibold mb-2">No Report Cards</h3>
                                    <p className="text-muted-foreground">
                                        Select a class, term, and year then click Generate to create term reports
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>

            {/* Print Styles */}
            <style>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .print-content, .print-content * {
                        visibility: visible;
                    }
                    .print-content {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                    .report-card {
                        page-break-after: always;
                    }
                    .report-page {
                        page-break-after: always;
                    }
                }
            `}</style>
        </div>
    );
}
