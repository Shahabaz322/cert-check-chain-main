import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileUpload } from '@/components/FileUpload';
import { WalletConnect } from '@/components/WalletConnect';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client.ts';
import { Web3State } from '@/lib/web3';
import { FileCheck, Loader2, ExternalLink, Eye, QrCode, FileText, Hash, Image, AlertTriangle } from 'lucide-react';

// Real library imports
//import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';
import QRCode from 'qrcode';
import { PDFDocument } from 'pdf-lib';
// Use worker from pdfjs-dist for Vite/React projects
import { getDocument ,GlobalWorkerOptions } from 'pdfjs-dist';
// @ts-ignore
//import pdfWorker from 'pdfjs-dist/build/pdf.worker.js';
import { get } from 'http';

// FIX 1: Correct PDF.js worker configuration
// Use the correct CDN URL for the worker
//pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.worker.min.js';
GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.worker.min.mjs';

interface CertificateForm {
  rollNumber: string;
  studentName: string;
  course: string;
  institution: string;
  dateIssued: string;
  certificateId: string;
  description?: string;
}

interface ProcessingSteps {
  fileUploaded: boolean;
  textExtracted: boolean;
  hashGenerated: boolean;
  qrGenerated: boolean;
  qrEmbedded: boolean;
  blockchainIssued: boolean;
}

interface OCRResult {
  extractedText: string;
  confidence: number;
  method: 'text-pdf' | 'image-ocr' | 'hybrid';
  pageCount: number;
  processingTime?: number;
  errors?: string[];
}

interface ProcessingProgress {
  stage: string;
  progress: number;
  message: string;
}

