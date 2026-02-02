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
const gameState = ref('setup') // setup, dealing, swap, reveal, result
const players = ref([])
const newPlayerName = ref('')
const results = ref([])
const deck = ref([])
const remainingDeck = ref([]) // 교체용 남은 덱
const currentSwapPlayerIndex = ref(0) // 현재 교체 중인 플레이어
const showDiscardedCards = ref(false) // 버린 패 보기 토글
const isCardHidden = ref(true) // 패 가림 상태 (다음 사람에게 넘길 때)
const showJokbo = ref(false) // 족보 보기 모달

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
    players.value.push({ name, cards: [], hand: null, isRevealed: false, discardedCards: [], hasSwapped: false })
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
    player.discardedCards = []
    player.hasSwapped = false
  })

  // 남은 덱 저장 (교체용)
  remainingDeck.value = deck.value.slice(players.value.length * 2)

  currentRevealIndex.value = -1
  revealedPlayers.value = []
  showFinalResult.value = false
  currentSwapPlayerIndex.value = 0

  gameState.value = 'dealing'

  // 카드 배분 애니메이션 후 교체 단계로
  setTimeout(() => {
    gameState.value = 'swap'
  }, 1500)
}

// 카드 교체 (버리기)
const swapCard = (cardIndex) => {
  const player = players.value[currentSwapPlayerIndex.value]
  if (player.hasSwapped || remainingDeck.value.length === 0) return

  // 선택한 카드를 버림
  const discarded = player.cards.splice(cardIndex, 1)[0]
  player.discardedCards.push(discarded)

  // 새 카드 뽑기
  const newCard = remainingDeck.value.shift()
  player.cards.push(newCard)

  // 족보 재계산
  player.hand = getHandRank(player.cards[0], player.cards[1])
  player.hasSwapped = true
}

// 교체 안함 (패스)
const skipSwap = () => {
  players.value[currentSwapPlayerIndex.value].hasSwapped = true
}

// 다음 플레이어 교체 또는 공개 단계로
const nextSwapPlayer = () => {
  if (currentSwapPlayerIndex.value < players.value.length - 1) {
    currentSwapPlayerIndex.value++
    isCardHidden.value = true // 다음 사람 패 가리기
  } else {
    // 모든 플레이어 교체 완료 - 순위 재계산 후 공개 단계로
    results.value = [...players.value].sort(compareHands)
    gameState.value = 'reveal'
  }
}

// 내 패 보기
const revealMyCards = () => {
  isCardHidden.value = false
}

