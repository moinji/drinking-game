<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { database, ref as dbRef, set, onValue, push, remove, onDisconnect } from '../firebase'

// 상태
const gameState = ref('lobby') // lobby, waiting, playing, result
const roomCode = ref('')
const playerName = ref('')
const isHost = ref(false)
const players = ref([])
const myPlayerId = ref('')

// 솔로 모드
const isSoloMode = ref(false)

// 게임 설정
const maxRounds = ref(1)
const currentRound = ref(0)

// 신호등 상태
const lightState = ref('waiting') // waiting, red, yellow, green, finished
const canClick = ref(false)
const isDisqualified = ref(false)
const hasClicked = ref(false)
const greenStartTime = ref(0)
const myReactionTime = ref(null)

// 결과
const roundResults = ref([])
const soloResults = ref([]) // 솔로 모드 라운드별 결과
const totalScores = ref({})

// Firebase 리스너 해제용
let unsubscribers = []
let lightTimer = null
let lightTimer2 = null
let lightTimer3 = null

// 방 코드 생성
const generateRoomCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

// 솔로 게임 시작
const startSoloGame = () => {
  isSoloMode.value = true
  isHost.value = true
  myPlayerId.value = 'solo'
  playerName.value = playerName.value.trim() || '플레이어'
  soloResults.value = []
  currentRound.value = 1
  gameState.value = 'playing'
  resetRoundState()
  startSoloLightSequence()
}

// 솔로 신호등 시퀀스
const startSoloLightSequence = () => {
  lightState.value = 'red'
  const redDuration = Math.random() * 9000 + 1000

  lightTimer = setTimeout(() => {
    lightState.value = 'yellow'
    const yellowDuration = Math.random() * 9000 + 1000

    lightTimer2 = setTimeout(() => {
      lightState.value = 'green'
      greenStartTime.value = Date.now()
      canClick.value = true

      // 5초 후 라운드 종료
      lightTimer3 = setTimeout(() => {
        lightState.value = 'finished'
        canClick.value = false

        // 클릭 안했으면 기록
        if (!hasClicked.value && !isDisqualified.value) {
          soloResults.value.push({
            round: currentRound.value,
            reactionTime: null,
            disqualified: false,
            missed: true
          })
        }

        // 다음 라운드 또는 결과
        setTimeout(() => processSoloRoundEnd(), 2000)
      }, 5000)
    }, yellowDuration)
  }, redDuration)
}

// 솔로 클릭 처리
const handleSoloClick = () => {
  if (hasClicked.value || isDisqualified.value) return

  if (lightState.value === 'red' || lightState.value === 'yellow') {
    isDisqualified.value = true
    hasClicked.value = true
    soloResults.value.push({
      round: currentRound.value,
      reactionTime: null,
      disqualified: true,
      missed: false
    })
  } else if (lightState.value === 'green' && canClick.value) {
    hasClicked.value = true
    canClick.value = false
    const reactionTime = Date.now() - greenStartTime.value
    myReactionTime.value = reactionTime
    soloResults.value.push({
      round: currentRound.value,
      reactionTime: reactionTime,
      disqualified: false,
      missed: false
    })
  }
}

// 솔로 라운드 종료 처리
const processSoloRoundEnd = () => {
  if (currentRound.value >= maxRounds.value) {
    gameState.value = 'result'
  } else {
    currentRound.value++
    resetRoundState()
    lightState.value = 'waiting'
    setTimeout(() => startSoloLightSequence(), 1500)
  }
}

// 솔로 결과 계산
const soloStats = computed(() => {
  const validResults = soloResults.value.filter(r => !r.disqualified && !r.missed && r.reactionTime)
  if (validResults.length === 0) return { best: null, avg: null, count: 0 }

  const times = validResults.map(r => r.reactionTime)
  const best = Math.min(...times)
  const avg = times.reduce((a, b) => a + b, 0) / times.length

  return { best, avg, count: validResults.length }
})

// 솔로 다시하기
const retrySolo = () => {
  soloResults.value = []
  currentRound.value = 1
  gameState.value = 'playing'
  resetRoundState()
  startSoloLightSequence()
}

