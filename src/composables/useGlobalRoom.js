import { ref, computed, onUnmounted } from 'vue'
import { database, ref as dbRef, set, onValue, push, remove, onDisconnect, update, get, off } from '../firebase'

// 전역 상태 (싱글톤)
const roomCode = ref('')
const myPlayerId = ref('')
const myPlayerName = ref('')
const isHost = ref(false)
const players = ref([])
const roomState = ref('waiting') // waiting, ready, countdown, playing
const currentGame = ref(null)
const gameData = ref(null)
const countdown = ref(0)
const isInRoom = ref(false)

// Firebase 리스너 해제용
let unsubscribers = []

// 방 코드 생성
const generateRoomCode = () => {
  return Math.random().toString(36).substring(2, 6).toUpperCase()
}

// 방 생성
const createRoom = async (playerName) => {
  if (!playerName?.trim()) throw new Error('이름을 입력하세요')

  const code = generateRoomCode()
  const playerId = push(dbRef(database, 'temp')).key

  roomCode.value = code
  myPlayerId.value = playerId
  myPlayerName.value = playerName.trim()
  isHost.value = true

  // 방 생성
  const roomRef = dbRef(database, `globalRooms/${code}`)
  await set(roomRef, {
    meta: {
      code: code,
      host: playerId,
      createdAt: Date.now(),
      state: 'waiting'
    },
    currentGame: {
      type: null,
      state: null,
      data: null
    }
  })

  // 플레이어 추가
  const playerRef = dbRef(database, `globalRooms/${code}/players/${playerId}`)
  await set(playerRef, {
    name: playerName.trim(),
    isReady: false,
    isHost: true,
    joinedAt: Date.now()
  })

  // 연결 해제 시 정리
  onDisconnect(playerRef).remove()

  joinRoomListeners(code)
  isInRoom.value = true

  // 이름 저장
  localStorage.setItem('globalRoom_playerName', playerName.trim())

  return code
}

// 방 참가
const joinRoom = async (code, playerName) => {
  if (!playerName?.trim()) throw new Error('이름을 입력하세요')
  if (!code?.trim()) throw new Error('방 코드를 입력하세요')

  const upperCode = code.toUpperCase().trim()

  // 방 존재 확인
  const roomRef = dbRef(database, `globalRooms/${upperCode}`)
  const snapshot = await get(roomRef)

  if (!snapshot.exists()) {
    throw new Error('존재하지 않는 방입니다')
  }

  const roomData = snapshot.val()

  // 게임 진행 중이면 참가 불가
  if (roomData.meta?.state === 'playing') {
    throw new Error('게임이 진행 중입니다')
  }

  const playerId = push(dbRef(database, 'temp')).key

  roomCode.value = upperCode
  myPlayerId.value = playerId
  myPlayerName.value = playerName.trim()
  isHost.value = false

  // 플레이어 추가
  const playerRef = dbRef(database, `globalRooms/${upperCode}/players/${playerId}`)
  await set(playerRef, {
    name: playerName.trim(),
    isReady: false,
    isHost: false,
    joinedAt: Date.now()
  })

  onDisconnect(playerRef).remove()

  joinRoomListeners(upperCode)
  isInRoom.value = true

  // 이름 저장
  localStorage.setItem('globalRoom_playerName', playerName.trim())

  return upperCode
}

// 방 리스너 연결
const joinRoomListeners = (code) => {
  // 기존 리스너 해제
  cleanupListeners()

  // 플레이어 목록 리스너
  const playersRef = dbRef(database, `globalRooms/${code}/players`)
  const unsubPlayers = onValue(playersRef, (snapshot) => {
    const data = snapshot.val()
    if (data) {
      players.value = Object.entries(data).map(([id, player]) => ({
        id,
        ...player
      }))

      // 호스트 확인 (호스트가 나갔으면 다음 사람이 호스트)
      const hostExists = players.value.some(p => p.isHost)
      if (!hostExists && players.value.length > 0) {
        const newHost = players.value[0]
        if (newHost.id === myPlayerId.value) {
          isHost.value = true
          update(dbRef(database, `globalRooms/${code}/players/${myPlayerId.value}`), { isHost: true })
          update(dbRef(database, `globalRooms/${code}/meta`), { host: myPlayerId.value })
        }
      }
    } else {
      players.value = []
    }
  })
  unsubscribers.push(() => off(playersRef))

  // 방 메타 리스너
  const metaRef = dbRef(database, `globalRooms/${code}/meta`)
  const unsubMeta = onValue(metaRef, (snapshot) => {
    const data = snapshot.val()
    if (data) {
      roomState.value = data.state || 'waiting'

      // 호스트 변경 감지
      if (data.host === myPlayerId.value && !isHost.value) {
        isHost.value = true
      }
    }
  })
  unsubscribers.push(() => off(metaRef))

  // 게임 상태 리스너
  const gameRef = dbRef(database, `globalRooms/${code}/currentGame`)
  const unsubGame = onValue(gameRef, (snapshot) => {
    const data = snapshot.val()
    if (data) {
      currentGame.value = data.type
      gameData.value = data.data
    }
  })
  unsubscribers.push(() => off(gameRef))

  // 카운트다운 리스너
  const countdownRef = dbRef(database, `globalRooms/${code}/countdown`)
  const unsubCountdown = onValue(countdownRef, (snapshot) => {
    const data = snapshot.val()
    countdown.value = data || 0
  })
  unsubscribers.push(() => off(countdownRef))
}

