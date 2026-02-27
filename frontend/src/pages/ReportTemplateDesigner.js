import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import {
    Save, Loader2, ArrowLeft, Plus, Trash2, Type, Image, Minus, Move,
    Table, PenTool, Square, Heart, Upload, ZoomIn, ZoomOut, Copy,
    AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline, Lock, Unlock
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ==================== PAPER SIZES (at 96 DPI) ====================
const PAPER = {
    legal:  { w: 816, h: 1344, label: 'Legal (8.5×14in)' },
    letter: { w: 816, h: 1056, label: 'Letter (8.5×11in)' },
    a4:     { w: 794, h: 1123, label: 'A4 (210×297mm)' },
};

const FONTS = ['Arial','Times New Roman','Georgia','Helvetica','Verdana','Courier New','Trebuchet MS','Palatino'];

// ==================== DATA FIELD DEFINITIONS ====================
const DATA_FIELDS = [
    { cat: 'Student', fields: [
        { key: 'student.last_name', label: 'Last Name' },
        { key: 'student.first_name', label: 'First Name' },
        { key: 'student.middle_name', label: 'Middle Name' },
        { key: 'student.dob', label: 'Date of Birth' },
        { key: 'student.age', label: 'Age' },
        { key: 'student.gender', label: 'Gender' },
        { key: 'student.house', label: 'House' },
        { key: 'student.student_id', label: 'Student ID' },
    ]},
    { cat: 'Class', fields: [
        { key: 'class.name', label: 'Class Name' },
        { key: 'class.grade_level', label: 'Grade Level' },
        { key: 'term', label: 'Term' },
        { key: 'academic_year', label: 'Academic Year' },
        { key: 'position', label: 'Position' },
        { key: 'total_students', label: 'Total Students' },
    ]},
    { cat: 'Attendance', fields: [
        { key: 'attendance.total_days', label: 'Total Days' },
        { key: 'attendance.present', label: 'Days Present' },
        { key: 'attendance.absent', label: 'Days Absent' },
    ]},
    { cat: 'Other', fields: [
        { key: 'teacher_comment', label: 'Teacher Comment' },
    ]},
];

// ==================== DEFAULT CANVAS ELEMENTS ====================
const buildDefaultElements = (schoolName) => [
    { id:'el-logo', type:'image', x:360, y:15, width:70, height:70, config:{src:'',alt:'Logo'}, styles:{} },
    { id:'el-school', type:'text', x:130, y:25, width:550, height:35, config:{content:schoolName||'SCHOOL NAME'}, styles:{fontSize:22,fontWeight:'bold',textAlign:'center',fontFamily:'Arial'} },
    { id:'el-motto', type:'text', x:230, y:58, width:350, height:18, config:{content:'School Motto'}, styles:{fontSize:10,textAlign:'center',color:'#666666',fontStyle:'italic'} },
    { id:'el-header', type:'text', x:250, y:82, width:300, height:24, config:{content:'REPORT CARD'}, styles:{fontSize:16,fontWeight:'bold',textAlign:'center'} },
    { id:'el-line1', type:'line', x:30, y:112, width:756, height:3, config:{}, styles:{backgroundColor:'#1e40af'} },
    // Student info row
    { id:'el-lbl-surname', type:'text', x:30, y:125, width:70, height:16, config:{content:'Surname:'}, styles:{fontSize:9,fontWeight:'bold'} },
    { id:'el-val-surname', type:'data-field', x:100, y:125, width:100, height:16, config:{field:'student.last_name',showLabel:false}, styles:{fontSize:9} },
    { id:'el-lbl-fname', type:'text', x:210, y:125, width:75, height:16, config:{content:'First Name:'}, styles:{fontSize:9,fontWeight:'bold'} },
    { id:'el-val-fname', type:'data-field', x:285, y:125, width:100, height:16, config:{field:'student.first_name',showLabel:false}, styles:{fontSize:9} },
    { id:'el-lbl-dob', type:'text', x:400, y:125, width:40, height:16, config:{content:'DOB:'}, styles:{fontSize:9,fontWeight:'bold'} },
    { id:'el-val-dob', type:'data-field', x:440, y:125, width:80, height:16, config:{field:'student.dob',showLabel:false}, styles:{fontSize:9} },
    { id:'el-lbl-age', type:'text', x:530, y:125, width:30, height:16, config:{content:'Age:'}, styles:{fontSize:9,fontWeight:'bold'} },
    { id:'el-val-age', type:'data-field', x:560, y:125, width:50, height:16, config:{field:'student.age',showLabel:false}, styles:{fontSize:9} },
    { id:'el-lbl-gender', type:'text', x:620, y:125, width:50, height:16, config:{content:'Gender:'}, styles:{fontSize:9,fontWeight:'bold'} },
    { id:'el-val-gender', type:'data-field', x:670, y:125, width:50, height:16, config:{field:'student.gender',showLabel:false}, styles:{fontSize:9} },
    // Second row
    { id:'el-lbl-house', type:'text', x:30, y:145, width:50, height:16, config:{content:'House:'}, styles:{fontSize:9,fontWeight:'bold'} },
    { id:'el-val-house', type:'data-field', x:80, y:145, width:80, height:16, config:{field:'student.house',showLabel:false}, styles:{fontSize:9} },
    { id:'el-lbl-class', type:'text', x:170, y:145, width:40, height:16, config:{content:'Class:'}, styles:{fontSize:9,fontWeight:'bold'} },
    { id:'el-val-class', type:'data-field', x:210, y:145, width:80, height:16, config:{field:'class.name',showLabel:false}, styles:{fontSize:9} },
    { id:'el-lbl-term', type:'text', x:300, y:145, width:40, height:16, config:{content:'Term:'}, styles:{fontSize:9,fontWeight:'bold'} },
    { id:'el-val-term', type:'data-field', x:340, y:145, width:70, height:16, config:{field:'term',showLabel:false}, styles:{fontSize:9} },
    { id:'el-lbl-pos', type:'text', x:420, y:145, width:55, height:16, config:{content:'Position:'}, styles:{fontSize:9,fontWeight:'bold'} },
    { id:'el-val-pos', type:'data-field', x:475, y:145, width:60, height:16, config:{field:'position',showLabel:false}, styles:{fontSize:9} },
    { id:'el-lbl-total', type:'text', x:545, y:145, width:75, height:16, config:{content:'No. in Class:'}, styles:{fontSize:9,fontWeight:'bold'} },
    { id:'el-val-total', type:'data-field', x:620, y:145, width:50, height:16, config:{field:'total_students',showLabel:false}, styles:{fontSize:9} },
    { id:'el-line2', type:'line', x:30, y:166, width:756, height:1, config:{}, styles:{backgroundColor:'#cccccc'} },
    // Grades table
    { id:'el-grades', type:'grades-table', x:30, y:175, width:756, height:380, config:{
        subjects:[{name:'English Language',is_core:true},{name:'Mathematics',is_core:true},{name:'Science',is_core:true},{name:'Social Studies',is_core:true},{name:'Religious Education',is_core:false},{name:'Physical Education',is_core:false},{name:'Creative Arts',is_core:false},{name:'Music',is_core:false}],
        use_weighted:false, weights:{homework:5,groupWork:5,project:10,quiz:10,midTerm:30,endOfTerm:40},
        grade_scale:[{min:90,max:100,grade:'A+'},{min:80,max:89,grade:'A'},{min:70,max:79,grade:'B'},{min:60,max:69,grade:'C'},{min:50,max:59,grade:'D'},{min:0,max:49,grade:'E'}],
        headerBg:'#1e40af', headerText:'#ffffff'
    }, styles:{fontSize:9} },
    // Social skills
    { id:'el-skills', type:'social-skills', x:30, y:570, width:756, height:200, config:{
        categories:[{category_name:'Work and Personal Ethics',skills:['Completes Assignments','Follows Instructions','Punctuality','Deportment','Class Participation']},{category_name:'Respect',skills:['Respect for Teacher','Respect for Peers']}],
        ratings:['Excellent','Good','Satisfactory','Needs Improvement'], headerBg:'#1e40af', headerText:'#ffffff'
    }, styles:{fontSize:9} },
    // Comments
    { id:'el-comment-hdr', type:'rectangle', x:30, y:785, width:756, height:20, config:{}, styles:{backgroundColor:'#1e40af'} },
    { id:'el-comment-lbl', type:'text', x:35, y:786, width:300, height:18, config:{content:"CLASS TEACHER'S COMMENTS"}, styles:{fontSize:10,fontWeight:'bold',color:'#ffffff'} },
    { id:'el-comment-val', type:'data-field', x:30, y:808, width:756, height:50, config:{field:'teacher_comment',showLabel:false}, styles:{fontSize:10,border:'1px solid #ccc',padding:6} },
    // Signatures
    { id:'el-sig-teacher', type:'signature', x:80, y:880, width:250, height:60, config:{type:'teacher',label:"Class Teacher's Signature"}, styles:{} },
    { id:'el-sig-principal', type:'signature', x:480, y:880, width:250, height:60, config:{type:'principal',label:"Principal's Signature"}, styles:{} },
    // Footer
    { id:'el-footer', type:'text', x:200, y:960, width:400, height:16, config:{content:'Report generated on {{date}}'}, styles:{fontSize:8,textAlign:'center',color:'#999999'} },
];

// ==================== ELEMENT RENDERER (Canvas Preview) ====================
const ElementPreview = ({ el }) => {
    const s = el.styles || {};
    const cfg = el.config || {};
    const base = { fontSize: s.fontSize||10, fontFamily: s.fontFamily||'Arial', fontWeight: s.fontWeight||'normal', fontStyle: s.fontStyle||'normal', textDecoration: s.textDecoration||'none', color: s.color||'#000', textAlign: s.textAlign||'left', backgroundColor: s.backgroundColor||'transparent', border: s.border||'none', borderRadius: s.borderRadius||0, padding: s.padding||0, overflow:'hidden', width:'100%', height:'100%', boxSizing:'border-box' };

    switch (el.type) {
        case 'text':
            return <div style={base}>{cfg.content || ''}</div>;
        case 'data-field':
            return <div style={{...base, color: s.color||'#0066cc'}}>{cfg.showLabel!==false ? `${DATA_FIELDS.flatMap(c=>c.fields).find(f=>f.key===cfg.field)?.label||cfg.field}: ` : ''}<span style={{textDecoration:'underline dotted'}}>{`{{${cfg.field||'field'}}}`}</span></div>;
        case 'image':
            return cfg.src ? <img src={cfg.src.startsWith('http')?cfg.src:`${process.env.REACT_APP_BACKEND_URL}${cfg.src}`} alt={cfg.alt||''} style={{width:'100%',height:'100%',objectFit:'contain'}} /> : <div style={{...base,border:'1px dashed #aaa',display:'flex',alignItems:'center',justifyContent:'center',color:'#999',fontSize:8}}>Image</div>;
        case 'line':
            return <div style={{width:'100%',height:'100%',backgroundColor:s.backgroundColor||'#000'}} />;
        case 'rectangle':
            return <div style={{width:'100%',height:'100%',backgroundColor:s.backgroundColor||'#eee',border:s.border||'none',borderRadius:s.borderRadius||0}} />;
        case 'signature':
            return (
                <div style={{...base,textAlign:'center',display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
                    <div style={{borderBottom:'1px solid #000',marginBottom:3,height:'60%'}} />
                    <div style={{fontSize:s.fontSize||9,fontWeight:'bold'}}>{cfg.label||'Signature'}</div>
                    <div style={{fontSize:7,color:'#666'}}>Date: ___________</div>
                </div>
            );
        case 'grades-table': {
            const subjs = cfg.subjects || [];
            const hBg = cfg.headerBg || '#1e40af';
            const hTxt = cfg.headerText || '#fff';
            return (
                <div style={{...base, overflow:'auto'}}>
                    <div style={{backgroundColor:hBg,color:hTxt,padding:'2px 4px',fontSize:Math.max(s.fontSize||9,7),fontWeight:'bold'}}>ACADEMIC PERFORMANCE</div>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:Math.max((s.fontSize||9)-1,6)}}>
                        <thead><tr style={{backgroundColor:'#e5e7eb'}}>
                            <th style={{border:'1px solid #999',padding:1,textAlign:'left'}}>Subject</th>
                            {cfg.use_weighted && <><th style={{border:'1px solid #999',padding:1}}>HW</th><th style={{border:'1px solid #999',padding:1}}>GW</th><th style={{border:'1px solid #999',padding:1}}>Proj</th><th style={{border:'1px solid #999',padding:1}}>Quiz</th><th style={{border:'1px solid #999',padding:1}}>Mid</th><th style={{border:'1px solid #999',padding:1}}>End</th></>}
                            <th style={{border:'1px solid #999',padding:1}}>Score</th>
                            <th style={{border:'1px solid #999',padding:1}}>Grade</th>
                        </tr></thead>
                        <tbody>{subjs.map((sub,i)=>(
                            <tr key={i} style={{backgroundColor:sub.is_core?'#eff6ff':i%2===0?'#fff':'#f9fafb'}}>
                                <td style={{border:'1px solid #ccc',padding:1}}>{sub.name}{sub.is_core?'*':''}</td>
                                {cfg.use_weighted && <><td style={{border:'1px solid #ccc',padding:1,textAlign:'center'}}>-</td><td style={{border:'1px solid #ccc',padding:1,textAlign:'center'}}>-</td><td style={{border:'1px solid #ccc',padding:1,textAlign:'center'}}>-</td><td style={{border:'1px solid #ccc',padding:1,textAlign:'center'}}>-</td><td style={{border:'1px solid #ccc',padding:1,textAlign:'center'}}>-</td><td style={{border:'1px solid #ccc',padding:1,textAlign:'center'}}>-</td></>}
                                <td style={{border:'1px solid #ccc',padding:1,textAlign:'center'}}>-</td>
                                <td style={{border:'1px solid #ccc',padding:1,textAlign:'center'}}>-</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            );
        }
        case 'social-skills': {
            const cats = cfg.categories || [];
            const hBg = cfg.headerBg || '#1e40af';
            const hTxt = cfg.headerText || '#fff';
            return (
                <div style={{...base, overflow:'auto'}}>
                    <div style={{backgroundColor:hBg,color:hTxt,padding:'2px 4px',fontSize:Math.max(s.fontSize||9,7),fontWeight:'bold'}}>SOCIAL SKILLS AND ATTITUDES</div>
                    <div style={{display:'grid',gridTemplateColumns:`repeat(${Math.min(cats.length,2)},1fr)`,gap:6,border:'1px solid #ccc',padding:3}}>
                        {cats.map(cat=>(
                            <div key={cat.category_name}>
                                <div style={{fontWeight:'bold',fontSize:Math.max((s.fontSize||9)-1,6),marginBottom:2}}>{cat.category_name}</div>
                                {cat.skills.map(sk=>(
                                    <div key={sk} style={{display:'flex',justifyContent:'space-between',fontSize:Math.max((s.fontSize||9)-2,5)}}><span>{sk}</span><span style={{letterSpacing:2}}>{'[ ]'.repeat(Math.min((cfg.ratings||[]).length,4))}</span></div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        default:
            return <div style={{...base,border:'1px dashed #ccc',color:'#999',display:'flex',alignItems:'center',justifyContent:'center',fontSize:8}}>{el.type}</div>;
    }
};

// ==================== PROPERTY EDITORS ====================
const PositionEditor = ({ el, onChange }) => (
    <div className="grid grid-cols-4 gap-1.5">
        {[['x','X'],['y','Y'],['width','W'],['height','H']].map(([k,l])=>(
            <div key={k}><Label className="text-[10px] text-muted-foreground">{l}</Label>
            <Input type="number" value={el[k]||0} onChange={e=>onChange({...el,[k]:parseInt(e.target.value)||0})} className="h-7 text-xs rounded-lg text-center" /></div>
        ))}
    </div>
);

const TypographyEditor = ({ styles, onChange }) => (
    <div className="space-y-1.5">
        <div className="flex gap-1.5">
            <div className="flex-1"><Label className="text-[10px]">Size</Label><Input type="number" value={styles.fontSize||10} onChange={e=>onChange({...styles,fontSize:parseInt(e.target.value)||10})} className="h-7 text-xs rounded-lg" /></div>
            <div className="flex-1"><Label className="text-[10px]">Font</Label>
                <Select value={styles.fontFamily||'Arial'} onValueChange={v=>onChange({...styles,fontFamily:v})}>
                    <SelectTrigger className="h-7 text-xs rounded-lg"><SelectValue/></SelectTrigger>
                    <SelectContent>{FONTS.map(f=><SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
            </div>
        </div>
        <div className="flex gap-1">
            {[['bold','Bold',Bold,'fontWeight','bold','normal'],['italic','Italic',Italic,'fontStyle','italic','normal'],['underline','Underline',Underline,'textDecoration','underline','none']].map(([k,t,Icon,prop,on,off])=>(
                <Button key={k} variant={styles[prop]===on?'default':'outline'} size="sm" className="h-7 w-7 p-0" onClick={()=>onChange({...styles,[prop]:styles[prop]===on?off:on})} title={t}><Icon className="w-3 h-3"/></Button>
            ))}
            <div className="w-px bg-border mx-0.5"/>
            {[['left',AlignLeft],['center',AlignCenter],['right',AlignRight]].map(([a,Icon])=>(
                <Button key={a} variant={styles.textAlign===a?'default':'outline'} size="sm" className="h-7 w-7 p-0" onClick={()=>onChange({...styles,textAlign:a})}><Icon className="w-3 h-3"/></Button>
            ))}
        </div>
        <div className="flex gap-1.5">
            <div className="flex items-center gap-1 flex-1"><Label className="text-[10px] w-10">Color</Label><input type="color" value={styles.color||'#000000'} onChange={e=>onChange({...styles,color:e.target.value})} className="w-6 h-6 rounded border cursor-pointer"/><Input value={styles.color||''} onChange={e=>onChange({...styles,color:e.target.value})} className="h-6 text-[10px] rounded flex-1"/></div>
            <div className="flex items-center gap-1 flex-1"><Label className="text-[10px] w-10">BG</Label><input type="color" value={styles.backgroundColor||'#ffffff'} onChange={e=>onChange({...styles,backgroundColor:e.target.value})} className="w-6 h-6 rounded border cursor-pointer"/><Input value={styles.backgroundColor||''} onChange={e=>onChange({...styles,backgroundColor:e.target.value})} className="h-6 text-[10px] rounded flex-1"/></div>
        </div>
        <div className="flex gap-1.5">
            <div className="flex-1"><Label className="text-[10px]">Border</Label><Input value={styles.border||''} onChange={e=>onChange({...styles,border:e.target.value})} className="h-6 text-[10px] rounded-lg" placeholder="1px solid #000"/></div>
            <div className="w-16"><Label className="text-[10px]">Pad</Label><Input type="number" value={styles.padding||0} onChange={e=>onChange({...styles,padding:parseInt(e.target.value)||0})} className="h-6 text-[10px] rounded-lg text-center"/></div>
        </div>
    </div>
);

const DataFieldPicker = ({ field, onChange }) => (
    <div className="space-y-1">
        <Label className="text-[10px] font-semibold">Data Field</Label>
        <Select value={field||''} onValueChange={onChange}>
            <SelectTrigger className="h-7 text-xs rounded-lg"><SelectValue placeholder="Select field"/></SelectTrigger>
            <SelectContent>{DATA_FIELDS.map(cat=>(
                <div key={cat.cat}><div className="px-2 py-1 text-[10px] font-bold text-muted-foreground">{cat.cat}</div>
                {cat.fields.map(f=><SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}</div>
            ))}</SelectContent>
        </Select>
    </div>
);

const GradesTablePropEditor = ({ config, onChange }) => {
    const addSubj = () => onChange({...config, subjects:[...config.subjects,{name:'',is_core:false}]});
    const rmSubj = (i) => onChange({...config, subjects:config.subjects.filter((_,idx)=>idx!==i)});
    const updSubj = (i,f,v) => { const s=[...config.subjects]; s[i]={...s[i],[f]:v}; onChange({...config,subjects:s}); };
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between"><Label className="text-[10px] font-semibold">Subjects</Label><Button variant="ghost" size="sm" onClick={addSubj} className="h-5 text-[10px] px-1"><Plus className="w-3 h-3"/></Button></div>
            <div className="max-h-32 overflow-y-auto space-y-0.5">
                {config.subjects.map((s,i)=>(
                    <div key={i} className="flex items-center gap-1">
                        <Input value={s.name} onChange={e=>updSubj(i,'name',e.target.value)} className="h-6 text-[10px] rounded flex-1"/>
                        <Switch checked={s.is_core} onCheckedChange={v=>updSubj(i,'is_core',v)} /><span className="text-[8px]">Core</span>
                        <button onClick={()=>rmSubj(i)} className="text-destructive"><Trash2 className="w-3 h-3"/></button>
                    </div>
                ))}
            </div>
            <div className="flex items-center justify-between p-1.5 rounded bg-muted/30"><Label className="text-[10px]">Weighted</Label><Switch checked={config.use_weighted} onCheckedChange={v=>onChange({...config,use_weighted:v})}/></div>
            {config.use_weighted && <div className="space-y-0.5">{Object.entries(config.weights||{}).map(([k,v])=>(
                <div key={k} className="flex items-center gap-1"><Label className="text-[8px] w-16 capitalize">{k.replace(/([A-Z])/g,' $1')}</Label><Input type="number" value={v} onChange={e=>onChange({...config,weights:{...config.weights,[k]:parseFloat(e.target.value)||0}})} className="w-12 h-5 text-[10px] rounded text-center"/><span className="text-[8px]">%</span></div>
            ))}</div>}
            <div className="flex gap-1.5"><div className="flex items-center gap-1 flex-1"><Label className="text-[10px]">Header</Label><input type="color" value={config.headerBg||'#1e40af'} onChange={e=>onChange({...config,headerBg:e.target.value})} className="w-5 h-5 rounded border cursor-pointer"/></div>
            <div className="flex items-center gap-1 flex-1"><Label className="text-[10px]">Text</Label><input type="color" value={config.headerText||'#ffffff'} onChange={e=>onChange({...config,headerText:e.target.value})} className="w-5 h-5 rounded border cursor-pointer"/></div></div>
        </div>
    );
};

const SocialSkillsPropEditor = ({ config, onChange }) => {
    const addCat = () => onChange({...config, categories:[...config.categories,{category_name:'New',skills:['']}]});
    const rmCat = (i) => onChange({...config, categories:config.categories.filter((_,idx)=>idx!==i)});
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between"><Label className="text-[10px] font-semibold">Categories</Label><Button variant="ghost" size="sm" onClick={addCat} className="h-5 text-[10px] px-1"><Plus className="w-3 h-3"/></Button></div>
            {config.categories.map((cat,ci)=>(
                <div key={ci} className="p-1.5 rounded border space-y-0.5">
                    <div className="flex items-center gap-1"><Input value={cat.category_name} onChange={e=>{const c=[...config.categories];c[ci]={...c[ci],category_name:e.target.value};onChange({...config,categories:c});}} className="h-6 text-[10px] rounded flex-1 font-medium"/><button onClick={()=>rmCat(ci)} className="text-destructive"><Trash2 className="w-3 h-3"/></button></div>
                    {cat.skills.map((sk,si)=>(
                        <div key={si} className="flex items-center gap-0.5 pl-2"><Input value={sk} onChange={e=>{const c=[...config.categories];const ss=[...c[ci].skills];ss[si]=e.target.value;c[ci]={...c[ci],skills:ss};onChange({...config,categories:c});}} className="h-5 text-[8px] rounded flex-1"/>
                        <button onClick={()=>{const c=[...config.categories];c[ci]={...c[ci],skills:c[ci].skills.filter((_,i)=>i!==si)};onChange({...config,categories:c});}} className="text-destructive"><Trash2 className="w-2.5 h-2.5"/></button></div>
                    ))}
                    <Button variant="ghost" size="sm" onClick={()=>{const c=[...config.categories];c[ci]={...c[ci],skills:[...c[ci].skills,'']};onChange({...config,categories:c});}} className="h-4 text-[8px] px-1 ml-2"><Plus className="w-2.5 h-2.5"/>Skill</Button>
                </div>
            ))}
        </div>
    );
};

// ==================== MAIN DESIGNER ====================
export default function ReportTemplateDesigner() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const schoolCode = searchParams.get('school');
    const { isSuperuser } = useAuth();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [elements, setElements] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [paperSize, setPaperSize] = useState('legal');
    const [backgroundUrl, setBackgroundUrl] = useState('');
    const [uploading, setUploading] = useState(false);
    const [zoom, setZoom] = useState(0.65);
    const [dragging, setDragging] = useState(null);
    const [resizing, setResizing] = useState(null);
    const [rawTemplate, setRawTemplate] = useState(null);
    const canvasRef = useRef(null);

    const paper = PAPER[paperSize] || PAPER.legal;
    const selected = useMemo(() => elements.find(e => e.id === selectedId), [elements, selectedId]);

    // ---- Load template ----
    const fetchTemplate = useCallback(async () => {
        if (!schoolCode) return;
        try {
            const res = await axios.get(`${API}/report-templates/${schoolCode}`);
            const tpl = res.data;
            setRawTemplate(tpl);
            setPaperSize(tpl.paper_size || 'legal');
            setBackgroundUrl(tpl.background_url || '');
            if (tpl.canvas_elements?.length) {
                setElements(tpl.canvas_elements);
            } else {
                setElements(buildDefaultElements(tpl.school_name));
            }
        } catch (error) {
            toast.error('Failed to load template');
        } finally {
            setLoading(false);
        }
    }, [schoolCode]);

    useEffect(() => { fetchTemplate(); }, [fetchTemplate]);

    // ---- Save template ----
    const handleSave = async () => {
        setSaving(true);
        try {
            // Derive flat fields from canvas elements for backward compat
            const gradesEl = elements.find(e => e.type === 'grades-table');
            const skillsEl = elements.find(e => e.type === 'social-skills');
            const flat = {
                subjects: gradesEl?.config?.subjects || rawTemplate?.subjects || [],
                grade_scale: gradesEl?.config?.grade_scale || rawTemplate?.grade_scale || [],
                use_weighted_grading: gradesEl?.config?.use_weighted || false,
                assessment_weights: gradesEl?.config?.weights || rawTemplate?.assessment_weights || {},
                social_skills_categories: skillsEl?.config?.categories || rawTemplate?.social_skills_categories || [],
                skill_ratings: skillsEl?.config?.ratings || rawTemplate?.skill_ratings || [],
                achievement_standards: rawTemplate?.achievement_standards || [],
                sections: rawTemplate?.sections || {},
            };
            const payload = {
                school_code: schoolCode,
                school_name: rawTemplate?.school_name || schoolCode,
                ...flat,
                paper_size: paperSize,
                design_mode: 'canvas',
                canvas_elements: elements,
                background_url: backgroundUrl,
                blocks: rawTemplate?.blocks || null,
                theme: rawTemplate?.theme || null,
            };
            await axios.put(`${API}/report-templates/${schoolCode}`, payload);
            toast.success('Template saved successfully');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    // ---- Background upload ----
    const handleBgUpload = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/jpeg,image/png,image/webp';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            setUploading(true);
            try {
                const formData = new FormData();
                formData.append('file', file);
                const res = await axios.post(`${API}/upload/template-background`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                setBackgroundUrl(res.data.background_url);
                toast.success('Background uploaded');
            } catch (err) {
                toast.error(err.response?.data?.detail || 'Upload failed');
            } finally {
                setUploading(false);
            }
        };
        input.click();
    };

    // ---- Element CRUD ----
    const updateElement = useCallback((id, updates) => {
        setElements(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    }, []);

    const addElement = (type) => {
        const id = `el-${Date.now()}`;
        const defaults = {
            text:   { config:{content:'New Text'}, styles:{fontSize:12,fontFamily:'Arial'}, width:200, height:24 },
            'data-field': { config:{field:'student.first_name',showLabel:true}, styles:{fontSize:10}, width:180, height:20 },
            image:  { config:{src:'',alt:''}, styles:{}, width:80, height:80 },
            line:   { config:{}, styles:{backgroundColor:'#000000'}, width:400, height:2 },
            rectangle: { config:{}, styles:{backgroundColor:'#eeeeee',border:'1px solid #ccc'}, width:200, height:100 },
            signature: { config:{type:'teacher',label:"Teacher's Signature"}, styles:{}, width:200, height:60 },
            'grades-table': { config:{subjects:[{name:'Subject 1',is_core:true}],use_weighted:false,weights:{homework:5,groupWork:5,project:10,quiz:10,midTerm:30,endOfTerm:40},grade_scale:[{min:50,max:100,grade:'P'},{min:0,max:49,grade:'F'}],headerBg:'#1e40af',headerText:'#fff'}, styles:{fontSize:9}, width:756, height:300 },
            'social-skills': { config:{categories:[{category_name:'Skills',skills:['Skill 1']}],ratings:['Good','Needs Work'],headerBg:'#1e40af',headerText:'#fff'}, styles:{fontSize:9}, width:756, height:150 },
        };
        const d = defaults[type] || { config:{}, styles:{}, width:100, height:30 };
        setElements(prev => [...prev, { id, type, x: 50, y: 50, ...d }]);
        setSelectedId(id);
    };

    const deleteElement = (id) => {
        setElements(prev => prev.filter(e => e.id !== id));
        if (selectedId === id) setSelectedId(null);
    };

    const duplicateElement = (id) => {
        const el = elements.find(e => e.id === id);
        if (!el) return;
        const newId = `el-${Date.now()}`;
        setElements(prev => [...prev, { ...JSON.parse(JSON.stringify(el)), id: newId, x: el.x + 20, y: el.y + 20 }]);
        setSelectedId(newId);
    };

    // ---- Drag logic ----
    const handleCanvasPointerDown = (e) => {
        if (e.target === canvasRef.current || e.target.dataset.canvas) {
            setSelectedId(null);
        }
    };

    const handleElementPointerDown = (e, id) => {
        e.stopPropagation();
        e.preventDefault();
        const el = elements.find(e => e.id === id);
        if (!el) return;
        setSelectedId(id);
        setDragging({ id, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y });
    };

    const handleResizePointerDown = (e, id, corner) => {
        e.stopPropagation();
        e.preventDefault();
        const el = elements.find(e => e.id === id);
        if (!el) return;
        setResizing({ id, corner, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y, origW: el.width, origH: el.height });
    };

    useEffect(() => {
        const handleMove = (e) => {
            if (dragging) {
                const dx = (e.clientX - dragging.startX) / zoom;
                const dy = (e.clientY - dragging.startY) / zoom;
                updateElement(dragging.id, { x: Math.max(0, Math.round(dragging.origX + dx)), y: Math.max(0, Math.round(dragging.origY + dy)) });
            }
            if (resizing) {
                const dx = (e.clientX - resizing.startX) / zoom;
                const dy = (e.clientY - resizing.startY) / zoom;
                const c = resizing.corner;
                let newX = resizing.origX, newY = resizing.origY, newW = resizing.origW, newH = resizing.origH;
                if (c.includes('r')) newW = Math.max(20, Math.round(resizing.origW + dx));
                if (c.includes('b')) newH = Math.max(10, Math.round(resizing.origH + dy));
                if (c.includes('l')) { newX = Math.max(0, Math.round(resizing.origX + dx)); newW = Math.max(20, Math.round(resizing.origW - dx)); }
                if (c.includes('t')) { newY = Math.max(0, Math.round(resizing.origY + dy)); newH = Math.max(10, Math.round(resizing.origH - dy)); }
                updateElement(resizing.id, { x: newX, y: newY, width: newW, height: newH });
            }
        };
        const handleUp = () => { setDragging(null); setResizing(null); };
        if (dragging || resizing) {
            window.addEventListener('pointermove', handleMove);
            window.addEventListener('pointerup', handleUp);
            return () => { window.removeEventListener('pointermove', handleMove); window.removeEventListener('pointerup', handleUp); };
        }
    }, [dragging, resizing, zoom, updateElement]);

    // ---- Keyboard shortcuts ----
    useEffect(() => {
        const handleKey = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === 'Delete' || e.key === 'Backspace') { if (selectedId) deleteElement(selectedId); }
            if (e.key === 'd' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (selectedId) duplicateElement(selectedId); }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [selectedId]);

    if (!isSuperuser) return <div className="flex items-center justify-center min-h-[60vh]"><p className="text-muted-foreground">Superuser access required.</p></div>;
    if (!schoolCode) return <div className="flex items-center justify-center min-h-[60vh]"><p className="text-muted-foreground">No school specified.</p></div>;
    if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

    const resizeHandles = ['tl','tr','bl','br'];

    return (
        <div className="h-[calc(100vh-80px)] flex flex-col" data-testid="report-template-designer">
            {/* Top Bar */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b bg-background flex-shrink-0 gap-2">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/schools')} className="h-8 w-8 p-0 rounded-full" data-testid="back-to-schools-btn"><ArrowLeft className="w-4 h-4" /></Button>
                    <div><h1 className="text-sm font-bold leading-tight">Template Designer</h1><p className="text-[10px] text-muted-foreground">{rawTemplate?.school_name || schoolCode}</p></div>
                </div>
                <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" onClick={handleBgUpload} disabled={uploading} className="h-7 text-xs rounded-lg border-primary text-primary hover:bg-primary/10" data-testid="upload-template-btn">
                        {uploading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}Upload Template
                    </Button>
                    {backgroundUrl && <Button variant="ghost" size="sm" onClick={()=>setBackgroundUrl('')} className="h-7 text-xs rounded-lg text-destructive">Remove</Button>}
                    <Select value={paperSize} onValueChange={setPaperSize}>
                        <SelectTrigger className="h-7 w-28 text-xs rounded-lg" data-testid="paper-size-select"><SelectValue/></SelectTrigger>
                        <SelectContent>{Object.entries(PAPER).map(([k,v])=><SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <div className="flex items-center gap-0.5 border rounded-lg px-1">
                        <Button variant="ghost" size="sm" onClick={()=>setZoom(z=>Math.max(0.3,z-0.1))} className="h-6 w-6 p-0"><ZoomOut className="w-3 h-3"/></Button>
                        <span className="text-[10px] w-8 text-center">{Math.round(zoom*100)}%</span>
                        <Button variant="ghost" size="sm" onClick={()=>setZoom(z=>Math.min(1.5,z+0.1))} className="h-6 w-6 p-0"><ZoomIn className="w-3 h-3"/></Button>
                    </div>
                    <Button onClick={handleSave} disabled={saving} className="rounded-full h-7 px-4 text-xs" data-testid="save-template-btn">
                        {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}Save
                    </Button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Toolbar */}
                <div className="w-16 border-r flex flex-col items-center py-2 gap-1 bg-muted/10 flex-shrink-0">
                    <p className="text-[8px] font-bold text-muted-foreground mb-1">ADD</p>
                    {[['text','Text',Type],['data-field','Field',Move],['grades-table','Grades',Table],['social-skills','Skills',Heart],['image','Image',Image],['line','Line',Minus],['rectangle','Rect',Square],['signature','Sign',PenTool]].map(([t,l,Icon])=>(
                        <Button key={t} variant="ghost" size="sm" onClick={()=>addElement(t)} className="h-10 w-12 flex-col gap-0 p-0.5 rounded-lg" title={`Add ${l}`} data-testid={`add-${t}-btn`}>
                            <Icon className="w-4 h-4"/><span className="text-[7px]">{l}</span>
                        </Button>
                    ))}
                    <div className="w-8 h-px bg-border my-1"/>
                    <p className="text-[8px] font-bold text-muted-foreground">DATA</p>
                    {DATA_FIELDS.slice(0,2).flatMap(c=>c.fields.slice(0,3)).map(f=>(
                        <Button key={f.key} variant="ghost" size="sm" onClick={()=>{addElement('data-field');setTimeout(()=>{setElements(prev=>{const last=prev[prev.length-1];if(last?.type==='data-field'){return prev.map((e,i)=>i===prev.length-1?{...e,config:{...e.config,field:f.key}}:e);}return prev;});},0);}} className="h-6 w-12 p-0 text-[7px] rounded" title={f.label}>
                            {f.label.slice(0,8)}
                        </Button>
                    ))}
                </div>

                {/* Canvas Area */}
                <div className="flex-1 overflow-auto bg-gray-200 flex justify-center py-6 px-4" onPointerDown={handleCanvasPointerDown}>
                    <div ref={canvasRef} data-canvas="true" data-testid="template-canvas" style={{
                        width: paper.w, height: paper.h,
                        transform: `scale(${zoom})`, transformOrigin: 'top center',
                        backgroundColor: '#ffffff', position: 'relative',
                        boxShadow: '0 4px 30px rgba(0,0,0,0.15)', flexShrink: 0,
                        backgroundImage: backgroundUrl ? `url(${backgroundUrl.startsWith('http') ? backgroundUrl : `${process.env.REACT_APP_BACKEND_URL}${backgroundUrl}`})` : 'none',
                        backgroundSize: 'cover', backgroundPosition: 'center',
                    }}>
                        {/* Grid overlay */}
                        <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)',backgroundSize:'20px 20px',pointerEvents:'none',zIndex:0}} />

                        {/* Upload Template Overlay - shown when no background and no elements */}
                        {!backgroundUrl && elements.length === 0 && (
                            <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}} data-testid="upload-template-overlay">
                                <div style={{textAlign:'center',padding:40,backgroundColor:'rgba(255,255,255,0.95)',borderRadius:16,border:'2px dashed #3b82f6',maxWidth:420}}>
                                    <Upload style={{width:48,height:48,color:'#3b82f6',margin:'0 auto 16px'}} />
                                    <h3 style={{fontSize:18,fontWeight:'bold',marginBottom:8,color:'#1e293b'}}>Design Your Report Card</h3>
                                    <p style={{fontSize:13,color:'#64748b',marginBottom:20,lineHeight:1.5}}>Upload your existing report card template as a background image, then drag data fields on top. Or start from scratch.</p>
                                    <div style={{display:'flex',gap:12,justifyContent:'center'}}>
                                        <button onClick={handleBgUpload} disabled={uploading} data-testid="overlay-upload-btn" style={{padding:'10px 24px',backgroundColor:'#3b82f6',color:'#fff',borderRadius:999,border:'none',fontSize:14,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
                                            <Upload style={{width:16,height:16}} />Upload Template Image
                                        </button>
                                        <button onClick={()=>setElements(buildDefaultElements(rawTemplate?.school_name||schoolCode))} data-testid="start-scratch-btn" style={{padding:'10px 24px',backgroundColor:'#fff',color:'#374151',borderRadius:999,border:'1px solid #d1d5db',fontSize:14,fontWeight:600,cursor:'pointer'}}>
                                            Start from Scratch
                                        </button>
                                    </div>
                                    <p style={{fontSize:11,color:'#94a3b8',marginTop:16}}>Supported: JPG, PNG, WebP (max 10MB)</p>
                                </div>
                            </div>
                        )}

                        {/* Upload prompt - subtle, when background exists but no data fields */}
                        {backgroundUrl && elements.length === 0 && (
                            <div style={{position:'absolute',top:16,left:'50%',transform:'translateX(-50%)',zIndex:50,backgroundColor:'rgba(59,130,246,0.9)',color:'#fff',padding:'8px 20px',borderRadius:999,fontSize:12,fontWeight:500}}>
                                Template uploaded. Now add data fields from the left toolbar.
                            </div>
                        )}

                        {/* Elements */}
                        {elements.map(el => (
                            <div key={el.id} data-testid={`canvas-el-${el.id}`}
                                style={{ position:'absolute', left:el.x, top:el.y, width:el.width, height:el.height, cursor: dragging?.id===el.id ? 'grabbing' : 'grab', zIndex: selectedId===el.id ? 100 : 1, outline: selectedId===el.id ? '2px solid #3b82f6' : 'none', outlineOffset: 1 }}
                                onPointerDown={(e) => handleElementPointerDown(e, el.id)}
                            >
                                <ElementPreview el={el} />
                                {/* Resize handles */}
                                {selectedId === el.id && resizeHandles.map(corner => (
                                    <div key={corner} onPointerDown={e => handleResizePointerDown(e, el.id, corner)}
                                        style={{ position:'absolute', width:8, height:8, backgroundColor:'#3b82f6', border:'1px solid #fff', borderRadius:2, cursor: corner==='tl'||corner==='br' ? 'nwse-resize' : 'nesw-resize', zIndex:200,
                                            ...(corner.includes('t') ? {top:-4} : {bottom:-4}),
                                            ...(corner.includes('l') ? {left:-4} : {right:-4}),
                                        }} />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Properties Panel */}
                <div className="w-64 border-l flex flex-col bg-background flex-shrink-0 overflow-y-auto">
                    {selected ? (
                        <div className="p-3 space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-bold capitalize">{selected.type.replace(/-/g,' ')}</Label>
                                <div className="flex gap-0.5">
                                    <Button variant="ghost" size="sm" onClick={()=>duplicateElement(selected.id)} className="h-6 w-6 p-0" title="Duplicate (Ctrl+D)"><Copy className="w-3 h-3"/></Button>
                                    <Button variant="ghost" size="sm" onClick={()=>deleteElement(selected.id)} className="h-6 w-6 p-0 text-destructive" title="Delete"><Trash2 className="w-3 h-3"/></Button>
                                </div>
                            </div>

                            {/* Position */}
                            <div><Label className="text-[10px] font-semibold text-muted-foreground">POSITION & SIZE</Label>
                            <PositionEditor el={selected} onChange={(upd) => updateElement(selected.id, upd)} /></div>

                            {/* Type-specific config */}
                            {selected.type === 'text' && (
                                <div><Label className="text-[10px] font-semibold text-muted-foreground">CONTENT</Label>
                                <textarea value={selected.config?.content||''} onChange={e=>updateElement(selected.id,{config:{...selected.config,content:e.target.value}})} className="w-full h-16 text-xs rounded-lg border p-2 resize-none mt-1" /></div>
                            )}
                            {selected.type === 'data-field' && (
                                <div className="space-y-1.5">
                                    <DataFieldPicker field={selected.config?.field} onChange={v=>updateElement(selected.id,{config:{...selected.config,field:v}})} />
                                    <div className="flex items-center gap-2"><Switch checked={selected.config?.showLabel!==false} onCheckedChange={v=>updateElement(selected.id,{config:{...selected.config,showLabel:v}})}/><Label className="text-[10px]">Show label</Label></div>
                                </div>
                            )}
                            {selected.type === 'image' && (
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-semibold text-muted-foreground">IMAGE</Label>
                                    <Input value={selected.config?.src||''} onChange={e=>updateElement(selected.id,{config:{...selected.config,src:e.target.value}})} className="h-7 text-xs rounded-lg" placeholder="Image URL or /api/uploads/..." />
                                    <Button variant="outline" size="sm" className="h-6 text-[10px] w-full rounded-lg" onClick={()=>{
                                        const inp = document.createElement('input'); inp.type='file'; inp.accept='image/*';
                                        inp.onchange = async(ev)=>{ const f=ev.target.files[0]; if(!f) return;
                                            const fd = new FormData(); fd.append('file',f);
                                            try { const r = await axios.post(`${API}/upload/template-background`,fd,{headers:{'Content-Type':'multipart/form-data'}}); updateElement(selected.id,{config:{...selected.config,src:r.data.background_url}}); toast.success('Image uploaded'); } catch(err) { toast.error('Upload failed'); }
                                        }; inp.click();
                                    }}>
                                        <Upload className="w-3 h-3 mr-1"/>Upload Image
                                    </Button>
                                </div>
                            )}
                            {selected.type === 'signature' && (
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-semibold text-muted-foreground">SIGNATURE</Label>
                                    <Select value={selected.config?.type||'teacher'} onValueChange={v=>updateElement(selected.id,{config:{...selected.config,type:v}})}>
                                        <SelectTrigger className="h-7 text-xs rounded-lg"><SelectValue/></SelectTrigger>
                                        <SelectContent><SelectItem value="teacher">Teacher</SelectItem><SelectItem value="principal">Principal</SelectItem><SelectItem value="custom">Custom</SelectItem></SelectContent>
                                    </Select>
                                    <Input value={selected.config?.label||''} onChange={e=>updateElement(selected.id,{config:{...selected.config,label:e.target.value}})} className="h-7 text-xs rounded-lg" placeholder="Label text" />
                                </div>
                            )}
                            {selected.type === 'grades-table' && <GradesTablePropEditor config={selected.config} onChange={cfg=>updateElement(selected.id,{config:cfg})} />}
                            {selected.type === 'social-skills' && <SocialSkillsPropEditor config={selected.config} onChange={cfg=>updateElement(selected.id,{config:cfg})} />}

                            {/* Typography & Styling */}
                            <div><Label className="text-[10px] font-semibold text-muted-foreground">STYLING</Label>
                            <TypographyEditor styles={selected.styles||{}} onChange={s=>updateElement(selected.id,{styles:s})} /></div>
                        </div>
                    ) : (
                        <div className="p-4 text-center text-muted-foreground space-y-3 mt-8">
                            <Move className="w-10 h-10 mx-auto opacity-20" />
                            <p className="text-xs">Click an element on the canvas to edit its properties</p>
                            <p className="text-[10px] text-muted-foreground">Drag to move, corners to resize</p>
                            <div className="text-[9px] text-left space-y-1 p-2 rounded bg-muted/30 mt-4">
                                <p className="font-bold">Keyboard shortcuts:</p>
                                <p>Delete — Remove element</p>
                                <p>Ctrl+D — Duplicate element</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
