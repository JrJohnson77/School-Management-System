import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Loader2, Users, CheckCircle2, XCircle, ArrowUpCircle, UserX, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

export default function ReEnrollmentPage() {
    const { token } = useAuth();
    const [loading, setLoading] = useState(true);
    const [academicYears, setAcademicYears] = useState([]);
    const [fromYear, setFromYear] = useState('');
    const [toYear, setToYear] = useState('');
    const [preview, setPreview] = useState([]);
    const [selectedStudents, setSelectedStudents] = useState(new Set());
    const [bulkAction, setBulkAction] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        fetchAcademicYears();
    }, []);

    const fetchAcademicYears = async () => {
        setLoading(true);
        try {
            // Fetch from school settings
            const res = await axios.get(`${API}/schools`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data && res.data.length > 0) {
                const school = res.data[0];
                const years = school.academic_years || [];
                setAcademicYears(years.map(y => y.year));
                
                // Auto-select current year as "from"
                const current = years.find(y => y.is_current);
                if (current) setFromYear(current.year);
            }
        } catch (error) {
            toast.error('Failed to load academic years');
        } finally {
            setLoading(false);
        }
    };

    const fetchPreview = async () => {
        if (!fromYear || !toYear) {
            toast.error('Please select both years');
            return;
        }
        setLoading(true);
        try {
            const res = await axios.get(`${API}/enrollment/preview?from_year=${fromYear}&to_year=${toYear}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPreview(res.data);
            setSelectedStudents(new Set());
        } catch (error) {
            toast.error('Failed to load preview');
        } finally {
            setLoading(false);
        }
    };

    const handleActionChange = (studentId, action, targetClass) => {
        setPreview(prev => prev.map(s =>
            s.student_id === studentId ? { ...s, action, target_class_id: targetClass || s.target_class_id } : s
        ));
    };

    const handleBulkAction = () => {
        if (!bulkAction || selectedStudents.size === 0) return;
        setPreview(prev => prev.map(s =>
            selectedStudents.has(s.student_id) ? { ...s, action: bulkAction } : s
        ));
        toast.success(`Bulk action applied to ${selectedStudents.size} students`);
    };

    const handleExecute = async () => {
        setProcessing(true);
        try {
            const res = await axios.post(`${API}/enrollment/execute`, {
                from_year: fromYear,
                to_year: toYear,
                students: preview
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success(`Re-enrollment complete: ${res.data.promoted} promoted, ${res.data.retained} retained, ${res.data.graduated} graduated`);
            setShowConfirm(false);
            fetchPreview();
        } catch (error) {
            toast.error('Failed to execute re-enrollment');
        } finally {
            setProcessing(false);
        }
    };

    const toggleStudent = (id) => {
        setSelectedStudents(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const toggleAll = () => {
        if (selectedStudents.size === preview.length) {
            setSelectedStudents(new Set());
        } else {
            setSelectedStudents(new Set(preview.map(s => s.student_id)));
        }
    };

    if (loading && academicYears.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Re-Enrollment & Promotion</h1>
                <p className="text-muted-foreground">Promote students to the next academic year</p>
            </div>

            <Card className="rounded-2xl">
                <CardHeader>
                    <CardTitle>Select Academic Years</CardTitle>
                </CardHeader>
                <CardContent>
                    {academicYears.length === 0 ? (
                        <div className="text-center py-8">
                            <GraduationCap className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-20" />
                            <h3 className="text-lg font-medium mb-2">No academic years configured</h3>
                            <p className="text-muted-foreground">Configure academic years in School Settings first</p>
                        </div>
                    ) : (
                        <div className="flex items-end gap-4">
                            <div className="flex-1">
                                <label className="block text-sm font-medium mb-2">From Year</label>
                                <Select value={fromYear} onValueChange={setFromYear}>
                                    <SelectTrigger className="rounded-lg"><SelectValue placeholder="Select year" /></SelectTrigger>
                                    <SelectContent>
                                        {academicYears.map(year => (
                                            <SelectItem key={year} value={year}>{year}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium mb-2">To Year</label>
                                <Select value={toYear} onValueChange={setToYear}>
                                    <SelectTrigger className="rounded-lg"><SelectValue placeholder="Select year" /></SelectTrigger>
                                    <SelectContent>
                                        {academicYears.map(year => (
                                            <SelectItem key={year} value={year}>{year}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button onClick={fetchPreview} disabled={!fromYear || !toYear || loading} className="rounded-xl">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Load Preview
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {preview.length > 0 && (
                <>
                    <Card className="rounded-2xl">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle>Bulk Actions</CardTitle>
                                <div className="text-sm text-muted-foreground">
                                    {selectedStudents.size} of {preview.length} selected
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-4">
                                <Select value={bulkAction} onValueChange={setBulkAction}>
                                    <SelectTrigger className="w-[200px] rounded-lg"><SelectValue placeholder="Select action" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="promote">Promote</SelectItem>
                                        <SelectItem value="retain">Retain</SelectItem>
                                        <SelectItem value="graduate">Graduate</SelectItem>
                                        <SelectItem value="withdraw">Withdraw</SelectItem>
                                        <SelectItem value="no_change">No Change</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button onClick={handleBulkAction} disabled={!bulkAction || selectedStudents.size === 0} className="rounded-xl">
                                    Apply to Selected
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl">
                        <CardHeader>
                            <CardTitle>Student Actions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-muted/50 sticky top-0">
                                        <tr>
                                            <th className="text-left p-3">
                                                <Checkbox checked={selectedStudents.size === preview.length} onCheckedChange={toggleAll} />
                                            </th>
                                            <th className="text-left p-3 font-medium">Student</th>
                                            <th className="text-left p-3 font-medium">Current Class</th>
                                            <th className="text-left p-3 font-medium">Suggested</th>
                                            <th className="text-left p-3 font-medium">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {preview.map((item, idx) => (
                                            <tr key={item.student_id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                                                <td className="p-3">
                                                    <Checkbox checked={selectedStudents.has(item.student_id)} onCheckedChange={() => toggleStudent(item.student_id)} />
                                                </td>
                                                <td className="p-3">
                                                    <p className="font-medium">{item.student_name}</p>
                                                    <p className="text-sm text-muted-foreground">{item.student_id}</p>
                                                </td>
                                                <td className="p-3">{item.current_class}</td>
                                                <td className="p-3">{item.suggested_class || '-'}</td>
                                                <td className="p-3">
                                                    <Select value={item.action} onValueChange={(val) => handleActionChange(item.student_id, val)}>
                                                        <SelectTrigger className="w-[140px] rounded-lg"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="promote">Promote</SelectItem>
                                                            <SelectItem value="retain">Retain</SelectItem>
                                                            <SelectItem value="graduate">Graduate</SelectItem>
                                                            <SelectItem value="withdraw">Withdraw</SelectItem>
                                                            <SelectItem value="no_change">No Change</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-6 flex justify-end">
                                <Button onClick={() => setShowConfirm(true)} size="lg" className="rounded-xl">
                                    Execute Re-Enrollment
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}

            <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
                <DialogContent className="rounded-2xl p-6">
                    <DialogHeader>
                        <DialogTitle>Confirm Re-Enrollment</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="mb-4">You are about to process re-enrollment for <strong>{preview.length} students</strong> from <strong>{fromYear}</strong> to <strong>{toYear}</strong>.</p>
                        <div className="space-y-2 text-sm">
                            <p>• Promote: {preview.filter(s => s.action === 'promote').length}</p>
                            <p>• Retain: {preview.filter(s => s.action === 'retain').length}</p>
                            <p>• Graduate: {preview.filter(s => s.action === 'graduate').length}</p>
                            <p>• Withdraw: {preview.filter(s => s.action === 'withdraw').length}</p>
                            <p>• No Change: {preview.filter(s => s.action === 'no_change').length}</p>
                        </div>
                        <p className="mt-4 text-sm text-muted-foreground">This action cannot be undone.</p>
                    </div>
                    <DialogFooter className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowConfirm(false)} className="rounded-xl">Cancel</Button>
                        <Button onClick={handleExecute} disabled={processing} className="rounded-xl">
                            {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Confirm & Execute
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