// 패 교체 추천 로직
const getSwapRecommendation = (player) => {
  if (!player || !player.cards || player.cards.length < 2) return null

  const card1 = player.cards[0]
  const card2 = player.cards[1]
  const hand = player.hand

  // 광땡이면 절대 버리지 마
  if (hand.rank <= 3) {
    return { action: 'keep', message: '광땡! 절대 버리지 마세요', cardIndex: -1 }
  }

  // 땡이면 유지
  if (hand.rank === 4) {
    return { action: 'keep', message: `${hand.name}! 좋은 패입니다`, cardIndex: -1 }
  }

  // 특수조합 (알리~세륙)이면 유지 권장
  if (hand.rank >= 5 && hand.rank <= 10) {
    return { action: 'keep', message: `${hand.name}! 괜찮은 패입니다`, cardIndex: -1 }
  }

  // 끗이나 망통인 경우
  const score = hand.score

  // 어떤 카드를 버릴지 결정
  let discardIndex = 0
  let reason = ''

  // 광은 절대 버리지 않음
  if (card1.isGwang && !card2.isGwang) {
    discardIndex = 1
    reason = '광 카드는 유지'
  } else if (!card1.isGwang && card2.isGwang) {
    discardIndex = 0
    reason = '광 카드는 유지'
  } else {
    // 둘 다 광이 아니면, 특수조합 가능성이 낮은 쪽 버리기
    // 1월, 4월, 10월은 특수조합에 많이 쓰이므로 유지
    const specialMonths = [1, 4, 10]
    const card1Special = specialMonths.includes(card1.month)
    const card2Special = specialMonths.includes(card2.month)

    if (card1Special && !card2Special) {
      discardIndex = 1
      reason = `${card1.name}은 특수조합 가능성 있음`
    } else if (!card1Special && card2Special) {
      discardIndex = 0
      reason = `${card2.name}은 특수조합 가능성 있음`
    } else {
      // 둘 다 특수하거나 둘 다 아니면, 낮은 월 버리기
      discardIndex = card1.month < card2.month ? 0 : 1
      reason = '낮은 월 카드 버리기'
    }
  }

  // 망통이면 강력 추천
  if (score === 0) {
    return {
      action: 'swap',
      message: `망통! ${player.cards[discardIndex].name} 버리기 추천`,
      cardIndex: discardIndex,
      reason: reason,
      strong: true
    }
  }

  // 낮은 끗(1~4)이면 교체 추천
  if (score <= 4) {
    return {
      action: 'swap',
      message: `${score}끗... ${player.cards[discardIndex].name} 버리기 추천`,
      cardIndex: discardIndex,
      reason: reason,
      strong: false
    }
  }

  // 중간 끗(5~6)이면 선택에 맡김
  if (score <= 6) {
    return {
      action: 'maybe',
      message: `${score}끗, 교체는 선택`,
      cardIndex: discardIndex,
      reason: `바꾸려면 ${player.cards[discardIndex].name}`,
      strong: false
    }
  }

  // 높은 끗(7~9)이면 유지 권장
  return {
    action: 'keep',
    message: `${score}끗! 나쁘지 않아요`,
    cardIndex: -1
  }
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
    player.discardedCards = []
    player.hasSwapped = false
  })
  results.value = []
  remainingDeck.value = []
  currentRevealIndex.value = -1
  revealedPlayers.value = []
  showFinalResult.value = false
  showDiscardedCards.value = false
  isRevealing.value = false
  currentSwapPlayerIndex.value = 0
  isCardHidden.value = true
  gameState.value = 'setup'
}

