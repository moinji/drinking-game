<script setup>
import { ref, computed } from 'vue'
import { coinTruthQuestions } from '../data/gameData'

const participants = ref([])
const newParticipant = ref('')
const currentQuestion = ref('')
const gamePhase = ref('setup') // setup, question, voting, result
const currentPlayerIndex = ref(0)
const votes = ref([]) // { name, choice: 'truth'|'lie', guess: number }
const usedQuestions = ref([])

const addParticipant = () => {
  const name = newParticipant.value.trim()
  if (name && !participants.value.includes(name)) {
    participants.value.push(name)
    newParticipant.value = ''
  }
}

const removeParticipant = (index) => {
  participants.value.splice(index, 1)
}

const handleKeypress = (e) => {
  if (e.key === 'Enter') {
    addParticipant()
  }
}

const startGame = () => {
  if (participants.value.length < 2) return
  getNewQuestion()
  gamePhase.value = 'question'
}

const getNewQuestion = () => {
  const available = coinTruthQuestions.filter((_, i) => !usedQuestions.value.includes(i))
  if (available.length === 0) {
    usedQuestions.value = []
    currentQuestion.value = coinTruthQuestions[Math.floor(Math.random() * coinTruthQuestions.length)]
  } else {
    const idx = Math.floor(Math.random() * available.length)
    const originalIdx = coinTruthQuestions.indexOf(available[idx])
    usedQuestions.value.push(originalIdx)
    currentQuestion.value = available[idx]
  }
}

const startVoting = () => {
  votes.value = []
  currentPlayerIndex.value = 0
  gamePhase.value = 'voting'
}

const currentPlayer = computed(() => participants.value[currentPlayerIndex.value])

const playerChoice = ref('')
const playerGuess = ref('')

const submitVote = () => {
  if (!playerChoice.value || playerGuess.value === '') return

  votes.value.push({
    name: currentPlayer.value,
    choice: playerChoice.value,
    guess: parseInt(playerGuess.value)
  })

  playerChoice.value = ''
  playerGuess.value = ''

  if (currentPlayerIndex.value < participants.value.length - 1) {
    currentPlayerIndex.value++
  } else {
    gamePhase.value = 'result'
  }
}

const truthCount = computed(() => {
  return votes.value.filter(v => v.choice === 'truth').length
})

const winners = computed(() => {
  return votes.value.filter(v => v.guess === truthCount.value).map(v => v.name)
})

const nextRound = () => {
  getNewQuestion()
  gamePhase.value = 'question'
}

const resetGame = () => {
  gamePhase.value = 'setup'
  votes.value = []
  currentPlayerIndex.value = 0
  currentQuestion.value = ''
}
</script>

