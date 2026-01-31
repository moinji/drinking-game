<script setup>
import { ref, computed } from 'vue'

const participants = ref([])
const newParticipant = ref('')
const selectedPerson = ref('')
const isSpinning = ref(false)
const rotation = ref(0)

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

const spinRoulette = () => {
  if (participants.value.length < 2 || isSpinning.value) return

  isSpinning.value = true
  selectedPerson.value = ''

  const randomIndex = Math.floor(Math.random() * participants.value.length)
  const segmentAngle = 360 / participants.value.length
  const targetAngle = 360 * 5 + (360 - randomIndex * segmentAngle - segmentAngle / 2)

  rotation.value = targetAngle

  setTimeout(() => {
    selectedPerson.value = participants.value[randomIndex]
    isSpinning.value = false
  }, 3000)
}

const wheelStyle = computed(() => ({
  transform: `rotate(${rotation.value}deg)`
}))

const handleKeypress = (e) => {
  if (e.key === 'Enter') {
    addParticipant()
  }
}
</script>

<template>
  <div class="game-container">
    <h2 class="game-title">룰렛</h2>

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

    <div class="roulette-container" v-if="participants.length >= 2">
      <div class="roulette-pointer"></div>
      <div class="roulette-wheel" :style="wheelStyle">
        <div class="roulette-center">
          {{ selectedPerson || '돌려!' }}
        </div>
      </div>
    </div>

    <div v-if="participants.length < 2" class="notice">
      최소 2명의 참가자가 필요합니다
    </div>

    <div v-if="selectedPerson" class="result-box">
      {{ selectedPerson }} 당첨!
    </div>

    <button
      class="btn"
      @click="spinRoulette"
      :disabled="participants.length < 2 || isSpinning"
    >
      {{ isSpinning ? '돌리는 중...' : '돌리기!' }}
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
  padding: 40px;
}
</style>
