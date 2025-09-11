import { ethers } from 'ethers';

const INFURA_API_KEY = import.meta.env.VITE_INFURA_API_KEY;

// Replace these in your src/lib/web3.ts file after deployment:

export const CONTRACT_ADDRESS = '0x91955EaEDcE878be203030b84C792a035391a3F7'; // From deployment output

export const CONTRACT_ABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "certificateId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "recipient",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "name",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "course",
        "type": "string"
      }
    ],
    "name": "CertificateIssued",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "certificateId",
        "type": "uint256"
      }
    ],
    "name": "CertificateRevoked",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "certificates",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "recipient",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "name",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "course",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "institution",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "dateIssued",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "isValid",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_certificateId",
        "type": "uint256"
      }
    ],
    "name": "getCertificate",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "id",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "recipient",
            "type": "address"
          },
          {
            "internalType": "string",
            "name": "name",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "course",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "institution",
            "type": "string"
          },
          {
            "internalType": "uint256",
            "name": "dateIssued",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "isValid",
            "type": "bool"
          }
        ],
        "internalType": "struct CertificateContract.Certificate",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_recipient",
        "type": "address"
      }
    ],
    "name": "getRecipientCertificates",
    "outputs": [
      {
        "internalType": "uint256[]",
        "name": "",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getTotalCertificates",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_recipient",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "_name",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "_course",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "_institution",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "_dateIssued",
        "type": "uint256"
      }
    ],
    "name": "issueCertificate",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "nextCertificateId",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "recipientCertificates",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_certificateId",
        "type": "uint256"
      }
    ],
    "name": "revokeCertificate",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_certificateId",
        "type": "uint256"
      }
    ],
    "name": "verifyCertificate",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// Generate RPC URLs based on API key availability
const getRpcUrls = (): string[] => {
  const fallbackUrls = [
    'https://sepolia.drpc.org',
    'https://rpc.sepolia.org',
    'https://sepolia.gateway.tenderly.co',
    'https://ethereum-sepolia.publicnode.com'
  ];

  if (INFURA_API_KEY) {
    return [`https://sepolia.infura.io/v3/${INFURA_API_KEY}`, ...fallbackUrls];
  }
  
  return fallbackUrls;
};

// Network configuration - Now supporting both Ganache and Sepolia
export const GANACHE_NETWORK_CONFIG = {
  chainId: '0x539', // 1337 in hex
  chainName: 'Ganache Local',
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: ['http://127.0.0.1:7545'],
  blockExplorerUrls: [],
};