// 방 생성
const createRoom = async () => {
  if (!playerName.value.trim()) return alert('이름을 입력하세요')

  roomCode.value = generateRoomCode()
  myPlayerId.value = push(dbRef(database, 'temp')).key
  isHost.value = true
  isSoloMode.value = false

  const roomRef = dbRef(database, `trafficRooms/${roomCode.value}`)
  await set(roomRef, {
    host: myPlayerId.value,
    state: 'waiting',
    maxRounds: 1,
    currentRound: 0,
    lightState: 'waiting',
    greenStartTime: 0
  })

  const playerRef = dbRef(database, `trafficRooms/${roomCode.value}/players/${myPlayerId.value}`)
  await set(playerRef, {
    name: playerName.value.trim(),
    isHost: true,
    totalScore: 0
  })

  onDisconnect(playerRef).remove()

  joinRoomListeners()
  gameState.value = 'waiting'
}

// 방 참가
const joinRoom = async () => {
  if (!playerName.value.trim()) return alert('이름을 입력하세요')
  if (!roomCode.value.trim()) return alert('방 코드를 입력하세요')

  roomCode.value = roomCode.value.toUpperCase()
  myPlayerId.value = push(dbRef(database, 'temp')).key
  isSoloMode.value = false

  const roomRef = dbRef(database, `trafficRooms/${roomCode.value}`)
  onValue(roomRef, (snapshot) => {
    if (!snapshot.exists()) {
      alert('존재하지 않는 방입니다')
      return
    }
  }, { onlyOnce: true })

  const playerRef = dbRef(database, `trafficRooms/${roomCode.value}/players/${myPlayerId.value}`)
  await set(playerRef, {
    name: playerName.value.trim(),
    isHost: false,
    totalScore: 0
  })

  onDisconnect(playerRef).remove()

  joinRoomListeners()
  gameState.value = 'waiting'
}

// 방 리스너 연결
const joinRoomListeners = () => {
  const playersRef = dbRef(database, `trafficRooms/${roomCode.value}/players`)
  const unsubPlayers = onValue(playersRef, (snapshot) => {
    const data = snapshot.val()
    if (data) {
      players.value = Object.entries(data).map(([id, player]) => ({
        id,
        ...player
      }))
    }
  })
  unsubscribers.push(() => unsubPlayers())

  const roomRef = dbRef(database, `trafficRooms/${roomCode.value}`)
  const unsubRoom = onValue(roomRef, (snapshot) => {
    const data = snapshot.val()
    if (data) {
      maxRounds.value = data.maxRounds || 1
      currentRound.value = data.currentRound || 0

      if (data.state === 'playing' && gameState.value !== 'playing') {
        gameState.value = 'playing'
        resetRoundState()
      } else if (data.state === 'result') {
        gameState.value = 'result'
      } else if (data.state === 'waiting') {
        gameState.value = 'waiting'
      }

      if (data.lightState && data.lightState !== lightState.value) {
        lightState.value = data.lightState

        if (data.lightState === 'green' && !isDisqualified.value && !hasClicked.value) {
          canClick.value = true
          greenStartTime.value = data.greenStartTime
        } else if (data.lightState === 'finished') {
          canClick.value = false
        }
      }
    }
  })
  unsubscribers.push(() => unsubRoom())

  const resultsRef = dbRef(database, `trafficRooms/${roomCode.value}/roundResults`)
  const unsubResults = onValue(resultsRef, (snapshot) => {
    const data = snapshot.val()
    if (data) {
      roundResults.value = Object.values(data).sort((a, b) => {
        if (a.disqualified && !b.disqualified) return 1
        if (!a.disqualified && b.disqualified) return -1
        if (a.disqualified && b.disqualified) return 0
        return a.reactionTime - b.reactionTime
      })
    } else {
      roundResults.value = []
    }
  })
  unsubscribers.push(() => unsubResults())
}

// 라운드 상태 초기화
const resetRoundState = () => {
  isDisqualified.value = false
  hasClicked.value = false
  canClick.value = false
  myReactionTime.value = null
  lightState.value = 'waiting'
}

// 라운드 수 변경 (호스트만 또는 솔로)
const changeMaxRounds = async (rounds) => {
  maxRounds.value = rounds
  if (!isSoloMode.value && isHost.value) {
    await set(dbRef(database, `trafficRooms/${roomCode.value}/maxRounds`), rounds)
  }
}

