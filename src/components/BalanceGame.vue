<script setup>
import { ref, computed } from 'vue'
import { balanceQuestions } from '../data/gameData'

const currentQuestion = ref(null)
const selectedChoice = ref('')
const usedQuestions = ref([])
const votesA = ref(0)
const votesB = ref(0)
const showVotes = ref(false)

const getRandomQuestion = () => {
  selectedChoice.value = ''
  showVotes.value = false
  votesA.value = 0
  votesB.value = 0

  const availableQuestions = balanceQuestions.filter(
    (_, index) => !usedQuestions.value.includes(index)
  )

  if (availableQuestions.length === 0) {
    usedQuestions.value = []
    currentQuestion.value = balanceQuestions[Math.floor(Math.random() * balanceQuestions.length)]
  } else {
    const randomIndex = Math.floor(Math.random() * availableQuestions.length)
    const originalIndex = balanceQuestions.indexOf(availableQuestions[randomIndex])
    usedQuestions.value.push(originalIndex)
    currentQuestion.value = availableQuestions[randomIndex]
  }
}

const selectChoice = (choice) => {
  if (selectedChoice.value) return
  selectedChoice.value = choice
}

const addVote = (choice) => {
  if (choice === 'a') {
    votesA.value++
  } else {
    votesB.value++
  }
}

const toggleVotes = () => {
  showVotes.value = !showVotes.value
}

const totalVotes = computed(() => votesA.value + votesB.value)
const percentA = computed(() => totalVotes.value > 0 ? Math.round((votesA.value / totalVotes.value) * 100) : 50)
const percentB = computed(() => totalVotes.value > 0 ? Math.round((votesB.value / totalVotes.value) * 100) : 50)

const reset = () => {
  currentQuestion.value = null
  selectedChoice.value = ''
  showVotes.value = false
  votesA.value = 0
  votesB.value = 0
}
</script>

<template>
  <div class="game-container">
    <h2 class="game-title">밸런스 게임</h2>

    <div v-if="!currentQuestion" class="start-section">
      <div class="balance-icon">⚖️</div>
      <p>둘 중 하나를 선택해야 한다면?</p>
      <button class="btn" @click="getRandomQuestion">
        시작하기!
      </button>
    </div>

    <div v-else class="question-section">
      <div class="vs-container">
        <div
          class="choice-card choice-a"
          :class="{ selected: selectedChoice === 'a', faded: selectedChoice === 'b' }"
          @click="selectChoice('a')"
        >
          <div class="choice-text">{{ currentQuestion.a }}</div>
          <div v-if="showVotes" class="vote-bar">
            <div class="vote-fill" :style="{ width: percentA + '%' }"></div>
            <span class="vote-percent">{{ percentA }}%</span>
          </div>
        </div>

        <div class="vs-badge">VS</div>

        <div
          class="choice-card choice-b"
          :class="{ selected: selectedChoice === 'b', faded: selectedChoice === 'a' }"
          @click="selectChoice('b')"
        >
          <div class="choice-text">{{ currentQuestion.b }}</div>
          <div v-if="showVotes" class="vote-bar">
            <div class="vote-fill" :style="{ width: percentB + '%' }"></div>
            <span class="vote-percent">{{ percentB }}%</span>
          </div>
        </div>
      </div>

      <div v-if="selectedChoice" class="vote-section">
        <p class="vote-instruction">다른 사람들도 투표해보세요!</p>
        <div class="vote-buttons">
          <button class="vote-btn vote-a" @click="addVote('a')">A 투표</button>
          <button class="vote-btn vote-b" @click="addVote('b')">B 투표</button>
        </div>
        <button class="btn btn-small btn-secondary" @click="toggleVotes">
          {{ showVotes ? '결과 숨기기' : '결과 보기' }} ({{ totalVotes }}표)
        </button>
      </div>

      <div class="button-group">
        <button class="btn" @click="getRandomQuestion">
          다음 질문
        </button>
        <button class="btn btn-secondary btn-small" @click="reset">
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

.start-section {
  padding: 40px 0;
}

.start-section p {
  color: var(--text-secondary);
  margin: 20px 0 30px;
  font-size: 1.1rem;
}

.balance-icon {
  font-size: 5rem;
  margin-bottom: 10px;
}

.question-section {
  padding: 20px 0;
}

.vs-container {
  display: flex;
  flex-direction: column;
  gap: 15px;
  position: relative;
  margin-bottom: 25px;
}

.choice-card {
  background: linear-gradient(145deg, var(--bg-card), var(--bg-secondary));
  border-radius: 20px;
  padding: 30px 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 3px solid transparent;
  position: relative;
  overflow: hidden;
}

.choice-card.choice-a {
  border-color: rgba(255, 46, 99, 0.3);
}

.choice-card.choice-b {
  border-color: rgba(8, 217, 214, 0.3);
}

.choice-card:hover {
  transform: scale(1.02);
}

.choice-card.selected {
  transform: scale(1.05);
}

.choice-card.choice-a.selected {
  border-color: var(--neon-pink);
  box-shadow: 0 0 30px rgba(255, 46, 99, 0.4);
}

.choice-card.choice-b.selected {
  border-color: var(--neon-blue);
  box-shadow: 0 0 30px rgba(8, 217, 214, 0.4);
}

.choice-card.faded {
  opacity: 0.5;
  transform: scale(0.95);
}

.choice-text {
  font-size: 1.3rem;
  font-weight: 600;
  line-height: 1.4;
}

.vs-badge {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  background: linear-gradient(135deg, var(--neon-purple), var(--accent));
  width: 50px;
  height: 50px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 1rem;
  z-index: 10;
  box-shadow: 0 0 20px rgba(168, 85, 247, 0.5);
}

.vote-section {
  margin: 25px 0;
}

.vote-instruction {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin-bottom: 15px;
}

.vote-buttons {
  display: flex;
  gap: 15px;
  justify-content: center;
  margin-bottom: 15px;
}

.vote-btn {
  padding: 10px 25px;
  border-radius: 25px;
  border: none;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  color: white;
}

.vote-btn.vote-a {
  background: linear-gradient(135deg, var(--neon-pink), var(--accent));
}

.vote-btn.vote-b {
  background: linear-gradient(135deg, var(--neon-blue), #06b6d4);
}

.vote-btn:hover {
  transform: scale(1.1);
}

.vote-bar {
  margin-top: 15px;
  height: 30px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 15px;
  overflow: hidden;
  position: relative;
}

.vote-fill {
  height: 100%;
  border-radius: 15px;
  transition: width 0.5s ease;
}

.choice-a .vote-fill {
  background: linear-gradient(90deg, var(--neon-pink), var(--accent));
}

.choice-b .vote-fill {
  background: linear-gradient(90deg, var(--neon-blue), #06b6d4);
}

.vote-percent {
  position: absolute;
  right: 15px;
  top: 50%;
  transform: translateY(-50%);
  font-weight: 700;
  font-size: 0.9rem;
}

.button-group {
  display: flex;
  gap: 15px;
  justify-content: center;
  margin-top: 20px;
  flex-wrap: wrap;
}

@media (max-width: 480px) {
  .choice-text {
    font-size: 1.1rem;
  }

  .vote-buttons {
    flex-direction: column;
  }
}
</style>
