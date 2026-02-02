<script setup>
import { ref, computed } from 'vue'

const participants = ref([])
const newParticipant = ref('')
const selectedPerson = ref('')
const isSpinning = ref(false)
const rotation = ref(0)

const colors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1'
]

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

const segments = computed(() => {
  const count = participants.value.length
  if (count < 2) return []

  const anglePerSegment = 360 / count
  const radius = 140
  const centerX = 150
  const centerY = 150

  return participants.value.map((name, index) => {
    const startAngle = index * anglePerSegment - 90
    const endAngle = startAngle + anglePerSegment

    const startRad = (startAngle * Math.PI) / 180
    const endRad = (endAngle * Math.PI) / 180

    const x1 = centerX + radius * Math.cos(startRad)
    const y1 = centerY + radius * Math.sin(startRad)
    const x2 = centerX + radius * Math.cos(endRad)
    const y2 = centerY + radius * Math.sin(endRad)

    const largeArc = anglePerSegment > 180 ? 1 : 0

    const path = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`

    const midAngle = startAngle + anglePerSegment / 2
    const midRad = (midAngle * Math.PI) / 180
    const textRadius = radius * 0.65
    const textX = centerX + textRadius * Math.cos(midRad)
    const textY = centerY + textRadius * Math.sin(midRad)

    return {
      path,
      color: colors[index % colors.length],
      name,
      textX,
      textY,
      textRotation: midAngle + 90
    }
  })
})

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
        <svg viewBox="0 0 300 300" class="roulette-svg">
          <g v-for="(segment, index) in segments" :key="index">
            <path
              :d="segment.path"
              :fill="segment.color"
              stroke="#fff"
              stroke-width="2"
            />
            <text
              :x="segment.textX"
              :y="segment.textY"
              :transform="`rotate(${segment.textRotation}, ${segment.textX}, ${segment.textY})`"
              text-anchor="middle"
              dominant-baseline="middle"
              fill="#333"
              font-weight="bold"
              font-size="14"
              class="segment-text"
            >
              {{ segment.name.length > 6 ? segment.name.slice(0, 6) + '..' : segment.name }}
            </text>
          </g>
          <circle cx="150" cy="150" r="25" fill="#fff" stroke="#333" stroke-width="2" />
        </svg>
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
