import { get } from "http";

import { Card, GameState } from '../types/index.ts'
import { finished } from "stream";

const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const suits = ['♥️', '♠️', '♣️', '♦️']
const initialDeck: Card[] = ranks.map(rank =>
  suits.map(suit => ({ rank, suit }) as Card)
).flat()



const gameState: GameState = {
  playerHand: [],
  dealerHand: [],
  deck: initialDeck,
  message: '',
  winner: '',
  finished: false,
  score: 0,
}

function resetState() {
  gameState.playerHand = []
  gameState.dealerHand = []
  gameState.deck = initialDeck
  gameState.message = ''
  gameState.winner = ''
  gameState.finished = false
}


function getRandomCard(deck: Card[], count: number) {
  const randomIndexSet = new Set<number>()
  while (randomIndexSet.size < count) {
    const randomIndex = Math.floor(Math.random() * deck.length)
    randomIndexSet.add(randomIndex)
  }
  const randomCards = Array.from(randomIndexSet).map(index => deck[index])
  const remainingDeck = deck.filter((_, index) => !randomIndexSet.has(index))
  return [randomCards, remainingDeck]

}


export function GET() {
  resetState()
  const [playerCards, remainingDeck] = getRandomCard(gameState.deck!, 2)
  const [dealerCards, newDeck] = getRandomCard(remainingDeck, 2)
  gameState.playerHand = playerCards
  gameState.dealerHand = dealerCards
  gameState.deck = newDeck
  gameState.message = 'Game started!'

  return new Response(JSON.stringify({
    playerHand: gameState.playerHand,
    dealerHand: [gameState.dealerHand[0], { rank: '?', suit: '?' }],
    message: gameState.message,
    winner: gameState.winner,
    score: gameState.score,
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}


export async function POST(request: Request) {
  const { action } = await request.json()
  if (action === 'hit') {
    const [newCard, newDeck] = getRandomCard(gameState.deck!, 1)
    gameState.playerHand.push(newCard[0])
    gameState.deck = newDeck
    const playerValue = calculateHandValue(gameState.playerHand)
    if (playerValue === 21) {
      gameState.message = 'Blackjack! Player wins!'
      gameState.winner = 'player'
      gameState.finished = true
      gameState.score += 100
    } else if (playerValue > 21) {
      gameState.message = 'Bust! Player loses!'
      gameState.winner = 'dealer'
      gameState.finished = true
      gameState.score -= 100

    }
  } else if (action === 'stand') {
    while (calculateHandValue(gameState.dealerHand) < 17) {
      const [newCard, newDeck] = getRandomCard(gameState.deck!, 1)
      gameState.dealerHand.push(newCard[0])
      gameState.deck = newDeck
    }
    const playerValue = calculateHandValue(gameState.playerHand)
    const dealerValue = calculateHandValue(gameState.dealerHand)
    if (dealerValue > 21 || playerValue > dealerValue) {
      gameState.message = 'Player wins!'
      gameState.winner = 'player'
      gameState.finished = true
      gameState.score += 100
    } else if (playerValue < dealerValue) {
      gameState.message = 'Dealer wins!'
      gameState.winner = 'dealer'
      gameState.finished = true
      gameState.score -= 100
    } else {
      gameState.message = 'Draw!'
      gameState.winner = ''
      gameState.finished = true
    }
  } else {
    return new Response(JSON.stringify({
      message: 'Invalid action',
    }), {
      status: 400,
    })
  }
  return new Response(JSON.stringify({
    playerHand: gameState.playerHand,
    dealerHand: gameState.finished ? gameState.dealerHand : [gameState.dealerHand[0], { rank: '?', suit: '?' }],
    message: gameState.message,
    winner: gameState.winner,
    finished: gameState.finished,
    score: gameState.score,
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  })

}


function calculateHandValue(hand: Card[]) {
  let value = 0
  let aceCount = 0
  hand.forEach(card => {
    if (card.rank === 'A') {
      value += 11
      aceCount++
    } else if (['J', 'Q', 'K'].includes(card.rank)) {
      value += 10
    } else {
      value += parseInt(card.rank)
    }
  })
  while (value > 21 && aceCount > 0) {
    value -= 10
    aceCount--
  }
  return value
}