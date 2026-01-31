<script setup>
import { ref, computed } from 'vue'
import { malePreferences } from '../data/gameData'

const currentIndex = ref(0)
const selections = ref([])
const isFinished = ref(false)
const isRevealing = ref(false)

const currentQuestion = computed(() => malePreferences[currentIndex.value])
const progress = computed(() => Math.round((currentIndex.value / malePreferences.length) * 100))

const selectChoice = (choice) => {
  if (isRevealing.value) return

  isRevealing.value = true
  selections.value.push({
    question: currentQuestion.value,
    choice: choice
  })

  setTimeout(() => {
    if (currentIndex.value < malePreferences.length - 1) {
      currentIndex.value++
    } else {
      isFinished.value = true
    }
    isRevealing.value = false
  }, 300)
}

const restart = () => {
  currentIndex.value = 0
  selections.value = []
  isFinished.value = false
}

const getChoiceText = (selection) => {
  return selection.choice === 'a' ? selection.question.a : selection.question.b
}
</script>

<template>
  <div class="game-container">
    <h2 class="game-title">남자 취향 선택</h2>

    <div v-if="!isFinished" class="question-section">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progress + '%' }"></div>
      </div>
      <div class="progress-text">{{ currentIndex + 1 }} / {{ malePreferences.length }}</div>

      <div class="vs-container">
        <div
          class="choice-card choice-a"
          :class="{ selecting: isRevealing }"
          @click="selectChoice('a')"
        >
          <div class="choice-text">{{ currentQuestion.a }}</div>
        </div>

        <div class="vs-badge">VS</div>

        <div
          class="choice-card choice-b"
          :class="{ selecting: isRevealing }"
          @click="selectChoice('b')"
        >
          <div class="choice-text">{{ currentQuestion.b }}</div>
        </div>
      </div>
    </div>

    <div v-else class="result-section">
      <div class="result-header">
        <div class="result-icon">💘</div>
        <h3>나의 이상형은...</h3>
      </div>

      <div class="result-list">
        <div
          v-for="(selection, index) in selections"
          :key="index"
          class="result-item"
        >
          <span class="result-number">{{ index + 1 }}</span>
          <span class="result-choice">{{ getChoiceText(selection) }}</span>
        </div>
      </div>

      <button class="btn" @click="restart">
        다시 하기
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

.progress-bar {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 10px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--neon-pink), var(--neon-purple));
  transition: width 0.3s ease;
}

.progress-text {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin-bottom: 25px;
}

.vs-container {
  display: flex;
  flex-direction: column;
  gap: 15px;
  position: relative;
}

.choice-card {
  background: linear-gradient(145deg, var(--bg-card), var(--bg-secondary));
  border-radius: 20px;
  padding: 35px 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 3px solid transparent;
}

.choice-card.choice-a {
  border-color: rgba(255, 107, 157, 0.3);
}

.choice-card.choice-b {
  border-color: rgba(255, 107, 157, 0.3);
}

.choice-card:hover {
  transform: scale(1.03);
  border-color: var(--neon-pink);
  box-shadow: 0 0 25px rgba(255, 46, 99, 0.3);
}

.choice-card.selecting {
  opacity: 0.7;
  pointer-events: none;
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
  background: linear-gradient(135deg, #ff6b9d, #ff2e63);
  width: 50px;
  height: 50px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 1rem;
  z-index: 10;
  box-shadow: 0 0 20px rgba(255, 107, 157, 0.5);
}

.result-section {
  padding: 20px 0;
}

.result-header {
  margin-bottom: 25px;
}

.result-icon {
  font-size: 4rem;
  margin-bottom: 10px;
}

.result-header h3 {
  font-size: 1.5rem;
  background: linear-gradient(90deg, var(--neon-pink), #ff6b9d);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.result-list {
  background: linear-gradient(145deg, var(--bg-card), var(--bg-secondary));
  border-radius: 20px;
  padding: 20px;
  margin-bottom: 25px;
  max-height: 400px;
  overflow-y: auto;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.result-item:last-child {
  border-bottom: none;
}

.result-number {
  background: linear-gradient(135deg, var(--neon-pink), #ff6b9d);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 700;
  flex-shrink: 0;
}

.result-choice {
  font-size: 1rem;
  text-align: left;
}

@media (max-width: 480px) {
  .choice-text {
    font-size: 1.1rem;
  }

  .result-list {
    max-height: 300px;
  }
}
</style>
