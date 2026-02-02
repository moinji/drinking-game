<script setup>
import { ref } from 'vue'

// 화투 패 정의 (1~10월, 각 2장)
const createDeck = () => {
  const deck = []
  const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월']
  const gwangMonths = [1, 3, 8] // 광이 있는 달

  for (let month = 1; month <= 10; month++) {
    deck.push({
      month,
      name: monthNames[month - 1],
      isGwang: gwangMonths.includes(month),
      type: gwangMonths.includes(month) ? '광' : '열끗',
      id: `${month}-1`
    })
    deck.push({
      month,
      name: monthNames[month - 1],
      isGwang: false,
      type: '피',
      id: `${month}-2`
    })
  }
  return deck
}

// 족보 판정
const getHandRank = (card1, card2) => {
  const m1 = Math.min(card1.month, card2.month)
  const m2 = Math.max(card1.month, card2.month)
  const sum = (card1.month + card2.month) % 10
  const hasGwang = card1.isGwang || card2.isGwang
  const gwangCount = (card1.isGwang ? 1 : 0) + (card2.isGwang ? 1 : 0)

  // 기본 정보 (동점 비교용)
  const baseInfo = { highMonth: m2, lowMonth: m1, hasGwang, gwangCount }

  if (card1.isGwang && card2.isGwang) {
    if ((m1 === 3 && m2 === 8)) return { rank: 1, name: '38광땡', score: 1000, ...baseInfo }
    if ((m1 === 1 && m2 === 8)) return { rank: 2, name: '18광땡', score: 999, ...baseInfo }
    if ((m1 === 1 && m2 === 3)) return { rank: 3, name: '13광땡', score: 998, ...baseInfo }
  }

  if (card1.month === card2.month) {
    const ddangScore = 900 + card1.month
    const ddangNames = ['', '삥땡', '이땡', '삼땡', '사땡', '오땡', '육땡', '칠땡', '팔땡', '구땡', '장땡']
    return { rank: 4, name: ddangNames[card1.month], score: ddangScore, ...baseInfo }
  }

  if (m1 === 1 && m2 === 2) return { rank: 5, name: '알리', score: 806, ...baseInfo }
  if (m1 === 1 && m2 === 4) return { rank: 6, name: '독사', score: 805, ...baseInfo }
  if (m1 === 1 && m2 === 9) return { rank: 7, name: '구삥', score: 804, ...baseInfo }
  if (m1 === 1 && m2 === 10) return { rank: 8, name: '장삥', score: 803, ...baseInfo }
  if (m1 === 4 && m2 === 10) return { rank: 9, name: '장사', score: 802, ...baseInfo }
  if (m1 === 4 && m2 === 6) return { rank: 10, name: '세륙', score: 801, ...baseInfo }

  if (sum === 0) return { rank: 12, name: '망통', score: 0, ...baseInfo }
  return { rank: 11, name: `${sum}끗`, score: sum, ...baseInfo }
}

// 동점 비교 함수 (실제 섯다 규칙)
const compareHands = (a, b) => {
  // 1. 기본 점수 비교
  if (b.hand.score !== a.hand.score) {
    return b.hand.score - a.hand.score
  }

  // 2. 동점일 경우 (같은 끗)
  // 광이 있는 쪽이 승리
  if (b.hand.gwangCount !== a.hand.gwangCount) {
    return b.hand.gwangCount - a.hand.gwangCount
  }

  // 3. 광 개수도 같으면 높은 월 비교
  if (b.hand.highMonth !== a.hand.highMonth) {
    return b.hand.highMonth - a.hand.highMonth
  }

  // 4. 높은 월도 같으면 낮은 월 비교
  if (b.hand.lowMonth !== a.hand.lowMonth) {
    return b.hand.lowMonth - a.hand.lowMonth
  }

  // 5. 완전 동점 (무승부)
  return 0
}

// 상태 관리
const gameState = ref('setup') // setup, dealing, reveal, result
const players = ref([])
const newPlayerName = ref('')
const results = ref([])
const deck = ref([])

// 공개 진행 상태
const currentRevealIndex = ref(-1)
const revealedPlayers = ref([])
const isRevealing = ref(false)
const showFinalResult = ref(false)
const countDown = ref(0)

