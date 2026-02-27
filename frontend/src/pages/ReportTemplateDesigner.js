import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Switch } from '../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core';
import {
    SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
    useSortable, arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    Save, Loader2, ArrowLeft, Plus, Trash2, GripVertical, Eye, EyeOff,
    School, BookOpen, Award, BarChart3, Heart, FileText, MessageSquare,
    PenTool, Image, Type, Minus, ChevronDown, ChevronRight, Palette,
    LayoutGrid, Star, Users
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ==================== THEME PRESETS ====================
const THEME_PRESETS = {
    'classic-blue': { name: 'Classic Blue', primaryColor: '#1e40af', accentColor: '#3b82f6', headerBg: '#1e40af', headerText: '#ffffff', bodyBg: '#ffffff', bodyText: '#000000', tableBorder: '#9ca3af', fontFamily: 'Arial, sans-serif' },
    'emerald-green': { name: 'Emerald Green', primaryColor: '#065f46', accentColor: '#10b981', headerBg: '#065f46', headerText: '#ffffff', bodyBg: '#ffffff', bodyText: '#1f2937', tableBorder: '#6b7280', fontFamily: 'Georgia, serif' },
    'royal-purple': { name: 'Royal Purple', primaryColor: '#581c87', accentColor: '#8b5cf6', headerBg: '#581c87', headerText: '#ffffff', bodyBg: '#ffffff', bodyText: '#1f2937', tableBorder: '#9ca3af', fontFamily: 'Times New Roman, serif' },
    'professional-gray': { name: 'Professional Gray', primaryColor: '#1f2937', accentColor: '#6b7280', headerBg: '#1f2937', headerText: '#ffffff', bodyBg: '#ffffff', bodyText: '#111827', tableBorder: '#d1d5db', fontFamily: 'Helvetica, Arial, sans-serif' },
    'warm-burgundy': { name: 'Warm Burgundy', primaryColor: '#7f1d1d', accentColor: '#dc2626', headerBg: '#7f1d1d', headerText: '#ffffff', bodyBg: '#ffffff', bodyText: '#1f2937', tableBorder: '#9ca3af', fontFamily: 'Georgia, serif' },
};

const FONT_OPTIONS = [
    'Arial, sans-serif', 'Times New Roman, serif', 'Georgia, serif',
    'Helvetica, Arial, sans-serif', 'Verdana, sans-serif', 'Courier New, monospace',
    'Trebuchet MS, sans-serif', 'Palatino, serif'
];

const BLOCK_TYPE_INFO = {
    'school-header': { icon: School, label: 'School Header', deletable: false },
    'student-info': { icon: Users, label: 'Student Info', deletable: false },
    'term-info': { icon: LayoutGrid, label: 'Term & Attendance', deletable: false },
    'grades-table': { icon: BookOpen, label: 'Academic Grades', deletable: false },
    'grade-key': { icon: Award, label: 'Grade Key', deletable: true },
    'weight-key': { icon: BarChart3, label: 'Weight Key', deletable: true },
    'achievement-standards': { icon: Star, label: 'Achievement Standards', deletable: true },
    'social-skills': { icon: Heart, label: 'Social Skills', deletable: true },
    'comments': { icon: MessageSquare, label: 'Teacher Comments', deletable: true },
    'signatures': { icon: PenTool, label: 'Signatures', deletable: true },
    'footer': { icon: FileText, label: 'Footer', deletable: true },
    'custom-text': { icon: Type, label: 'Custom Text', deletable: true },
    'custom-image': { icon: Image, label: 'Custom Image', deletable: true },
    'spacer': { icon: Minus, label: 'Spacer', deletable: true },
};

// ==================== DEFAULT BLOCKS ====================
const buildDefaultBlocks = (schoolName, schoolCode) => [
    { id: 'school-header', type: 'school-header', order: 0, visible: true, config: { school_name: schoolName, school_motto: '', logo_url: '', header_text: 'REPORT CARD', sub_header_text: '' }, styles: {} },
    { id: 'student-info', type: 'student-info', order: 1, visible: true, config: { fields: ['last_name','first_name','dob','age','grade','gender','house','student_id'], columns: 4 }, styles: {} },
    { id: 'term-info', type: 'term-info', order: 2, visible: true, config: { fields: ['term','academic_year','class_size','position','days_in_term','days_absent','days_present','class_name'], columns: 4 }, styles: {} },
    { id: 'grades-table', type: 'grades-table', order: 3, visible: true, config: { subjects: [
        {name:'English Language',is_core:true},{name:'Mathematics',is_core:true},{name:'Science',is_core:true},{name:'Social Studies',is_core:true},
        {name:'Religious Education',is_core:false},{name:'Physical Education',is_core:false},{name:'Creative Arts',is_core:false},{name:'Music',is_core:false},{name:'ICT',is_core:false},{name:'French',is_core:false}
    ], use_weighted: false, weights: {homework:5,groupWork:5,project:10,quiz:10,midTerm:30,endOfTerm:40}, grade_scale: [
        {min:90,max:100,grade:'A+',description:'Excellent'},{min:85,max:89,grade:'A',description:'Very Good'},{min:80,max:84,grade:'A-',description:'Good'},
        {min:75,max:79,grade:'B',description:'Satisfactory'},{min:70,max:74,grade:'B-',description:'Developing'},{min:65,max:69,grade:'C',description:'Passing'},
        {min:60,max:64,grade:'C-',description:'Passing'},{min:55,max:59,grade:'D',description:'Marginal'},{min:50,max:54,grade:'D-',description:'Below Average'},
        {min:40,max:49,grade:'E',description:'Frustration'},{min:0,max:39,grade:'U',description:'No participation'}
    ], show_achievement: true }, styles: {} },
    { id: 'grade-key', type: 'grade-key', order: 4, visible: true, config: {}, styles: {} },
    { id: 'weight-key', type: 'weight-key', order: 5, visible: true, config: {}, styles: {} },
    { id: 'achievement-standards', type: 'achievement-standards', order: 6, visible: true, config: { standards: [
        {min:85,max:100,band:'Highly Proficient',description:'Excellent understanding'},{min:70,max:84,band:'Proficient',description:'Good understanding'},
        {min:50,max:69,band:'Developing',description:'Making progress'},{min:0,max:49,band:'Beginning',description:'Needs additional support'}
    ] }, styles: {} },
    { id: 'social-skills', type: 'social-skills', order: 7, visible: true, config: { categories: [
        {category_name:'Work and Personal Ethics',skills:['Completes Assignments','Follows Instructions','Punctuality','Deportment','Courteous in Speech and Action','Class Participation']},
        {category_name:'Respect',skills:['Respect for Teacher','Respect for Peers']}
    ], ratings: ['Excellent','Good','Satisfactory','Needs Improvement'] }, styles: {} },
    { id: 'comments', type: 'comments', order: 8, visible: true, config: { title: "CLASS TEACHER'S COMMENTS" }, styles: {} },
    { id: 'signatures', type: 'signatures', order: 9, visible: true, config: { types: ['teacher','principal'] }, styles: {} },
    { id: 'footer', type: 'footer', order: 10, visible: true, config: {}, styles: {} },
];

// ==================== EXTRACT FLAT FIELDS ====================
const blocksToFlat = (blocks, theme) => {
    const gradesBlock = blocks.find(b => b.type === 'grades-table');
    const skillsBlock = blocks.find(b => b.type === 'social-skills');
    const achBlock = blocks.find(b => b.type === 'achievement-standards');
    const headerBlock = blocks.find(b => b.type === 'school-header');
    return {
        subjects: gradesBlock?.config?.subjects || [],
        grade_scale: gradesBlock?.config?.grade_scale || [],
        use_weighted_grading: gradesBlock?.config?.use_weighted || false,
        assessment_weights: gradesBlock?.config?.weights || {},
        social_skills_categories: skillsBlock?.config?.categories || [],
        skill_ratings: skillsBlock?.config?.ratings || [],
        achievement_standards: achBlock?.config?.standards || [],
        school_name: headerBlock?.config?.school_name || '',
        school_motto: headerBlock?.config?.school_motto || '',
        logo_url: headerBlock?.config?.logo_url || '',
        header_text: headerBlock?.config?.header_text || '',
        sub_header_text: headerBlock?.config?.sub_header_text || '',
        sections: Object.fromEntries(blocks.map(b => [b.type.replace(/-/g, '_'), b.visible])),
    };
};

// ==================== MIGRATE OLD TEMPLATE TO BLOCKS ====================
const migrateToBlocks = (tpl) => {
    if (tpl.blocks?.length) return tpl.blocks;
    const blocks = buildDefaultBlocks(tpl.school_name, tpl.school_code);
    const hdr = blocks.find(b => b.type === 'school-header');
    if (hdr) { hdr.config = { school_name: tpl.school_name || '', school_motto: tpl.school_motto || '', logo_url: tpl.logo_url || '', header_text: tpl.header_text || 'REPORT CARD', sub_header_text: tpl.sub_header_text || '' }; }
    const gt = blocks.find(b => b.type === 'grades-table');
    if (gt && tpl.subjects?.length) { gt.config.subjects = tpl.subjects; gt.config.grade_scale = tpl.grade_scale || gt.config.grade_scale; gt.config.use_weighted = tpl.use_weighted_grading || false; gt.config.weights = tpl.assessment_weights || gt.config.weights; }
    const ss = blocks.find(b => b.type === 'social-skills');
    if (ss && tpl.social_skills_categories?.length) { ss.config.categories = tpl.social_skills_categories; ss.config.ratings = tpl.skill_ratings || ss.config.ratings; }
    const ach = blocks.find(b => b.type === 'achievement-standards');
    if (ach && tpl.achievement_standards?.length) { ach.config.standards = tpl.achievement_standards; }
    if (tpl.sections) {
        blocks.forEach(b => {
            const key = b.type.replace(/-/g, '_');
            if (tpl.sections[key] !== undefined) b.visible = tpl.sections[key];
        });
    }
    return blocks;
};

// ==================== SORTABLE BLOCK ITEM ====================
const SortableBlock = ({ block, isSelected, onSelect, onToggleVisible, onDelete }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block.id });
    const style = { transform: CSS.Transform.toString(transform), transition };
    const info = BLOCK_TYPE_INFO[block.type] || { icon: FileText, label: block.type };
    const Icon = info.icon;

    return (
        <div ref={setNodeRef} style={style} className={`flex items-center gap-1.5 p-2 rounded-xl cursor-pointer transition-all text-sm ${isSelected ? 'bg-primary/10 ring-1 ring-primary' : 'hover:bg-muted/50'} ${!block.visible ? 'opacity-40' : ''}`}
            onClick={() => onSelect(block.id)} data-testid={`block-item-${block.id}`}>
            <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground hover:text-foreground" data-testid={`drag-handle-${block.id}`}>
                <GripVertical className="w-3.5 h-3.5" />
            </button>
            <Icon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <span className="flex-1 truncate text-xs font-medium">{info.label}</span>
            <button onClick={e => { e.stopPropagation(); onToggleVisible(block.id); }} className="p-0.5 text-muted-foreground hover:text-foreground">
                {block.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            </button>
            {info.deletable && (
                <button onClick={e => { e.stopPropagation(); onDelete(block.id); }} className="p-0.5 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3 h-3" />
                </button>
            )}
        </div>
    );
};

