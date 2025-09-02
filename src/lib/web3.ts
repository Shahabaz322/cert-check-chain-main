import { ethers } from 'ethers';

const INFURA_API_KEY = import.meta.env.VITE_INFURA_API_KEY;

// Contract configuration - Updated with deployed Counter contract
export const CONTRACT_ADDRESS = '0xE3846395266Bd89bab1Afa1CDE2e83A398dfe96D';
export const CONTRACT_ABI = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "by",
        "type": "uint256"
      }
    ],
    "name": "Increment",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "inc",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "by",
        "type": "uint256"
      }
    ],
    "name": "incBy",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "x",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
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

export const connectWallet = async (): Promise<Web3State> => {
  try {
    const provider = await getWeb3Provider();
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
      // Request account access if not connected
      await window.ethereum!.request({ method: 'eth_requestAccounts' });
    }

    // Check if on correct network
    const isCorrectNetwork = await checkNetwork(provider);
    if (!isCorrectNetwork) {
      if (USE_GANACHE) {
        await switchToGanache();
      } else {
        await switchToSepolia();
      }
      // Re-check after switching
      const stillCorrectNetwork = await checkNetwork(provider);
      if (!stillCorrectNetwork) {
        const networkName = USE_GANACHE ? 'Ganache Local' : 'Sepolia testnet';
        throw new Error(`Please switch to ${networkName} in MetaMask`);
      }
    }
    
    const signer = await provider.getSigner();
    const account = await signer.getAddress();
    
    // Validate that contract address is different from user address
    if (CONTRACT_ADDRESS.toLowerCase() === account.toLowerCase()) {
      throw new Error('Contract address cannot be the same as your wallet address. Please deploy your smart contract and use the correct contract address.');
    }
    
    // Create contract instance
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    // Test if Counter contract exists by calling the view function 'x'
    try {
      await contract.x();
    } catch (contractError: any) {
      if (contractError.message?.includes('call exception') || contractError.code === 'CALL_EXCEPTION') {
        const networkName = USE_GANACHE ? 'Ganache' : 'Sepolia testnet';
        throw new Error(`Counter contract not found at the specified address. Please verify the contract is deployed on ${networkName}.`);
      }
    }

    return {
      account,
      provider,
      signer,
      contract,
      isConnected: true
    };
  } catch (error: any) {
    console.error('Error connecting wallet:', error);
    
    // Provide more specific error messages
    if (error.code === 4001) {
      throw new Error('Connection rejected by user');
    } else if (error.code === -32002) {
      throw new Error('Connection request already pending. Please check MetaMask.');
    } else if (error.message?.includes('Unauthorized')) {
      throw new Error('Network connection failed. Please try switching networks in MetaMask and reconnecting.');
    }
    
    throw error;
  }
};

export const switchToGanache = async (): Promise<void> => {
  if (!window.ethereum) {
    throw new Error('MetaMask not detected');
  }

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: GANACHE_NETWORK_CONFIG.chainId }],
    });
  } catch (switchError: any) {
    // If network doesn't exist, add it
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [GANACHE_NETWORK_CONFIG],
        });
      } catch (addError) {
        console.error('Error adding Ganache network:', addError);
        throw new Error('Failed to add Ganache network. Please add it manually in MetaMask.');
      }
    } else if (switchError.code === 4001) {
      throw new Error('Network switch rejected by user');
    } else {
      console.error('Error switching to Ganache:', switchError);
      throw new Error('Failed to switch to Ganache network. Please switch manually in MetaMask.');
    }
  }
};

export const switchToSepolia = async (): Promise<void> => {
  if (!window.ethereum) {
    throw new Error('MetaMask not detected');
  }

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: SEPOLIA_NETWORK_CONFIG.chainId }],
    });
  } catch (switchError: any) {
    // If network doesn't exist, add it
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [SEPOLIA_NETWORK_CONFIG],
        });
      } catch (addError) {
        console.error('Error adding Sepolia network:', addError);
        throw new Error('Failed to add Sepolia network. Please add it manually in MetaMask.');
      }
    } else if (switchError.code === 4001) {
      throw new Error('Network switch rejected by user');
    } else {
      console.error('Error switching to Sepolia:', switchError);
      throw new Error('Failed to switch to Sepolia network. Please switch manually in MetaMask.');
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

// Counter contract specific utility functions
export const getCounterValue = async (contract: ethers.Contract): Promise<number> => {
  try {
    const value = await contract.x();
    return Number(value);
  } catch (error) {
    console.error('Error getting counter value:', error);
    throw error;
  }
};

export const incrementCounter = async (contract: ethers.Contract): Promise<ethers.ContractTransactionResponse> => {
  try {
    const tx = await contract.inc();
    return tx;
  } catch (error) {
    console.error('Error incrementing counter:', error);
    throw error;
  }
};

export const incrementCounterBy = async (contract: ethers.Contract, amount: number): Promise<ethers.ContractTransactionResponse> => {
  try {
    if (amount <= 0) {
      throw new Error('Increment amount must be positive');
    }
    const tx = await contract.incBy(amount);
    return tx;
  } catch (error) {
    console.error('Error incrementing counter by amount:', error);
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
      selectedAddress: string | null;
      isMetaMask?: boolean;
    };
  }
}