// 플레이어 추가
const addPlayer = () => {
  const name = newPlayerName.value.trim()
  if (name && players.value.length < 10) {
    players.value.push({ name, cards: [], hand: null, isRevealed: false })
    newPlayerName.value = ''
  }
}

// 플레이어 제거
const removePlayer = (index) => {
  players.value.splice(index, 1)
}

// 카드 섞기
const shuffleDeck = (array) => {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// 게임 시작 - 카드 배분
const startGame = () => {
  if (players.value.length < 2) return

  deck.value = shuffleDeck(createDeck())

  players.value.forEach((player, index) => {
    player.cards = [deck.value[index * 2], deck.value[index * 2 + 1]]
    player.hand = getHandRank(player.cards[0], player.cards[1])
    player.isRevealed = false
  })

  // 순위 미리 계산 (실제 섯다 규칙 적용)
  results.value = [...players.value].sort(compareHands)

  currentRevealIndex.value = -1
  revealedPlayers.value = []
  showFinalResult.value = false

  gameState.value = 'dealing'

  // 카드 배분 애니메이션 후 공개 단계로
  setTimeout(() => {
    gameState.value = 'reveal'
  }, 1500)
}

// 다음 사람 패 공개
const revealNext = async () => {
  if (isRevealing.value) return

  currentRevealIndex.value++

  if (currentRevealIndex.value >= players.value.length) {
    // 모두 공개 완료 - 최종 결과
    showFinalResult.value = true
    gameState.value = 'result'
    return
  }

  isRevealing.value = true

  // 카운트다운
  countDown.value = 3
  for (let i = 3; i >= 1; i--) {
    countDown.value = i
    await sleep(600)
  }
  countDown.value = 0

  // 패 공개
  const player = players.value[currentRevealIndex.value]
  player.isRevealed = true
  revealedPlayers.value.push(player)

  await sleep(500)
  isRevealing.value = false
}

// 전체 한번에 공개
const revealAll = async () => {
  if (isRevealing.value) return
  isRevealing.value = true

  countDown.value = 3
  for (let i = 3; i >= 1; i--) {
    countDown.value = i
    await sleep(600)
  }
  countDown.value = 0

  // 모든 패 동시 공개
  players.value.forEach(p => p.isRevealed = true)
  revealedPlayers.value = [...players.value]
  currentRevealIndex.value = players.value.length

  await sleep(1000)
  showFinalResult.value = true
  gameState.value = 'result'
  isRevealing.value = false
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// 다시 하기
const resetGame = () => {
  players.value.forEach(player => {
    player.cards = []
    player.hand = null
    player.isRevealed = false
  })
  results.value = []
  currentRevealIndex.value = -1
  revealedPlayers.value = []
  showFinalResult.value = false
  isRevealing.value = false
  gameState.value = 'setup'
}

// 완전 초기화
const fullReset = () => {
  players.value = []
  results.value = []
  deck.value = []
  currentRevealIndex.value = -1
  revealedPlayers.value = []
  showFinalResult.value = false
  isRevealing.value = false
  gameState.value = 'setup'
}

// 카드 이모지 매핑
const getCardEmoji = (month) => {
  const emojis = ['🌸', '🐦', '🌸', '🐦', '🌿', '🌺', '🐗', '🌕', '🍶', '🦌']
  return emojis[month - 1] || '🎴'
}

// 패 결과에 따른 색상
const getResultClass = (rank) => {
  if (rank <= 3) return 'legendary'
  if (rank === 4) return 'epic'
  if (rank <= 10) return 'rare'
  return 'normal'
}

// 현재까지 공개된 사람 중 1등
const currentLeader = () => {
  if (revealedPlayers.value.length === 0) return null
  return [...revealedPlayers.value].sort(compareHands)[0]
}
</script>

<template>
  <div class="game-container">
    <h2 class="game-title">🎴 섯다</h2>

    <!-- 설정 화면 -->
    <div v-if="gameState === 'setup'" class="setup-section">
      <p class="game-desc">참가자를 추가하고 게임을 시작하세요!</p>

      <div class="input-group">
        <input
          v-model="newPlayerName"
          type="text"
          placeholder="참가자 이름"
          class="player-input"
          @keyup.enter="addPlayer"
          maxlength="10"
        />
        <button class="btn add-btn" @click="addPlayer" :disabled="players.length >= 10">
          추가
        </button>
      </div>

      <div class="players-list" v-if="players.length > 0">
        <div class="player-tag" v-for="(player, index) in players" :key="index">
          <span>{{ player.name }}</span>
          <button class="remove-btn" @click="removePlayer(index)">×</button>
        </div>
      </div>

      <p class="player-count">{{ players.length }}/10명</p>

      <button
        class="btn start-btn"
        @click="startGame"
        :disabled="players.length < 2"
      >
        게임 시작
      </button>
    </div>

    <!-- 카드 배분 애니메이션 -->
    <div v-if="gameState === 'dealing'" class="dealing-section">
      <div class="dealing-animation">
        <div class="card-stack">
          <div class="card-back dealing" v-for="n in 6" :key="n">🎴</div>
        </div>
        <p class="dealing-text">패를 돌리는 중...</p>
      </div>
    </div>

    <!-- 패 공개 단계 -->
    <div v-if="gameState === 'reveal'" class="reveal-section">
      <!-- 카운트다운 오버레이 -->
      <div v-if="countDown > 0" class="countdown-overlay">
        <div class="countdown-number">{{ countDown }}</div>
      </div>

      <!-- 참가자 목록 -->
      <div class="players-grid">
        <div
          v-for="(player, index) in players"
          :key="index"
          class="player-slot"
          :class="{
            revealed: player.isRevealed,
            current: index === currentRevealIndex && isRevealing,
            waiting: index > currentRevealIndex
          }"
        >
          <div class="player-name-tag">{{ player.name }}</div>

          <!-- 카드 뒷면 (공개 전) -->
          <div v-if="!player.isRevealed" class="cards-back">
            <div class="card-back">🎴</div>
            <div class="card-back">🎴</div>
          </div>

          <!-- 카드 앞면 (공개 후) -->
          <div v-else class="cards-front">
            <div class="card-mini" v-for="card in player.cards" :key="card.id">
              <span class="card-emoji">{{ getCardEmoji(card.month) }}</span>
              <span class="card-month">{{ card.name }}</span>
              <span v-if="card.isGwang" class="gwang-badge">광</span>
            </div>
          </div>

          <!-- 족보 (공개 후) -->
          <div v-if="player.isRevealed" class="hand-badge" :class="getResultClass(player.hand.rank)">
            {{ player.hand.name }}
          </div>
        </div>
      </div>

      <!-- 현재 1등 표시 -->
      <div v-if="revealedPlayers.length > 0 && !isRevealing" class="current-leader">
        <span class="leader-label">현재 1등</span>
        <span class="leader-name">👑 {{ currentLeader()?.name }}</span>
        <span class="leader-hand">{{ currentLeader()?.hand.name }}</span>
      </div>

      <!-- 공개 버튼 -->
      <div class="reveal-controls" v-if="!isRevealing">
        <button
          v-if="currentRevealIndex < players.length - 1"
          class="btn reveal-btn"
          @click="revealNext"
        >
          {{ currentRevealIndex < 0 ? '첫 번째 공개' : '다음 사람 공개' }}
        </button>

        <button
          v-if="currentRevealIndex < players.length - 1"
          class="btn reveal-all-btn"
          @click="revealAll"
        >
          전체 공개
        </button>

        <button
          v-if="currentRevealIndex >= players.length - 1"
          class="btn result-btn"
          @click="showFinalResult = true; gameState = 'result'"
        >
          최종 결과 보기
        </button>
      </div>

      <!-- 진행 상태 -->
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: `${(revealedPlayers.length / players.length) * 100}%` }"
        ></div>
      </div>
      <p class="progress-text">{{ revealedPlayers.length }} / {{ players.length }} 공개</p>
    </div>

    <!-- 최종 결과 화면 -->
    <div v-if="gameState === 'result' && showFinalResult" class="result-section">
      <div class="result-header">
        <div class="winner-announce">🎉 최종 결과 🎉</div>
        <span class="winner-crown">👑</span>
        <h3 class="winner-name">{{ results[0]?.name }}</h3>
        <div class="winner-hand" :class="getResultClass(results[0]?.hand.rank)">
          {{ results[0]?.hand.name }}
        </div>
      </div>

      <div class="cards-display winner-cards">
        <div class="card" v-for="card in results[0]?.cards" :key="card.id">
          <span class="card-emoji">{{ getCardEmoji(card.month) }}</span>
          <span class="card-month">{{ card.name }}</span>
          <span class="card-type" :class="{ gwang: card.isGwang }">
            {{ card.type }}
          </span>
        </div>
      </div>

      <div class="loser-section" v-if="results.length > 1">
        <h4 class="loser-title">🍺 벌칙 대상</h4>
        <div class="loser-info">
          <span class="loser-name">{{ results[results.length - 1]?.name }}</span>
          <span class="loser-hand">{{ results[results.length - 1]?.hand.name }}</span>
        </div>
        <div class="cards-display loser-cards">
          <div class="card small" v-for="card in results[results.length - 1]?.cards" :key="card.id">
            <span class="card-emoji">{{ getCardEmoji(card.month) }}</span>
            <span class="card-month">{{ card.name }}</span>
          </div>
        </div>
      </div>

      <div class="all-results">
        <h4>전체 순위</h4>
        <div class="rank-list">
          <div
            class="rank-item"
            v-for="(player, index) in results"
            :key="index"
            :class="{ first: index === 0, last: index === results.length - 1 }"
          >
            <span class="rank-number">{{ index + 1 }}</span>
            <span class="rank-name">{{ player.name }}</span>
            <span class="rank-hand" :class="getResultClass(player.hand.rank)">
              {{ player.hand.name }}
            </span>
            <span class="rank-cards">
              {{ player.cards[0]?.name }} + {{ player.cards[1]?.name }}
            </span>
          </div>
        </div>
      </div>

      <div class="button-group">
        <button class="btn" @click="resetGame">다시 하기</button>
        <button class="btn secondary" @click="fullReset">새 게임</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.game-container {
  padding: 20px;
  max-width: 500px;
  margin: 0 auto;
}

