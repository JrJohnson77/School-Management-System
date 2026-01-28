import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Toaster, toast } from 'sonner';
import { GraduationCap, Mail, Lock, User, Loader2 } from 'lucide-react';

export default function LoginPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'parent'
    });
    
    const { login, register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        
        try {
            if (isLogin) {
                await login(formData.email, formData.password);
                toast.success('Welcome back!');
            } else {
                await register(formData.name, formData.email, formData.password, formData.role);
                toast.success('Account created successfully!');
            }
            navigate('/dashboard');
        } catch (error) {
            const message = error.response?.data?.detail || 'Something went wrong';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
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
                            <p className="text-sm text-muted-foreground">Primary School System</p>
                        </div>
                    </div>
                    
                    <h2 className="text-4xl md:text-5xl font-extrabold text-foreground mb-4 leading-tight">
                        Managing Education,<br />
                        <span className="text-primary">Made Simple</span>
                    </h2>
                    
                    <p className="text-lg text-muted-foreground mb-8">
                        A comprehensive platform for administrators, teachers, and parents to manage student information, attendance, and grades.
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
                                <p className="text-xs text-muted-foreground">Primary School System</p>
                            </div>
                        </div>
                        <CardTitle className="text-2xl font-bold">
                            {isLogin ? 'Welcome Back' : 'Create Account'}
                        </CardTitle>
                        <CardDescription>
                            {isLogin 
                                ? 'Enter your credentials to access your account' 
                                : 'Fill in your details to get started'}
                        </CardDescription>
                    </CardHeader>
                    
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {!isLogin && (
                                <div className="space-y-2">
                                    <Label htmlFor="name">Full Name</Label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                        <Input
                                            id="name"
                                            name="name"
                                            placeholder="John Doe"
                                            value={formData.name}
                                            onChange={handleChange}
                                            className="pl-10 rounded-xl h-12"
                                            required={!isLogin}
                                            data-testid="register-name-input"
                                        />
                                    </div>
                                </div>
                            )}
                            
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                    <Input
                                        id="email"
                                        name="email"
                                        type="email"
                                        placeholder="you@example.com"
                                        value={formData.email}
                                        onChange={handleChange}
                                        className="pl-10 rounded-xl h-12"
                                        required
                                        data-testid="login-email-input"
                                    />
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                    <Input
                                        id="password"
                                        name="password"
                                        type="password"
                                        placeholder="••••••••"
                                        value={formData.password}
                                        onChange={handleChange}
                                        className="pl-10 rounded-xl h-12"
                                        required
                                        data-testid="login-password-input"
                                    />
                                </div>
                            </div>
                            
                            {!isLogin && (
                                <div className="space-y-2">
                                    <Label>I am a</Label>
                                    <Select 
                                        value={formData.role} 
                                        onValueChange={(value) => setFormData({ ...formData, role: value })}
                                    >
                                        <SelectTrigger className="rounded-xl h-12" data-testid="register-role-select">
                                            <SelectValue placeholder="Select your role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="parent">Parent</SelectItem>
                                            <SelectItem value="teacher">Teacher</SelectItem>
                                            <SelectItem value="admin">Administrator</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            
                            <Button 
                                type="submit" 
                                className="w-full rounded-full h-12 font-bold text-base shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
                                disabled={loading}
                                data-testid="login-submit-btn"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        {isLogin ? 'Signing in...' : 'Creating account...'}
                                    </>
                                ) : (
                                    isLogin ? 'Sign In' : 'Create Account'
                                )}
                            </Button>
                        </form>
                        
                        <div className="mt-6 text-center">
                            <button
                                type="button"
                                onClick={() => setIsLogin(!isLogin)}
                                className="text-sm text-muted-foreground hover:text-primary transition-colors"
                                data-testid="toggle-auth-mode-btn"
                            >
                                {isLogin 
                                    ? "Don't have an account? Sign up" 
                                    : 'Already have an account? Sign in'}
                            </button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
