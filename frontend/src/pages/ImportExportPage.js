import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import {
    Upload,
    Download,
    FileText,
    Loader2,
    Users,
    Pen,
    Image,
    CheckCircle,
    AlertCircle
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ImportExportPage() {
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [studentFile, setStudentFile] = useState(null);
    const [teacherFile, setTeacherFile] = useState(null);
    const [importingStudents, setImportingStudents] = useState(false);
    const [importingTeachers, setImportingTeachers] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [signatures, setSignatures] = useState({});
    const [uploadingSignature, setUploadingSignature] = useState(null);
    const { isAdmin, isSuperuser } = useAuth();

    useEffect(() => {
        fetchClasses();
        fetchSignatures();
    }, []);

    const fetchClasses = async () => {
        try {
            const res = await axios.get(`${API}/classes`);
            setClasses(res.data);
        } catch (error) {
            toast.error('Failed to load classes');
        }
    };

    const fetchSignatures = async () => {
        try {
            const res = await axios.get(`${API}/signatures`);
            setSignatures(res.data);
        } catch (error) {
            console.error('Failed to load signatures');
        }
    };

    const handleStudentImport = async () => {
        if (!studentFile) {
            toast.error('Please select a CSV file');
            return;
        }
        if (!selectedClass) {
            toast.error('Please select a class');
            return;
        }

        setImportingStudents(true);
        setImportResult(null);
        try {
            const formData = new FormData();
            formData.append('file', studentFile);

            const res = await axios.post(
                `${API}/import/students?class_id=${selectedClass}`,
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            );

            setImportResult(res.data);
            toast.success(res.data.message);
            setStudentFile(null);
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Import failed');
        } finally {
            setImportingStudents(false);
        }
    };

    const handleTeacherImport = async () => {
        if (!teacherFile) {
            toast.error('Please select a CSV file');
            return;
        }

        setImportingTeachers(true);
        setImportResult(null);
        try {
            const formData = new FormData();
            formData.append('file', teacherFile);

            const res = await axios.post(
                `${API}/import/teachers`,
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            );

            setImportResult(res.data);
            toast.success(res.data.message);
            setTeacherFile(null);
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Import failed');
        } finally {
            setImportingTeachers(false);
        }
    };

    const handleSignatureUpload = async (type) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/jpeg,image/png,image/gif,image/webp';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            setUploadingSignature(type);
            try {
                const formData = new FormData();
                formData.append('file', file);

                await axios.post(
                    `${API}/signatures/upload?signature_type=${type}`,
                    formData,
                    { headers: { 'Content-Type': 'multipart/form-data' } }
                );

                toast.success(`${type} signature uploaded successfully`);
                fetchSignatures();
            } catch (error) {
                toast.error(error.response?.data?.detail || 'Upload failed');
            } finally {
                setUploadingSignature(null);
            }
        };
        input.click();
    };

    const downloadTemplate = async (type) => {
        try {
            const res = await axios.get(`${API}/export/${type}-template`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${type}_template.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            toast.error('Failed to download template');
        }
    };

    return (
        <div className="space-y-6" data-testid="import-export-page">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Import & Export</h1>
                <p className="text-muted-foreground">Bulk import data and manage signatures</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Student CSV Import */}
                <Card className="rounded-3xl border-border/50 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            Import Students
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Select Class *</Label>
                            <Select value={selectedClass} onValueChange={setSelectedClass}>
                                <SelectTrigger className="rounded-xl" data-testid="import-class-select">
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

                        <div className="space-y-2">
                            <Label>CSV File *</Label>
                            <Input
                                type="file"
                                accept=".csv"
                                onChange={(e) => setStudentFile(e.target.files[0])}
                                className="rounded-xl"
                                data-testid="student-csv-input"
                            />
                        </div>

                        <div className="flex gap-2">
                            <Button
                                onClick={handleStudentImport}
                                disabled={importingStudents || !studentFile || !selectedClass}
                                className="rounded-full flex-1"
                                data-testid="import-students-btn"
                            >
                                {importingStudents ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Upload className="w-4 h-4 mr-2" />
                                )}
                                Import Students
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => downloadTemplate('students')}
                                className="rounded-full"
                                data-testid="download-student-template-btn"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Template
                            </Button>
                        </div>

                        <p className="text-xs text-muted-foreground">
                            CSV columns: student_id, first_name, middle_name, last_name, date_of_birth, gender, address, house, emergency_contact
                        </p>
                    </CardContent>
                </Card>

                {/* Teacher CSV Import */}
                <Card className="rounded-3xl border-border/50 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Pen className="w-5 h-5" />
                            Import Teachers
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>CSV File *</Label>
                            <Input
                                type="file"
                                accept=".csv"
                                onChange={(e) => setTeacherFile(e.target.files[0])}
                                className="rounded-xl"
                                data-testid="teacher-csv-input"
                            />
                        </div>

                        <div className="flex gap-2">
                            <Button
                                onClick={handleTeacherImport}
                                disabled={importingTeachers || !teacherFile}
                                className="rounded-full flex-1"
                                data-testid="import-teachers-btn"
                            >
                                {importingTeachers ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Upload className="w-4 h-4 mr-2" />
                                )}
                                Import Teachers
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => downloadTemplate('teachers')}
                                className="rounded-full"
                                data-testid="download-teacher-template-btn"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Template
                            </Button>
                        </div>

                        <p className="text-xs text-muted-foreground">
                            CSV columns: username, name, password (default: Teacher@123)
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Import Result */}
            {importResult && (
                <Card className="rounded-3xl border-border/50 shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-2 mb-3">
                            {importResult.errors?.length > 0 ? (
                                <AlertCircle className="w-5 h-5 text-yellow-500" />
                            ) : (
                                <CheckCircle className="w-5 h-5 text-green-500" />
                            )}
                            <h3 className="font-semibold">Import Result</h3>
                        </div>
                        <p className="text-sm">{importResult.message}</p>
                        {importResult.errors?.length > 0 && (
                            <div className="mt-3 p-3 rounded-xl bg-destructive/10 text-sm">
                                <p className="font-medium text-destructive mb-1">Errors:</p>
                                <ul className="list-disc pl-4 space-y-0.5 text-destructive/80">
                                    {importResult.errors.map((err, i) => (
                                        <li key={i}>{err}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Signatures Management */}
            <Card className="rounded-3xl border-border/50 shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Image className="w-5 h-5" />
                        Signature Management
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Teacher Signature */}
                        <div className="space-y-3">
                            <Label className="font-medium">Class Teacher Signature</Label>
                            {signatures.teacher_signature ? (
                                <div className="border border-border rounded-xl p-4 flex flex-col items-center gap-3">
                                    <img
                                        src={`${process.env.REACT_APP_BACKEND_URL}${signatures.teacher_signature}`}
                                        alt="Teacher Signature"
                                        className="max-h-24 object-contain"
                                        data-testid="teacher-signature-img"
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleSignatureUpload('teacher')}
                                        disabled={uploadingSignature === 'teacher'}
                                        className="rounded-full"
                                        data-testid="replace-teacher-signature-btn"
                                    >
                                        {uploadingSignature === 'teacher' ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : (
                                            <Upload className="w-4 h-4 mr-2" />
                                        )}
                                        Replace
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    variant="outline"
                                    onClick={() => handleSignatureUpload('teacher')}
                                    disabled={uploadingSignature === 'teacher'}
                                    className="w-full rounded-xl h-24 border-dashed"
                                    data-testid="upload-teacher-signature-btn"
                                >
                                    {uploadingSignature === 'teacher' ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <div className="text-center">
                                            <Upload className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
                                            <span className="text-sm text-muted-foreground">Upload Signature</span>
                                        </div>
                                    )}
                                </Button>
                            )}
                        </div>

                        {/* Principal Signature */}
                        <div className="space-y-3">
                            <Label className="font-medium">Principal Signature</Label>
                            {signatures.principal_signature ? (
                                <div className="border border-border rounded-xl p-4 flex flex-col items-center gap-3">
                                    <img
                                        src={`${process.env.REACT_APP_BACKEND_URL}${signatures.principal_signature}`}
                                        alt="Principal Signature"
                                        className="max-h-24 object-contain"
                                        data-testid="principal-signature-img"
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleSignatureUpload('principal')}
                                        disabled={uploadingSignature === 'principal'}
                                        className="rounded-full"
                                        data-testid="replace-principal-signature-btn"
                                    >
                                        {uploadingSignature === 'principal' ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : (
                                            <Upload className="w-4 h-4 mr-2" />
                                        )}
                                        Replace
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    variant="outline"
                                    onClick={() => handleSignatureUpload('principal')}
                                    disabled={uploadingSignature === 'principal'}
                                    className="w-full rounded-xl h-24 border-dashed"
                                    data-testid="upload-principal-signature-btn"
                                >
                                    {uploadingSignature === 'principal' ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <div className="text-center">
                                            <Upload className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
                                            <span className="text-sm text-muted-foreground">Upload Signature</span>
                                        </div>
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>

                    <p className="text-xs text-muted-foreground mt-4">
                        Supported formats: JPG, PNG, GIF, WebP. Max size: 5MB. Signatures will appear on printed report cards.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
