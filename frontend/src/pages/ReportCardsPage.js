import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { 
    FileText,
    Loader2,
    Download,
    Printer,
    Award,
    Users,
    Calendar,
    MapPin,
    GraduationCap
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

const ReportCard = ({ data, classInfo, term, academicYear }) => {
    const { student, grades, attendance_summary, position } = data;
    
    return (
        <div className="report-card bg-white p-8 rounded-2xl border border-border shadow-lg mb-6 print:shadow-none print:border-0 print:mb-0 print:page-break-after-always">
            {/* Header */}
            <div className="text-center border-b-2 border-primary pb-4 mb-6">
                <h1 className="text-2xl font-bold text-primary">Student Report Card</h1>
                <p className="text-muted-foreground">{term} - Academic Year {academicYear}</p>
            </div>

            {/* Student Info */}
            <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="space-y-2">
                    <div className="flex gap-2">
                        <span className="font-semibold w-32">Name:</span>
                        <span>{student.first_name} {student.middle_name || ''} {student.last_name}</span>
                    </div>
                    <div className="flex gap-2">
                        <span className="font-semibold w-32">Date of Birth:</span>
                        <span>{student.date_of_birth}</span>
                    </div>
                    <div className="flex gap-2">
                        <span className="font-semibold w-32">Age:</span>
                        <span>{student.age} years</span>
                    </div>
                    <div className="flex gap-2">
                        <span className="font-semibold w-32">Gender:</span>
                        <span>{student.gender}</span>
                    </div>
                </div>
                <div className="space-y-2">
                    <div className="flex gap-2">
                        <span className="font-semibold w-32">Class:</span>
                        <span>{classInfo?.name || '-'}</span>
                    </div>
                    <div className="flex gap-2">
                        <span className="font-semibold w-32">House:</span>
                        <span>{student.house || '-'}</span>
                    </div>
                    {position && (
                        <div className="flex gap-2">
                            <span className="font-semibold w-32">Class Position:</span>
                            <span className="font-bold text-primary">{position}</span>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <span className="font-semibold w-32">Address:</span>
                        <span className="text-sm">{student.address || '-'}</span>
                    </div>
                </div>
            </div>

            {/* Grades Table */}
            {grades && grades.subjects && grades.subjects.length > 0 ? (
                <div className="mb-6">
                    <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                        <GraduationCap className="w-5 h-5 text-primary" />
                        Academic Performance
                    </h3>
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-primary/10">
                                <th className="border border-border p-2 text-left">Subject</th>
                                <th className="border border-border p-2 text-center w-20">Score</th>
                                <th className="border border-border p-2 text-center w-16">Grade</th>
                                <th className="border border-border p-2 text-center w-20">Points</th>
                                <th className="border border-border p-2 text-left">Teacher's Comment</th>
                            </tr>
                        </thead>
                        <tbody>
                            {grades.subjects.map((subj, idx) => (
                                <tr key={idx} className={idx % 2 === 0 ? 'bg-muted/20' : ''}>
                                    <td className="border border-border p-2">{subj.subject}</td>
                                    <td className="border border-border p-2 text-center font-medium">{subj.score}%</td>
                                    <td className={`border border-border p-2 text-center font-bold ${getGradeColor(subj.grade)}`}>
                                        {subj.grade}
                                    </td>
                                    <td className="border border-border p-2 text-center">{subj.points}</td>
                                    <td className="border border-border p-2 text-sm text-muted-foreground">
                                        {subj.comment || '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-primary/20 font-bold">
                                <td className="border border-border p-2">Overall</td>
                                <td className="border border-border p-2 text-center">{grades.overall_score}%</td>
                                <td className={`border border-border p-2 text-center ${getGradeColor(grades.overall_grade)}`}>
                                    {grades.overall_grade}
                                </td>
                                <td className="border border-border p-2 text-center">{grades.overall_points}</td>
                                <td className="border border-border p-2 text-sm">{grades.overall_domain}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            ) : (
                <div className="mb-6 p-4 bg-muted/30 rounded-xl text-center text-muted-foreground">
                    No grades recorded for this term
                </div>
            )}

            {/* Attendance Summary */}
            <div className="mb-6">
                <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    Attendance Summary
                </h3>
                <div className="grid grid-cols-5 gap-4 text-center">
                    <div className="p-3 bg-muted/30 rounded-xl">
                        <div className="text-2xl font-bold">{attendance_summary?.total_days || 0}</div>
                        <div className="text-sm text-muted-foreground">Total Days</div>
                    </div>
                    <div className="p-3 bg-green-50 rounded-xl">
                        <div className="text-2xl font-bold text-green-600">{attendance_summary?.present || 0}</div>
                        <div className="text-sm text-muted-foreground">Present</div>
                    </div>
                    <div className="p-3 bg-red-50 rounded-xl">
                        <div className="text-2xl font-bold text-red-600">{attendance_summary?.absent || 0}</div>
                        <div className="text-sm text-muted-foreground">Absent</div>
                    </div>
                    <div className="p-3 bg-yellow-50 rounded-xl">
                        <div className="text-2xl font-bold text-yellow-600">{attendance_summary?.late || 0}</div>
                        <div className="text-sm text-muted-foreground">Late</div>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-xl">
                        <div className="text-2xl font-bold text-blue-600">{attendance_summary?.excused || 0}</div>
                        <div className="text-sm text-muted-foreground">Excused</div>
                    </div>
                </div>
            </div>

            {/* Teacher Comment */}
            {student.teacher_comment && (
                <div className="mb-6">
                    <h3 className="font-bold text-lg mb-2">Teacher's General Comment</h3>
                    <div className="p-4 bg-muted/30 rounded-xl italic">
                        "{student.teacher_comment}"
                    </div>
                </div>
            )}

            {/* Signature Line */}
            <div className="grid grid-cols-3 gap-8 mt-8 pt-4 border-t border-border">
                <div className="text-center">
                    <div className="border-t border-foreground mt-12 pt-2">Class Teacher</div>
                </div>
                <div className="text-center">
                    <div className="border-t border-foreground mt-12 pt-2">Principal</div>
                </div>
                <div className="text-center">
                    <div className="border-t border-foreground mt-12 pt-2">Parent/Guardian</div>
                </div>
            </div>
        </div>
    );
};

export default function ReportCardsPage() {
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedTerm, setSelectedTerm] = useState(TERMS[0]);
    const [selectedYear, setSelectedYear] = useState(ACADEMIC_YEARS[0]);
    
    const [reportData, setReportData] = useState(null);
    const printRef = useRef();
    
    const { isAdmin, isTeacher } = useAuth();

    useEffect(() => {
        fetchClasses();
    }, []);

    const fetchClasses = async () => {
        try {
            const response = await axios.get(`${API}/classes`);
            setClasses(response.data);
            if (response.data.length > 0) {
                setSelectedClass(response.data[0].id);
            }
        } catch (error) {
            toast.error('Failed to load classes');
        } finally {
            setLoading(false);
        }
    };

    const generateReports = async () => {
        if (!selectedClass) {
            toast.error('Please select a class');
            return;
        }

        setGenerating(true);
        try {
            const response = await axios.get(`${API}/report-cards/class/${selectedClass}`, {
                params: {
                    term: selectedTerm,
                    academic_year: selectedYear
                }
            });
            setReportData(response.data);
            toast.success(`Generated ${response.data.total_students} report cards`);
        } catch (error) {
            toast.error('Failed to generate report cards');
        } finally {
            setGenerating(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div data-testid="report-cards-page">
            {/* Header - Hide on print */}
            <div className="print:hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-extrabold text-foreground">Report Cards</h1>
                        <p className="text-muted-foreground">
                            Generate and print report cards for entire class
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
                                    <SelectTrigger className="rounded-xl" data-testid="report-class-select">
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
                                <Label className="mb-2 block">Term</Label>
                                <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                                    <SelectTrigger className="rounded-xl" data-testid="report-term-select">
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
                                    <SelectTrigger className="rounded-xl" data-testid="report-year-select">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ACADEMIC_YEARS.map(year => (
                                            <SelectItem key={year} value={year}>{year}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div className="flex items-end gap-2">
                                <Button 
                                    onClick={generateReports}
                                    className="rounded-full shadow-md flex-1"
                                    disabled={generating}
                                    data-testid="generate-reports-btn"
                                >
                                    {generating ? (
                                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                    ) : (
                                        <FileText className="w-5 h-5 mr-2" />
                                    )}
                                    Generate
                                </Button>
                                
                                {reportData && (
                                    <Button 
                                        onClick={handlePrint}
                                        variant="outline"
                                        className="rounded-full"
                                        data-testid="print-reports-btn"
                                    >
                                        <Printer className="w-5 h-5" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Summary Card */}
                {reportData && (
                    <Card className="rounded-3xl border-border/50 shadow-sm mb-6">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                                        <Users className="w-7 h-7 text-primary" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold">{reportData.class_info?.name}</h2>
                                        <p className="text-muted-foreground">
                                            {reportData.total_students} students • {reportData.term} • {reportData.academic_year}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-3xl font-bold text-primary">{reportData.total_students}</div>
                                    <p className="text-sm text-muted-foreground">Report Cards Ready</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Report Cards */}
            {reportData && reportData.report_cards && (
                <div ref={printRef} className="print:p-0">
                    {reportData.report_cards.map((card, index) => (
                        <ReportCard 
                            key={card.student.id}
                            data={card}
                            classInfo={reportData.class_info}
                            term={reportData.term}
                            academicYear={reportData.academic_year}
                        />
                    ))}
                </div>
            )}

            {/* Empty State */}
            {!reportData && (
                <Card className="rounded-3xl border-border/50 shadow-sm print:hidden">
                    <CardContent className="py-16">
                        <div className="empty-state">
                            <FileText className="empty-state-icon" />
                            <h3 className="text-lg font-semibold mb-2">No Report Cards Generated</h3>
                            <p className="text-muted-foreground">
                                Select a class and click Generate to create report cards
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Print Styles */}
            <style>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .report-card, .report-card * {
                        visibility: visible;
                    }
                    .report-card {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        page-break-after: always;
                    }
                }
            `}</style>
        </div>
    );
}
