<script setup>
import { ref, inject, onMounted } from 'vue'

const emit = defineEmits(['select-game'])
const globalRoom = inject('globalRoom')

// 방 UI 상태
const showRoomModal = ref(false)
const roomTab = ref('join') // 'create' or 'join'
const playerName = ref('')
const joinCode = ref('')
const isLoading = ref(false)
const errorMessage = ref('')

const menuItems = [
  { id: 'randomMission', icon: '🎲', label: '랜덤 미션' },
  { id: 'roulette', icon: '🎯', label: '룰렛' },
  { id: 'bomb', icon: '💣', label: '폭탄 돌리기' },
  { id: 'truthOrDare', icon: '🤔', label: '진실 혹은 도전' },
  { id: 'updown', icon: '🔢', label: '업다운' },
  { id: 'balance', icon: '⚖️', label: '밸런스 게임' },
  { id: 'malePreference', icon: '💘', label: '남자 취향 선택' },
  { id: 'femalePreference', icon: '💙', label: '여자 취향 선택' },
  { id: 'coinTruth', icon: '🪙', label: '동전 진실게임' },
  { id: 'ranking', icon: '👑', label: '랭킹게임' },
  { id: 'whisper', icon: '🤫', label: '귓속말게임' },
  { id: 'seotda', icon: '🎴', label: '섯다' },
  { id: 'catchmind', icon: '🎨', label: '캐치마인드' },
  { id: 'racing', icon: '🏎️', label: '레이싱' },
  { id: 'trafficLight', icon: '🚦', label: '신호등 게임' }
]

// 멀티 지원 게임 목록
const multiplayerGames = ['roulette', 'catchmind', 'seotda', 'racing']

// 방 만들기
const createRoom = async () => {
  if (!playerName.value.trim()) {
    errorMessage.value = '이름을 입력하세요'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    await globalRoom.createRoom(playerName.value.trim())
    showRoomModal.value = false
  } catch (e) {
    errorMessage.value = e.message
  } finally {
    isLoading.value = false
  }
}

// 방 참가
const joinRoom = async () => {
  if (!playerName.value.trim()) {
    errorMessage.value = '이름을 입력하세요'
    return
  }
  if (!joinCode.value.trim()) {
    errorMessage.value = '방 코드를 입력하세요'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    await globalRoom.joinRoom(joinCode.value.trim(), playerName.value.trim())
    showRoomModal.value = false
  } catch (e) {
    errorMessage.value = e.message
  } finally {
    isLoading.value = false
  }
}

// 방 나가기
const leaveRoom = async () => {
  await globalRoom.leaveRoom()
}

// 준비 토글
const toggleReady = async () => {
  await globalRoom.toggleReady()
}

// 게임 시작
const startMultiplayerGame = async (gameId) => {
  try {
    await globalRoom.startGame(gameId)
  } catch (e) {
    errorMessage.value = e.message
    setTimeout(() => errorMessage.value = '', 3000)
  }
}

// 게임 선택
const selectGame = (gameId) => {
  // 방에 있고 멀티플레이어 지원 게임이면 시작 확인
  if (globalRoom.isInRoom.value && multiplayerGames.includes(gameId)) {
    if (globalRoom.isHost.value) {
      startMultiplayerGame(gameId)
    } else {
      errorMessage.value = '방장만 게임을 시작할 수 있습니다'
      setTimeout(() => errorMessage.value = '', 3000)
    }
  } else {
    // 솔로 모드
    emit('select-game', gameId)
  }
}

// 방 코드 복사
const copyRoomCode = async () => {
  try {
    await navigator.clipboard.writeText(globalRoom.roomCode.value)
  } catch (e) {
    // fallback
    const input = document.createElement('input')
    input.value = globalRoom.roomCode.value
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
  }
}

onMounted(() => {
  playerName.value = globalRoom.loadSavedName()
})
</script>

