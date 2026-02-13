import { ref, computed, onUnmounted } from 'vue'
import { database, ref as dbRef, set, onValue, update, off } from '../firebase'

// 차량 정의
export const CARS = [
  {
    id: 'sports',
    name: '스포츠카',
    emoji: '🏎️',
    color: '#e74c3c',
    speed: 10,
    handling: 8,
    acceleration: 9,
    description: '빠르고 민첩한 차량'
  },
  {
    id: 'muscle',
    name: '머슬카',
    emoji: '🚗',
    color: '#f39c12',
    speed: 9,
    handling: 6,
    acceleration: 10,
    description: '강력한 가속력'
  },
  {
    id: 'compact',
    name: '경차',
    emoji: '🚙',
    color: '#3498db',
    speed: 7,
    handling: 10,
    acceleration: 7,
    description: '뛰어난 핸들링'
  },
  {
    id: 'truck',
    name: '트럭',
    emoji: '🛻',
    color: '#2ecc71',
    speed: 6,
    handling: 5,
    acceleration: 6,
    description: '튼튼하고 안정적'
  },
  {
    id: 'bike',
    name: '바이크',
    emoji: '🏍️',
    color: '#9b59b6',
    speed: 11,
    handling: 7,
    acceleration: 8,
    description: '최고 속도'
  },
  {
    id: 'bus',
    name: '버스',
    emoji: '🚌',
    color: '#1abc9c',
    speed: 5,
    handling: 4,
    acceleration: 5,
    description: '느리지만 강력한 밀어내기'
  }
]

// 아이템 정의
export const ITEMS = [
  {
    id: 'boost',
    name: '부스터',
    emoji: '🚀',
    effect: 'speed',
    duration: 2000,
    description: '일시적으로 속도 2배'
  },
  {
    id: 'banana',
    name: '바나나',
    emoji: '🍌',
    effect: 'trap',
    description: '뒤에 설치, 밟으면 스핀'
  },
  {
    id: 'missile',
    name: '미사일',
    emoji: '🚀',
    effect: 'attack',
    description: '앞 차량 공격'
  },
  {
    id: 'shield',
    name: '쉴드',
    emoji: '🛡️',
    effect: 'defense',
    duration: 5000,
    description: '공격 방어'
  }
]

// 트랙 정의 (좌표 기반)
export const TRACK = {
  width: 800,
  height: 600,
  laps: 3,
  checkpoints: [
    { x: 700, y: 300 },
    { x: 400, y: 500 },
    { x: 100, y: 300 },
    { x: 400, y: 100 }
  ],
  startLine: { x: 400, y: 300 },
  // 트랙 경로 (베지어 커브 근사)
  path: [
    { x: 400, y: 300 },
    { x: 600, y: 300 },
    { x: 700, y: 400 },
    { x: 600, y: 500 },
    { x: 400, y: 550 },
    { x: 200, y: 500 },
    { x: 100, y: 400 },
    { x: 100, y: 200 },
    { x: 200, y: 100 },
    { x: 400, y: 100 },
    { x: 600, y: 100 },
    { x: 700, y: 200 },
    { x: 700, y: 300 },
    { x: 400, y: 300 }
  ]
}

