<script setup>
import { ref, computed } from 'vue'
import { rankingQuestions } from '../data/gameData'

const participants = ref([])
const newParticipant = ref('')
const gamePhase = ref('setup') // setup, ranking, reveal
const currentKing = ref('')
const currentQuestion = ref('')
const rankings = ref([]) // 왕이 정한 순위 [{rank: 1, name: '철수'}, ...]
const penaltyRank = ref(0)
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

const startRound = () => {
  if (participants.value.length < 2) return

  // 랜덤으로 왕 선정
  const kingIndex = Math.floor(Math.random() * participants.value.length)
  currentKing.value = participants.value[kingIndex]

  // 랜덤 질문 선택
  const available = rankingQuestions.filter((_, i) => !usedQuestions.value.includes(i))
  if (available.length === 0) {
    usedQuestions.value = []
    currentQuestion.value = rankingQuestions[Math.floor(Math.random() * rankingQuestions.length)]
  } else {
    const idx = Math.floor(Math.random() * available.length)
    const originalIdx = rankingQuestions.indexOf(available[idx])
    usedQuestions.value.push(originalIdx)
    currentQuestion.value = available[idx]
  }

  // 순위 초기화
  rankings.value = participants.value.map((name, index) => ({
    rank: index + 1,
    name: name
  }))

  penaltyRank.value = 0
  gamePhase.value = 'ranking'
}

const moveUp = (index) => {
  if (index === 0) return
  const temp = rankings.value[index]
  rankings.value[index] = rankings.value[index - 1]
  rankings.value[index - 1] = temp
  updateRanks()
}

const moveDown = (index) => {
  if (index === rankings.value.length - 1) return
  const temp = rankings.value[index]
  rankings.value[index] = rankings.value[index + 1]
  rankings.value[index + 1] = temp
  updateRanks()
}

const updateRanks = () => {
  rankings.value.forEach((item, index) => {
    item.rank = index + 1
  })
}

const revealPenalty = () => {
  // 랜덤 벌칙 랭킹 선정
  penaltyRank.value = Math.floor(Math.random() * participants.value.length) + 1
  gamePhase.value = 'reveal'
}

const penaltyPerson = computed(() => {
  const found = rankings.value.find(r => r.rank === penaltyRank.value)
  return found ? found.name : ''
})

const nextRound = () => {
  startRound()
}

const resetGame = () => {
  gamePhase.value = 'setup'
  currentKing.value = ''
  currentQuestion.value = ''
  rankings.value = []
  penaltyRank.value = 0
}
</script>

<template>
  <div class="game-container">
    <h2 class="game-title">랭킹게임</h2>

    <!-- Setup Phase -->
    <div v-if="gamePhase === 'setup'" class="setup-section">
      <div class="crown-icon">👑</div>
      <p class="description">
        왕이 되어 친구들의 순위를 매겨보세요!<br>
        벌칙 랭킹에 걸리면 벌칙!
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
        @click="startRound"
        :disabled="participants.length < 2"
      >
        게임 시작!
      </button>
    </div>

    <!-- Ranking Phase -->
    <div v-if="gamePhase === 'ranking'" class="ranking-section">
      <div class="king-banner">
        <span class="crown">👑</span>
        <span class="king-name">{{ currentKing }}</span>
        <span class="king-label">의 차례</span>
      </div>

      <div class="question-box">
        <div class="question-text">{{ currentQuestion }}</div>
      </div>

      <p class="instruction">순위를 정해주세요! (위아래 버튼으로 조정)</p>

      <div class="ranking-list">
        <div
          v-for="(item, index) in rankings"
          :key="item.name"
          class="ranking-item"
        >
          <span class="rank-number">{{ item.rank }}</span>
          <span class="rank-name">{{ item.name }}</span>
          <div class="rank-controls">
            <button
              class="control-btn"
              @click="moveUp(index)"
              :disabled="index === 0"
            >▲</button>
            <button
              class="control-btn"
              @click="moveDown(index)"
              :disabled="index === rankings.length - 1"
            >▼</button>
          </div>
        </div>
      </div>

      <button class="btn reveal-btn" @click="revealPenalty">
        🎲 벌칙 랭킹 보기!
      </button>
    </div>

    <!-- Reveal Phase -->
    <div v-if="gamePhase === 'reveal'" class="reveal-section">
      <div class="king-info">
        <span class="crown">👑</span> {{ currentKing }}의 선택
      </div>

      <div class="question-mini">{{ currentQuestion }}</div>

      <div class="final-ranking">
        <div
          v-for="item in rankings"
          :key="item.name"
          class="final-rank-item"
          :class="{ penalty: item.rank === penaltyRank }"
        >
          <span class="final-rank-number">{{ item.rank }}위</span>
          <span class="final-rank-name">{{ item.name }}</span>
          <span v-if="item.rank === penaltyRank" class="penalty-badge">벌칙!</span>
        </div>
      </div>

      <div class="penalty-result">
        <div class="penalty-rank-display">
          벌칙 랭킹: <span class="penalty-number">{{ penaltyRank }}위</span>
        </div>
        <div class="penalty-person">
          <span class="penalty-icon">🍺</span>
          <span class="penalty-name">{{ penaltyPerson }}</span>
          <span class="penalty-text">벌칙!</span>
        </div>
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

