import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileUpload } from '@/components/FileUpload';
import { WalletConnect } from '@/components/WalletConnect';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Web3State } from '@/lib/web3';
import { Shield, ShieldCheck, ShieldX, Loader2, ExternalLink, Calendar, User, GraduationCap, Hash, FileText, QrCode, Eye } from 'lucide-react';

// Real library imports
import Tesseract from 'tesseract.js';
import QrScanner from 'qr-scanner';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

// PDF.js worker configuration
GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.worker.min.mjs';

interface VerificationResult {
  isValid: boolean;
  ocrText?: string;
  ocrHash?: string;
  qrHash?: string;
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
}

interface ProcessingProgress {
  stage: string;
  message: string;
}

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

  // Extract text from PDF using OCR (same as issuer component)
  const extractTextFromPDF = async (file: File): Promise<{ extractedText: string; confidence: number; method: string }> => {
    try {
      setProcessingProgress({ stage: 'Loading PDF', message: 'Reading PDF file...' });

      if (file.size > 50 * 1024 * 1024) {
        throw new Error('File size too large. Please use a PDF smaller than 50MB.');
      }

      const arrayBuffer = await file.arrayBuffer();
      setProcessingProgress({ stage: 'Parsing PDF', message: 'Analyzing PDF structure...' });

      let pdf;
      try {
        pdf = await getDocument({ data: arrayBuffer }).promise;
      } catch (pdfError: any) {
        console.error('PDF loading error:', pdfError);
        try {
          pdf = await getDocument({ data: arrayBuffer }).promise;
        } catch {
          throw new Error('Unable to load PDF. Please ensure the file is not corrupted.');
        }
      }

      let extractedText = '';
      let method = 'text-pdf';
      let confidence = 0;
      const pageCount = pdf.numPages;

      setProcessingProgress({ stage: 'Extracting Text', message: `Processing ${pageCount} pages...` });

      for (let i = 1; i <= pageCount; i++) {
        try {
          setProcessingProgress({
            stage: 'Extracting Text',
            message: `Processing page ${i}/${pageCount}...`
          });

          const page = await pdf.getPage(i);

          // Try text extraction first
          let pageText = '';
          try {
            const textContent = await page.getTextContent();
            pageText = textContent.items.map((item: any) => item.str).join(' ').trim();
          } catch (textError: any) {
            console.error(`Text extraction failed on page ${i}:`, textError);
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
                message: `OCR processing page ${i}/${pageCount}...`
              });

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
                      setProcessingProgress({
                        stage: 'OCR Processing',
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
              }

            } catch (ocrError: any) {
              console.error(`OCR failed on page ${i}:`, ocrError);
            }
          }
        } catch (pageError: any) {
          console.error(`Page ${i} processing failed:`, pageError);
        }
      }

      if (extractedText.trim().length < 20) {
        throw new Error('Insufficient text extracted from PDF. Please ensure the PDF contains readable text.');
      }

      return { extractedText: extractedText.trim(), confidence, method };

    } catch (error: any) {
      throw new Error(`Text extraction failed: ${error.message}`);
    }
  };

  // Extract QR codes from PDF
  const extractQRFromPDF = async (file: File): Promise<string | null> => {
    try {
      setProcessingProgress({ stage: 'QR Scanning', message: 'Scanning for QR codes...' });

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await getDocument({ data: arrayBuffer }).promise;
      const pageCount = pdf.numPages;

      for (let i = 1; i <= pageCount; i++) {
        try {
          setProcessingProgress({
            stage: 'QR Scanning',
            message: `Scanning page ${i}/${pageCount} for QR codes...`
          });

          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');

          if (!context) continue;

          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({ canvasContext: context, viewport, canvas }).promise;

          try {
            const result = await QrScanner.scanImage(canvas);
            if (result && typeof result === 'string') {
              console.log(`Found QR code on page ${i}:`, result);
              return result;
            }
          } catch (qrError) {
            console.log(`No QR code found on page ${i}`);
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
      toast({ title: "Verification Started", description: "Processing certificate with OCR and QR scanning..." });

      // Step 1: Extract text using OCR
      const ocrResult = await extractTextFromPDF(selectedFile);
      const ocrText = ocrResult.extractedText;
      
      // Step 2: Generate hash from OCR text
      setProcessingProgress({ stage: 'Hashing', message: 'Generating hash from extracted text...' });
      const ocrHash = await generateTextHash(ocrText);

      // Step 3: Extract QR code
      const qrHash = await extractQRFromPDF(selectedFile);

      // Step 4: Compare hashes
      const hashesMatch = qrHash && ocrHash === qrHash.toLowerCase();

      setProcessingProgress({ stage: 'Database Check', message: 'Checking database records...' });

      // Step 5: Database verification using the QR hash (if found) or OCR hash
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

      // Step 6: Blockchain verification
      setProcessingProgress({ stage: 'Blockchain Check', message: 'Verifying on blockchain...' });
      const certificateId = dbData?.certificate_id;
      let isBlockchainValid = false;

      if (certificateId) {
        try {
          isBlockchainValid = await web3State.contract.verifyCertificate(certificateId);
        } catch (err) {
          console.error("Blockchain verification failed:", err);
        }
      }

      // Step 7: Final validation - certificate is valid if:
      // 1. QR hash matches OCR hash (text integrity)
      // 2. Hash is found in database 
      // 3. Certificate exists on blockchain
      const isValid = hashesMatch && isDatabaseValid && isBlockchainValid;

      // Log verification
      try {
        const logData: any = {
          document_hash: searchHash.startsWith("0x") ? searchHash : `0x${searchHash}`,
          verifier_address: web3State.account,
          verification_type: "ocr_qr_verification",
          is_valid: isValid,
          details: {
            ocr_hash: ocrHash,
            qr_hash: qrHash,
            hashes_match: hashesMatch,
            blockchain_valid: isBlockchainValid,
            database_valid: isDatabaseValid,
            ocr_confidence: ocrResult.confidence,
            processing_method: ocrResult.method,
            verified_at: new Date().toISOString(),
          },
        };

        if (dbData && dbData.document_id) {
          logData.document_id = dbData.document_id;
        }

        await supabase.from("verification_logs").insert(logData);
      } catch (logError: unknown) {
        console.warn("Failed to log verification:", logError);
      }

      // Set result
      setVerificationResult({
        isValid: !!isValid,
        ocrText,
        ocrHash,
        qrHash: qrHash ?? undefined,
        hashesMatch: typeof hashesMatch === "boolean" ? hashesMatch : undefined,
        certificateData: dbData || undefined,
        blockchainValid: isBlockchainValid,
        databaseValid: isDatabaseValid,
        ocrConfidence: ocrResult.confidence,
        processingMethod: ocrResult.method,
      });

      toast({
        title: isValid ? "Certificate Verified" : "Certificate Invalid",
        description: isValid
          ? "Certificate authenticity verified through OCR and QR hash matching."
          : hashesMatch 
            ? "Hashes match but certificate not found in records."
            : "Text content doesn't match QR code hash - potential tampering detected.",
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/30 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-foreground">Verify Certificate</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload a certificate to verify authenticity using OCR text extraction and QR code hash comparison.
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
              </div>
            </CardContent>
          </Card>
        )}

        {/* Verification Form */}
        <Card className="shadow-lg border-0 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              OCR + QR Certificate Verification
            </CardTitle>
            <CardDescription>
              Upload the PDF certificate to extract text, scan QR code, and verify hash integrity
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
                  Verify with OCR + QR Scanning
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
                {/* Main Result */}
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
                  <h3 className={`text-2xl font-bold ${
                    verificationResult.isValid ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                  }`}>
                    {verificationResult.isValid ? 'Certificate Verified ✓' : 'Certificate Invalid ✗'}
                  </h3>
                  <p className={verificationResult.isValid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                    {verificationResult.isValid 
                      ? 'This certificate is authentic. OCR text matches QR hash and is verified on blockchain.'
                      : !verificationResult.hashesMatch 
                        ? 'Text content does not match QR code hash - potential tampering detected.'
                        : 'Hashes match but certificate not found in official records.'
                    }
                  </p>
                </div>

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
                        verificationResult.hashesMatch ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {verificationResult.hashesMatch ? '✓ Hashes match' : '✗ Hashes differ'}
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
                    <div className={`p-2 rounded text-center text-sm font-medium ${
                      verificationResult.hashesMatch 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                    }`}>
                      {verificationResult.hashesMatch ? 'Hashes Match - Text Integrity Verified' : 'Hashes Do Not Match - Potential Tampering'}
                    </div>
                  </CardContent>
                </Card>

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
                              href={`https://ganache.etherscan.io/tx/${verificationResult.certificateData.blockchain_tx_hash}`}
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
                        Character count: {verificationResult.ocrText.length}
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