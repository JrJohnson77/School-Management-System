import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Loader2, ArrowLeft, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ForgotPasswordPage() {
    const navigate = useNavigate();
    const [step, setStep] = useState('request'); // 'request' or 'reset'
    const [submitting, setSubmitting] = useState(false);
    const [schoolCode, setSchoolCode] = useState('');
    const [username, setUsername] = useState('');
    const [token, setToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const handleRequest = async (e) => {
        e.preventDefault();
        if (!schoolCode || !username) return toast.error('School code and username are required');
        setSubmitting(true);
        try {
            await axios.post(`${API}/auth/forgot-password`, {
                school_code: schoolCode.toUpperCase(),
                username: username.toLowerCase(),
            });
            toast.success('If the account exists, a reset code has been sent to the email on file.');
            setStep('reset');
        } catch (error) {
            const msg = error?.response?.data?.detail || 'Request failed';
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const handleReset = async (e) => {
        e.preventDefault();
        if (!token) return toast.error('Token is required');
        if (newPassword.length < 8) return toast.error('Password must be at least 8 characters');
        if (newPassword !== confirmPassword) return toast.error('Passwords do not match');
        setSubmitting(true);
        try {
            await axios.post(`${API}/auth/reset-password`, {
                token: token.trim(),
                new_password: newPassword,
            });
            toast.success('Password reset successful — you can now sign in.');
            setTimeout(() => navigate('/login'), 800);
        } catch (error) {
            const msg = error?.response?.data?.detail || 'Reset failed';
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4" data-testid="forgot-password-page">
            <Card className="w-full max-w-md rounded-2xl shadow-xl">
                <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                            <KeyRound className="w-5 h-5 text-violet-600" />
                        </div>
                        <CardTitle>{step === 'request' ? 'Forgot password' : 'Reset password'}</CardTitle>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {step === 'request'
                            ? "Enter your school code and username — we'll send you a reset token."
                            : 'Paste the token you received and choose a new password.'}
                    </p>
                </CardHeader>
                <CardContent>
                    {step === 'request' ? (
                        <form onSubmit={handleRequest} className="space-y-4">
                            <div>
                                <Label>School Code</Label>
                                <Input
                                    value={schoolCode}
                                    onChange={(e) => setSchoolCode(e.target.value)}
                                    placeholder="e.g. SUNF"
                                    className="rounded-lg"
                                    data-testid="forgot-school-code"
                                />
                            </div>
                            <div>
                                <Label>Username</Label>
                                <Input
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="your.username"
                                    className="rounded-lg"
                                    data-testid="forgot-username"
                                />
                            </div>
                            <Button type="submit" disabled={submitting} className="w-full rounded-xl" data-testid="forgot-submit-btn">
                                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Request reset token
                            </Button>
                        </form>
                    ) : (
                        <form onSubmit={handleReset} className="space-y-4">
                            <div>
                                <Label>Reset Token</Label>
                                <Input
                                    value={token}
                                    onChange={(e) => setToken(e.target.value)}
                                    placeholder="Paste token here"
                                    className="rounded-lg font-mono text-sm"
                                    data-testid="reset-token-input"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Check the email associated with your Lumina-SIS account. The code is valid for 1 hour.
                                </p>
                            </div>
                            <div>
                                <Label>New Password</Label>
                                <Input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="At least 8 characters"
                                    className="rounded-lg"
                                    data-testid="reset-new-password"
                                />
                            </div>
                            <div>
                                <Label>Confirm Password</Label>
                                <Input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="rounded-lg"
                                    data-testid="reset-confirm-password"
                                />
                            </div>
                            <Button type="submit" disabled={submitting} className="w-full rounded-xl" data-testid="reset-submit-btn">
                                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Reset password
                            </Button>
                        </form>
                    )}

                    <div className="mt-6 pt-4 border-t">
                        <Link to="/login" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
                            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                            Back to login
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
