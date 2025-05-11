export interface Card {
  rank: string;
  suit: string;
}

export interface GameState {
  playerHand: Card[],
  dealerHand: Card[],
  deck?: Card[],
  message?: string,
  winner?: string,
  finished: boolean,
  score: number
}