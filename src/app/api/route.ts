import { get } from "http";

import { Card, GameState } from '../types/index.ts'
import { finished } from "stream";
import { DynamoDBClient, PutItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { verifyMessage } from 'viem'

// 初始化 DynamoDB 客户端
const client = new DynamoDBClient({
  region: "ap-southeast-2",
  credentials: {
    accessKeyId: process.env.AWS_USER_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_USER_ACCESS_KEY || '',
  },
});

// 定义表名和接口
const TABLE_NAME = "blackJack";

interface BlackJackItem {
  player: string;
  score: number;
}

// 写入数据到 DynamoDB
async function writeScore(player: string, score: number): Promise<void> {
  const params = {
    TableName: TABLE_NAME,
    Item: marshall({ player, score }),
  };

  try {
    const command = new PutItemCommand(params);
    await client.send(command);
    console.log(`Successfully wrote score ${score} for player ${player}`);
  } catch (error) {
    console.error(`Error writing to DynamoDB: ${error}`);
    throw error;
  }
}

// 从 DynamoDB 读取数据
async function readScore(player: string): Promise<BlackJackItem | null> {
  const params = {
    TableName: TABLE_NAME,
    Key: marshall({ player }),
  };

  try {
    const command = new GetItemCommand(params);
    const { Item } = await client.send(command);

    if (!Item) {
      console.log(`No data found for player ${player}`);
      return null;
    }

    const item = unmarshall(Item) as BlackJackItem;
    console.log(`Successfully read score ${item.score} for player ${player}`);
    return item;
  } catch (error) {
    console.error(`Error reading from DynamoDB: ${error}`);
    throw error;
  }
}

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


export async function GET(request: Request) {
  const url = new URL(request.url)
  const address = url.searchParams.get('address')
  if (!address) {
    return new Response(JSON.stringify({
      message: 'Address is required',
    }), { status: 400 })
  }
  resetState()
  const [playerCards, remainingDeck] = getRandomCard(gameState.deck!, 2)
  const [dealerCards, newDeck] = getRandomCard(remainingDeck, 2)
  gameState.playerHand = playerCards
  gameState.dealerHand = dealerCards
  gameState.deck = newDeck
  gameState.message = 'Game started!'

  try {
    const data = await readScore(address)
    if (data) {
      gameState.score = data.score
    } else {
      gameState.score = 0
    }
  } catch (error) {
    console.error('Error reading score:', error)
    return new Response(JSON.stringify({
      message: 'Error fetching data from DynamoDB',
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }
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
  const body = await request.json()
  const { action, address } = body
  if (action === 'auth') {
    const { address, signature, message } = body
    const isValid = await verifyMessage({
      address,
      message,
      signature,
    })
    if (isValid) {
      return new Response(JSON.stringify({
        message: 'Valid signature',
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    } else {
      return new Response(JSON.stringify({
        message: 'Invalid signature',
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    }
  }
  else if (action === 'hit') {
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

  try {
    await writeScore(address, gameState.score)
  } catch (error) {
    console.error('Error writing score:', error)
    return new Response(JSON.stringify({
      message: 'Error writing score to DynamoDB',
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
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