import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileUpload } from '@/components/FileUpload';
import { WalletConnect } from '@/components/WalletConnect';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client.ts';
import { generateSHA256Hash, hashToBytes32 } from '@/lib/crypto';
import { Web3State } from '@/lib/web3';
import { FileCheck, Loader2, ExternalLink } from 'lucide-react';
import { getAddress, isAddress } from "ethers";

interface CertificateForm {
  recipientAddress: string;
  studentName: string;
  course: string;
  institution: string;
  dateIssued: string;
  certificateId: string;
  description?: string;
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
    recipientAddress: '',
    studentName: '',
    course: '',
    institution: '',
    dateIssued: new Date().toISOString().split('T')[0], // default today
    certificateId: '',
    description: ''
  });

  const [isIssuing, setIsIssuing] = useState(false);
  const [issuedTxHash, setIssuedTxHash] = useState<string | null>(null);
  const [issuedCertificateId, setIssuedCertificateId] = useState<string | null>(null);

  const { toast } = useToast();

  const handleFormChange = (field: keyof CertificateForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = (): string | null => {
    if (!selectedFile) return "Please upload a certificate file";
    if (!form.studentName.trim()) return "Student name is required";
    if (!form.recipientAddress.trim()) return "Recipient address is required";
    if (!form.course.trim()) return "Course name is required";
    if (!form.institution.trim()) return "Institution name is required";
    if (!form.dateIssued) return "Date issued is required";
    if (!isAddress(form.recipientAddress)) return "Invalid Ethereum address";
    if (!web3State.isConnected) return "Please connect your wallet";

    const dateTimestamp = new Date(form.dateIssued).getTime();
    if (isNaN(dateTimestamp)) return "Invalid date";

    return null;
  };

  const isFormValid = () => validateForm() === null;

  const handleIssueCertificate = async () => {
    const validationError = validateForm();
    if (validationError) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: validationError,
      });
      return;
    }

    if (!selectedFile || !web3State.contract || !web3State.account) return;

    setIsIssuing(true);
    try {
      const normalizedRecipientAddress = getAddress(form.recipientAddress);
      const dateTimestamp = Math.floor(new Date(form.dateIssued).getTime() / 1000);

      // Generate pure SHA256 hash for the file
      const documentHash = await generateSHA256Hash(selectedFile);
      if (!documentHash) throw new Error("Failed to generate file hash");
      
      // Validate that we have a proper SHA256 hash (64 hex characters)
      if (!/^[a-fA-F0-9]{64}$/.test(documentHash)) {
        throw new Error("Invalid SHA256 hash format generated");
      }

      // Create a unique certificate hash for storage (different from document hash)
      const certificateHash = `${documentHash}-${Date.now()}-${form.studentName.replace(/\s+/g, '')}`;

      // Issue certificate on blockchain (5 parameters only)
      const tx = await web3State.contract.issueCertificate(
        normalizedRecipientAddress,
        form.studentName,
        form.course,
        form.institution,
        dateTimestamp
      );

      toast({
        title: "Transaction Submitted",
        description: "Waiting for blockchain confirmation...",
      });

      const receipt = await tx.wait();

      // Extract certificate ID from event logs
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

        if (certificateEvent) {
          const parsedLog = web3State.contract.interface.parseLog(certificateEvent);
          if (parsedLog && parsedLog.args && parsedLog.args.certificateId) {
            blockchainCertificateId = parsedLog.args.certificateId.toString();
          }
        }
      } catch (eventError) {
        console.error("Error parsing event logs:", eventError);
      }

      // Generate unique certificate ID to avoid conflicts
      const certificateIdToStore = blockchainCertificateId !== "Unknown" 
        ? blockchainCertificateId 
        : `${Date.now()}-${crypto.randomUUID()}`;

      // Save to database with proper field mapping
      const { error: insertError } = await supabase
        .from("issued_certificates")
        .insert({
          student_name: form.studentName,
          roll_number: form.certificateId || "N/A", // Roll number or N/A if not provided
          course: form.course,
          certificate_id: certificateIdToStore, // Use unique ID
          certificate_hash: certificateHash, // This can be the composite hash
          document_hash: documentHash, // This should be the pure SHA256 hash
          institution_wallet: web3State.account, // Institution's wallet address
          blockchain_tx_hash: receipt.transactionHash,
          issued_at: new Date(form.dateIssued).toISOString()
          // created_at and updated_at are handled automatically
        });

      if (insertError) {
        console.error("Database insert error:", insertError);
        toast({
          variant: "destructive",
          title: "Database Error",
          description: "Certificate issued on blockchain but failed to save to database.",
        });
      } else {
        // Try to log the verification (optional - don't fail if this fails)
        try {
          // Build details object with the composite hash included
          const details = {
            certificate_id: certificateIdToStore,
            student_name: form.studentName,
            course: form.course,
            institution: form.institution,
            blockchain_tx_hash: receipt.transactionHash,
            issued_at: new Date().toISOString(),
            composite_hash: certificateHash, // Store composite hash in details if needed
            file_name: selectedFile.name,
            file_size: selectedFile.size,
          };

          // Ensure hash has 0x prefix
          const normalizedDocHash = documentHash.startsWith("0x")
            ? documentHash
            : "0x" + documentHash;    

          // Insert into verification_logs using only the pure SHA256 hash
          const { error: logError } = await supabase
            .from("verification_logs")
            .insert({
              document_hash: normalizedDocHash, // Must be pure SHA256 hash (64 hex chars)
              verifier_address: web3State.account || "unknown",
              verification_type: "certificate_issuance",
              is_valid: true,
              details: details,
              verified_at: new Date().toISOString(),
            });

          if (logError) {
            console.warn("Verification log insert failed:", logError);
            console.warn("Document hash used:", documentHash);
            console.warn("Hash length:", documentHash.length);
            console.warn("Hash format valid (0x + 64 hex):", /^0x[a-fA-F0-9]{64}$/.test(documentHash));
          } else {
            console.log("Verification log inserted successfully");
          }
        } catch (err) {
          console.error("Unexpected error inserting verification log:", err);
        }

        setIssuedTxHash(receipt.transactionHash);
        setIssuedCertificateId(certificateIdToStore);
        
        toast({
          title: "Certificate Issued Successfully!",
          description: `Certificate ID: ${certificateIdToStore}`,
        });

        // Reset form
        setForm({
          recipientAddress: '',
          studentName: '',
          course: '',
          institution: '',
          dateIssued: new Date().toISOString().split('T')[0],
          certificateId: '',
          description: ''
        });
        setSelectedFile(null);
      }

    } catch (error: any) {
      console.error("Issue certificate error:", error);
      
      let errorMessage = "Failed to issue certificate. Please try again.";
      
      if (error.message?.includes("no matching fragment")) {
        errorMessage = "Contract method signature mismatch. Please check your smart contract.";
      } else if (error.code === 4001) {
        errorMessage = "Transaction rejected by user.";
      } else if (error.message?.includes("insufficient funds")) {
        errorMessage = "Insufficient funds for gas fees.";
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/30 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-foreground">Issue Certificate</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload and register your institutional certificate on the blockchain for permanent authenticity verification.
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
              Fill in the certificate information and upload the PDF document
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="certificate-file">Certificate Document (PDF)</Label>
              <FileUpload onFileSelect={setSelectedFile} selectedFile={selectedFile} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="student-name">Student Name *</Label>
                <Input id="student-name" placeholder="Enter full name" value={form.studentName} onChange={(e) => handleFormChange('studentName', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recipient-address">Recipient Address *</Label>
                <Input id="recipient-address" placeholder="0x..." value={form.recipientAddress} onChange={(e) => handleFormChange('recipientAddress', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="course">Course/Program *</Label>
                <Input id="course" placeholder="e.g., Bachelor of Computer Science" value={form.course} onChange={(e) => handleFormChange('course', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="institution">Institution *</Label>
                <Input id="institution" placeholder="e.g., Tech University" value={form.institution} onChange={(e) => handleFormChange('institution', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date-issued">Date Issued *</Label>
                <Input id="date-issued" type="date" max={new Date().toISOString().split('T')[0]} value={form.dateIssued} onChange={(e) => handleFormChange('dateIssued', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="certificate-id">Certificate ID (Reference)</Label>
                <Input id="certificate-id" placeholder="Optional reference ID" value={form.certificateId} onChange={(e) => handleFormChange('certificateId', e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Additional Notes (Optional)</Label>
              <Textarea id="description" placeholder="Any additional information" value={form.description} onChange={(e) => handleFormChange('description', e.target.value)} rows={3} />
            </div>

            <Button onClick={handleIssueCertificate} disabled={!isFormValid() || isIssuing} size="lg" className="w-full">
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
          </CardContent>
        </Card>

        {issuedTxHash && (
          <Card className="border-success bg-success-light">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-success text-success-foreground rounded-full flex items-center justify-center mx-auto">
                  <FileCheck className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-semibold text-success">Certificate Issued Successfully!</h3>
                <p className="text-success/80">
                  Transaction Hash: {issuedTxHash} <br />
                  Certificate ID: {issuedCertificateId}
                </p>
                <Button variant="outline" className="border-success text-success hover:bg-success hover:text-success-foreground" asChild>
                  <a href={`https://sepolia.etherscan.io/tx/${issuedTxHash}`} target="_blank" rel="noopener noreferrer">
                    View Transaction <ExternalLink className="w-4 h-4 ml-2" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default IssueCertificate;