// 완전 초기화
const fullReset = () => {
  players.value = []
  results.value = []
  deck.value = []
  remainingDeck.value = []
  currentRevealIndex.value = -1
  revealedPlayers.value = []
  showFinalResult.value = false
  showDiscardedCards.value = false
  isRevealing.value = false
  currentSwapPlayerIndex.value = 0
  isCardHidden.value = true
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

    <!-- 족보 모달 -->
    <div v-if="showJokbo" class="jokbo-modal" @click.self="showJokbo = false">
      <div class="jokbo-content">
        <div class="jokbo-header">
          <h3>섯다 족보</h3>
          <button class="close-btn" @click="showJokbo = false">×</button>
        </div>
        <div class="jokbo-list">
          <div class="jokbo-section">
            <h4>광땡 (최상위)</h4>
            <div class="jokbo-item legendary">
              <span class="jokbo-name">38광땡</span>
              <span class="jokbo-desc">3월광 + 8월광</span>
            </div>
            <div class="jokbo-item legendary">
              <span class="jokbo-name">18광땡</span>
              <span class="jokbo-desc">1월광 + 8월광</span>
            </div>
            <div class="jokbo-item legendary">
              <span class="jokbo-name">13광땡</span>
              <span class="jokbo-desc">1월광 + 3월광</span>
            </div>
          </div>
          <div class="jokbo-section">
            <h4>땡 (같은 월 2장)</h4>
            <div class="jokbo-item epic">
              <span class="jokbo-name">장땡 ~ 삥땡</span>
              <span class="jokbo-desc">10땡 > 9땡 > ... > 1땡</span>
            </div>
          </div>
          <div class="jokbo-section">
            <h4>특수 조합</h4>
            <div class="jokbo-item rare">
              <span class="jokbo-name">알리</span>
              <span class="jokbo-desc">1월 + 2월</span>
            </div>
            <div class="jokbo-item rare">
              <span class="jokbo-name">독사</span>
              <span class="jokbo-desc">1월 + 4월</span>
            </div>
            <div class="jokbo-item rare">
              <span class="jokbo-name">구삥</span>
              <span class="jokbo-desc">1월 + 9월</span>
            </div>
            <div class="jokbo-item rare">
              <span class="jokbo-name">장삥</span>
              <span class="jokbo-desc">1월 + 10월</span>
            </div>
            <div class="jokbo-item rare">
              <span class="jokbo-name">장사</span>
              <span class="jokbo-desc">4월 + 10월</span>
            </div>
            <div class="jokbo-item rare">
              <span class="jokbo-name">세륙</span>
              <span class="jokbo-desc">4월 + 6월</span>
            </div>
          </div>
          <div class="jokbo-section">
            <h4>끗 (나머지)</h4>
            <div class="jokbo-item normal">
              <span class="jokbo-name">9끗 ~ 1끗</span>
              <span class="jokbo-desc">두 패 합의 끝자리 (높을수록 좋음)</span>
            </div>
            <div class="jokbo-item worst">
              <span class="jokbo-name">망통</span>
              <span class="jokbo-desc">0끗 (최하위)</span>
            </div>
          </div>
          <div class="jokbo-tip">
            <p>💡 동점일 경우: 광 > 높은 월 순으로 승부</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 설정 화면 -->
    <div v-if="gameState === 'setup'" class="setup-section">
      <div class="setup-header">
        <p class="game-desc">참가자를 추가하고 게임을 시작하세요!</p>
        <button class="btn jokbo-btn" @click="showJokbo = true">족보 보기</button>
      </div>

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

    <!-- 패 교체 단계 -->
    <div v-if="gameState === 'swap'" class="swap-section">
      <div class="swap-header">
        <h3>패 교체</h3>
        <p class="swap-desc">카드를 터치하면 버리고 새 카드를 뽑습니다</p>
        <p class="swap-progress">{{ currentSwapPlayerIndex + 1 }} / {{ players.length }}</p>
      </div>

      <div class="current-player-swap">
        <!-- 패 가림 화면 (다음 사람에게 넘길 때) -->
        <div v-if="isCardHidden" class="hidden-screen">
          <div class="hidden-cards">
            <div class="card-back-large">🎴</div>
            <div class="card-back-large">🎴</div>
          </div>
          <div class="swap-player-name">{{ players[currentSwapPlayerIndex]?.name }}</div>
          <p class="hidden-message">본인만 볼 수 있도록 기기를 가져가세요</p>
          <button class="btn reveal-my-btn" @click="revealMyCards">
            내 패 보기
          </button>
        </div>

        <!-- 패 공개 상태 -->
        <div v-else>
          <div class="swap-player-name">{{ players[currentSwapPlayerIndex]?.name }}의 차례</div>

          <!-- 추천 메시지 -->
          <div
            v-if="!players[currentSwapPlayerIndex]?.hasSwapped && getSwapRecommendation(players[currentSwapPlayerIndex])"
            class="recommendation"
            :class="{
              'rec-keep': getSwapRecommendation(players[currentSwapPlayerIndex]).action === 'keep',
              'rec-swap': getSwapRecommendation(players[currentSwapPlayerIndex]).action === 'swap',
              'rec-maybe': getSwapRecommendation(players[currentSwapPlayerIndex]).action === 'maybe',
              'rec-strong': getSwapRecommendation(players[currentSwapPlayerIndex]).strong
            }"
          >
            <span class="rec-icon">
              {{ getSwapRecommendation(players[currentSwapPlayerIndex]).action === 'keep' ? '👍' :
                 getSwapRecommendation(players[currentSwapPlayerIndex]).action === 'swap' ? '🔄' : '🤔' }}
            </span>
            <span class="rec-message">{{ getSwapRecommendation(players[currentSwapPlayerIndex]).message }}</span>
            <span v-if="getSwapRecommendation(players[currentSwapPlayerIndex]).reason" class="rec-reason">
              {{ getSwapRecommendation(players[currentSwapPlayerIndex]).reason }}
            </span>
          </div>

          <div class="swap-cards" v-if="!players[currentSwapPlayerIndex]?.hasSwapped">
            <div
              v-for="(card, index) in players[currentSwapPlayerIndex]?.cards"
              :key="card.id"
              class="swap-card"
              :class="{ 'recommended-discard': getSwapRecommendation(players[currentSwapPlayerIndex])?.cardIndex === index }"
              @click="swapCard(index)"
            >
              <span class="card-emoji">{{ getCardEmoji(card.month) }}</span>
              <span class="card-month">{{ card.name }}</span>
              <span v-if="card.isGwang" class="gwang-badge">광</span>
              <div class="swap-hint">터치하면 버림</div>
              <div v-if="getSwapRecommendation(players[currentSwapPlayerIndex])?.cardIndex === index" class="discard-badge">
                버리기 추천
              </div>
            </div>
          </div>

          <div class="swap-result" v-else>
            <p v-if="players[currentSwapPlayerIndex]?.discardedCards.length > 0">
              카드를 교체했습니다
            </p>
            <p v-else>패스했습니다</p>
            <div class="swap-cards readonly">
              <div
                v-for="card in players[currentSwapPlayerIndex]?.cards"
                :key="card.id"
                class="swap-card confirmed"
              >
                <span class="card-emoji">{{ getCardEmoji(card.month) }}</span>
                <span class="card-month">{{ card.name }}</span>
                <span v-if="card.isGwang" class="gwang-badge">광</span>
              </div>
            </div>
          </div>

          <div class="swap-actions">
            <button
              v-if="!players[currentSwapPlayerIndex]?.hasSwapped"
              class="btn skip-btn"
              @click="skipSwap"
            >
              패스 (교체 안함)
            </button>
            <button
              v-if="players[currentSwapPlayerIndex]?.hasSwapped"
              class="btn next-btn"
              @click="nextSwapPlayer"
            >
              {{ currentSwapPlayerIndex < players.length - 1 ? '다음 사람' : '패 공개하기' }}
            </button>
          </div>
        </div>
      </div>

      <div class="remaining-cards-info">
        남은 카드: {{ remainingDeck.length }}장
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
        <div class="results-header">
          <h4>전체 순위</h4>
          <button class="btn-toggle" @click="showDiscardedCards = !showDiscardedCards">
            {{ showDiscardedCards ? '버린 패 숨기기' : '버린 패 보기' }}
          </button>
        </div>
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
            <span v-if="showDiscardedCards && player.discardedCards.length > 0" class="discarded-info">
              버림: {{ player.discardedCards.map(c => c.name).join(', ') }}
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