// ==================== BLOCK EDITORS ====================
const ColorInput = ({ label, value, onChange }) => (
    <div className="flex items-center gap-2">
        <Label className="text-xs w-20 flex-shrink-0">{label}</Label>
        <div className="flex items-center gap-1.5 flex-1">
            <input type="color" value={value || '#000000'} onChange={e => onChange(e.target.value)} className="w-7 h-7 rounded border cursor-pointer" />
            <Input value={value || ''} onChange={e => onChange(e.target.value)} className="h-7 text-xs rounded-lg flex-1" placeholder="#hex" />
        </div>
    </div>
);

const BlockStyleEditor = ({ styles, onChange }) => (
    <div className="space-y-2 p-3 rounded-xl bg-muted/20 mt-3">
        <Label className="text-xs font-semibold flex items-center gap-1"><Palette className="w-3 h-3" /> Style Overrides</Label>
        <ColorInput label="Background" value={styles?.backgroundColor} onChange={v => onChange({...styles, backgroundColor: v})} />
        <ColorInput label="Text Color" value={styles?.color} onChange={v => onChange({...styles, color: v})} />
        <div className="flex items-center gap-2">
            <Label className="text-xs w-20">Font</Label>
            <Select value={styles?.fontFamily || ''} onValueChange={v => onChange({...styles, fontFamily: v})}>
                <SelectTrigger className="h-7 text-xs rounded-lg flex-1"><SelectValue placeholder="Theme default" /></SelectTrigger>
                <SelectContent>{FONT_OPTIONS.map(f => <SelectItem key={f} value={f} style={{fontFamily:f}}>{f.split(',')[0]}</SelectItem>)}</SelectContent>
            </Select>
        </div>
    </div>
);

