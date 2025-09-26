import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileUpload } from '@/components/FileUpload';
import { WalletConnect } from '@/components/WalletConnect';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Web3State } from '@/lib/web3';
import { Shield, ShieldCheck, ShieldX, Loader2, ExternalLink, Calendar, User, GraduationCap, Hash, FileText, QrCode, Eye, Building2, Fingerprint, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

// Real library imports
import Tesseract from 'tesseract.js';
import QrScanner from 'qr-scanner';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

// PDF.js worker configuration - use .js instead of .mjs
GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

interface QRCodeData {
  certificateId?: string;
  contentHash?: string;
  institution?: string;
  verifyUrl?: string;
  timestamp?: number;
}

interface VerificationResult {
  isValid: boolean;
  securityScore: number;
  ocrText?: string;
  ocrHash?: string;
  qrHash?: string;
  qrData?: QRCodeData;
  hashesMatch?: boolean;
  certificateData?: {
    id?: string;
    student_name?: string | null;
    roll_number?: string | null;
    course?: string | null;
    certificate_id?: string | number;
    certificate_hash?: string | null;
    institution_wallet?: string | null;
    blockchain_tx_hash?: string | null;
    issued_at?: string | null;
    created_at?: string | null;
    document_hash?: string | null;
    title?: string | null;
    description?: string | null;
    document_id?: number;
    owner_address?: string | null;
  };
  blockchainValid?: boolean;
  databaseValid?: boolean;
  ocrConfidence?: number;
  processingMethod?: string;
  institutionInfo?: {
    name: string;
    isAuthorized: boolean;
    isActive: boolean;
    address: string;
  };
  extractedMetadata?: {
    studentName: string;
    rollNumber: string;
    course: string;
    institution: string;
  };
  metadataValid?: boolean;
  revocationStatus?: {
    isRevoked: boolean;
    reason?: string;
    revokedBy?: string;
    revocationDate?: string;
  };
  securityChecks?: {
    contentTampered: boolean;
    institutionValid: boolean;
    signatureValid: boolean;
    blockchainConsistent: boolean;
    qrConsistent: boolean;
    dateValid: boolean;
  };
}

interface ProcessingProgress {
  stage: string;
  message: string;
  progress?: number;
}

// Gemini Vision API integration with updated endpoint
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

const VerifyCertificate = () => {
  const [web3State, setWeb3State] = useState<Web3State>({
    account: null,
    provider: null,
    signer: null,
    contract: null,
    isConnected: false
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [processingProgress, setProcessingProgress] = useState<ProcessingProgress | null>(null);

  const { toast } = useToast();

  // Enhanced OCR with Gemini Vision fallback
  const processWithGeminiVision = async (canvas: HTMLCanvasElement): Promise<{extractedText: string; confidence: number; method: string}> => {
    if (!GEMINI_API_KEY) {
      console.warn('Gemini API key not configured, skipping Gemini Vision');
      return { extractedText: '', confidence: 0, method: 'gemini-unavailable' };
    }

    try {
      const base64Image = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
      
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
              
              Please provide the extracted text in a clean, readable format while preserving structure. Only return the extracted text, no additional commentary.`
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Gemini API error: ${response.status} - ${errorText}`);
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.candidates || result.candidates.length === 0 || !result.candidates[0].content?.parts?.[0]?.text) {
        throw new Error('No valid results from Gemini');
      }

      const extractedText = result.candidates[0].content.parts[0].text.trim();
      let confidence = 90;
      
      // Boost confidence based on text quality
      if (extractedText.length > 100) confidence += 5;
      if (extractedText.length > 500) confidence += 3;
      if (/student|certificate|course|institution|name|date/i.test(extractedText)) confidence += 2;
      
      return {
        extractedText,
        confidence: Math.min(confidence, 98),
        method: 'gemini-vision'
      };

    } catch (error: any) {
      console.error('Gemini Vision failed:', error);
      return { extractedText: '', confidence: 0, method: 'gemini-error' };
    }
  };

  // Extract text from PDF using multiple methods with confidence fallback
  const extractTextFromPDF = async (file: File): Promise<{ extractedText: string; confidence: number; method: string }> => {
    try {
      setProcessingProgress({ stage: 'Loading PDF', message: 'Reading PDF file...', progress: 10 });

      if (file.size > 50 * 1024 * 1024) {
        throw new Error('File size too large. Please use a PDF smaller than 50MB.');
      }

      const arrayBuffer = await file.arrayBuffer();
      setProcessingProgress({ stage: 'Parsing PDF', message: 'Analyzing PDF structure...', progress: 20 });

      let pdf;
      try {
        // Try to load PDF with error handling for worker issues
        pdf = await getDocument({ 
          data: arrayBuffer,
          verbosity: 0, // Reduce console noise
          disableAutoFetch: true,
          disableStream: true
        }).promise;
      } catch (pdfError: any) {
        console.error('PDF loading error:', pdfError);
        
        // If worker fails, try without worker
        try {
          // Disable worker and try again
          GlobalWorkerOptions.workerSrc = '';
          pdf = await getDocument({ 
            data: arrayBuffer,
            verbosity: 0,
            disableAutoFetch: true,
            disableStream: true,
            disableWebGL: true
          }).promise;
        } catch (secondError: any) {
          console.error('PDF loading failed completely:', secondError);
          throw new Error('Unable to load PDF. This may be due to PDF.js compatibility issues. Please try a different PDF or ensure the file is not corrupted.');
        }
      }

      let extractedText = '';
      let method = 'text-pdf';
      let confidence = 0;
      const pageCount = pdf.numPages;

      setProcessingProgress({ stage: 'Extracting Text', message: `Processing ${pageCount} pages...`, progress: 30 });

      // First try direct text extraction
      for (let i = 1; i <= pageCount; i++) {
        try {
          const page = await pdf.getPage(i);
          
          try {
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ').trim();
            
            if (pageText.length > 50) {
              extractedText += pageText + '\n';
              method = 'text-pdf';
              confidence = Math.max(confidence, 95);
            }
          } catch (textError: any) {
            console.error(`Text extraction failed on page ${i}:`, textError);
          }
        } catch (pageError: any) {
          console.error(`Page ${i} loading failed:`, pageError);
        }
      }

      // If insufficient text or low confidence, try OCR methods
      if (extractedText.trim().length < 50 || confidence < 80) {
        setProcessingProgress({ stage: 'OCR Processing', message: 'Using OCR for text extraction...', progress: 50 });

        let bestOcrResult = { extractedText: '', confidence: 0, method: 'none' };

        for (let i = 1; i <= Math.min(pageCount, 3); i++) {
          try {
            setProcessingProgress({
              stage: 'OCR Processing',
              message: `Processing page ${i}/${Math.min(pageCount, 3)}...`,
              progress: 50 + (i * 10)
            });

            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');

            if (!context) continue;

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            try {
              await page.render({ 
                canvasContext: context, 
                viewport, 
                intent: 'display'
              }).promise;
            } catch (renderError: any) {
              console.error(`Page ${i} rendering failed:`, renderError);
              continue;
            }

            // Try Tesseract OCR first
            let tesseractResult = { extractedText: '', confidence: 0, method: 'tesseract-failed' };
            
            try {
              setProcessingProgress({
                stage: 'OCR Processing',
                message: `Tesseract OCR on page ${i}...`,
                progress: 60 + (i * 10)
              });

              const { data: { text, confidence: ocrConfidence } } = await Tesseract.recognize(
                canvas,
                'eng',
                {
                  logger: m => {
                    if (m.status === 'recognizing text') {
                      setProcessingProgress({
                        stage: 'OCR Processing',
                        message: `Tesseract OCR on page ${i}: ${Math.round(m.progress * 100)}%`,
                        progress: 60 + (i * 10) + (m.progress * 10)
                      });
                    }
                  },
                  // Enhanced Tesseract configuration for better accuracy
                  tessedit_pageseg_mode: '1', // Automatic page segmentation with OSD
                  tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,:-()/', // Restrict to common certificate characters
                }
              );

              // Clean the OCR text to remove artifacts
              const cleanedText = text
                .split('\n')
                .map(line => line.trim())
                .filter(line => {
                  // Remove lines that are likely OCR artifacts
                  if (line.length <= 2 && /^[iI1lL|!]+$/.test(line)) return false; // Single chars like "i", "I", "1", "l", "L"
                  if (/^[^\w\s]{1,3}$/.test(line)) return false; // Only special characters
                  if (line.match(/^[A-Za-z]\s[A-Za-z]\s[A-Za-z]$/)) return false; // Pattern like "S g i A"
                  return line.length > 0;
                })
                .join(' ')
                .replace(/\s+/g, ' ') // Multiple spaces to single space
                .trim();

              tesseractResult = {
                extractedText: cleanedText,
                confidence: Math.min(ocrConfidence, 95),
                method: 'tesseract-ocr'
              };

            } catch (ocrError: any) {
              console.error(`Tesseract OCR failed on page ${i}:`, ocrError);
            }

            // If Tesseract confidence is below 80%, try Gemini Vision as fallback
            let geminiResult = { extractedText: '', confidence: 0, method: 'gemini-skipped' };
            
            if (tesseractResult.confidence < 80) {
              if (GEMINI_API_KEY) {
                setProcessingProgress({
                  stage: 'AI Enhancement',
                  message: `Tesseract confidence ${tesseractResult.confidence}% < 80%, switching to Gemini Vision AI...`,
                  progress: 70 + (i * 10)
                });
                
                geminiResult = await processWithGeminiVision(canvas);
                
                if (geminiResult.extractedText.length > 0) {
                  console.log(`Gemini Vision fallback successful: ${geminiResult.confidence}% confidence, ${geminiResult.extractedText.length} chars`);
                } else {
                  console.warn('Gemini Vision fallback failed or returned empty text');
                }
              } else {
                console.warn(`Tesseract confidence ${tesseractResult.confidence}% < 80% but no Gemini API key available`);
                geminiResult.method = 'gemini-unavailable';
              }
            }

            // Choose the best result for this page
            const pageResults = [tesseractResult, geminiResult].filter(r => r.extractedText.length > 10); // Minimum 10 chars
            
            if (pageResults.length > 0) {
              // Prioritize results based on confidence and method quality
              pageResults.sort((a, b) => {
                // Give bonus points to Gemini Vision when Tesseract confidence is low
                let scoreA = a.confidence;
                let scoreB = b.confidence;
                
                if (a.method === 'gemini-vision' && tesseractResult.confidence < 70) scoreA += 20;
                if (b.method === 'gemini-vision' && tesseractResult.confidence < 70) scoreB += 20;
                
                // Also consider text length (longer is often better for certificates)
                scoreA += Math.min(a.extractedText.length / 10, 20);
                scoreB += Math.min(b.extractedText.length / 10, 20);
                
                return scoreB - scoreA;
              });
              
              const pageResult = pageResults[0];
              console.log(`Page ${i} best result: ${pageResult.method} (${pageResult.confidence}% confidence, ${pageResult.extractedText.length} chars)`);
              
              if (pageResult.confidence > bestOcrResult.confidence || 
                  (pageResult.confidence >= bestOcrResult.confidence - 10 && pageResult.extractedText.length > bestOcrResult.extractedText.length)) {
                bestOcrResult = pageResult;
              }
            }

          } catch (pageError: any) {
            console.error(`Page ${i} processing failed:`, pageError);
          }
        }

        // Use the best OCR result if it's better than text extraction
        if (bestOcrResult.extractedText.length > extractedText.length || bestOcrResult.confidence > confidence) {
          extractedText = bestOcrResult.extractedText;
          confidence = bestOcrResult.confidence;
          method = bestOcrResult.method;
        }
      }

      if (extractedText.trim().length < 20) {
        throw new Error('Insufficient text extracted from PDF. The document may be image-based or have compatibility issues with the PDF reader. Please try a text-based PDF or ensure OCR services are properly configured.');
      }

      return { extractedText: extractedText.trim(), confidence, method };

    } catch (error: any) {
      throw new Error(`Text extraction failed: ${error.message}`);
    }
  };

  // Extract QR codes from PDF
  const extractQRFromPDF = async (file: File): Promise<{ qrContent: string; qrData: QRCodeData } | null> => {
    try {
      setProcessingProgress({ stage: 'QR Scanning', message: 'Scanning for QR codes...', progress: 75 });

      const arrayBuffer = await file.arrayBuffer();
      
      let pdf;
      try {
        pdf = await getDocument({ 
          data: arrayBuffer,
          verbosity: 0,
          disableAutoFetch: true,
          disableStream: true
        }).promise;
      } catch (pdfError: any) {
        console.error('QR PDF loading failed:', pdfError);
        return null;
      }

      const pageCount = pdf.numPages;

      for (let i = 1; i <= pageCount; i++) {
        try {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');

          if (!context) continue;

          canvas.height = viewport.height;
          canvas.width = viewport.width;

          try {
            await page.render({
              canvasContext: context,
              viewport: viewport,
              intent: 'display'
            }).promise;
          } catch (renderError: any) {
            console.error(`QR page ${i} rendering failed:`, renderError);
            continue;
          }

          try {
            const result = await QrScanner.scanImage(canvas, { returnDetailedScanResult: true });
            if (result && result.data) {
              console.log(`Found QR code on page ${i}:`, result.data);
              
              // Try to parse QR content as JSON
              let qrData: QRCodeData = {};
              try {
                qrData = JSON.parse(result.data);
              } catch (parseError) {
                // If not JSON, treat as plain text hash
                console.warn('QR code is not JSON, treating as plain hash');
                qrData = { contentHash: result.data };
              }
              
              return {
                qrContent: result.data,
                qrData
              };
            }
          } catch (qrError) {
            // QR scanner throws when no QR found, which is expected
          }
        } catch (pageError: any) {
          console.error(`QR scanning failed on page ${i}:`, pageError);
        }
      }

      return null;
    } catch (error: any) {
      console.error('QR extraction failed:', error);
      return null;
    }
  };

  // Generate SHA-256 hash from text
  const generateTextHash = async (text: string): Promise<string> => {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(text.trim());
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hash;
    } catch (error: any) {
      throw new Error(`Hash generation failed: ${error.message}`);
    }
  };

  // Extract certificate metadata from text
  const extractCertificateMetadata = (text: string) => {
    const metadata = {
      studentName: '',
      rollNumber: '',
      course: '',
      institution: ''
    };

    // Clean text for better pattern matching
    const cleanText = text.replace(/\s+/g, ' ').trim();

    // Student name patterns
    const namePatterns = [
      /(?:certify that|presented to|hereby certifies that)\s+([A-Za-z\s]{2,50})(?:\s+has|\s+student|\s+roll|\s+successfully)/i,
      /This is to certify that\s+([A-Za-z\s]{2,50})\s+has/i,
      /congratulate\s+([A-Za-z\s]+)\s+(?:for|in)/i
    ];

    for (const pattern of namePatterns) {
      const match = cleanText.match(pattern);
      if (match && match[1].trim().length > 1) {
        metadata.studentName = match[1].trim();
        break;
      }
    }

    // Roll number patterns
    const rollPatterns = [
      /(?:roll\s*(?:number|no\.?)|student\s*id|id\s*(?:number|no\.?)):?\s*([A-Z0-9]+)/i
    ];

    for (const pattern of rollPatterns) {
      const match = cleanText.match(pattern);
      if (match && match[1].length > 2) {
        metadata.rollNumber = match[1].trim();
        break;
      }
    }

    // Course patterns
    const coursePatterns = [
      /(?:course|program|degree|certification)\s*:?\s*([A-Za-z\s]+?)(?:\s+at|\s+from|\s+in)/i,
      /(?:participated in|completed)\s+(?:the\s+)?([A-Za-z\s]+?)(?:\s+course|\s+program)/i
    ];

    for (const pattern of coursePatterns) {
      const match = cleanText.match(pattern);
      if (match && match[1].trim().length > 3) {
        metadata.course = match[1].trim();
        break;
      }
    }

    // Institution patterns
    const institutionPatterns = [
      /(?:institution|university|college|academy|ministry)\s*:?\s*([A-Za-z\s&]+)/i,
      /(?:issued by|from)\s+([A-Za-z\s&]+?)(?:\s+on|\s+dated)/i
    ];

    for (const pattern of institutionPatterns) {
      const match = cleanText.match(pattern);
      if (match && match[1].trim().length > 3) {
        metadata.institution = match[1].trim();
        break;
      }
    }

    return metadata;
  };

  const handleVerifyCertificate = async () => {
    if (!selectedFile || !web3State.isConnected || !web3State.contract) {
      toast({
        variant: "destructive",
        title: "Requirements Not Met",
        description: "Please connect your wallet and select a PDF file to verify.",
      });
      return;
    }

    setIsVerifying(true);
    setVerificationResult(null);

    try {
      toast({ title: "Verification Started", description: "Processing certificate with enhanced OCR and QR scanning..." });

      // Step 1: Extract text using enhanced OCR with fallback
      const ocrResult = await extractTextFromPDF(selectedFile);
      const ocrText = ocrResult.extractedText;
      
      // Step 2: Generate hash from OCR text
      setProcessingProgress({ stage: 'Hashing', message: 'Generating hash from extracted text...', progress: 85 });
      const ocrHash = await generateTextHash(ocrText);

      // Step 3: Extract QR code
      const qrResult = await extractQRFromPDF(selectedFile);
      const qrHash = qrResult?.qrData?.contentHash || qrResult?.qrContent || null;
      const qrData = qrResult?.qrData || {};

      // Step 4: Compare hashes
      const hashesMatch = qrHash && ocrHash === qrHash.toLowerCase();

      // Step 5: Extract metadata
      const extractedMetadata = extractCertificateMetadata(ocrText);

      setProcessingProgress({ stage: 'Database Check', message: 'Checking database records...', progress: 90 });

      // Step 6: Database verification using the QR hash (if found) or OCR hash
      const searchHash = qrHash || ocrHash;
      let dbData: any = null;
      let isDatabaseValid = false;

      const hashVariants = [
        searchHash,
        searchHash.startsWith("0x") ? searchHash.slice(2) : `0x${searchHash}`,
        searchHash.startsWith("0x") ? searchHash : searchHash
      ];

      const searchCombinations = [
        { table: "issued_certificates", field: "certificate_hash" },
        { table: "issued_certificates", field: "document_hash" },
        { table: "documents", field: "document_hash" },
      ];

      for (const combo of searchCombinations) {
        for (const hashVariant of hashVariants) {
          console.log(`Querying ${combo.table}.${combo.field} = ${hashVariant}`);

          const { data, error } = await supabase
            .from(combo.table)
            .select("*")
            .eq(combo.field, hashVariant);

          if (error) {
            console.warn(`Error querying ${combo.table}.${combo.field}:`, error.message);
            continue;
          }

          if (data && data.length > 0) {
            dbData = data[0];
            isDatabaseValid = true;
            console.log(`Found record in ${combo.table}.${combo.field}`, dbData);
            break;
          }
        }
        if (isDatabaseValid) break;
      }

      // Step 7: Blockchain verification
      setProcessingProgress({ stage: 'Blockchain Check', message: 'Verifying on blockchain...', progress: 95 });
      const certificateId = dbData?.certificate_id;
      let isBlockchainValid = false;

      if (certificateId) {
        try {
          isBlockchainValid = await web3State.contract.verifyCertificate(certificateId);
        } catch (err) {
          console.error("Blockchain verification failed:", err);
        }
      }

      // Step 8: Institution verification
      let institutionInfo = null;
      if (dbData?.institution_wallet) {
        try {
          const { data: instData } = await supabase
            .from('institutions')
            .select('*')
            .eq('wallet_address', dbData.institution_wallet)
            .single();
          
          if (instData) {
            institutionInfo = {
              name: instData.name,
              isAuthorized: instData.is_authorized,
              isActive: instData.is_active,
              address: instData.wallet_address
            };
          }
        } catch (error) {
          console.error('Institution verification error:', error);
        }
      }

      // Step 9: Check revocation status
      let revocationStatus = { isRevoked: false };
      if (certificateId) {
        try {
          const { data: revData } = await supabase
            .from('certificate_revocations')
            .select('*')
            .eq('certificate_id', certificateId)
            .single();
          
          if (revData) {
            revocationStatus = {
              isRevoked: true,
              reason: revData.reason,
              revokedBy: revData.revoked_by,
              revocationDate: revData.revoked_at
            };
          }
        } catch (error) {
          // No revocation found, which is good
        }
      }

      // Step 10: Validate metadata
      const metadataValid = dbData ? (
        (extractedMetadata.studentName && extractedMetadata.studentName.toLowerCase() === dbData.student_name?.toLowerCase()) ||
        (extractedMetadata.rollNumber && extractedMetadata.rollNumber === dbData.roll_number) ||
        (extractedMetadata.course && extractedMetadata.course.toLowerCase().includes(dbData.course?.toLowerCase()))
      ) : false;

      // Step 11: Security checks
      const securityChecks = {
        contentTampered: !hashesMatch && !!qrHash,
        institutionValid: institutionInfo ? institutionInfo.isAuthorized && institutionInfo.isActive : false,
        signatureValid: !!dbData?.institution_signature,
        blockchainConsistent: isBlockchainValid,
        qrConsistent: !!hashesMatch,
        dateValid: dbData ? new Date(dbData.issued_at) <= new Date() : false
      };

      // Step 12: Final validation
      const isValid = 
        !!dbData &&
        isDatabaseValid &&
        isBlockchainValid &&
        !revocationStatus.isRevoked &&
        (hashesMatch || !qrHash); // Valid if hashes match OR no QR present

      // Calculate security score
      let securityScore = 0;
      if (isDatabaseValid) securityScore += 30;
      if (isBlockchainValid) securityScore += 40;
      if (hashesMatch || !qrHash) securityScore += 15; // QR consistency
      if (metadataValid) securityScore += 10;
      if (securityChecks.institutionValid) securityScore += 5;
      
      // Boost score for high-confidence AI extraction
      if (ocrResult.method === 'gemini-vision' && ocrResult.confidence > 90) {
        securityScore += 5;
      }
      
      securityScore = Math.min(securityScore, 100);

      // Step 13: Log verification (with proper data types)
      try {
        const logData = {
          document_hash: searchHash.startsWith("0x") ? searchHash : `0x${searchHash}`,
          verifier_address: web3State.account,
          verification_type: "enhanced_ocr_qr_verification",
          is_valid: isValid,
          details: JSON.stringify({
            ocr_hash: ocrHash,
            qr_hash: qrHash,
            hashes_match: hashesMatch,
            blockchain_valid: isBlockchainValid,
            database_valid: isDatabaseValid,
            ocr_confidence: ocrResult.confidence,
            processing_method: ocrResult.method,
            security_score: securityScore,
            verified_at: new Date().toISOString(),
          }),
          // Only add document_id if it exists and is a number
          ...(dbData?.document_id && typeof dbData.document_id === 'number' ? { document_id: dbData.document_id } : {})
        };

        const { error: logError } = await supabase.from("verification_logs").insert(logData);
        if (logError) {
          console.warn("Failed to log verification:", logError);
        }
      } catch (logError: unknown) {
        console.warn("Failed to log verification:", logError);
      }

      // Set result
      setVerificationResult({
        isValid,
        securityScore,
        ocrText,
        ocrHash,
        qrHash: qrHash ?? undefined,
        qrData,
        hashesMatch: typeof hashesMatch === "boolean" ? hashesMatch : undefined,
        certificateData: dbData || undefined,
        blockchainValid: isBlockchainValid,
        databaseValid: isDatabaseValid,
        ocrConfidence: ocrResult.confidence,
        processingMethod: ocrResult.method,
        institutionInfo,
        extractedMetadata,
        metadataValid,
        revocationStatus,
        securityChecks
      });

      toast({
        title: isValid ? "Certificate Verified" : "Certificate Invalid",
        description: isValid
          ? `Certificate authenticity verified with ${securityScore}% security score using ${ocrResult.method}.`
          : revocationStatus.isRevoked
            ? "Certificate has been revoked."
            : !isDatabaseValid
              ? "Certificate not found in official records."
              : "Certificate failed security validation.",
        variant: isValid ? "default" : "destructive",
      });

    } catch (error: any) {
      console.error("Verification error:", error);
      toast({
        variant: "destructive",
        title: "Verification Failed",
        description: error.message || "Failed to verify certificate. Please try again.",
      });
    } finally {
      setIsVerifying(false);
      setProcessingProgress(null);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSecurityScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSecurityScoreIcon = (score: number) => {
    if (score >= 90) return CheckCircle2;
    if (score >= 70) return AlertTriangle;
    return XCircle;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/30 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-foreground">Verify Certificate</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload a certificate to verify authenticity using enhanced OCR text extraction with AI fallback and QR code hash comparison.
          </p>
        </div>

        {/* Wallet Connection */}
        <div className="flex justify-center">
          <WalletConnect web3State={web3State} onConnect={setWeb3State} />
        </div>

        {/* Processing Progress */}
        {processingProgress && (
          <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    {processingProgress.stage}
                  </span>
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  {processingProgress.message}
                </p>
                {processingProgress.progress && (
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${processingProgress.progress}%` }}
                    ></div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Verification Form */}
        <Card className="shadow-lg border-0 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              Enhanced OCR + QR Certificate Verification
            </CardTitle>
            <CardDescription>
              Upload the PDF certificate to extract text using AI-enhanced OCR with intelligent fallback, scan QR code, and verify hash integrity with blockchain validation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File Upload */}
            <div className="space-y-2">
              <FileUpload
                onFileSelect={setSelectedFile}
                selectedFile={selectedFile}
              />
            </div>

            {/* Verify Button */}
            <Button
              onClick={handleVerifyCertificate}
              disabled={!selectedFile || !web3State.isConnected || isVerifying}
              size="lg"
              className="w-full"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {processingProgress?.stage || 'Verifying Certificate...'}
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Verify with Enhanced OCR + QR Scanning
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Verification Results */}
        {verificationResult && (
          <Card className={`shadow-lg border-2 ${
            verificationResult.isValid 
              ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20' 
              : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20'
          }`}>
            <CardContent className="pt-6">
              <div className="space-y-6">
                {/* Main Result with Security Score */}
                <div className="text-center space-y-4">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${
                    verificationResult.isValid 
                      ? 'bg-green-500 text-white' 
                      : 'bg-red-500 text-white'
                  }`}>
                    {verificationResult.isValid ? (
                      <ShieldCheck className="w-10 h-10" />
                    ) : (
                      <ShieldX className="w-10 h-10" />
                    )}
                  </div>
                  <div>
                    <h3 className={`text-2xl font-bold ${
                      verificationResult.isValid ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                    }`}>
                      {verificationResult.isValid ? 'Certificate Verified ✓' : 'Certificate Invalid ✗'}
                    </h3>
                    <div className="flex items-center justify-center gap-2 mt-2">
                      {React.createElement(getSecurityScoreIcon(verificationResult.securityScore), {
                        className: `w-5 h-5 ${getSecurityScoreColor(verificationResult.securityScore)}`
                      })}
                      <span className={`text-lg font-semibold ${getSecurityScoreColor(verificationResult.securityScore)}`}>
                        Security Score: {verificationResult.securityScore}%
                      </span>
                    </div>
                  </div>
                  <p className={verificationResult.isValid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                    {verificationResult.isValid 
                      ? 'This certificate is authentic. Enhanced verification completed successfully.'
                      : verificationResult.revocationStatus?.isRevoked
                        ? 'Certificate has been revoked by the issuing institution.'
                        : !verificationResult.hashesMatch && verificationResult.qrHash
                          ? 'Text content does not match QR code hash - potential tampering detected.'
                          : !verificationResult.databaseValid
                            ? 'Certificate not found in official records.'
                            : 'Certificate failed enhanced security validation.'
                    }
                  </p>
                  
                  {/* Processing Method Badge */}
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900 rounded-full text-sm text-blue-700 dark:text-blue-300">
                    {verificationResult.processingMethod === 'gemini-vision' && (
                      <>
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                        Enhanced with Gemini Vision AI ({verificationResult.ocrConfidence}% confidence)
                      </>
                    )}
                    {verificationResult.processingMethod === 'text-pdf' && (
                      <>
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        PDF Text Extraction ({verificationResult.ocrConfidence}% confidence)
                      </>
                    )}
                    {verificationResult.processingMethod === 'tesseract-ocr' && (
                      <>
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        Tesseract OCR Processing ({verificationResult.ocrConfidence}% confidence)
                      </>
                    )}
                    {verificationResult.processingMethod === 'hybrid' && (
                      <>
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        Hybrid Text + OCR ({verificationResult.ocrConfidence}% confidence)
                      </>
                    )}
                  </div>
                </div>

                {/* Confidence Alert for Low OCR Scores */}
                {verificationResult.ocrConfidence && verificationResult.ocrConfidence < 80 && (
                  <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                        <AlertTriangle className="w-5 h-5" />
                        <div>
                          <h4 className="font-semibold">Low Confidence Text Extraction</h4>
                          <p className="text-sm">OCR confidence is {verificationResult.ocrConfidence}%. The document may be low quality or have complex formatting. {verificationResult.processingMethod === 'gemini-vision' ? 'AI fallback was used for better extraction.' : 'Consider using a higher quality scan.'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Revocation Alert */}
                {verificationResult.revocationStatus?.isRevoked && (
                  <Card className="border-red-500 bg-red-50 dark:bg-red-950/20">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                        <XCircle className="w-5 h-5" />
                        <div>
                          <h4 className="font-semibold">Certificate Revoked</h4>
                          <p className="text-sm">Reason: {verificationResult.revocationStatus.reason}</p>
                          <p className="text-sm">Revoked on: {formatDate(verificationResult.revocationStatus.revocationDate)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Verification Steps */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="bg-background/50">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4" />
                        <span className="font-medium text-sm">OCR Extraction</span>
                      </div>
                      <p className="text-sm text-green-600">
                        ✓ {verificationResult.processingMethod} ({verificationResult.ocrConfidence}%)
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-background/50">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <QrCode className="w-4 h-4" />
                        <span className="font-medium text-sm">QR Code Found</span>
                      </div>
                      <p className={`text-sm ${
                        verificationResult.qrHash ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {verificationResult.qrHash ? '✓ Hash extracted' : '✗ No QR found'}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-background/50">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Hash className="w-4 h-4" />
                        <span className="font-medium text-sm">Hash Match</span>
                      </div>
                      <p className={`text-sm ${
                        verificationResult.hashesMatch ? 'text-green-600' : verificationResult.qrHash ? 'text-red-600' : 'text-yellow-600'
                      }`}>
                        {verificationResult.hashesMatch ? '✓ Hashes match' : verificationResult.qrHash ? '✗ Hashes differ' : '? No QR to compare'}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-background/50">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="w-4 h-4" />
                        <span className="font-medium text-sm">Blockchain</span>
                      </div>
                      <p className={`text-sm ${
                        verificationResult.blockchainValid ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {verificationResult.blockchainValid ? '✓ Verified' : '✗ Not found'}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Security Checks Grid */}
                {verificationResult.securityChecks && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Card className="bg-background/50">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Fingerprint className="w-4 h-4" />
                          <span className="font-medium text-sm">Content Integrity</span>
                        </div>
                        <p className={`text-sm ${
                          !verificationResult.securityChecks.contentTampered ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {!verificationResult.securityChecks.contentTampered ? 'Verified' : 'Tampered'}
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-background/50">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Building2 className="w-4 h-4" />
                          <span className="font-medium text-sm">Institution</span>
                        </div>
                        <p className={`text-sm ${
                          verificationResult.securityChecks.institutionValid ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {verificationResult.securityChecks.institutionValid ? 'Authorized' : 'Invalid'}
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-background/50">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="font-medium text-sm">Signature</span>
                        </div>
                        <p className={`text-sm ${
                          verificationResult.securityChecks.signatureValid ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {verificationResult.securityChecks.signatureValid ? 'Valid' : 'Missing'}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Hash Comparison */}
                <Card className="bg-background/50">
                  <CardHeader>
                    <CardTitle className="text-lg">Hash Comparison</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">OCR Text Hash (Generated)</p>
                      <p className="font-mono text-sm bg-muted p-2 rounded break-all">
                        {verificationResult.ocrHash}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">QR Code Hash (Extracted)</p>
                      <p className="font-mono text-sm bg-muted p-2 rounded break-all">
                        {verificationResult.qrHash || 'No QR code found'}
                      </p>
                    </div>
                    {/* Display QR Data if available */}
                    {verificationResult.qrData && Object.keys(verificationResult.qrData).length > 1 && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">QR Code Data</p>
                        <div className="bg-muted p-2 rounded text-sm space-y-1">
                          {verificationResult.qrData.certificateId && (
                            <p><span className="font-medium">Certificate ID:</span> {verificationResult.qrData.certificateId}</p>
                          )}
                          {verificationResult.qrData.institution && (
                            <p><span className="font-medium">Institution:</span> {verificationResult.qrData.institution}</p>
                          )}
                          {verificationResult.qrData.timestamp && (
                            <p><span className="font-medium">Timestamp:</span> {new Date(verificationResult.qrData.timestamp).toLocaleString()}</p>
                          )}
                          {verificationResult.qrData.verifyUrl && (
                            <p><span className="font-medium">Verify URL:</span> {verificationResult.qrData.verifyUrl}</p>
                          )}
                        </div>
                      </div>
                    )}
                    <div className={`p-2 rounded text-center text-sm font-medium ${
                      verificationResult.hashesMatch 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                        : verificationResult.qrHash
                          ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                    }`}>
                      {verificationResult.hashesMatch 
                        ? 'Hashes Match - Text Integrity Verified' 
                        : verificationResult.qrHash
                          ? 'Hashes Do Not Match - Potential Tampering'
                          : 'No QR Code Found - Hash comparison not applicable'}
                    </div>
                  </CardContent>
                </Card>

                {/* Institution Information */}
                {verificationResult.institutionInfo && (
                  <Card className="bg-background/50">
                    <CardHeader>
                      <CardTitle className="text-lg">Institution Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Institution Name</p>
                          <p className="font-medium">{verificationResult.institutionInfo.name}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Wallet Address</p>
                          <p className="font-mono text-sm break-all">{verificationResult.institutionInfo.address}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Authorization Status</p>
                          <p className={`font-medium ${
                            verificationResult.institutionInfo.isAuthorized 
                              ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {verificationResult.institutionInfo.isAuthorized ? 'Authorized' : 'Not Authorized'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Active Status</p>
                          <p className={`font-medium ${
                            verificationResult.institutionInfo.isActive 
                              ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {verificationResult.institutionInfo.isActive ? 'Active' : 'Inactive'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Certificate Details */}
                {verificationResult.certificateData && (
                  <Card className="bg-background/50">
                    <CardHeader>
                      <CardTitle className="text-lg">Certificate Information</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Student Name</p>
                          <p className="font-medium">{verificationResult.certificateData.student_name || verificationResult.certificateData.title || 'N/A'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Certificate ID</p>
                          <p className="font-medium">{verificationResult.certificateData.certificate_id || verificationResult.certificateData.document_id}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Course</p>
                          <p className="font-medium">{verificationResult.certificateData.course || verificationResult.certificateData.description || 'N/A'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Issued Date</p>
                          <p className="font-medium">{formatDate(verificationResult.certificateData.created_at)}</p>
                        </div>
                      </div>

                      {verificationResult.certificateData.blockchain_tx_hash && (
                        <div className="col-span-full">
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <a
                              href={`https://etherscan.io/tx/${verificationResult.certificateData.blockchain_tx_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              View on Blockchain <ExternalLink className="w-4 h-4 ml-2" />
                            </a>
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Extracted Metadata */}
                {verificationResult.extractedMetadata && (
                  <Card className="bg-background/50">
                    <CardHeader>
                      <CardTitle className="text-lg">Extracted Metadata</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Detected Student Name</p>
                        <p className="font-medium">{verificationResult.extractedMetadata.studentName || 'Not detected'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Detected Roll Number</p>
                        <p className="font-medium">{verificationResult.extractedMetadata.rollNumber || 'Not detected'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Detected Course</p>
                        <p className="font-medium">{verificationResult.extractedMetadata.course || 'Not detected'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Detected Institution</p>
                        <p className="font-medium">{verificationResult.extractedMetadata.institution || 'Not detected'}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* OCR Text Preview */}
                {verificationResult.ocrText && (
                  <Card className="bg-background/50">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Eye className="w-5 h-5" />
                        Extracted Text Content
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-muted p-4 rounded-lg">
                        <pre className="text-sm whitespace-pre-wrap max-h-60 overflow-y-auto font-mono">
                          {verificationResult.ocrText}
                        </pre>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Character count: {verificationResult.ocrText.length} | Method: {verificationResult.processingMethod} | Confidence: {verificationResult.ocrConfidence}%
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default VerifyCertificate;