/* 패 교체 단계 */
.swap-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.swap-header {
  text-align: center;
}

.swap-header h3 {
  font-size: 1.5rem;
  margin-bottom: 8px;
  color: var(--neon-yellow);
}

.swap-desc {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin-bottom: 5px;
}

.swap-progress {
  color: var(--neon-pink);
  font-weight: bold;
}

.current-player-swap {
  background: var(--card-bg);
  border-radius: 16px;
  padding: 25px;
  text-align: center;
}

.swap-player-name {
  font-size: 1.3rem;
  font-weight: bold;
  margin-bottom: 20px;
  color: var(--neon-blue);
}

.swap-cards {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-bottom: 20px;
}

.swap-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 25px;
  background: linear-gradient(145deg, #2a2a3e, #1a1a2e);
  border-radius: 16px;
  border: 3px solid var(--border-color);
  cursor: pointer;
  position: relative;
  transition: all 0.3s ease;
  min-width: 100px;
}

.swap-card:hover {
  border-color: var(--neon-pink);
  transform: translateY(-5px);
  box-shadow: 0 10px 30px rgba(233, 69, 96, 0.3);
}

.swap-card:active {
  transform: scale(0.95);
}

.swap-card .card-emoji {
  font-size: 2.5rem;
}

.swap-card .card-month {
  font-size: 1.1rem;
  margin-top: 8px;
}

