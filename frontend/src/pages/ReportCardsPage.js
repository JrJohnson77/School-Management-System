import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { 
    FileText,
    Loader2,
    Printer,
    Users,
    GraduationCap
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TERMS = ['Term 1', 'Term 2', 'Term 3'];
const CURRENT_YEAR = new Date().getFullYear();
const ACADEMIC_YEARS = [`${CURRENT_YEAR-1}/${CURRENT_YEAR}`, `${CURRENT_YEAR}/${CURRENT_YEAR+1}`];

// School info - can be made configurable
const SCHOOL_INFO = {
    name: "Sunshine Primary School",
    address: "123 Education Avenue, Learning City",
    logo: "🎓" // Can be replaced with actual logo URL
};

const ReportCard = ({ data, classInfo, term, academicYear, gradingScheme }) => {
    const { student, grades, attendance_summary, position } = data;
    
    // Get teacher name for class
    const getTeacherName = () => {
        return classInfo?.teacher_name || "Class Teacher";
    };

    // Calculate term dates (sample - would come from backend in real app)
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
    
    // Calculate attendance rate
    const attendanceRate = attendance_summary?.total_days > 0 
        ? ((attendance_summary.present / attendance_summary.total_days) * 100).toFixed(1)
        : '0.0';

    return (
        <div className="report-card bg-white p-8 max-w-4xl mx-auto mb-8 print:shadow-none print:mb-0 print:page-break-after-always" style={{ fontFamily: 'Arial, sans-serif' }}>
            {/* Header */}
            <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
                <div className="text-4xl mb-2">{SCHOOL_INFO.logo}</div>
                <h1 className="text-2xl font-bold uppercase tracking-wide">{SCHOOL_INFO.name}</h1>
                <p className="text-gray-600">{SCHOOL_INFO.address}</p>
                <p className="text-lg font-semibold mt-2">{term} {academicYear}</p>
            </div>

            {/* Student Details and Term Summary - Two Column Layout */}
            <div className="grid grid-cols-2 gap-8 mb-6">
                {/* Left: Student Details */}
                <div>
                    <h3 className="font-bold text-sm uppercase bg-gray-200 px-2 py-1 mb-2">Student Details</h3>
                    <div className="text-lg font-bold mb-3">
                        Name: {student.first_name} {student.middle_name || ''} {student.last_name}
                    </div>
                    <table className="w-full text-sm border-collapse">
                        <tbody>
                            <tr>
                                <td className="border border-gray-400 px-2 py-1 bg-gray-100 font-semibold w-1/3">Age</td>
                                <td className="border border-gray-400 px-2 py-1">{student.age} years</td>
                            </tr>
                            <tr>
                                <td className="border border-gray-400 px-2 py-1 bg-gray-100 font-semibold">Form</td>
                                <td className="border border-gray-400 px-2 py-1">{classInfo?.grade_level || '-'}</td>
                            </tr>
                            <tr>
                                <td className="border border-gray-400 px-2 py-1 bg-gray-100 font-semibold">Class</td>
                                <td className="border border-gray-400 px-2 py-1">{classInfo?.name || '-'}</td>
                            </tr>
                            <tr>
                                <td className="border border-gray-400 px-2 py-1 bg-gray-100 font-semibold">House</td>
                                <td className="border border-gray-400 px-2 py-1">{student.house || '-'}</td>
                            </tr>
                            <tr>
                                <td className="border border-gray-400 px-2 py-1 bg-gray-100 font-semibold">Form Teacher</td>
                                <td className="border border-gray-400 px-2 py-1">{getTeacherName()}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Right: Term Results Summary */}
                <div>
                    <h3 className="font-bold text-sm uppercase bg-gray-200 px-2 py-1 mb-2">Term Results Summary</h3>
                    <table className="w-full text-sm border-collapse">
                        <tbody>
                            <tr>
                                <td className="border border-gray-400 px-2 py-1 bg-gray-100 font-semibold">Term Starts</td>
                                <td className="border border-gray-400 px-2 py-1">{termDates.start}</td>
                            </tr>
                            <tr>
                                <td className="border border-gray-400 px-2 py-1 bg-gray-100 font-semibold">Term Ends</td>
                                <td className="border border-gray-400 px-2 py-1">{termDates.end}</td>
                            </tr>
                            <tr>
                                <td className="border border-gray-400 px-2 py-1 bg-gray-100 font-semibold">Class Position</td>
                                <td className="border border-gray-400 px-2 py-1 font-bold text-primary">{position || '-'}</td>
                            </tr>
                            <tr>
                                <td className="border border-gray-400 px-2 py-1 bg-gray-100 font-semibold">Attendance Rate</td>
                                <td className="border border-gray-400 px-2 py-1">{attendanceRate}%</td>
                            </tr>
                            <tr>
                                <td className="border border-gray-400 px-2 py-1 bg-gray-100 font-semibold">Term Average</td>
                                <td className="border border-gray-400 px-2 py-1 font-bold">{grades?.overall_score?.toFixed(1) || '0.0'}%</td>
                            </tr>
                            <tr>
                                <td className="border border-gray-400 px-2 py-1 bg-gray-100 font-semibold">GPA</td>
                                <td className="border border-gray-400 px-2 py-1 font-bold">{grades?.overall_points?.toFixed(1) || '0.0'}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Subject Performance Table */}
            <div className="mb-6">
                <h3 className="font-bold text-sm uppercase bg-gray-800 text-white px-2 py-2 mb-0">Subject Performance</h3>
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="bg-gray-200">
                            <th className="border border-gray-400 px-2 py-2 text-left">Subject</th>
                            <th className="border border-gray-400 px-2 py-2 text-center w-20">Score</th>
                            <th className="border border-gray-400 px-2 py-2 text-center w-16">Grade</th>
                            <th className="border border-gray-400 px-2 py-2 text-center w-16">Points</th>
                            <th className="border border-gray-400 px-2 py-2 text-left">Teacher's Comment</th>
                        </tr>
                    </thead>
                    <tbody>
                        {grades && grades.subjects && grades.subjects.length > 0 ? (
                            grades.subjects.map((subj, idx) => (
                                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="border border-gray-400 px-2 py-1 font-medium">{subj.subject}</td>
                                    <td className="border border-gray-400 px-2 py-1 text-center">{subj.score}%</td>
                                    <td className="border border-gray-400 px-2 py-1 text-center font-bold">{subj.grade}</td>
                                    <td className="border border-gray-400 px-2 py-1 text-center">{subj.points}</td>
                                    <td className="border border-gray-400 px-2 py-1 text-gray-600 text-xs">{subj.comment || '-'}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="5" className="border border-gray-400 px-2 py-4 text-center text-gray-500">
                                    No grades recorded for this term
                                </td>
                            </tr>
                        )}
                    </tbody>
                    {grades && grades.subjects && grades.subjects.length > 0 && (
                        <tfoot>
                            <tr className="bg-gray-800 text-white font-bold">
                                <td className="border border-gray-400 px-2 py-2">OVERALL</td>
                                <td className="border border-gray-400 px-2 py-2 text-center">{grades.overall_score?.toFixed(1)}%</td>
                                <td className="border border-gray-400 px-2 py-2 text-center">{grades.overall_grade}</td>
                                <td className="border border-gray-400 px-2 py-2 text-center">{grades.overall_points?.toFixed(1)}</td>
                                <td className="border border-gray-400 px-2 py-2 text-xs">{grades.overall_domain}</td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            {/* Attendance Summary */}
            <div className="mb-6">
                <h3 className="font-bold text-sm uppercase bg-gray-200 px-2 py-1 mb-2">Attendance Record</h3>
                <div className="grid grid-cols-5 gap-2 text-center text-sm">
                    <div className="border border-gray-400 p-2">
                        <div className="font-bold text-lg">{attendance_summary?.total_days || 0}</div>
                        <div className="text-xs text-gray-600">Total Days</div>
                    </div>
                    <div className="border border-gray-400 p-2 bg-green-50">
                        <div className="font-bold text-lg text-green-600">{attendance_summary?.present || 0}</div>
                        <div className="text-xs text-gray-600">Present</div>
                    </div>
                    <div className="border border-gray-400 p-2 bg-red-50">
                        <div className="font-bold text-lg text-red-600">{attendance_summary?.absent || 0}</div>
                        <div className="text-xs text-gray-600">Absent</div>
                    </div>
                    <div className="border border-gray-400 p-2 bg-yellow-50">
                        <div className="font-bold text-lg text-yellow-600">{attendance_summary?.late || 0}</div>
                        <div className="text-xs text-gray-600">Late</div>
                    </div>
                    <div className="border border-gray-400 p-2 bg-blue-50">
                        <div className="font-bold text-lg text-blue-600">{attendance_summary?.excused || 0}</div>
                        <div className="text-xs text-gray-600">Excused</div>
                    </div>
                </div>
            </div>

            {/* Teacher Comments */}
            <div className="mb-6">
                <h3 className="font-bold text-sm uppercase bg-gray-200 px-2 py-1 mb-2">Teacher Comments</h3>
                <div className="border border-gray-400 p-3 min-h-[80px] bg-gray-50">
                    {student.teacher_comment ? (
                        <p className="italic">"{student.teacher_comment}"</p>
                    ) : (
                        <p className="text-gray-400 italic">No comments recorded.</p>
                    )}
                </div>
            </div>

            {/* Grading Scheme */}
            <div className="mb-6">
                <h3 className="font-bold text-sm uppercase bg-gray-800 text-white px-2 py-1 mb-0">Grading Scheme</h3>
                <table className="w-full text-xs border-collapse">
                    <thead>
                        <tr className="bg-gray-200">
                            <th className="border border-gray-400 px-2 py-1 text-left">Domain</th>
                            <th className="border border-gray-400 px-2 py-1 text-center">Score</th>
                            <th className="border border-gray-400 px-2 py-1 text-center">Grade</th>
                        </tr>
                    </thead>
                    <tbody>
                        {gradingScheme && gradingScheme.map((scheme, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="border border-gray-400 px-2 py-1">{scheme.domain}</td>
                                <td className="border border-gray-400 px-2 py-1 text-center">{scheme.min} - {scheme.max}</td>
                                <td className="border border-gray-400 px-2 py-1 text-center font-bold">{scheme.grade}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Signature Lines */}
            <div className="grid grid-cols-3 gap-8 mt-8 pt-4">
                <div className="text-center">
                    <div className="border-t-2 border-gray-800 mt-12 pt-2 text-sm font-semibold">Class Teacher</div>
                </div>
                <div className="text-center">
                    <div className="border-t-2 border-gray-800 mt-12 pt-2 text-sm font-semibold">Principal</div>
                </div>
                <div className="text-center">
                    <div className="border-t-2 border-gray-800 mt-12 pt-2 text-sm font-semibold">Parent/Guardian</div>
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
                            gradingScheme={reportData.grading_scheme}
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
                        position: relative;
                        width: 100%;
                        page-break-after: always;
                        margin: 0;
                        padding: 20px;
                        box-shadow: none;
                    }
                    @page {
                        size: A4;
                        margin: 10mm;
                    }
                }
            `}</style>
        </div>
    );
}
