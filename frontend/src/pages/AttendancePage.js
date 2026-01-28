import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
    CalendarCheck, 
    Loader2,
    CalendarDays,
    UserCheck,
    UserX,
    Clock,
    AlertCircle,
    Save
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const statusConfig = {
    present: { label: 'Present', icon: UserCheck, class: 'badge-present', color: 'bg-accent/10 text-accent border-accent/20' },
    absent: { label: 'Absent', icon: UserX, class: 'badge-absent', color: 'bg-destructive/10 text-destructive border-destructive/20' },
    late: { label: 'Late', icon: Clock, class: 'badge-late', color: 'bg-secondary/20 text-secondary-foreground border-secondary/30' },
    excused: { label: 'Excused', icon: AlertCircle, class: 'badge-excused', color: 'bg-muted text-muted-foreground border-muted-foreground/20' }
};

export default function AttendancePage() {
    const [classes, setClasses] = useState([]);
    const [students, setStudents] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [attendanceRecords, setAttendanceRecords] = useState({});
    const { isAdmin, isTeacher, isParent } = useAuth();

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (selectedClass && selectedDate) {
            fetchAttendance();
        }
    }, [selectedClass, selectedDate]);

    const fetchInitialData = async () => {
        try {
            const [classesRes, studentsRes] = await Promise.all([
                axios.get(`${API}/classes`),
                axios.get(`${API}/students`)
            ]);
            setClasses(classesRes.data);
            setStudents(studentsRes.data);
            
            if (classesRes.data.length > 0) {
                setSelectedClass(classesRes.data[0].id);
            }
        } catch (error) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const fetchAttendance = async () => {
        try {
            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            const response = await axios.get(`${API}/attendance`, {
                params: { class_id: selectedClass, date: dateStr }
            });
            setAttendance(response.data);
            
            // Initialize records from fetched data
            const records = {};
            response.data.forEach(a => {
                records[a.student_id] = a.status;
            });
            setAttendanceRecords(records);
        } catch (error) {
            console.error('Failed to fetch attendance');
        }
    };

    const handleStatusChange = (studentId, status) => {
        setAttendanceRecords(prev => ({
            ...prev,
            [studentId]: status
        }));
    };

    const handleSaveAttendance = async () => {
        if (!selectedClass) {
            toast.error('Please select a class');
            return;
        }
        
        setSaving(true);
        try {
            const records = Object.entries(attendanceRecords).map(([student_id, status]) => ({
                student_id,
                status
            }));
            
            await axios.post(`${API}/attendance/bulk`, {
                class_id: selectedClass,
                date: format(selectedDate, 'yyyy-MM-dd'),
                records
            });
            
            toast.success('Attendance saved successfully');
            fetchAttendance();
        } catch (error) {
            toast.error('Failed to save attendance');
        } finally {
            setSaving(false);
        }
    };

    const classStudents = students.filter(s => s.class_id === selectedClass);
    const selectedClassName = classes.find(c => c.id === selectedClass)?.name || '';

    // For parents, show their children's attendance
    const parentAttendance = isParent ? attendance : [];

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div data-testid="attendance-page">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold text-foreground">Attendance</h1>
                    <p className="text-muted-foreground">
                        {isParent ? 'View your children\'s attendance records' : 'Track and manage daily attendance'}
                    </p>
                </div>
            </div>

            {/* Filters */}
            {(isAdmin || isTeacher) && (
                <Card className="rounded-3xl border-border/50 shadow-sm mb-6">
                    <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1">
                                <label className="text-sm font-medium mb-2 block">Select Class</label>
                                <Select value={selectedClass} onValueChange={setSelectedClass}>
                                    <SelectTrigger className="rounded-xl" data-testid="attendance-class-select">
                                        <SelectValue placeholder="Select a class" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {classes.map(cls => (
                                            <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div className="flex-1">
                                <label className="text-sm font-medium mb-2 block">Select Date</label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button 
                                            variant="outline" 
                                            className="w-full rounded-xl justify-start"
                                            data-testid="attendance-date-picker"
                                        >
                                            <CalendarDays className="w-4 h-4 mr-2" />
                                            {format(selectedDate, 'PPP')}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0 rounded-xl" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={selectedDate}
                                            onSelect={(date) => date && setSelectedDate(date)}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            
                            <div className="flex items-end">
                                <Button 
                                    onClick={handleSaveAttendance}
                                    className="rounded-full shadow-md"
                                    disabled={saving || classStudents.length === 0}
                                    data-testid="save-attendance-btn"
                                >
                                    {saving ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>
                                            <Save className="w-5 h-5 mr-2" />
                                            Save Attendance
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Attendance List (Admin/Teacher) */}
            {(isAdmin || isTeacher) && (
                <>
                    {classStudents.length > 0 ? (
                        <Card className="rounded-3xl border-border/50 shadow-sm">
                            <CardHeader className="pb-4">
                                <CardTitle className="flex items-center gap-2">
                                    <CalendarCheck className="w-5 h-5 text-primary" />
                                    {selectedClassName} - {format(selectedDate, 'MMMM d, yyyy')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {classStudents.map((student, index) => (
                                        <div 
                                            key={student.id}
                                            className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors opacity-0 animate-fade-in"
                                            style={{ animationDelay: `${index * 30}ms` }}
                                            data-testid={`attendance-row-${student.id}`}
                                        >
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                {student.first_name?.[0]}{student.last_name?.[0]}
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-semibold">{student.first_name} {student.last_name}</p>
                                                <p className="text-sm text-muted-foreground">Grade {student.grade_level}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                {Object.entries(statusConfig).map(([status, config]) => {
                                                    const Icon = config.icon;
                                                    const isSelected = attendanceRecords[student.id] === status;
                                                    return (
                                                        <Button
                                                            key={status}
                                                            variant={isSelected ? 'default' : 'outline'}
                                                            size="sm"
                                                            className={`rounded-full ${isSelected ? '' : 'hover:' + config.color}`}
                                                            onClick={() => handleStatusChange(student.id, status)}
                                                            data-testid={`attendance-${student.id}-${status}`}
                                                        >
                                                            <Icon className="w-4 h-4 mr-1" />
                                                            <span className="hidden sm:inline">{config.label}</span>
                                                        </Button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="rounded-3xl border-border/50 shadow-sm">
                            <CardContent className="py-16">
                                <div className="empty-state">
                                    <CalendarCheck className="empty-state-icon" />
                                    <h3 className="text-lg font-semibold mb-2">No students in this class</h3>
                                    <p className="text-muted-foreground">
                                        Assign students to this class to start taking attendance
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}

            {/* Parent View */}
            {isParent && (
                <Card className="rounded-3xl border-border/50 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CalendarCheck className="w-5 h-5 text-primary" />
                            Attendance History
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {students.length > 0 ? (
                            <div className="space-y-6">
                                {students.map(student => (
                                    <div key={student.id} className="space-y-3">
                                        <h3 className="font-semibold text-lg">
                                            {student.first_name} {student.last_name}
                                        </h3>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            {attendance
                                                .filter(a => a.student_id === student.id)
                                                .slice(0, 10)
                                                .map(record => {
                                                    const config = statusConfig[record.status];
                                                    return (
                                                        <div 
                                                            key={record.id}
                                                            className={`p-3 rounded-xl border ${config.color}`}
                                                        >
                                                            <p className="text-xs text-muted-foreground">{record.date}</p>
                                                            <p className="font-medium capitalize">{record.status}</p>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state py-8">
                                <CalendarCheck className="empty-state-icon" />
                                <p className="text-muted-foreground">No attendance records found</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