<template>
  <div class="menu-container">
    <h1 class="game-title">술게임</h1>
    <p class="subtitle">친구들과 함께하는 재미있는 게임!</p>

    <!-- 멀티플레이어 컨트롤 영역 -->
    <div class="multiplayer-section">
      <!-- 방에 참가하지 않은 상태 -->
      <div v-if="!globalRoom.isInRoom.value" class="room-entry">
        <button class="room-btn create" @click="showRoomModal = true; roomTab = 'create'">
          방 만들기
        </button>
        <button class="room-btn join" @click="showRoomModal = true; roomTab = 'join'">
          방 참가
        </button>
      </div>

      <!-- 방에 참가한 상태 -->
      <div v-else class="room-info-bar">
        <div class="room-code-display">
          <span class="room-label">방 코드</span>
          <span class="room-code">{{ globalRoom.roomCode.value }}</span>
          <button class="copy-btn" @click="copyRoomCode">복사</button>
        </div>

        <div class="room-players">
          <span class="player-count">{{ globalRoom.players.value.length }}명 참가 중</span>
          <div class="player-avatars">
            <div
              v-for="player in globalRoom.players.value.slice(0, 5)"
              :key="player.id"
              class="player-avatar"
              :class="{
                host: player.isHost,
                ready: player.isReady,
                me: player.id === globalRoom.myPlayerId.value
              }"
              :title="player.name"
            >
              {{ player.name.charAt(0) }}
            </div>
            <div v-if="globalRoom.players.value.length > 5" class="player-avatar more">
              +{{ globalRoom.players.value.length - 5 }}
            </div>
          </div>
        </div>

        <div class="room-actions">
          <button
            v-if="!globalRoom.isHost.value"
            class="ready-btn"
            :class="{ active: globalRoom.myPlayer.value?.isReady }"
            @click="toggleReady"
          >
            {{ globalRoom.myPlayer.value?.isReady ? '준비완료' : '준비' }}
          </button>
          <button class="leave-btn" @click="leaveRoom">나가기</button>
        </div>
      </div>

      <!-- 카운트다운 오버레이 -->
      <div v-if="globalRoom.countdown.value > 0" class="countdown-overlay">
        <div class="countdown-content">
          <div class="countdown-number">{{ globalRoom.countdown.value }}</div>
          <div class="countdown-text">게임 시작!</div>
        </div>
      </div>

      <!-- 에러 메시지 -->
      <div v-if="errorMessage" class="error-toast">
        {{ errorMessage }}
      </div>
    </div>

    <!-- 게임 메뉴 -->
    <div class="menu-grid">
      <div
        v-for="item in menuItems"
        :key="item.id"
        class="menu-item"
        :class="{
          multiplayer: multiplayerGames.includes(item.id),
          'host-only': globalRoom.isInRoom.value && multiplayerGames.includes(item.id) && !globalRoom.isHost.value
        }"
        @click="selectGame(item.id)"
      >
        <div class="icon">{{ item.icon }}</div>
        <div class="label">{{ item.label }}</div>
        <div v-if="multiplayerGames.includes(item.id)" class="multi-badge">멀티</div>
      </div>
    </div>

    <!-- 방 모달 -->
    <Teleport to="body">
      <div v-if="showRoomModal" class="modal-overlay" @click.self="showRoomModal = false">
        <div class="modal-content">
          <button class="modal-close" @click="showRoomModal = false">×</button>

          <div class="modal-tabs">
            <button
              class="tab-btn"
              :class="{ active: roomTab === 'create' }"
              @click="roomTab = 'create'"
            >
              방 만들기
            </button>
            <button
              class="tab-btn"
              :class="{ active: roomTab === 'join' }"
              @click="roomTab = 'join'"
            >
              방 참가
            </button>
          </div>

          <div class="modal-body">
            <div class="input-group">
              <label>닉네임</label>
              <input
                v-model="playerName"
                type="text"
                placeholder="닉네임 입력"
                maxlength="10"
                @keyup.enter="roomTab === 'create' ? createRoom() : joinRoom()"
              />
            </div>

            <div v-if="roomTab === 'join'" class="input-group">
              <label>방 코드</label>
              <input
                v-model="joinCode"
                type="text"
                placeholder="방 코드 입력"
                maxlength="6"
                @input="joinCode = joinCode.toUpperCase()"
                @keyup.enter="joinRoom"
              />
            </div>

            <div v-if="errorMessage" class="error-message">
              {{ errorMessage }}
            </div>

            <button
              class="submit-btn"
              :disabled="isLoading"
              @click="roomTab === 'create' ? createRoom() : joinRoom()"
            >
              {{ isLoading ? '처리 중...' : (roomTab === 'create' ? '방 만들기' : '참가하기') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.menu-container {
  text-align: center;
  padding: 40px 20px;
}

.subtitle {
  color: var(--text-secondary);
  margin-bottom: 20px;
  font-size: 1.1rem;
}

/* 멀티플레이어 섹션 */
.multiplayer-section {
  margin-bottom: 30px;
  position: relative;
}

.room-entry {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.room-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.room-btn.create {
  background: linear-gradient(135deg, #00b894, #00cec9);
  color: white;
}

.room-btn.join {
  background: linear-gradient(135deg, #6c5ce7, #a29bfe);
  color: white;
}

.room-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
}

/* 방 정보 바 */
.room-info-bar {
  background: var(--card-bg);
  border-radius: 16px;
  padding: 15px 20px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  border: 2px solid var(--neon-blue);
}

.room-code-display {
  display: flex;
  align-items: center;
  gap: 10px;
}

.room-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.room-code {
  font-size: 1.3rem;
  font-weight: bold;
  letter-spacing: 2px;
  color: var(--neon-blue);
}

.copy-btn {
  padding: 5px 10px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.8rem;
}

.room-players {
  display: flex;
  align-items: center;
  gap: 10px;
}

.player-count {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.player-avatars {
  display: flex;
  gap: -5px;
}

.player-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--neon-purple);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: bold;
  border: 2px solid var(--bg-primary);
  margin-left: -8px;
}

.player-avatar:first-child {
  margin-left: 0;
}

.player-avatar.host {
  background: linear-gradient(135deg, gold, orange);
  color: #000;
}

.player-avatar.ready {
  border-color: var(--neon-blue);
  box-shadow: 0 0 8px var(--neon-blue);
}

.player-avatar.me {
  border-color: var(--neon-pink);
}

.player-avatar.more {
  background: var(--border-color);
  font-size: 0.7rem;
}

.room-actions {
  display: flex;
  gap: 10px;
}

.ready-btn {
  padding: 8px 16px;
  border: 2px solid var(--neon-blue);
  background: transparent;
  color: var(--neon-blue);
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.3s;
}

.ready-btn.active {
  background: var(--neon-blue);
  color: white;
}

.leave-btn {
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-secondary);
  border-radius: 8px;
  cursor: pointer;
}

/* 카운트다운 오버레이 */
.countdown-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.countdown-content {
  text-align: center;
}

.countdown-number {
  font-size: 10rem;
  font-weight: bold;
  color: var(--neon-pink);
  text-shadow: 0 0 50px var(--neon-pink);
  animation: countPulse 1s ease-out;
}

.countdown-text {
  font-size: 2rem;
  color: var(--text-primary);
  margin-top: 20px;
}

@keyframes countPulse {
  0% { transform: scale(1.5); opacity: 0; }
  50% { transform: scale(1); opacity: 1; }
  100% { transform: scale(0.95); opacity: 1; }
}

/* 에러 토스트 */
.error-toast {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(231, 76, 60, 0.95);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  z-index: 1000;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from { transform: translateX(-50%) translateY(20px); opacity: 0; }
  to { transform: translateX(-50%) translateY(0); opacity: 1; }
}

/* 메뉴 그리드 */
.menu-item {
  position: relative;
}

.menu-item.multiplayer {
  border: 2px solid transparent;
  background-clip: padding-box;
}

.menu-item.multiplayer::before {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  background: linear-gradient(135deg, var(--neon-blue), var(--neon-purple));
  border-radius: 18px;
  z-index: -1;
  opacity: 0.5;
}

.menu-item.host-only {
  opacity: 0.6;
}

.multi-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: linear-gradient(135deg, var(--neon-blue), var(--neon-purple));
  color: white;
  font-size: 0.65rem;
  padding: 2px 6px;
  border-radius: 6px;
  font-weight: bold;
}

/* 모달 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: var(--bg-secondary);
  border-radius: 20px;
  width: 100%;
  max-width: 400px;
  border: 2px solid var(--border-color);
  position: relative;
}

.modal-close {
  position: absolute;
  top: 15px;
  right: 15px;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 1.5rem;
  cursor: pointer;
}

.modal-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-color);
}

.tab-btn {
  flex: 1;
  padding: 15px;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s;
}

.tab-btn.active {
  color: var(--neon-blue);
  border-bottom: 2px solid var(--neon-blue);
}

.modal-body {
  padding: 25px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-group label {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.input-group input {
  padding: 12px 16px;
  border: 2px solid var(--border-color);
  border-radius: 12px;
  background: var(--card-bg);
  color: var(--text-primary);
  font-size: 1rem;
}

.input-group input:focus {
  outline: none;
  border-color: var(--neon-blue);
}

.error-message {
  color: #e74c3c;
  font-size: 0.9rem;
  text-align: center;
}

.submit-btn {
  padding: 15px;
  background: linear-gradient(135deg, var(--neon-blue), var(--neon-purple));
  border: none;
  border-radius: 12px;
  color: white;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(108, 92, 231, 0.4);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
