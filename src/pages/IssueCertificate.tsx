import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileUpload } from '@/components/FileUpload';
import { WalletConnect } from '@/components/WalletConnect';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { generateSHA256Hash, hashToBytes32 } from '@/lib/crypto';
import { Web3State } from '@/lib/web3';
import { FileCheck, Loader2, ExternalLink } from 'lucide-react';
import { getAddress, isAddress } from "ethers";

interface CertificateForm {
  recipientAddress: string; // Changed from rollNumber to recipientAddress
  studentName: string;
  course: string;
  institution: string; // Added institution field
  dateIssued: string; // Added dateIssued field
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
    dateIssued: new Date().toISOString().split('T')[0], // Default to today
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
    if (!selectedFile) return 'Please upload a certificate file';
    if (!form.studentName.trim()) return 'Student name is required';
    if (!form.recipientAddress.trim()) return 'Recipient address is required';
    if (!form.course.trim()) return 'Course name is required';
    if (!form.institution.trim()) return 'Institution name is required';
    if (!form.dateIssued) return 'Date issued is required';
    if (!web3State.isConnected) return 'Please connect your wallet';

    // Validate Ethereum address
    if (!isAddress(form.recipientAddress)) {
      return 'Invalid recipient address format';
    }

    // Validate date
    const dateTimestamp = new Date(form.dateIssued).getTime();
    if (isNaN(dateTimestamp)) {
      return 'Invalid date format';
    }

    return null;
  };

  const isFormValid = () => {
    return validateForm() === null;
  };

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
      // Normalize addresses
      const normalizedIssuerAddress = getAddress(web3State.account);
      const normalizedRecipientAddress = getAddress(form.recipientAddress);

      // Convert date to Unix timestamp (seconds)
      const dateTimestamp = Math.floor(new Date(form.dateIssued).getTime() / 1000);

      console.log('Issuing certificate with parameters:', {
        recipient: normalizedRecipientAddress,
        name: form.studentName,
        course: form.course,
        institution: form.institution,
        dateIssued: dateTimestamp
      });

      // Issue certificate on blockchain with correct parameters
      const tx = await web3State.contract.issueCertificate(
        normalizedRecipientAddress,  // _recipient (address)
        form.studentName,           // _name (string)
        form.course,               // _course (string)
        form.institution,          // _institution (string)
        dateTimestamp              // _dateIssued (uint256)
      );
      
      toast({
        title: "Transaction Submitted",
        description: "Waiting for blockchain confirmation...",
      });

      const receipt = await tx.wait();
      console.log('Transaction receipt:', receipt);

      // Extract certificate ID from the event logs
      let blockchainCertificateId = 'Unknown';
      try {
        const certificateIssuedEvent = receipt.logs?.find((log: any) => {
          try {
            const parsedLog = web3State.contract!.interface.parseLog(log);
            return parsedLog?.name === 'CertificateIssued';
          } catch {
            return false;
          }
        });

        if (certificateIssuedEvent) {
          const parsedLog = web3State.contract.interface.parseLog(certificateIssuedEvent);
          blockchainCertificateId = parsedLog?.args?.certificateId?.toString() || 'Unknown';
          console.log('Certificate ID from blockchain:', blockchainCertificateId);
        }
      } catch (eventError) {
        console.error('Error parsing event logs:', eventError);
      }

      // Generate certificate hash for database storage
      const certificateHash = await generateSHA256Hash(selectedFile);

      // Save to database
      const { error } = await supabase
        .from('documents')
        .insert({
          title: `${form.course} - ${form.studentName}`,
          description: form.description || `Certificate for ${form.studentName} - ${form.course} from ${form.institution}`,
          file_path: selectedFile.name,
          file_size: selectedFile.size,
          file_type: selectedFile.type,
          document_hash: certificateHash,
          document_id: blockchainCertificateId !== 'Unknown' ? parseInt(blockchainCertificateId) : parseInt(form.certificateId) || 0,
          owner_address: normalizedRecipientAddress, // Owner is the recipient, not the issuer
          blockchain_tx_hash: receipt.transactionHash,
          is_public: true,
          required_signatures: 1,
          current_signatures: 1,
          is_completed: true
        });

      if (error) {
        console.error('Database error:', error);
        toast({
          variant: "destructive",
          title: "Database Error",
          description: "Certificate issued on blockchain but failed to save metadata.",
        });
      } else {
        setIssuedTxHash(receipt.transactionHash);
        setIssuedCertificateId(blockchainCertificateId);
        
        toast({
          title: "Certificate Issued Successfully!",
          description: `Certificate ID: ${blockchainCertificateId}`,
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
      console.error('Issue certificate error:', error);
      
      let errorMessage = "Failed to issue certificate. Please try again.";
      
      // Handle common errors
      if (error.code === 4001) {
        errorMessage = "Transaction rejected by user";
      } else if (error.code === 'INSUFFICIENT_FUNDS') {
        errorMessage = "Insufficient funds to complete the transaction";
      } else if (error.message?.includes('execution reverted')) {
        errorMessage = "Contract execution failed. Please check your inputs and try again.";
      } else if (error.message?.includes('user rejected transaction')) {
        errorMessage = "Transaction was rejected";
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

  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
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

        {/* Wallet Connection */}
        <div className="flex justify-center">
          <WalletConnect web3State={web3State} onConnect={setWeb3State} />
        </div>

        {/* Main Form */}
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
            {/* File Upload */}
            <div className="space-y-2">
              <Label htmlFor="certificate-file">Certificate Document (PDF)</Label>
              <FileUpload
                onFileSelect={setSelectedFile}
                selectedFile={selectedFile}
              />
            </div>

            {/* Form Fields */}
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
                <Label htmlFor="recipient-address">Recipient Address *</Label>
                <Input
                  id="recipient-address"
                  placeholder="0x..."
                  value={form.recipientAddress}
                  onChange={(e) => handleFormChange('recipientAddress', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Ethereum address of the certificate recipient
                </p>
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
                  max={getTodayDate()}
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
                <p className="text-xs text-muted-foreground">
                  Optional: Your internal reference ID (blockchain will generate its own ID)
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Additional Notes (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Any additional information about the certificate"
                value={form.description}
                onChange={(e) => handleFormChange('description', e.target.value)}
                rows={3}
              />
            </div>

            {/* Issue Button */}
            <Button
              onClick={handleIssueCertificate}
              disabled={!isFormValid() || isIssuing}
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
          </CardContent>
        </Card>

        {/* Success Message */}
        {issuedTxHash && (
          <Card className="border-success bg-success-light">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-success text-success-foreground rounded-full flex items-center justify-center mx-auto">
                  <FileCheck className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-semibold text-success">Certificate Issued Successfully!</h3>
                <p className="text-success/80">
                  Your certificate has been permanently registered on the Ethereum blockchain.
                </p>
                {issuedCertificateId && (
                  <p className="text-sm text-success/70">
                    Certificate ID: <span className="font-mono">{issuedCertificateId}</span>
                  </p>
                )}
                <Button
                  variant="outline"
                  className="border-success text-success hover:bg-success hover:text-success-foreground"
                  asChild
                >
                  <a
                    href={`https://sepolia.etherscan.io/tx/${issuedTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
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