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
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

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
  const [testingMode, setTestingMode] = useState(false); // Add testing mode toggle

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

  // Enhanced blockchain transaction handler with comprehensive error handling
  const handleBlockchainTransaction = async (contentHash: string, metadataHash: string, institutionSignature: string) => {
    try {
      console.log('=== ENHANCED BLOCKCHAIN TRANSACTION DEBUG ===');
      console.log('Contract address:', CONTRACT_ADDRESS);
      console.log('Wallet address:', web3State.account);
      console.log('Contract type:', contractType);
      
      // Step 1: Comprehensive pre-flight checks
      if (!web3State.provider || !web3State.signer || !web3State.contract) {
        throw new Error('Web3 components not properly initialized. Please reconnect your wallet.');
      }
      
      // Step 2: Network validation and health check
      let network;
      try {
        network = await web3State.provider.getNetwork();
        console.log('Network details:', {
          name: network.name,
          chainId: network.chainId.toString(),
          expectedChainId: '1337 or 5777 for Ganache'
        });
      } catch (networkError: any) {
        throw new Error(`Network connection failed: ${networkError.message}. Please check if Ganache is running and MetaMask is connected.`);
      }
      
      // Step 3: Balance verification
      let balance;
      try {
        balance = await web3State.provider.getBalance(web3State.account!);
        const balanceETH = ethers.formatEther(balance);
        console.log('Wallet balance:', balanceETH, 'ETH');
        
        if (parseFloat(balanceETH) < 0.01) {
          throw new Error('Insufficient ETH balance. Need at least 0.01 ETH for transaction fees. Please add ETH from Ganache.');
        }
      } catch (balanceError: any) {
        if (balanceError.message.includes('Insufficient ETH')) {
          throw balanceError;
        }
        throw new Error(`Failed to check wallet balance: ${balanceError.message}. Please check network connection.`);
      }
      
      // Step 4: Contract health check
      try {
        const totalCerts = await web3State.contract.getTotalCertificates();
        console.log('Contract responding - Total certificates:', totalCerts.toString());
      } catch (contractError: any) {
        console.error('Contract health check failed:', contractError);
        
        if (contractError.code === 'CALL_EXCEPTION') {
          throw new Error(`Smart contract not deployed or not responding at ${CONTRACT_ADDRESS}. Please verify contract deployment and restart Ganache.`);
        }
        
        throw new Error(`Contract communication failed: ${contractError.message}. Try restarting Ganache and redeploying the contract.`);
      }
      
      // Step 5: Parameter validation and preparation
      const dateTimestamp = Math.floor(new Date(form.dateIssued).getTime() / 1000);
      
      let contentHashBytes32;
      try {
        contentHashBytes32 = stringToBytes32(contentHash);
      } catch (hashError: any) {
        throw new Error(`Invalid content hash format: ${hashError.message}`);
      }
      
      const transactionData = {
        rollNumber: form.rollNumber,
        studentName: form.studentName, 
        course: form.course,
        institution: form.institution,
        dateTimestamp: dateTimestamp,
        contentHash: contentHashBytes32
      };
      
      console.log('Transaction parameters:', transactionData);
      
      // Step 6: Duplicate prevention check (skip in testing mode)
      if (!testingMode) {
        try {
          const existingCert = await web3State.contract.getCertificateByHash(contentHashBytes32);
          if (existingCert && existingCert.id && existingCert.id.toString() !== '0') {
            throw new Error(`Certificate with this content already exists (ID: ${existingCert.id}). Document may have been processed before.`);
          }
        } catch (hashCheckError: any) {
          // Expected error for new certificates - ignore "not found" errors
          if (!hashCheckError.message?.includes('not found') && 
              !hashCheckError.message?.includes('revert') &&
              !hashCheckError.message?.includes('Certificate with this content already exists')) {
            console.warn('Hash check warning:', hashCheckError.message);
          } else if (hashCheckError.message?.includes('Certificate with this content already exists')) {
            throw hashCheckError; // Re-throw duplicate certificate error
          }
        }
      } else {
        console.log('TESTING MODE: Skipping duplicate certificate check');
        
        // In testing mode, add timestamp to make content unique
        const testingSuffix = `-testing-${Date.now()}`;
        console.log('TESTING MODE: Adding unique suffix to avoid duplicates:', testingSuffix);
        
        // Regenerate hash with testing suffix to make it unique
        const testingText = form.rollNumber + form.studentName + form.course + testingSuffix;
        const testingHash = await generateTextHash(testingText);
        contentHashBytes32 = stringToBytes32(testingHash);
        
        console.log('TESTING MODE: Using modified hash for testing:', contentHashBytes32);
      }
      
      // Step 7: Enhanced transaction execution with multiple fallback strategies
      let transaction;
      let gasLimit = 0;
      
      // Get current nonce to prevent nonce conflicts
      let nonce: number | undefined;
      try {
        nonce = await web3State.provider.getTransactionCount(web3State.account!, 'pending');
        console.log('Current nonce:', nonce);
      } catch (nonceError: any) {
        console.warn('Failed to get nonce:', nonceError.message);
        // Continue without explicit nonce - let ethers handle it
      }
      
      // Strategy 1: Gas estimation
      try {
        console.log('Attempting gas estimation...');
        setCurrentStep('Estimating transaction gas...');
        
        if (contractType === 'enhanced') {
          const metadataHashBytes32 = stringToBytes32(metadataHash);
          gasLimit = Number(await web3State.contract.issueCertificate.estimateGas(
            form.rollNumber,
            form.studentName,
            form.course,
            form.institution,
            dateTimestamp,
            contentHashBytes32,
            metadataHashBytes32,
            institutionSignature
          ));
        } else {
          gasLimit = Number(await web3State.contract.issueCertificate.estimateGas(
            form.rollNumber,
            form.studentName,
            form.course,
            form.institution,
            dateTimestamp,
            contentHashBytes32
          ));
        }
        
        // Add 50% buffer to gas estimate for safety
        gasLimit = Math.floor(Number(gasLimit) * 1.5);
        console.log('Gas estimation successful. Using gas limit:', gasLimit);
        
      } catch (gasEstimateError: any) {
        console.warn('Gas estimation failed:', gasEstimateError.message);
        // Set reasonable default gas limits based on contract type
        gasLimit = contractType === 'enhanced' ? 1000000 : 600000;
        console.log('Using default gas limit:', gasLimit);
      }
      
      // Strategy 2: Execute transaction with multiple fallback approaches
      const executionStrategies = [
        // Strategy 2a: With estimated gas and explicit nonce
        async () => {
          console.log('Strategy 2a: Using estimated gas with nonce');
          setCurrentStep('Executing transaction with estimated gas...');
          
          const txOptions: any = { 
            gasLimit: gasLimit,
            gasPrice: ethers.parseUnits('20', 'gwei')
          };
          
          // Add nonce if we successfully got it
          if (nonce !== undefined) {
            txOptions.nonce = nonce;
          }
          
          if (contractType === 'enhanced') {
            const metadataHashBytes32 = stringToBytes32(metadataHash);
            return await web3State.contract!.issueCertificate(
              form.rollNumber,
              form.studentName,
              form.course,
              form.institution,
              dateTimestamp,
              contentHashBytes32,
              metadataHashBytes32,
              institutionSignature,
              txOptions
            );
          } else {
            return await web3State.contract!.issueCertificate(
              form.rollNumber,
              form.studentName,
              form.course,
              form.institution,
              dateTimestamp,
              contentHashBytes32,
              txOptions
            );
          }
        },
        
        // Strategy 2b: Higher gas limit without nonce
        async () => {
          console.log('Strategy 2b: Using higher gas limit');
          setCurrentStep('Retrying with higher gas limit...');
          
          const txOptions = { 
            gasLimit: contractType === 'enhanced' ? 1200000 : 800000,
            gasPrice: ethers.parseUnits('25', 'gwei')
          };
          
          if (contractType === 'enhanced') {
            const metadataHashBytes32 = stringToBytes32(metadataHash);
            return await web3State.contract!.issueCertificate(
              form.rollNumber,
              form.studentName,
              form.course,
              form.institution,
              dateTimestamp,
              contentHashBytes32,
              metadataHashBytes32,
              institutionSignature,
              txOptions
            );
          } else {
            return await web3State.contract!.issueCertificate(
              form.rollNumber,
              form.studentName,
              form.course,
              form.institution,
              dateTimestamp,
              contentHashBytes32,
              txOptions
            );
          }
        },
        
        // Strategy 2c: Let MetaMask handle everything
        async () => {
          console.log('Strategy 2c: Letting MetaMask handle gas estimation');
          setCurrentStep('Retrying with MetaMask gas estimation...');
          
          if (contractType === 'enhanced') {
            const metadataHashBytes32 = stringToBytes32(metadataHash);
            return await web3State.contract!.issueCertificate(
              form.rollNumber,
              form.studentName,
              form.course,
              form.institution,
              dateTimestamp,
              contentHashBytes32,
              metadataHashBytes32,
              institutionSignature
            );
          } else {
            return await web3State.contract!.issueCertificate(
              form.rollNumber,
              form.studentName,
              form.course,
              form.institution,
              dateTimestamp,
              contentHashBytes32
            );
          }
        }
      ];
      
      // Try each strategy in sequence
      let lastError: any = null;
      for (let i = 0; i < executionStrategies.length; i++) {
        try {
          console.log(`Attempting transaction strategy ${i + 1}...`);
          transaction = await executionStrategies[i]();
          console.log(`Strategy ${i + 1} successful! Transaction hash:`, transaction.hash);
          break;
        } catch (strategyError: any) {
          console.error(`Strategy ${i + 1} failed:`, strategyError.message);
          lastError = strategyError;
          
          // If user rejected transaction, don't try other strategies
          if (strategyError.code === 4001 || strategyError.code === 'ACTION_REJECTED') {
            throw new Error('Transaction was cancelled by user.');
          }
          
          // If this is the last strategy, throw the error
          if (i === executionStrategies.length - 1) {
            console.error('All transaction strategies failed');
            throw strategyError;
          }
          
          // Wait before trying next strategy
          console.log(`Waiting 2 seconds before trying strategy ${i + 2}...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      if (!transaction) {
        throw new Error('All transaction strategies failed. Please try again or restart Ganache.');
      }
      
      return transaction;
      
    } catch (error: any) {
      console.error('Enhanced blockchain transaction error:', error);
      throw error; // Re-throw for handling in main function
    }
  };

  // Enhanced error classification function
  const classifyAndFormatBlockchainError = (error: any): string => {
    console.log('Error classification - Code:', error.code, 'Message:', error.message);
    
    // User rejection
    if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
      return 'Transaction was cancelled by user.';
    }
    
    // RPC/Network errors (your main issue)
    if (error.code === -32603 || error.message?.includes('Internal JSON-RPC error')) {
      return `🚨 NETWORK CONNECTION ERROR

This error typically indicates a problem with the blockchain connection.

IMMEDIATE FIXES TO TRY:
1. **Restart Ganache** - Close completely and restart Ganache
2. **Reset MetaMask** - Settings → Advanced → Reset Account  
3. **Refresh Browser** - Clear cache and refresh the page
4. **Check Network** - Ensure MetaMask points to localhost:7545
5. **Verify Contract** - Confirm contract deployed at: ${CONTRACT_ADDRESS}

If error persists:
- Restart your computer
- Reinstall Ganache
- Check Windows Defender/Antivirus isn't blocking port 7545

Technical Details: ${error.message || 'Internal JSON-RPC error'}`;
    }
    
    // Insufficient funds
    if (error.message?.includes('insufficient funds')) {
      return 'Insufficient ETH balance for transaction fees. Please add ETH to your wallet from Ganache accounts.';
    }
    
    // Gas related errors
    if (error.message?.includes('gas required exceeds allowance') || 
        error.message?.includes('out of gas') ||
        error.message?.includes('gas limit')) {
      return 'Transaction requires more gas than available. Try increasing gas limit in MetaMask or restart Ganache with higher gas limit.';
    }
    
    // Contract execution errors
    if (error.message?.includes('execution reverted')) {
      return `Smart contract execution failed. Common causes:
      
      • **Duplicate Certificate** - This document may already be processed
      • **Invalid Parameters** - Check all form fields are properly filled
      • **Contract Access Issues** - Verify your wallet is authorized
      • **Contract State Error** - Try redeploying the contract
      
      Technical Details: ${error.message}`;
    }
    
    // Nonce errors
    if (error.message?.includes('nonce') || 
        error.message?.includes('replacement transaction')) {
      return `Transaction ordering problem detected.

      SOLUTION: Reset your MetaMask account
      1. Open MetaMask
      2. Go to Settings → Advanced
      3. Click "Reset Account"
      4. Try the transaction again
      
      This clears pending transactions and fixes nonce synchronization issues.`;
    }
    
    // Network connectivity
    if (error.message?.includes('network') || 
        error.message?.includes('connection') ||
        error.message?.includes('timeout')) {
      return `Network connectivity issue detected.
      
      TROUBLESHOOTING:
      1. Check internet connection
      2. Verify Ganache is running on port 7545
      3. Restart Ganache if frozen
      4. Check Windows firewall isn't blocking connections
      
      Technical Error: ${error.message}`;
    }
    
    // Contract deployment issues
    if (error.code === 'CALL_EXCEPTION' || 
        error.message?.includes('contract not deployed') ||
        error.message?.includes('no code at address')) {
      return `Smart contract not found or not responding.
      
      SOLUTION STEPS:
      1. Verify contract is deployed at: ${CONTRACT_ADDRESS}
      2. Redeploy the smart contract using Truffle/Hardhat
      3. Update CONTRACT_ADDRESS in your code if needed
      4. Ensure you're connected to the correct network
      
      Technical Details: Contract may not be deployed at the expected address.`;
    }
    
    // Generic fallback with specific guidance
    return `Blockchain transaction failed: ${error.message || 'Unknown error'}

GENERAL TROUBLESHOOTING STEPS:
1. Restart Ganache blockchain
2. Reset MetaMask account (Settings → Advanced → Reset Account)
3. Refresh browser and clear cache
4. Verify network connection (should be localhost:7545)
5. Check if contract is properly deployed

If problem persists, there may be an issue with your development environment setup.`;
  };

  const handleEnhancedIssueCertificate = async () => {
    try {
      setIsIssuing(true);
      setCurrentStep('Validating inputs...');

      // Validate inputs
      const validationErrors = validateInputs(form);
      if (validationErrors.length > 0) {
        throw new Error(`Input validation failed: ${validationErrors.join(', ')}`);
      }

      if (!selectedFile) {
        throw new Error('Please select a certificate PDF file.');
      }

      // Extract text
      setCurrentStep('Extracting text from PDF...');
      const ocrResult = await extractTextFromPDF(selectedFile);

      // Generate hashes
      setCurrentStep('Generating content hash...');
      const contentHash = await generateTextHash(ocrResult.extractedText);

      setCurrentStep('Generating metadata hash...');
      const metadataHash = await generateMetadataHash(form);

      let institutionSignature = '';
      if (contractType === 'enhanced') {
        setCurrentStep('Generating institution signature...');
        institutionSignature = await generateInstitutionSignature(contentHash);
      }

      // Blockchain transaction
      setCurrentStep('Issuing certificate on blockchain...');
      const transaction = await handleBlockchainTransaction(contentHash, metadataHash, institutionSignature);

      // Generate certificate ID if not provided
      const certificateId = form.certificateId || `CERT-${Date.now()}`;

      // Generate QR
      setCurrentStep('Generating verification QR code...');
      const qrDataUrl = await generateQRCode({
        certificateId,
        contentHash,
        institution: web3State.account,
        verifyUrl: `${window.location.origin}/verify`,
        timestamp: Date.now()
      });

      // Embed QR
      setCurrentStep('Embedding QR code in PDF...');
      const qrEmbeddedBlob = await embedQRInPDF(selectedFile, qrDataUrl);

      // Download
      downloadFile(qrEmbeddedBlob, `certificate-${form.rollNumber}.pdf`);

      // Success
      setIssuedTxHash(transaction.hash);
      setIssuedCertificateId(certificateId);

      toast({
        title: "Certificate Issued Successfully",
        description: "Certificate has been secured on the blockchain and QR code embedded.",
      });

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

            {/* Testing Mode Toggle */}
            <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Brain className="w-5 h-5 text-yellow-600" />
                    <div>
                      <h3 className="font-semibold">Development Testing Mode</h3>
                      <p className="text-sm text-muted-foreground">
                        {testingMode 
                          ? 'Enabled - Allows duplicate certificates for testing'
                          : 'Disabled - Normal duplicate prevention active'
                        }
                      </p>
                    </div>
                  </div>
                  <Button
                    variant={testingMode ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => setTestingMode(!testingMode)}
                  >
                    {testingMode ? 'Disable Testing' : 'Enable Testing'}
                  </Button>
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
                      href={`#`}
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