.game-title {
  text-align: center;
  font-size: 2rem;
  margin-bottom: 10px;
  background: linear-gradient(135deg, var(--neon-pink), var(--neon-yellow));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.game-desc {
  text-align: center;
  color: var(--text-secondary);
  margin-bottom: 20px;
}

/* 설정 화면 */
.setup-section {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.input-group {
  display: flex;
  gap: 10px;
}

.player-input {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid var(--border-color);
  border-radius: 12px;
  background: var(--card-bg);
  color: var(--text-primary);
  font-size: 1rem;
}

.player-input:focus {
  outline: none;
  border-color: var(--neon-pink);
}

.add-btn {
  padding: 12px 20px;
  white-space: nowrap;
}

.players-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 15px;
  background: var(--card-bg);
  border-radius: 12px;
  min-height: 50px;
}

.player-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: linear-gradient(135deg, var(--neon-purple), var(--neon-blue));
  border-radius: 20px;
  font-size: 0.9rem;
}

.remove-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.player-count {
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.start-btn {
  padding: 15px;
  font-size: 1.1rem;
}

.start-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 카드 배분 애니메이션 */
.dealing-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
}

.dealing-animation {
  text-align: center;
}

.card-stack {
  position: relative;
  width: 80px;
  height: 100px;
  margin: 0 auto 20px;
}