.crown-icon {
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

.ranking-section {
  padding: 20px 0;
}

.king-banner {
  background: linear-gradient(135deg, #ffd700, #ffaa00);
  color: #1a1a2e;
  padding: 15px 25px;
  border-radius: 15px;
  margin-bottom: 20px;
  display: inline-block;
}

.crown {
  font-size: 1.5rem;
  margin-right: 8px;
}

.king-name {
  font-size: 1.5rem;
  font-weight: 800;
}

.king-label {
  font-size: 1rem;
}

.question-box {
  background: linear-gradient(145deg, var(--bg-card), var(--bg-secondary));
  border: 2px solid var(--neon-purple);
  border-radius: 20px;
  padding: 25px 20px;
  margin-bottom: 20px;
}

.question-text {
  font-size: 1.2rem;
  font-weight: 600;
  line-height: 1.5;
}

.instruction {
  color: var(--text-secondary);
  margin-bottom: 15px;
  font-size: 0.95rem;
}

.ranking-list {
  background: linear-gradient(145deg, var(--bg-card), var(--bg-secondary));
  border-radius: 20px;
  padding: 15px;
  margin-bottom: 25px;
}

.ranking-item {
  display: flex;
  align-items: center;
  padding: 12px 15px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  margin-bottom: 8px;
}

.ranking-item:last-child {
  margin-bottom: 0;
}

.rank-number {
  width: 35px;
  height: 35px;
  background: linear-gradient(135deg, var(--neon-purple), var(--accent));
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  margin-right: 15px;
}

.rank-name {
  flex: 1;
  text-align: left;
  font-weight: 600;
  font-size: 1.1rem;
}

.rank-controls {
  display: flex;
  gap: 5px;
}

.control-btn {
  width: 35px;
  height: 35px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.control-btn:hover:not(:disabled) {
  background: var(--neon-purple);
}

.control-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.reveal-btn {
  font-size: 1.3rem;
  padding: 18px 40px;
}

.reveal-section {
  padding: 20px 0;
}

.king-info {
  color: var(--neon-yellow);
  font-size: 1.1rem;
  margin-bottom: 15px;
}

.question-mini {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 15px;
  padding: 15px;
  margin-bottom: 20px;
  font-size: 1rem;
}

.final-ranking {
  background: linear-gradient(145deg, var(--bg-card), var(--bg-secondary));
  border-radius: 20px;
  padding: 15px;
  margin-bottom: 20px;
}

.final-rank-item {
  display: flex;
  align-items: center;
  padding: 12px 15px;
  border-radius: 10px;
  margin-bottom: 8px;
  background: rgba(255, 255, 255, 0.05);
}

.final-rank-item:last-child {
  margin-bottom: 0;
}

.final-rank-item.penalty {
  background: linear-gradient(135deg, rgba(233, 69, 96, 0.3), rgba(255, 46, 99, 0.2));
  border: 2px solid var(--neon-pink);
  animation: pulse-penalty 1s infinite;
}

@keyframes pulse-penalty {
  0%, 100% { box-shadow: 0 0 10px rgba(255, 46, 99, 0.3); }
  50% { box-shadow: 0 0 25px rgba(255, 46, 99, 0.6); }
}

.final-rank-number {
  width: 50px;
  font-weight: 700;
  color: var(--neon-purple);
}

.final-rank-name {
  flex: 1;
  text-align: left;
  font-weight: 600;
}

.penalty-badge {
  background: var(--neon-pink);
  padding: 4px 12px;
  border-radius: 15px;
  font-size: 0.85rem;
  font-weight: 700;
}

.penalty-result {
  background: linear-gradient(145deg, rgba(233, 69, 96, 0.2), rgba(255, 46, 99, 0.1));
  border: 2px solid var(--neon-pink);
  border-radius: 20px;
  padding: 25px;
  margin-bottom: 25px;
}

.penalty-rank-display {
  font-size: 1.1rem;
  margin-bottom: 15px;
  color: var(--text-secondary);
}

.penalty-number {
  color: var(--neon-pink);
  font-weight: 700;
  font-size: 1.3rem;
}

.penalty-person {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.penalty-icon {
  font-size: 2rem;
}

.penalty-name {
  font-size: 2rem;
  font-weight: 800;
  background: linear-gradient(90deg, var(--neon-pink), var(--accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.penalty-text {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--neon-pink);
}

.button-group {
  display: flex;
  gap: 15px;
  justify-content: center;
  flex-wrap: wrap;
}

@media (max-width: 480px) {
  .king-name {
    font-size: 1.2rem;
  }

  .question-text {
    font-size: 1rem;
  }

  .penalty-name {
    font-size: 1.5rem;
  }
}
</style>