<template>
  <div class="game-container">
    <h2 class="game-title">동전 진실게임</h2>

    <!-- Setup Phase -->
    <div v-if="gamePhase === 'setup'" class="setup-section">
      <div class="coin-icon">🪙</div>
      <p class="description">
        질문에 대해 각자 진실/거짓을 선택하고,<br>
        몇 명이 진실인지 맞춰보세요!
      </p>

      <div class="input-section">
        <input
          v-model="newParticipant"
          placeholder="참가자 이름 입력"
          @keypress="handleKeypress"
        />
        <button class="btn btn-small" @click="addParticipant">추가</button>
      </div>

      <div class="participant-list">
        <div
          v-for="(person, index) in participants"
          :key="index"
          class="participant-tag"
        >
          {{ person }}
          <span class="remove" @click="removeParticipant(index)">×</span>
        </div>
      </div>

      <div v-if="participants.length < 2" class="notice">
        최소 2명의 참가자가 필요합니다
      </div>

      <button
        class="btn"
        @click="startGame"
        :disabled="participants.length < 2"
      >
        게임 시작!
      </button>
    </div>

    <!-- Question Phase -->
    <div v-if="gamePhase === 'question'" class="question-section">
      <div class="question-box">
        <div class="question-label">이번 질문</div>
        <div class="question-text">{{ currentQuestion }}</div>
      </div>

      <p class="instruction">
        모든 참가자가 질문을 확인했으면<br>
        투표를 시작하세요!
      </p>

      <button class="btn" @click="startVoting">
        투표 시작!
      </button>
    </div>

    <!-- Voting Phase -->
    <div v-if="gamePhase === 'voting'" class="voting-section">
      <div class="player-turn">
        <span class="player-name">{{ currentPlayer }}</span>의 차례
      </div>

      <div class="question-mini">{{ currentQuestion }}</div>

      <div class="choice-section">
        <p class="choice-label">나에게 해당되는가?</p>
        <div class="coin-buttons">
          <button
            class="coin-btn truth"
            :class="{ selected: playerChoice === 'truth' }"
            @click="playerChoice = 'truth'"
          >
            <span class="coin-face">앞</span>
            <span class="coin-text">진실</span>
          </button>
          <button
            class="coin-btn lie"
            :class="{ selected: playerChoice === 'lie' }"
            @click="playerChoice = 'lie'"
          >
            <span class="coin-face">뒤</span>
            <span class="coin-text">거짓</span>
          </button>
        </div>
      </div>

      <div class="guess-section">
        <p class="guess-label">몇 명이 진실일까?</p>
        <div class="guess-buttons">
          <button
            v-for="n in participants.length"
            :key="n"
            class="guess-btn"
            :class="{ selected: playerGuess === String(n) }"
            @click="playerGuess = String(n)"
          >
            {{ n }}
          </button>
          <button
            class="guess-btn"
            :class="{ selected: playerGuess === '0' }"
            @click="playerGuess = '0'"
          >
            0
          </button>
        </div>
      </div>

      <button
        class="btn"
        @click="submitVote"
        :disabled="!playerChoice || playerGuess === ''"
      >
        제출 ({{ currentPlayerIndex + 1 }}/{{ participants.length }})
      </button>
    </div>

    <!-- Result Phase -->
    <div v-if="gamePhase === 'result'" class="result-section">
      <div class="result-header">
        <div class="truth-count">
          <span class="count-number">{{ truthCount }}</span>
          <span class="count-label">명이 진실!</span>
        </div>
      </div>

      <div class="votes-list">
        <div
          v-for="vote in votes"
          :key="vote.name"
          class="vote-item"
          :class="{ winner: vote.guess === truthCount }"
        >
          <span class="vote-name">{{ vote.name }}</span>
          <span class="vote-choice" :class="vote.choice">
            {{ vote.choice === 'truth' ? '진실' : '거짓' }}
          </span>
          <span class="vote-guess">
            예측: {{ vote.guess }}명
            <span v-if="vote.guess === truthCount" class="correct">정답!</span>
          </span>
        </div>
      </div>

      <div v-if="winners.length > 0" class="winners-box">
        <span class="winner-icon">🎉</span>
        <span class="winner-text">
          정답자: {{ winners.join(', ') }}
        </span>
      </div>
      <div v-else class="no-winner">
        아무도 못 맞췄네요! 😅
      </div>

      <div class="button-group">
        <button class="btn" @click="nextRound">
          다음 라운드
        </button>
        <button class="btn btn-secondary btn-small" @click="resetGame">
          처음으로
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.game-container {
  text-align: center;
  padding: 40px 20px;
  width: 100%;
  max-width: 500px;
}

.coin-icon {
  font-size: 5rem;
  margin-bottom: 15px;
}

.description {
  color: var(--text-secondary);
  margin-bottom: 25px;
  line-height: 1.6;
}