.card-back {
  font-size: 3rem;
}

.card-back.dealing {
  position: absolute;
  animation: dealCard 1.5s infinite;
}

.card-back.dealing:nth-child(1) { animation-delay: 0s; }
.card-back.dealing:nth-child(2) { animation-delay: 0.2s; }
.card-back.dealing:nth-child(3) { animation-delay: 0.4s; }
.card-back.dealing:nth-child(4) { animation-delay: 0.6s; }
.card-back.dealing:nth-child(5) { animation-delay: 0.8s; }
.card-back.dealing:nth-child(6) { animation-delay: 1s; }

@keyframes dealCard {
  0% { transform: translateY(0) rotate(0deg); opacity: 1; }
  50% { transform: translateY(-50px) rotate(180deg); opacity: 0.5; }
  100% { transform: translateY(0) rotate(360deg); opacity: 1; }
}

.dealing-text {
  font-size: 1.2rem;
  color: var(--neon-yellow);
  animation: pulse 1s infinite;
}

/* 패 공개 단계 */
.reveal-section {
  position: relative;
}

.countdown-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.countdown-number {
  font-size: 8rem;
  font-weight: bold;
  color: var(--neon-yellow);
  text-shadow: 0 0 50px var(--neon-yellow);
  animation: countPulse 0.6s ease-out;
}

