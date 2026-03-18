import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Toaster, toast } from 'sonner';
import { Sparkles, Building2, User, Lock, Loader2, ArrowRight } from 'lucide-react';

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
        <div className="min-h-screen flex">
            <Toaster position="top-right" richColors />
            
            {/* Left Panel — Dark branding */}
            <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden" style={{ background: 'hsl(228, 33%, 10%)' }}>
                {/* Decorative elements */}
                <div className="absolute top-0 left-0 w-full h-full">
                    <div className="absolute top-20 -left-20 w-72 h-72 rounded-full opacity-10" 
                         style={{ background: 'radial-gradient(circle, hsl(243 75% 59%) 0%, transparent 70%)' }} />
                    <div className="absolute bottom-32 right-10 w-96 h-96 rounded-full opacity-8" 
                         style={{ background: 'radial-gradient(circle, hsl(260 70% 55%) 0%, transparent 70%)' }} />
                    <div className="absolute top-1/3 right-1/4 w-48 h-48 rounded-full opacity-5" 
                         style={{ background: 'radial-gradient(circle, hsl(38 92% 50%) 0%, transparent 70%)' }} />
                </div>

                {/* Grid pattern overlay */}
                <div className="absolute inset-0 opacity-[0.03]" 
                     style={{ backgroundImage: 'linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

                <div className="relative z-10 flex flex-col justify-between p-12 w-full">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center shadow-lg shadow-primary/30">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-white font-extrabold text-xl tracking-tight">Lumina-SIS</span>
                    </div>

                    {/* Hero content */}
                    <div className="space-y-6">
                        <div>
                            <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight tracking-tight">
                                Student Information,<br />
                                <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, hsl(243 75% 70%), hsl(260 70% 65%), hsl(38 92% 60%))' }}>
                                    Reimagined.
                                </span>
                            </h1>
                            <p className="text-base mt-4 leading-relaxed max-w-md" style={{ color: 'hsl(220, 14%, 55%)' }}>
                                A comprehensive multi-tenant platform to manage students, attendance, grades, and generate report cards — all in one place.
                            </p>
                        </div>

                        {/* Feature pills */}
                        <div className="flex flex-wrap gap-2">
                            {['Multi-tenant', 'Gradebook', 'Report Cards', 'Attendance'].map((feature) => (
                                <span key={feature} className="px-3 py-1.5 rounded-full text-xs font-medium border" 
                                      style={{ borderColor: 'hsl(220 14% 20%)', color: 'hsl(220 14% 55%)', background: 'hsl(220 14% 12%)' }}>
                                    {feature}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Bottom quote */}
                    <div className="pt-8">
                        <div className="h-px w-16 mb-4" style={{ background: 'hsl(243 75% 59% / 0.4)' }} />
                        <p className="text-sm italic" style={{ color: 'hsl(220, 14%, 40%)' }}>
                            "Simplifying education management for schools worldwide."
                        </p>
                    </div>
                </div>
            </div>

            {/* Right Panel — Login form */}
            <div className="flex-1 flex items-center justify-center p-6 md:p-12 bg-background">
                <div className="w-full max-w-md">
                    {/* Mobile logo */}
                    <div className="lg:hidden flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-extrabold text-xl tracking-tight text-foreground">Lumina-SIS</span>
                    </div>

                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-foreground tracking-tight">
                            Welcome back
                        </h2>
                        <p className="text-muted-foreground mt-1.5">
                            Sign in with your school code and credentials
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="schoolCode" className="text-sm font-medium">School Code</Label>
                            <div className="relative">
                                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="schoolCode"
                                    type="text"
                                    placeholder="Enter school code"
                                    value={schoolCode}
                                    onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                                    className="pl-10 h-11 rounded-lg uppercase bg-background border-border focus:border-primary focus:ring-2 focus:ring-primary/20"
                                    required
                                    data-testid="login-school-code-input"
                                />
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="username" className="text-sm font-medium">Username</Label>
                            <div className="relative">
                                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="username"
                                    type="text"
                                    placeholder="Enter your username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="pl-10 h-11 rounded-lg bg-background border-border focus:border-primary focus:ring-2 focus:ring-primary/20"
                                    required
                                    data-testid="login-username-input"
                                />
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-10 h-11 rounded-lg bg-background border-border focus:border-primary focus:ring-2 focus:ring-primary/20"
                                    required
                                    data-testid="login-password-input"
                                />
                            </div>
                        </div>
                        
                        <Button 
                            type="submit" 
                            className="w-full h-11 rounded-lg font-semibold text-sm gradient-primary border-0 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all duration-200 hover:-translate-y-0.5"
                            disabled={loading}
                            data-testid="login-submit-btn"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                <>
                                    Sign In
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </>
                            )}
                        </Button>
                    </form>
                    
                    <div className="mt-8 text-center">
                        <p className="text-sm text-muted-foreground">
                            Contact your school administrator for login credentials
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
