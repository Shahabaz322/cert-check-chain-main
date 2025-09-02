import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  accept?: string;
  maxSize?: number;
  className?: string;
}

export const FileUpload = ({ 
  onFileSelect, 
  selectedFile, 
  accept = ".pdf",
  maxSize = 10 * 1024 * 1024, // 10MB
  className 
}: FileUploadProps) => {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setError(null);
    
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors.some((e: any) => e.code === 'file-too-large')) {
        setError(`File too large. Maximum size is ${maxSize / 1024 / 1024}MB`);
      } else if (rejection.errors.some((e: any) => e.code === 'file-invalid-type')) {
        setError('Invalid file type. Please upload a PDF file.');
      } else {
        setError('File upload failed. Please try again.');
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
  }, [onFileSelect, maxSize]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize,
    multiple: false
  });

  const removeFile = () => {
    onFileSelect(null as any);
    setError(null);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {!selectedFile ? (
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer transition-colors",
            isDragActive ? "border-primary bg-primary/5" : "hover:border-primary/50",
            error ? "border-destructive bg-destructive/5" : ""
          )}
        >
          <input {...getInputProps()} />
          <Upload className={cn(
            "w-12 h-12 mx-auto mb-4",
            isDragActive ? "text-primary" : "text-muted-foreground",
            error ? "text-destructive" : ""
          )} />
          
          {isDragActive ? (
            <p className="text-primary font-medium">Drop the PDF file here</p>
          ) : (
            <div>
              <p className="text-foreground font-medium mb-2">
                Drag & drop a PDF file here, or click to select
              </p>
              <p className="text-sm text-muted-foreground">
                Maximum file size: {maxSize / 1024 / 1024}MB
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between p-4 bg-success-light border border-success/20 rounded-lg">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-success" />
            <div>
              <p className="font-medium text-success">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={removeFile}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive bg-destructive-light p-3 rounded-lg">
          {error}
        </p>
      )}
    </div>
  );
};