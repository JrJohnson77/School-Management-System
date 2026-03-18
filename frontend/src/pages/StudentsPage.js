import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { 
    Plus, Search, Edit2, Trash2, GraduationCap, Loader2,
    Calendar, Phone, Mail, Home, Upload, X, Users as UsersIcon, ChevronDown, ChevronUp
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SALUTATIONS = ['Mr.', 'Ms.', 'Mrs.'];
const RELATIONSHIPS = ['Mother', 'Father', 'Aunt', 'Uncle', 'Brother', 'Sister', 'Stepmother', 'Stepfather', 'Grandparent', 'Guardian', 'Other'];

const emptyFamilyMember = {
    id: '', salutation: '', first_name: '', middle_name: '', last_name: '',
    gender: '', relationship: '', address_line1: '', address_line2: '',
    city_state: '', country: '', home_phone: '', cell_phone: '', work_phone: '', email: ''
};

const initialFormData = {
    student_id: '', first_name: '', middle_name: '', last_name: '',
    date_of_birth: '', gender: '', student_phone: '', student_email: '',
    address_line1: '', address_line2: '', city_state: '', country: '',
    house: '', class_id: '', emergency_contact: '', teacher_comment: '',
    photo_url: '', family_members: []
};

export default function StudentsPage() {
    const [students, setStudents] = useState([]);
    const [classes, setClasses] = useState([]);
    const [houses, setHouses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [formData, setFormData] = useState(initialFormData);
    const [submitting, setSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [expandedFamily, setExpandedFamily] = useState({});
    const fileInputRef = useRef(null);
    const { isAdmin, isTeacher, isParent } = useAuth();

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const [studentsRes, classesRes, housesRes] = await Promise.all([
                axios.get(`${API}/students`),
                axios.get(`${API}/classes`).catch(() => ({ data: [] })),
                axios.get(`${API}/houses`).catch(() => ({ data: { houses: [] } }))
            ]);
            setStudents(studentsRes.data);
            setClasses(classesRes.data);
            setHouses(housesRes.data.houses || []);
        } catch (error) {
            toast.error('Failed to load students');
        } finally {
            setLoading(false);
        }
    };

    const handlePhotoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) { toast.error('Invalid file type.'); return; }
        if (file.size > 5 * 1024 * 1024) { toast.error('File too large (max 5MB).'); return; }
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const response = await axios.post(`${API}/upload/photo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            setFormData(prev => ({ ...prev, photo_url: response.data.photo_url }));
            toast.success('Photo uploaded');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to upload photo');
        } finally { setUploading(false); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        const submitData = {
            ...formData,
            house: formData.house === 'none' ? '' : formData.house,
            class_id: formData.class_id === 'none' ? '' : formData.class_id,
        };
        try {
            if (editingStudent) {
                await axios.put(`${API}/students/${editingStudent.id}`, submitData);
                toast.success('Student updated');
            } else {
                await axios.post(`${API}/students`, submitData);
                toast.success('Student added');
            }
            setIsDialogOpen(false);
            setEditingStudent(null);
            setFormData(initialFormData);
            setExpandedFamily({});
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to save student');
        } finally { setSubmitting(false); }
    };

    const handleEdit = (student) => {
        setEditingStudent(student);
        setFormData({
            student_id: student.student_id || '',
            first_name: student.first_name || '',
            middle_name: student.middle_name || '',
            last_name: student.last_name || '',
            date_of_birth: student.date_of_birth || '',
            gender: student.gender || '',
            student_phone: student.student_phone || '',
            student_email: student.student_email || '',
            address_line1: student.address_line1 || '',
            address_line2: student.address_line2 || '',
            city_state: student.city_state || '',
            country: student.country || '',
            house: student.house || '',
            class_id: student.class_id || '',
            emergency_contact: student.emergency_contact || '',
            teacher_comment: student.teacher_comment || '',
            photo_url: student.photo_url || '',
            family_members: student.family_members || []
        });
        setIsDialogOpen(true);
    };

    const handleDelete = async (studentId) => {
        if (!window.confirm('Are you sure?')) return;
        try {
            await axios.delete(`${API}/students/${studentId}`);
            toast.success('Student deleted');
            fetchData();
        } catch (error) { toast.error('Failed to delete student'); }
    };

    const addFamilyMember = () => {
        setFormData(prev => ({
            ...prev,
            family_members: [...prev.family_members, { ...emptyFamilyMember }]
        }));
    };

    const removeFamilyMember = (index) => {
        setFormData(prev => ({
            ...prev,
            family_members: prev.family_members.filter((_, i) => i !== index)
        }));
    };

    const updateFamilyMember = (index, field, value) => {
        setFormData(prev => {
            const updated = [...prev.family_members];
            updated[index] = { ...updated[index], [field]: value };
            return { ...prev, family_members: updated };
        });
    };

    const filteredStudents = students.filter(s => {
        const fullName = `${s.first_name} ${s.middle_name || ''} ${s.last_name}`.toLowerCase();
        const studentId = (s.student_id || '').toLowerCase();
        return fullName.includes(searchQuery.toLowerCase()) || studentId.includes(searchQuery.toLowerCase());
    });

    const getClassName = (classId) => classes.find(c => c.id === classId)?.name || '-';

    const getHouseColor = (house) => {
        const colors = {
            'Red House': 'bg-red-100 text-red-700 border-red-200',
            'Blue House': 'bg-blue-100 text-blue-700 border-blue-200',
            'Green House': 'bg-green-100 text-green-700 border-green-200',
            'Yellow House': 'bg-yellow-100 text-yellow-700 border-yellow-200'
        };
        return colors[house] || 'bg-muted text-muted-foreground';
    };

    if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

    return (
        <div data-testid="students-page">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="page-header mb-0">
                    <h1>Students</h1>
                    <p>{isParent ? "View your children's information" : 'Manage student records'}</p>
                </div>
                {(isAdmin || isTeacher) && (
                    <Dialog open={isDialogOpen} onOpenChange={(open) => {
                        setIsDialogOpen(open);
                        if (!open) { setEditingStudent(null); setFormData(initialFormData); setExpandedFamily({}); }
                    }}>
                        <DialogTrigger asChild>
                            <Button className="gradient-primary rounded-lg shadow-md" data-testid="add-student-btn">
                                <Plus className="w-4 h-4 mr-2" /> Add Student
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl">
                            <DialogHeader>
                                <DialogTitle>{editingStudent ? 'Edit Student' : 'Add New Student'}</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-6 pt-2">
                                {/* Photo Upload */}
                                <div className="flex items-center gap-4">
                                    <div className="relative w-20 h-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/30 cursor-pointer hover:border-primary/50 transition-colors"
                                        onClick={() => fileInputRef.current?.click()}>
                                        {formData.photo_url ? (
                                            <img src={formData.photo_url.startsWith('http') ? formData.photo_url : `${process.env.REACT_APP_BACKEND_URL}${formData.photo_url}`} alt="Student" className="w-full h-full object-cover" />
                                        ) : uploading ? (
                                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                        ) : (
                                            <Upload className="w-5 h-5 text-muted-foreground" />
                                        )}
                                    </div>
                                    <div className="text-sm">
                                        <p className="font-medium">Student Photo</p>
                                        <p className="text-xs text-muted-foreground">JPG, PNG, WebP (max 5MB)</p>
                                        {formData.photo_url && (
                                            <button type="button" className="text-xs text-destructive hover:underline mt-1" onClick={() => setFormData(prev => ({ ...prev, photo_url: '' }))}>Remove</button>
                                        )}
                                    </div>
                                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                                </div>

                                {/* Basic Info */}
                                <div>
                                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><GraduationCap className="w-4 h-4" /> Basic Information</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs">Student ID</Label>
                                            <Input value={formData.student_id} onChange={(e) => setFormData({...formData, student_id: e.target.value})} placeholder="School ID" className="h-9 rounded-lg text-sm" data-testid="student-id-input" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">First Name *</Label>
                                            <Input value={formData.first_name} onChange={(e) => setFormData({...formData, first_name: e.target.value})} required className="h-9 rounded-lg text-sm" data-testid="student-first-name" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Middle Name</Label>
                                            <Input value={formData.middle_name} onChange={(e) => setFormData({...formData, middle_name: e.target.value})} className="h-9 rounded-lg text-sm" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Last Name *</Label>
                                            <Input value={formData.last_name} onChange={(e) => setFormData({...formData, last_name: e.target.value})} required className="h-9 rounded-lg text-sm" data-testid="student-last-name" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs">Date of Birth *</Label>
                                            <Input type="date" value={formData.date_of_birth} onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})} required className="h-9 rounded-lg text-sm" data-testid="student-dob" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Gender *</Label>
                                            <Select value={formData.gender} onValueChange={(v) => setFormData({...formData, gender: v})}>
                                                <SelectTrigger className="h-9 rounded-lg text-sm" data-testid="student-gender"><SelectValue placeholder="Select" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Male">Male</SelectItem>
                                                    <SelectItem value="Female">Female</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Emergency Contact</Label>
                                            <Input value={formData.emergency_contact} onChange={(e) => setFormData({...formData, emergency_contact: e.target.value})} placeholder="Phone number" className="h-9 rounded-lg text-sm" />
                                        </div>
                                    </div>
                                </div>

                                {/* Contact */}
                                <div>
                                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Phone className="w-4 h-4" /> Contact</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs">Student Phone</Label>
                                            <Input value={formData.student_phone} onChange={(e) => setFormData({...formData, student_phone: e.target.value})} placeholder="Phone number" className="h-9 rounded-lg text-sm" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Student Email</Label>
                                            <Input type="email" value={formData.student_email} onChange={(e) => setFormData({...formData, student_email: e.target.value})} placeholder="Email address" className="h-9 rounded-lg text-sm" />
                                        </div>
                                    </div>
                                </div>

                                {/* Address */}
                                <div>
                                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Home className="w-4 h-4" /> Address</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs">Address Line 1</Label>
                                            <Input value={formData.address_line1} onChange={(e) => setFormData({...formData, address_line1: e.target.value})} placeholder="Street address" className="h-9 rounded-lg text-sm" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Address Line 2</Label>
                                            <Input value={formData.address_line2} onChange={(e) => setFormData({...formData, address_line2: e.target.value})} placeholder="Apt, Suite, etc." className="h-9 rounded-lg text-sm" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">City / State</Label>
                                            <Input value={formData.city_state} onChange={(e) => setFormData({...formData, city_state: e.target.value})} placeholder="City, State" className="h-9 rounded-lg text-sm" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Country</Label>
                                            <Input value={formData.country} onChange={(e) => setFormData({...formData, country: e.target.value})} placeholder="Country" className="h-9 rounded-lg text-sm" />
                                        </div>
                                    </div>
                                </div>

                                {/* School Assignment */}
                                <div>
                                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><GraduationCap className="w-4 h-4" /> School Assignment</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs">Class</Label>
                                            <Select value={formData.class_id || 'none'} onValueChange={(v) => setFormData({...formData, class_id: v})}>
                                                <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue placeholder="Select class" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">No class</SelectItem>
                                                    {classes.map(cls => <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">House</Label>
                                            <Select value={formData.house || 'none'} onValueChange={(v) => setFormData({...formData, house: v})}>
                                                <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue placeholder="Select house" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">No house</SelectItem>
                                                    {houses.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>

                                {/* Teacher Comment */}
                                <div className="space-y-1">
                                    <Label className="text-xs">Teacher Comment</Label>
                                    <Textarea value={formData.teacher_comment} onChange={(e) => setFormData({...formData, teacher_comment: e.target.value})} placeholder="Optional comment" rows={2} className="rounded-lg text-sm" />
                                </div>

                                {/* Family Members */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><UsersIcon className="w-4 h-4" /> Family Members</h3>
                                        <Button type="button" variant="outline" size="sm" onClick={addFamilyMember} className="rounded-lg h-8 text-xs">
                                            <Plus className="w-3 h-3 mr-1" /> Add Family
                                        </Button>
                                    </div>
                                    {formData.family_members.length === 0 && (
                                        <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg border-dashed">No family members added. Click "Add Family" to add a parent or guardian.</p>
                                    )}
                                    <div className="space-y-3">
                                        {formData.family_members.map((fm, index) => (
                                            <div key={index} className="border rounded-xl p-4 bg-muted/10 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <button type="button" className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
                                                        onClick={() => setExpandedFamily(prev => ({ ...prev, [index]: !prev[index] }))}>
                                                        {expandedFamily[index] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                        {fm.first_name || fm.last_name ? `${fm.salutation || ''} ${fm.first_name} ${fm.last_name}`.trim() : `Family Member ${index + 1}`}
                                                        {fm.relationship && <span className="text-xs px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium ml-2">{fm.relationship}</span>}
                                                    </button>
                                                    <Button type="button" variant="ghost" size="sm" onClick={() => removeFamilyMember(index)} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                                {(expandedFamily[index] !== false || (!fm.first_name && !fm.last_name)) && (
                                                    <>
                                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                                            <div className="space-y-1">
                                                                <Label className="text-xs">Salutation</Label>
                                                                <Select value={fm.salutation} onValueChange={(v) => updateFamilyMember(index, 'salutation', v)}>
                                                                    <SelectTrigger className="h-8 rounded-lg text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                                                                    <SelectContent>{SALUTATIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-xs">First Name *</Label>
                                                                <Input value={fm.first_name} onChange={(e) => updateFamilyMember(index, 'first_name', e.target.value)} className="h-8 rounded-lg text-xs" />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-xs">Middle Name</Label>
                                                                <Input value={fm.middle_name} onChange={(e) => updateFamilyMember(index, 'middle_name', e.target.value)} className="h-8 rounded-lg text-xs" />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-xs">Last Name *</Label>
                                                                <Input value={fm.last_name} onChange={(e) => updateFamilyMember(index, 'last_name', e.target.value)} className="h-8 rounded-lg text-xs" />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-xs">Gender</Label>
                                                                <Select value={fm.gender} onValueChange={(v) => updateFamilyMember(index, 'gender', v)}>
                                                                    <SelectTrigger className="h-8 rounded-lg text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="Male">Male</SelectItem>
                                                                        <SelectItem value="Female">Female</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="space-y-1">
                                                                <Label className="text-xs">Relationship *</Label>
                                                                <Select value={fm.relationship} onValueChange={(v) => updateFamilyMember(index, 'relationship', v)}>
                                                                    <SelectTrigger className="h-8 rounded-lg text-xs"><SelectValue placeholder="Select relationship" /></SelectTrigger>
                                                                    <SelectContent>{RELATIONSHIPS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-xs">Email</Label>
                                                                <Input type="email" value={fm.email} onChange={(e) => updateFamilyMember(index, 'email', e.target.value)} className="h-8 rounded-lg text-xs" placeholder="Email" />
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                            <div className="space-y-1">
                                                                <Label className="text-xs">Address Line 1</Label>
                                                                <Input value={fm.address_line1} onChange={(e) => updateFamilyMember(index, 'address_line1', e.target.value)} className="h-8 rounded-lg text-xs" />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-xs">Address Line 2</Label>
                                                                <Input value={fm.address_line2} onChange={(e) => updateFamilyMember(index, 'address_line2', e.target.value)} className="h-8 rounded-lg text-xs" />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-xs">City / State</Label>
                                                                <Input value={fm.city_state} onChange={(e) => updateFamilyMember(index, 'city_state', e.target.value)} className="h-8 rounded-lg text-xs" />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-xs">Country</Label>
                                                                <Input value={fm.country} onChange={(e) => updateFamilyMember(index, 'country', e.target.value)} className="h-8 rounded-lg text-xs" />
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-3 gap-3">
                                                            <div className="space-y-1">
                                                                <Label className="text-xs">Home Phone</Label>
                                                                <Input value={fm.home_phone} onChange={(e) => updateFamilyMember(index, 'home_phone', e.target.value)} className="h-8 rounded-lg text-xs" />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-xs">Cell Phone</Label>
                                                                <Input value={fm.cell_phone} onChange={(e) => updateFamilyMember(index, 'cell_phone', e.target.value)} className="h-8 rounded-lg text-xs" />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-xs">Work Phone</Label>
                                                                <Input value={fm.work_phone} onChange={(e) => updateFamilyMember(index, 'work_phone', e.target.value)} className="h-8 rounded-lg text-xs" />
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 pt-2">
                                    <Button type="button" variant="outline" className="rounded-lg" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                                    <Button type="submit" disabled={submitting} className="gradient-primary rounded-lg" data-testid="student-submit-btn">
                                        {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                        {editingStudent ? 'Update Student' : 'Add Student'}
                                    </Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {/* Search */}
            <div className="relative mb-4 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search students..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-10 rounded-lg" data-testid="student-search" />
            </div>

            {/* Students Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredStudents.map(student => (
                    <Card key={student.id} className="rounded-2xl border-border shadow-sm hover:shadow-md transition-shadow" data-testid="student-card">
                        <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                                <div className="w-12 h-12 rounded-xl bg-primary/8 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0 overflow-hidden">
                                    {student.photo_url ? (
                                        <img src={student.photo_url.startsWith('http') ? student.photo_url : `${process.env.REACT_APP_BACKEND_URL}${student.photo_url}`} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        `${student.first_name?.[0] || ''}${student.last_name?.[0] || ''}`
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-sm truncate">{student.first_name} {student.middle_name ? `${student.middle_name} ` : ''}{student.last_name}</h3>
                                    <p className="text-xs text-muted-foreground">{student.student_id || 'No ID'} · {student.gender}</p>
                                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                        <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-muted font-medium">{getClassName(student.class_id)}</span>
                                        {student.house && <span className={`text-[11px] px-1.5 py-0.5 rounded-md border font-medium ${getHouseColor(student.house)}`}>{student.house}</span>}
                                        {student.family_members?.length > 0 && <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-medium">{student.family_members.length} family</span>}
                                    </div>
                                </div>
                                {(isAdmin || isTeacher) && (
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="sm" onClick={() => handleEdit(student)} className="h-7 w-7 p-0 rounded-lg"><Edit2 className="w-3.5 h-3.5" /></Button>
                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(student.id)} className="h-7 w-7 p-0 rounded-lg text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
            {filteredStudents.length === 0 && (
                <div className="empty-state mt-8">
                    <GraduationCap className="empty-state-icon" />
                    <h3 className="text-base font-semibold mb-1">No students found</h3>
                    <p className="text-sm text-muted-foreground">{searchQuery ? 'Try a different search term' : 'Add your first student to get started'}</p>
                </div>
            )}
        </div>
    );
}
