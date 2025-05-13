'use client'
import { useState, useEffect } from "react"
import { Card, GameState } from './types/index.ts'
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useAccount, useSignMessage } from "wagmi"
import { parseAbi, createPublicClient, createWalletClient, custom } from "viem"
import { avalancheFuji } from "viem/chains"
import { Loader } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Page() {
  const [playerHand, setPlayerHand] = useState<Card[]>([])
  const [dealerHand, setDealerHand] = useState<Card[]>([])
  const [message, setMessage] = useState<string>('')
  const [winner, setWinner] = useState<string>('')
  const [finished, setFinished] = useState<boolean>(false)
  const [score, setScore] = useState<number>(0)
  const { address, isConnected } = useAccount()
  const [isSigned, setIsSigned] = useState<boolean>(false)
  const { signMessageAsync } = useSignMessage()
  const [publicClient, setPublicClient] = useState<any>(null)
  const [walletClient, setWalletClient] = useState<any>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isNftLoading, setIsNftLoading] = useState<boolean>(false)

  useEffect(() => {
    const initGame = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api?address=${address}`, {
          method: 'GET',
        })
        
        if (!response.ok) {
          throw new Error('Failed to fetch data')
        } 
        
        const data: GameState = await response.json()
        console.log(data)
        setPlayerHand(data.playerHand)
        setDealerHand(data.dealerHand)
        setFinished(data.finished)
        setScore(data.score)
        data.message && setMessage(data.message)
        
        if(typeof window !== 'undefined' && window.ethereum) {
          const publicClient = createPublicClient({
            chain: avalancheFuji,
            transport: custom(window.ethereum),
          })
          const walletClient = createWalletClient({
            chain: avalancheFuji,
            transport: custom(window.ethereum),
          })
          setPublicClient(publicClient)
          setWalletClient(walletClient)
        }
      } catch (error) {
        console.error(error)
      } finally {
        setIsLoading(false)
      }
    }
    
    initGame()
  }, [])

  async function handleSendTx() {
    setIsNftLoading(true)
    try {
      const contractAddr = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS
      const contractAbiRaw = process.env.NEXT_PUBLIC_CONTRACT_ABI || ""    
      let contractAbi;

      try {
        contractAbi = parseAbi([contractAbiRaw])
        console.log("Parsed ABI:", contractAbi)
      } catch (error) {
        console.error("Error parsing ABI:", error)
        setMessage("Invalid ABI JSON format")
        return
      }
      
      // publicClient -> simulate -> sendTransaction
      publicClient.simulateContract({
        address: contractAddr,
        abi: contractAbi,
        functionName: 'sendRequest',
        args: [[address], address],
        account: address,
      })

      // walletClient -> sendTransaction
      const txHash = await walletClient.writeContract({
        to: contractAddr,
        abi: contractAbi,
        functionName: 'sendRequest',
        args: [[address], address],
        account: address
      })
      
      console.log(`Transaction sent: ${txHash}`)
    } catch (error) {
      console.error(error)
    } finally {
      setIsNftLoading(false)
    }
  }

  async function handleHit() {
    setIsLoading(true)
    try {
      const response = await fetch('/api', {
        method: 'POST',
        body: JSON.stringify({ action: 'hit', address }),
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jsonwebtoken')}`,
        },
      })
      
      const data = await response.json()
      setPlayerHand(data.playerHand)
      setDealerHand(data.dealerHand)
      setMessage(data.message)
      setWinner(data.winner)
      setFinished(data.finished)
      setScore(data.score)
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleStand() {
    setIsLoading(true)
    try {
      const response = await fetch('/api', {
        method: 'POST',
        body: JSON.stringify({ action: 'stand', address }),
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jsonwebtoken')}`,
        },
      })
      
      const data = await response.json()
      setPlayerHand(data.playerHand)
      setDealerHand(data.dealerHand)
      setMessage(data.message)
      setWinner(data.winner)
      setFinished(data.finished)
      setScore(data.score)
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleReset() {
    setIsLoading(true)
    try {
      const response = await fetch(`/api?address=${address}`, {
        method: 'GET',
      })
      
      const data = await response.json()
      setPlayerHand(data.playerHand)
      setDealerHand(data.dealerHand)
      setMessage(data.message)
      setWinner(data.winner)
      setFinished(data.finished)
      setScore(data.score)
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSign() {
    setIsLoading(true)
    try {
      const message = 'Welcome to the game black jack at ${new Date().toString()}'
      const signature = await signMessageAsync({ message })
      const response = await fetch('/api', {
        method: 'POST',
        body: JSON.stringify(
          {
            action: 'auth',
            address,
            message,
            signature
          }
        )
      })
      
      if (response.status === 200) {
        const { jsonwebtoken } = await response.json()
        localStorage.setItem('jsonwebtoken', jsonwebtoken)
        setIsSigned(true)
        console.log('Signature is valid')
      } else {
        setIsSigned(false)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isSigned) {
    return (
      <div className="flex flex-col gap-4 items-center justify-center min-h-screen bg-gradient-to-b from-slate-800 to-slate-900 text-white p-8">
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-2 text-center">Web3 Blackjack</h1>
          <p className="text-slate-300 text-center">Connect your wallet and sign to begin playing</p>
        </div>
        
        <div className="bg-slate-700/50 backdrop-blur-sm p-8 rounded-xl shadow-xl w-full max-w-md border border-slate-600">
          <div className="flex flex-col items-center gap-6">
            <ConnectButton />
            
            <Button 
              onClick={handleSign} 
              className="w-full h-12 text-lg font-medium bg-amber-500 hover:bg-amber-600 text-black transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader className="animate-spin h-4 w-4" />
                  Signing...
                </span>
              ) : (
                'Sign with your wallet'
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-gradient-to-b from-green-800 to-slate-900 text-white p-4 md:p-8">
      <div className="w-full max-w-5xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 bg-slate-800/70 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-slate-700">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Web3 Blackjack</h1>
            <div className="flex items-center gap-3">
              <div className="text-xl font-semibold">
                Score: <span className="text-amber-400">{score}</span>
              </div>
              {message && (
                <div className={`px-4 py-1.5 rounded-full text-sm font-medium ${
                  winner === 'player' ? 'bg-emerald-500/80 text-white' : winner ? 'bg-red-500/80 text-white' : 'bg-amber-500/80 text-black'
                }`}>
                  {message}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-3 mt-4 md:mt-0">
            <ConnectButton />
            <Button
              onClick={handleSendTx}
              variant="outline" 
              className="border-amber-500 text-amber-400 hover:bg-amber-500 hover:text-black transition-all"
              disabled={isNftLoading}
            >
              {isNftLoading ? (
                <span className="flex items-center gap-2">
                  <Loader className="animate-spin h-4 w-4" />
                  Processing...
                </span>
              ) : (
                'Claim NFT'
              )}
            </Button>
          </div>
        </div>

        {/* Game area */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-slate-700">
          {/* Dealer's hand */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-3 text-amber-300">Dealer's Hand</h2>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader className="animate-spin h-8 w-8 text-amber-400" />
              </div>
            ) : (
              <div className="flex flex-wrap justify-center gap-3">
                {dealerHand.map((card, index) => (
                  <div 
                    key={index} 
                    className="w-24 md:w-32 h-36 md:h-44 bg-white rounded-lg shadow-lg border-2 border-slate-200 flex flex-col justify-between p-2 transform transition-transform hover:scale-105 text-black"
                  >
                    <p className={`self-start font-bold text-lg ${card.suit === '♥' || card.suit === '♦' ? 'text-red-600' : 'text-black'}`}>
                      {card.rank}
                    </p>
                    <p className={`self-center text-4xl ${card.suit === '♥' || card.suit === '♦' ? 'text-red-600' : 'text-black'}`}>
                      {card.suit}
                    </p>
                    <p className={`self-end font-bold text-lg ${card.suit === '♥' || card.suit === '♦' ? 'text-red-600' : 'text-black'}`}>
                      {card.rank}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Player's hand */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-3 text-emerald-300">Your Hand</h2>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader className="animate-spin h-8 w-8 text-emerald-400" />
              </div>
            ) : (
              <div className="flex flex-wrap justify-center gap-3">
                {playerHand.map((card, index) => (
                  <div 
                    key={index} 
                    className="w-24 md:w-32 h-36 md:h-44 bg-white rounded-lg shadow-lg border-2 border-slate-200 flex flex-col justify-between p-2 transform transition-transform hover:scale-105 text-black"
                  >
                    <p className={`self-start font-bold text-lg ${card.suit === '♥' || card.suit === '♦' ? 'text-red-600' : 'text-black'}`}>
                      {card.rank}
                    </p>
                    <p className={`self-center text-4xl ${card.suit === '♥' || card.suit === '♦' ? 'text-red-600' : 'text-black'}`}>
                      {card.suit}
                    </p>
                    <p className={`self-end font-bold text-lg ${card.suit === '♥' || card.suit === '♦' ? 'text-red-600' : 'text-black'}`}>
                      {card.rank}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex justify-center mt-6">
            <div className="flex flex-row gap-4">
              {finished ? (
                <Button
                  onClick={handleReset}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 text-lg font-semibold rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader className="animate-spin h-4 w-4" />
                      Resetting...
                    </span>
                  ) : (
                    'New Game'
                  )}
                </Button>
              ) : (
                <>
                  <Button
                    onClick={handleHit}
                    className="bg-amber-500 hover:bg-amber-600 text-black px-8 py-3 text-lg font-semibold rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <Loader className="animate-spin h-4 w-4" />
                        Hitting...
                      </span>
                    ) : (
                      'Hit'
                    )}
                  </Button>
                  <Button
                    onClick={handleStand}
                    className="bg-slate-600 hover:bg-slate-700 text-white px-8 py-3 text-lg font-semibold rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <Loader className="animate-spin h-4 w-4" />
                        Standing...
                      </span>
                    ) : (
                      'Stand'
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}