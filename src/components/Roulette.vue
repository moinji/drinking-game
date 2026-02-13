<script setup>
import { ref, computed, inject, onMounted, onUnmounted, watch } from 'vue'
import { database, ref as dbRef, set, onValue, update, off } from '../firebase'

const globalRoom = inject('globalRoom')

const participants = ref([])
const newParticipant = ref('')
const selectedPerson = ref('')
const isSpinning = ref(false)
const rotation = ref(0)

// 멀티플레이어 상태
const isMultiplayer = computed(() => globalRoom?.isInRoom?.value)
const isHost = computed(() => !isMultiplayer.value || globalRoom?.isHost?.value)
const roomCode = computed(() => globalRoom?.roomCode?.value)

// Firebase 리스너
let unsubscribers = []

const colors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1'
]

// 멀티플레이어 초기화
const initMultiplayer = () => {
  if (!isMultiplayer.value) return

  // 플레이어 이름들로 참가자 초기화
  const playerNames = globalRoom.players.value.map(p => p.name)
  participants.value = playerNames

  // 게임 데이터 리스너
  const dataRef = dbRef(database, `globalRooms/${roomCode.value}/currentGame/data`)
  const unsub = onValue(dataRef, (snapshot) => {
    const data = snapshot.val()
    if (!data) return

    // 동기화된 상태 적용
    if (data.rotation !== undefined) rotation.value = data.rotation
    if (data.isSpinning !== undefined) isSpinning.value = data.isSpinning
    if (data.selectedPerson !== undefined) selectedPerson.value = data.selectedPerson
    if (data.participants) participants.value = data.participants
  })

  unsubscribers.push(() => off(dataRef))

  // 초기 데이터 설정 (호스트만)
  if (isHost.value) {
    set(dataRef, {
      participants: playerNames,
      rotation: 0,
      isSpinning: false,
      selectedPerson: ''
    })
  }
}

const addParticipant = async () => {
  const name = newParticipant.value.trim()
  if (name && !participants.value.includes(name)) {
    participants.value.push(name)
    newParticipant.value = ''

    // 멀티플레이어 동기화
    if (isMultiplayer.value && isHost.value) {
      await update(dbRef(database, `globalRooms/${roomCode.value}/currentGame/data`), {
        participants: participants.value
      })
    }
  }
}

const removeParticipant = async (index) => {
  if (!isHost.value) return

  participants.value.splice(index, 1)

  // 멀티플레이어 동기화
  if (isMultiplayer.value) {
    await update(dbRef(database, `globalRooms/${roomCode.value}/currentGame/data`), {
      participants: participants.value
    })
  }
}

const spinRoulette = async () => {
  if (participants.value.length < 2 || isSpinning.value) return
  if (!isHost.value) return // 호스트만 돌리기 가능

  isSpinning.value = true
  selectedPerson.value = ''

  const randomIndex = Math.floor(Math.random() * participants.value.length)
  const segmentAngle = 360 / participants.value.length
  const targetAngle = 360 * 5 + (360 - randomIndex * segmentAngle - segmentAngle / 2)

  rotation.value = targetAngle

  // 멀티플레이어 동기화
  if (isMultiplayer.value) {
    await update(dbRef(database, `globalRooms/${roomCode.value}/currentGame/data`), {
      rotation: targetAngle,
      isSpinning: true,
      selectedPerson: ''
    })
  }

  setTimeout(async () => {
    selectedPerson.value = participants.value[randomIndex]
    isSpinning.value = false

    // 결과 동기화
    if (isMultiplayer.value) {
      await update(dbRef(database, `globalRooms/${roomCode.value}/currentGame/data`), {
        isSpinning: false,
        selectedPerson: participants.value[randomIndex]
      })
    }
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

// 게임 종료 (방으로 돌아가기)
const exitGame = async () => {
  if (isMultiplayer.value && isHost.value) {
    await globalRoom.endGame()
  }
}

onMounted(() => {
  if (isMultiplayer.value) {
    initMultiplayer()
  }
})

onUnmounted(() => {
  unsubscribers.forEach(unsub => {
    try { unsub() } catch(e) {}
  })
})

// 멀티플레이어 모드 진입 감지
watch(() => globalRoom?.roomState?.value, (state) => {
  if (state === 'playing' && isMultiplayer.value) {
    initMultiplayer()
  }
})
</script>

<template>
  <div class="game-container">
    <h2 class="game-title">룰렛</h2>

    <!-- 멀티플레이어 안내 -->
    <div v-if="isMultiplayer && !isHost" class="host-notice">
      방장만 룰렛을 돌릴 수 있습니다
    </div>

    <div class="input-section" v-if="isHost">
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
        :style="{ backgroundColor: colors[index % colors.length] }"
      >
        {{ person }}
        <span v-if="isHost" class="remove" @click="removeParticipant(index)">×</span>
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
      :disabled="participants.length < 2 || isSpinning || !isHost"
    >
      {{ isSpinning ? '돌리는 중...' : (isHost ? '돌리기!' : '방장만 가능') }}
    </button>

    <!-- 멀티플레이어: 나가기 버튼 -->
    <button
      v-if="isMultiplayer && isHost"
      class="btn exit-btn"
      @click="exitGame"
    >
      게임 종료
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

.host-notice {
  background: rgba(108, 92, 231, 0.2);
  border: 1px solid rgba(108, 92, 231, 0.5);
  border-radius: 10px;
  padding: 10px 15px;
  margin-bottom: 15px;
  font-size: 0.9rem;
  color: var(--neon-purple);
}

.participant-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
  justify-content: center;
}

.participant-tag {
  padding: 8px 12px;
  border-radius: 20px;
  font-size: 0.9rem;
  color: #333;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 8px;
}

.participant-tag .remove {
  cursor: pointer;
  background: rgba(0, 0, 0, 0.2);
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.roulette-container {
  position: relative;
  width: 300px;
  height: 300px;
  margin: 0 auto 20px;
}

.roulette-pointer {
  position: absolute;
  top: -15px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 15px solid transparent;
  border-right: 15px solid transparent;
  border-top: 30px solid var(--neon-pink);
  z-index: 10;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}

.roulette-wheel {
  width: 100%;
  height: 100%;
  transition: transform 3s cubic-bezier(0.17, 0.67, 0.12, 0.99);
}

.roulette-svg {
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 4px 20px rgba(0, 0, 0, 0.3));
}

.result-box {
  background: linear-gradient(135deg, var(--neon-pink), var(--neon-purple));
  padding: 20px;
  border-radius: 15px;
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 20px;
  animation: resultPop 0.5s ease-out;
}

@keyframes resultPop {
  0% { transform: scale(0.5); opacity: 0; }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
}

.exit-btn {
  margin-top: 15px;
  background: var(--card-bg) !important;
  border: 1px solid var(--border-color);
}
</style>
