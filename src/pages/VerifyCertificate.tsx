import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileUpload } from '@/components/FileUpload';
import { WalletConnect } from '@/components/WalletConnect';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { generateSHA256Hash, hashToBytes32 } from '@/lib/crypto';
import { Web3State } from '@/lib/web3';
import { Shield, ShieldCheck, ShieldX, Loader2, ExternalLink, Calendar, User, GraduationCap, Hash } from 'lucide-react';

interface VerificationResult {
  isValid: boolean;
  certificateData?: {
    // Fields from issued_certificates table
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
    updated_at?: string | null;
    document_hash?: string | null;
    
    // Fields from documents table (fallback)
    title?: string | null;
    description?: string | null;
    document_id?: number;
    owner_address?: string | null;
    file_path?: string | null;
    is_completed?: boolean | null;
    current_signatures?: number;
    expires_at?: string | null;
    max_signatures?: number;
  };
  blockchainValid?: boolean;
  databaseValid?: boolean;
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

  const { toast } = useToast();

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
    // Generate hash
    const certificateHash = await generateSHA256Hash(selectedFile);
    const hashVariants = {
      noPrefix: certificateHash.startsWith("0x") ? certificateHash.slice(2) : certificateHash,
      withPrefix: certificateHash.startsWith("0x") ? certificateHash : `0x${certificateHash}`,
    };
    console.log("🔍 Generated file hash (normalized):", hashVariants.noPrefix);

    // Database verification
    let dbData: any = null;
    let isDatabaseValid = false;

    const searchCombinations = [
      { table: "issued_certificates", field: "certificate_hash", value: hashVariants.noPrefix },
      { table: "issued_certificates", field: "certificate_hash", value: hashVariants.withPrefix },
      { table: "issued_certificates", field: "document_hash", value: hashVariants.noPrefix },
      { table: "issued_certificates", field: "document_hash", value: hashVariants.withPrefix },
      { table: "documents", field: "document_hash", value: hashVariants.noPrefix },
      { table: "documents", field: "document_hash", value: hashVariants.withPrefix },
    ];

    for (const combo of searchCombinations) {
      console.log(`🔍 Querying ${combo.table}.${combo.field} = ${combo.value}`);

      const { data, error } = await supabase
        .from(combo.table)
        .select("*")
        .eq(combo.field, combo.value);

      if (error) {
        console.warn(`❌ Error querying ${combo.table}.${combo.field}:`, error.message);
        continue;
      }

      if (data && data.length > 0) {
        if (data.length > 1) {
          console.warn(`⚠️ Multiple (${data.length}) matches found in ${combo.table}.${combo.field}`);
          toast({
            variant: "destructive",
            title: "Duplicate Hash Detected",
            description: `This hash exists in ${data.length} records of ${combo.table}. Using the first match.`,
          });
        }

        dbData = data[0];
        isDatabaseValid = true;
        console.log(`✅ Using record from ${combo.table}.${combo.field}`, dbData);
        break;
      } else {
        console.log(`❌ No match for ${combo.table}.${combo.field} = ${combo.value}`);
      }
    }

    // Blockchain verification
    const certificateId = dbData?.certificate_id;
    let isBlockchainValid = false;

    if (certificateId) {
      try {
        isBlockchainValid = await web3State.contract.verifyCertificate(certificateId);
      } catch (err) {
        console.error("Blockchain verification failed:", err);
      }
    } else {
      console.warn("⚠️ No certificate ID found, skipping blockchain verification.");
    }

    const isValid = isBlockchainValid && isDatabaseValid;

    // Log verification
    try {
      const rawHash =
        dbData?.certificate_hash ||
        dbData?.document_hash ||
        certificateHash ||
        null;

      const formattedHash =
        rawHash && !rawHash.startsWith("0x") ? `0x${rawHash}` : rawHash;

      const logData: any = {
        document_hash: formattedHash,
        verifier_address: web3State.account,
        verification_type: "certificate_authenticity",
        is_valid: isValid,
        details: {
          blockchain_valid: isBlockchainValid,
          database_valid: isDatabaseValid,
          certificate_info: dbData
            ? {
                document_id: dbData.document_id,
                title: dbData.title,
                created_at: dbData.created_at,
              }
            : null,
          verified_at: new Date().toISOString(),
        },
      };

      if (dbData && dbData.document_id) {
        logData.document_id = dbData.document_id;
      }

      await supabase.from("verification_logs").insert(logData);
      console.log("✅ Verification logged successfully");
    } catch (logError: unknown) {
      console.warn("⚠️ Failed to log verification:", logError);
    }