// 게임 시작 (호스트만)
const startGame = async () => {
  if (!isHost.value || players.value.length < 2) return

  for (const player of players.value) {
    await set(dbRef(database, `trafficRooms/${roomCode.value}/players/${player.id}/totalScore`), 0)
  }

  await set(dbRef(database, `trafficRooms/${roomCode.value}/currentRound`), 1)
  await set(dbRef(database, `trafficRooms/${roomCode.value}/state`), 'playing')
  await set(dbRef(database, `trafficRooms/${roomCode.value}/roundResults`), null)

  startLightSequence()
}

// 신호등 시퀀스 시작 (호스트만)
const startLightSequence = async () => {
  if (!isHost.value) return

  await set(dbRef(database, `trafficRooms/${roomCode.value}/lightState`), 'red')
  const redDuration = Math.random() * 9000 + 1000

  lightTimer = setTimeout(async () => {
    await set(dbRef(database, `trafficRooms/${roomCode.value}/lightState`), 'yellow')
    const yellowDuration = Math.random() * 9000 + 1000

    lightTimer2 = setTimeout(async () => {
      const greenTime = Date.now()
      await set(dbRef(database, `trafficRooms/${roomCode.value}/greenStartTime`), greenTime)
      await set(dbRef(database, `trafficRooms/${roomCode.value}/lightState`), 'green')

      lightTimer3 = setTimeout(async () => {
        await set(dbRef(database, `trafficRooms/${roomCode.value}/lightState`), 'finished')
        setTimeout(() => processRoundEnd(), 1000)
      }, 5000)
    }, yellowDuration)
  }, redDuration)
}

// 화면 클릭 처리
const handleClick = async () => {
  if (isSoloMode.value) {
    handleSoloClick()
    return
  }

  if (hasClicked.value || isDisqualified.value) return

  if (lightState.value === 'red' || lightState.value === 'yellow') {
    isDisqualified.value = true
    hasClicked.value = true

    await set(dbRef(database, `trafficRooms/${roomCode.value}/roundResults/${myPlayerId.value}`), {
      playerId: myPlayerId.value,
      playerName: playerName.value,
      disqualified: true,
      reactionTime: null,
      timestamp: Date.now()
    })
  } else if (lightState.value === 'green' && canClick.value) {
    hasClicked.value = true
    canClick.value = false
    const reactionTime = Date.now() - greenStartTime.value
    myReactionTime.value = reactionTime

    await set(dbRef(database, `trafficRooms/${roomCode.value}/roundResults/${myPlayerId.value}`), {
      playerId: myPlayerId.value,
      playerName: playerName.value,
      disqualified: false,
      reactionTime: reactionTime,
      timestamp: Date.now()
    })
  }
}

// 라운드 종료 처리 (호스트만)
const processRoundEnd = async () => {
  if (!isHost.value) return

  const validResults = roundResults.value.filter(r => !r.disqualified)
  for (let i = 0; i < validResults.length; i++) {
    const result = validResults[i]
    const points = Math.max(10 - i * 2, 1)

    const playerRef = dbRef(database, `trafficRooms/${roomCode.value}/players/${result.playerId}/totalScore`)
    onValue(playerRef, async (snapshot) => {
      const current = snapshot.val() || 0
      await set(playerRef, current + points)
    }, { onlyOnce: true })
  }

  setTimeout(async () => {
    if (currentRound.value >= maxRounds.value) {
      await set(dbRef(database, `trafficRooms/${roomCode.value}/state`), 'result')
    } else {
      await set(dbRef(database, `trafficRooms/${roomCode.value}/currentRound`), currentRound.value + 1)
      await set(dbRef(database, `trafficRooms/${roomCode.value}/roundResults`), null)
      await set(dbRef(database, `trafficRooms/${roomCode.value}/lightState`), 'waiting')

      setTimeout(() => {
        resetRoundState()
        startLightSequence()
      }, 2000)
    }
  }, 3000)
}

// 정렬된 최종 순위
const finalRanking = computed(() => {
  return [...players.value].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
})

// 방 코드 복사
const copyRoomCode = async () => {
  try {
    await navigator.clipboard.writeText(roomCode.value)
  } catch {
    const input = document.createElement('input')
    input.value = roomCode.value
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
  }
}

