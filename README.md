# Digi-Pramaan

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)
![React](https://img.shields.io/badge/React-18.x-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)

**Digi-Pramaan** is a professional web application for **verifying the authenticity of certificates** using blockchain technology and a database backend. It provides a secure and reliable way to validate certificates issued by institutions and ensures that certificates have not been tampered with.

## 🌟 Features

- **📄 Certificate Upload:** Users can upload PDF certificates for verification
- **🔗 Blockchain Verification:** Confirms that the certificate has been registered on the blockchain using its unique ID
- **🗄️ Database Verification:** Checks the certificate record in Supabase database (`issued_certificates` or `documents` tables)
- **📝 Verification Logging:** All verification attempts are logged for auditing purposes
- **🎨 User-Friendly Interface:** Modern and interactive UI using React and TailwindCSS
- **💳 Wallet Integration:** Supports MetaMask and WalletConnect for blockchain interactions

## 🛠️ Tech Stack

- **Frontend:** React, TypeScript, TailwindCSS, Lucide Icons
- **Blockchain:** Ethereum (Sepolia Testnet), Web3.js
- **Database:** Supabase (PostgreSQL)
- **File Hashing:** SHA-256 for document integrity verification
- **Authentication & Wallet:** MetaMask, WalletConnect

## 📋 Prerequisites

- Node.js (v16.0.0 or higher)
- npm or yarn
- MetaMask browser extension
- Ethereum wallet with Sepolia testnet ETH
- Supabase account

## 🚀 Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Shahabaz322/cert-check-chain-main
   cd cert-check-chain-main
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=<YOUR_SUPABASE_URL>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<YOUR_SUPABASE_ANON_KEY>
   NEXT_PUBLIC_CONTRACT_ADDRESS=<YOUR_CONTRACT_ADDRESS>
   NEXT_PUBLIC_RPC_URL=<YOUR_ETHEREUM_RPC_URL>
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📖 Usage

1. **Connect Wallet:** Connect your Ethereum wallet using MetaMask or WalletConnect
2. **Upload Certificate:** Upload the certificate PDF file to verify
3. **Verify:** Click "Verify Certificate Authenticity"
4. **View Results:**
   - ✅ **Verified:** Certificate exists on blockchain and in the database
   - ❌ **Invalid:** Certificate not found or tampered
5. **Blockchain Link:** If available, click the link to view the blockchain transaction on Etherscan

## 🗃️ Database Schema

### `issued_certificates` Table

| Column Name | Type | Description |
|-------------|------|-------------|
| `id` | int | Primary key |
| `student_name` | string | Name of the student |
| `roll_number` | string | Student roll number |
| `course` | string | Course name |
| `certificate_id` | string/int | Unique certificate identifier |
| `certificate_hash` | string | SHA-256 hash of certificate document |
| `institution_wallet` | string | Wallet address of issuing institution |
| `blockchain_tx_hash` | string | Transaction hash on blockchain |
| `issued_at` | timestamp | Issue date |
| `created_at` | timestamp | Record creation date |
| `updated_at` | timestamp | Record update date |
| `document_hash` | string | Hash of uploaded PDF document |

## 📁 Project Structure

```
src/
├── components/        # Reusable UI components (Button, FileUpload, WalletConnect)
├── hooks/             # Custom hooks (useToast)
├── integrations/      # Supabase and blockchain integration
├── lib/               # Utility functions (crypto hashing, web3 helpers)
└── pages/             # Next.js pages (VerifyCertificate.tsx)
```

## 🔧 Smart Contract Requirements

The smart contract should implement:
- A function `verifyCertificate(certificateId)` or equivalent
- Function should return a boolean indicating whether the certificate is issued
- Proper access controls for certificate issuance

## 🔒 Security Features

- **Document Integrity:** SHA-256 hashing ensures file hasn't been modified
- **Blockchain Immutability:** Certificate records are permanently stored on Ethereum
- **Database Redundancy:** Dual verification through blockchain and database
- **Wallet Authentication:** Secure wallet-based interactions

## 🧪 Testing

Run the test suite:
```bash
npm test
```

For end-to-end testing:
```bash
npm run test:e2e
```

## 📱 Deployment

### Vercel Deployment
1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Manual Deployment
```bash
npm run build
npm run start
```

## 🤝 Contributing

Contributions are welcome! To contribute:

1. **Fork** the repository
2. **Create** a new branch (`git checkout -b feature-name`)
3. **Commit** your changes (`git commit -m "Add feature"`)
4. **Push** to the branch (`git push origin feature-name`)
5. **Open** a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/your-username/digi-pramaan/issues) page
2. Create a new issue with detailed information
3. Contact the maintainers

## 🙏 Acknowledgments

- Ethereum community for blockchain infrastructure
- Supabase team for the database platform
- React and TypeScript communities
- All contributors who helped improve this project

## 📊 Roadmap

- [ ] Support for multiple blockchain networks
- [ ] Batch certificate verification
- [ ] Mobile app development
- [ ] Integration with more wallet providers
- [ ] Advanced analytics dashboard
- [ ] Multi-language support

---

**Made with ❤️ for secure certificate verification**