.input-section {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.input-section input {
  flex: 1;
}

.notice {
  color: var(--text-secondary);
  padding: 20px;
}

.question-section {
  padding: 30px 0;
}

.question-box {
  background: linear-gradient(145deg, rgba(255, 215, 0, 0.2), rgba(255, 165, 0, 0.1));
  border: 2px solid var(--neon-yellow);
  border-radius: 20px;
  padding: 30px 20px;
  margin-bottom: 25px;
}

.question-label {
  font-size: 0.9rem;
  color: var(--neon-yellow);
  margin-bottom: 15px;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.question-text {
  font-size: 1.4rem;
  font-weight: 600;
  line-height: 1.5;
}

.instruction {
  color: var(--text-secondary);
  margin-bottom: 25px;
  line-height: 1.6;
}

.voting-section {
  padding: 20px 0;
}

.player-turn {
  margin-bottom: 20px;
}

.player-name {
  font-size: 1.8rem;
  font-weight: 700;
  background: linear-gradient(90deg, var(--neon-yellow), var(--neon-pink));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.question-mini {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 15px;
  padding: 15px;
  margin-bottom: 25px;
  font-size: 1rem;
}

.choice-section {
  margin-bottom: 25px;
}

.choice-label, .guess-label {
  color: var(--text-secondary);
  margin-bottom: 15px;
  font-size: 1rem;
}

.coin-buttons {
  display: flex;
  gap: 20px;
  justify-content: center;
}

.coin-btn {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  border: 4px solid transparent;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
}

.coin-btn.truth {
  background: linear-gradient(145deg, #ffd700, #ffaa00);
  color: #1a1a2e;
}

.coin-btn.lie {
  background: linear-gradient(145deg, #c0c0c0, #808080);
  color: #1a1a2e;
}

.coin-btn:hover {
  transform: scale(1.1);
}

.coin-btn.selected {
  border-color: white;
  box-shadow: 0 0 30px rgba(255, 255, 255, 0.5);
  transform: scale(1.1);
}

.coin-face {
  font-size: 1.5rem;
  font-weight: 800;
}

.coin-text {
  font-size: 0.9rem;
  font-weight: 600;
}

.guess-section {
  margin-bottom: 25px;
}

.guess-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
}

.guess-btn {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 1.2rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.guess-btn:hover {
  border-color: var(--neon-yellow);
}

.guess-btn.selected {
  background: var(--neon-yellow);
  color: #1a1a2e;
  border-color: var(--neon-yellow);
}

.result-section {
  padding: 20px 0;
}

.result-header {
  margin-bottom: 25px;
}

.truth-count {
  background: linear-gradient(145deg, rgba(255, 215, 0, 0.2), rgba(255, 165, 0, 0.1));
  border: 2px solid var(--neon-yellow);
  border-radius: 20px;
  padding: 25px;
  display: inline-block;
}

.count-number {
  font-size: 4rem;
  font-weight: 800;
  color: var(--neon-yellow);
}

.count-label {
  font-size: 1.2rem;
  margin-left: 10px;
}

.votes-list {
  background: linear-gradient(145deg, var(--bg-card), var(--bg-secondary));
  border-radius: 20px;
  padding: 15px;
  margin-bottom: 20px;
}

.vote-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 15px;
  border-radius: 10px;
  margin-bottom: 8px;
  background: rgba(255, 255, 255, 0.05);
}

.vote-item:last-child {
  margin-bottom: 0;
}

.vote-item.winner {
  background: rgba(255, 215, 0, 0.2);
  border: 1px solid var(--neon-yellow);
}

.vote-name {
  font-weight: 600;
  flex: 1;
  text-align: left;
}

.vote-choice {
  padding: 4px 12px;
  border-radius: 15px;
  font-size: 0.85rem;
  font-weight: 600;
  margin: 0 10px;
}

.vote-choice.truth {
  background: linear-gradient(135deg, #ffd700, #ffaa00);
  color: #1a1a2e;
}

.vote-choice.lie {
  background: linear-gradient(135deg, #c0c0c0, #808080);
  color: #1a1a2e;
}

.vote-guess {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.correct {
  color: var(--neon-yellow);
  font-weight: 700;
  margin-left: 5px;
}

.winners-box {
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.3), rgba(255, 165, 0, 0.2));
  border: 2px solid var(--neon-yellow);
  border-radius: 15px;
  padding: 20px;
  margin-bottom: 25px;
}

.winner-icon {
  font-size: 1.5rem;
  margin-right: 10px;
}

.winner-text {
  font-size: 1.1rem;
  font-weight: 600;
}

.no-winner {
  color: var(--text-secondary);
  padding: 20px;
  margin-bottom: 25px;
}

.button-group {
  display: flex;
  gap: 15px;
  justify-content: center;
  flex-wrap: wrap;
}

@media (max-width: 480px) {
  .coin-btn {
    width: 100px;
    height: 100px;
  }

  .vote-item {
    flex-wrap: wrap;
    gap: 8px;
  }

  .vote-guess {
    width: 100%;
    text-align: right;
  }
}
</style>
