import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { 
    Upload,
    Download,
    FileText,
    Users,
    GraduationCap,
    Loader2,
    Check,
    X,
    Pen,
    Image
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ImportExportPage() {
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);
    const [uploadingSignature, setUploadingSignature] = useState(false);
    const [signatures, setSignatures] = useState({});
    const [importResults, setImportResults] = useState(null);
    
    const studentFileRef = useRef(null);
    const teacherFileRef = useRef(null);
    const teacherSigRef = useRef(null);
    const principalSigRef = useRef(null);
    
    const { isAdmin, isSuperuser } = useAuth();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [classesRes, sigsRes] = await Promise.all([
                axios.get(`${API}/classes`),
                axios.get(`${API}/signatures`).catch(() => ({ data: {} }))
            ]);
            setClasses(classesRes.data);
            setSignatures(sigsRes.data);
        } catch (error) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadStudentTemplate = async () => {
        try {
            const response = await axios.get(`${API}/export/students-template`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'students_template.csv');
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('Template downloaded');
        } catch (error) {
            toast.error('Failed to download template');
        }
    };

    const handleDownloadTeacherTemplate = async () => {
        try {
            const response = await axios.get(`${API}/export/teachers-template`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'teachers_template.csv');
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('Template downloaded');
        } catch (error) {
            toast.error('Failed to download template');
        }
    };

    const handleImportStudents = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        if (!selectedClass) {
            toast.error('Please select a class first');
            return;
        }

        setImporting(true);
        setImportResults(null);
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await axios.post(
                `${API}/import/students?class_id=${selectedClass}`,
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            );
            
            setImportResults({
                type: 'students',
                ...response.data
            });
            
            if (response.data.imported > 0) {
                toast.success(`Imported ${response.data.imported} students`);
            }
            if (response.data.errors?.length > 0) {
                toast.warning(`${response.data.errors.length} errors occurred`);
            }
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Import failed');
        } finally {
            setImporting(false);
            e.target.value = '';
        }
    };

    const handleImportTeachers = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        setImportResults(null);
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await axios.post(
                `${API}/import/teachers`,
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            );
            
            setImportResults({
                type: 'teachers',
                ...response.data
            });
            
            if (response.data.imported > 0) {
                toast.success(`Imported ${response.data.imported} teachers`);
            }
            if (response.data.errors?.length > 0) {
                toast.warning(`${response.data.errors.length} errors occurred`);
            }
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Import failed');
        } finally {
            setImporting(false);
            e.target.value = '';
        }
    };

    const handleUploadSignature = async (type, file) => {
        if (!file) return;
        
        setUploadingSignature(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await axios.post(
                `${API}/signatures/upload?signature_type=${type}`,
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            );
            
            setSignatures(prev => ({
                ...prev,
                [`${type}_signature`]: response.data.signature_url
            }));
            
            toast.success(`${type === 'teacher' ? 'Teacher' : 'Principal'} signature uploaded`);
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Upload failed');
        } finally {
            setUploadingSignature(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!isAdmin && !isSuperuser) {
        return (
            <div className="text-center py-16">
                <X className="w-12 h-12 mx-auto mb-4 text-destructive" />
                <h2 className="text-xl font-bold mb-2">Access Denied</h2>
                <p className="text-muted-foreground">Only administrators can access this page.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6" data-testid="import-export-page">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Import & Export</h1>
                <p className="text-muted-foreground">Bulk import students/teachers and manage signatures</p>
            </div>

            <Tabs defaultValue="import" className="w-full">
                <TabsList className="grid w-full grid-cols-2 rounded-2xl h-12 max-w-md">
                    <TabsTrigger value="import" className="rounded-xl">
                        <Upload className="w-4 h-4 mr-2" />
                        Import Data
                    </TabsTrigger>
                    <TabsTrigger value="signatures" className="rounded-xl">
                        <Pen className="w-4 h-4 mr-2" />
                        Signatures
                    </TabsTrigger>
                </TabsList>

                {/* Import Tab */}
                <TabsContent value="import" className="mt-6 space-y-6">
                    {/* Import Students */}
                    <Card className="rounded-3xl border-border/50 shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="w-5 h-5" />
                                Import Students
                            </CardTitle>
                            <CardDescription>
                                Upload a CSV file to bulk import students into a class
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Select Class *</Label>
                                    <Select value={selectedClass} onValueChange={setSelectedClass}>
                                        <SelectTrigger className="rounded-xl">
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
                                <div className="flex items-end gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={handleDownloadStudentTemplate}
                                        className="rounded-full"
                                    >
                                        <Download className="w-4 h-4 mr-2" />
                                        Download Template
                                    </Button>
                                </div>
                            </div>
                            
                            <div className="border-2 border-dashed border-muted rounded-2xl p-8 text-center">
                                <input
                                    type="file"
                                    ref={studentFileRef}
                                    onChange={handleImportStudents}
                                    accept=".csv"
                                    className="hidden"
                                />
                                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground mb-4">
                                    Drag and drop a CSV file or click to browse
                                </p>
                                <Button
                                    onClick={() => studentFileRef.current?.click()}
                                    disabled={!selectedClass || importing}
                                    className="rounded-full"
                                >
                                    {importing ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <Upload className="w-4 h-4 mr-2" />
                                    )}
                                    Choose CSV File
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Import Teachers */}
                    <Card className="rounded-3xl border-border/50 shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <GraduationCap className="w-5 h-5" />
                                Import Teachers
                            </CardTitle>
                            <CardDescription>
                                Upload a CSV file to bulk import teachers
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={handleDownloadTeacherTemplate}
                                    className="rounded-full"
                                >
                                    <Download className="w-4 h-4 mr-2" />
                                    Download Template
                                </Button>
                            </div>
                            
                            <div className="border-2 border-dashed border-muted rounded-2xl p-8 text-center">
                                <input
                                    type="file"
                                    ref={teacherFileRef}
                                    onChange={handleImportTeachers}
                                    accept=".csv"
                                    className="hidden"
                                />
                                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground mb-4">
                                    Drag and drop a CSV file or click to browse
                                </p>
                                <Button
                                    onClick={() => teacherFileRef.current?.click()}
                                    disabled={importing}
                                    className="rounded-full"
                                >
                                    {importing ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <Upload className="w-4 h-4 mr-2" />
                                    )}
                                    Choose CSV File
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Import Results */}
                    {importResults && (
                        <Card className="rounded-3xl border-border/50 shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="w-5 h-5" />
                                    Import Results
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="flex items-center gap-2 text-green-600">
                                        <Check className="w-5 h-5" />
                                        <span className="font-bold">{importResults.imported}</span>
                                        <span>imported successfully</span>
                                    </div>
                                    {importResults.errors?.length > 0 && (
                                        <div className="flex items-center gap-2 text-destructive">
                                            <X className="w-5 h-5" />
                                            <span className="font-bold">{importResults.errors.length}</span>
                                            <span>errors</span>
                                        </div>
                                    )}
                                </div>
                                
                                {importResults.errors?.length > 0 && (
                                    <div className="bg-destructive/10 rounded-xl p-4 max-h-48 overflow-y-auto">
                                        <h4 className="font-bold text-sm mb-2 text-destructive">Errors:</h4>
                                        <ul className="text-sm space-y-1">
                                            {importResults.errors.map((err, idx) => (
                                                <li key={idx} className="text-destructive">{err}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* Signatures Tab */}
                <TabsContent value="signatures" className="mt-6">
                    <Card className="rounded-3xl border-border/50 shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Pen className="w-5 h-5" />
                                Signature Management
                            </CardTitle>
                            <CardDescription>
                                Upload signatures for report cards
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Teacher Signature */}
                                <div className="space-y-4">
                                    <Label className="text-lg font-bold">Class Teacher Signature</Label>
                                    <div className="border-2 border-dashed border-muted rounded-2xl p-6 text-center">
                                        {signatures.teacher_signature ? (
                                            <div className="space-y-4">
                                                <img 
                                                    src={`${process.env.REACT_APP_BACKEND_URL}${signatures.teacher_signature}`}
                                                    alt="Teacher Signature"
                                                    className="max-h-24 mx-auto"
                                                />
                                                <p className="text-sm text-green-600">Signature uploaded</p>
                                            </div>
                                        ) : (
                                            <Image className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                                        )}
                                        <input
                                            type="file"
                                            ref={teacherSigRef}
                                            onChange={(e) => handleUploadSignature('teacher', e.target.files?.[0])}
                                            accept=".png,.jpg,.jpeg"
                                            className="hidden"
                                        />
                                        <Button
                                            variant="outline"
                                            onClick={() => teacherSigRef.current?.click()}
                                            disabled={uploadingSignature}
                                            className="rounded-full mt-2"
                                        >
                                            {uploadingSignature ? (
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            ) : (
                                                <Upload className="w-4 h-4 mr-2" />
                                            )}
                                            {signatures.teacher_signature ? 'Replace' : 'Upload'} Signature
                                        </Button>
                                    </div>
                                </div>

                                {/* Principal Signature */}
                                <div className="space-y-4">
                                    <Label className="text-lg font-bold">Principal Signature</Label>
                                    <div className="border-2 border-dashed border-muted rounded-2xl p-6 text-center">
                                        {signatures.principal_signature ? (
                                            <div className="space-y-4">
                                                <img 
                                                    src={`${process.env.REACT_APP_BACKEND_URL}${signatures.principal_signature}`}
                                                    alt="Principal Signature"
                                                    className="max-h-24 mx-auto"
                                                />
                                                <p className="text-sm text-green-600">Signature uploaded</p>
                                            </div>
                                        ) : (
                                            <Image className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                                        )}
                                        <input
                                            type="file"
                                            ref={principalSigRef}
                                            onChange={(e) => handleUploadSignature('principal', e.target.files?.[0])}
                                            accept=".png,.jpg,.jpeg"
                                            className="hidden"
                                        />
                                        <Button
                                            variant="outline"
                                            onClick={() => principalSigRef.current?.click()}
                                            disabled={uploadingSignature}
                                            className="rounded-full mt-2"
                                        >
                                            {uploadingSignature ? (
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            ) : (
                                                <Upload className="w-4 h-4 mr-2" />
                                            )}
                                            {signatures.principal_signature ? 'Replace' : 'Upload'} Signature
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 p-4 rounded-xl bg-muted/50 text-sm text-muted-foreground">
                                <p><strong>Note:</strong> Uploaded signatures will appear on all generated report cards for your school. 
                                Use a transparent PNG image for best results.</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
