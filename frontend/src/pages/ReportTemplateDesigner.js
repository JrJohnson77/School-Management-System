import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Switch } from '../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import {
    Save,
    Loader2,
    ArrowLeft,
    Plus,
    Trash2,
    GripVertical,
    School,
    BookOpen,
    Award,
    BarChart3,
    LayoutList,
    Heart,
    FileText,
    ChevronDown,
    ChevronRight,
    Star
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CollapsibleSection = ({ title, icon: Icon, children, defaultOpen = false }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <Card className="rounded-2xl border-border/50 shadow-sm">
            <button
                type="button"
                className="w-full flex items-center justify-between p-5 hover:bg-muted/30 transition-colors rounded-t-2xl"
                onClick={() => setOpen(!open)}
                data-testid={`section-toggle-${title.toLowerCase().replace(/\s/g, '-')}`}
            >
                <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 text-primary" />
                    <span className="font-semibold text-base">{title}</span>
                </div>
                {open ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
            </button>
            {open && <CardContent className="pt-0 pb-5 px-5">{children}</CardContent>}
        </Card>
    );
};

export default function ReportTemplateDesigner() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const schoolCode = searchParams.get('school');
    const { isSuperuser } = useAuth();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [template, setTemplate] = useState(null);

    const fetchTemplate = useCallback(async () => {
        if (!schoolCode) return;
        try {
            const res = await axios.get(`${API}/report-templates/${schoolCode}`);
            setTemplate(res.data);
        } catch (error) {
            toast.error('Failed to load template');
        } finally {
            setLoading(false);
        }
    }, [schoolCode]);

    useEffect(() => {
        fetchTemplate();
    }, [fetchTemplate]);

    const handleSave = async () => {
        if (!template) return;
        setSaving(true);
        try {
            await axios.put(`${API}/report-templates/${schoolCode}`, template);
            toast.success('Report template saved successfully');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to save template');
        } finally {
            setSaving(false);
        }
    };

    const updateField = (field, value) => {
        setTemplate(prev => ({ ...prev, [field]: value }));
    };

    const updateSection = (key, value) => {
        setTemplate(prev => ({
            ...prev,
            sections: { ...prev.sections, [key]: value }
        }));
    };

    const updateWeight = (key, value) => {
        setTemplate(prev => ({
            ...prev,
            assessment_weights: { ...prev.assessment_weights, [key]: parseFloat(value) || 0 }
        }));
    };

    // Subject helpers
    const addSubject = () => {
        setTemplate(prev => ({
            ...prev,
            subjects: [...prev.subjects, { name: '', is_core: false }]
        }));
    };

    const updateSubject = (index, field, value) => {
        setTemplate(prev => {
            const subjects = [...prev.subjects];
            subjects[index] = { ...subjects[index], [field]: value };
            return { ...prev, subjects };
        });
    };

    const removeSubject = (index) => {
        setTemplate(prev => ({
            ...prev,
            subjects: prev.subjects.filter((_, i) => i !== index)
        }));
    };

    // Grade scale helpers
    const addGrade = () => {
        setTemplate(prev => ({
            ...prev,
            grade_scale: [...prev.grade_scale, { min: 0, max: 0, grade: '', description: '' }]
        }));
    };

    const updateGrade = (index, field, value) => {
        setTemplate(prev => {
            const scale = [...prev.grade_scale];
            scale[index] = { ...scale[index], [field]: field === 'min' || field === 'max' ? parseInt(value) || 0 : value };
            return { ...prev, grade_scale: scale };
        });
    };

    const removeGrade = (index) => {
        setTemplate(prev => ({
            ...prev,
            grade_scale: prev.grade_scale.filter((_, i) => i !== index)
        }));
    };

    // Achievement standards helpers
    const addAchievement = () => {
        setTemplate(prev => ({
            ...prev,
            achievement_standards: [...prev.achievement_standards, { min: 0, max: 0, band: '', description: '' }]
        }));
    };

    const updateAchievement = (index, field, value) => {
        setTemplate(prev => {
            const stds = [...prev.achievement_standards];
            stds[index] = { ...stds[index], [field]: field === 'min' || field === 'max' ? parseInt(value) || 0 : value };
            return { ...prev, achievement_standards: stds };
        });
    };

    const removeAchievement = (index) => {
        setTemplate(prev => ({
            ...prev,
            achievement_standards: prev.achievement_standards.filter((_, i) => i !== index)
        }));
    };

    // Social skills category helpers
    const addCategory = () => {
        setTemplate(prev => ({
            ...prev,
            social_skills_categories: [...prev.social_skills_categories, { category_name: '', skills: [''] }]
        }));
    };

    const updateCategoryName = (index, value) => {
        setTemplate(prev => {
            const cats = [...prev.social_skills_categories];
            cats[index] = { ...cats[index], category_name: value };
            return { ...prev, social_skills_categories: cats };
        });
    };

    const addSkillToCategory = (catIndex) => {
        setTemplate(prev => {
            const cats = [...prev.social_skills_categories];
            cats[catIndex] = { ...cats[catIndex], skills: [...cats[catIndex].skills, ''] };
            return { ...prev, social_skills_categories: cats };
        });
    };

    const updateSkill = (catIndex, skillIndex, value) => {
        setTemplate(prev => {
            const cats = [...prev.social_skills_categories];
            const skills = [...cats[catIndex].skills];
            skills[skillIndex] = value;
            cats[catIndex] = { ...cats[catIndex], skills };
            return { ...prev, social_skills_categories: cats };
        });
    };

    const removeSkill = (catIndex, skillIndex) => {
        setTemplate(prev => {
            const cats = [...prev.social_skills_categories];
            cats[catIndex] = { ...cats[catIndex], skills: cats[catIndex].skills.filter((_, i) => i !== skillIndex) };
            return { ...prev, social_skills_categories: cats };
        });
    };

    const removeCategory = (index) => {
        setTemplate(prev => ({
            ...prev,
            social_skills_categories: prev.social_skills_categories.filter((_, i) => i !== index)
        }));
    };

    // Skill rating helpers
    const addRating = () => {
        setTemplate(prev => ({
            ...prev,
            skill_ratings: [...(prev.skill_ratings || []), '']
        }));
    };

    const updateRating = (index, value) => {
        setTemplate(prev => {
            const ratings = [...(prev.skill_ratings || [])];
            ratings[index] = value;
            return { ...prev, skill_ratings: ratings };
        });
    };

    const removeRating = (index) => {
        setTemplate(prev => ({
            ...prev,
            skill_ratings: (prev.skill_ratings || []).filter((_, i) => i !== index)
        }));
    };

    if (!isSuperuser) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <p className="text-muted-foreground">Access denied. Superuser privileges required.</p>
            </div>
        );
    }

    if (!schoolCode) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <p className="text-muted-foreground">No school specified. Go to Schools page first.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!template) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <p className="text-muted-foreground">Template not found for this school.</p>
            </div>
        );
    }

    const totalWeight = Object.values(template.assessment_weights || {}).reduce((sum, w) => sum + (w || 0), 0);

    return (
        <div className="space-y-5 max-w-4xl mx-auto" data-testid="report-template-designer">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/schools')} className="rounded-full" data-testid="back-to-schools-btn">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Report Template Designer</h1>
                        <p className="text-muted-foreground text-sm">{template.school_name} ({schoolCode})</p>
                    </div>
                </div>
                <Button onClick={handleSave} disabled={saving} className="rounded-full px-6" data-testid="save-template-btn">
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Save Template
                </Button>
            </div>

            {/* 1. School Branding */}
            <CollapsibleSection title="School Branding" icon={School} defaultOpen={true}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>School Name *</Label>
                        <Input value={template.school_name} onChange={e => updateField('school_name', e.target.value)} className="rounded-xl" data-testid="template-school-name" />
                    </div>
                    <div className="space-y-2">
                        <Label>School Motto</Label>
                        <Input value={template.school_motto || ''} onChange={e => updateField('school_motto', e.target.value)} className="rounded-xl" placeholder="e.g., Excellence in Education" data-testid="template-school-motto" />
                    </div>
                    <div className="space-y-2">
                        <Label>Header Text</Label>
                        <Input value={template.header_text || ''} onChange={e => updateField('header_text', e.target.value)} className="rounded-xl" placeholder="e.g., UPPER SCHOOL REPORT CARD" data-testid="template-header-text" />
                    </div>
                    <div className="space-y-2">
                        <Label>Sub-Header Text</Label>
                        <Input value={template.sub_header_text || ''} onChange={e => updateField('sub_header_text', e.target.value)} className="rounded-xl" placeholder="e.g., Grades 4 - 6" data-testid="template-sub-header" />
                    </div>
                    <div className="space-y-2">
                        <Label>Logo URL</Label>
                        <Input value={template.logo_url || ''} onChange={e => updateField('logo_url', e.target.value)} className="rounded-xl" placeholder="Upload via Import/Export or paste URL" data-testid="template-logo-url" />
                    </div>
                    <div className="space-y-2">
                        <Label>Paper Size</Label>
                        <Select value={template.paper_size || 'legal'} onValueChange={v => updateField('paper_size', v)}>
                            <SelectTrigger className="rounded-xl" data-testid="template-paper-size">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="legal">Legal (8.5 x 14 in)</SelectItem>
                                <SelectItem value="letter">Letter (8.5 x 11 in)</SelectItem>
                                <SelectItem value="a4">A4 (210 x 297 mm)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CollapsibleSection>

            {/* 2. Subjects */}
            <CollapsibleSection title="Subjects" icon={BookOpen}>
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Define the subjects that appear on the report card. Core subjects are used for class ranking averages.</p>
                    {template.subjects.map((subj, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <GripVertical className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
                            <Input
                                value={subj.name}
                                onChange={e => updateSubject(i, 'name', e.target.value)}
                                className="rounded-xl flex-1"
                                placeholder="Subject name"
                                data-testid={`subject-name-${i}`}
                            />
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                <Switch checked={subj.is_core} onCheckedChange={v => updateSubject(i, 'is_core', v)} />
                                <Label className="text-xs whitespace-nowrap">Core</Label>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => removeSubject(i)} className="text-destructive hover:bg-destructive/10 flex-shrink-0" data-testid={`remove-subject-${i}`}>
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addSubject} className="rounded-full" data-testid="add-subject-btn">
                        <Plus className="w-4 h-4 mr-1" /> Add Subject
                    </Button>
                </div>
            </CollapsibleSection>

            {/* 3. Grade Scale */}
            <CollapsibleSection title="Grade Scale" icon={Award}>
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Define the grading scale with score ranges. Ranges should cover 0-100 without gaps.</p>
                    <div className="grid grid-cols-[60px_60px_80px_1fr_40px] gap-2 text-xs font-medium text-muted-foreground px-1">
                        <span>Min</span><span>Max</span><span>Grade</span><span>Description</span><span></span>
                    </div>
                    {template.grade_scale.map((g, i) => (
                        <div key={i} className="grid grid-cols-[60px_60px_80px_1fr_40px] gap-2 items-center">
                            <Input type="number" value={g.min} onChange={e => updateGrade(i, 'min', e.target.value)} className="rounded-lg h-9 text-sm" data-testid={`grade-min-${i}`} />
                            <Input type="number" value={g.max} onChange={e => updateGrade(i, 'max', e.target.value)} className="rounded-lg h-9 text-sm" data-testid={`grade-max-${i}`} />
                            <Input value={g.grade} onChange={e => updateGrade(i, 'grade', e.target.value)} className="rounded-lg h-9 text-sm font-bold" data-testid={`grade-label-${i}`} />
                            <Input value={g.description} onChange={e => updateGrade(i, 'description', e.target.value)} className="rounded-lg h-9 text-sm" placeholder="Description" data-testid={`grade-desc-${i}`} />
                            <Button variant="ghost" size="sm" onClick={() => removeGrade(i)} className="text-destructive hover:bg-destructive/10 h-9 w-9 p-0">
                                <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addGrade} className="rounded-full" data-testid="add-grade-btn">
                        <Plus className="w-4 h-4 mr-1" /> Add Grade Level
                    </Button>
                </div>
            </CollapsibleSection>

            {/* 4. Assessment Weights */}
            <CollapsibleSection title="Assessment Weights" icon={BarChart3}>
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                        <div>
                            <Label className="font-medium">Use Weighted Grading</Label>
                            <p className="text-xs text-muted-foreground">Enable component-based assessment (homework, quiz, mid-term, etc.)</p>
                        </div>
                        <Switch checked={template.use_weighted_grading} onCheckedChange={v => updateField('use_weighted_grading', v)} data-testid="weighted-grading-toggle" />
                    </div>

                    {template.use_weighted_grading && (
                        <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">Set the percentage weight for each assessment component. Total should equal 100%.</p>
                            {Object.entries(template.assessment_weights || {}).map(([key, val]) => (
                                <div key={key} className="flex items-center gap-3">
                                    <Label className="w-32 capitalize text-sm">{key.replace(/([A-Z])/g, ' $1').trim()}</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={val}
                                        onChange={e => updateWeight(key, e.target.value)}
                                        className="w-20 rounded-lg h-9 text-sm text-center"
                                        data-testid={`weight-${key}`}
                                    />
                                    <span className="text-sm text-muted-foreground">%</span>
                                </div>
                            ))}
                            <div className={`text-sm font-medium ${totalWeight === 100 ? 'text-green-600' : 'text-destructive'}`}>
                                Total: {totalWeight}% {totalWeight !== 100 && '(must equal 100%)'}
                            </div>
                        </div>
                    )}
                </div>
            </CollapsibleSection>

            {/* 5. Sections Toggle */}
            <CollapsibleSection title="Report Sections" icon={LayoutList}>
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Choose which sections appear on the report card.</p>
                    {Object.entries(template.sections || {}).map(([key, enabled]) => (
                        <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                            <Label className="capitalize text-sm">{key.replace(/_/g, ' ')}</Label>
                            <Switch checked={enabled} onCheckedChange={v => updateSection(key, v)} data-testid={`section-${key}`} />
                        </div>
                    ))}
                </div>
            </CollapsibleSection>

            {/* 6. Social Skills */}
            <CollapsibleSection title="Social Skills Categories" icon={Heart}>
                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">Define social skill categories and the skills within each category.</p>

                    {/* Skill Ratings */}
                    <div className="p-3 rounded-xl bg-muted/30 space-y-2">
                        <Label className="font-medium text-sm">Skill Ratings</Label>
                        <div className="flex flex-wrap gap-2">
                            {(template.skill_ratings || []).map((r, i) => (
                                <div key={i} className="flex items-center gap-1 bg-background rounded-lg border px-2 py-1">
                                    <Input
                                        value={r}
                                        onChange={e => updateRating(i, e.target.value)}
                                        className="border-0 h-7 w-32 text-sm p-0 focus-visible:ring-0"
                                        data-testid={`skill-rating-${i}`}
                                    />
                                    <button onClick={() => removeRating(i)} className="text-muted-foreground hover:text-destructive">
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            <Button variant="outline" size="sm" onClick={addRating} className="rounded-lg h-9">
                                <Plus className="w-3 h-3 mr-1" /> Rating
                            </Button>
                        </div>
                    </div>

                    {/* Categories */}
                    {template.social_skills_categories.map((cat, ci) => (
                        <div key={ci} className="p-4 rounded-xl border border-border/50 space-y-3">
                            <div className="flex items-center gap-2">
                                <Input
                                    value={cat.category_name}
                                    onChange={e => updateCategoryName(ci, e.target.value)}
                                    className="rounded-xl font-medium"
                                    placeholder="Category name"
                                    data-testid={`category-name-${ci}`}
                                />
                                <Button variant="ghost" size="sm" onClick={() => removeCategory(ci)} className="text-destructive hover:bg-destructive/10 flex-shrink-0">
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                            {cat.skills.map((skill, si) => (
                                <div key={si} className="flex items-center gap-2 pl-4">
                                    <Star className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" />
                                    <Input
                                        value={skill}
                                        onChange={e => updateSkill(ci, si, e.target.value)}
                                        className="rounded-lg h-8 text-sm"
                                        placeholder="Skill name"
                                        data-testid={`skill-${ci}-${si}`}
                                    />
                                    <Button variant="ghost" size="sm" onClick={() => removeSkill(ci, si)} className="text-destructive hover:bg-destructive/10 h-8 w-8 p-0 flex-shrink-0">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            ))}
                            <Button variant="ghost" size="sm" onClick={() => addSkillToCategory(ci)} className="rounded-full ml-4 text-xs" data-testid={`add-skill-${ci}`}>
                                <Plus className="w-3 h-3 mr-1" /> Add Skill
                            </Button>
                        </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addCategory} className="rounded-full" data-testid="add-category-btn">
                        <Plus className="w-4 h-4 mr-1" /> Add Category
                    </Button>
                </div>
            </CollapsibleSection>

            {/* 7. Achievement Standards */}
            <CollapsibleSection title="Achievement Standards" icon={FileText}>
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Define achievement bands based on End of Term exam scores.</p>
                    <div className="grid grid-cols-[60px_60px_1fr_1fr_40px] gap-2 text-xs font-medium text-muted-foreground px-1">
                        <span>Min</span><span>Max</span><span>Band</span><span>Description</span><span></span>
                    </div>
                    {template.achievement_standards.map((std, i) => (
                        <div key={i} className="grid grid-cols-[60px_60px_1fr_1fr_40px] gap-2 items-center">
                            <Input type="number" value={std.min} onChange={e => updateAchievement(i, 'min', e.target.value)} className="rounded-lg h-9 text-sm" data-testid={`ach-min-${i}`} />
                            <Input type="number" value={std.max} onChange={e => updateAchievement(i, 'max', e.target.value)} className="rounded-lg h-9 text-sm" data-testid={`ach-max-${i}`} />
                            <Input value={std.band} onChange={e => updateAchievement(i, 'band', e.target.value)} className="rounded-lg h-9 text-sm" data-testid={`ach-band-${i}`} />
                            <Input value={std.description} onChange={e => updateAchievement(i, 'description', e.target.value)} className="rounded-lg h-9 text-sm" placeholder="Description" data-testid={`ach-desc-${i}`} />
                            <Button variant="ghost" size="sm" onClick={() => removeAchievement(i)} className="text-destructive hover:bg-destructive/10 h-9 w-9 p-0">
                                <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addAchievement} className="rounded-full" data-testid="add-achievement-btn">
                        <Plus className="w-4 h-4 mr-1" /> Add Achievement Band
                    </Button>
                </div>
            </CollapsibleSection>

            {/* Bottom Save Button */}
            <div className="flex justify-end pb-8">
                <Button onClick={handleSave} disabled={saving} className="rounded-full px-8" data-testid="save-template-bottom-btn">
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Save Template
                </Button>
            </div>
        </div>
    );
}