export function useRacing(roomCode) {
  // 게임 상태
  const gamePhase = ref('lobby') // lobby, carSelect, countdown, racing, result
  const players = ref([])
  const spectators = ref([])
  const racers = ref([])
  const myRole = ref('spectator') // racer, spectator
  const myTeam = ref(null)

  // 레이싱 상태
  const raceData = ref({
    positions: {},
    items: [],
    traps: [],
    finishOrder: []
  })

  const countdown = ref(0)
  const raceTime = ref(0)

  // 내 차량 상태
  const myCar = ref(null)
  const myPosition = ref({ x: 400, y: 350, angle: 0 })
  const myLap = ref(0)
  const myCheckpoint = ref(0)
  const mySpeed = ref(0)
  const myItem = ref(null)
  const effects = ref({
    boost: false,
    shield: false,
    spin: false
  })

  // 조작 상태
  const controls = ref({
    left: false,
    right: false,
    accelerate: false
  })

  // 채팅 (관전자용)
  const chatMessages = ref([])

  // Firebase 리스너 해제용
  let unsubscribers = []
  let gameLoop = null
  let raceTimer = null

  // 게임 초기화
  const initGame = async (playerId, playerName, isHost) => {
    if (!roomCode) return

    const gameDataRef = dbRef(database, `globalRooms/${roomCode}/currentGame/data`)

    // 초기 데이터 설정 (호스트만)
    if (isHost) {
      await set(gameDataRef, {
        phase: 'carSelect',
        players: {},
        spectators: {},
        countdown: 0,
        raceData: {
          positions: {},
          items: [],
          traps: [],
          finishOrder: []
        },
        chat: []
      })
    }

    // 리스너 설정
    setupListeners(playerId, playerName)
  }

  // 리스너 설정
  const setupListeners = (playerId, playerName) => {
    const gameDataRef = dbRef(database, `globalRooms/${roomCode}/currentGame/data`)

    const unsubGame = onValue(gameDataRef, (snapshot) => {
      const data = snapshot.val()
      if (!data) return

      gamePhase.value = data.phase || 'lobby'
      countdown.value = data.countdown || 0

      // 플레이어 목록
      if (data.players) {
        players.value = Object.entries(data.players).map(([id, p]) => ({
          id, ...p
        }))
        racers.value = players.value.filter(p => p.role === 'racer')

        const me = players.value.find(p => p.id === playerId)
        if (me) {
          myRole.value = me.role || 'spectator'
          myCar.value = me.car
          myTeam.value = me.team
        }
      }

      // 관전자 목록
      if (data.spectators) {
        spectators.value = Object.entries(data.spectators).map(([id, s]) => ({
          id, ...s
        }))
      }

      // 레이스 데이터
      if (data.raceData) {
        raceData.value = data.raceData

        // 다른 플레이어 위치 업데이트
        if (data.raceData.positions) {
          players.value.forEach(p => {
            if (p.id !== playerId && data.raceData.positions[p.id]) {
              p.position = data.raceData.positions[p.id]
            }
          })
        }
      }

      // 채팅
      if (data.chat) {
        chatMessages.value = Object.values(data.chat).slice(-50)
      }
    })

    unsubscribers.push(() => off(gameDataRef))
  }

  // 차량 선택
  const selectCar = async (playerId, carId) => {
    await update(dbRef(database, `globalRooms/${roomCode}/currentGame/data/players/${playerId}`), {
      car: carId,
      role: 'racer'
    })
  }

  // 관전자로 참가
  const joinAsSpectator = async (playerId, playerName, team) => {
    await set(dbRef(database, `globalRooms/${roomCode}/currentGame/data/spectators/${playerId}`), {
      name: playerName,
      team: team
    })
  }

  // 레이스 시작 (호스트만)
  const startRace = async () => {
    // 카운트다운
    await update(dbRef(database, `globalRooms/${roomCode}/currentGame/data`), {
      phase: 'countdown'
    })

    for (let i = 3; i >= 0; i--) {
      await set(dbRef(database, `globalRooms/${roomCode}/currentGame/data/countdown`), i)
      if (i > 0) await sleep(1000)
    }

    // 초기 위치 설정
    const startPositions = {}
    racers.value.forEach((racer, index) => {
      startPositions[racer.id] = {
        x: 400 + (index % 2) * 60 - 30,
        y: 350 + Math.floor(index / 2) * 50,
        angle: -90,
        lap: 0,
        checkpoint: 0,
        speed: 0,
        finished: false
      }
    })

    await update(dbRef(database, `globalRooms/${roomCode}/currentGame/data`), {
      phase: 'racing',
      'raceData/positions': startPositions,
      'raceData/startTime': Date.now()
    })

    // 게임 루프 시작
    startGameLoop()
  }

  // 게임 루프
  const startGameLoop = () => {
    if (gameLoop) clearInterval(gameLoop)

    const startTime = Date.now()

    gameLoop = setInterval(() => {
      if (gamePhase.value !== 'racing') {
        clearInterval(gameLoop)
        return
      }

      raceTime.value = Date.now() - startTime

      // 내 차량 업데이트
      updateMyPosition()

    }, 1000 / 60) // 60fps
  }

  // 내 위치 업데이트
  const updateMyPosition = async () => {
    if (myRole.value !== 'racer' || !myCar.value) return

    const car = CARS.find(c => c.id === myCar.value)
    if (!car) return

    const baseSpeed = car.speed * 0.5
    const handling = car.handling * 0.3
    const acceleration = car.acceleration * 0.1

    // 부스트 효과
    const speedMultiplier = effects.value.boost ? 2 : 1

    // 스핀 상태면 조작 불가
    if (effects.value.spin) {
      myPosition.value.angle += 30
      return
    }

    // 조작 처리
    if (controls.value.left) {
      myPosition.value.angle -= handling
    }
    if (controls.value.right) {
      myPosition.value.angle += handling
    }
    if (controls.value.accelerate) {
      mySpeed.value = Math.min(mySpeed.value + acceleration, baseSpeed * speedMultiplier)
    } else {
      mySpeed.value = Math.max(mySpeed.value - acceleration * 0.5, 0)
    }

    // 위치 업데이트
    const rad = myPosition.value.angle * Math.PI / 180
    myPosition.value.x += Math.cos(rad) * mySpeed.value
    myPosition.value.y += Math.sin(rad) * mySpeed.value

    // 트랙 경계 체크
    myPosition.value.x = Math.max(50, Math.min(750, myPosition.value.x))
    myPosition.value.y = Math.max(50, Math.min(550, myPosition.value.y))

    // 체크포인트 체크
    checkCheckpoint()

    // Firebase에 위치 업데이트 (throttled)
    throttledPositionUpdate()
  }

  let lastPositionUpdate = 0
  const throttledPositionUpdate = async () => {
    const now = Date.now()
    if (now - lastPositionUpdate < 100) return // 100ms throttle
    lastPositionUpdate = now

    // 실제 playerId는 외부에서 전달받아야 함
  }

  // 위치 업데이트 (외부에서 호출)
  const syncPosition = async (playerId) => {
    await update(dbRef(database, `globalRooms/${roomCode}/currentGame/data/raceData/positions/${playerId}`), {
      x: myPosition.value.x,
      y: myPosition.value.y,
      angle: myPosition.value.angle,
      lap: myLap.value,
      checkpoint: myCheckpoint.value,
      speed: mySpeed.value
    })
  }

  // 체크포인트 체크
  const checkCheckpoint = () => {
    const checkpoints = TRACK.checkpoints
    const current = checkpoints[myCheckpoint.value % checkpoints.length]

    const dist = Math.hypot(myPosition.value.x - current.x, myPosition.value.y - current.y)

    if (dist < 50) {
      myCheckpoint.value++

      // 한 바퀴 완주 체크
      if (myCheckpoint.value >= checkpoints.length) {
        myCheckpoint.value = 0
        myLap.value++

        // 완주 체크
        if (myLap.value >= TRACK.laps) {
          finishRace()
        }
      }
    }
  }

  // 완주
  const finishRace = async (playerId) => {
    await update(dbRef(database, `globalRooms/${roomCode}/currentGame/data/raceData/positions/${playerId}`), {
      finished: true,
      finishTime: raceTime.value
    })

    // 완주 순서에 추가
    const currentOrder = raceData.value.finishOrder || []
    if (!currentOrder.includes(playerId)) {
      currentOrder.push(playerId)
      await set(dbRef(database, `globalRooms/${roomCode}/currentGame/data/raceData/finishOrder`), currentOrder)
    }
  }

  // 아이템 사용
  const useItem = async (playerId) => {
    if (!myItem.value) return

    const item = ITEMS.find(i => i.id === myItem.value)
    if (!item) return

    switch (item.effect) {
      case 'speed':
        effects.value.boost = true
        setTimeout(() => effects.value.boost = false, item.duration)
        break
      case 'trap':
        // 바나나 설치
        const traps = raceData.value.traps || []
        traps.push({
          type: 'banana',
          x: myPosition.value.x,
          y: myPosition.value.y,
          placedBy: playerId
        })
        await set(dbRef(database, `globalRooms/${roomCode}/currentGame/data/raceData/traps`), traps)
        break
      case 'defense':
        effects.value.shield = true
        setTimeout(() => effects.value.shield = false, item.duration)
        break
      case 'attack':
        // 미사일 발사 (앞 차량 공격)
        break
    }

    myItem.value = null
  }

  // 아이템 획득
  const pickupItem = () => {
    if (myItem.value) return // 이미 아이템 있음

    const randomItem = ITEMS[Math.floor(Math.random() * ITEMS.length)]
    myItem.value = randomItem.id
  }

  // 채팅 전송 (관전자)
  const sendChat = async (playerId, playerName, message) => {
    if (myRole.value !== 'spectator') return

    const chatRef = dbRef(database, `globalRooms/${roomCode}/currentGame/data/chat`)
    const newChatRef = dbRef(database, `globalRooms/${roomCode}/currentGame/data/chat/${Date.now()}`)
    await set(newChatRef, {
      playerId,
      playerName,
      message,
      team: myTeam.value,
      timestamp: Date.now()
    })
  }

  // 결과 화면으로 전환 (호스트)
  const showResults = async () => {
    await update(dbRef(database, `globalRooms/${roomCode}/currentGame/data`), {
      phase: 'result'
    })
  }

  // 조작 키 설정
  const setControl = (key, value) => {
    controls.value[key] = value
  }

  // 정리
  const cleanup = () => {
    if (gameLoop) clearInterval(gameLoop)
    if (raceTimer) clearInterval(raceTimer)
    unsubscribers.forEach(unsub => {
      try { unsub() } catch(e) {}
    })
    unsubscribers = []
  }

  onUnmounted(cleanup)

  // 유틸
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

  // Computed
  const sortedRacers = computed(() => {
    return [...racers.value].sort((a, b) => {
      const posA = raceData.value.positions?.[a.id]
      const posB = raceData.value.positions?.[b.id]

      if (!posA || !posB) return 0

      // 완주한 사람이 앞
      if (posA.finished && !posB.finished) return -1
      if (!posA.finished && posB.finished) return 1

      // 랩 수 비교
      if (posA.lap !== posB.lap) return posB.lap - posA.lap

      // 체크포인트 비교
      return posB.checkpoint - posA.checkpoint
    })
  })

  const finishedRacers = computed(() => {
    return (raceData.value.finishOrder || []).map(id => {
      const racer = racers.value.find(r => r.id === id)
      const pos = raceData.value.positions?.[id]
      return {
        ...racer,
        finishTime: pos?.finishTime
      }
    })
  })

  return {
    // 상태
    gamePhase,
    players,
    spectators,
    racers,
    myRole,
    myTeam,
    myCar,
    myPosition,
    myLap,
    myCheckpoint,
    mySpeed,
    myItem,
    effects,
    controls,
    countdown,
    raceTime,
    raceData,
    chatMessages,

    // Computed
    sortedRacers,
    finishedRacers,

    // 메서드
    initGame,
    selectCar,
    joinAsSpectator,
    startRace,
    syncPosition,
    useItem,
    pickupItem,
    sendChat,
    showResults,
    setControl,
    cleanup,

    // 상수
    CARS,
    ITEMS,
    TRACK
  }
}
