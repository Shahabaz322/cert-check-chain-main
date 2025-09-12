-- Create issued_certificates table
CREATE TABLE public.issued_certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_name VARCHAR NOT NULL,
  roll_number VARCHAR NOT NULL,
  course VARCHAR NOT NULL,
  certificate_id BIGINT NOT NULL UNIQUE,
  certificate_hash VARCHAR NOT NULL UNIQUE,
  institution_wallet VARCHAR NOT NULL,
  blockchain_tx_hash VARCHAR,
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create verification_logs table
CREATE TABLE public.verification_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  certificate_hash VARCHAR NOT NULL,
  verifier_wallet VARCHAR,
  result BOOLEAN NOT NULL,
  certificate_data JSONB,
  blockchain_tx_hash VARCHAR,
  verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.issued_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is a public verification system)
CREATE POLICY "Anyone can view issued certificates" 
ON public.issued_certificates 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert issued certificates" 
ON public.issued_certificates 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can view verification logs" 
ON public.verification_logs 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert verification logs" 
ON public.verification_logs 
FOR INSERT 
WITH CHECK (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_issued_certificates_updated_at
BEFORE UPDATE ON public.issued_certificates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_issued_certificates_hash ON public.issued_certificates(certificate_hash);
CREATE INDEX idx_issued_certificates_id ON public.issued_certificates(certificate_id);
CREATE INDEX idx_verification_logs_hash ON public.verification_logs(certificate_hash);
CREATE INDEX idx_verification_logs_wallet ON public.verification_logs(verifier_wallet);