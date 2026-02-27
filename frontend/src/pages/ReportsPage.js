import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { 
    FileText,
    Loader2,
    Printer,
    Users,
    BookOpen,
    Download
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TERMS = ['Term 1', 'Term 2', 'Term 3'];
const CURRENT_YEAR = new Date().getFullYear();
const ACADEMIC_YEARS = [
    `${CURRENT_YEAR-1}-${CURRENT_YEAR}`, 
    `${CURRENT_YEAR}-${CURRENT_YEAR+1}`,
    `${CURRENT_YEAR+1}-${CURRENT_YEAR+2}`
];

// Dynamic helper: get grade from template's grade scale
const getGradeFromScale = (score, gradeScale) => {
    if (score === null || score === undefined || !gradeScale?.length) return { grade: '-', description: '-' };
    const rounded = Math.round(score);
    for (const g of gradeScale) {
        if (rounded >= g.min && rounded <= g.max) {
            return g;
        }
    }
    return gradeScale[gradeScale.length - 1] || { grade: '-', description: '-' };
};

// Dynamic helper: get achievement standard
const getAchievementFromScale = (score, standards) => {
    if (score === null || score === undefined || !standards?.length) return null;
    for (const std of standards) {
        if (score >= std.min && score <= std.max) {
            return std;
        }
    }
    return standards[standards.length - 1];
};

// Dynamic helper: calculate weighted grade from template weights
const calcWeightedFromTemplate = (assessments, weights) => {
    if (!weights) return 0;
    const {homework = 0, groupWork = 0, project = 0, quiz = 0, midTerm = 0, endOfTerm = 0} = assessments;
    return (
        homework * ((weights.homework || 0) / 100) +
        groupWork * ((weights.groupWork || 0) / 100) +
        project * ((weights.project || 0) / 100) +
        quiz * ((weights.quiz || 0) / 100) +
        midTerm * ((weights.midTerm || 0) / 100) +
        endOfTerm * ((weights.endOfTerm || 0) / 100)
    );
};

// ==================== CANVAS REPORT CARD RENDERER ====================
const resolveField = (field, data, classInfo, term, academicYear) => {
    const { student, attendance_summary, position } = data;
    const map = {
        'student.first_name': student?.first_name, 'student.last_name': student?.last_name,
        'student.middle_name': student?.middle_name, 'student.dob': student?.date_of_birth,
        'student.age': student?.age ? `${student.age} yrs` : '', 'student.gender': student?.gender,
        'student.house': student?.house, 'student.student_id': student?.student_id,
        'class.name': classInfo?.name, 'class.grade_level': classInfo?.grade_level,
        'term': term, 'academic_year': academicYear,
        'position': position, 'total_students': data.total_students,
        'attendance.total_days': attendance_summary?.total_days,
        'attendance.present': attendance_summary?.present,
        'attendance.absent': attendance_summary?.absent,
        'teacher_comment': student?.teacher_comment || '',
    };
    return map[field] ?? `{{${field}}}`;
};

const CanvasReportCard = ({ data, classInfo, term, academicYear, totalStudents, signatures, template }) => {
    const tpl = template || {};
    const els = tpl.canvas_elements || [];
    const paperSize = tpl.paper_size || 'legal';
    const paperH = paperSize === 'letter' ? '11in' : paperSize === 'a4' ? '297mm' : '14in';
    const bgUrl = tpl.background_url;
    const subjectGrades = data.grades?.subjects || [];

    const renderElement = (el) => {
        const s = el.styles || {};
        const cfg = el.config || {};
        const base = { fontSize: s.fontSize||10, fontFamily: s.fontFamily||'Arial,sans-serif', fontWeight: s.fontWeight||'normal', fontStyle: s.fontStyle||'normal', textDecoration: s.textDecoration||'none', color: s.color||'#000', textAlign: s.textAlign||'left', backgroundColor: s.backgroundColor||'transparent', border: s.border||'none', padding: s.padding||0, overflow:'hidden', width:'100%', height:'100%', boxSizing:'border-box' };

        switch (el.type) {
            case 'text': {
                let content = cfg.content || '';
                content = content.replace('{{date}}', new Date().toLocaleDateString());
                return <div style={base}>{content}</div>;
            }
            case 'data-field': {
                const val = resolveField(cfg.field, data, classInfo, term, academicYear);
                return <div style={base}>{val}</div>;
            }
            case 'image':
                return cfg.src ? <img src={cfg.src.startsWith('http')?cfg.src:`${process.env.REACT_APP_BACKEND_URL}${cfg.src}`} alt="" style={{width:'100%',height:'100%',objectFit:'contain'}} /> : null;
            case 'line':
                return <div style={{width:'100%',height:'100%',backgroundColor:s.backgroundColor||'#000'}} />;
            case 'rectangle':
                return <div style={{width:'100%',height:'100%',backgroundColor:s.backgroundColor||'#eee',border:s.border||'none'}} />;
            case 'signature': {
                const sigUrl = signatures?.[`${cfg.type}_signature`];
                return (
                    <div style={{...base,textAlign:'center',display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
                        {sigUrl ? <img src={`${process.env.REACT_APP_BACKEND_URL}${sigUrl}`} alt="" style={{height:'60%',objectFit:'contain',marginBottom:3}} /> : <div style={{borderBottom:'1px solid #000',marginBottom:3,height:'60%'}} />}
                        <div style={{fontSize:s.fontSize||9,fontWeight:'bold'}}>{cfg.label}</div>
                        <div style={{fontSize:7,color:'#666'}}>Date: ___________</div>
                    </div>
                );
            }
            case 'grades-table': {
                const subjects = cfg.subjects || [];
                const gradeScale = cfg.grade_scale || [];
                const hBg = cfg.headerBg || '#1e40af';
                const hTxt = cfg.headerText || '#fff';
                return (
                    <div style={{...base,overflow:'visible'}}>
                        <div style={{backgroundColor:hBg,color:hTxt,padding:'2px 4px',fontWeight:'bold'}}>ACADEMIC PERFORMANCE</div>
                        <table style={{width:'100%',borderCollapse:'collapse',fontSize:s.fontSize||9}}>
                            <thead><tr style={{backgroundColor:'#e5e7eb'}}>
                                <th style={{border:'1px solid #999',padding:2,textAlign:'left'}}>Subject</th>
                                {cfg.use_weighted && <><th style={{border:'1px solid #999',padding:1}}>HW</th><th style={{border:'1px solid #999',padding:1}}>GW</th><th style={{border:'1px solid #999',padding:1}}>Proj</th><th style={{border:'1px solid #999',padding:1}}>Quiz</th><th style={{border:'1px solid #999',padding:1}}>Mid</th><th style={{border:'1px solid #999',padding:1}}>End</th></>}
                                <th style={{border:'1px solid #999',padding:1}}>Score</th>
                                <th style={{border:'1px solid #999',padding:1}}>Grade</th>
                            </tr></thead>
                            <tbody>{subjects.map((sub,i)=>{
                                const sg = subjectGrades.find(g=>g.subject===sub.name)||{};
                                const score = sg.score||0;
                                const rounded = Math.round(score);
                                let grade = '-';
                                for(const g of gradeScale){ if(rounded>=g.min && rounded<=g.max){ grade=g.grade; break; } }
                                return (
                                    <tr key={i} style={{backgroundColor:sub.is_core?'#eff6ff':i%2===0?'#fff':'#f9fafb'}}>
                                        <td style={{border:'1px solid #ccc',padding:2}}>{sub.name}{sub.is_core?'*':''}</td>
                                        {cfg.use_weighted && <><td style={{border:'1px solid #ccc',padding:1,textAlign:'center'}}>{sg.homework??'-'}</td><td style={{border:'1px solid #ccc',padding:1,textAlign:'center'}}>{sg.groupWork??'-'}</td><td style={{border:'1px solid #ccc',padding:1,textAlign:'center'}}>{sg.project??'-'}</td><td style={{border:'1px solid #ccc',padding:1,textAlign:'center'}}>{sg.quiz??'-'}</td><td style={{border:'1px solid #ccc',padding:1,textAlign:'center'}}>{sg.midTerm??'-'}</td><td style={{border:'1px solid #ccc',padding:1,textAlign:'center'}}>{sg.endOfTerm??'-'}</td></>}
                                        <td style={{border:'1px solid #ccc',padding:1,textAlign:'center',fontWeight:'bold'}}>{score>0?score.toFixed(1):'-'}</td>
                                        <td style={{border:'1px solid #ccc',padding:1,textAlign:'center',fontWeight:'bold'}}>{grade}</td>
                                    </tr>
                                );
                            })}</tbody>
                        </table>
                    </div>
                );
            }
            case 'social-skills': {
                const cats = cfg.categories || [];
                const ratings = cfg.ratings || [];
                const hBg = cfg.headerBg || '#1e40af';
                const hTxt = cfg.headerText || '#fff';
                return (
                    <div style={{...base,overflow:'visible'}}>
                        <div style={{backgroundColor:hBg,color:hTxt,padding:'2px 4px',fontWeight:'bold'}}>SOCIAL SKILLS AND ATTITUDES</div>
                        <div style={{display:'grid',gridTemplateColumns:`repeat(${Math.min(cats.length,2)},1fr)`,gap:6,border:'1px solid #ccc',padding:4}}>
                            {cats.map(cat=>(
                                <div key={cat.category_name}>
                                    <div style={{fontWeight:'bold',marginBottom:2}}>{cat.category_name}</div>
                                    {cat.skills.map(sk=>(
                                        <div key={sk} style={{display:'flex',justifyContent:'space-between',marginBottom:1}}>
                                            <span>{sk}</span>
                                            <span>{ratings.map(r=>{
                                                const checked = data.social_skills?.[sk]===r;
                                                return <span key={r} style={{display:'inline-block',width:12,height:12,border:'1px solid #999',marginLeft:2,textAlign:'center',fontSize:8,lineHeight:'12px'}}>{checked?'✓':''}</span>;
                                            })}</span>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            }
            default: return null;
        }
    };

    return (
        <div className="mhps-report-card bg-white mx-auto mb-8 print:mb-0 print:page-break-after-always" style={{
            width: '8.5in', minHeight: paperH, position: 'relative', fontFamily: 'Arial, sans-serif', fontSize: '10pt',
            backgroundImage: bgUrl ? `url(${bgUrl.startsWith('http') ? bgUrl : `${process.env.REACT_APP_BACKEND_URL}${bgUrl}`})` : 'none',
            backgroundSize: 'cover', backgroundPosition: 'center',
        }}>
            {els.map(el => (
                <div key={el.id} style={{ position:'absolute', left: el.x * (8.5/816) + 'in', top: el.y * (14/1344) + 'in', width: el.width * (8.5/816) + 'in', height: el.height === 'auto' ? 'auto' : el.height * (14/1344) + 'in' }}>
                    {renderElement(el)}
                </div>
            ))}
        </div>
    );
};

// ==================== DYNAMIC REPORT CARD (dispatch) ====================
const ReportCardRenderer = (props) => {
    const { template } = props;
    if (template?.design_mode === 'canvas' && template?.canvas_elements?.length) {
        return <CanvasReportCard {...props} />;
    }
    return <DynamicReportCard {...props} />;
};

// ==================== BLOCK-BASED REPORT CARD TEMPLATE ====================
const DynamicReportCard = ({ data, classInfo, term, academicYear, totalStudents, signatures, template }) => {
    const { student, grades, attendance_summary, position, social_skills } = data;
    const subjectGrades = grades?.subjects || [];
    const tpl = template || {};
    const gradeScale = tpl.grade_scale || [];
    const subjects = tpl.subjects || [];
    const subjectNames = subjects.map(s => s.name);
    const coreSubjectNames = subjects.filter(s => s.is_core).map(s => s.name);
    const useWeighted = tpl.use_weighted_grading;
    const weights = tpl.assessment_weights || {};
    const sections = tpl.sections || {};
    const achievementStds = tpl.achievement_standards || [];
    const socialCategories = tpl.social_skills_categories || [];
    const skillRatings = tpl.skill_ratings || ['Excellent', 'Good', 'Satisfactory', 'Needs Improvement'];
    const paperHeight = tpl.paper_size === 'letter' ? '11in' : tpl.paper_size === 'a4' ? '297mm' : '14in';
    const theme = tpl.theme || {};
    const headerBg = theme.headerBg || '#1e40af';
    const headerText = theme.headerText || '#ffffff';
    const fontFamily = theme.fontFamily || 'Arial, sans-serif';

    // Determine block order if blocks exist
    const blockOrder = tpl.blocks?.filter(b => b.visible).map(b => b.type) || null;

    const calculateCoreAverage = () => {
        const coreGrades = subjectGrades.filter(g => coreSubjectNames.includes(g.subject));
        if (coreGrades.length === 0) return null;
        let totalAvg = 0;
        coreGrades.forEach(g => {
            if (useWeighted) {
                totalAvg += (((g.midTerm || 0) + (g.endOfTerm || 0)) / 2);
            } else {
                totalAvg += (g.score || 0);
            }
        });
        return (totalAvg / coreGrades.length).toFixed(1);
    };

    const coreAverage = calculateCoreAverage();
    const coreAverageGrade = coreAverage ? getGradeFromScale(parseFloat(coreAverage), gradeScale) : { grade: '-' };

    return (
        <div
            className="mhps-report-card bg-white mx-auto mb-8 print:mb-0 print:page-break-after-always"
            style={{
                width: '8.5in',
                minHeight: paperHeight,
                padding: '0.5in',
                fontFamily: fontFamily,
                fontSize: '10pt',
                lineHeight: '1.3'
            }}
        >
            {/* Header */}
            <div className="text-center pb-3 mb-4" style={{ borderBottom: `2px solid ${headerBg}` }}>
                <div className="flex justify-center items-center gap-4 mb-2">
                    {tpl.logo_url ? (
                        <img src={tpl.logo_url.startsWith('http') ? tpl.logo_url : `${process.env.REACT_APP_BACKEND_URL}${tpl.logo_url}`} alt="Logo" className="w-16 h-16 object-contain" />
                    ) : (
                        <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-sm" style={{ backgroundColor: headerBg, color: headerText }}>
                            {tpl.school_code || '?'}
                        </div>
                    )}
                    <div>
                        <h1 className="text-xl font-bold uppercase tracking-wide">{tpl.school_name || 'SCHOOL'}</h1>
                        {tpl.school_motto && <p className="text-xs text-gray-600">{tpl.school_motto}</p>}
                    </div>
                </div>
                {tpl.header_text && <h2 className="text-lg font-bold mt-2">{tpl.header_text}</h2>}
                {tpl.sub_header_text && <p className="text-sm">{tpl.sub_header_text}</p>}
            </div>

            {/* Student Info */}
            <div className="grid grid-cols-4 gap-2 text-xs mb-3 border border-gray-300 p-2">
                <div><strong>Surname:</strong> {student.last_name}</div>
                <div><strong>First Name:</strong> {student.first_name} {student.middle_name || ''}</div>
                <div><strong>Date of Birth:</strong> {student.date_of_birth}</div>
                <div><strong>Age:</strong> {student.age} years</div>
                <div><strong>Grade:</strong> {classInfo?.grade_level || '-'}</div>
                <div><strong>Gender:</strong> {student.gender}</div>
                <div><strong>House:</strong> {student.house || '-'}</div>
                <div><strong>Student ID:</strong> {student.student_id || '-'}</div>
            </div>

            {/* Term & Attendance Info */}
            <div className="grid grid-cols-4 gap-2 text-xs mb-3 border border-gray-300 p-2 bg-gray-50">
                <div><strong>Term:</strong> {term}</div>
                <div><strong>Academic Year:</strong> {academicYear}</div>
                <div><strong>No. in Class:</strong> {totalStudents}</div>
                <div><strong>Position:</strong> {position} of {totalStudents}</div>
                {sections.attendance_summary !== false && (
                    <>
                        <div><strong>Days in Term:</strong> {attendance_summary?.total_days || '-'}</div>
                        <div><strong>Days Absent:</strong> {attendance_summary?.absent || 0}</div>
                        <div><strong>Days Present:</strong> {attendance_summary?.present || '-'}</div>
                    </>
                )}
                <div><strong>Class:</strong> {classInfo?.name || '-'}</div>
            </div>

            {/* Academic Performance */}
            <div className="mb-4">
                <h3 className="text-sm font-bold p-1 mb-0" style={{ backgroundColor: headerBg, color: headerText }}>ACADEMIC PERFORMANCE</h3>
                <table className="w-full border-collapse text-xs">
                    <thead>
                        <tr className="bg-gray-200">
                            <th className="border border-gray-400 p-1 text-left w-28">Subject</th>
                            {useWeighted ? (
                                <>
                                    <th className="border border-gray-400 p-1 text-center w-12">HW</th>
                                    <th className="border border-gray-400 p-1 text-center w-12">GW</th>
                                    <th className="border border-gray-400 p-1 text-center w-12">Proj</th>
                                    <th className="border border-gray-400 p-1 text-center w-12">Quiz</th>
                                    <th className="border border-gray-400 p-1 text-center w-14">Mid-Term</th>
                                    <th className="border border-gray-400 p-1 text-center w-14">End of Term</th>
                                    <th className="border border-gray-400 p-1 text-center w-16">Weighted</th>
                                </>
                            ) : (
                                <th className="border border-gray-400 p-1 text-center w-16">Score</th>
                            )}
                            <th className="border border-gray-400 p-1 text-center w-12">Grade</th>
                            {sections.achievement_standards !== false && achievementStds.length > 0 && (
                                <th className="border border-gray-400 p-1 text-center w-24">Achievement</th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {subjectNames.map((subject, idx) => {
                            const subjectData = subjectGrades.find(g => g.subject === subject) || {};
                            let displayScore;
                            if (useWeighted) {
                                displayScore = subjectData.score || calcWeightedFromTemplate({
                                    homework: subjectData.homework || 0, groupWork: subjectData.groupWork || 0,
                                    project: subjectData.project || 0, quiz: subjectData.quiz || 0,
                                    midTerm: subjectData.midTerm || 0, endOfTerm: subjectData.endOfTerm || 0
                                }, weights);
                            } else {
                                displayScore = subjectData.score || 0;
                            }
                            const gradeInfo = getGradeFromScale(displayScore, gradeScale);
                            const achievement = getAchievementFromScale(subjectData.endOfTerm, achievementStds);
                            const isCore = coreSubjectNames.includes(subject);

                            return (
                                <tr key={subject} className={isCore ? 'bg-blue-50' : (idx % 2 === 0 ? 'bg-white' : 'bg-gray-50')}>
                                    <td className="border border-gray-400 p-1 font-medium">
                                        {subject}{isCore && <span style={{ color: headerBg }}>*</span>}
                                    </td>
                                    {useWeighted ? (
                                        <>
                                            <td className="border border-gray-400 p-1 text-center">{subjectData.homework ?? '-'}</td>
                                            <td className="border border-gray-400 p-1 text-center">{subjectData.groupWork ?? '-'}</td>
                                            <td className="border border-gray-400 p-1 text-center">{subjectData.project ?? '-'}</td>
                                            <td className="border border-gray-400 p-1 text-center">{subjectData.quiz ?? '-'}</td>
                                            <td className="border border-gray-400 p-1 text-center font-medium">{subjectData.midTerm ?? '-'}</td>
                                            <td className="border border-gray-400 p-1 text-center font-medium">{subjectData.endOfTerm ?? '-'}</td>
                                            <td className="border border-gray-400 p-1 text-center font-bold">{displayScore > 0 ? displayScore.toFixed(1) : '-'}</td>
                                        </>
                                    ) : (
                                        <td className="border border-gray-400 p-1 text-center font-bold">{displayScore > 0 ? Math.round(displayScore) : '-'}</td>
                                    )}
                                    <td className="border border-gray-400 p-1 text-center font-bold">{gradeInfo.grade}</td>
                                    {sections.achievement_standards !== false && achievementStds.length > 0 && (
                                        <td className="border border-gray-400 p-1 text-center text-xs">{achievement?.band || '-'}</td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                    {coreSubjectNames.length > 0 && (
                        <tfoot>
                            <tr className="bg-gray-200 font-bold">
                                <td className="border border-gray-400 p-1" colSpan={useWeighted ? 7 : 1}>CORE SUBJECTS AVERAGE *</td>
                                <td className="border border-gray-400 p-1 text-center">{coreAverage || '-'}</td>
                                <td className="border border-gray-400 p-1 text-center">{coreAverageGrade.grade}</td>
                                {sections.achievement_standards !== false && achievementStds.length > 0 && <td className="border border-gray-400 p-1"></td>}
                            </tr>
                        </tfoot>
                    )}
                </table>
                {coreSubjectNames.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">* Core subjects used for ranking: {coreSubjectNames.join(', ')}</p>
                )}
            </div>

            {/* Weights & Grade Key */}
            <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
                {sections.weight_key !== false && useWeighted && (
                    <div className="border border-gray-300 p-2">
                        <h4 className="font-bold mb-1">ASSESSMENT WEIGHTINGS</h4>
                        <div className="grid grid-cols-3 gap-1">
                            {Object.entries(weights).map(([k, v]) => (
                                <span key={k}>{k.replace(/([A-Z])/g, ' $1').trim()}: {v}%</span>
                            ))}
                        </div>
                    </div>
                )}
                {sections.grade_key !== false && (
                    <div className="border border-gray-300 p-2">
                        <h4 className="font-bold mb-1">KEY TO ACADEMIC GRADES</h4>
                        <div className="grid grid-cols-4 gap-1">
                            {gradeScale.map(g => (
                                <span key={g.grade} className="text-xs">{g.grade}: {g.min}-{g.max}</span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Achievement Standards */}
            {sections.achievement_standards !== false && achievementStds.length > 0 && (
                <div className="mb-4 border border-gray-300 p-2 text-xs">
                    <h4 className="font-bold mb-1">ACHIEVEMENT STANDARDS (Based on End of Term Exam)</h4>
                    <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${achievementStds.length}, 1fr)` }}>
                        {achievementStds.map(std => (
                            <div key={std.band} className="text-center p-1 bg-gray-50 rounded">
                                <div className="font-bold">{std.band}</div>
                                <div className="text-gray-600">{std.min}% - {std.max}%</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Social Skills */}
            {sections.social_skills !== false && socialCategories.length > 0 && (
                <div className="mb-4">
                    <h3 className="text-sm font-bold p-1 mb-0" style={{ backgroundColor: headerBg, color: headerText }}>PROGRESS IN SOCIAL SKILLS AND ATTITUDES</h3>
                    <div className={`grid gap-4 text-xs border border-gray-300 p-2`} style={{ gridTemplateColumns: `repeat(${Math.min(socialCategories.length, 2)}, 1fr)` }}>
                        {socialCategories.map(cat => (
                            <div key={cat.category_name}>
                                <h4 className="font-bold mb-1 uppercase">{cat.category_name}</h4>
                                <table className="w-full">
                                    <tbody>
                                        {cat.skills.map(skill => (
                                            <tr key={skill}>
                                                <td className="py-0.5">{skill}</td>
                                                <td className="py-0.5 text-right">
                                                    {skillRatings.map(rating => (
                                                        <span key={rating} className="inline-block w-4 h-4 border border-gray-400 mx-0.5 text-center text-xs">
                                                            {social_skills?.[skill] === rating ? '✓' : ''}
                                                        </span>
                                                    ))}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                    <div className="mt-1 text-xs text-gray-500 flex gap-3">
                        {skillRatings.map((r, i) => (
                            <span key={r}>{r[0]} = {r}</span>
                        ))}
                    </div>
                </div>
            )}

            {/* Teacher Comments */}
            {sections.teacher_comments !== false && (
                <div className="mb-4">
                    <h3 className="text-sm font-bold p-1 mb-0" style={{ backgroundColor: headerBg, color: headerText }}>CLASS TEACHER'S COMMENTS</h3>
                    <div className="border border-gray-300 p-2 min-h-16 text-sm">
                        {student.teacher_comment || 'No comments recorded.'}
                    </div>
                </div>
            )}

            {/* Signatures */}
            {sections.signatures !== false && (
                <div className="grid grid-cols-2 gap-8 mt-6 pt-4">
                    <div className="text-center">
                        {signatures?.teacher_signature ? (
                            <img src={`${process.env.REACT_APP_BACKEND_URL}${signatures.teacher_signature}`} alt="Teacher Signature" className="h-10 mx-auto mb-1 object-contain" />
                        ) : (
                            <div className="border-b border-black h-8 mb-1"></div>
                        )}
                        <p className="text-sm font-medium">Class Teacher's Signature</p>
                        <p className="text-xs text-gray-500">Date: _______________</p>
                    </div>
                    <div className="text-center">
                        {signatures?.principal_signature ? (
                            <img src={`${process.env.REACT_APP_BACKEND_URL}${signatures.principal_signature}`} alt="Principal Signature" className="h-10 mx-auto mb-1 object-contain" />
                        ) : (
                            <div className="border-b border-black h-8 mb-1"></div>
                        )}
                        <p className="text-sm font-medium">Principal's Signature</p>
                        <p className="text-xs text-gray-500">Date: _______________</p>
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="mt-4 pt-2 border-t border-gray-300 text-center text-xs text-gray-500">
                <p>{tpl.school_name || 'School'} - {term} {academicYear}</p>
                <p>This report was generated on {new Date().toLocaleDateString()}</p>
            </div>
        </div>
    );
};

// ==================== CLASS LIST REPORT ====================
const ClassListReport = ({ students, classInfo }) => {
    return (
        <div className="report-page bg-white p-8 max-w-4xl mx-auto print:shadow-none">
            <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
                <h1 className="text-2xl font-bold">CLASS LIST</h1>
                <h2 className="text-xl">{classInfo?.name || 'Class'}</h2>
                <p className="text-sm text-gray-600">Grade {classInfo?.grade_level} | Academic Year {classInfo?.academic_year}</p>
                {classInfo?.teacher_name && (
                    <p className="text-sm mt-1">Class Teacher: {classInfo.teacher_name}</p>
                )}
            </div>
            
            <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="border border-gray-300 p-2 text-left w-10">#</th>
                        <th className="border border-gray-300 p-2 text-left">Student ID</th>
                        <th className="border border-gray-300 p-2 text-left">Name</th>
                        <th className="border border-gray-300 p-2 text-center">Gender</th>
                        <th className="border border-gray-300 p-2 text-center">Age</th>
                        <th className="border border-gray-300 p-2 text-left">House</th>
                        <th className="border border-gray-300 p-2 text-left">Parent Contact</th>
                    </tr>
                </thead>
                <tbody>
                    {students.map((student, index) => (
                        <tr key={student.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="border border-gray-300 p-2">{index + 1}</td>
                            <td className="border border-gray-300 p-2 font-mono text-xs">{student.student_id || '-'}</td>
                            <td className="border border-gray-300 p-2 font-medium">
                                {student.first_name} {student.middle_name || ''} {student.last_name}
                            </td>
                            <td className="border border-gray-300 p-2 text-center">{student.gender?.[0] || '-'}</td>
                            <td className="border border-gray-300 p-2 text-center">{student.age || '-'}</td>
                            <td className="border border-gray-300 p-2">{student.house || '-'}</td>
                            <td className="border border-gray-300 p-2">{student.emergency_contact || '-'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            
            <div className="mt-6 flex justify-between text-sm text-gray-600">
                <p>Total Students: {students.length}</p>
                <p>Male: {students.filter(s => s.gender === 'Male').length} | Female: {students.filter(s => s.gender === 'Female').length}</p>
            </div>
            
            <div className="mt-8 text-right text-xs text-gray-400">
                Generated on {new Date().toLocaleDateString()}
            </div>
        </div>
    );
};

// ==================== GRADEBOOK REPORT ====================
const GradebookReport = ({ students, grades, classInfo, term, academicYear, template }) => {
    const tpl = template || {};
    const subjects = (tpl.subjects || []).map(s => s.name);
    const coreSubjects = (tpl.subjects || []).filter(s => s.is_core).map(s => s.name);
    const gradeScale = tpl.grade_scale || [];

    const getStudentGrades = (studentId) => {
        const entry = grades.find(g => g.student_id === studentId);
        if (!entry || !entry.subjects) return {};
        const gradeMap = {};
        entry.subjects.forEach(s => { gradeMap[s.subject] = s; });
        return gradeMap;
    };

    const calculateAverage = (studentId) => {
        const studentGradesMap = getStudentGrades(studentId);
        const coreGrades = coreSubjects.map(subj => studentGradesMap[subj]).filter(Boolean);
        if (coreGrades.length === 0) return '-';
        let totalAvg = 0;
        coreGrades.forEach(g => {
            if (tpl.use_weighted_grading) {
                totalAvg += (((g.midTerm || 0) + (g.endOfTerm || 0)) / 2);
            } else {
                totalAvg += (g.score || 0);
            }
        });
        return (totalAvg / coreGrades.length).toFixed(1);
    };

    return (
        <div className="report-page bg-white p-4 max-w-6xl mx-auto print:shadow-none overflow-x-auto">
            <div className="text-center border-b-2 border-gray-800 pb-4 mb-4">
                <h1 className="text-2xl font-bold">GRADEBOOK REPORT</h1>
                <h2 className="text-xl">{classInfo?.name || 'Class'}</h2>
                <p className="text-sm text-gray-600">{term} | Academic Year {academicYear}</p>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300 text-xs">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="border border-gray-300 p-1 text-left w-8">#</th>
                            <th className="border border-gray-300 p-1 text-left min-w-[150px]">Student Name</th>
                            {subjects.map(subject => (
                                <th key={subject} className="border border-gray-300 p-1 text-center" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', height: '80px' }}>
                                    {subject}
                                </th>
                            ))}
                            {coreSubjects.length > 0 && (
                                <th className="border border-gray-300 p-1 text-center font-bold bg-blue-100">Core Avg</th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {students.map((student, index) => {
                            const studentGrades = getStudentGrades(student.id);
                            return (
                                <tr key={student.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="border border-gray-300 p-1">{index + 1}</td>
                                    <td className="border border-gray-300 p-1 font-medium">{student.first_name} {student.last_name}</td>
                                    {subjects.map(subject => {
                                        const subjData = studentGrades[subject];
                                        const score = subjData?.score || '-';
                                        return (
                                            <td key={subject} className="border border-gray-300 p-1 text-center">
                                                {typeof score === 'number' ? score.toFixed(0) : score}
                                            </td>
                                        );
                                    })}
                                    {coreSubjects.length > 0 && (
                                        <td className="border border-gray-300 p-1 text-center font-bold bg-blue-50">
                                            {calculateAverage(student.id)}
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                    <h4 className="font-bold mb-2">Grading Key:</h4>
                    <div className="grid grid-cols-4 gap-1 text-xs">
                        {gradeScale.map(g => (
                            <span key={g.grade}>{g.grade} ({g.min}-{g.max})</span>
                        ))}
                    </div>
                </div>
                <div className="text-right">
                    <p>Total Students: {students.length}</p>
                    <p className="text-xs text-gray-400 mt-2">Generated on {new Date().toLocaleDateString()}</p>
                </div>
            </div>
        </div>
    );
};

// ==================== MAIN REPORTS PAGE ====================
export default function ReportsPage() {
    const [classes, setClasses] = useState([]);
    const [students, setStudents] = useState([]);
    const [grades, setGrades] = useState([]);
    const [gradingScheme, setGradingScheme] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedTerm, setSelectedTerm] = useState(TERMS[0]);
    const [selectedYear, setSelectedYear] = useState(ACADEMIC_YEARS[0]);
    const [reportCards, setReportCards] = useState([]);
    const [totalStudentsInClass, setTotalStudentsInClass] = useState(0);
    const [reportSignatures, setReportSignatures] = useState({});
    const [reportTemplate, setReportTemplate] = useState(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [exportingPdf, setExportingPdf] = useState(false);
    const [activeTab, setActiveTab] = useState('class-list');
    const printRef = useRef();
    const { isAdmin, isTeacher, schoolCode } = useAuth();

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const requests = [
                axios.get(`${API}/classes`),
                axios.get(`${API}/grading-scheme`),
            ];
            if (schoolCode) {
                requests.push(axios.get(`${API}/report-templates/${schoolCode}`));
            }
            const results = await Promise.all(requests);
            setClasses(results[0].data);
            setGradingScheme(results[1].data.grading_scheme || []);
            if (results[2]) {
                setReportTemplate(results[2].data);
            }
        } catch (error) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const fetchClassData = async () => {
        if (!selectedClass) {
            toast.error('Please select a class');
            return;
        }
        
        setGenerating(true);
        try {
            const [studentsRes, gradesRes] = await Promise.all([
                axios.get(`${API}/students?class_id=${selectedClass}`),
                axios.get(`${API}/gradebook?class_id=${selectedClass}&term=${selectedTerm}&academic_year=${selectedYear}`)
            ]);
            
            const classStudentsList = studentsRes.data.filter(s => s.class_id === selectedClass);
            setStudents(classStudentsList);
            setGrades(gradesRes.data);
            
            if (classStudentsList.length === 0) {
                toast.info('No students found in this class');
            } else {
                toast.success(`Loaded ${classStudentsList.length} students`);
            }
        } catch (error) {
            toast.error('Failed to fetch class data');
        } finally {
            setGenerating(false);
        }
    };

    const generateTermReports = async () => {
        if (!selectedClass) {
            toast.error('Please select a class');
            return;
        }
        
        setGenerating(true);
        try {
            const response = await axios.get(
                `${API}/report-cards/class/${selectedClass}?term=${selectedTerm}&academic_year=${selectedYear}`
            );
            
            const data = response.data;
            const cards = data.report_cards || [];
            setReportCards(cards);
            setTotalStudentsInClass(data.total_students || cards.length);
            setReportSignatures(data.signatures || {});
            
            if (data.grading_scheme) {
                setGradingScheme(data.grading_scheme);
            }
            
            if (cards.length === 0) {
                toast.info('No students found in this class');
            } else {
                toast.success(`Generated ${cards.length} report cards`);
            }
        } catch (error) {
            console.error('Report generation error:', error);
            toast.error(error.response?.data?.detail || 'Failed to generate report cards');
        } finally {
            setGenerating(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleExportPdf = async () => {
        if (!printRef.current) return;
        setExportingPdf(true);
        try {
            const html2canvas = (await import('html2canvas')).default;
            const { jsPDF } = await import('jspdf');

            const element = printRef.current;
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                logging: false
            });

            // Legal paper: 8.5 x 14 inches
            const pdf = new jsPDF('p', 'in', 'legal');
            const imgWidth = 8.5;
            const pageHeight = 14;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft > 0) {
                position -= pageHeight;
                pdf.addPage();
                pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            const classLabel = selectedClassInfo?.name || 'Report';
            pdf.save(`${classLabel}_${selectedTerm}_${selectedYear}.pdf`);
            toast.success('PDF exported successfully');
        } catch (error) {
            console.error('PDF export error:', error);
            toast.error('Failed to export PDF');
        } finally {
            setExportingPdf(false);
        }
    };

    const selectedClassInfo = classes.find(c => c.id === selectedClass);
    const classStudents = students.filter(s => s.class_id === selectedClass);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6" data-testid="reports-page">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
                    <p className="text-muted-foreground">Generate various reports for your classes</p>
                </div>
            </div>

            {/* Report Type Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 rounded-2xl h-12">
                    <TabsTrigger value="class-list" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <Users className="w-4 h-4 mr-2" />
                        Class List
                    </TabsTrigger>
                    <TabsTrigger value="gradebook" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <BookOpen className="w-4 h-4 mr-2" />
                        Gradebook
                    </TabsTrigger>
                    <TabsTrigger value="term-reports" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <FileText className="w-4 h-4 mr-2" />
                        Term Reports
                    </TabsTrigger>
                </TabsList>

                {/* Selection Controls */}
                <Card className="mt-6 rounded-3xl border-border/50 shadow-sm">
                    <CardContent className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <Label>Select Class *</Label>
                                <Select value={selectedClass} onValueChange={setSelectedClass}>
                                    <SelectTrigger className="rounded-xl" data-testid="report-class-select">
                                        <SelectValue placeholder="Select a class" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {classes.map(cls => (
                                            <SelectItem key={cls.id} value={cls.id}>
                                                {cls.name} (Grade {cls.grade_level})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            {(activeTab === 'gradebook' || activeTab === 'term-reports') && (
                                <div className="space-y-2">
                                    <Label>Term</Label>
                                    <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                                        <SelectTrigger className="rounded-xl">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {TERMS.map(term => (
                                                <SelectItem key={term} value={term}>{term}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            
                            {(activeTab === 'gradebook' || activeTab === 'term-reports') && (
                                <div className="space-y-2">
                                    <Label>Academic Year</Label>
                                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                                        <SelectTrigger className="rounded-xl">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ACADEMIC_YEARS.map(year => (
                                                <SelectItem key={year} value={year}>{year}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            
                            <div className="flex items-end gap-2">
                                <Button
                                    onClick={activeTab === 'term-reports' ? generateTermReports : fetchClassData}
                                    disabled={!selectedClass || generating}
                                    className="rounded-full flex-1"
                                    data-testid="generate-report-btn"
                                >
                                    {generating ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <FileText className="w-4 h-4 mr-2" />
                                    )}
                                    Generate
                                </Button>
                                {((activeTab === 'class-list' && classStudents.length > 0) ||
                                  (activeTab === 'gradebook' && classStudents.length > 0) ||
                                  (activeTab === 'term-reports' && reportCards.length > 0)) && (
                                    <>
                                        <Button
                                            variant="outline"
                                            onClick={handleExportPdf}
                                            disabled={exportingPdf}
                                            className="rounded-full"
                                            data-testid="export-pdf-btn"
                                        >
                                            {exportingPdf ? (
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            ) : (
                                                <Download className="w-4 h-4 mr-2" />
                                            )}
                                            PDF
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={handlePrint}
                                            className="rounded-full"
                                            data-testid="print-report-btn"
                                        >
                                            <Printer className="w-4 h-4 mr-2" />
                                            Print
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Report Content */}
                <TabsContent value="class-list" className="mt-6">
                    {classStudents.length > 0 ? (
                        <div ref={printRef} className="print-content">
                            <ClassListReport 
                                students={classStudents} 
                                classInfo={selectedClassInfo}
                            />
                        </div>
                    ) : (
                        <Card className="rounded-3xl border-border/50 shadow-sm">
                            <CardContent className="py-16">
                                <div className="text-center">
                                    <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                                    <h3 className="text-lg font-semibold mb-2">No Data</h3>
                                    <p className="text-muted-foreground">
                                        Select a class and click Generate to view the class list
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="gradebook" className="mt-6">
                    {classStudents.length > 0 ? (
                        <div ref={printRef} className="print-content">
                            <GradebookReport 
                                students={classStudents} 
                                grades={grades}
                                classInfo={selectedClassInfo}
                                term={selectedTerm}
                                academicYear={selectedYear}
                                template={reportTemplate}
                            />
                        </div>
                    ) : (
                        <Card className="rounded-3xl border-border/50 shadow-sm">
                            <CardContent className="py-16">
                                <div className="text-center">
                                    <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                                    <h3 className="text-lg font-semibold mb-2">No Data</h3>
                                    <p className="text-muted-foreground">
                                        Select a class, term, and year then click Generate to view gradebook
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="term-reports" className="mt-6">
                    {reportCards.length > 0 ? (
                        <div ref={printRef} className="print-content space-y-8">
                            {reportCards.map((data) => (
                                <ReportCardRenderer
                                    key={data.student.id}
                                    data={{...data, total_students: totalStudentsInClass}}
                                    classInfo={selectedClassInfo}
                                    term={selectedTerm}
                                    academicYear={selectedYear}
                                    totalStudents={totalStudentsInClass}
                                    signatures={reportSignatures}
                                    template={reportTemplate}
                                />
                            ))}
                        </div>
                    ) : (
                        <Card className="rounded-3xl border-border/50 shadow-sm">
                            <CardContent className="py-16">
                                <div className="text-center">
                                    <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                                    <h3 className="text-lg font-semibold mb-2">No Report Cards</h3>
                                    <p className="text-muted-foreground">
                                        Select a class, term, and year then click Generate to create term reports
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>

            {/* Print Styles for Legal Paper */}
            <style>{`
                @media print {
                    @page {
                        size: legal portrait;
                        margin: 0.25in;
                    }
                    body * {
                        visibility: hidden;
                    }
                    .print-content, .print-content * {
                        visibility: visible;
                    }
                    .print-content {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                    .mhps-report-card {
                        page-break-after: always;
                        box-shadow: none !important;
                    }
                    .report-page {
                        page-break-after: always;
                    }
                }
            `}</style>
        </div>
    );
}
