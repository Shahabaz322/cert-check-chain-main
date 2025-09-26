import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileUpload } from '@/components/FileUpload';
import { WalletConnect } from '@/components/WalletConnect';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client.ts';
import { CONTRACT_ADDRESS, Web3State } from '@/lib/web3';
import { FileCheck, Loader2, ExternalLink, Shield, Building2, AlertCircle, Brain } from 'lucide-react';

// Real library imports
import Tesseract from 'tesseract.js';
import QRCode from 'qrcode';
import { PDFDocument } from 'pdf-lib';
import { getDocument, GlobalWorkerOptions, version } from 'pdfjs-dist';
import { ethers } from 'ethers';

// PDF.js worker configuration
GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Gemini API configuration
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY ;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent';

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
  method: 'text-pdf' | 'image-ocr' | 'hybrid' | 'gemini-enhanced';
  pageCount: number;
  processingTime: number;
  errors?: string[];
}

interface GeminiOCRResult {
  extractedText: string;
  confidence: number;
  method: string;
  processingTime: number;
  success: boolean;
  error?: string;
}

const EnhancedIssueCertificate = () => {
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
  const [institutionInfo, setInstitutionInfo] = useState<any>(null);
  const [contractType, setContractType] = useState<'basic' | 'enhanced'>('basic');
  const [geminiAvailable, setGeminiAvailable] = useState(false);

  const { toast } = useToast();

  // Check Gemini API availability
  useEffect(() => {
    setGeminiAvailable(!!GEMINI_API_KEY && GEMINI_API_KEY !== '');
    
    if (!GEMINI_API_KEY) {
      console.warn('Gemini API key not configured. AI enhancement will not be available.');
    }
  }, []);

  // Check institution authorization status and detect contract type
  useEffect(() => {
    const checkInstitutionStatus = async () => {
      if (web3State.contract && web3State.account) {
        try {
          // First, try to detect if this is an enhanced contract
          try {
            const info = await web3State.contract.getInstitutionInfo(web3State.account);
            setInstitutionInfo(info);
            setContractType('enhanced');
            
            if (!info.isAuthorized || !info.isActive) {
              toast({
                variant: "destructive",
                title: "Institution Not Authorized",
                description: "Your wallet is not registered as an authorized institution for issuing certificates.",
              });
            }
          } catch (enhancedError) {
            // If getInstitutionInfo fails, this is likely a basic contract
            console.log('Enhanced contract methods not available, using basic contract mode');
            setContractType('basic');
            setInstitutionInfo({ isAuthorized: true, isActive: true, name: 'Basic Contract Mode' });
          }
        } catch (error) {
          console.warn('Could not check institution status:', error);
          setContractType('basic');
          setInstitutionInfo({ isAuthorized: true, isActive: true, name: 'Basic Contract Mode' });
        }
      }
    };

    checkInstitutionStatus();
  }, [web3State.contract, web3State.account]);

  const handleFormChange = (field: keyof CertificateForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const normalizeExtractedText = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\b(certificate|of|completion|participation|achievement|proudly|presented|to|for|successfully|acknowledge|efforts|keep|participating)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  /**
   * Convert canvas to base64 image for Gemini API
   */
  const canvasToBase64 = (canvas: HTMLCanvasElement): string => {
    return canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
  };

  /**
   * Call Gemini Vision API for enhanced OCR
   */
  const processWithGeminiVision = async (canvas: HTMLCanvasElement): Promise<GeminiOCRResult> => {
    const startTime = Date.now();
    
    try {
      if (!GEMINI_API_KEY) {
        return {
          extractedText: '',
          confidence: 0,
          method: 'gemini-error',
          processingTime: Date.now() - startTime,
          success: false,
          error: 'Gemini API key not configured'
        };
      }

      const base64Image = canvasToBase64(canvas);
      
      const requestBody = {
        contents: [{
          parts: [
            {
              text: `Extract ALL text from this certificate/document image. Focus on:
              1. Student names, roll numbers, ID numbers
              2. Course/program names and details
              3. Institution names and addresses
              4. Dates (issued, completed, valid until)
              5. Certificate titles and descriptions
              6. Any other readable text content
              
              Please provide the extracted text in a clean, readable format while preserving the logical structure and important details. Ignore QR codes, barcodes, and decorative elements.`
            },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: base64Image
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          topK: 32,
          topP: 1,
          maxOutputTokens: 4096,
        }
      };

      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API error:', errorText);
        
        return {
          extractedText: '',
          confidence: 0,
          method: 'gemini-error',
          processingTime: Date.now() - startTime,
          success: false,
          error: `API error: ${response.status} - ${errorText}`
        };
      }

      const result = await response.json();
      
      if (!result.candidates || result.candidates.length === 0) {
        return {
          extractedText: '',
          confidence: 0,
          method: 'gemini-error',
          processingTime: Date.now() - startTime,
          success: false,
          error: 'No text extraction results from Gemini'
        };
      }

      const extractedText = result.candidates[0].content.parts[0].text.trim();
      
      // Calculate confidence based on text quality and length
      let confidence = 85; // Base confidence for Gemini
      
      if (extractedText.length > 100) confidence += 10;
      if (extractedText.length > 500) confidence += 5;
      if (/student|certificate|course|institution/i.test(extractedText)) confidence += 5;
      if (/\d{4}[-\/]\d{2}[-\/]\d{2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4}/.test(extractedText)) confidence += 5; // Date patterns
      
      confidence = Math.min(confidence, 98); // Cap at 98%

      return {
        extractedText,
        confidence,
        method: 'gemini-vision',
        processingTime: Date.now() - startTime,
        success: true
      };

    } catch (error: any) {
      console.error('Gemini Vision API error:', error);
      
      return {
        extractedText: '',
        confidence: 0,
        method: 'gemini-error',
        processingTime: Date.now() - startTime,
        success: false,
        error: error.message
      };
    }
  };

  const extractTextFromPDF = async (file: File): Promise<OCRResult> => {
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
        throw new Error('Unable to load PDF. Please ensure the file is not corrupted.');
      }

      let extractedText = '';
      let method: 'text-pdf' | 'image-ocr' | 'hybrid' | 'gemini-enhanced' = 'text-pdf';
      let confidence = 0;
      const pageCount = pdf.numPages;

      setCurrentStep(`Processing ${pageCount} pages with AI enhancement...`);

      for (let i = 1; i <= pageCount; i++) {
        try {
          setCurrentStep(`Processing page ${i}/${pageCount}...`);

          const page = await pdf.getPage(i);

          // Step 1: Try text extraction first
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
            // Step 2: Fallback to Tesseract OCR
            try {
              setCurrentStep(`OCR processing page ${i}/${pageCount}...`);

              const viewport = page.getViewport({ scale: 2.0 });
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');

              if (!context) throw new Error('Canvas context not available');

              canvas.height = viewport.height;
              canvas.width = viewport.width;

              await page.render({ canvasContext: context, viewport }).promise;

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
                // Check if OCR confidence is below 80%
                if (ocrConfidence < 80 && geminiAvailable) {
                  setCurrentStep(`Low OCR confidence (${Math.round(ocrConfidence)}%). Using Gemini AI...`);
                  
                  // Step 3: Use Gemini Vision as fallback for low-confidence OCR
                  const geminiResult = await processWithGeminiVision(canvas);
                  
                  if (geminiResult.success && geminiResult.extractedText.length > text.length * 0.8) {
                    // Gemini provided better results
                    extractedText += geminiResult.extractedText + '\n';
                    method = pageText.length > 0 ? 'gemini-enhanced' : 'gemini-enhanced';
                    confidence = Math.max(confidence, geminiResult.confidence);
                    
                    setCurrentStep(`Gemini AI enhanced OCR completed for page ${i}`);
                  } else {
                    // Fall back to original OCR if Gemini fails
                    extractedText += text.trim() + '\n';
                    method = pageText.length > 0 ? 'hybrid' : 'image-ocr';
                    confidence = Math.max(confidence, Math.min(ocrConfidence, 95));
                    
                    if (!geminiResult.success) {
                      errors.push(`Gemini fallback failed on page ${i}: ${geminiResult.error}`);
                    }
                  }
                } else {
                  // OCR confidence is good or Gemini not available, use OCR
                  extractedText += text.trim() + '\n';
                  method = pageText.length > 0 ? 'hybrid' : 'image-ocr';
                  confidence = Math.max(confidence, Math.min(ocrConfidence, 95));
                }
              } else {
                errors.push(`OCR produced minimal text on page ${i}`);
              }

            } catch (ocrError: any) {
              errors.push(`OCR failed on page ${i}: ${ocrError.message}`);
              
              // Emergency Gemini fallback if OCR completely fails
              if (geminiAvailable) {
                try {
                  setCurrentStep(`OCR failed. Trying Gemini AI for page ${i}...`);
                  
                  const viewport = page.getViewport({ scale: 2.0 });
                  const canvas = document.createElement('canvas');
                  const context = canvas.getContext('2d');

                  if (context) {
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    await page.render({ canvasContext: context, viewport }).promise;

                    const geminiResult = await processWithGeminiVision(canvas);
                    
                    if (geminiResult.success) {
                      extractedText += geminiResult.extractedText + '\n';
                      method = 'gemini-enhanced';
                      confidence = Math.max(confidence, geminiResult.confidence);
                    } else {
                      errors.push(`Emergency Gemini fallback failed on page ${i}: ${geminiResult.error}`);
                    }
                  }
                } catch (geminiError: any) {
                  errors.push(`Emergency Gemini fallback error on page ${i}: ${geminiError.message}`);
                }
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
      return { 
        extractedText: extractedText.trim(), 
        confidence, 
        method, 
        pageCount, 
        processingTime, 
        errors: errors.length ? errors : undefined 
      };

    } catch (error: any) {
      throw new Error(`Text extraction failed: ${error.message}`);
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

  const generateMetadataHash = async (metadata: any): Promise<string> => {
    try {
      setCurrentStep('Generating metadata hash...');
      
      const metadataString = JSON.stringify({
        rollNumber: metadata.rollNumber,
        studentName: metadata.studentName,
        course: metadata.course,
        institution: metadata.institution,
        dateIssued: metadata.dateIssued
      });

      const encoder = new TextEncoder();
      const data = encoder.encode(metadataString);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      return hash;
    } catch (error: any) {
      throw new Error(`Metadata hash generation failed: ${error.message}`);
    }
  };

  const generateInstitutionSignature = async (combinedHash: string): Promise<string> => {
    try {
      setCurrentStep('Generating institution signature...');
      
      if (!web3State.signer) {
        throw new Error('Wallet signer not available');
      }

      const message = `Certificate issuance authorized by ${web3State.account} with hash: ${combinedHash}`;
      const signature = await web3State.signer.signMessage(message);
      
      console.log('Institution signature generated:', signature);
      return signature;
      
    } catch (error: any) {
      throw new Error(`Signature generation failed: ${error.message}`);
    }
  };

  const generateQRCode = async (data: any): Promise<string> => {
    try {
      setCurrentStep('Creating enhanced verification QR code...');

      const qrData = {
        certificateId: data.certificateId || 'pending',
        contentHash: data.contentHash,
        institution: web3State.account,
        verifyUrl: `${window.location.origin}/verify`,
        timestamp: Date.now()
      };

      const dataUrl = await QRCode.toDataURL(JSON.stringify(qrData), { 
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
      setCurrentStep('Embedding enhanced QR code in PDF...');

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

      // Position QR code in BOTTOM-RIGHT corner to minimize text interference
      firstPage.drawImage(qrImage, {
        x: width - 140,
        y: 20,
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

  const validateInputs = (form: CertificateForm) => {
    const errors: string[] = [];

    if (form.rollNumber.length > 50) errors.push("Roll number too long (max 50 characters)");
    if (form.studentName.length > 100) errors.push("Student name too long (max 100 characters)");
    if (form.course.length > 100) errors.push("Course name too long (max 100 characters)");
    if (form.institution.length > 100) errors.push("Institution name too long (max 100 characters)");

    const allowedChars = /^[a-zA-Z0-9\s\-\.]+$/;
    if (!allowedChars.test(form.rollNumber)) errors.push("Roll number contains invalid characters");
    if (!allowedChars.test(form.studentName.replace(/[,.']/g, ''))) errors.push("Student name contains invalid characters");
    if (!allowedChars.test(form.course.replace(/[,.']/g, ''))) errors.push("Course name contains invalid characters");
    if (!allowedChars.test(form.institution.replace(/[,.'&]/g, ''))) errors.push("Institution name contains invalid characters");

    return errors;
  };

  const handleEnhancedIssueCertificate = async () => {
    if (!selectedFile || !web3State.contract || !web3State.account) {
      toast({
        variant: "destructive",
        title: "Requirements Not Met",
        description: "Please upload a PDF file and connect your wallet",
      });
      return;
    }

    if (contractType === 'enhanced' && (!institutionInfo?.isAuthorized || !institutionInfo?.isActive)) {
      toast({
        variant: "destructive",
        title: "Institution Not Authorized",
        description: "Your wallet is not authorized to issue certificates. Please contact the system administrator.",
      });
      return;
    }

    if (!form.studentName.trim() || !form.rollNumber.trim() || !form.course.trim() || !form.institution.trim() || !form.dateIssued) {
      toast({
        variant: "destructive",
        title: "Form Incomplete",
        description: "Please fill in all required fields",
      });
      return;
    }

    const inputErrors = validateInputs(form);
    if (inputErrors.length > 0) {
      toast({
        variant: "destructive",
        title: "Input Validation Error",
        description: inputErrors.join(". "),
      });
      return;
    }

    setIsIssuing(true);
    let contentHash = '';
    let metadataHash = '';
    let institutionSignature = '';

    try {
      // Step 1: Process document with enhanced OCR
      toast({ 
        title: "AI-Enhanced Processing Started", 
        description: geminiAvailable ? 
          "Using advanced AI for text extraction and verification..." :
          "Processing with standard OCR (Gemini AI not available)..."
      });
      
      const ocrResult = await extractTextFromPDF(selectedFile);
      
      toast({ 
        title: "Text Extraction Complete", 
        description: `Method: ${ocrResult.method}, Confidence: ${ocrResult.confidence}%${ocrResult.method === 'gemini-enhanced' ? ' (AI Enhanced)' : ''}` 
      });

      // Step 2: Generate content hash from OCR text
      const normalizedText = normalizeExtractedText(ocrResult.extractedText);
      contentHash = await generateTextHash(normalizedText);
      
      console.log('AI-ENHANCED ISSUER - Original text (first 1000 chars):', ocrResult.extractedText.substring(0, 1000));
      console.log('AI-ENHANCED ISSUER - Normalized text (first 1000 chars):', normalizedText.substring(0, 1000));
      console.log('AI-ENHANCED ISSUER - Content hash:', contentHash);
      console.log('AI-ENHANCED ISSUER - Processing method:', ocrResult.method);

      // Step 3: Generate metadata hash
      if (contractType === 'enhanced') {
        metadataHash = await generateMetadataHash(form);
        console.log('AI-ENHANCED ISSUER - Metadata hash:', metadataHash);

        // Step 4: Generate institution signature
        const combinedHashData = contentHash + metadataHash + web3State.account + form.dateIssued;
        institutionSignature = await generateInstitutionSignature(combinedHashData);
      }

      // Step 5: Generate enhanced QR code
      const qrData = {
        contentHash: contentHash,
        institution: web3State.account,
        verifyUrl: `${window.location.origin}/verify`
      };
      const qrDataUrl = await generateQRCode(qrData);

      // Step 6: Create PDF with embedded QR
      const processedPdfBlob = await embedQRInPDF(selectedFile, qrDataUrl);

      // Step 7: Automatic downloads with AI processing information
      setCurrentStep('Preparing secure downloads...');
      
      // Download processed PDF
      downloadFile(processedPdfBlob, `${form.studentName.replace(/\s+/g, '_')}_certified_AI_secure.pdf`);
      
      // Download QR code
      const qrBlob = await fetch(qrDataUrl).then(res => res.blob());
      downloadFile(qrBlob, `${form.studentName.replace(/\s+/g, '_')}_verification_qr.png`);

      // Download comprehensive security report with AI details
      const securityReport = `AI-ENHANCED CERTIFICATE SECURITY REPORT

Student: ${form.studentName}
Roll Number: ${form.rollNumber}
Course: ${form.course}
Institution: ${form.institution}
Date Issued: ${form.dateIssued}
Issuing Institution Address: ${web3State.account}
Contract Type: ${contractType}

AI PROCESSING DETAILS:
Processing Method: ${ocrResult.method}
${ocrResult.method === 'gemini-enhanced' ? 'AI Enhancement: Gemini Vision API used for improved text extraction' : 'Standard Processing: Tesseract OCR used'}
Confidence Score: ${ocrResult.confidence}%
Pages Processed: ${ocrResult.pageCount}
Processing Time: ${ocrResult.processingTime}ms
Gemini AI Available: ${geminiAvailable ? 'Yes' : 'No'}

CRYPTOGRAPHIC HASHES:
Content Hash (SHA-256): ${contentHash}
${contractType === 'enhanced' ? `Metadata Hash (SHA-256): ${metadataHash}` : ''}
${contractType === 'enhanced' ? `Institution Signature: ${institutionSignature}` : ''}

VERIFICATION INSTRUCTIONS:
1. Upload the certificate PDF to the verification system
2. The system will use AI-enhanced text extraction (if available)
3. Compare the generated hash with the stored hash above
4. ${contractType === 'enhanced' ? 'Verify the institution signature matches the issuing institution' : 'Verify certificate exists on blockchain'}
5. Check blockchain records for certificate validity

AI SECURITY FEATURES:
- Low-confidence OCR automatically triggers Gemini AI fallback (< 80% confidence)
- Enhanced text recognition for difficult-to-read documents
- Multiple fallback layers ensure maximum text extraction accuracy
- Content integrity protection via cryptographic hashing
${contractType === 'enhanced' ? '- Institution authentication via digital signatures' : ''}
- Blockchain immutable record storage
- Multi-layer verification system with AI enhancement
- Tamper detection capabilities

${ocrResult.errors && ocrResult.errors.length > 0 ? `
PROCESSING WARNINGS:
${ocrResult.errors.join('\n')}
` : ''}

Generated on: ${new Date().toISOString()}
System Version: AI-Enhanced Certificate Security v${contractType === 'enhanced' ? '2.1' : '1.1'}
      `;
        
      const reportBlob = new Blob([securityReport], { type: 'text/plain' });
      downloadFile(reportBlob, `${form.studentName.replace(/\s+/g, '_')}_AI_security_report.txt`);

      toast({
        title: "AI-Enhanced Files Downloaded",
        description: `PDF, QR code, and AI security report downloaded${ocrResult.method === 'gemini-enhanced' ? ' (AI Enhanced)' : ''}`,
      });

      // Step 8: Issue certificate on blockchain
      setCurrentStep('Issuing certificate on blockchain...');

      toast({
        title: "Blockchain Transaction",
        description: "Please confirm the certificate issuance in your wallet...",
      });

      let tx: any;
      let blockchainCertificateId = 'Unknown';

     // Enhanced error handling and debugging
      const handleBlockchainTransaction = async () => {
        try {
          console.log('=== BLOCKCHAIN TRANSACTION DEBUG ===');
          console.log('Contract address:', CONTRACT_ADDRESS);
          console.log('Wallet address:', web3State.account);
          console.log('Contract type:', contractType);
          
          // Check network and balance
          const balance = await web3State.provider!.getBalance(web3State.account!);
          console.log('Wallet balance (ETH):', ethers.formatEther(balance));
          
          const network = await web3State.provider!.getNetwork();
          console.log('Current network:', network.name, 'Chain ID:', network.chainId);
          
          // Validate contract is working
          try {
            const totalCerts = await web3State.contract!.getTotalCertificates();
            console.log('Contract responding, total certificates:', totalCerts.toString());
          } catch (contractError) {
            console.error('Contract not responding:', contractError);
            throw new Error('Smart contract is not responding. Check deployment and network connection.');
          }
          
          // Pre-validate parameters
          const dateTimestamp = Math.floor(new Date(form.dateIssued).getTime() / 1000);
          const contentHashBytes32 = stringToBytes32(contentHash);
          
          console.log('Transaction parameters:', {
            rollNumber: form.rollNumber,
            studentName: form.studentName, 
            course: form.course,
            institution: form.institution,
            dateTimestamp: dateTimestamp,
            contentHash: contentHashBytes32
          });
          
          // Check for duplicate hash (common cause of failure)
          try {
            const existingCert = await web3State.contract!.getCertificateByHash(contentHashBytes32);
            if (existingCert && existingCert.id > 0) {
              throw new Error(`Certificate with this content hash already exists (ID: ${existingCert.id}). This document may have been processed before.`);
            }
          } catch (hashCheckError: any) {
            // If error contains "Certificate not found" or "revert", that's expected for new certificates
            if (!hashCheckError.message?.includes('Certificate not found') && 
                !hashCheckError.message?.includes('revert')) {
              console.warn('Hash check warning:', hashCheckError.message);
            }
          }
          
          let transaction;
          
          if (contractType === 'enhanced') {
            const metadataHashBytes32 = stringToBytes32(metadataHash);
            
            console.log('Enhanced contract parameters:', {
              metadataHash: metadataHashBytes32,
              signature: institutionSignature
            });
            
            // Try multiple transaction methods for enhanced contract
            try {
              console.log('Attempting basic enhanced transaction...');
              setCurrentStep('Sending enhanced transaction...');
              
              transaction = await web3State.contract!.issueCertificate(
                form.rollNumber,
                form.studentName,
                form.course,
                form.institution,
                dateTimestamp,
                contentHashBytes32,
                metadataHashBytes32,
                institutionSignature
              );
              console.log('Basic enhanced transaction successful:', transaction.hash);
              
            } catch (basicError: any) {
              console.log('Basic transaction failed, trying with gas estimation...', basicError.message);
              setCurrentStep('Retrying with gas estimation...');
              
              try {
                const gasEstimate = await web3State.contract!.issueCertificate.estimateGas(
                  form.rollNumber,
                  form.studentName,
                  form.course,
                  form.institution,
                  dateTimestamp,
                  contentHashBytes32,
                  metadataHashBytes32,
                  institutionSignature
                );
                
                const gasLimit = Math.floor(Number(gasEstimate) * 1.3);
                console.log('Gas estimate:', gasEstimate.toString(), 'Using limit:', gasLimit);
                
                transaction = await web3State.contract!.issueCertificate(
                  form.rollNumber,
                  form.studentName,
                  form.course,
                  form.institution,
                  dateTimestamp,
                  contentHashBytes32,
                  metadataHashBytes32,
                  institutionSignature,
                  { gasLimit }
                );
                console.log('Gas estimated transaction successful:', transaction.hash);
                
              } catch (gasError: any) {
                console.log('Gas estimation failed, trying manual settings...', gasError.message);
                setCurrentStep('Retrying with manual gas settings...');
                
                try {
                  transaction = await web3State.contract!.issueCertificate(
                    form.rollNumber,
                    form.studentName,
                    form.course,
                    form.institution,
                    dateTimestamp,
                    contentHashBytes32,
                    metadataHashBytes32,
                    institutionSignature,
                    { 
                      gasLimit: 600000,
                      gasPrice: ethers.parseUnits('20', 'gwei')
                    }
                  );
                  console.log('Manual gas transaction successful:', transaction.hash);
                  
                } catch (manualError: any) {
                  console.error('All enhanced contract methods failed');
                  console.error('Errors:', {
                    basic: basicError.message,
                    gas: gasError.message,
                    manual: manualError.message
                  });
                  
                  if (manualError.code === -32603 || basicError.code === -32603) {
                    throw new Error(`MetaMask RPC Error: This typically indicates:
                      • Network connectivity issues - try refreshing the browser
                      • Ganache blockchain not responding - restart Ganache
                      • MetaMask sync issues - try switching accounts and back
                      • Wrong network selected in MetaMask
                      
                      Technical details: ${manualError.message || basicError.message}`);
                  }
                  
                  throw new Error(`Enhanced contract transaction failed: ${manualError.message}`);
                }
              }
            }
            
          } else {
            // Basic contract transaction
            console.log('Using basic contract...');
            
            try {
              setCurrentStep('Sending basic contract transaction...');
              
              transaction = await web3State.contract!.issueCertificate(
                form.rollNumber,
                form.studentName,
                form.course,
                form.institution,
                dateTimestamp,
                contentHashBytes32,
                { 
                  gasLimit: 400000,
                  gasPrice: ethers.parseUnits('20', 'gwei')
                }
              );
              console.log('Basic contract transaction successful:', transaction.hash);
              
            } catch (basicError: any) {
              console.error('Basic contract transaction failed:', basicError);
              
              if (basicError.code === -32603) {
                throw new Error(`Network Error: Cannot connect to blockchain.
                  • Ensure Ganache is running on port 7545
                  • Verify contract deployed at: ${CONTRACT_ADDRESS}
                  • Check MetaMask network settings
                  • Try restarting Ganache and redeploying
                  
                  Error: ${basicError.message}`);
              }
              
              if (basicError.message?.includes('insufficient funds')) {
                throw new Error('Insufficient ETH balance to pay for gas fees.');
              }
              
              if (basicError.message?.includes('execution reverted')) {
                throw new Error(`Contract rejected transaction: ${basicError.message}. This may be due to duplicate certificate or invalid parameters.`);
              }
              
              throw new Error(`Basic contract transaction failed: ${basicError.message}`);
            }
          }
          
          return transaction;
          
        } catch (error: any) {
          console.error('Blockchain transaction error:', error);
          throw error;
        }
      };

      try {
        tx = await handleBlockchainTransaction();
        
        

        console.log('Transaction submitted:', tx.hash);

        toast({
          title: "Transaction Submitted",
          description: "Waiting for blockchain confirmation...",
        });

        setCurrentStep('Waiting for blockchain confirmation...');
        const receipt = await tx.wait();
        console.log('Transaction confirmed:', receipt);

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

        // Save to database with AI processing details
        const { error: insertError } = await supabase
          .from("issued_certificates")
          .insert({
            student_name: form.studentName,
            roll_number: form.rollNumber,
            course: form.course,
            certificate_id: certificateIdToStore,
            certificate_hash: contractType === 'enhanced' ? `${contentHash}-${metadataHash}` : contentHash,
            document_hash: contentHash,
            metadata_hash: contractType === 'enhanced' ? metadataHash : null,
            institution_signature: contractType === 'enhanced' ? institutionSignature : null,
            institution_wallet: web3State.account,
            blockchain_tx_hash: receipt.transactionHash,
            issued_at: new Date(form.dateIssued).toISOString(),
            security_version: contractType === 'enhanced' ? 'v2.1-AI' : 'v1.1-AI',
            ocr_confidence: ocrResult.confidence,
            processing_method: ocrResult.method,
            ai_enhanced: ocrResult.method === 'gemini-enhanced'
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
            title: "AI-Enhanced Certificate Issued Successfully!",
            description: `Certificate ID: ${certificateIdToStore} with ${contractType} security${ocrResult.method === 'gemini-enhanced' ? ' (AI Enhanced)' : ''}`,
          });

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
          }, 10000);
        }

      } catch (blockchainError: any) {
        console.error('Blockchain transaction error:', blockchainError);
        
        let errorMessage = "Blockchain transaction failed. ";
        
        if (blockchainError.code === 4001) {
          errorMessage = "Transaction was rejected by the user.";
        } else if (blockchainError.code === -32603) {
          errorMessage = `Network or RPC error occurred. This could be due to:
          • Network connectivity issues - try refreshing the page
          • Blockchain network being down - check network status  
          • MetaMask internal error - try restarting your browser
          • Gas estimation failure - the transaction may be too complex`;
        } else if (blockchainError.message?.includes('insufficient funds')) {
          errorMessage = "Insufficient funds to pay for gas fees.";
        } else if (blockchainError.message?.includes('execution reverted')) {
          errorMessage = `Smart contract execution failed: ${blockchainError.message}`;
        } else if (blockchainError.message?.includes('nonce too high') || blockchainError.message?.includes('replacement transaction underpriced')) {
          errorMessage = "Transaction nonce error. Try resetting your MetaMask account or wait a moment and try again.";
        } else if (blockchainError.message?.includes('already known')) {
          errorMessage = "Duplicate transaction detected. The transaction may have already been submitted.";
        } else {
          errorMessage += blockchainError.message || "Unknown blockchain error occurred.";
        }
        
        toast({
          variant: "destructive",
          title: "Transaction Failed",
          description: errorMessage,
        });
        
        throw new Error(errorMessage);
      }

    } catch (overallError: any) {
      console.error('Certificate issuance failed:', overallError);
      
      toast({
        variant: "destructive",
        title: "Certificate Issuance Failed",
        description: overallError.message || "An unexpected error occurred during certificate processing.",
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
          <h1 className="text-4xl font-bold text-foreground">Enhanced Certificate Issuer</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Issue certificates with cryptographic security, digital signatures, and blockchain immutability
          </p>
        </div>

        {/* Wallet Connect */}
        <div className="flex justify-center">
          <WalletConnect web3State={web3State} onConnect={setWeb3State} />
        </div>

        {/* Contract Type & Institution Status */}
        {web3State.isConnected && (
          <>
            <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="font-semibold">Contract Type Detected</h3>
                    <p className="text-sm text-muted-foreground">
                      {contractType === 'enhanced' 
                        ? 'Enhanced contract with full security features'
                        : 'Basic contract with core functionality'
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {contractType === 'enhanced' && (
              <Card className={`border-2 ${
                institutionInfo?.isAuthorized && institutionInfo?.isActive
                  ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20'
                  : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20'
              }`}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <Building2 className={`w-5 h-5 ${
                      institutionInfo?.isAuthorized && institutionInfo?.isActive
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`} />
                    <div>
                      <h3 className="font-semibold">Institution Status</h3>
                      <p className="text-sm text-muted-foreground">
                        {institutionInfo?.isAuthorized && institutionInfo?.isActive
                          ? `Authorized Institution: ${institutionInfo.name || 'Verified'}`
                          : 'Not authorized to issue certificates'
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Form */}
        <Card className="shadow-lg border-0 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              Certificate Details
            </CardTitle>
            <CardDescription>
              Fill in certificate information and upload PDF. {contractType === 'enhanced' ? 'Enhanced' : 'Basic'} cryptographic processing will secure the certificate.
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
                <Label htmlFor="student-name">Student Name * (max 100 chars)</Label>
                <Input 
                  id="student-name" 
                  placeholder="Enter full name" 
                  value={form.studentName} 
                  onChange={(e) => handleFormChange('studentName', e.target.value)}
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground">{form.studentName.length}/100 characters</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="roll-number">Roll Number * (max 50 chars)</Label>
                <Input 
                  id="roll-number" 
                  placeholder="Enter roll number" 
                  value={form.rollNumber} 
                  onChange={(e) => handleFormChange('rollNumber', e.target.value)}
                  maxLength={50}
                />
                <p className="text-xs text-muted-foreground">{form.rollNumber.length}/50 characters</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="course">Course/Program * (max 100 chars)</Label>
                <Input 
                  id="course" 
                  placeholder="e.g., Bachelor of Computer Science" 
                  value={form.course} 
                  onChange={(e) => handleFormChange('course', e.target.value)}
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground">{form.course.length}/100 characters</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="institution">Institution * (max 100 chars)</Label>
                <Input 
                  id="institution" 
                  placeholder="e.g., Tech University" 
                  value={form.institution} 
                  onChange={(e) => handleFormChange('institution', e.target.value)}
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground">{form.institution.length}/100 characters</p>
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
                <Label htmlFor="certificate-id">Certificate Reference ID (Optional)</Label>
                <Input 
                  id="certificate-id" 
                  placeholder="Internal reference ID" 
                  value={form.certificateId} 
                  onChange={(e) => handleFormChange('certificateId', e.target.value)} 
                />
              </div>
            </div>

            <div className="space-y-4">
              <Button 
                onClick={handleEnhancedIssueCertificate} 
                disabled={
                  !selectedFile || 
                  !form.studentName.trim() || 
                  !form.rollNumber.trim() || 
                  !form.course.trim() || 
                  !form.institution.trim() || 
                  !form.dateIssued || 
                  !web3State.isConnected || 
                  isIssuing ||
                  (contractType === 'enhanced' && (!institutionInfo?.isAuthorized || !institutionInfo?.isActive))
                } 
                size="lg" 
                className="w-full"
              >
                {isIssuing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {currentStep || 'Processing Certificate...'}
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Issue {contractType === 'enhanced' ? 'Enhanced' : 'Basic'} Secure Certificate
                  </>
                )}
              </Button>
              
              {/* Input validation warnings */}
              {validateInputs(form).length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                  <h4 className="text-sm font-medium text-yellow-800 mb-1">Input Validation Warnings:</h4>
                  <ul className="text-sm text-yellow-700 list-disc list-inside">
                    {validateInputs(form).map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Success Card */}
        {issuedTxHash && (
          <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto">
                  <Shield className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-semibold text-green-700 dark:text-green-300">
                  Certificate Issued Successfully!
                </h3>
                <p className="text-sm text-green-600 dark:text-green-400">
                  Certificate secured with {contractType} cryptographic protection and blockchain immutability
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
                  <div className="bg-white dark:bg-gray-800 p-3 rounded">
                    <div className="text-muted-foreground">Contract Type</div>
                    <code className="text-sm">{contractType} security features</code>
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
                      View on Blockchain <ExternalLink className="w-4 h-4 ml-2" />
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

export default EnhancedIssueCertificate;