export const SEPOLIA_NETWORK_CONFIG = {
  chainId: '0xaa36a7',
  chainName: 'Sepolia Testnet',
  nativeCurrency: {
    name: 'SepoliaETH',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: getRpcUrls(),
  blockExplorerUrls: ['https://sepolia.etherscan.io/'],
};

// Switch between networks easily
export const USE_GANACHE = true; // Set to false to use Sepolia
export const CURRENT_NETWORK_CONFIG = USE_GANACHE ? GANACHE_NETWORK_CONFIG : SEPOLIA_NETWORK_CONFIG;

export interface Web3State {
  account: string | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.Signer | null;
  contract: ethers.Contract | null;
  isConnected: boolean;
}

export const getWeb3Provider = async (): Promise<ethers.BrowserProvider | null> => {
  if (typeof window !== 'undefined' && window.ethereum) {
    return new ethers.BrowserProvider(window.ethereum);
  }
  return null;
};

export const checkNetwork = async (provider: ethers.BrowserProvider): Promise<boolean> => {
  try {
    const network = await provider.getNetwork();
    const expectedChainId = parseInt(CURRENT_NETWORK_CONFIG.chainId, 16);
    return Number(network.chainId) === expectedChainId;
  } catch (error) {
    console.error('Error checking network:', error);
    return false;
  }
};

// Improved network checking function with polling
const waitForNetworkSwitch = async (expectedChainId: string, maxAttempts: number = 10): Promise<boolean> => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      if (!window.ethereum) return false;
      
      const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
      console.log(`Network check attempt ${attempt + 1} - Expected: ${expectedChainId}, Current: ${currentChainId}`);
      
      if (currentChainId === expectedChainId) {
        console.log('Network switch successful!');
        return true;
      }
      
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Network check attempt ${attempt + 1} failed:`, error);
    }
  }
  return false;
};

export const connectWallet = async (): Promise<Web3State> => {
  try {
    let provider = await getWeb3Provider();
    if (!provider) {
      throw new Error('MetaMask not detected. Please install MetaMask extension.');
    }

    // Validate contract address
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
    if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
      throw new Error('Invalid contract address. Please deploy your smart contract first and update the CONTRACT_ADDRESS.');
    }

    // Check if already connected
    const accounts = await window.ethereum!.request({ method: 'eth_accounts' });
    if (accounts.length === 0) {
      await window.ethereum!.request({ method: 'eth_requestAccounts' });
    }

    // Simple network check function using direct MetaMask call
    const checkCurrentNetwork = async (): Promise<boolean> => {
      try {
        if (!window.ethereum) return false;
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        const expectedChainId = CURRENT_NETWORK_CONFIG.chainId;
        console.log(`Network check - Expected: ${expectedChainId}, Actual: ${chainId}`);
        return chainId === expectedChainId;
      } catch (error) {
        console.error('Network check failed:', error);
        return false;
      }
    };

    // Initial network check
    let isCorrectNetwork = await checkCurrentNetwork();
    
    if (!isCorrectNetwork) {
      console.log('Wrong network detected, switching...');
      
      try {
        if (USE_GANACHE) {
          await switchToGanache();
        } else {
          await switchToSepolia();
        }
        
        // Use improved polling method to wait for network switch
        isCorrectNetwork = await waitForNetworkSwitch(CURRENT_NETWORK_CONFIG.chainId);
        
      } catch (switchError: any) {
        console.error('Network switch failed:', switchError);
        
        // If automatic switch fails, provide clear instructions
        const networkName = USE_GANACHE ? 'Ganache Local (Chain ID: 1337)' : 'Sepolia testnet (Chain ID: 11155111)';
        throw new Error(`Failed to switch to ${networkName}. Please manually switch to this network in MetaMask and try again.`);
      }
      
      if (!isCorrectNetwork) {
        const networkName = USE_GANACHE ? 'Ganache Local (Chain ID: 1337)' : 'Sepolia testnet (Chain ID: 11155111)';
        throw new Error(`Unable to connect to ${networkName}. Please manually switch to this network in MetaMask and try again.`);
      }
    }

    // Create fresh provider instance AFTER network is confirmed correct
    console.log('Creating fresh provider instance...');
    provider = new ethers.BrowserProvider(window.ethereum!);

    // Set up event listeners with inline functions to avoid naming conflicts
    if (window.ethereum) {
      // Remove all existing listeners first
      window.ethereum.removeAllListeners?.('chainChanged');
      window.ethereum.removeAllListeners?.('accountsChanged');
      
      // Add new listeners with inline functions
      window.ethereum.on('chainChanged', () => {
        console.warn('MetaMask network changed, reloading...');
        window.location.reload();
      });
      
      window.ethereum.on('accountsChanged', () => {
        console.warn('MetaMask accounts changed, reloading...');
        window.location.reload();
      });
    }

    const signer = await provider.getSigner();
    const account = await signer.getAddress();

    if (CONTRACT_ADDRESS.toLowerCase() === account.toLowerCase()) {
      throw new Error('Contract address cannot be the same as your wallet address.');
    }

    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    // Test contract - Updated to use certificate contract method
    try {
      await contract.getTotalCertificates();
      console.log('Contract test successful!');
    } catch (contractError: any) {
      console.error('Contract test failed:', contractError);
      if (contractError.message?.includes('call exception') || contractError.code === 'CALL_EXCEPTION') {
        const networkName = USE_GANACHE ? 'Ganache' : 'Sepolia testnet';
        throw new Error(`Certificate contract not found at address ${CONTRACT_ADDRESS} on ${networkName}.`);
      }
      throw contractError;
    }

    console.log('Successfully connected to wallet and contract!');

    return {
      account,
      provider,
      signer,
      contract,
      isConnected: true
    };
  } catch (error: any) {
    console.error('Error connecting wallet:', error);

    if (error.code === 4001) {
      throw new Error('Connection rejected by user');
    } else if (error.code === -32002) {
      throw new Error('Connection request already pending. Please check MetaMask.');
    }

    throw error;
  }
};

export const switchToGanache = async (): Promise<void> => {
  if (!window.ethereum) throw new Error('MetaMask not detected');

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: GANACHE_NETWORK_CONFIG.chainId }],
    });
    
    console.log('Network switch request sent for Ganache');
    
  } catch (switchError: any) {
    if (switchError.code === 4902) {
      // Network not added yet, add it
      console.log('Adding Ganache network to MetaMask...');
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [GANACHE_NETWORK_CONFIG],
      });
    } else if (switchError.code === 4001) {
      throw new Error('Network switch rejected by user');
    } else {
      console.error('Switch error:', switchError);
      throw new Error('Failed to switch to Ganache network. Please switch manually.');
    }
  }
};

export const switchToSepolia = async (): Promise<void> => {
  if (!window.ethereum) throw new Error('MetaMask not detected');

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: SEPOLIA_NETWORK_CONFIG.chainId }],
    });
    
    console.log('Network switch request sent for Sepolia');
    
  } catch (switchError: any) {
    if (switchError.code === 4902) {
      // Network not added yet, add it
      console.log('Adding Sepolia network to MetaMask...');
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [SEPOLIA_NETWORK_CONFIG],
      });
    } else if (switchError.code === 4001) {
      throw new Error('Network switch rejected by user');
    } else {
      console.error('Switch error:', switchError);
      throw new Error('Failed to switch to Sepolia network. Please switch manually.');
    }
  }
};

// Utility function to get current network info
export const getCurrentNetwork = async (): Promise<{ chainId: number; name: string } | null> => {
  try {
    const provider = await getWeb3Provider();
    if (!provider) return null;
    
    const network = await provider.getNetwork();
    return {
      chainId: Number(network.chainId),
      name: network.name
    };
  } catch (error) {
    console.error('Error getting current network:', error);
    return null;
  }
};

// Utility function to format addresses
export const formatAddress = (address: string): string => {
  if (!address) return '';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

// Utility function to check if MetaMask is installed
export const isMetaMaskInstalled = (): boolean => {
  return typeof window !== 'undefined' && 
         typeof window.ethereum !== 'undefined' && 
         window.ethereum.isMetaMask === true;
};

// Certificate contract specific utility functions
export const getTotalCertificates = async (contract: ethers.Contract): Promise<number> => {
  try {
    const value = await contract.getTotalCertificates();
    return Number(value);
  } catch (error) {
    console.error('Error getting total certificates:', error);
    throw error;
  }
};

export const issueCertificate = async (
  contract: ethers.Contract,
  recipient: string,
  name: string,
  course: string,
  institution: string,
  dateIssued: number
): Promise<ethers.ContractTransactionResponse> => {
  try {
    const tx = await contract.issueCertificate(recipient, name, course, institution, dateIssued);
    return tx;
  } catch (error) {
    console.error('Error issuing certificate:', error);
    throw error;
  }
};

export const getCertificate = async (contract: ethers.Contract, certificateId: number): Promise<any> => {
  try {
    const certificate = await contract.getCertificate(certificateId);
    return certificate;
  } catch (error) {
    console.error('Error getting certificate:', error);
    throw error;
  }
};

export const verifyCertificate = async (contract: ethers.Contract, certificateId: number): Promise<boolean> => {
  try {
    const isValid = await contract.verifyCertificate(certificateId);
    return isValid;
  } catch (error) {
    console.error('Error verifying certificate:', error);
    throw error;
  }
};

// Global interface for MetaMask
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, handler: (...args: any[]) => void) => void;
      removeListener: (event: string, handler: (...args: any[]) => void) => void;
      removeAllListeners?: (event: string) => void;
      selectedAddress: string | null;
      isMetaMask?: boolean;
    };
  }
}