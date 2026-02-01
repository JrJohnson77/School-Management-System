import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Toaster, toast } from 'sonner';
import { GraduationCap, Building2, User, Lock, Loader2 } from 'lucide-react';

export default function LoginPage() {
    const [loading, setLoading] = useState(false);
    const [schoolCode, setSchoolCode] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        
        try {
            await login(schoolCode, username, password);
            toast.success('Welcome back!');
            navigate('/dashboard');
        } catch (error) {
            const message = error.response?.data?.detail || 'Invalid credentials';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen gradient-hero flex items-center justify-center p-6">
            <Toaster position="top-right" richColors />
            
            <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8 items-center">
                {/* Left side - Hero */}
                <div className="hidden md:flex flex-col animate-fade-in">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center">
                            <GraduationCap className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-extrabold text-primary">EduManager</h1>
                            <p className="text-sm text-muted-foreground">Multi-School Management</p>
                        </div>
                    </div>
                    
                    <h2 className="text-4xl md:text-5xl font-extrabold text-foreground mb-4 leading-tight">
                        Managing Education,<br />
                        <span className="text-primary">Made Simple</span>
                    </h2>
                    
                    <p className="text-lg text-muted-foreground mb-8">
                        A comprehensive multi-tenant platform for schools to manage student information, attendance, grades, and generate report cards.
                    </p>
                    
                    <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                        <img 
                            src="https://images.unsplash.com/photo-1769201153045-98827f62996b?crop=entropy&cs=srgb&fm=jpg&q=85&w=800"
                            alt="Students learning"
                            className="w-full h-64 object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                    </div>
                </div>

                {/* Right side - Login Form */}
                <Card className="rounded-3xl border-border/50 shadow-[0_8px_30px_rgb(0,0,0,0.08)] animate-fade-in stagger-2">
                    <CardHeader className="space-y-1 pb-4">
                        <div className="md:hidden flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center">
                                <GraduationCap className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-extrabold text-primary">EduManager</h1>
                                <p className="text-xs text-muted-foreground">Multi-School Management</p>
                            </div>
                        </div>
                        <CardTitle className="text-2xl font-bold">
                            Welcome Back
                        </CardTitle>
                        <CardDescription>
                            Sign in with your school code and credentials
                        </CardDescription>
                    </CardHeader>
                    
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="schoolCode">School Code</Label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                    <Input
                                        id="schoolCode"
                                        type="text"
                                        placeholder="Enter school code (e.g., JTECH)"
                                        value={schoolCode}
                                        onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                                        className="pl-10 rounded-xl h-12 uppercase"
                                        required
                                        data-testid="login-school-code-input"
                                    />
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <Label htmlFor="username">Username</Label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                    <Input
                                        id="username"
                                        type="text"
                                        placeholder="Enter your username"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="pl-10 rounded-xl h-12"
                                        required
                                        data-testid="login-username-input"
                                    />
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                    <Input
                                        id="password"
                                        type="password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pl-10 rounded-xl h-12"
                                        required
                                        data-testid="login-password-input"
                                    />
                                </div>
                            </div>
                            
                            <Button 
                                type="submit" 
                                className="w-full rounded-full h-12 font-bold text-base shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
                                disabled={loading}
                                data-testid="login-submit-btn"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        Signing in...
                                    </>
                                ) : (
                                    'Sign In'
                                )}
                            </Button>
                        </form>
                        
                        <div className="mt-6 text-center">
                            <p className="text-sm text-muted-foreground">
                                Contact your school administrator for login credentials
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
