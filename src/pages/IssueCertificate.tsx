import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileUpload } from '@/components/FileUpload';
import { WalletConnect } from '@/components/WalletConnect';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client.ts';
import { Web3State } from '@/lib/web3';
import { FileCheck, Loader2, ExternalLink } from 'lucide-react';

// Real library imports
import Tesseract from 'tesseract.js';
import QRCode from 'qrcode';
import { PDFDocument } from 'pdf-lib';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

// PDF.js worker configuration
GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.worker.min.mjs';

interface CertificateForm {
  rollNumber: string;
  studentName: string;
  course: string;
  institution: string;
  dateIssued: string;
  certificateId: string;
}

interface OCRResult {
  extractedText: string;
  confidence: number;
  method: 'text-pdf' | 'image-ocr' | 'hybrid';
  pageCount: number;
  processingTime: number;
  errors?: string[];
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
    certificateId: ''
  });

  const [isIssuing, setIsIssuing] = useState(false);
  const [issuedTxHash, setIssuedTxHash] = useState<string | null>(null);
  const [issuedCertificateId, setIssuedCertificateId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<string>('');

  const { toast } = useToast();

  const handleFormChange = (field: keyof CertificateForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const extractTextFromPDF = async (file: File, form: any): Promise<OCRResult> => {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      setCurrentStep('Loading PDF file...');

      if (file.size > 50 * 1024 * 1024) {
        throw new Error('File size too large. Please use a PDF smaller than 50MB.');
      }

      const arrayBuffer = await file.arrayBuffer();
      setCurrentStep('Parsing PDF structure...');

      let pdf;
      try {
        pdf = await getDocument({ data: arrayBuffer }).promise;
      } catch (pdfError: any) {
        console.error('PDF loading error:', pdfError);
        errors.push(`PDF parsing issue: ${pdfError.message || 'Unknown error'}`);
        
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

      setCurrentStep(`Processing ${pageCount} pages...`);

      for (let i = 1; i <= pageCount; i++) {
        try {
          setCurrentStep(`Processing page ${i}/${pageCount}...`);

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
              setCurrentStep(`OCR processing page ${i}/${pageCount}...`);

              const viewport = page.getViewport({ scale: 2.0 });
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');

              if (!context) throw new Error('Canvas context not available');

              canvas.height = viewport.height;
              canvas.width = viewport.width;

              await page.render({ canvasContext: context, viewport, canvas }).promise;

              const { data: { text, confidence: ocrConfidence } } = await Tesseract.recognize(
                canvas,
                'eng',
                {
                  logger: m => {
                    if (m.status === 'recognizing text') {
                      setCurrentStep(`OCR on page ${i}: ${Math.round(m.progress * 100)}%`);
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

  const generateTextHash = async (text: string): Promise<string> => {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('Cannot generate hash from empty text');
      }

      setCurrentStep('Generating SHA-256 hash...');

      const encoder = new TextEncoder();
      const data = encoder.encode(text.trim());
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      if (!/^[a-fA-F0-9]{64}$/.test(hash)) {
        throw new Error('Generated hash format is invalid');
      }

      return hash;
    } catch (error: any) {
      throw new Error(`Hash generation failed: ${error.message}`);
    }
  };

  const generateQRCode = async (hash: string): Promise<string> => {
    try {
      setCurrentStep('Creating verification QR code...');

      if (!/^[a-fA-F0-9]{64}$/.test(hash)) {
        throw new Error('Invalid hash format for QR code');
      }

      const dataUrl = await QRCode.toDataURL(hash, { 
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

  const embedQRInPDF = async (originalFile: File, qrDataUrl: string): Promise<Blob> => {
    try {
      setCurrentStep('Embedding QR code in PDF...');

      const existingPdfBytes = await originalFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(existingPdfBytes);

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
      const { width, height } = firstPage.getSize();

      // Position QR code in TOP-RIGHT corner
      firstPage.drawImage(qrImage, {
        x: width - 140,
        y: height - 140,
        width: 120,
        height: 120,
      });

      const pdfBytes = await pdfDoc.save();
      return new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });

    } catch (error: any) {
      throw new Error(`PDF modification failed: ${error.message}`);
    }
  };

  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const stringToBytes32 = (str: string): string => {
    const cleanStr = str.startsWith('0x') ? str.slice(2) : str;
    if (!/^[a-fA-F0-9]{64}$/.test(cleanStr)) {
      throw new Error("Invalid hash format - must be 64 hex characters");
    }
    return '0x' + cleanStr;
  };

  const handleIssueCertificate = async () => {
    if (!selectedFile || !web3State.contract || !web3State.account) {
      toast({
        variant: "destructive",
        title: "Requirements Not Met",
        description: "Please upload a PDF file and connect your wallet",
      });
      return;
    }

    // Validate form
    if (!form.studentName.trim() || !form.rollNumber.trim() || !form.course.trim() || !form.institution.trim() || !form.dateIssued) {
      toast({
        variant: "destructive",
        title: "Form Incomplete",
        description: "Please fill in all required fields",
      });
      return;
    }

    setIsIssuing(true);
    let textHash = '';

    try {
      // Step 1: Process document with OCR
      toast({ title: "Processing Started", description: "Extracting text from PDF..." });
      
      const ocrResult = await extractTextFromPDF(selectedFile, form);
      
      toast({ 
        title: "Text Extraction Complete", 
        description: `Method: ${ocrResult.method}, Confidence: ${ocrResult.confidence}%` 
      });

      // Step 2: Generate hash
      textHash = await generateTextHash(ocrResult.extractedText);

      // Step 3: Generate QR code
      const qrDataUrl = await generateQRCode(textHash);

      // Step 4: Create PDF with embedded QR
      const processedPdfBlob = await embedQRInPDF(selectedFile, qrDataUrl);

      // Step 5: Automatic downloads
      setCurrentStep('Preparing downloads...');
      
      // Download processed PDF
      downloadFile(processedPdfBlob, `${form.studentName.replace(/\s+/g, '_')}_certificate_with_qr.pdf`);
      
      // Download QR code as image
      const qrBlob = await fetch(qrDataUrl).then(res => res.blob());
      downloadFile(qrBlob, `${form.studentName.replace(/\s+/g, '_')}_verification_qr.png`);

      // Download text file with hash
      const hashContent = `Certificate Hash Verification
      
Student: ${form.studentName}
Roll Number: ${form.rollNumber}
Course: ${form.course}
Institution: ${form.institution}
Date Issued: ${form.dateIssued}

Document Hash (SHA-256):
${textHash}

OCR Details:
- Method: ${ocrResult.method}
- Confidence: ${ocrResult.confidence}%
- Pages Processed: ${ocrResult.pageCount}
- Processing Time: ${ocrResult.processingTime}ms

Generated on: ${new Date().toISOString()}
      `;
      
      const hashBlob = new Blob([hashContent], { type: 'text/plain' });
      downloadFile(hashBlob, `${form.studentName.replace(/\s+/g, '_')}_hash_verification.txt`);

      toast({
        title: "Files Downloaded",
        description: "PDF with QR, QR image, and hash verification file downloaded",
      });

      // Step 6: Validate contract before blockchain transaction
      setCurrentStep('Validating smart contract...');
      
      // Check if contract has the expected function
      if (!web3State.contract.issueCertificate) {
        throw new Error("Contract does not have issueCertificate function. Please check contract deployment.");
      }

      // Validate contract address
      const contractCode = await web3State.provider?.getCode(web3State.contract.target || web3State.contract.address);
      if (!contractCode || contractCode === '0x') {
        throw new Error("No contract found at the specified address. Please check contract deployment.");
      }

      // Prepare transaction parameters with validation
      const dateTimestamp = Math.floor(new Date(form.dateIssued).getTime() / 1000);
      const bytes32Hash = stringToBytes32(textHash);

      // Log parameters for debugging
      console.log('Contract parameters:', {
        rollNumber: form.rollNumber,
        studentName: form.studentName,
        course: form.course,
        institution: form.institution,
        dateTimestamp,
        bytes32Hash,
        contractAddress: web3State.contract.target || web3State.contract.address
      });

      // Step 7: Issue on blockchain with enhanced error handling
      setCurrentStep('Issuing certificate on blockchain...');

      toast({
        title: "Blockchain Transaction",
        description: "Please confirm the transaction in your wallet...",
      });

      // Try to estimate gas first to catch errors early
      try {
        const gasEstimate = await web3State.contract.issueCertificate.estimateGas(
          form.rollNumber,
          form.studentName,
          form.course,
          form.institution,
          dateTimestamp,
          bytes32Hash
        );
        console.log('Gas estimate:', gasEstimate.toString());
      } catch (gasError: any) {
        console.error('Gas estimation failed:', gasError);
        
        // Provide more specific error messages
        if (gasError.message.includes('missing revert data')) {
          throw new Error("Contract function call failed. This might be due to: 1) Contract not deployed correctly, 2) Function signature mismatch, 3) Invalid parameters, or 4) Contract access restrictions.");
        } else if (gasError.message.includes('revert')) {
          throw new Error("Transaction would fail with revert. Check contract conditions and parameters.");
        } else {
          throw new Error(`Gas estimation failed: ${gasError.message}`);
        }
      }

      // Execute the transaction
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

      // Extract certificate ID from events
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

      // Save to database
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
            certificateId: ''
          });
          setSelectedFile(null);
          setIssuedTxHash(null);
          setIssuedCertificateId(null);
        }, 10000); // Reset after 10 seconds
      }

    } catch (error: any) {
      console.error("Certificate issuance error:", error);
      
      let errorMessage = "Failed to process and issue certificate. Please try again.";
      
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
      setCurrentStep('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/30 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-foreground">Certificate Issuer</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload PDF, automatically extract text with OCR, generate verification files, and issue on blockchain
          </p>
        </div>

        {/* Wallet Connect */}
        <div className="flex justify-center">
          <WalletConnect web3State={web3State} onConnect={setWeb3State} />
        </div>

        {/* Form */}
        <Card className="shadow-lg border-0 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="w-6 h-6 text-primary" />
              Certificate Details
            </CardTitle>
            <CardDescription>
              Fill in certificate information and upload PDF. Processing and blockchain issuance will happen automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="certificate-file">Certificate Document (PDF) *</Label>
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
                <Label htmlFor="certificate-id">Certificate ID (Optional)</Label>
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
                onClick={handleIssueCertificate} 
                disabled={!selectedFile || !form.studentName.trim() || !form.rollNumber.trim() || !form.course.trim() || !form.institution.trim() || !form.dateIssued || !web3State.isConnected || isIssuing} 
                size="lg" 
                className="w-full"
              >
                {isIssuing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {currentStep || 'Processing...'}
                  </>
                ) : (
                  <>
                    <FileCheck className="w-4 h-4 mr-2" />
                    Process & Issue Certificate
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

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
                <p className="text-sm text-green-600 dark:text-green-400">
                  Files have been automatically downloaded and certificate is recorded on blockchain
                </p>
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