// 준비 토글
const toggleReady = async () => {
  if (!roomCode.value || !myPlayerId.value) return

  const currentPlayer = players.value.find(p => p.id === myPlayerId.value)
  const newReady = !currentPlayer?.isReady

  await update(dbRef(database, `globalRooms/${roomCode.value}/players/${myPlayerId.value}`), {
    isReady: newReady
  })
}

// 게임 시작 (호스트만)
const startGame = async (gameType) => {
  if (!isHost.value || !roomCode.value) return

  // 모두 준비 확인
  const allReady = players.value.every(p => p.isHost || p.isReady)
  if (!allReady && players.value.length > 1) {
    throw new Error('모든 플레이어가 준비되지 않았습니다')
  }

  // 카운트다운 시작
  await update(dbRef(database, `globalRooms/${roomCode.value}/meta`), { state: 'countdown' })

  for (let i = 5; i >= 0; i--) {
    await set(dbRef(database, `globalRooms/${roomCode.value}/countdown`), i)
    if (i > 0) await sleep(1000)
  }

  // 게임 시작
  await update(dbRef(database, `globalRooms/${roomCode.value}`), {
    'meta/state': 'playing',
    'currentGame/type': gameType,
    'currentGame/state': 'starting',
    'currentGame/data': null,
    'countdown': 0
  })
}

// 게임 상태 업데이트
const updateGameState = async (state, data = null) => {
  if (!roomCode.value) return

  const updates = {
    [`globalRooms/${roomCode.value}/currentGame/state`]: state
  }

  if (data !== null) {
    updates[`globalRooms/${roomCode.value}/currentGame/data`] = data
  }

  await update(dbRef(database), updates)
}

// 게임 데이터 업데이트
const updateGameData = async (data) => {
  if (!roomCode.value) return
  await set(dbRef(database, `globalRooms/${roomCode.value}/currentGame/data`), data)
}

// 게임 종료 (대기실로)
const endGame = async () => {
  if (!roomCode.value) return

  // 준비 상태 초기화
  for (const player of players.value) {
    await update(dbRef(database, `globalRooms/${roomCode.value}/players/${player.id}`), {
      isReady: player.isHost
    })
  }

  await update(dbRef(database, `globalRooms/${roomCode.value}`), {
    'meta/state': 'waiting',
    'currentGame/type': null,
    'currentGame/state': null,
    'currentGame/data': null
  })
}

// 방 나가기
const leaveRoom = async () => {
  cleanupListeners()

  if (myPlayerId.value && roomCode.value) {
    await remove(dbRef(database, `globalRooms/${roomCode.value}/players/${myPlayerId.value}`))

    // 혼자 있었으면 방 삭제
    if (players.value.length <= 1) {
      await remove(dbRef(database, `globalRooms/${roomCode.value}`))
    }
  }

  resetState()
}

// 리스너 정리
const cleanupListeners = () => {
  unsubscribers.forEach(unsub => {
    try { unsub() } catch (e) {}
  })
  unsubscribers = []
}

// 상태 초기화
const resetState = () => {
  roomCode.value = ''
  myPlayerId.value = ''
  isHost.value = false
  players.value = []
  roomState.value = 'waiting'
  currentGame.value = null
  gameData.value = null
  countdown.value = 0
  isInRoom.value = false
}

// 유틸
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Computed
const allPlayersReady = computed(() => {
  if (players.value.length === 0) return false
  return players.value.every(p => p.isHost || p.isReady)
})

const myPlayer = computed(() => {
  return players.value.find(p => p.id === myPlayerId.value)
})

const otherPlayers = computed(() => {
  return players.value.filter(p => p.id !== myPlayerId.value)
})

// 저장된 이름 불러오기
const loadSavedName = () => {
  return localStorage.getItem('globalRoom_playerName') || ''
}

export function useGlobalRoom() {
  onUnmounted(() => {
    // 컴포넌트 언마운트 시에는 리스너만 정리하고 방은 유지
    // (앱을 완전히 닫을 때만 자동으로 나감)
  })

  return {
    // 상태
    roomCode,
    myPlayerId,
    myPlayerName,
    isHost,
    players,
    roomState,
    currentGame,
    gameData,
    countdown,
    isInRoom,

    // Computed
    allPlayersReady,
    myPlayer,
    otherPlayers,

    // 메서드
    createRoom,
    joinRoom,
    toggleReady,
    startGame,
    updateGameState,
    updateGameData,
    endGame,
    leaveRoom,
    loadSavedName,

    // Firebase 직접 접근용
    getRoomRef: () => roomCode.value ? dbRef(database, `globalRooms/${roomCode.value}`) : null,
    getGameDataRef: () => roomCode.value ? dbRef(database, `globalRooms/${roomCode.value}/currentGame/data`) : null
  }
}