    // Save result
    setVerificationResult({
      isValid,
      certificateData: dbData || undefined,
      blockchainValid: isBlockchainValid,
      databaseValid: isDatabaseValid,
    });

    toast({
      title: isValid ? "Verification Complete" : "Verification Failed",
      description: isValid
        ? "Certificate authenticity verified successfully."
        : "Certificate could not be verified. It may be invalid or forged.",
      variant: isValid ? "default" : "destructive",
    });
  } catch (error: any) {
    console.error("Verification error:", error);
    toast({
      variant: "destructive",
      title: "Verification Failed",
      description:
        error.message || "Failed to verify certificate. Please try again.",
    });
  } finally {
    setIsVerifying(false);
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
            Upload a certificate to verify its authenticity against blockchain records and our database.
          </p>
        </div>

        {/* Wallet Connection */}
        <div className="flex justify-center">
          <WalletConnect web3State={web3State} onConnect={setWeb3State} />
        </div>

        {/* Verification Form */}
        <Card className="shadow-lg border-0 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              Certificate Verification
            </CardTitle>
            <CardDescription>
              Upload the PDF certificate to check its authenticity
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
                  Verifying Certificate...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Verify Certificate Authenticity
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Verification Results */}
        {verificationResult && (
          <Card className={`shadow-lg border-2 ${
            verificationResult.isValid 
              ? 'border-success bg-success-light' 
              : 'border-destructive bg-destructive-light'
          }`}>
            <CardContent className="pt-6">
              <div className="space-y-6">
                {/* Main Result */}
                <div className="text-center space-y-4">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${
                    verificationResult.isValid 
                      ? 'bg-success text-success-foreground' 
                      : 'bg-destructive text-destructive-foreground'
                  }`}>
                    {verificationResult.isValid ? (
                      <ShieldCheck className="w-10 h-10" />
                    ) : (
                      <ShieldX className="w-10 h-10" />
                    )}
                  </div>
                  <h3 className={`text-2xl font-bold ${
                    verificationResult.isValid ? 'text-success' : 'text-destructive'
                  }`}>
                    {verificationResult.isValid ? 'Certificate Verified ✓' : 'Certificate Invalid ✗'}
                  </h3>
                  <p className={verificationResult.isValid ? 'text-success/80' : 'text-destructive/80'}>
                    {verificationResult.isValid 
                      ? 'This certificate is authentic and has been verified on the blockchain.'
                      : 'This certificate could not be verified. It may be forged or not registered.'
                    }
                  </p>
                </div>

                {/* Verification Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="bg-background/50">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Hash className="w-4 h-4" />
                        <span className="font-medium">Blockchain Verification</span>
                      </div>
                      <p className={`text-sm ${
                        verificationResult.blockchainValid ? 'text-success' : 'text-destructive'
                      }`}>
                        {verificationResult.blockchainValid ? '✓ Verified on blockchain' : '✗ Not found on blockchain'}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-background/50">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="w-4 h-4" />
                        <span className="font-medium">Database Verification</span>
                      </div>
                      <p className={`text-sm ${
                        verificationResult.databaseValid ? 'text-success' : 'text-destructive'
                      }`}>
                        {verificationResult.databaseValid ? '✓ Found in records' : '✗ No record found'}
                      </p>
                    </CardContent>
                  </Card>
                </div>

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

                      <div className="col-span-full">
                        <p className="text-sm text-muted-foreground mb-1">Document Hash</p>
                        <p className="font-mono text-sm bg-muted p-2 rounded break-all">
                          {verificationResult.certificateData.document_hash || verificationResult.certificateData.certificate_hash}
                        </p>
                      </div>

                      {verificationResult.certificateData.blockchain_tx_hash && (
                        <div className="col-span-full">
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <a
                              href={`https://sepolia.etherscan.io/tx/${verificationResult.certificateData.blockchain_tx_hash}`}
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
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default VerifyCertificate;