// 방 나가기 / 로비로
const leaveRoom = async () => {
  clearAllTimers()
  unsubscribers.forEach(unsub => unsub())
  unsubscribers = []

  if (!isSoloMode.value && myPlayerId.value && roomCode.value) {
    await remove(dbRef(database, `trafficRooms/${roomCode.value}/players/${myPlayerId.value}`))
  }

  gameState.value = 'lobby'
  roomCode.value = ''
  players.value = []
  isHost.value = false
  isSoloMode.value = false
  roundResults.value = []
  soloResults.value = []
}

// 다시 하기
const playAgain = async () => {
  if (isSoloMode.value) {
    retrySolo()
    return
  }

  if (!isHost.value) return

  for (const player of players.value) {
    await set(dbRef(database, `trafficRooms/${roomCode.value}/players/${player.id}/totalScore`), 0)
  }

  await set(dbRef(database, `trafficRooms/${roomCode.value}/state`), 'waiting')
  await set(dbRef(database, `trafficRooms/${roomCode.value}/currentRound`), 0)
  await set(dbRef(database, `trafficRooms/${roomCode.value}/lightState`), 'waiting')
  await set(dbRef(database, `trafficRooms/${roomCode.value}/roundResults`), null)
}

// 타이머 정리
const clearAllTimers = () => {
  if (lightTimer) clearTimeout(lightTimer)
  if (lightTimer2) clearTimeout(lightTimer2)
  if (lightTimer3) clearTimeout(lightTimer3)
  lightTimer = null
  lightTimer2 = null
  lightTimer3 = null
}

onMounted(() => {
  const savedName = localStorage.getItem('trafficlight_name')
  if (savedName) playerName.value = savedName
})

onUnmounted(() => {
  clearAllTimers()
  unsubscribers.forEach(unsub => unsub())
})

watch(playerName, (name) => {
  if (name) localStorage.setItem('trafficlight_name', name)
})
</script>

