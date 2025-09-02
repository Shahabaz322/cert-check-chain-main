import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Wallet, Loader2 } from 'lucide-react';
import { connectWallet, switchToSepolia, Web3State } from '@/lib/web3';
import { useToast } from '@/hooks/use-toast';

interface WalletConnectProps {
  onConnect: (web3State: Web3State) => void;
  web3State: Web3State;
}

export const WalletConnect = ({ onConnect, web3State }: WalletConnectProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      // First switch to Sepolia network
      await switchToSepolia();
      
      // Then connect wallet
      const newWeb3State = await connectWallet();
      onConnect(newWeb3State);
      
      toast({
        title: "Wallet Connected",
        description: `Connected to ${newWeb3State.account?.slice(0, 6)}...${newWeb3State.account?.slice(-4)}`,
      });
    } catch (error: any) {
      console.error('Connection error:', error);
      toast({
        variant: "destructive",
        title: "Connection Failed",
        description: error.message || "Failed to connect wallet. Please ensure MetaMask is installed.",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  if (web3State.isConnected && web3State.account) {
    return (
      <div className="flex items-center gap-3 px-4 py-2 bg-success-light border border-success/20 rounded-lg">
        <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
        <span className="text-sm font-medium text-success">
          {web3State.account.slice(0, 6)}...{web3State.account.slice(-4)}
        </span>
      </div>
    );
  }

  return (
    <Button 
      onClick={handleConnect} 
      disabled={isConnecting}
      variant="outline"
      size="lg"
      className="min-w-[180px]"
    >
      {isConnecting ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Connecting...
        </>
      ) : (
        <>
          <Wallet className="w-4 h-4 mr-2" />
          Connect MetaMask
        </>
      )}
    </Button>
  );
};