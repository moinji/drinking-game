<script setup>
import { ref, onUnmounted } from 'vue'
import { bombTopics } from '../data/gameData'

const currentTopic = ref('')
const isPlaying = ref(false)
const isExploded = ref(false)
const timeLeft = ref(0)

let timer = null

const startGame = () => {
  isExploded.value = false
  isPlaying.value = true
  currentTopic.value = bombTopics[Math.floor(Math.random() * bombTopics.length)]

  const randomTime = Math.floor(Math.random() * 15) + 5
  timeLeft.value = randomTime

  timer = setInterval(() => {
    timeLeft.value--
    if (timeLeft.value <= 0) {
      explode()
    }
  }, 1000)
}

const explode = () => {
  clearInterval(timer)
  isPlaying.value = false
  isExploded.value = true
}

const passBomb = () => {
  // 폭탄 돌리기는 실제로는 사람들이 돌리는 것이므로
  // 여기서는 단순히 시간이 흐르게 함
}

const resetGame = () => {
  clearInterval(timer)
  isPlaying.value = false
  isExploded.value = false
  currentTopic.value = ''
  timeLeft.value = 0
}

onUnmounted(() => {
  clearInterval(timer)
})
</script>

<template>
  <div class="game-container">
    <h2 class="game-title">폭탄 돌리기</h2>

    <div class="bomb-container">
      <div v-if="!isPlaying && !isExploded" class="start-section">
        <div class="bomb-icon">💣</div>
        <p>주제에 맞는 답을 말하고 폭탄을 넘기세요!</p>
        <p>시간이 다 되면 폭탄이 터집니다!</p>
      </div>

      <div v-if="isPlaying" class="playing-section">
        <div class="bomb-icon">💣</div>
        <div class="topic-display">주제: {{ currentTopic }}</div>
        <div class="timer-display">⏱️ {{ timeLeft }}초</div>
        <p>빨리 답을 말하고 다음 사람에게 넘기세요!</p>
      </div>

      <div v-if="isExploded" class="exploded-section">
        <div class="bomb-icon exploded">💥</div>
        <div class="result-box">펑! 벌칙이다!</div>
      </div>
    </div>

    <div class="button-group">
      <button v-if="!isPlaying && !isExploded" class="btn" @click="startGame">
        게임 시작!
      </button>
      <button v-if="isExploded" class="btn" @click="resetGame">
        다시 하기
      </button>
      <button v-if="isPlaying" class="btn btn-secondary" @click="resetGame">
        게임 중단
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

.bomb-container {
  min-height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.start-section p,
.playing-section p {
  color: var(--text-secondary);
  margin-top: 15px;
}

.button-group {
  display: flex;
  gap: 15px;
  justify-content: center;
  margin-top: 20px;
}

.exploded-section .result-box {
  margin-top: 20px;
}
</style>
