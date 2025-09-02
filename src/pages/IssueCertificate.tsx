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
import { getAddress } from "ethers";

interface CertificateForm {
  studentName: string;
  rollNumber: string;
  course: string;
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
    studentName: '',
    rollNumber: '',
    course: '',
    certificateId: '',
    description: ''
  });
  const [isIssuing, setIsIssuing] = useState(false);
  const [issuedTxHash, setIssuedTxHash] = useState<string | null>(null);

  const { toast } = useToast();

  const handleFormChange = (field: keyof CertificateForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const isFormValid = () => {
    return selectedFile && 
           form.studentName && 
           form.rollNumber && 
           form.course && 
           form.certificateId &&
           web3State.isConnected;
  };

  const handleIssueCertificate = async () => {
    if (!isFormValid() || !selectedFile || !web3State.contract || !web3State.account) return;

    setIsIssuing(true);
    try {
      // Normalize wallet address
      const normalizedAddress = getAddress(web3State.account);

      // Generate certificate hash
      const certificateHash = await generateSHA256Hash(selectedFile);
      const bytes32Hash = hashToBytes32(certificateHash);

      // Issue certificate on blockchain
      const tx = await web3State.contract.issueCertificate(bytes32Hash, normalizedAddress);
      
      toast({
        title: "Transaction Submitted",
        description: "Waiting for blockchain confirmation...",
      });

      const receipt = await tx.wait();

      // Save to database
      const { error } = await supabase
        .from('documents')
        .insert({
          title: `${form.course} - ${form.studentName}`,
          description: form.description || `Certificate for ${form.studentName} (${form.rollNumber})`,
          file_path: selectedFile.name,
          file_size: selectedFile.size,
          file_type: selectedFile.type,
          document_hash: certificateHash,
          document_id: parseInt(form.certificateId) || 0,
          owner_address: normalizedAddress,
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
        toast({
          title: "Certificate Issued Successfully!",
          description: "Certificate has been registered on blockchain and database.",
        });
        
        // Reset form
        setForm({
          studentName: '',
          rollNumber: '',
          course: '',
          certificateId: '',
          description: ''
        });
        setSelectedFile(null);
      }
    } catch (error: any) {
      console.error('Issue certificate error:', error);
      toast({
        variant: "destructive",
        title: "Certificate Issuance Failed",
        description: error.message || "Failed to issue certificate. Please try again.",
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
                <Label htmlFor="certificate-id">Certificate ID *</Label>
                <Input
                  id="certificate-id"
                  placeholder="Unique certificate identifier"
                  value={form.certificateId}
                  onChange={(e) => handleFormChange('certificateId', e.target.value)}
                />
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