@keyframes countPulse {
  0% { transform: scale(2); opacity: 0; }
  50% { transform: scale(1); opacity: 1; }
  100% { transform: scale(0.9); opacity: 1; }
}

.players-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.player-slot {
  background: var(--card-bg);
  border: 2px solid var(--border-color);
  border-radius: 12px;
  padding: 12px;
  text-align: center;
  transition: all 0.3s ease;
}

.player-slot.waiting {
  opacity: 0.6;
}

.player-slot.current {
  border-color: var(--neon-yellow);
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
  animation: currentPulse 0.5s infinite alternate;
}

@keyframes currentPulse {
  from { transform: scale(1); }
  to { transform: scale(1.02); }
}

.player-slot.revealed {
  border-color: var(--neon-pink);
}

.player-name-tag {
  font-weight: bold;
  margin-bottom: 8px;
  font-size: 0.95rem;
}

.cards-back, .cards-front {
  display: flex;
  justify-content: center;
  gap: 8px;
  min-height: 60px;
  align-items: center;
}

.cards-back .card-back {
  font-size: 2.5rem;
  filter: grayscale(0.3);
}

.card-mini {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 10px;
  background: linear-gradient(145deg, #2a2a3e, #1a1a2e);
  border-radius: 8px;
  border: 1px solid var(--border-color);
  position: relative;
  animation: flipIn 0.5s ease-out;
}

@keyframes flipIn {
  0% { transform: rotateY(90deg); opacity: 0; }
  100% { transform: rotateY(0); opacity: 1; }
}

.card-mini .card-emoji {
  font-size: 1.5rem;
}

.card-mini .card-month {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.gwang-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  background: gold;
  color: #000;
  font-size: 0.6rem;
  padding: 2px 5px;
  border-radius: 8px;
  font-weight: bold;
}

.hand-badge {
  margin-top: 8px;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: bold;
  animation: popIn 0.3s ease-out 0.3s both;
}

@keyframes popIn {
  0% { transform: scale(0); }
  70% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

.hand-badge.legendary {
  background: linear-gradient(135deg, #ff6b6b, #ffd93d);
  animation: popIn 0.3s ease-out 0.3s both, legendaryGlow 1s infinite alternate;
}

@keyframes legendaryGlow {
  from { box-shadow: 0 0 10px #ff6b6b; }
  to { box-shadow: 0 0 25px #ffd93d; }
}

.hand-badge.epic {
  background: linear-gradient(135deg, var(--neon-purple), var(--neon-pink));
}

.hand-badge.rare {
  background: linear-gradient(135deg, var(--neon-blue), var(--neon-purple));
}

.hand-badge.normal {
  background: rgba(255, 255, 255, 0.15);
}

.current-leader {
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 165, 0, 0.1));
  border: 1px solid rgba(255, 215, 0, 0.5);
  border-radius: 12px;
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 15px;
}

.leader-label {
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.leader-name {
  font-weight: bold;
  color: gold;
}

.leader-hand {
  background: var(--card-bg);
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 0.85rem;
}

.reveal-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.reveal-controls .btn {
  flex: 1;
  padding: 15px;
  font-size: 1rem;
}

.reveal-btn {
  background: linear-gradient(135deg, var(--neon-pink), var(--neon-purple)) !important;
  animation: buttonPulse 2s infinite;
}

@keyframes buttonPulse {
  0%, 100% { box-shadow: 0 0 10px var(--neon-pink); }
  50% { box-shadow: 0 0 25px var(--neon-pink); }
}

.reveal-all-btn {
  background: var(--card-bg) !important;
  border: 2px solid var(--border-color);
}

.result-btn {
  background: linear-gradient(135deg, #ffd93d, #ff6b6b) !important;
}

.progress-bar {
  height: 6px;
  background: var(--card-bg);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--neon-blue), var(--neon-pink));
  transition: width 0.5s ease;
}

.progress-text {
  text-align: center;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

/* 결과 화면 */
.result-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
  animation: fadeIn 0.5s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.result-header {
  text-align: center;
  padding: 20px;
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 165, 0, 0.2));
  border-radius: 16px;
  border: 2px solid gold;
}

.winner-announce {
  font-size: 1.2rem;
  margin-bottom: 10px;
  animation: bounce 1s infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

.winner-crown {
  font-size: 3rem;
}

.winner-name {
  font-size: 1.8rem;
  margin: 10px 0;
  color: gold;
}

.winner-hand {
  display: inline-block;
  padding: 8px 20px;
  border-radius: 20px;
  font-size: 1.2rem;
  font-weight: bold;
}

.winner-hand.legendary {
  background: linear-gradient(135deg, #ff6b6b, #ffd93d);
  animation: pulse 1s infinite;
}

.winner-hand.epic {
  background: linear-gradient(135deg, var(--neon-purple), var(--neon-pink));
}

.winner-hand.rare {
  background: linear-gradient(135deg, var(--neon-blue), var(--neon-purple));
}

.winner-hand.normal {
  background: var(--card-bg);
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.cards-display {
  display: flex;
  justify-content: center;
  gap: 15px;
}

.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 15px 20px;
  background: linear-gradient(145deg, #2a2a3e, #1a1a2e);
  border-radius: 12px;
  border: 2px solid var(--border-color);
  min-width: 80px;
}

.card.small {
  padding: 10px 15px;
  min-width: 60px;
}

.card-emoji {
  font-size: 2rem;
}

.card.small .card-emoji {
  font-size: 1.5rem;
}

.card-month {
  font-size: 1rem;
  color: var(--text-primary);
  margin-top: 5px;
}

.card-type {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-top: 3px;
}

.card-type.gwang {
  color: gold;
  font-weight: bold;
}

.loser-section {
  text-align: center;
  padding: 15px;
  background: rgba(255, 100, 100, 0.1);
  border-radius: 12px;
  border: 1px solid rgba(255, 100, 100, 0.3);
}

.loser-title {
  color: #ff6b6b;
  margin-bottom: 10px;
}

.loser-info {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.loser-name {
  font-size: 1.2rem;
  font-weight: bold;
}

.loser-hand {
  padding: 4px 12px;
  background: var(--card-bg);
  border-radius: 12px;
  font-size: 0.9rem;
}

.loser-cards {
  margin-top: 10px;
}

.all-results {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 15px;
}

.all-results h4 {
  text-align: center;
  margin-bottom: 15px;
  color: var(--text-secondary);
}

.rank-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rank-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.rank-item.first {
  background: rgba(255, 215, 0, 0.15);
  border: 1px solid rgba(255, 215, 0, 0.3);
}

.rank-item.last {
  background: rgba(255, 100, 100, 0.15);
  border: 1px solid rgba(255, 100, 100, 0.3);
}

.rank-number {
  width: 25px;
  height: 25px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--neon-purple);
  border-radius: 50%;
  font-size: 0.8rem;
  font-weight: bold;
}

.rank-name {
  flex: 1;
  font-weight: 500;
}

.rank-hand {
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 0.85rem;
}

.rank-hand.legendary {
  background: linear-gradient(135deg, #ff6b6b, #ffd93d);
}

.rank-hand.epic {
  background: linear-gradient(135deg, var(--neon-purple), var(--neon-pink));
}

.rank-hand.rare {
  background: linear-gradient(135deg, var(--neon-blue), var(--neon-purple));
}

.rank-hand.normal {
  background: rgba(255, 255, 255, 0.1);
}

.rank-cards {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.button-group {
  display: flex;
  gap: 10px;
}

.button-group .btn {
  flex: 1;
  padding: 15px;
}

.btn.secondary {
  background: var(--card-bg);
  border: 2px solid var(--border-color);
}
</style>