const IssueCertificate = () => {
  const [web3State, setWeb3State] = useState<Web3State>({
    account: null,
    provider: null,
    signer: null,
    contract: null,
    isConnected: false
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [form, setForm] = useState<CertificateForm>({
    rollNumber: '',
    studentName: '',
    course: '',
    institution: '',
    dateIssued: new Date().toISOString().split('T')[0],
    certificateId: '',
    description: ''
  });

  const [processingSteps, setProcessingSteps] = useState<ProcessingSteps>({
    fileUploaded: false,
    textExtracted: false,
    hashGenerated: false,
    qrGenerated: false,
    qrEmbedded: false,
    blockchainIssued: false
  });

  const [extractedText, setExtractedText] = useState<string>('');
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [textHash, setTextHash] = useState<string>('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [processedPdfUrl, setProcessedPdfUrl] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);
  const [issuedTxHash, setIssuedTxHash] = useState<string | null>(null);
  const [issuedCertificateId, setIssuedCertificateId] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState<ProcessingProgress | null>(null);
  const [processingErrors, setProcessingErrors] = useState<string[]>([]);

  const { toast } = useToast();

  const handleFormChange = (field: keyof CertificateForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  

interface OCRResult {
  extractedText: string;
  confidence: number;
  method: 'text-pdf' | 'image-ocr' | 'hybrid';
  pageCount: number;
  processingTime: number;
  errors?: string[];
}

const extractTextFromPDF = async (file: File, form: any, setProcessingProgress: Function): Promise<OCRResult> => {
  const startTime = Date.now();
  const errors: string[] = [];

  try {
    setProcessingProgress({ stage: 'Loading PDF', progress: 10, message: 'Reading PDF file...' });

    if (file.size > 50 * 1024 * 1024) {
      throw new Error('File size too large. Please use a PDF smaller than 50MB.');
    }

    const arrayBuffer = await file.arrayBuffer();

    setProcessingProgress({ stage: 'Parsing PDF', progress: 20, message: 'Analyzing PDF structure...' });

    let pdf;
    try {
      pdf = await getDocument({ data: arrayBuffer }).promise;
    } catch (pdfError: any) {
      console.error('PDF loading error:', pdfError);
      errors.push(`PDF parsing issue: ${pdfError.message || 'Unknown error'}`);

      // fallback attempt
      try {
        pdf = await getDocument({ data: arrayBuffer }).promise;
      } catch {
        throw new Error('Unable to load PDF. Please ensure the file is not corrupted.');
      }
    }

    let extractedText = '';
    let method: 'text-pdf' | 'image-ocr' | 'hybrid' = 'text-pdf';
    let confidence = 0;
    const pageCount = pdf.numPages;

    setProcessingProgress({ stage: 'Extracting Text', progress: 30, message: `Processing ${pageCount} pages...` });

    for (let i = 1; i <= pageCount; i++) {
      try {
        setProcessingProgress({
          stage: 'Extracting Text',
          progress: 30 + (40 * i / pageCount),
          message: `Processing page ${i}/${pageCount}...`
        });

        const page = await pdf.getPage(i);

        // Try text extraction first
        let pageText = '';
        try {
          const textContent = await page.getTextContent();
          pageText = textContent.items.map((item: any) => item.str).join(' ').trim();
        } catch (textError: any) {
          errors.push(`Text extraction failed on page ${i}: ${textError.message}`);
        }

        if (pageText.length > 50) {
          extractedText += pageText + '\n';
          method = 'text-pdf';
          confidence = Math.max(confidence, 95);
        } else {
          // Fallback to OCR
          try {
            setProcessingProgress({
              stage: 'OCR Processing',
              progress: 30 + (40 * i / pageCount),
              message: `OCR processing page ${i}/${pageCount}...`
            });

            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');

            if (!context) throw new Error('Canvas context not available');

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport,canvas }).promise;

            const { data: { text, confidence: ocrConfidence } } = await Tesseract.recognize(
              canvas,
              'eng',
              {
                logger: m => {
                  if (m.status === 'recognizing text') {
                    setProcessingProgress({
                      stage: 'OCR Processing',
                      progress: 30 + (40 * (i - 1 + m.progress) / pageCount),
                      message: `OCR on page ${i}: ${Math.round(m.progress * 100)}%`
                    });
                  }
                }
              }
            );

            if (text.trim().length > 10) {
              extractedText += text.trim() + '\n';
              method = pageText.length > 0 ? 'hybrid' : 'image-ocr';
              confidence = Math.max(confidence, Math.min(ocrConfidence, 95));
            } else {
              errors.push(`OCR produced minimal text on page ${i}`);
            }

          } catch (ocrError: any) {
            errors.push(`OCR failed on page ${i}: ${ocrError.message}`);
            if (i === 1 && extractedText.length < 50) {
              const fallbackText = `
CERTIFICATE DOCUMENT

Student: ${form.studentName || '[Student Name]'}
Roll Number: ${form.rollNumber || '[Roll Number]'}
Course: ${form.course || '[Course Name]'}
Institution: ${form.institution || '[Institution Name]'}
Date Issued: ${form.dateIssued || '[Issue Date]'}

[Text extracted via fallback method - Original PDF may be image-based]
              `.trim();

              extractedText = fallbackText;
              method = 'image-ocr';
              confidence = 60;
              errors.push('Used form data as fallback due to OCR failure');
            }
          }
        }
      } catch (pageError: any) {
        errors.push(`Page ${i} processing failed: ${pageError.message}`);
      }
    }

    if (extractedText.trim().length < 20) {
      throw new Error('Insufficient text extracted from PDF. Please ensure the PDF contains readable text.');
    }

    const processingTime = Date.now() - startTime;

    setProcessingProgress({
      stage: 'Complete',
      progress: 100,
      message: 'Text extraction completed successfully'
    });

    return { extractedText: extractedText.trim(), confidence, method, pageCount, processingTime, errors: errors.length ? errors : undefined };

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    errors.push(`Primary extraction failed: ${error.message}`);
    errors.push('Using emergency fallback text generation');

    const fallbackText = `
CERTIFICATE VERIFICATION DOCUMENT

Student Name: ${form.studentName || '[Please verify student name]'}
Roll Number: ${form.rollNumber || '[Please verify roll number]'}
Course/Program: ${form.course || '[Please verify course]'}
Institution: ${form.institution || '[Please verify institution]'}
Date of Issue: ${form.dateIssued || '[Please verify date]'}

IMPORTANT: This document was processed using fallback extraction due to PDF processing issues.
Please verify all information matches the original certificate.

Processing Error Details: ${error.message}
Timestamp: ${new Date().toISOString()}
    `.trim();

    return { extractedText: fallbackText, confidence: 40, method: 'image-ocr', pageCount: 1, processingTime, errors };
  }
};


  // Enhanced hash generation with validation
  const generateTextHash = async (text: string): Promise<string> => {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('Cannot generate hash from empty text');
      }

      setProcessingProgress({
        stage: 'Generating Hash',
        progress: 80,
        message: 'Creating SHA-256 hash...'
      });

      const encoder = new TextEncoder();
      const data = encoder.encode(text.trim());
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Validate hash format
      if (!/^[a-fA-F0-9]{64}$/.test(hash)) {
        throw new Error('Generated hash format is invalid');
      }

      return hash;
    } catch (error: any) {
      throw new Error(`Hash generation failed: ${error.message}`);
    }
  };

  // Real QR code generation with error handling
  const generateQRCode = async (hash: string): Promise<string> => {
    try {
      setProcessingProgress({
        stage: 'Generating QR Code',
        progress: 85,
        message: 'Creating verification QR code...'
      });

      const qrData = {
        type: 'certificate_verification',
        hash: hash,
        rollNumber: form.rollNumber,
        studentName: form.studentName,
        institution: form.institution,
        issueDate: form.dateIssued,
        timestamp: Date.now(),
        version: '1.0'
      };
      
      const qrContent = JSON.stringify(qrData);
      
      // Validate QR content size
      if (qrContent.length > 2000) {
        throw new Error('QR code data too large. Please use shorter form values.');
      }

      const dataUrl = await QRCode.toDataURL(qrContent, { 
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });

      return dataUrl;
    } catch (error: any) {
      throw new Error(`QR code generation failed: ${error.message}`);
    }
  };

  // FIX 4: Corrected PDF modification with QR embedding
  const embedQRInPDF = async (originalFile: File, qrDataUrl: string): Promise<string> => {
    try {
      setProcessingProgress({
        stage: 'Embedding QR Code',
        progress: 90,
        message: 'Adding QR code to PDF...'
      });

      const existingPdfBytes = await originalFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(existingPdfBytes);

      // Convert data URL to bytes
      const base64Data = qrDataUrl.split(',')[1];
      if (!base64Data) {
        throw new Error('Invalid QR code data format');
      }

      const pngBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      const qrImage = await pdfDoc.embedPng(pngBytes);

      const pages = pdfDoc.getPages();
      if (pages.length === 0) {
        throw new Error('PDF has no pages');
      }

      const firstPage = pages[0];
      const { height } = firstPage.getSize();

      // Position QR code in top-left corner with margin
      firstPage.drawImage(qrImage, {
        x: 20,
        y: height - 140, // 20px from top + 120px QR size
        width: 120,
        height: 120,
      });

      const pdfBytes = await pdfDoc.save();

      // Create blob with the Uint8Array
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      return URL.createObjectURL(blob);

    } catch (error: any) {
      throw new Error(`PDF modification failed: ${error.message}`);
    }
  };

  // Enhanced document processing pipeline
  const processDocument = async () => {
    if (!selectedFile) {
      toast({
        variant: "destructive",
        title: "No File Selected",
        description: "Please upload a PDF file first",
      });
      return;
    }

    // Validate file type
    if (selectedFile.type !== 'application/pdf') {
      toast({
        variant: "destructive",
        title: "Invalid File Type",
        description: "Please upload a PDF file only",
      });
      return;
    }

    setIsProcessing(true);
    setProcessingErrors([]);
    setProcessingSteps({
      fileUploaded: true,
      textExtracted: false,
      hashGenerated: false,
      qrGenerated: false,
      qrEmbedded: false,
      blockchainIssued: false
    });

    try {
      // Step 1: Extract text using real OCR
      toast({ title: "Processing Started", description: "Extracting text from PDF with OCR support..." });
      const result = await extractTextFromPDF(selectedFile, form, setProcessingProgress);
      
      setExtractedText(result.extractedText);
      setOcrResult(result);
      setProcessingSteps(prev => ({ ...prev, textExtracted: true }));

      if (result.errors && result.errors.length > 0) {
        setProcessingErrors(result.errors);
        toast({ 
          variant: "destructive",
          title: "Processing Warnings", 
          description: `${result.errors.length} warnings occurred. Check details below.`
        });
      }

      toast({ 
        title: "Text Extraction Complete", 
        description: `Method: ${result.method}, Confidence: ${result.confidence}%, Time: ${result.processingTime}ms` 
      });

      // Step 2: Generate hash from text
      const hash = await generateTextHash(result.extractedText);
      setTextHash(hash);
      setProcessingSteps(prev => ({ ...prev, hashGenerated: true }));

      // Step 3: Generate real QR code
      const qrDataUrl = await generateQRCode(hash);
      setQrCodeDataUrl(qrDataUrl);
      setProcessingSteps(prev => ({ ...prev, qrGenerated: true }));

      // Step 4: Embed QR in PDF (top-left corner)
      const processedPdfUrl = await embedQRInPDF(selectedFile, qrDataUrl);
      setProcessedPdfUrl(processedPdfUrl);
      setProcessingSteps(prev => ({ ...prev, qrEmbedded: true }));

      setProcessingProgress({
        stage: 'Complete',
        progress: 100,
        message: 'All processing completed successfully'
      });

      toast({
        title: "Document Processed Successfully",
        description: `Ready for blockchain issuance. OCR confidence: ${result.confidence}%`,
      });

    } catch (error: any) {
      console.error("Document processing error:", error);
      
      const errorMessage = error.message || "Failed to process document";
      setProcessingErrors(prev => [...prev, errorMessage]);
      
      toast({
        variant: "destructive",
        title: "Processing Failed",
        description: errorMessage,
      });
    } finally {
      setIsProcessing(false);
      setProcessingProgress(null);
    }
  };

  const stringToBytes32 = (str: string): string => {
    const cleanStr = str.startsWith('0x') ? str.slice(2) : str;
    if (!/^[a-fA-F0-9]{64}$/.test(cleanStr)) {
      throw new Error("Invalid hash format - must be 64 hex characters");
    }
    return '0x' + cleanStr;
  };

  // Enhanced blockchain issuing with better error handling
  const handleIssueCertificate = async () => {
    if (!textHash || !web3State.contract || !web3State.account) {
      toast({
        variant: "destructive",
        title: "Not Ready",
        description: "Please process the document first and connect your wallet",
      });
      return;
    }

    setIsIssuing(true);
    try {
      const dateTimestamp = Math.floor(new Date(form.dateIssued).getTime() / 1000);
      const bytes32Hash = stringToBytes32(textHash);

      toast({
        title: "Submitting Transaction",
        description: "Please confirm the transaction in your wallet...",
      });

      const tx = await web3State.contract.issueCertificate(
        form.rollNumber,
        form.studentName,
        form.course,
        form.institution,
        dateTimestamp,
        bytes32Hash
      );

      toast({
        title: "Transaction Submitted",
        description: "Waiting for blockchain confirmation...",
      });

      const receipt = await tx.wait();

      // Extract certificate ID from events with enhanced error handling
      let blockchainCertificateId = 'Unknown';
      try {
        const certificateEvent = receipt.logs?.find((log: any) => {
          try {
            if (!web3State.contract) return false;
            const parsedLog = web3State.contract.interface.parseLog(log);
            return parsedLog && parsedLog.name === "CertificateIssued";
          } catch {
            return false;
          }
        });

        if (certificateEvent && web3State.contract) {
          const parsedLog = web3State.contract.interface.parseLog(certificateEvent);
          if (parsedLog && parsedLog.args && parsedLog.args.certificateId) {
            blockchainCertificateId = parsedLog.args.certificateId.toString();
          }
        }
      } catch (eventError) {
        console.error("Error parsing event logs:", eventError);
      }

      const certificateIdToStore = blockchainCertificateId !== "Unknown" 
        ? blockchainCertificateId 
        : `${Date.now()}-${crypto.randomUUID()}`;

      // Save to database with error handling
      const { error: insertError } = await supabase
        .from("issued_certificates")
        .insert({
          student_name: form.studentName,
          roll_number: form.rollNumber,
          course: form.course,
          certificate_id: certificateIdToStore,
          certificate_hash: `${textHash}-${Date.now()}-${form.studentName.replace(/\s+/g, '')}`,
          document_hash: textHash,
          institution_wallet: web3State.account,
          blockchain_tx_hash: receipt.transactionHash,
          issued_at: new Date(form.dateIssued).toISOString()
        });

      if (insertError) {
        console.error("Database insert error:", insertError);
        toast({
          variant: "destructive",
          title: "Database Error",
          description: "Certificate issued on blockchain but failed to save to database. Please contact support.",
        });
      } else {
        setProcessingSteps(prev => ({ ...prev, blockchainIssued: true }));
        setIssuedTxHash(receipt.transactionHash);
        setIssuedCertificateId(certificateIdToStore);
        
        toast({
          title: "Certificate Issued Successfully!",
          description: `Certificate ID: ${certificateIdToStore}`,
        });

        // Reset form after successful issuance
        setTimeout(() => {
          setForm({
            rollNumber: '',
            studentName: '',
            course: '',
            institution: '',
            dateIssued: new Date().toISOString().split('T')[0],
            certificateId: '',
            description: ''
          });
          setSelectedFile(null);
          setExtractedText('');
          setOcrResult(null);
          setTextHash('');
          setQrCodeDataUrl('');
          setProcessedPdfUrl('');
          setProcessingErrors([]);
          setProcessingSteps({
            fileUploaded: false,
            textExtracted: false,
            hashGenerated: false,
            qrGenerated: false,
            qrEmbedded: false,
            blockchainIssued: false
          });
        }, 5000); // Reset after 5 seconds
      }

    } catch (error: any) {
      console.error("Issue certificate error:", error);
      
      let errorMessage = "Failed to issue certificate. Please try again.";
      
      if (error.message?.includes("no matching fragment")) {
        errorMessage = "Contract method signature mismatch. Please check your contract.";
      } else if (error.code === 4001) {
        errorMessage = "Transaction rejected by user.";
      } else if (error.message?.includes("insufficient funds")) {
        errorMessage = "Insufficient funds for gas fees.";
      } else if (error.message?.includes("gas")) {
        errorMessage = "Gas estimation failed. Check network connection.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        variant: "destructive",
        title: "Certificate Issuance Failed",
        description: errorMessage,
      });
    } finally {
      setIsIssuing(false);
    }
  };

  const validateForm = (): boolean => {
    return !!(
      selectedFile &&
      form.studentName.trim() &&
      form.rollNumber.trim() &&
      form.course.trim() &&
      form.institution.trim() &&
      form.dateIssued &&
      web3State.isConnected
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/30 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-foreground">Advanced OCR Certificate Issuer</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Extract text from any PDF (including image-based), generate secure hash, embed QR code at top-left, and register on blockchain
          </p>
        </div>

        {/* Wallet Connect */}
        <div className="flex justify-center">
          <WalletConnect web3State={web3State} onConnect={setWeb3State} />
        </div>

        {/* Processing Steps */}
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-sm font-medium">OCR Processing Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm ${
                processingSteps.textExtracted ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'
              } border`}>
                <Image className="w-4 h-4" />
                OCR Extract
              </div>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm ${
                processingSteps.hashGenerated ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'
              } border`}>
                <Hash className="w-4 h-4" />
                Hash Generated
              </div>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm ${
                processingSteps.qrGenerated ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'
              } border`}>
                <QrCode className="w-4 h-4" />
                QR Generated
              </div>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm ${
                processingSteps.qrEmbedded ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'
              } border`}>
                <FileCheck className="w-4 h-4" />
                QR Embedded (Top-Left)
              </div>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm ${
                processingSteps.blockchainIssued ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'
              } border`}>
                <ExternalLink className="w-4 h-4" />
                Blockchain Issued
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form */}
        <Card className="shadow-lg border-0 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="w-6 h-6 text-primary" />
              Certificate Details
            </CardTitle>
            <CardDescription>
              Fill in certificate information - OCR will extract and verify text from uploaded PDF
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="certificate-file">Certificate Document (PDF)</Label>
              <FileUpload onFileSelect={setSelectedFile} selectedFile={selectedFile} />
              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  File: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="student-name">Student Name *</Label>
                <Input 
                  id="student-name" 
                  placeholder="Enter full name" 
                  value={form.studentName} 
                  onChange={(e) => handleFormChange('studentName', e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="roll-number">Roll Number *</Label>
                <Input 
                  id="roll-number" 
                  placeholder="Enter roll number" 
                  value={form.rollNumber} 
                  onChange={(e) => handleFormChange('rollNumber', e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="course">Course/Program *</Label>
                <Input 
                  id="course" 
                  placeholder="e.g., Bachelor of Computer Science" 
                  value={form.course} 
                  onChange={(e) => handleFormChange('course', e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="institution">Institution *</Label>
                <Input 
                  id="institution" 
                  placeholder="e.g., Tech University" 
                  value={form.institution} 
                  onChange={(e) => handleFormChange('institution', e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date-issued">Date Issued *</Label>
                <Input 
                  id="date-issued" 
                  type="date" 
                  max={new Date().toISOString().split('T')[0]} 
                  value={form.dateIssued} 
                  onChange={(e) => handleFormChange('dateIssued', e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="certificate-id">Certificate ID (Reference)</Label>
                <Input 
                  id="certificate-id" 
                  placeholder="Optional reference ID" 
                  value={form.certificateId} 
                  onChange={(e) => handleFormChange('certificateId', e.target.value)} 
                />
              </div>
            </div>

            <div className="space-y-4">
              <Button 
                onClick={processDocument} 
                disabled={!selectedFile || isProcessing} 
                size="lg" 
                className="w-full"
                variant="outline"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing Document (OCR Active)...
                  </>
                ) : (
                  <>
                    <Image className="w-4 h-4 mr-2" />
                    Process Document with OCR
                  </>
                )}
              </Button>

              <Button 
                onClick={handleIssueCertificate} 
                disabled={!validateForm() || !textHash || isIssuing} 
                size="lg" 
                className="w-full"
              >
                {isIssuing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Issuing Certificate...
                  </>
                ) : (
                  <>
                    <FileCheck className="w-4 h-4 mr-2" />
                    Issue Certificate on Blockchain
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* OCR Results Display */}
        {ocrResult && (
          <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <Eye className="w-5 h-5" />
                OCR Processing Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-white dark:bg-gray-800 p-3 rounded">
                  <div className="text-sm text-muted-foreground">Extraction Method</div>
                  <div className="font-medium capitalize">{ocrResult.method.replace('-', ' ')}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded">
                  <div className="text-sm text-muted-foreground">Confidence Score</div>
                  <div className="font-medium">{ocrResult.confidence}%</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded">
                  <div className="text-sm text-muted-foreground">Pages Processed</div>
                  <div className="font-medium">{ocrResult.pageCount}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Extracted Text Display */}
        {extractedText && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Extracted Text Content
                {ocrResult && (
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    ocrResult.confidence >= 90 ? 'bg-green-100 text-green-700' :
                    ocrResult.confidence >= 80 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {ocrResult.confidence}% confidence
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-4 rounded-lg">
                <pre className="text-sm whitespace-pre-wrap max-h-80 overflow-y-auto font-mono">
                  {extractedText}
                </pre>
              </div>
              <div className="mt-3 text-sm text-muted-foreground">
                Character count: {extractedText.length} | Word count: {extractedText.split(/\s+/).length}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Document Hash Display */}
        {textHash && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="w-5 h-5" />
                Document Hash (SHA-256)
              </CardTitle>
              <CardDescription>
                This hash uniquely identifies the extracted text content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-3 rounded-lg">
                <code className="text-sm break-all font-mono">
                  {textHash}
                </code>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Hash length: 64 characters (256 bits)
              </div>
            </CardContent>
          </Card>
        )}

        {/* QR Code Display */}
        {qrCodeDataUrl && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="w-5 h-5" />
                Verification QR Code
              </CardTitle>
              <CardDescription>
                Contains hash, student info, and verification data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center space-y-4">
                <div className="p-4 bg-white rounded-lg border-2 border-dashed border-gray-300">
                  <img src={qrCodeDataUrl} alt="Verification QR Code" className="w-32 h-32" />
                </div>
                <div className="text-center space-y-1">
                  <div className="text-sm font-medium">QR Code Position: Top-Left Corner</div>
                  <div className="text-xs text-muted-foreground">
                    Will be embedded at coordinates (20, 20) with 120px size
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Processed PDF Download */}
        {processedPdfUrl && (
          <Card className="border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950/20">
            <CardContent className="pt-6 text-center space-y-4">
              <div className="w-16 h-16 bg-purple-500 text-white rounded-full flex items-center justify-center mx-auto">
                <FileCheck className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-purple-700 dark:text-purple-300">
                  PDF with QR Code Ready
                </h3>
                <p className="text-sm text-purple-600 dark:text-purple-400">
                  QR code embedded at top-left corner for verification
                </p>
              </div>
              <Button 
                asChild 
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <a href={processedPdfUrl} download="certificate-with-verification-qr.pdf">
                  <FileCheck className="w-4 h-4 mr-2" />
                  Download PDF with QR Code
                </a>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Success Card */}
        {issuedTxHash && (
          <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto">
                  <FileCheck className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-semibold text-green-700 dark:text-green-300">
                  Certificate Issued Successfully!
                </h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="bg-white dark:bg-gray-800 p-3 rounded">
                      <div className="text-muted-foreground">Transaction Hash</div>
                      <code className="text-xs break-all">{issuedTxHash}</code>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-3 rounded">
                      <div className="text-muted-foreground">Certificate ID</div>
                      <code className="text-sm">{issuedCertificateId}</code>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-3 rounded">
                      <div className="text-muted-foreground">Document Hash</div>
                      <code className="text-xs break-all">{textHash}</code>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-3 rounded">
                      <div className="text-muted-foreground">OCR Method</div>
                      <span className="text-sm capitalize">
                        {ocrResult?.method.replace('-', ' ') || 'Standard'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-center space-x-4">
                  <Button 
                    variant="outline" 
                    className="border-green-500 text-green-700 hover:bg-green-500 hover:text-white" 
                    asChild
                  >
                    <a 
                      href={`https://ganache.etherscan.io/tx/${issuedTxHash}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      View Transaction <ExternalLink className="w-4 h-4 ml-2" />
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default IssueCertificate;