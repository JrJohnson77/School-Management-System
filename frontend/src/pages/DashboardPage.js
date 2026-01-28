import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { 
    Users, 
    GraduationCap, 
    School, 
    CalendarCheck, 
    TrendingUp,
    UserCheck,
    UserX,
    Clock,
    BarChart3,
    Loader2
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const StatCard = ({ icon: Icon, title, value, subtitle, color = 'primary', delay = 0 }) => (
    <div 
        className={`stat-card opacity-0 animate-fade-in`}
        style={{ animationDelay: `${delay}ms` }}
        data-testid={`stat-${title.toLowerCase().replace(/\s/g, '-')}`}
    >
        <div className="flex items-start justify-between">
            <div>
                <p className="text-sm text-muted-foreground mb-1">{title}</p>
                <p className="text-3xl font-extrabold text-foreground">{value}</p>
                {subtitle && (
                    <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
                )}
            </div>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                color === 'primary' ? 'bg-primary/10 text-primary' :
                color === 'secondary' ? 'bg-secondary/20 text-secondary-foreground' :
                color === 'accent' ? 'bg-accent/10 text-accent' :
                color === 'destructive' ? 'bg-destructive/10 text-destructive' :
                'bg-muted text-muted-foreground'
            }`}>
                <Icon className="w-6 h-6" />
            </div>
        </div>
    </div>
);

export default function DashboardPage() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [recentStudents, setRecentStudents] = useState([]);
    const { user, isAdmin, isTeacher, isParent } = useAuth();

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const [statsRes, studentsRes] = await Promise.all([
                axios.get(`${API}/stats/dashboard`),
                axios.get(`${API}/students`)
            ]);
            setStats(statsRes.data);
            setRecentStudents(studentsRes.data.slice(0, 5));
        } catch (error) {
            toast.error('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div data-testid="dashboard-page">
            {/* Welcome Header */}
            <div className="mb-8 opacity-0 animate-fade-in">
                <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mb-2">
                    Welcome back, {user?.name?.split(' ')[0]}!
                </h1>
                <p className="text-muted-foreground text-lg">
                    {isAdmin && "Here's an overview of your school's performance."}
                    {isTeacher && "Here's what's happening in your classes today."}
                    {isParent && "Here's how your children are doing."}
                </p>
            </div>

            {/* Stats Grid */}
            {(isAdmin || isTeacher) && (
                <div className="bento-grid mb-8">
                    <StatCard 
                        icon={GraduationCap} 
                        title="Total Students" 
                        value={stats?.total_students || 0}
                        color="primary"
                        delay={100}
                    />
                    <StatCard 
                        icon={School} 
                        title="Total Classes" 
                        value={stats?.total_classes || 0}
                        color="secondary"
                        delay={200}
                    />
                    <StatCard 
                        icon={Users} 
                        title="Teachers" 
                        value={stats?.total_teachers || 0}
                        color="accent"
                        delay={300}
                    />
                    <StatCard 
                        icon={TrendingUp} 
                        title="Average Grade" 
                        value={`${stats?.average_grade || 0}%`}
                        color="primary"
                        delay={400}
                    />
                </div>
            )}

            {/* Today's Attendance (Admin/Teacher) */}
            {(isAdmin || isTeacher) && (
                <div className="mb-8">
                    <h2 className="text-xl font-bold mb-4">Today's Attendance</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatCard 
                            icon={UserCheck} 
                            title="Present" 
                            value={stats?.today_present || 0}
                            color="accent"
                            delay={500}
                        />
                        <StatCard 
                            icon={UserX} 
                            title="Absent" 
                            value={stats?.today_absent || 0}
                            color="destructive"
                            delay={600}
                        />
                        <StatCard 
                            icon={Clock} 
                            title="Late" 
                            value={stats?.today_late || 0}
                            color="secondary"
                            delay={700}
                        />
                    </div>
                </div>
            )}

            {/* Parent Stats */}
            {isParent && (
                <div className="bento-grid mb-8">
                    <StatCard 
                        icon={GraduationCap} 
                        title="My Children" 
                        value={stats?.children_count || 0}
                        color="primary"
                        delay={100}
                    />
                    <StatCard 
                        icon={UserCheck} 
                        title="Days Present" 
                        value={stats?.attendance_present || 0}
                        subtitle="This month"
                        color="accent"
                        delay={200}
                    />
                    <StatCard 
                        icon={UserX} 
                        title="Days Absent" 
                        value={stats?.attendance_absent || 0}
                        subtitle="This month"
                        color="destructive"
                        delay={300}
                    />
                    <StatCard 
                        icon={TrendingUp} 
                        title="Average Grade" 
                        value={`${stats?.average_grade || 0}%`}
                        color="primary"
                        delay={400}
                    />
                </div>
            )}

            {/* Recent Students */}
            {recentStudents.length > 0 && (
                <Card className="rounded-3xl border-border/50 shadow-sm opacity-0 animate-fade-in" style={{ animationDelay: '800ms' }}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <GraduationCap className="w-5 h-5 text-primary" />
                            {isParent ? 'My Children' : 'Recent Students'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {recentStudents.map((student, index) => (
                                <div 
                                    key={student.id}
                                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors"
                                >
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                        {student.first_name?.[0]}{student.last_name?.[0]}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold">{student.first_name} {student.last_name}</p>
                                        <p className="text-sm text-muted-foreground">Grade {student.grade_level}</p>
                                    </div>
                                    <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                                        {student.gender}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Empty state if no data */}
            {recentStudents.length === 0 && (
                <Card className="rounded-3xl border-border/50 shadow-sm">
                    <CardContent className="py-16">
                        <div className="empty-state">
                            <GraduationCap className="empty-state-icon" />
                            <h3 className="text-lg font-semibold mb-2">No students yet</h3>
                            <p className="text-muted-foreground">
                                {isParent 
                                    ? 'No children have been assigned to your account yet.' 
                                    : 'Start by adding students to the system.'}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
