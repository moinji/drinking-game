<script setup>
import { ref } from 'vue'
import { whisperQuestions } from '../data/gameData'

const currentQuestion = ref('')
const isRevealing = ref(false)
const questionCount = ref(0)

const getRandomQuestion = () => {
  if (isRevealing.value) return

  isRevealing.value = true
  currentQuestion.value = ''

  let count = 0
  const maxCount = 12

  const interval = setInterval(() => {
    currentQuestion.value = whisperQuestions[Math.floor(Math.random() * whisperQuestions.length)]
    count++

    if (count >= maxCount) {
      clearInterval(interval)
      isRevealing.value = false
      questionCount.value++
    }
  }, 80)
}
</script>

<template>
  <div class="game-container">
    <h2 class="game-title">귓속말게임</h2>

    <div class="whisper-icon">🤫</div>

    <p class="description" v-if="!currentQuestion">
      질문을 보고 해당하는 사람을<br>
      옆 사람 귀에 속삭여주세요!
    </p>

    <div class="question-box" :class="{ revealing: isRevealing }">
      <div class="question-text">
        {{ currentQuestion || '버튼을 눌러 질문을 확인하세요!' }}
      </div>
    </div>

    <div v-if="questionCount > 0" class="question-count">
      {{ questionCount }}번째 질문
    </div>

    <button class="btn" @click="getRandomQuestion" :disabled="isRevealing">
      {{ isRevealing ? '뽑는 중...' : currentQuestion ? '다음 질문' : '질문 뽑기!' }}
    </button>
  </div>
</template>

<style scoped>
.game-container {
  text-align: center;
  padding: 40px 20px;
  width: 100%;
  max-width: 500px;
}

.whisper-icon {
  font-size: 5rem;
  margin-bottom: 20px;
}

.description {
  color: var(--text-secondary);
  margin-bottom: 25px;
  line-height: 1.6;
  font-size: 1.1rem;
}

.question-box {
  background: linear-gradient(145deg, rgba(168, 85, 247, 0.2), rgba(139, 92, 246, 0.1));
  border: 2px solid var(--neon-purple);
  border-radius: 25px;
  padding: 40px 25px;
  margin: 25px 0;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.question-box.revealing {
  animation: pulse-question 0.1s infinite;
}

@keyframes pulse-question {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.01); }
}

.question-text {
  font-size: 1.4rem;
  font-weight: 600;
  line-height: 1.5;
  color: white;
}

.question-count {
  color: var(--neon-purple);
  font-size: 0.95rem;
  margin-bottom: 20px;
}

.btn {
  font-size: 1.2rem;
  padding: 18px 50px;
}

@media (max-width: 480px) {
  .question-text {
    font-size: 1.2rem;
  }

  .question-box {
    padding: 30px 20px;
  }
}
</style>
