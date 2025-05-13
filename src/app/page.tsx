'use client'
import { useState, useEffect } from "react"
import { Card, GameState } from './types/index.ts'
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useAccount, useSignMessage } from "wagmi"
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

  useEffect(() => {
    const initGame = async () => {
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
    }
    initGame()
  }, [])

  async function handleHit() {
    const response = await fetch('/api', {
      method: 'POST',
      body: JSON.stringify({ action: 'hit' ,address}),
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
  }


  async function handleStand() {
    const response = await fetch('/api', {
      method: 'POST',
      body: JSON.stringify({ action: 'stand' , address }),
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
  }

  async function handleReset() {
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
  }

  async function handleSign() {
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
      const { jsonwebtoken} = await response.json()
      localStorage.setItem('jsonwebtoken', jsonwebtoken)
      setIsSigned(true)
      console.log('Signature is valid')
    } else {
      setIsSigned(false)
    }
  }

  if (!isSigned) {

    return (
      <div className="flex flex-col gap-2 items-center justify-center h-screen  bg-gray-300">
        <ConnectButton />
        <button onClick={handleSign} className="border-black bg-amber-300 p-2 rounded-md">Sign with your wallet</button>
      </div>
    )
  }


  return (

    <div className="flex flex-col gap-2 items-center justify-center h-screen  bg-gray-300">
      <ConnectButton />
      <h1 className="text-3xl bold"> Welcome to Web3 game Black</h1>
      <h2 className={`text-2xl bold `}>Score: {score}</h2>
      <h2 className={`text-2xl bold ${winner === 'player' ? 'bg-green-300' : 'bg-amber-300'}`}>{message}</h2>
      <div className="mt-4">
        <h2>Dealer's hand</h2>
        <div className="flex flex-row gap-2">
          {dealerHand.map((card, index) => (
            <div key={index} className="w-32 h-42 border-1 border-black bg-white rounded-md flex flex-col justify-between">
              <p className="self-start p-2 text-lg">{card.rank}</p>
              <p className="self-center p-2 text-3xl">{card.suit}</p>
              <p className="self-end p-2  text-lg">{card.rank}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4">
        <h2>Player's hand</h2>
        <div className="flex flex-row gap-2">
          {playerHand.map((card, index) => (
            <div key={index} className="w-32 h-42 border-1 border-black bg-white rounded-md flex flex-col justify-between">
              <p className="self-start p-2 text-lg">{card.rank}</p>
              <p className="self-center p-2 text-3xl">{card.suit}</p>
              <p className="self-end p-2  text-lg">{card.rank}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-row gap-2 mt-4">

        {
          finished ?
            <button onClick={handleReset} className="bg-amber-300 rounded-md p-2">Reset</button>
            :
            <>
              <button onClick={handleHit} className="bg-amber-300 rounded-md p-2">Hit</button>
              <button onClick={handleStand} className="bg-amber-300 rounded-md p-2">Stand</button>
            </>
        }
      </div>
    </div>
  )
}