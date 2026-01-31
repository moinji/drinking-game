<script setup>
import { ref } from 'vue'
import { truthQuestions, dares } from '../data/gameData'

const currentChoice = ref('')
const currentContent = ref('')
const isRevealing = ref(false)

const selectTruth = () => {
  reveal('truth')
}

const selectDare = () => {
  reveal('dare')
}

const reveal = (choice) => {
  isRevealing.value = true
  currentChoice.value = choice
  currentContent.value = ''

  const list = choice === 'truth' ? truthQuestions : dares
  let count = 0
  const maxCount = 10

  const interval = setInterval(() => {
    currentContent.value = list[Math.floor(Math.random() * list.length)]
    count++

    if (count >= maxCount) {
      clearInterval(interval)
      isRevealing.value = false
    }
  }, 100)
}

const reset = () => {
  currentChoice.value = ''
  currentContent.value = ''
}
</script>

<template>
  <div class="game-container">
    <h2 class="game-title">진실 혹은 도전</h2>

    <div v-if="!currentChoice" class="choice-section">
      <p class="instruction">무엇을 선택할까요?</p>
      <div class="choice-buttons">
        <button class="choice-btn truth" @click="selectTruth">
          진실
        </button>
        <button class="choice-btn dare" @click="selectDare">
          도전
        </button>
      </div>
    </div>

    <div v-else class="result-section">
      <div class="choice-label" :class="currentChoice">
        {{ currentChoice === 'truth' ? '진실' : '도전' }}
      </div>

      <div class="result-box" :class="{ spinning: isRevealing }">
        {{ currentContent }}
      </div>

      <button class="btn" @click="reset" :disabled="isRevealing">
        다시 선택하기
      </button>
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

.instruction {
  color: var(--text-secondary);
  font-size: 1.2rem;
  margin-bottom: 30px;
}

.choice-section {
  padding: 40px 0;
}

.result-section {
  padding: 20px 0;
}

.choice-label {
  font-size: 2rem;
  font-weight: 800;
  margin-bottom: 20px;
  padding: 10px 30px;
  border-radius: 15px;
  display: inline-block;
}

.choice-label.truth {
  background: linear-gradient(135deg, var(--neon-blue), #06b6d4);
}

.choice-label.dare {
  background: linear-gradient(135deg, var(--neon-pink), var(--accent));
}

.result-box.spinning {
  animation: pulse 0.1s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}
</style>