.swap-card .gwang-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  background: gold;
  color: #000;
  font-size: 0.75rem;
  padding: 4px 8px;
  border-radius: 10px;
  font-weight: bold;
}

.swap-hint {
  position: absolute;
  bottom: -25px;
  font-size: 0.75rem;
  color: var(--text-secondary);
  opacity: 0;
  transition: opacity 0.3s;
}

.swap-card:hover .swap-hint {
  opacity: 1;
}

.swap-card.confirmed {
  cursor: default;
  border-color: var(--neon-blue);
}

.swap-card.confirmed:hover {
  transform: none;
  box-shadow: none;
}

.swap-cards.readonly .swap-card {
  cursor: default;
}

.swap-cards.readonly .swap-card:hover {
  transform: none;
  box-shadow: none;
}

.swap-result {
  margin-bottom: 20px;
}

.swap-result p {
  color: var(--neon-yellow);
  margin-bottom: 15px;
  font-size: 1.1rem;
}

.swap-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.skip-btn {
  background: var(--card-bg) !important;
  border: 2px solid var(--border-color);
  padding: 12px 25px;
}

.next-btn {
  background: linear-gradient(135deg, var(--neon-blue), var(--neon-purple)) !important;
  padding: 12px 25px;
}

.remaining-cards-info {
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

/* 버린 패 보기 */
.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.results-header h4 {
  margin: 0;
  color: var(--text-secondary);
}

.btn-toggle {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-toggle:hover {
  border-color: var(--neon-pink);
}

.discarded-info {
  display: block;
  width: 100%;
  margin-top: 5px;
  font-size: 0.75rem;
  color: #ff6b6b;
  padding-left: 35px;
}

.rank-item {
  flex-wrap: wrap;
}

/* 패 가림 화면 */
.hidden-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 30px 0;
}

.hidden-cards {
  display: flex;
  gap: 15px;
}

.card-back-large {
  font-size: 4rem;
  filter: grayscale(0.5);
  animation: cardFloat 2s ease-in-out infinite;
}

.card-back-large:nth-child(2) {
  animation-delay: 0.3s;
}

@keyframes cardFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.hidden-message {
  color: var(--text-secondary);
  font-size: 0.95rem;
  text-align: center;
}

.reveal-my-btn {
  background: linear-gradient(135deg, var(--neon-pink), var(--neon-purple)) !important;
  padding: 15px 40px;
  font-size: 1.1rem;
  animation: buttonGlow 2s infinite;
}

@keyframes buttonGlow {
  0%, 100% { box-shadow: 0 0 15px var(--neon-pink); }
  50% { box-shadow: 0 0 30px var(--neon-purple); }
}

/* 족보 모달 */
.jokbo-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 20px;
}

.jokbo-content {
  background: var(--bg-secondary);
  border-radius: 20px;
  max-width: 400px;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  border: 2px solid var(--border-color);
}

.jokbo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  background: var(--bg-secondary);
}

.jokbo-header h3 {
  margin: 0;
  font-size: 1.3rem;
  background: linear-gradient(135deg, var(--neon-pink), var(--neon-yellow));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 1.5rem;
  cursor: pointer;
  padding: 5px 10px;
}

.close-btn:hover {
  color: var(--text-primary);
}

.jokbo-list {
  padding: 15px 20px;
}

.jokbo-section {
  margin-bottom: 20px;
}

.jokbo-section h4 {
  color: var(--text-secondary);
  font-size: 0.85rem;
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.jokbo-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-radius: 10px;
  margin-bottom: 6px;
}