const SchoolHeaderEditor = ({ config, onChange }) => (
    <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">School Name</Label><Input value={config.school_name||''} onChange={e=>onChange({...config,school_name:e.target.value})} className="h-8 text-xs rounded-lg" /></div>
            <div><Label className="text-xs">Motto</Label><Input value={config.school_motto||''} onChange={e=>onChange({...config,school_motto:e.target.value})} className="h-8 text-xs rounded-lg" /></div>
            <div><Label className="text-xs">Header Text</Label><Input value={config.header_text||''} onChange={e=>onChange({...config,header_text:e.target.value})} className="h-8 text-xs rounded-lg" /></div>
            <div><Label className="text-xs">Sub-Header</Label><Input value={config.sub_header_text||''} onChange={e=>onChange({...config,sub_header_text:e.target.value})} className="h-8 text-xs rounded-lg" /></div>
        </div>
        <div><Label className="text-xs">Logo URL</Label><Input value={config.logo_url||''} onChange={e=>onChange({...config,logo_url:e.target.value})} className="h-8 text-xs rounded-lg" placeholder="URL or upload path" /></div>
    </div>
);

const GradesTableEditor = ({ config, onChange }) => {
    const updateSubject = (i, field, val) => { const s = [...config.subjects]; s[i] = {...s[i], [field]: val}; onChange({...config, subjects: s}); };
    const addSubject = () => onChange({...config, subjects: [...config.subjects, {name:'',is_core:false}]});
    const removeSubject = (i) => onChange({...config, subjects: config.subjects.filter((_,idx)=>idx!==i)});
    const updateGrade = (i, field, val) => { const g = [...config.grade_scale]; g[i] = {...g[i], [field]: field==='min'||field==='max'? parseInt(val)||0 : val}; onChange({...config, grade_scale: g}); };
    const addGrade = () => onChange({...config, grade_scale: [...config.grade_scale, {min:0,max:0,grade:'',description:''}]});
    const removeGrade = (i) => onChange({...config, grade_scale: config.grade_scale.filter((_,idx)=>idx!==i)});
    const totalWeight = Object.values(config.weights||{}).reduce((s,w)=>s+(w||0),0);

    return (
        <div className="space-y-3">
            <div>
                <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs font-semibold">Subjects</Label>
                    <Button variant="ghost" size="sm" onClick={addSubject} className="h-6 text-xs px-2"><Plus className="w-3 h-3 mr-1"/>Add</Button>
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                    {config.subjects.map((s,i) => (
                        <div key={i} className="flex items-center gap-1">
                            <Input value={s.name} onChange={e=>updateSubject(i,'name',e.target.value)} className="h-7 text-xs rounded-lg flex-1" placeholder="Subject" />
                            <div className="flex items-center gap-1"><Switch checked={s.is_core} onCheckedChange={v=>updateSubject(i,'is_core',v)} /><span className="text-[10px]">Core</span></div>
                            <button onClick={()=>removeSubject(i)} className="text-destructive"><Trash2 className="w-3 h-3"/></button>
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                <Label className="text-xs">Weighted Grading</Label>
                <Switch checked={config.use_weighted} onCheckedChange={v=>onChange({...config,use_weighted:v})} />
            </div>
            {config.use_weighted && (
                <div className="space-y-1">
                    {Object.entries(config.weights||{}).map(([k,v]) => (
                        <div key={k} className="flex items-center gap-2">
                            <Label className="text-[10px] w-20 capitalize">{k.replace(/([A-Z])/g,' $1')}</Label>
                            <Input type="number" min="0" max="100" value={v} onChange={e=>onChange({...config,weights:{...config.weights,[k]:parseFloat(e.target.value)||0}})} className="w-14 h-6 text-xs rounded-lg text-center" />
                            <span className="text-[10px]">%</span>
                        </div>
                    ))}
                    <p className={`text-[10px] font-medium ${totalWeight===100?'text-green-600':'text-destructive'}`}>Total: {totalWeight}%</p>
                </div>
            )}
            <div>
                <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs font-semibold">Grade Scale</Label>
                    <Button variant="ghost" size="sm" onClick={addGrade} className="h-6 text-xs px-2"><Plus className="w-3 h-3 mr-1"/>Add</Button>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                    {config.grade_scale.map((g,i) => (
                        <div key={i} className="flex items-center gap-1">
                            <Input type="number" value={g.min} onChange={e=>updateGrade(i,'min',e.target.value)} className="w-10 h-6 text-[10px] rounded text-center" />
                            <span className="text-[10px]">-</span>
                            <Input type="number" value={g.max} onChange={e=>updateGrade(i,'max',e.target.value)} className="w-10 h-6 text-[10px] rounded text-center" />
                            <Input value={g.grade} onChange={e=>updateGrade(i,'grade',e.target.value)} className="w-10 h-6 text-[10px] rounded text-center font-bold" />
                            <Input value={g.description} onChange={e=>updateGrade(i,'description',e.target.value)} className="flex-1 h-6 text-[10px] rounded" placeholder="Desc" />
                            <button onClick={()=>removeGrade(i)} className="text-destructive"><Trash2 className="w-3 h-3"/></button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const SocialSkillsEditor = ({ config, onChange }) => {
    const updateCat = (ci, field, val) => { const c = [...config.categories]; c[ci] = {...c[ci], [field]: val}; onChange({...config, categories: c}); };
    const updateSkill = (ci, si, val) => { const c = [...config.categories]; const s=[...c[ci].skills]; s[si]=val; c[ci]={...c[ci],skills:s}; onChange({...config,categories:c}); };
    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-1 p-2 rounded-lg bg-muted/30">
                <Label className="text-xs w-full mb-1">Ratings</Label>
                {(config.ratings||[]).map((r,i)=>(
                    <div key={i} className="flex items-center gap-0.5 bg-background rounded border px-1">
                        <Input value={r} onChange={e=>{const rs=[...config.ratings];rs[i]=e.target.value;onChange({...config,ratings:rs});}} className="border-0 h-6 w-24 text-[10px] p-0 focus-visible:ring-0" />
                        <button onClick={()=>onChange({...config,ratings:config.ratings.filter((_,idx)=>idx!==i)})} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-2.5 h-2.5"/></button>
                    </div>
                ))}
                <Button variant="ghost" size="sm" onClick={()=>onChange({...config,ratings:[...(config.ratings||[]),'New']})} className="h-6 text-[10px] px-1"><Plus className="w-3 h-3"/></Button>
            </div>
            {config.categories.map((cat,ci) => (
                <div key={ci} className="p-2 rounded-lg border space-y-1">
                    <div className="flex items-center gap-1">
                        <Input value={cat.category_name} onChange={e=>updateCat(ci,'category_name',e.target.value)} className="h-7 text-xs rounded-lg font-medium flex-1" />
                        <button onClick={()=>onChange({...config,categories:config.categories.filter((_,i)=>i!==ci)})} className="text-destructive"><Trash2 className="w-3.5 h-3.5"/></button>
                    </div>
                    {cat.skills.map((sk,si)=>(
                        <div key={si} className="flex items-center gap-1 pl-3">
                            <Input value={sk} onChange={e=>updateSkill(ci,si,e.target.value)} className="h-6 text-[10px] rounded flex-1" />
                            <button onClick={()=>{const c=[...config.categories];c[ci]={...c[ci],skills:c[ci].skills.filter((_,i)=>i!==si)};onChange({...config,categories:c});}} className="text-destructive"><Trash2 className="w-2.5 h-2.5"/></button>
                        </div>
                    ))}
                    <Button variant="ghost" size="sm" onClick={()=>{const c=[...config.categories];c[ci]={...c[ci],skills:[...c[ci].skills,'']};onChange({...config,categories:c});}} className="h-5 text-[10px] px-2 ml-3"><Plus className="w-2.5 h-2.5 mr-0.5"/>Skill</Button>
                </div>
            ))}
            <Button variant="outline" size="sm" onClick={()=>onChange({...config,categories:[...config.categories,{category_name:'New Category',skills:['']}]})} className="text-xs h-7 rounded-full"><Plus className="w-3 h-3 mr-1"/>Category</Button>
        </div>
    );
};

const AchievementEditor = ({ config, onChange }) => (
    <div className="space-y-1">
        {(config.standards||[]).map((s,i)=>(
            <div key={i} className="flex items-center gap-1">
                <Input type="number" value={s.min} onChange={e=>{const st=[...config.standards];st[i]={...st[i],min:parseInt(e.target.value)||0};onChange({...config,standards:st});}} className="w-10 h-6 text-[10px] rounded text-center" />
                <span className="text-[10px]">-</span>
                <Input type="number" value={s.max} onChange={e=>{const st=[...config.standards];st[i]={...st[i],max:parseInt(e.target.value)||0};onChange({...config,standards:st});}} className="w-10 h-6 text-[10px] rounded text-center" />
                <Input value={s.band} onChange={e=>{const st=[...config.standards];st[i]={...st[i],band:e.target.value};onChange({...config,standards:st});}} className="flex-1 h-6 text-[10px] rounded" placeholder="Band" />
                <button onClick={()=>onChange({...config,standards:config.standards.filter((_,idx)=>idx!==i)})} className="text-destructive"><Trash2 className="w-3 h-3"/></button>
            </div>
        ))}
        <Button variant="ghost" size="sm" onClick={()=>onChange({...config,standards:[...(config.standards||[]),{min:0,max:0,band:'',description:''}]})} className="h-6 text-[10px] px-2"><Plus className="w-3 h-3 mr-1"/>Band</Button>
    </div>
);

const CommentsEditor = ({ config, onChange }) => (
    <div><Label className="text-xs">Section Title</Label><Input value={config.title||''} onChange={e=>onChange({...config,title:e.target.value})} className="h-8 text-xs rounded-lg" /></div>
);

const CustomTextEditor = ({ config, onChange }) => (
    <div className="space-y-2">
        <div><Label className="text-xs">Title</Label><Input value={config.title||''} onChange={e=>onChange({...config,title:e.target.value})} className="h-8 text-xs rounded-lg" /></div>
        <div><Label className="text-xs">Content</Label><textarea value={config.content||''} onChange={e=>onChange({...config,content:e.target.value})} className="w-full h-20 text-xs rounded-lg border p-2 resize-none" /></div>
    </div>
);

const CustomImageEditor = ({ config, onChange }) => (
    <div className="space-y-2">
        <div><Label className="text-xs">Image URL</Label><Input value={config.image_url||''} onChange={e=>onChange({...config,image_url:e.target.value})} className="h-8 text-xs rounded-lg" /></div>
        <div><Label className="text-xs">Max Height (px)</Label><Input type="number" value={config.max_height||100} onChange={e=>onChange({...config,max_height:parseInt(e.target.value)||100})} className="h-8 text-xs rounded-lg w-24" /></div>
    </div>
);

const BlockEditor = ({ block, onChange }) => {
    const updateConfig = (cfg) => onChange({...block, config: cfg});
    switch (block.type) {
        case 'school-header': return <SchoolHeaderEditor config={block.config} onChange={updateConfig} />;
        case 'grades-table': return <GradesTableEditor config={block.config} onChange={updateConfig} />;
        case 'social-skills': return <SocialSkillsEditor config={block.config} onChange={updateConfig} />;
        case 'achievement-standards': return <AchievementEditor config={block.config} onChange={updateConfig} />;
        case 'comments': return <CommentsEditor config={block.config} onChange={updateConfig} />;
        case 'custom-text': return <CustomTextEditor config={block.config} onChange={updateConfig} />;
        case 'custom-image': return <CustomImageEditor config={block.config} onChange={updateConfig} />;
        case 'spacer': return <div><Label className="text-xs">Height (px)</Label><Input type="number" value={block.config.height||20} onChange={e=>updateConfig({...block.config,height:parseInt(e.target.value)||20})} className="h-8 text-xs rounded-lg w-24" /></div>;
        default: return <p className="text-xs text-muted-foreground">This block uses default configuration.</p>;
    }
};

// ==================== LIVE PREVIEW ====================
const getBlockStyle = (block, theme) => {
    const s = block.styles || {};
    return {
        backgroundColor: s.backgroundColor || undefined,
        color: s.color || undefined,
        fontFamily: s.fontFamily || undefined,
    };
};

const PreviewBlock = ({ block, theme, allBlocks }) => {
    if (!block.visible) return null;
    const t = theme || THEME_PRESETS['classic-blue'];
    const st = getBlockStyle(block, t);
    const cfg = block.config || {};
    const gradesBlock = allBlocks.find(b => b.type === 'grades-table');
    const gradeScale = gradesBlock?.config?.grade_scale || [];

    switch (block.type) {
        case 'school-header':
            return (
                <div style={{...st, textAlign:'center', borderBottom: `2px solid ${t.primaryColor}`, paddingBottom: 6, marginBottom: 8}}>
                    <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8,marginBottom:4}}>
                        {cfg.logo_url ? <img src={cfg.logo_url.startsWith('http')?cfg.logo_url:`${process.env.REACT_APP_BACKEND_URL}${cfg.logo_url}`} alt="" style={{width:32,height:32,objectFit:'contain'}} /> :
                        <div style={{width:32,height:32,borderRadius:'50%',backgroundColor:t.primaryColor,color:t.headerText,display:'flex',alignItems:'center',justifyContent:'center',fontSize:7,fontWeight:'bold'}}>LOGO</div>}
                        <div><div style={{fontSize:10,fontWeight:'bold',textTransform:'uppercase',letterSpacing:0.5}}>{cfg.school_name}</div>
                        {cfg.school_motto && <div style={{fontSize:6,color:'#666'}}>{cfg.school_motto}</div>}</div>
                    </div>
                    {cfg.header_text && <div style={{fontSize:9,fontWeight:'bold',marginTop:3}}>{cfg.header_text}</div>}
                    {cfg.sub_header_text && <div style={{fontSize:7}}>{cfg.sub_header_text}</div>}
                </div>
            );
        case 'student-info':
            return (
                <div style={{...st, display:'grid',gridTemplateColumns:`repeat(${cfg.columns||4},1fr)`,gap:2,fontSize:5,border:'1px solid #ccc',padding:3,marginBottom:4}}>
                    <div><b>Surname:</b> Smith</div><div><b>First Name:</b> John</div><div><b>DOB:</b> 01/01/2015</div><div><b>Age:</b> 10 yrs</div>
                    <div><b>Grade:</b> 5</div><div><b>Gender:</b> Male</div><div><b>House:</b> Blue</div><div><b>ID:</b> S001</div>
                </div>
            );
        case 'term-info':
            return (
                <div style={{...st, display:'grid',gridTemplateColumns:`repeat(${cfg.columns||4},1fr)`,gap:2,fontSize:5,border:'1px solid #ccc',padding:3,marginBottom:4,backgroundColor:'#f9fafb'}}>
                    <div><b>Term:</b> Term 1</div><div><b>Year:</b> 2025-2026</div><div><b>Class Size:</b> 30</div><div><b>Position:</b> 5 of 30</div>
                    <div><b>Days:</b> 60</div><div><b>Absent:</b> 2</div><div><b>Present:</b> 58</div><div><b>Class:</b> 5A</div>
                </div>
            );
        case 'grades-table': {
            const subjects = cfg.subjects || [];
            return (
                <div style={{...st, marginBottom:6}}>
                    <div style={{backgroundColor:t.headerBg,color:t.headerText,padding:'2px 4px',fontSize:6,fontWeight:'bold'}}>ACADEMIC PERFORMANCE</div>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:5}}>
                        <thead><tr style={{backgroundColor:'#e5e7eb'}}>
                            <th style={{border:'1px solid #999',padding:1,textAlign:'left',width:40}}>Subject</th>
                            {cfg.use_weighted && <><th style={{border:'1px solid #999',padding:1,width:12}}>HW</th><th style={{border:'1px solid #999',padding:1,width:12}}>GW</th><th style={{border:'1px solid #999',padding:1,width:12}}>Proj</th><th style={{border:'1px solid #999',padding:1,width:12}}>Quiz</th><th style={{border:'1px solid #999',padding:1,width:16}}>Mid</th><th style={{border:'1px solid #999',padding:1,width:16}}>End</th></>}
                            <th style={{border:'1px solid #999',padding:1,width:16}}>{cfg.use_weighted?'Wt':'Score'}</th>
                            <th style={{border:'1px solid #999',padding:1,width:12}}>Gr</th>
                        </tr></thead>
                        <tbody>{subjects.slice(0,6).map((s,i)=>(
                            <tr key={i} style={{backgroundColor:s.is_core?'#eff6ff':i%2===0?'#fff':'#f9fafb'}}>
                                <td style={{border:'1px solid #ccc',padding:1}}>{s.name}{s.is_core&&<span style={{color:t.primaryColor}}>*</span>}</td>
                                {cfg.use_weighted && <><td style={{border:'1px solid #ccc',padding:1,textAlign:'center'}}>85</td><td style={{border:'1px solid #ccc',padding:1,textAlign:'center'}}>90</td><td style={{border:'1px solid #ccc',padding:1,textAlign:'center'}}>78</td><td style={{border:'1px solid #ccc',padding:1,textAlign:'center'}}>82</td><td style={{border:'1px solid #ccc',padding:1,textAlign:'center'}}>75</td><td style={{border:'1px solid #ccc',padding:1,textAlign:'center'}}>80</td></>}
                                <td style={{border:'1px solid #ccc',padding:1,textAlign:'center',fontWeight:'bold'}}>{80+i}</td>
                                <td style={{border:'1px solid #ccc',padding:1,textAlign:'center',fontWeight:'bold'}}>A-</td>
                            </tr>
                        ))}</tbody>
                        {subjects.length>6 && <tfoot><tr><td colSpan={cfg.use_weighted?9:3} style={{border:'1px solid #ccc',padding:1,textAlign:'center',fontSize:4,color:'#666'}}>... +{subjects.length-6} more subjects</td></tr></tfoot>}
                    </table>
                </div>
            );
        }
        case 'grade-key':
            return (
                <div style={{...st, border:'1px solid #ccc',padding:3,fontSize:5,marginBottom:4}}>
                    <div style={{fontWeight:'bold',marginBottom:2}}>KEY TO ACADEMIC GRADES</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                        {gradeScale.slice(0,6).map(g => <span key={g.grade}>{g.grade}: {g.min}-{g.max}</span>)}
                        {gradeScale.length>6 && <span>...</span>}
                    </div>
                </div>
            );
        case 'weight-key': {
            if (!gradesBlock?.config?.use_weighted) return null;
            const w = gradesBlock?.config?.weights || {};
            return (
                <div style={{...st, border:'1px solid #ccc',padding:3,fontSize:5,marginBottom:4}}>
                    <div style={{fontWeight:'bold',marginBottom:2}}>ASSESSMENT WEIGHTINGS</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                        {Object.entries(w).map(([k,v])=><span key={k}>{k.replace(/([A-Z])/g,' $1')}: {v}%</span>)}
                    </div>
                </div>
            );
        }
        case 'achievement-standards':
            return (
                <div style={{...st, border:'1px solid #ccc',padding:3,fontSize:5,marginBottom:4}}>
                    <div style={{fontWeight:'bold',marginBottom:2}}>ACHIEVEMENT STANDARDS</div>
                    <div style={{display:'flex',gap:3}}>
                        {(cfg.standards||[]).map(s => <div key={s.band} style={{flex:1,textAlign:'center',backgroundColor:'#f3f4f6',padding:2,borderRadius:2}}><div style={{fontWeight:'bold'}}>{s.band}</div><div style={{color:'#666'}}>{s.min}%-{s.max}%</div></div>)}
                    </div>
                </div>
            );
        case 'social-skills':
            return (
                <div style={{...st, marginBottom:4}}>
                    <div style={{backgroundColor:t.headerBg,color:t.headerText,padding:'2px 4px',fontSize:6,fontWeight:'bold'}}>SOCIAL SKILLS AND ATTITUDES</div>
                    <div style={{display:'grid',gridTemplateColumns:`repeat(${Math.min((cfg.categories||[]).length,2)},1fr)`,gap:4,border:'1px solid #ccc',padding:3,fontSize:5}}>
                        {(cfg.categories||[]).map(cat => (
                            <div key={cat.category_name}><div style={{fontWeight:'bold',marginBottom:2}}>{cat.category_name}</div>
                            {cat.skills.slice(0,3).map(sk => <div key={sk} style={{display:'flex',justifyContent:'space-between'}}><span>{sk}</span><span>[ ][ ][ ][ ]</span></div>)}
                            {cat.skills.length>3 && <div style={{color:'#666',fontSize:4}}>+{cat.skills.length-3} more</div>}</div>
                        ))}
                    </div>
                </div>
            );
        case 'comments':
            return (
                <div style={{...st, marginBottom:4}}>
                    <div style={{backgroundColor:t.headerBg,color:t.headerText,padding:'2px 4px',fontSize:6,fontWeight:'bold'}}>{cfg.title || "TEACHER'S COMMENTS"}</div>
                    <div style={{border:'1px solid #ccc',padding:4,minHeight:16,fontSize:5,color:'#999'}}>No comments recorded.</div>
                </div>
            );
        case 'signatures':
            return (
                <div style={{...st, display:'grid',gridTemplateColumns:`repeat(${(cfg.types||[]).length},1fr)`,gap:12,marginTop:8,fontSize:5}}>
                    {(cfg.types||['teacher','principal']).map(type => (
                        <div key={type} style={{textAlign:'center'}}><div style={{borderBottom:'1px solid #000',height:16,marginBottom:2}}></div><div style={{fontWeight:'bold'}}>{type==='teacher'?"Class Teacher's Signature":"Principal's Signature"}</div><div style={{color:'#666'}}>Date: ___________</div></div>
                    ))}
                </div>
            );
        case 'footer':
            return <div style={{...st, marginTop:6,paddingTop:4,borderTop:'1px solid #ccc',textAlign:'center',fontSize:4,color:'#999'}}>Report generated on {new Date().toLocaleDateString()}</div>;
        case 'custom-text':
            return (
                <div style={{...st, marginBottom:4}}>
                    {cfg.title && <div style={{backgroundColor:t.headerBg,color:t.headerText,padding:'2px 4px',fontSize:6,fontWeight:'bold'}}>{cfg.title}</div>}
                    <div style={{border:'1px solid #ccc',padding:3,fontSize:5}}>{cfg.content || 'Custom text content...'}</div>
                </div>
            );
        case 'custom-image':
            return cfg.image_url ? (
                <div style={{...st, textAlign:'center',marginBottom:4}}>
                    <img src={cfg.image_url} alt="" style={{maxHeight:cfg.max_height||100,objectFit:'contain'}} />
                </div>
            ) : <div style={{textAlign:'center',padding:8,border:'1px dashed #ccc',fontSize:5,color:'#999',marginBottom:4}}>Image placeholder</div>;
        case 'spacer':
            return <div style={{height: cfg.height || 20}} />;
        default:
            return <div style={{padding:4,border:'1px dashed #ccc',fontSize:5,color:'#999'}}>Unknown block: {block.type}</div>;
    }
};

// ==================== MAIN DESIGNER ====================
export default function ReportTemplateDesigner() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const schoolCode = searchParams.get('school');
    const { isSuperuser } = useAuth();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [blocks, setBlocks] = useState([]);
    const [theme, setTheme] = useState(THEME_PRESETS['classic-blue']);
    const [themePreset, setThemePreset] = useState('classic-blue');
    const [selectedBlockId, setSelectedBlockId] = useState(null);
    const [paperSize, setPaperSize] = useState('legal');
    const [rawTemplate, setRawTemplate] = useState(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const selectedBlock = useMemo(() => blocks.find(b => b.id === selectedBlockId), [blocks, selectedBlockId]);

    const fetchTemplate = useCallback(async () => {
        if (!schoolCode) return;
        try {
            const res = await axios.get(`${API}/report-templates/${schoolCode}`);
            const tpl = res.data;
            setRawTemplate(tpl);
            setPaperSize(tpl.paper_size || 'legal');
            if (tpl.theme) { setTheme(tpl.theme); setThemePreset(tpl.theme.preset || 'custom'); }
            setBlocks(migrateToBlocks(tpl));
        } catch (error) {
            toast.error('Failed to load template');
        } finally {
            setLoading(false);
        }
    }, [schoolCode]);

    useEffect(() => { fetchTemplate(); }, [fetchTemplate]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const flat = blocksToFlat(blocks, theme);
            const payload = {
                school_code: schoolCode,
                ...flat,
                paper_size: paperSize,
                blocks,
                theme: { ...theme, preset: themePreset },
            };
            await axios.put(`${API}/report-templates/${schoolCode}`, payload);
            toast.success('Template saved successfully');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            setBlocks(prev => {
                const oldIndex = prev.findIndex(b => b.id === active.id);
                const newIndex = prev.findIndex(b => b.id === over.id);
                return arrayMove(prev, oldIndex, newIndex).map((b, i) => ({ ...b, order: i }));
            });
        }
    };

    const toggleVisible = (id) => setBlocks(prev => prev.map(b => b.id === id ? { ...b, visible: !b.visible } : b));
    const deleteBlock = (id) => { setBlocks(prev => prev.filter(b => b.id !== id)); if (selectedBlockId === id) setSelectedBlockId(null); };
    const updateBlock = (updated) => setBlocks(prev => prev.map(b => b.id === updated.id ? updated : b));

    const addBlock = (type) => {
        const id = `${type}-${Date.now()}`;
        const defaultConfigs = { 'custom-text': {title:'',content:''}, 'custom-image': {image_url:'',max_height:100}, 'spacer': {height:20} };
        setBlocks(prev => [...prev, { id, type, order: prev.length, visible: true, config: defaultConfigs[type]||{}, styles: {} }]);
        setSelectedBlockId(id);
    };

    const applyPreset = (presetKey) => {
        setThemePreset(presetKey);
        if (THEME_PRESETS[presetKey]) setTheme(THEME_PRESETS[presetKey]);
    };

    if (!isSuperuser) return <div className="flex items-center justify-center min-h-[60vh]"><p className="text-muted-foreground">Superuser access required.</p></div>;
    if (!schoolCode) return <div className="flex items-center justify-center min-h-[60vh]"><p className="text-muted-foreground">No school specified.</p></div>;
    if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

    const paperHeight = paperSize === 'letter' ? 440 : paperSize === 'a4' ? 465 : 560;

    return (
        <div className="h-[calc(100vh-80px)] flex flex-col" data-testid="report-template-designer">
            {/* Top Bar */}
            <div className="flex items-center justify-between px-4 py-2 border-b bg-background flex-shrink-0">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/schools')} className="rounded-full h-8 w-8 p-0" data-testid="back-to-schools-btn"><ArrowLeft className="w-4 h-4" /></Button>
                    <div><h1 className="text-sm font-bold">Report Template Designer</h1><p className="text-[10px] text-muted-foreground">{rawTemplate?.school_name || schoolCode}</p></div>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={themePreset} onValueChange={applyPreset}>
                        <SelectTrigger className="h-8 w-40 text-xs rounded-lg" data-testid="theme-preset-select"><Palette className="w-3 h-3 mr-1" /><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(THEME_PRESETS).map(([k,v]) => <SelectItem key={k} value={k}>{v.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={paperSize} onValueChange={setPaperSize}>
                        <SelectTrigger className="h-8 w-28 text-xs rounded-lg" data-testid="paper-size-select"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="legal">Legal</SelectItem><SelectItem value="letter">Letter</SelectItem><SelectItem value="a4">A4</SelectItem></SelectContent>
                    </Select>
                    <Button onClick={handleSave} disabled={saving} className="rounded-full h-8 px-4 text-xs" data-testid="save-template-btn">
                        {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}Save
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left Panel - Block List + Editor */}
                <div className="w-80 border-r flex flex-col bg-muted/10 flex-shrink-0">
                    {/* Block List */}
                    <div className="p-2 border-b">
                        <div className="flex items-center justify-between mb-1">
                            <Label className="text-xs font-semibold">Blocks</Label>
                            <div className="flex gap-0.5">
                                {['custom-text','custom-image','spacer'].map(type => (
                                    <Button key={type} variant="ghost" size="sm" onClick={() => addBlock(type)} className="h-6 w-6 p-0" title={`Add ${type}`} data-testid={`add-block-${type}`}>
                                        {type==='custom-text'?<Type className="w-3 h-3"/>:type==='custom-image'?<Image className="w-3 h-3"/>:<Minus className="w-3 h-3"/>}
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <div className="max-h-[35vh] overflow-y-auto space-y-0.5">
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                <SortableContext items={blocks.map(b=>b.id)} strategy={verticalListSortingStrategy}>
                                    {blocks.map(block => (
                                        <SortableBlock key={block.id} block={block} isSelected={selectedBlockId === block.id}
                                            onSelect={setSelectedBlockId} onToggleVisible={toggleVisible} onDelete={deleteBlock} />
                                    ))}
                                </SortableContext>
                            </DndContext>
                        </div>
                    </div>

                    {/* Properties Panel */}
                    <div className="flex-1 overflow-y-auto p-3">
                        {selectedBlock ? (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                                        {(() => { const I = (BLOCK_TYPE_INFO[selectedBlock.type]||{}).icon || FileText; return <I className="w-3 h-3 text-primary" />; })()}
                                    </div>
                                    <Label className="text-xs font-semibold">{(BLOCK_TYPE_INFO[selectedBlock.type]||{}).label || selectedBlock.type}</Label>
                                </div>
                                <BlockEditor block={selectedBlock} onChange={updateBlock} />
                                <BlockStyleEditor styles={selectedBlock.styles} onChange={s => updateBlock({...selectedBlock, styles: s})} />
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                <LayoutGrid className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                <p className="text-xs">Click a block to edit its properties</p>
                            </div>
                        )}

                        {/* Theme Colors */}
                        <div className="mt-4 space-y-2 p-3 rounded-xl bg-muted/20">
                            <Label className="text-xs font-semibold flex items-center gap-1"><Palette className="w-3 h-3" /> Global Theme</Label>
                            <ColorInput label="Header BG" value={theme.headerBg} onChange={v => { setTheme(p=>({...p, headerBg: v, primaryColor: v})); setThemePreset('custom'); }} />
                            <ColorInput label="Header Text" value={theme.headerText} onChange={v => { setTheme(p=>({...p, headerText: v})); setThemePreset('custom'); }} />
                            <ColorInput label="Accent" value={theme.accentColor} onChange={v => { setTheme(p=>({...p, accentColor: v})); setThemePreset('custom'); }} />
                            <div className="flex items-center gap-2">
                                <Label className="text-xs w-20">Font</Label>
                                <Select value={theme.fontFamily || 'Arial, sans-serif'} onValueChange={v => { setTheme(p=>({...p, fontFamily: v})); setThemePreset('custom'); }}>
                                    <SelectTrigger className="h-7 text-xs rounded-lg flex-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>{FONT_OPTIONS.map(f => <SelectItem key={f} value={f} style={{fontFamily:f}}>{f.split(',')[0]}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel - Live Preview */}
                <div className="flex-1 overflow-auto bg-gray-100 p-6 flex justify-center">
                    <div data-testid="report-preview" style={{
                        width: 340,
                        minHeight: paperHeight,
                        padding: 16,
                        backgroundColor: theme.bodyBg || '#ffffff',
                        color: theme.bodyText || '#000000',
                        fontFamily: theme.fontFamily || 'Arial, sans-serif',
                        fontSize: 10,
                        lineHeight: 1.3,
                        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
                        borderRadius: 4,
                        flexShrink: 0,
                    }}>
                        {blocks.map(block => (
                            <div key={block.id}
                                onClick={() => setSelectedBlockId(block.id)}
                                className={`transition-all cursor-pointer ${selectedBlockId === block.id ? 'ring-2 ring-primary ring-offset-1 rounded' : 'hover:ring-1 hover:ring-primary/30 rounded'}`}
                                data-testid={`preview-block-${block.id}`}
                            >
                                <PreviewBlock block={block} theme={theme} allBlocks={blocks} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