<template>
  <div class="game-container traffic-light">
    <h2 class="game-title">🚦 신호등 게임</h2>

    <!-- 로비 -->
    <div v-if="gameState === 'lobby'" class="lobby-section">
      <div class="input-group">
        <input
          v-model="playerName"
          type="text"
          placeholder="닉네임 입력"
          maxlength="10"
          class="name-input"
        />
      </div>

      <!-- 솔로 모드 설정 -->
      <div class="solo-settings">
        <div class="rounds-setting">
          <span class="setting-label">라운드 수</span>
          <div class="rounds-selector">
            <button
              v-for="n in [1, 2, 3, 4, 5]"
              :key="n"
              class="round-btn"
              :class="{ active: maxRounds === n }"
              @click="maxRounds = n"
            >
              {{ n }}
            </button>
          </div>
        </div>

        <button class="btn solo-btn" @click="startSoloGame">
          혼자 하기
        </button>
      </div>

      <div class="divider">
        <span>또는</span>
      </div>

      <div class="room-actions">
        <button class="btn create-btn" @click="createRoom">
          방 만들기
        </button>

        <div class="join-section">
          <input
            v-model="roomCode"
            type="text"
            placeholder="방 코드"
            maxlength="6"
            class="code-input"
            @input="roomCode = roomCode.toUpperCase()"
          />
          <button class="btn join-btn" @click="joinRoom">
            참가하기
          </button>
        </div>
      </div>
    </div>

    <!-- 대기실 (멀티플레이어만) -->
    <div v-if="gameState === 'waiting' && !isSoloMode" class="waiting-section">
      <div class="room-info">
        <span class="room-label">방 코드</span>
        <span class="room-code">{{ roomCode }}</span>
        <button class="copy-btn" @click="copyRoomCode">복사</button>
      </div>

      <div class="players-list">
        <h4>참가자 ({{ players.length }}명)</h4>
        <div class="player-item" v-for="player in players" :key="player.id">
          <span class="player-name">
            {{ player.name }}
            <span v-if="player.isHost" class="host-badge">방장</span>
            <span v-if="player.id === myPlayerId" class="me-badge">나</span>
          </span>
        </div>
      </div>

      <div class="rounds-setting">
        <span class="setting-label">라운드 수</span>
        <div class="rounds-selector">
          <button
            v-for="n in [1, 2, 3, 4, 5]"
            :key="n"
            class="round-btn"
            :class="{ active: maxRounds === n }"
            :disabled="!isHost"
            @click="changeMaxRounds(n)"
          >
            {{ n }}
          </button>
        </div>
        <span class="setting-hint" v-if="!isHost">방장만 변경 가능</span>
      </div>

      <div class="game-rules">
        <h4>게임 규칙</h4>
        <ul>
          <li>🔴 빨간불, 🟡 노란불에 누르면 <strong>실격</strong></li>
          <li>🟢 초록불이 되면 사람을 빠르게 터치!</li>
          <li>가장 빠른 사람이 승리</li>
        </ul>
      </div>

      <button
        v-if="isHost"
        class="btn start-btn"
        :disabled="players.length < 2"
        @click="startGame"
      >
        {{ players.length < 2 ? '2명 이상 필요' : '게임 시작' }}
      </button>
      <p v-else class="waiting-text">방장이 게임을 시작하기를 기다리는 중...</p>

      <button class="btn leave-btn" @click="leaveRoom">나가기</button>
    </div>

    <!-- 게임 중 -->
    <div v-if="gameState === 'playing'" class="playing-section">
      <div class="round-indicator">
        라운드 {{ currentRound }} / {{ maxRounds }}
        <span v-if="isSoloMode" class="solo-badge">솔로</span>
      </div>

      <!-- 신호등 -->
      <div class="traffic-light-box">
        <div class="light red" :class="{ active: lightState === 'red' }"></div>
        <div class="light yellow" :class="{ active: lightState === 'yellow' }"></div>
        <div class="light green" :class="{ active: lightState === 'green' || lightState === 'finished' }"></div>
      </div>

      <!-- 횡단보도 영역 -->
      <div
        class="crosswalk-area"
        @click="handleClick"
        :class="{
          clickable: canClick && !hasClicked,
          disqualified: isDisqualified
        }"
      >
        <!-- 횡단보도 -->
        <div class="crosswalk">
          <div class="stripe" v-for="i in 6" :key="i"></div>
        </div>

        <!-- 사람 -->
        <div class="person" :class="{ walking: hasClicked && !isDisqualified }">
          <div class="head"></div>
          <div class="body"></div>
          <div class="legs">
            <div class="leg left"></div>
            <div class="leg right"></div>
          </div>
        </div>

        <!-- 상태 메시지 -->
        <div class="status-message" v-if="lightState === 'waiting'">
          준비...
        </div>
        <div class="status-message" v-else-if="isDisqualified">
          실격! 🚫
        </div>
        <div class="status-message" v-else-if="hasClicked && myReactionTime">
          {{ (myReactionTime / 1000).toFixed(3) }}초
        </div>
        <div class="status-message blink" v-else-if="lightState === 'green' && canClick">
          지금이야! 터치!
        </div>
        <div class="status-message" v-else-if="lightState === 'red' || lightState === 'yellow'">
          기다려...
        </div>
        <div class="status-message" v-else-if="lightState === 'finished' && !hasClicked">
          놓쳤어요!
        </div>
      </div>

      <!-- 솔로 모드 현재 라운드 결과 -->
      <div v-if="isSoloMode && soloResults.length > 0" class="live-results">
        <h4>기록</h4>
        <div
          v-for="result in soloResults"
          :key="result.round"
          class="result-item"
          :class="{ disqualified: result.disqualified, missed: result.missed }"
        >
          <span class="rank">{{ result.round }}R</span>
          <span class="time">
            {{ result.disqualified ? '실격' : result.missed ? '미스' : `${(result.reactionTime / 1000).toFixed(3)}초` }}
          </span>
        </div>
      </div>

      <!-- 멀티플레이어 현재 라운드 결과 -->
      <div v-if="!isSoloMode && roundResults.length > 0" class="live-results">
        <h4>현재 순위</h4>
        <div
          v-for="(result, index) in roundResults"
          :key="result.playerId"
          class="result-item"
          :class="{ mine: result.playerId === myPlayerId, disqualified: result.disqualified }"
        >
          <span class="rank">{{ result.disqualified ? '💀' : `${index + 1}위` }}</span>
          <span class="name">{{ result.playerName }}</span>
          <span class="time">
            {{ result.disqualified ? '실격' : `${(result.reactionTime / 1000).toFixed(3)}초` }}
          </span>
        </div>
      </div>
    </div>

    <!-- 솔로 결과 -->
    <div v-if="gameState === 'result' && isSoloMode" class="result-section">
      <div class="solo-result-display">
        <div class="result-emoji">{{ soloStats.count > 0 ? '⏱️' : '😢' }}</div>
        <div class="result-title">{{ soloStats.count > 0 ? '기록 완료!' : '아쉬워요' }}</div>

        <div v-if="soloStats.count > 0" class="solo-stats">
          <div class="stat-item">
            <span class="stat-label">최고 기록</span>
            <span class="stat-value best">{{ (soloStats.best / 1000).toFixed(3) }}초</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">평균</span>
            <span class="stat-value">{{ (soloStats.avg / 1000).toFixed(3) }}초</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">성공</span>
            <span class="stat-value">{{ soloStats.count }} / {{ maxRounds }}</span>
          </div>
        </div>
        <div v-else class="no-record">
          성공한 라운드가 없어요
        </div>
      </div>

      <div class="round-history">
        <h4>라운드별 기록</h4>
        <div
          v-for="result in soloResults"
          :key="result.round"
          class="history-item"
          :class="{ disqualified: result.disqualified, missed: result.missed, success: !result.disqualified && !result.missed }"
        >
          <span class="round">{{ result.round }}라운드</span>
          <span class="time">
            {{ result.disqualified ? '실격 🚫' : result.missed ? '미스 ⏰' : `${(result.reactionTime / 1000).toFixed(3)}초` }}
          </span>
        </div>
      </div>

      <div class="result-actions">
        <button class="btn" @click="retrySolo">다시 하기</button>
        <button class="btn leave-btn" @click="leaveRoom">나가기</button>
      </div>
    </div>

    <!-- 멀티플레이어 결과 -->
    <div v-if="gameState === 'result' && !isSoloMode" class="result-section">
      <div class="winner-display">
        <div class="trophy">🏆</div>
        <div class="winner-title">최종 우승!</div>
        <div class="winner-name">{{ finalRanking[0]?.name }}</div>
        <div class="winner-score">{{ finalRanking[0]?.totalScore || 0 }}점</div>
      </div>

      <div class="final-ranking">
        <h4>최종 순위</h4>
        <div
          v-for="(player, index) in finalRanking"
          :key="player.id"
          class="ranking-item"
          :class="{ mine: player.id === myPlayerId }"
        >
          <span class="rank">{{ index + 1 }}위</span>
          <span class="name">{{ player.name }}</span>
          <span class="score">{{ player.totalScore || 0 }}점</span>
        </div>
      </div>

      <div class="result-actions">
        <button v-if="isHost" class="btn" @click="playAgain">다시 하기</button>
        <button class="btn leave-btn" @click="leaveRoom">나가기</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.traffic-light {
  padding: 15px;
  max-width: 400px;
}

