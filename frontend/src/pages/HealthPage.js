import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';
import { Loader2, Plus, Edit2, Trash2, Heart, Activity, Pill, Stethoscope, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

export default function HealthPage() {
    const { token } = useAuth();
    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [healthRecord, setHealthRecord] = useState(null);
    const [showDialog, setShowDialog] = useState(false);
    const [dialogType, setDialogType] = useState(''); // vaccination, allergy, condition, medication, visit
    const [formData, setFormData] = useState({});

    useEffect(() => {
        fetchStudents();
    }, []);

    const fetchStudents = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API}/students`, { headers: { Authorization: `Bearer ${token}` } });
            setStudents(res.data);
        } catch (error) {
            toast.error('Failed to load students');
        } finally {
            setLoading(false);
        }
    };

    const fetchHealthRecord = async (studentId) => {
        try {
            const res = await axios.get(`${API}/health/${studentId}`, { headers: { Authorization: `Bearer ${token}` } });
            setHealthRecord(res.data);
        } catch (error) {
            if (error.response?.status === 404) {
                setHealthRecord({ vaccinations: [], allergies: [], conditions: [], medications: [], visits: [] });
            } else {
                toast.error('Failed to load health record');
            }
        }
    };

    const handleStudentSelect = (student) => {
        setSelectedStudent(student);
        fetchHealthRecord(student.id);
    };

    const openDialog = (type) => {
        setDialogType(type);
        setFormData({});
        setShowDialog(true);
    };

    const handleSubmit = async () => {
        if (!selectedStudent) return;
        try {
            await axios.post(`${API}/health/${selectedStudent.id}/${dialogType}`, formData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Added successfully');
            setShowDialog(false);
            fetchHealthRecord(selectedStudent.id);
        } catch (error) {
            toast.error('Failed to save');
        }
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
                    <h1 className="text-3xl font-bold">Health Records</h1>
                    <p className="text-muted-foreground">Manage student health information</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <Card className="rounded-2xl lg:col-span-1">
                    <CardHeader>
                        <CardTitle>Students</CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-[600px] overflow-y-auto">
                        {students.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Activity className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                <p className="text-sm">No students found</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {students.map(student => (
                                    <button
                                        key={student.id}
                                        onClick={() => handleStudentSelect(student)}
                                        className={`w-full text-left p-3 rounded-xl hover:bg-muted/50 transition ${selectedStudent?.id === student.id ? 'bg-primary/10 border border-primary' : 'bg-muted/20'}`}
                                    >
                                        <p className="font-medium">{student.first_name} {student.last_name}</p>
                                        <p className="text-sm text-muted-foreground">{student.student_id}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="lg:col-span-3">
                    {!selectedStudent ? (
                        <Card className="rounded-2xl">
                            <CardContent className="flex items-center justify-center min-h-[400px]">
                                <div className="text-center">
                                    <Heart className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-20" />
                                    <h3 className="text-lg font-medium mb-2">No student selected</h3>
                                    <p className="text-muted-foreground">Select a student to view their health record</p>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            <Card className="rounded-2xl">
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <CardTitle>Health Record: {selectedStudent.first_name} {selectedStudent.last_name}</CardTitle>
                                    <div className="flex gap-2">
                                        <Button size="sm" onClick={() => openDialog('vaccination')} className="rounded-lg">
                                            <Plus className="w-4 h-4 mr-2" />
                                            Vaccination
                                        </Button>
                                        <Button size="sm" onClick={() => openDialog('allergy')} className="rounded-lg">
                                            <Plus className="w-4 h-4 mr-2" />
                                            Allergy
                                        </Button>
                                        <Button size="sm" onClick={() => openDialog('visit')} className="rounded-lg">
                                            <Plus className="w-4 h-4 mr-2" />
                                            Visit
                                        </Button>
                                    </div>
                                </CardHeader>
                            </Card>

                            <Tabs defaultValue="vaccinations">
                                <TabsList>
                                    <TabsTrigger value="vaccinations">Vaccinations</TabsTrigger>
                                    <TabsTrigger value="allergies">Allergies</TabsTrigger>
                                    <TabsTrigger value="conditions">Conditions</TabsTrigger>
                                    <TabsTrigger value="medications">Medications</TabsTrigger>
                                    <TabsTrigger value="visits">Clinic Visits</TabsTrigger>
                                </TabsList>

                                <TabsContent value="vaccinations">
                                    <Card className="rounded-2xl">
                                        <CardContent className="pt-6">
                                            {!healthRecord || healthRecord.vaccinations?.length === 0 ? (
                                                <div className="text-center py-12">
                                                    <Pill className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-20" />
                                                    <h3 className="text-lg font-medium mb-2">No vaccinations recorded</h3>
                                                    <Button onClick={() => openDialog('vaccination')} className="rounded-xl mt-4">
                                                        <Plus className="w-4 h-4 mr-2" />
                                                        Add Vaccination
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {healthRecord.vaccinations.map((vac, idx) => (
                                                        <div key={idx} className="p-4 rounded-xl bg-muted/30 border">
                                                            <div className="flex justify-between">
                                                                <div>
                                                                    <p className="font-medium">{vac.name}</p>
                                                                    <p className="text-sm text-muted-foreground">Date: {vac.date}</p>
                                                                </div>
                                                                <Badge>{vac.dose || 'N/A'}</Badge>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="allergies">
                                    <Card className="rounded-2xl">
                                        <CardContent className="pt-6">
                                            {!healthRecord || healthRecord.allergies?.length === 0 ? (
                                                <div className="text-center py-12">
                                                    <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-20" />
                                                    <h3 className="text-lg font-medium mb-2">No allergies recorded</h3>
                                                    <Button onClick={() => openDialog('allergy')} className="rounded-xl mt-4">
                                                        <Plus className="w-4 h-4 mr-2" />
                                                        Add Allergy
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {healthRecord.allergies.map((allergy, idx) => (
                                                        <div key={idx} className="p-4 rounded-xl bg-red-50 border border-red-200">
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <p className="font-medium text-red-900">{allergy.allergen}</p>
                                                                    <p className="text-sm text-red-700">{allergy.reaction}</p>
                                                                </div>
                                                                <Badge variant="destructive">{allergy.severity}</Badge>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="visits">
                                    <Card className="rounded-2xl">
                                        <CardContent className="pt-6">
                                            {!healthRecord || healthRecord.visits?.length === 0 ? (
                                                <div className="text-center py-12">
                                                    <Stethoscope className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-20" />
                                                    <h3 className="text-lg font-medium mb-2">No clinic visits recorded</h3>
                                                    <Button onClick={() => openDialog('visit')} className="rounded-xl mt-4">
                                                        <Plus className="w-4 h-4 mr-2" />
                                                        Add Visit
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {healthRecord.visits.map((visit, idx) => (
                                                        <div key={idx} className="p-4 rounded-xl bg-muted/30 border">
                                                            <p className="font-medium">{visit.date}</p>
                                                            <p className="text-sm text-muted-foreground mt-1">Reason: {visit.reason}</p>
                                                            <p className="text-sm mt-2">{visit.notes}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            </Tabs>
                        </div>
                    )}
                </div>
            </div>

            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="rounded-2xl p-6">
                    <button onClick={() => setShowDialog(false)} className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100">
                        <AlertCircle className="h-4 w-4" />
                    </button>
                    <DialogHeader>
                        <DialogTitle>Add {dialogType}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        {dialogType === 'vaccination' && (
                            <>
                                <div>
                                    <Label>Vaccine Name*</Label>
                                    <Input value={formData.name || ''} onChange={(e) => setFormData({...formData, name: e.target.value})} className="rounded-lg" />
                                </div>
                                <div>
                                    <Label>Date*</Label>
                                    <Input type="date" value={formData.date || ''} onChange={(e) => setFormData({...formData, date: e.target.value})} className="rounded-lg" />
                                </div>
                                <div>
                                    <Label>Dose</Label>
                                    <Input value={formData.dose || ''} onChange={(e) => setFormData({...formData, dose: e.target.value})} className="rounded-lg" />
                                </div>
                            </>
                        )}
                        {dialogType === 'allergy' && (
                            <>
                                <div>
                                    <Label>Allergen*</Label>
                                    <Input value={formData.allergen || ''} onChange={(e) => setFormData({...formData, allergen: e.target.value})} className="rounded-lg" />
                                </div>
                                <div>
                                    <Label>Reaction*</Label>
                                    <Input value={formData.reaction || ''} onChange={(e) => setFormData({...formData, reaction: e.target.value})} className="rounded-lg" />
                                </div>
                                <div>
                                    <Label>Severity*</Label>
                                    <Input value={formData.severity || ''} onChange={(e) => setFormData({...formData, severity: e.target.value})} className="rounded-lg" placeholder="Mild, Moderate, Severe" />
                                </div>
                            </>
                        )}
                        {dialogType === 'visit' && (
                            <>
                                <div>
                                    <Label>Date*</Label>
                                    <Input type="date" value={formData.date || ''} onChange={(e) => setFormData({...formData, date: e.target.value})} className="rounded-lg" />
                                </div>
                                <div>
                                    <Label>Reason*</Label>
                                    <Input value={formData.reason || ''} onChange={(e) => setFormData({...formData, reason: e.target.value})} className="rounded-lg" />
                                </div>
                                <div>
                                    <Label>Notes</Label>
                                    <Textarea value={formData.notes || ''} onChange={(e) => setFormData({...formData, notes: e.target.value})} className="rounded-lg" rows={4} />
                                </div>
                            </>
                        )}
                    </div>
                    <DialogFooter className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowDialog(false)} className="rounded-xl">Cancel</Button>
                        <Button onClick={handleSubmit} className="rounded-xl">Add</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
