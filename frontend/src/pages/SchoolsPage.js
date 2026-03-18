import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import ReportTemplateDesigner from './ReportTemplateDesigner';
import {
    Plus, Edit2, Trash2, Building2, Loader2, Save, ArrowLeft,
    BookOpen, Award, Heart, Users as UsersIcon, Settings, Palette,
    ChevronDown, ChevronRight
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const initialSchoolForm = {
    school_code: '', name: '', phone: '', email: '', address: '', principal_name: ''
};

const DEFAULT_WEIGHTS = { homework: 5, groupWork: 5, project: 10, quiz: 10, midTerm: 30, endOfTerm: 40 };
const DEFAULT_CORE_SUBJECTS = [
    { name: 'English Language', is_core: true, weights: DEFAULT_WEIGHTS },
    { name: 'Mathematics', is_core: true, weights: DEFAULT_WEIGHTS },
    { name: 'Science', is_core: true, weights: DEFAULT_WEIGHTS },
    { name: 'Social Studies', is_core: true, weights: DEFAULT_WEIGHTS },
    { name: 'Religious Education', is_core: false, weights: DEFAULT_WEIGHTS },
    { name: 'Physical Education', is_core: false, weights: DEFAULT_WEIGHTS },
    { name: 'Creative Arts', is_core: false, weights: DEFAULT_WEIGHTS },
    { name: 'Music', is_core: false, weights: DEFAULT_WEIGHTS },
    { name: 'ICT', is_core: false, weights: DEFAULT_WEIGHTS },
    { name: 'French', is_core: false, weights: DEFAULT_WEIGHTS }
];
const DEFAULT_ACHIEVEMENT_STANDARDS = [
    { min: 86, max: 100, grade: 'HP', description: 'Highly Proficient' },
    { min: 75, max: 85, grade: 'P', description: 'Proficient' },
    { min: 60, max: 74, grade: 'AP', description: 'Approaching Proficiency' },
    { min: 50, max: 59, grade: 'D', description: 'Developing' },
    { min: 0, max: 49, grade: 'B', description: 'Beginning' }
];
const DEFAULT_SKILL_RATINGS = [
    { code: 'EX', label: 'Excellent' },
    { code: 'VG', label: 'Very Good' },
    { code: 'G', label: 'Good' },
    { code: 'NI', label: 'Needs Improvement' }
];
const DEFAULT_SOCIAL_SKILLS = [
    { category_name: 'Work Habits & Attitude', skills: ['Completes Assignments', 'Follows Instructions', 'Punctuality'] },
    { category_name: 'Social Behavior', skills: ['Deportment', 'Courteous in Speech and Action', 'Respect for Teacher', 'Respect for Peers'] }
];

export default function SchoolsPage() {
    const [schools, setSchools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingSchool, setEditingSchool] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState(initialSchoolForm);
    const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState('basic');
    const { isSuperuser } = useAuth();

    // Gradebook settings state
    const [template, setTemplate] = useState(null);
    const [savingSettings, setSavingSettings] = useState(false);
    const [expandedSubject, setExpandedSubject] = useState(null);
    const [loadingTemplate, setLoadingTemplate] = useState(false);

    useEffect(() => { fetchSchools(); }, []);

    const fetchSchools = async () => {
        try {
            const response = await axios.get(`${API}/schools`);
            setSchools(response.data);
        } catch (error) { toast.error('Failed to load schools'); }
        finally { setLoading(false); }
    };

    const fetchTemplate = async (schoolCode) => {
        setLoadingTemplate(true);
        try {
            const res = await axios.get(`${API}/report-templates/${schoolCode}`);
            setTemplate(res.data);
        } catch (error) {
            setTemplate(null);
        } finally { setLoadingTemplate(false); }
    };

    const handleCreate = () => {
        setIsCreating(true);
        setEditingSchool(null);
        setFormData(initialSchoolForm);
        setTemplate(null);
        setActiveTab('basic');
    };

    const handleEdit = (school) => {
        setEditingSchool(school);
        setIsCreating(false);
        setFormData({
            school_code: school.school_code || '',
            name: school.name || '',
            phone: school.phone || '',
            email: school.email || '',
            address: school.address || '',
            principal_name: school.principal_name || ''
        });
        setActiveTab('basic');
        fetchTemplate(school.school_code);
    };

    const handleBack = () => {
        setEditingSchool(null);
        setIsCreating(false);
        setFormData(initialSchoolForm);
        setTemplate(null);
        setActiveTab('basic');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (editingSchool) {
                await axios.put(`${API}/schools/${editingSchool.id}`, formData);
                toast.success('School updated');
            } else {
                await axios.post(`${API}/schools`, formData);
                toast.success('School created');
            }
            fetchSchools();
            if (!editingSchool) handleBack();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to save school');
        } finally { setSubmitting(false); }
    };

    const handleDelete = async (schoolId) => {
        if (!window.confirm('Are you sure? This will delete the school and all associated data.')) return;
        try {
            await axios.delete(`${API}/schools/${schoolId}`);
            toast.success('School deleted');
            fetchSchools();
        } catch (error) { toast.error('Failed to delete school'); }
    };

    // ========== GRADEBOOK SETTINGS FUNCTIONS ==========
    const applyDefaultConfig = () => {
        setTemplate(prev => ({
            ...prev,
            subjects: DEFAULT_CORE_SUBJECTS,
            assessment_weights: DEFAULT_WEIGHTS,
            use_weighted_grading: true,
            grade_scale: DEFAULT_ACHIEVEMENT_STANDARDS,
            skill_ratings: DEFAULT_SKILL_RATINGS,
            social_skills_categories: DEFAULT_SOCIAL_SKILLS
        }));
        toast.success('Default configuration applied! Click Save to persist.');
    };

    const handleSaveSettings = async () => {
        const sc = editingSchool?.school_code || formData.school_code;
        if (!sc) { toast.error('Save school first'); return; }
        setSavingSettings(true);
        try {
            const updatedTemplate = {
                ...template,
                subjects: template?.subjects || [],
                assessment_weights: template?.assessment_weights || DEFAULT_WEIGHTS,
                use_weighted_grading: template?.use_weighted_grading || false,
                skill_ratings: template?.skill_ratings || [],
                social_skills_categories: template?.social_skills_categories || [],
                grade_scale: template?.grade_scale || []
            };
            await axios.put(`${API}/report-templates/${sc}`, updatedTemplate);
            toast.success('Gradebook settings saved!');
        } catch (error) { toast.error('Failed to save settings'); }
        finally { setSavingSettings(false); }
    };

    const addSubject = () => {
        setTemplate(prev => ({ ...prev, subjects: [...(prev?.subjects || []), { name: 'New Subject', is_core: false, weights: { ...DEFAULT_WEIGHTS } }] }));
    };
    const removeSubject = (index) => {
        setTemplate(prev => ({ ...prev, subjects: (prev?.subjects || []).filter((_, i) => i !== index) }));
    };
    const updateSubjectName = (index, name) => {
        const s = [...(template?.subjects || [])]; s[index] = { ...s[index], name };
        setTemplate({ ...template, subjects: s });
    };
    const updateSubjectCore = (index, is_core) => {
        const s = [...(template?.subjects || [])]; s[index] = { ...s[index], is_core };
        setTemplate({ ...template, subjects: s });
    };
    const updateSubjectWeights = (subjectIndex, weightKey, value) => {
        const s = [...(template?.subjects || [])];
        if (!s[subjectIndex].weights) s[subjectIndex].weights = { ...DEFAULT_WEIGHTS };
        s[subjectIndex].weights[weightKey] = parseFloat(value) || 0;
        setTemplate({ ...template, subjects: s });
    };
    const addAchievementStandard = () => {
        setTemplate(prev => ({ ...prev, grade_scale: [...(prev?.grade_scale || DEFAULT_ACHIEVEMENT_STANDARDS), { min: 0, max: 0, grade: '', description: '' }] }));
    };
    const removeAchievementStandard = (index) => {
        setTemplate(prev => ({ ...prev, grade_scale: (prev?.grade_scale || []).filter((_, i) => i !== index) }));
    };
    const updateAchievementStandard = (index, field, value) => {
        const s = [...(template?.grade_scale || DEFAULT_ACHIEVEMENT_STANDARDS)];
        s[index] = { ...s[index], [field]: field === 'min' || field === 'max' ? parseInt(value) || 0 : value };
        setTemplate({ ...template, grade_scale: s });
    };
    const addRating = () => {
        setTemplate(prev => ({ ...prev, skill_ratings: [...(prev?.skill_ratings || DEFAULT_SKILL_RATINGS), { code: '', label: '' }] }));
    };
    const removeRating = (index) => {
        setTemplate(prev => ({ ...prev, skill_ratings: (prev?.skill_ratings || []).filter((_, i) => i !== index) }));
    };
    const updateRating = (index, field, value) => {
        const s = [...(template?.skill_ratings || DEFAULT_SKILL_RATINGS)];
        s[index] = { ...s[index], [field]: value };
        setTemplate({ ...template, skill_ratings: s });
    };
    const addSkillCategory = () => {
        setTemplate(prev => ({ ...prev, social_skills_categories: [...(prev?.social_skills_categories || []), { category_name: 'New Category', skills: [''] }] }));
    };
    const removeSkillCategory = (index) => {
        setTemplate(prev => ({ ...prev, social_skills_categories: (prev?.social_skills_categories || []).filter((_, i) => i !== index) }));
    };
    const updateCategoryName = (index, name) => {
        const c = [...(template?.social_skills_categories || [])]; c[index] = { ...c[index], category_name: name };
        setTemplate({ ...template, social_skills_categories: c });
    };
    const addSkillToCategory = (ci) => {
        const c = [...(template?.social_skills_categories || [])]; c[ci].skills = [...c[ci].skills, ''];
        setTemplate({ ...template, social_skills_categories: c });
    };
    const removeSkillFromCategory = (ci, si) => {
        const c = [...(template?.social_skills_categories || [])]; c[ci].skills = c[ci].skills.filter((_, i) => i !== si);
        setTemplate({ ...template, social_skills_categories: c });
    };
    const updateSkillInCategory = (ci, si, value) => {
        const c = [...(template?.social_skills_categories || [])]; c[ci].skills[si] = value;
        setTemplate({ ...template, social_skills_categories: c });
    };

    if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

    // ========== EDITING / CREATING VIEW ==========
    if (editingSchool || isCreating) {
        const currentSchoolCode = editingSchool?.school_code || formData.school_code;
        
        return (
            <div data-testid="school-editor">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <Button variant="ghost" size="sm" onClick={handleBack} className="h-9 w-9 p-0 rounded-lg">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{editingSchool ? `Edit: ${editingSchool.name}` : 'Create New School'}</h1>
                        <p className="text-sm text-muted-foreground">{editingSchool ? editingSchool.school_code : 'Set up a new school'}</p>
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="mb-6 bg-muted/60 p-1 rounded-lg">
                        <TabsTrigger value="basic" className="rounded-md text-sm">Basic Info</TabsTrigger>
                        {(editingSchool || formData.school_code) && (
                            <>
                                <TabsTrigger value="gradebook" className="rounded-md text-sm">Gradebook Settings</TabsTrigger>
                                <TabsTrigger value="template" className="rounded-md text-sm">Report Template</TabsTrigger>
                            </>
                        )}
                    </TabsList>

                    {/* ===== BASIC INFO TAB ===== */}
                    <TabsContent value="basic">
                        <Card className="rounded-2xl border-border shadow-sm">
                            <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5" /> School Information</CardTitle></CardHeader>
                            <CardContent>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>School Code *</Label>
                                            <Input value={formData.school_code} onChange={(e) => setFormData({...formData, school_code: e.target.value.toUpperCase()})} required disabled={!!editingSchool} className="rounded-lg uppercase" data-testid="school-code-input" placeholder="e.g. DEMO" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>School Name *</Label>
                                            <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required className="rounded-lg" data-testid="school-name-input" placeholder="School name" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Phone</Label>
                                            <Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="rounded-lg" placeholder="Phone number" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Email</Label>
                                            <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="rounded-lg" placeholder="Email address" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Principal Name</Label>
                                            <Input value={formData.principal_name} onChange={(e) => setFormData({...formData, principal_name: e.target.value})} className="rounded-lg" placeholder="Principal's name" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Address</Label>
                                            <Input value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} className="rounded-lg" placeholder="School address" />
                                        </div>
                                    </div>
                                    <div className="flex justify-end pt-4">
                                        <Button type="submit" disabled={submitting} className="gradient-primary rounded-lg px-8" data-testid="save-school-btn">
                                            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                            {editingSchool ? 'Update School' : 'Create School'}
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ===== GRADEBOOK SETTINGS TAB ===== */}
                    <TabsContent value="gradebook">
                        {loadingTemplate ? (
                            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                        ) : (
                            <div className="space-y-6">
                                {/* Quick Setup */}
                                <div className="flex items-center justify-between p-4 rounded-2xl bg-primary/5 border">
                                    <div>
                                        <h3 className="font-bold text-sm">Quick Setup</h3>
                                        <p className="text-xs text-muted-foreground">Apply default subjects, weights, standards & social skills</p>
                                    </div>
                                    <Button onClick={applyDefaultConfig} variant="outline" className="rounded-lg text-sm">Apply Defaults</Button>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                    {/* Subjects & Weights */}
                                    <Card className="rounded-2xl border-border shadow-sm">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="flex items-center justify-between text-base">
                                                <div className="flex items-center gap-2"><BookOpen className="w-4 h-4" /> Subjects & Weights</div>
                                                <Button variant="outline" size="sm" onClick={addSubject} className="rounded-lg h-8 text-xs"><Plus className="w-3 h-3 mr-1" /> Add</Button>
                                            </CardTitle>
                                            <p className="text-xs text-muted-foreground">Core subjects are used for ranking</p>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
                                                <div><Label className="text-xs font-medium">Weighted Grading</Label><p className="text-[10px] text-muted-foreground">Enable component-based grading</p></div>
                                                <Switch checked={template?.use_weighted_grading || false} onCheckedChange={(v) => setTemplate({...template, use_weighted_grading: v})} />
                                            </div>
                                            <div className="p-2.5 rounded-lg border bg-blue-50/50 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-xs font-medium">Default Weights</Label>
                                                    <span className="text-[10px] text-muted-foreground">Total: {Object.values(template?.assessment_weights || DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0)}%</span>
                                                </div>
                                                <div className="grid grid-cols-3 gap-1.5">
                                                    {Object.entries(template?.assessment_weights || DEFAULT_WEIGHTS).map(([key, value]) => (
                                                        <div key={key} className="flex items-center gap-1">
                                                            <Label className="text-[10px] w-14 capitalize">{key.replace(/([A-Z])/g, ' $1')}</Label>
                                                            <Input type="number" value={value} onChange={(e) => setTemplate({...template, assessment_weights: {...(template?.assessment_weights || DEFAULT_WEIGHTS), [key]: parseFloat(e.target.value) || 0}})} className="w-12 h-6 text-xs rounded text-center" />
                                                            <span className="text-[10px]">%</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                                {(template?.subjects || []).map((subject, index) => (
                                                    <div key={index} className="border rounded-lg p-2 space-y-2">
                                                        <div className="flex items-center gap-2">
                                                            <Input value={subject.name} onChange={(e) => updateSubjectName(index, e.target.value)} className="flex-1 h-7 rounded text-xs" placeholder="Subject" />
                                                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/50">
                                                                <Switch checked={subject.is_core} onCheckedChange={(v) => updateSubjectCore(index, v)} />
                                                                <span className="text-[10px] font-medium">Core</span>
                                                            </div>
                                                            <Button variant="ghost" size="sm" onClick={() => setExpandedSubject(expandedSubject === index ? null : index)} className="h-7 w-7 p-0">
                                                                {expandedSubject === index ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                            </Button>
                                                            <Button variant="ghost" size="sm" onClick={() => removeSubject(index)} className="h-7 w-7 p-0 text-destructive"><Trash2 className="w-3 h-3" /></Button>
                                                        </div>
                                                        {expandedSubject === index && template?.use_weighted_grading && (
                                                            <div className="pl-2 pt-1.5 border-t space-y-1">
                                                                <div className="grid grid-cols-3 gap-1">
                                                                    {Object.entries(subject.weights || DEFAULT_WEIGHTS).map(([key, value]) => (
                                                                        <div key={key} className="flex items-center gap-1">
                                                                            <Label className="text-[10px] w-12 capitalize">{key.replace(/([A-Z])/g, ' $1')}</Label>
                                                                            <Input type="number" value={value} onChange={(e) => updateSubjectWeights(index, key, e.target.value)} className="w-10 h-5 text-[10px] rounded text-center" />
                                                                            <span className="text-[10px]">%</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                                {(!template?.subjects || template.subjects.length === 0) && <p className="text-xs text-muted-foreground text-center py-3">No subjects. Click "Apply Defaults" or "Add".</p>}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Achievement Standards */}
                                    <Card className="rounded-2xl border-border shadow-sm">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="flex items-center justify-between text-base">
                                                <div className="flex items-center gap-2"><Award className="w-4 h-4" /> Achievement Standards</div>
                                                <Button variant="outline" size="sm" onClick={addAchievementStandard} className="rounded-lg h-8 text-xs"><Plus className="w-3 h-3 mr-1" /> Add</Button>
                                            </CardTitle>
                                            <p className="text-xs text-muted-foreground">Based on final exam score</p>
                                        </CardHeader>
                                        <CardContent className="space-y-2 max-h-60 overflow-y-auto">
                                            {(template?.grade_scale || DEFAULT_ACHIEVEMENT_STANDARDS).map((s, i) => (
                                                <div key={i} className="flex items-center gap-1.5 p-2 rounded-lg bg-muted/30">
                                                    <Input type="number" value={s.min} onChange={(e) => updateAchievementStandard(i, 'min', e.target.value)} className="w-12 h-7 text-center rounded text-xs" placeholder="Min" />
                                                    <span className="text-muted-foreground text-xs">-</span>
                                                    <Input type="number" value={s.max} onChange={(e) => updateAchievementStandard(i, 'max', e.target.value)} className="w-12 h-7 text-center rounded text-xs" placeholder="Max" />
                                                    <Input value={s.grade} onChange={(e) => updateAchievementStandard(i, 'grade', e.target.value)} className="w-12 h-7 text-center font-bold rounded text-xs" placeholder="Code" />
                                                    <Input value={s.description} onChange={(e) => updateAchievementStandard(i, 'description', e.target.value)} className="flex-1 h-7 rounded text-xs" placeholder="Description" />
                                                    <Button variant="ghost" size="sm" onClick={() => removeAchievementStandard(i)} className="h-7 w-7 p-0 text-destructive"><Trash2 className="w-3 h-3" /></Button>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>

                                    {/* Rating Scale */}
                                    <Card className="rounded-2xl border-border shadow-sm">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="flex items-center justify-between text-base">
                                                <div className="flex items-center gap-2"><Heart className="w-4 h-4" /> Rating Scale</div>
                                                <Button variant="outline" size="sm" onClick={addRating} className="rounded-lg h-8 text-xs"><Plus className="w-3 h-3 mr-1" /> Add</Button>
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-2">
                                            {(template?.skill_ratings || DEFAULT_SKILL_RATINGS).map((r, i) => (
                                                <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                                                    <Input value={typeof r === 'string' ? r : r.code} onChange={(e) => updateRating(i, 'code', e.target.value)} className="w-14 h-7 text-center font-bold rounded text-xs" placeholder="Code" />
                                                    <span className="text-muted-foreground text-xs">=</span>
                                                    <Input value={typeof r === 'string' ? r : r.label} onChange={(e) => updateRating(i, 'label', e.target.value)} className="flex-1 h-7 rounded text-xs" placeholder="Description" />
                                                    <Button variant="ghost" size="sm" onClick={() => removeRating(i)} className="h-7 w-7 p-0 text-destructive"><Trash2 className="w-3 h-3" /></Button>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>

                                    {/* Social Skills Categories */}
                                    <Card className="rounded-2xl border-border shadow-sm">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="flex items-center justify-between text-base">
                                                <div className="flex items-center gap-2"><UsersIcon className="w-4 h-4" /> Social Skills</div>
                                                <Button variant="outline" size="sm" onClick={addSkillCategory} className="rounded-lg h-8 text-xs"><Plus className="w-3 h-3 mr-1" /> Category</Button>
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3 max-h-60 overflow-y-auto">
                                            {(template?.social_skills_categories || DEFAULT_SOCIAL_SKILLS).map((cat, ci) => (
                                                <div key={ci} className="border rounded-lg p-2.5 space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <Input value={cat.category_name} onChange={(e) => updateCategoryName(ci, e.target.value)} className="flex-1 h-7 rounded font-medium text-xs" placeholder="Category" />
                                                        <Button variant="ghost" size="sm" onClick={() => addSkillToCategory(ci)} className="h-7 text-xs"><Plus className="w-3 h-3" /></Button>
                                                        <Button variant="ghost" size="sm" onClick={() => removeSkillCategory(ci)} className="h-7 text-destructive"><Trash2 className="w-3 h-3" /></Button>
                                                    </div>
                                                    <div className="pl-3 space-y-1">
                                                        {cat.skills.map((skill, si) => (
                                                            <div key={si} className="flex items-center gap-1">
                                                                <span className="text-[10px] text-muted-foreground">•</span>
                                                                <Input value={skill} onChange={(e) => updateSkillInCategory(ci, si, e.target.value)} className="flex-1 h-6 text-xs rounded" placeholder="Skill name" />
                                                                <Button variant="ghost" size="sm" onClick={() => removeSkillFromCategory(ci, si)} className="h-5 w-5 p-0 text-destructive"><Trash2 className="w-2.5 h-2.5" /></Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                            {(!template?.social_skills_categories || template.social_skills_categories.length === 0) && <p className="text-xs text-muted-foreground text-center py-3">No skills. Click "Apply Defaults".</p>}
                                        </CardContent>
                                    </Card>
                                </div>

                                <div className="flex justify-end">
                                    <Button onClick={handleSaveSettings} disabled={savingSettings} className="gradient-primary rounded-lg px-8" data-testid="save-gradebook-settings-btn">
                                        {savingSettings ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                        Save Gradebook Settings
                                    </Button>
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    {/* ===== REPORT TEMPLATE TAB ===== */}
                    <TabsContent value="template">
                        {currentSchoolCode ? (
                            <div className="border rounded-2xl overflow-hidden bg-card -mx-1">
                                <ReportTemplateDesigner schoolCodeProp={currentSchoolCode} embedded={true} />
                            </div>
                        ) : (
                            <div className="text-center py-16 text-muted-foreground">
                                <Palette className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                <p>Save the school first to access the template designer.</p>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        );
    }

    // ========== SCHOOLS LIST VIEW ==========
    return (
        <div data-testid="schools-page">
            <div className="flex items-center justify-between mb-6">
                <div className="page-header mb-0">
                    <h1>Schools</h1>
                    <p>Manage schools in the system</p>
                </div>
                <Button onClick={handleCreate} className="gradient-primary rounded-lg shadow-md" data-testid="add-school-btn">
                    <Plus className="w-4 h-4 mr-2" /> Add School
                </Button>
            </div>

            {schools.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {schools.map((school) => (
                        <Card key={school.id} className="rounded-2xl border-border shadow-sm hover:shadow-md transition-shadow" data-testid={`school-card-${school.school_code}`}>
                            <CardContent className="p-5">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center text-white font-bold text-sm shadow-md shadow-primary/20">
                                        {school.school_code?.slice(0, 2)}
                                    </div>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="sm" onClick={() => handleEdit(school)} className="h-8 w-8 p-0 rounded-lg" data-testid={`edit-school-${school.school_code}`}><Edit2 className="w-3.5 h-3.5" /></Button>
                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(school.id)} className="h-8 w-8 p-0 rounded-lg text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                                    </div>
                                </div>
                                <h3 className="font-bold text-base mb-0.5">{school.name}</h3>
                                <p className="text-xs text-muted-foreground mb-3">{school.school_code}</p>
                                <div className="space-y-1 text-xs text-muted-foreground">
                                    {school.principal_name && <p>Principal: {school.principal_name}</p>}
                                    {school.phone && <p>Phone: {school.phone}</p>}
                                    {school.email && <p>Email: {school.email}</p>}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="empty-state mt-8">
                    <Building2 className="empty-state-icon" />
                    <h3 className="text-base font-semibold mb-1">No schools yet</h3>
                    <p className="text-sm text-muted-foreground">Create your first school to get started</p>
                </div>
            )}
        </div>
    );
}