.jokbo-item.legendary {
  background: linear-gradient(135deg, rgba(255, 107, 107, 0.2), rgba(255, 217, 61, 0.2));
  border: 1px solid rgba(255, 217, 61, 0.4);
}

.jokbo-item.epic {
  background: linear-gradient(135deg, rgba(155, 89, 182, 0.2), rgba(233, 69, 96, 0.2));
  border: 1px solid rgba(155, 89, 182, 0.4);
}

.jokbo-item.rare {
  background: linear-gradient(135deg, rgba(52, 152, 219, 0.2), rgba(155, 89, 182, 0.2));
  border: 1px solid rgba(52, 152, 219, 0.4);
}

.jokbo-item.normal {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.jokbo-item.worst {
  background: rgba(255, 100, 100, 0.15);
  border: 1px solid rgba(255, 100, 100, 0.3);
}

.jokbo-name {
  font-weight: bold;
  font-size: 0.95rem;
}

.jokbo-desc {
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.jokbo-tip {
  background: rgba(255, 215, 0, 0.1);
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 10px;
  padding: 12px;
  margin-top: 10px;
}

.jokbo-tip p {
  margin: 0;
  font-size: 0.85rem;
  color: var(--neon-yellow);
}

/* 설정 헤더 */
.setup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.setup-header .game-desc {
  margin: 0;
}

.jokbo-btn {
  padding: 8px 16px;
  font-size: 0.85rem;
  background: var(--card-bg) !important;
  border: 1px solid var(--border-color);
}

.jokbo-btn:hover {
  border-color: var(--neon-yellow);
}

/* 추천 메시지 */
.recommendation {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 12px 20px;
  border-radius: 12px;
  margin-bottom: 20px;
  animation: recPop 0.3s ease-out;
}

@keyframes recPop {
  0% { transform: scale(0.9); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.recommendation.rec-keep {
  background: linear-gradient(135deg, rgba(46, 204, 113, 0.2), rgba(39, 174, 96, 0.2));
  border: 1px solid rgba(46, 204, 113, 0.5);
}

.recommendation.rec-swap {
  background: linear-gradient(135deg, rgba(241, 196, 15, 0.2), rgba(243, 156, 18, 0.2));
  border: 1px solid rgba(241, 196, 15, 0.5);
}

.recommendation.rec-swap.rec-strong {
  background: linear-gradient(135deg, rgba(231, 76, 60, 0.2), rgba(192, 57, 43, 0.2));
  border: 1px solid rgba(231, 76, 60, 0.5);
  animation: recPop 0.3s ease-out, strongPulse 1s infinite;
}

@keyframes strongPulse {
  0%, 100% { box-shadow: 0 0 10px rgba(231, 76, 60, 0.3); }
  50% { box-shadow: 0 0 20px rgba(231, 76, 60, 0.5); }
}

.recommendation.rec-maybe {
  background: linear-gradient(135deg, rgba(155, 89, 182, 0.2), rgba(142, 68, 173, 0.2));
  border: 1px solid rgba(155, 89, 182, 0.5);
}

.rec-icon {
  font-size: 1.5rem;
}

.rec-message {
  font-weight: bold;
  font-size: 1rem;
}

.rec-reason {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

/* 버리기 추천 카드 표시 */
.swap-card.recommended-discard {
  border-color: rgba(241, 196, 15, 0.7);
  position: relative;
}

.swap-card.recommended-discard::before {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(241, 196, 15, 0.3), rgba(243, 156, 18, 0.1));
  z-index: -1;
  animation: recommendGlow 1.5s infinite;
}

@keyframes recommendGlow {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.discard-badge {
  position: absolute;
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #f39c12, #e74c3c);
  color: white;
  font-size: 0.7rem;
  padding: 3px 10px;
  border-radius: 10px;
  white-space: nowrap;
  font-weight: bold;
}
</style>