.game-title {
  text-align: center;
  font-size: 1.8rem;
  margin-bottom: 20px;
}

/* 로비 */
.lobby-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.name-input, .code-input {
  padding: 12px 16px;
  border: 2px solid var(--border-color);
  border-radius: 12px;
  background: var(--card-bg);
  color: var(--text-primary);
  font-size: 1rem;
}

.name-input:focus, .code-input:focus {
  outline: none;
  border-color: #00b894;
}

/* 솔로 설정 */
.solo-settings {
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 20px;
  background: var(--card-bg);
  border-radius: 12px;
  border: 2px solid #f39c12;
}

.solo-btn {
  background: linear-gradient(135deg, #f39c12, #e74c3c) !important;
  padding: 15px;
  font-size: 1.1rem;
}

/* 구분선 */
.divider {
  display: flex;
  align-items: center;
  gap: 15px;
  color: var(--text-secondary);
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border-color);
}

.room-actions {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.create-btn {
  background: linear-gradient(135deg, #00b894, #00cec9) !important;
  padding: 15px;
  font-size: 1.1rem;
}

.join-section {
  display: flex;
  gap: 10px;
}

.code-input {
  flex: 1;
  text-transform: uppercase;
  letter-spacing: 2px;
  font-weight: bold;
}

.join-btn {
  padding: 12px 20px;
  background: linear-gradient(135deg, #0984e3, #6c5ce7) !important;
}

/* 대기실 */
.waiting-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.room-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 15px;
  background: var(--card-bg);
  border-radius: 12px;
}

.room-label {
  color: var(--text-secondary);
}

.room-code {
  font-size: 1.5rem;
  font-weight: bold;
  letter-spacing: 3px;
  color: #00b894;
}

.copy-btn {
  padding: 5px 12px;
  background: var(--border-color);
  border: none;
  border-radius: 8px;
  color: var(--text-primary);
  cursor: pointer;
}

.players-list {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 15px;
}

.players-list h4 {
  margin-bottom: 10px;
  color: var(--text-secondary);
}

.player-item {
  padding: 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 5px;
}

.host-badge {
  background: #ffd93d;
  color: #000;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.75rem;
  margin-left: 5px;
}

.me-badge {
  background: #00b894;
  color: #fff;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.75rem;
  margin-left: 5px;
}

.solo-badge {
  background: linear-gradient(135deg, #f39c12, #e74c3c);
  color: #fff;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.75rem;
  margin-left: 8px;
}

/* 라운드 설정 */
.rounds-setting {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 15px;
  background: var(--card-bg);
  border-radius: 12px;
}

.solo-settings .rounds-setting {
  padding: 0;
  background: transparent;
}

.setting-label {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.rounds-selector {
  display: flex;
  gap: 8px;
}

.round-btn {
  width: 40px;
  height: 40px;
  border: 2px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
}

.round-btn:disabled {
  cursor: default;
}

.round-btn.active {
  border-color: #00b894;
  background: rgba(0, 184, 148, 0.2);
  color: #00b894;
}

.round-btn:not(:disabled):hover {
  border-color: #00b894;
}

.setting-hint {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

/* 게임 규칙 */
.game-rules {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 15px;
}

.game-rules h4 {
  margin-bottom: 10px;
  color: var(--text-secondary);
}

.game-rules ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.game-rules li {
  padding: 5px 0;
  font-size: 0.9rem;
}

.start-btn {
  padding: 15px;
  font-size: 1.1rem;
}

.start-btn:disabled {
  opacity: 0.5;
}

.waiting-text {
  text-align: center;
  color: var(--text-secondary);
}

.leave-btn {
  background: var(--card-bg) !important;
  border: 1px solid var(--border-color);
}

/* 게임 중 */
.playing-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.round-indicator {
  font-size: 1rem;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
}

/* 신호등 */
.traffic-light-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 15px 20px;
  background: #333;
  border-radius: 15px;
  border: 4px solid #222;
}

.light {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: #444;
  transition: all 0.3s;
}

.light.red.active {
  background: #e74c3c;
  box-shadow: 0 0 30px #e74c3c, 0 0 60px #e74c3c;
}

.light.yellow.active {
  background: #f1c40f;
  box-shadow: 0 0 30px #f1c40f, 0 0 60px #f1c40f;
}

.light.green.active {
  background: #2ecc71;
  box-shadow: 0 0 30px #2ecc71, 0 0 60px #2ecc71;
}

/* 횡단보도 영역 */
.crosswalk-area {
  position: relative;
  width: 100%;
  height: 200px;
  background: #555;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.crosswalk-area.clickable {
  animation: pulse-border 0.5s infinite;
}

.crosswalk-area.disqualified {
  background: rgba(231, 76, 60, 0.3);
}

@keyframes pulse-border {
  0%, 100% { box-shadow: 0 0 0 0 rgba(46, 204, 113, 0.7); }
  50% { box-shadow: 0 0 0 10px rgba(46, 204, 113, 0); }
}

/* 횡단보도 */
.crosswalk {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 80px;
  display: flex;
  justify-content: space-around;
  padding: 0 20px;
}

.stripe {
  width: 30px;
  height: 100%;
  background: #fff;
}

/* 사람 */
.person {
  position: absolute;
  bottom: 90px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: all 0.5s;
}

.person.walking {
  animation: walk 0.5s ease-out forwards;
}

@keyframes walk {
  0% { transform: translateX(-50%); }
  100% { transform: translateX(-50%) translateY(50px); }
}

.head {
  width: 25px;
  height: 25px;
  background: #ffd93d;
  border-radius: 50%;
}

.body {
  width: 20px;
  height: 30px;
  background: #3498db;
  border-radius: 5px;
  margin-top: 2px;
}

.legs {
  display: flex;
  gap: 4px;
  margin-top: 2px;
}

.leg {
  width: 8px;
  height: 25px;
  background: #2c3e50;
  border-radius: 3px;
}

.person.walking .leg.left {
  animation: leg-move-left 0.2s infinite alternate;
}

.person.walking .leg.right {
  animation: leg-move-right 0.2s infinite alternate;
}

@keyframes leg-move-left {
  0% { transform: rotate(-20deg); }
  100% { transform: rotate(20deg); }
}

@keyframes leg-move-right {
  0% { transform: rotate(20deg); }
  100% { transform: rotate(-20deg); }
}

/* 상태 메시지 */
.status-message {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 1.2rem;
  font-weight: bold;
  color: #fff;
  text-shadow: 0 2px 4px rgba(0,0,0,0.5);
}

.status-message.blink {
  animation: blink 0.3s infinite;
  color: #2ecc71;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* 실시간 결과 */
.live-results {
  width: 100%;
  background: var(--card-bg);
  border-radius: 12px;
  padding: 15px;
}

.live-results h4 {
  margin-bottom: 10px;
  color: var(--text-secondary);
  text-align: center;
}

.result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 5px;
}

.result-item.mine {
  background: rgba(0, 184, 148, 0.2);
  border: 1px solid #00b894;
}

.result-item.disqualified {
  opacity: 0.6;
}

.result-item.missed {
  opacity: 0.6;
}

.result-item .rank {
  font-weight: bold;
  color: #ffd93d;
  width: 50px;
}

.result-item .name {
  flex: 1;
}

.result-item .time {
  color: #00b894;
  font-weight: bold;
}

.result-item.disqualified .time {
  color: #e74c3c;
}

.result-item.missed .time {
  color: #95a5a6;
}

/* 솔로 결과 화면 */
.solo-result-display {
  text-align: center;
  padding: 30px;
  background: linear-gradient(135deg, rgba(243, 156, 18, 0.2), rgba(231, 76, 60, 0.2));
  border: 2px solid #f39c12;
  border-radius: 16px;
}

.result-emoji {
  font-size: 3rem;
}

.result-title {
  font-size: 1.5rem;
  font-weight: bold;
  color: #f39c12;
  margin: 10px 0 20px;
}

.solo-stats {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  padding: 10px 15px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}

.stat-label {
  color: var(--text-secondary);
}

.stat-value {
  font-weight: bold;
  color: #00b894;
}

.stat-value.best {
  color: #ffd93d;
  font-size: 1.2rem;
}

.no-record {
  color: var(--text-secondary);
  padding: 20px;
}

.round-history {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 15px;
}

.round-history h4 {
  margin-bottom: 15px;
  text-align: center;
  color: var(--text-secondary);
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 5px;
}

.history-item.success {
  border-left: 3px solid #00b894;
}

.history-item.disqualified {
  border-left: 3px solid #e74c3c;
  opacity: 0.7;
}

.history-item.missed {
  border-left: 3px solid #95a5a6;
  opacity: 0.7;
}

.history-item .round {
  font-weight: bold;
}

.history-item .time {
  color: #00b894;
}

.history-item.disqualified .time {
  color: #e74c3c;
}

.history-item.missed .time {
  color: #95a5a6;
}

/* 멀티플레이어 결과 화면 */
.result-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.winner-display {
  text-align: center;
  padding: 30px;
  background: linear-gradient(135deg, rgba(255, 217, 61, 0.2), rgba(255, 165, 0, 0.2));
  border: 2px solid #ffd93d;
  border-radius: 16px;
}

.trophy {
  font-size: 3rem;
}

.winner-title {
  font-size: 1.2rem;
  color: var(--text-secondary);
  margin-top: 10px;
}

.winner-name {
  font-size: 2rem;
  font-weight: bold;
  color: #ffd93d;
  margin: 10px 0;
}

.winner-score {
  font-size: 1.5rem;
  color: #00b894;
}

.final-ranking {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 15px;
}

.final-ranking h4 {
  margin-bottom: 15px;
  text-align: center;
  color: var(--text-secondary);
}

.ranking-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 5px;
}

.ranking-item.mine {
  background: rgba(0, 184, 148, 0.2);
  border: 1px solid #00b894;
}

.ranking-item .rank {
  font-weight: bold;
  color: #ffd93d;
  width: 50px;
}

.ranking-item .name {
  flex: 1;
}

.ranking-item .score {
  color: #00b894;
  font-weight: bold;
}

.result-actions {
  display: flex;
  gap: 10px;
}

.result-actions .btn {
  flex: 1;
}
</style>
