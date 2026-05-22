import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { Loader2, Plus, Edit2, AlertTriangle, CheckCircle2, Clock, X } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function DisciplinePage() {
    const { token } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [incidents, setIncidents] = useState([]);
    const [students, setStudents] = useState([]);
    const [showDialog, setShowDialog] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        student_id: '', date: '', type: 'Minor', description: '', action_taken: '', status: 'Open', follow_up: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [incRes, studRes] = await Promise.all([
                axios.get(`${API}/discipline`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API}/students`, { headers: { Authorization: `Bearer ${token}` } })
            ]);
            setIncidents(incRes.data);
            setStudents(studRes.data);
        } catch (error) {
            toast.error('Failed to load discipline records');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        setSaving(true);
        try {
            if (editingItem) {
                await axios.put(`${API}/discipline/${editingItem.id}`, formData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                toast.success('Updated successfully');
            } else {
                await axios.post(`${API}/discipline`, formData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                toast.success('Created successfully');
            }
            setShowDialog(false);
            setEditingItem(null);
            fetchData();
        } catch (error) {
            const msg = error?.response?.data?.detail || 'Failed to save';
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    const getStatusColor = (status) => {
        if (status === 'Resolved') return 'bg-green-500';
        if (status === 'In Progress') return 'bg-amber-500';
        return 'bg-red-500';
    };

    const getTypeColor = (type) => {
        if (type === 'Major') return 'bg-red-100 text-red-800';
        if (type === 'Moderate') return 'bg-amber-100 text-amber-800';
        return 'bg-blue-100 text-blue-800';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Discipline</h1>
                    <p className="text-muted-foreground">Track and manage disciplinary incidents</p>
                </div>
                <Button onClick={() => { setEditingItem(null); setFormData({ student_id: '', date: new Date().toISOString().split('T')[0], type: 'Minor', description: '', action_taken: '', status: 'Open', follow_up: '' }); setShowDialog(true); }} className="rounded-xl">
                    <Plus className="w-4 h-4 mr-2" />
                    New Incident
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <Card className="rounded-2xl">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-red-500/10"><AlertTriangle className="w-6 h-6 text-red-600" /></div>
                            <div>
                                <p className="text-sm text-muted-foreground">Total Incidents</p>
                                <p className="text-2xl font-bold">{incidents.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-amber-500/10"><Clock className="w-6 h-6 text-amber-600" /></div>
                            <div>
                                <p className="text-sm text-muted-foreground">Open</p>
                                <p className="text-2xl font-bold">{incidents.filter(i => i.status === 'Open').length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-blue-500/10"><Clock className="w-6 h-6 text-blue-600" /></div>
                            <div>
                                <p className="text-sm text-muted-foreground">In Progress</p>
                                <p className="text-2xl font-bold">{incidents.filter(i => i.status === 'In Progress').length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-green-500/10"><CheckCircle2 className="w-6 h-6 text-green-600" /></div>
                            <div>
                                <p className="text-sm text-muted-foreground">Resolved</p>
                                <p className="text-2xl font-bold">{incidents.filter(i => i.status === 'Resolved').length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="rounded-2xl">
                <CardHeader>
                    <CardTitle>Incidents</CardTitle>
                </CardHeader>
                <CardContent>
                    {incidents.length === 0 ? (
                        <div className="text-center py-12">
                            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-20" />
                            <h3 className="text-lg font-medium mb-2">No incidents recorded</h3>
                            <p className="text-muted-foreground mb-4">Start by adding a new incident</p>
                            <Button onClick={() => { setEditingItem(null); setFormData({ student_id: '', date: new Date().toISOString().split('T')[0], type: 'Minor', description: '', action_taken: '', status: 'Open', follow_up: '' }); setShowDialog(true); }} className="rounded-xl">
                                <Plus className="w-4 h-4 mr-2" />
                                Add Incident
                            </Button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-muted/50 sticky top-0">
                                    <tr>
                                        <th className="text-left p-3 font-medium">Date</th>
                                        <th className="text-left p-3 font-medium">Student</th>
                                        <th className="text-left p-3 font-medium">Type</th>
                                        <th className="text-left p-3 font-medium">Description</th>
                                        <th className="text-left p-3 font-medium">Action Taken</th>
                                        <th className="text-left p-3 font-medium">Status</th>
                                        <th className="text-right p-3 font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {incidents.map((item, idx) => {
                                        const student = students.find(s => s.id === item.student_id);
                                        return (
                                            <tr key={item.id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                                                <td className="p-3">{new Date(item.date).toLocaleDateString()}</td>
                                                <td className="p-3">{student ? `${student.first_name} ${student.last_name}` : 'Unknown'}</td>
                                                <td className="p-3">
                                                    <Badge className={getTypeColor(item.type)}>{item.type}</Badge>
                                                </td>
                                                <td className="p-3 max-w-xs truncate">{item.description}</td>
                                                <td className="p-3 max-w-xs truncate">{item.action_taken || '-'}</td>
                                                <td className="p-3">
                                                    <Badge className={getStatusColor(item.status)}>{item.status}</Badge>
                                                </td>
                                                <td className="p-3 text-right space-x-2">
                                                    <Button size="sm" variant="outline" onClick={() => { setEditingItem(item); setFormData(item); setShowDialog(true); }} className="rounded-lg">
                                                        <Edit2 className="w-4 h-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="rounded-2xl max-w-2xl p-6">
                    <button onClick={() => setShowDialog(false)} className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100" data-testid="discipline-dialog-close">
                        <X className="h-4 w-4" />
                    </button>
                    <DialogHeader>
                        <DialogTitle>{editingItem ? 'Edit' : 'New'} Incident</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Student*</Label>
                                <Select value={formData.student_id} onValueChange={(val) => setFormData({...formData, student_id: val})}>
                                    <SelectTrigger className="rounded-lg"><SelectValue placeholder="Select student" /></SelectTrigger>
                                    <SelectContent>
                                        {students.map(s => (
                                            <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.student_id})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Date*</Label>
                                <Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="rounded-lg" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Type*</Label>
                                <Select value={formData.type} onValueChange={(val) => setFormData({...formData, type: val})}>
                                    <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Minor">Minor</SelectItem>
                                        <SelectItem value="Moderate">Moderate</SelectItem>
                                        <SelectItem value="Major">Major</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Status*</Label>
                                <Select value={formData.status} onValueChange={(val) => setFormData({...formData, status: val})}>
                                    <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Open">Open</SelectItem>
                                        <SelectItem value="In Progress">In Progress</SelectItem>
                                        <SelectItem value="Resolved">Resolved</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div>
                            <Label>Description*</Label>
                            <Textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="rounded-lg" rows={3} />
                        </div>
                        <div>
                            <Label>Action Taken</Label>
                            <Textarea value={formData.action_taken} onChange={(e) => setFormData({...formData, action_taken: e.target.value})} className="rounded-lg" rows={2} />
                        </div>
                        <div>
                            <Label>Follow-up Notes</Label>
                            <Textarea value={formData.follow_up} onChange={(e) => setFormData({...formData, follow_up: e.target.value})} className="rounded-lg" rows={2} />
                        </div>
                    </div>
                    <DialogFooter className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowDialog(false)} className="rounded-xl" data-testid="discipline-cancel-btn">Cancel</Button>
                        <Button onClick={handleSubmit} disabled={saving || !formData.student_id || !formData.description} className="rounded-xl" data-testid="discipline-save-btn">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            {editingItem ? 'Update' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
