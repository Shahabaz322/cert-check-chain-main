# Digi-Pramaan

**Digi-Pramaan** is a professional web application for **verifying the authenticity of certificates** using blockchain technology and a database backend. It provides a secure and reliable way to validate certificates issued by institutions and ensures that certificates have not been tampered with.

---

## Features

- **Certificate Upload:** Users can upload PDF certificates for verification.
- **Blockchain Verification:** Confirms that the certificate has been registered on the blockchain using its unique ID.
- **Database Verification:** Checks the certificate record in Supabase database (`issued_certificates` or `documents` tables).
- **Verification Logging:** All verification attempts are logged for auditing purposes.
- **User-Friendly Interface:** Modern and interactive UI using React and TailwindCSS.
- **Wallet Integration:** Supports MetaMask and WalletConnect for blockchain interactions.

---

## Tech Stack

- **Frontend:** React, TypeScript, TailwindCSS, Lucide Icons
- **Blockchain:** Ethereum (Sepolia Testnet), Web3.js
- **Database:** Supabase (PostgreSQL)
- **File Hashing:** SHA-256 for document integrity verification
- **Authentication & Wallet:** MetaMask, WalletConnect

---

## Installation

1. **Clone the repository:**

```bash
git clone https://github.com/your-username/cert-check-chain.git
cd cert-check-chain
Install dependencies:

bash
Copy code
npm install
Set up environment variables:

Create a .env.local file in the root directory:

env
Copy code
NEXT_PUBLIC_SUPABASE_URL=<YOUR_SUPABASE_URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<YOUR_SUPABASE_ANON_KEY>
NEXT_PUBLIC_CONTRACT_ADDRESS=<YOUR_CONTRACT_ADDRESS>
NEXT_PUBLIC_RPC_URL=<YOUR_ETHEREUM_RPC_URL>
Run the development server:

bash
Copy code
npm run dev
Open http://localhost:3000 in your browser.

Usage
Connect your Ethereum wallet using MetaMask or WalletConnect.

Upload the certificate PDF file to verify.

Click Verify Certificate Authenticity.

View the results:

✅ Verified: Certificate exists on blockchain and in the database.

❌ Invalid: Certificate not found or tampered.

If available, click the link to view the blockchain transaction on Etherscan.

Database Schema
issued_certificates Table
Column Name	Type	Description
id	int	Primary key
student_name	string	Name of the student
roll_number	string	Student roll number
course	string	Course name
certificate_id	string/int	Unique certificate identifier
certificate_hash	string	SHA-256 hash of certificate document
institution_wallet	string	Wallet address of issuing institution
blockchain_tx_hash	string	Transaction hash on blockchain
issued_at	timestamp	Issue date
created_at	timestamp	Record creation date
updated_at	timestamp	Record update date
document_hash	string	Hash of uploaded PDF document

Project Structure
bash
Copy code
src/
├─ components/        # Reusable UI components (Button, FileUpload, WalletConnect)
├─ hooks/             # Custom hooks (useToast)
├─ integrations/      # Supabase and blockchain integration
├─ lib/               # Utility functions (crypto hashing, web3 helpers)
└─ pages/             # Next.js pages (VerifyCertificate.tsx)
Smart Contract Requirements
Implement a function verifyCertificate(certificateId) or equivalent.

Function should return a boolean indicating whether the certificate is issued.

Contribution
Contributions are welcome! To contribute:

Fork the repository.

Create a new branch (git checkout -b feature-name).

Commit your changes (git commit -m "Add feature").

Push to the branch (git push origin feature-name).

Open a pull request