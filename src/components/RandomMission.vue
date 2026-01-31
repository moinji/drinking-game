<script setup>
import { ref } from 'vue'
import { missions } from '../data/gameData'

const currentMission = ref('')
const isSpinning = ref(false)

const getRandomMission = () => {
  if (isSpinning.value) return

  isSpinning.value = true
  currentMission.value = ''

  let count = 0
  const maxCount = 15
  const interval = setInterval(() => {
    currentMission.value = missions[Math.floor(Math.random() * missions.length)]
    count++

    if (count >= maxCount) {
      clearInterval(interval)
      isSpinning.value = false
    }
  }, 100)
}
</script>

<template>
  <div class="game-container">
    <h2 class="game-title">랜덤 미션</h2>

    <div class="result-box" :class="{ spinning: isSpinning }">
      {{ currentMission || '버튼을 눌러 미션을 뽑아보세요!' }}
    </div>

    <button class="btn" @click="getRandomMission" :disabled="isSpinning">
      {{ isSpinning ? '뽑는 중...' : '미션 뽑기!' }}
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

.result-box.spinning {
  animation: pulse 0.1s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}
</style>
