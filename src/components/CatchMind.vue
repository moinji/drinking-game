<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { database, ref as dbRef, set, onValue, push, remove, onDisconnect } from '../firebase'

// 제시어 목록
const words = [
  // 동물
  '고양이', '강아지', '토끼', '햄스터', '앵무새', '금붕어', '거북이', '펭귄',
  '코끼리', '기린', '사자', '호랑이', '원숭이', '판다', '북극곰', '캥거루',
  '돌고래', '상어', '문어', '해파리', '공룡', '유니콘', '드래곤',
  // 음식
  '피자', '햄버거', '치킨', '떡볶이', '김밥', '라면', '짜장면', '짬뽕',
  '초밥', '돈까스', '삼겹살', '비빔밥', '불고기', '만두', '타코', '파스타',
  '아이스크림', '케이크', '도넛', '마카롱', '붕어빵', '호떡', '솜사탕',
  '수박', '딸기', '바나나', '포도', '복숭아', '망고', '아보카도',
  // 사물
  '스마트폰', '노트북', '에어팟', '선풍기', '에어컨', '냉장고', '전자레인지',
  '변기', '샤워기', '칫솔', '거울', '가위', '우산', '지갑', '열쇠',
  '안경', '마스크', '모자', '넥타이', '하이힐', '슬리퍼', '백팩',
  // 장소/건물
  '에펠탑', '자유의여신상', '피라미드', '만리장성', '경복궁', 'PC방', '노래방',
  '놀이공원', '수영장', '헬스장', '편의점', '화장실', '엘리베이터',
  // 행동/상황
  '셀카찍기', '하품하기', '윙크하기', '점프하기', '수영하기', '스키타기',
  '자전거타기', '춤추기', '노래하기', '요리하기', '청소하기', '빨래하기',
  '짜증나는얼굴', '방귀뀌기', '딸꾹질', '코골기', '졸기',
  // 캐릭터/유명인
  '피카츄', '스폰지밥', '뽀로로', '도라에몽', '짱구', '아이언맨', '스파이더맨',
  '엘사', '미니언즈', '헬로키티', '라이언', '손흥민', '아이유', 'BTS',
  // 이모티콘/표현
  '하트', '별', '무지개', '똥', '유령', '외계인', '해골', '천사', '악마',
  // 기타 재미있는 것들
  '와이파이', '배터리부족', '블루스크린', '로딩중', '버퍼링',
  '월요병', '금요일밤', '알람소리', '지각', '야근',
  '소개팅', '썸타기', '읽씹', '카톡폭탄', '프사',
  '치맥', '소맥', '숙취', '해장국', '라면먹방',
  // 신조어/줄임말
  '밤티', '샤갈', '점메추', '저메추', '갓생', '꾸안꾸',
  '스불재', '억텐', '오저치고', '카공', '집콕', '좋댓구알',
  '갈비', '별다줄', '반모', '존맛탱', '레게노', '킹받네',
  '쩔어', '개이득', '뇌절', '오히려좋아', '어쩔티비', '저쩔냉장고',
  '무야호', '삼귀다', '가보자고', '실화냐', '인정', 'ㅇㅈ',
  '플렉스', '내또출', '퇴사각', '불금', '월급루팡', '야자타임',
  '혼밥', '혼술', '혼코노', 'MBTI', '손민수', '갈고리손',
  '점심시간', '퇴근', '칼퇴', '야근러', '재택근무', '줌미팅'
]

// 사용된 제시어 추적
const usedWords = ref([])

// 상태
const gameState = ref('lobby') // lobby, waiting, playing, result
const roomCode = ref('')
const playerName = ref('')
const isHost = ref(false)
const players = ref([])
const currentDrawer = ref(null)
const currentWord = ref('')
const myPlayerId = ref('')
const messages = ref([])
const chatInput = ref('')
const timeLeft = ref(60)
const roundNumber = ref(0)
const maxRounds = ref(3)
const scores = ref({})
const winner = ref(null)
const isCorrect = ref(false)

// 캔버스 관련
const canvasRef = ref(null)
const ctx = ref(null)
const isDrawing = ref(false)
const lastX = ref(0)
const lastY = ref(0)
const brushColor = ref('#000000')
const brushSize = ref(5)
const drawingData = ref([])

// Firebase 리스너 해제용
let unsubscribers = []

// 방 코드 생성
const generateRoomCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

// 방 생성
const createRoom = async () => {
  if (!playerName.value.trim()) return alert('이름을 입력하세요')

  roomCode.value = generateRoomCode()
  myPlayerId.value = push(dbRef(database, 'temp')).key
  isHost.value = true

  const roomRef = dbRef(database, `rooms/${roomCode.value}`)
  await set(roomRef, {
    host: myPlayerId.value,
    state: 'waiting',
    currentDrawer: null,
    currentWord: '',
    round: 0,
    maxRounds: 3,
    timeLeft: 60,
    drawing: []
  })

  // 플레이어 추가
  const playerRef = dbRef(database, `rooms/${roomCode.value}/players/${myPlayerId.value}`)
  await set(playerRef, {
    name: playerName.value.trim(),
    score: 0,
    isHost: true
  })

  // 연결 해제 시 정리
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

  // 방 존재 확인
  const roomRef = dbRef(database, `rooms/${roomCode.value}`)
  onValue(roomRef, (snapshot) => {
    if (!snapshot.exists()) {
      alert('존재하지 않는 방입니다')
      return
    }
  }, { onlyOnce: true })

  // 플레이어 추가
  const playerRef = dbRef(database, `rooms/${roomCode.value}/players/${myPlayerId.value}`)
  await set(playerRef, {
    name: playerName.value.trim(),
    score: 0,
    isHost: false
  })

  onDisconnect(playerRef).remove()

  joinRoomListeners()
  gameState.value = 'waiting'
}

// 방 리스너 연결
const joinRoomListeners = () => {
  // 플레이어 목록 리스너
  const playersRef = dbRef(database, `rooms/${roomCode.value}/players`)
  const unsubPlayers = onValue(playersRef, (snapshot) => {
    const data = snapshot.val()
    if (data) {
      players.value = Object.entries(data).map(([id, player]) => ({
        id,
        ...player
      }))
      // 점수 업데이트
      players.value.forEach(p => {
        scores.value[p.id] = p.score
      })
    }
  })
  unsubscribers.push(() => unsubPlayers())

  // 방 상태 리스너
  const roomRef = dbRef(database, `rooms/${roomCode.value}`)
  const unsubRoom = onValue(roomRef, (snapshot) => {
    const data = snapshot.val()
    if (data) {
      if (data.state === 'playing' && gameState.value !== 'playing') {
        gameState.value = 'playing'
        nextTick(() => initCanvas())
      } else if (data.state === 'result') {
        gameState.value = 'result'
        winner.value = data.winner
      }
      currentDrawer.value = data.currentDrawer
      currentWord.value = data.currentWord
      roundNumber.value = data.round || 0
      timeLeft.value = data.timeLeft ?? 60
      maxRounds.value = data.maxRounds || 3
    }
  })
  unsubscribers.push(() => unsubRoom())

  // 그리기 데이터 리스너
  const drawingRef = dbRef(database, `rooms/${roomCode.value}/drawing`)
  const unsubDrawing = onValue(drawingRef, (snapshot) => {
    const data = snapshot.val()
    if (ctx.value) {
      redrawCanvas(data || []) // 빈 배열이면 캔버스 초기화
    }
  })
  unsubscribers.push(() => unsubDrawing())

  // 채팅 리스너
  const chatRef = dbRef(database, `rooms/${roomCode.value}/chat`)
  const unsubChat = onValue(chatRef, (snapshot) => {
    const data = snapshot.val()
    if (data) {
      messages.value = Object.values(data).slice(-50) // 최근 50개만
    }
  })
  unsubscribers.push(() => unsubChat())

  // 정답 맞춤 리스너
  const answerRef = dbRef(database, `rooms/${roomCode.value}/answerCorrect`)
  const unsubAnswer = onValue(answerRef, (snapshot) => {
    const correct = snapshot.val()
    if (correct) {
      // 타이머 멈추기
      if (timerInterval) {
        clearInterval(timerInterval)
        timerInterval = null
      }
      isCorrect.value = true

      // 호스트만 다음 라운드 처리
      if (isHost.value) {
        setTimeout(() => nextRound(), 3000)
      }
    } else {
      // 다음 라운드 시작 시 모든 클라이언트의 isCorrect 리셋
      isCorrect.value = false
    }
  })
  unsubscribers.push(() => unsubAnswer())
}

// 중복 없이 제시어 선택
const getRandomWord = () => {
  const availableWords = words.filter(w => !usedWords.value.includes(w))
  // 모든 단어를 다 썼으면 초기화
  if (availableWords.length === 0) {
    usedWords.value = []
    return words[Math.floor(Math.random() * words.length)]
  }
  const word = availableWords[Math.floor(Math.random() * availableWords.length)]
  usedWords.value.push(word)
  return word
}

// 라운드 수 변경 (호스트만)
const changeMaxRounds = async (rounds) => {
  if (!isHost.value) return
  maxRounds.value = rounds
  await set(dbRef(database, `rooms/${roomCode.value}/maxRounds`), rounds)
}

// 게임 시작 (호스트만)
const startGame = async () => {
  if (!isHost.value || players.value.length < 2) return

  usedWords.value = [] // 사용된 단어 초기화
  const firstDrawer = players.value[0].id
  const word = getRandomWord()

  await set(dbRef(database, `rooms/${roomCode.value}/state`), 'playing')
  await set(dbRef(database, `rooms/${roomCode.value}/currentDrawer`), firstDrawer)
  await set(dbRef(database, `rooms/${roomCode.value}/currentWord`), word)
  await set(dbRef(database, `rooms/${roomCode.value}/round`), 1)
  await set(dbRef(database, `rooms/${roomCode.value}/timeLeft`), 60)
  await set(dbRef(database, `rooms/${roomCode.value}/drawing`), [])
  await set(dbRef(database, `rooms/${roomCode.value}/answerCorrect`), false)

  startTimer()
}

// 타이머
let timerInterval = null
const startTimer = () => {
  if (timerInterval) clearInterval(timerInterval)

  timerInterval = setInterval(async () => {
    if (timeLeft.value > 0) {
      timeLeft.value--
      if (isHost.value) {
        await set(dbRef(database, `rooms/${roomCode.value}/timeLeft`), timeLeft.value)
      }
    } else {
      clearInterval(timerInterval)
      if (isHost.value) {
        nextRound()
      }
    }
  }, 1000)
}

// 다음 라운드
const nextRound = async () => {
  const currentDrawerIndex = players.value.findIndex(p => p.id === currentDrawer.value)
  const nextDrawerIndex = (currentDrawerIndex + 1) % players.value.length
  const nextDrawer = players.value[nextDrawerIndex].id

  const newRound = currentDrawerIndex === players.value.length - 1 ? roundNumber.value + 1 : roundNumber.value

  if (newRound > maxRounds.value) {
    // 게임 종료
    const sortedPlayers = [...players.value].sort((a, b) => (scores.value[b.id] || 0) - (scores.value[a.id] || 0))
    await set(dbRef(database, `rooms/${roomCode.value}/state`), 'result')
    await set(dbRef(database, `rooms/${roomCode.value}/winner`), sortedPlayers[0])
    return
  }

  const word = getRandomWord()

  await set(dbRef(database, `rooms/${roomCode.value}/currentDrawer`), nextDrawer)
  await set(dbRef(database, `rooms/${roomCode.value}/currentWord`), word)
  await set(dbRef(database, `rooms/${roomCode.value}/round`), newRound)
  await set(dbRef(database, `rooms/${roomCode.value}/timeLeft`), 60)
  await set(dbRef(database, `rooms/${roomCode.value}/drawing`), [])
  await set(dbRef(database, `rooms/${roomCode.value}/answerCorrect`), false)

  isCorrect.value = false
  // 캔버스 초기화
  nextTick(() => clearCanvas())
  startTimer()
}

// 캔버스 초기화
const initCanvas = () => {
  if (!canvasRef.value) return
  ctx.value = canvasRef.value.getContext('2d')
  ctx.value.lineCap = 'round'
  ctx.value.lineJoin = 'round'
  clearCanvas()
}

// 캔버스 그리기
const startDrawing = (e) => {
  if (currentDrawer.value !== myPlayerId.value) return
  isDrawing.value = true
  const rect = canvasRef.value.getBoundingClientRect()
  const x = (e.clientX || e.touches[0].clientX) - rect.left
  const y = (e.clientY || e.touches[0].clientY) - rect.top
  lastX.value = x
  lastY.value = y
}

const draw = async (e) => {
  if (!isDrawing.value || currentDrawer.value !== myPlayerId.value) return
  e.preventDefault()

  const rect = canvasRef.value.getBoundingClientRect()
  const x = (e.clientX || e.touches[0].clientX) - rect.left
  const y = (e.clientY || e.touches[0].clientY) - rect.top

  // 로컬 그리기
  ctx.value.strokeStyle = brushColor.value
  ctx.value.lineWidth = brushSize.value
  ctx.value.beginPath()
  ctx.value.moveTo(lastX.value, lastY.value)
  ctx.value.lineTo(x, y)
  ctx.value.stroke()

  // Firebase에 저장
  const drawRef = dbRef(database, `rooms/${roomCode.value}/drawing`)
  onValue(drawRef, async (snapshot) => {
    const data = snapshot.val() || []
    data.push({
      x1: lastX.value,
      y1: lastY.value,
      x2: x,
      y2: y,
      color: brushColor.value,
      size: brushSize.value
    })
    await set(drawRef, data)
  }, { onlyOnce: true })

  lastX.value = x
  lastY.value = y
}

const stopDrawing = () => {
  isDrawing.value = false
}

// 캔버스 다시 그리기
const redrawCanvas = (data) => {
  if (!ctx.value) return
  ctx.value.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
  ctx.value.fillStyle = '#ffffff'
  ctx.value.fillRect(0, 0, canvasRef.value.width, canvasRef.value.height)

  if (!data || !Array.isArray(data)) return

  data.forEach(line => {
    ctx.value.strokeStyle = line.color
    ctx.value.lineWidth = line.size
    ctx.value.beginPath()
    ctx.value.moveTo(line.x1, line.y1)
    ctx.value.lineTo(line.x2, line.y2)
    ctx.value.stroke()
  })
}

// 캔버스 지우기
const clearCanvas = async () => {
  if (!ctx.value) return
  ctx.value.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
  ctx.value.fillStyle = '#ffffff'
  ctx.value.fillRect(0, 0, canvasRef.value.width, canvasRef.value.height)

  if (currentDrawer.value === myPlayerId.value) {
    await set(dbRef(database, `rooms/${roomCode.value}/drawing`), [])
  }
}

// 채팅 보내기 (정답 체크)
const sendChat = async () => {
  if (!chatInput.value.trim()) return

  const message = chatInput.value.trim()
  chatInput.value = ''

  // 정답 체크
  if (message === currentWord.value && currentDrawer.value !== myPlayerId.value && !isCorrect.value) {
    isCorrect.value = true

    // 타이머 멈추기
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }

    // 점수 추가
    const playerRef = dbRef(database, `rooms/${roomCode.value}/players/${myPlayerId.value}/score`)
    onValue(playerRef, async (snapshot) => {
      const currentScore = snapshot.val() || 0
      await set(playerRef, currentScore + 10)
    }, { onlyOnce: true })

    // 출제자도 점수
    const drawerRef = dbRef(database, `rooms/${roomCode.value}/players/${currentDrawer.value}/score`)
    onValue(drawerRef, async (snapshot) => {
      const currentScore = snapshot.val() || 0
      await set(drawerRef, currentScore + 5)
    }, { onlyOnce: true })

    // 정답 메시지
    const chatRef = push(dbRef(database, `rooms/${roomCode.value}/chat`))
    await set(chatRef, {
      player: '시스템',
      message: `${playerName.value}님이 정답을 맞췄습니다! (${currentWord.value})`,
      isSystem: true,
      timestamp: Date.now()
    })

    // 정답 맞춤 상태를 Firebase에 저장 (모든 클라이언트에 알림)
    await set(dbRef(database, `rooms/${roomCode.value}/answerCorrect`), true)

    return
  }

  // 일반 채팅
  const chatRef = push(dbRef(database, `rooms/${roomCode.value}/chat`))
  await set(chatRef, {
    player: playerName.value,
    message: message,
    isSystem: false,
    timestamp: Date.now()
  })
}

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

// 방 나가기
const leaveRoom = async () => {
  if (timerInterval) clearInterval(timerInterval)
  unsubscribers.forEach(unsub => unsub())

  if (myPlayerId.value && roomCode.value) {
    await remove(dbRef(database, `rooms/${roomCode.value}/players/${myPlayerId.value}`))
  }

  gameState.value = 'lobby'
  roomCode.value = ''
  players.value = []
  messages.value = []
  isHost.value = false
}

// 다시 하기
const playAgain = async () => {
  if (!isHost.value) return

  // 점수 초기화
  for (const player of players.value) {
    await set(dbRef(database, `rooms/${roomCode.value}/players/${player.id}/score`), 0)
  }

  await set(dbRef(database, `rooms/${roomCode.value}/state`), 'waiting')
  await set(dbRef(database, `rooms/${roomCode.value}/round`), 0)
  await set(dbRef(database, `rooms/${roomCode.value}/winner`), null)

  gameState.value = 'waiting'
}

onMounted(() => {
  // 저장된 이름 불러오기
  const savedName = localStorage.getItem('catchmind_name')
  if (savedName) playerName.value = savedName
})

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
  unsubscribers.forEach(unsub => unsub())
})

// 이름 저장
watch(playerName, (name) => {
  if (name) localStorage.setItem('catchmind_name', name)
})
</script>

<template>
  <div class="game-container catchmind">
    <h2 class="game-title">CatchMind</h2>

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

    <!-- 대기실 -->
    <div v-if="gameState === 'waiting'" class="waiting-section">
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
      <div class="game-header">
        <div class="round-info">라운드 {{ roundNumber }}/{{ maxRounds }}</div>
        <div class="timer" :class="{ warning: timeLeft <= 10 }">{{ timeLeft }}초</div>
      </div>

      <div class="word-display">
        <span v-if="currentDrawer === myPlayerId" class="current-word">
          제시어: <strong>{{ currentWord }}</strong>
        </span>
        <span v-else class="word-hint">
          글자 수: {{ currentWord.length }}자
        </span>
      </div>

      <div class="drawer-info">
        {{ players.find(p => p.id === currentDrawer)?.name }}님이 그리는 중
        <span v-if="currentDrawer === myPlayerId">(나)</span>
      </div>

      <!-- 캔버스 -->
      <div class="canvas-wrapper">
        <canvas
          ref="canvasRef"
          width="320"
          height="320"
          @mousedown="startDrawing"
          @mousemove="draw"
          @mouseup="stopDrawing"
          @mouseleave="stopDrawing"
          @touchstart="startDrawing"
          @touchmove="draw"
          @touchend="stopDrawing"
          :class="{ 'can-draw': currentDrawer === myPlayerId }"
        ></canvas>
      </div>

      <!-- 그리기 도구 (출제자만) -->
      <div v-if="currentDrawer === myPlayerId" class="draw-tools">
        <div class="color-picker">
          <input type="color" v-model="brushColor" />
          <button
            v-for="color in ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF']"
            :key="color"
            class="color-btn"
            :style="{ backgroundColor: color }"
            @click="brushColor = color"
          ></button>
        </div>
        <div class="size-picker">
          <input type="range" v-model="brushSize" min="1" max="20" />
          <span>{{ brushSize }}px</span>
        </div>
        <button class="btn clear-btn" @click="clearCanvas">지우기</button>
      </div>

      <!-- 채팅 (맞추는 사람들) -->
      <div class="chat-section">
        <div class="chat-messages">
          <div
            v-for="(msg, index) in messages"
            :key="index"
            class="chat-message"
            :class="{ system: msg.isSystem }"
          >
            <span v-if="!msg.isSystem" class="chat-player">{{ msg.player }}:</span>
            <span class="chat-text">{{ msg.message }}</span>
          </div>
        </div>

        <div v-if="currentDrawer !== myPlayerId" class="chat-input-wrapper">
          <input
            v-model="chatInput"
            type="text"
            placeholder="정답 입력..."
            @keyup.enter="sendChat"
            :disabled="isCorrect"
          />
          <button class="btn send-btn" @click="sendChat" :disabled="isCorrect">
            {{ isCorrect ? '정답!' : '전송' }}
          </button>
        </div>
      </div>

      <!-- 점수판 -->
      <div class="scoreboard">
        <div
          v-for="player in players"
          :key="player.id"
          class="score-item"
          :class="{ drawing: player.id === currentDrawer }"
        >
          <span class="score-name">{{ player.name }}</span>
          <span class="score-value">{{ player.score || 0 }}점</span>
        </div>
      </div>
    </div>

    <!-- 결과 -->
    <div v-if="gameState === 'result'" class="result-section">
      <div class="winner-display">
        <div class="winner-title">우승자!</div>
        <div class="winner-name">{{ winner?.name }}</div>
        <div class="winner-score">{{ winner?.score || 0 }}점</div>
      </div>

      <div class="final-scores">
        <h4>최종 순위</h4>
        <div
          v-for="(player, index) in [...players].sort((a, b) => (b.score || 0) - (a.score || 0))"
          :key="player.id"
          class="final-score-item"
        >
          <span class="rank">{{ index + 1 }}위</span>
          <span class="name">{{ player.name }}</span>
          <span class="score">{{ player.score || 0 }}점</span>
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
.catchmind {
  padding: 15px;
  max-width: 400px;
}

.game-title {
  text-align: center;
  font-size: 1.8rem;
  margin-bottom: 20px;
  background: linear-gradient(135deg, #00b894, #0984e3);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
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
  gap: 10px;
}

.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.round-info {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.timer {
  font-size: 1.2rem;
  font-weight: bold;
  color: #00b894;
}

.timer.warning {
  color: #e74c3c;
  animation: pulse 0.5s infinite;
}

.word-display {
  text-align: center;
  padding: 10px;
  background: var(--card-bg);
  border-radius: 10px;
}

.current-word {
  color: #ffd93d;
  font-size: 1.1rem;
}

.word-hint {
  color: var(--text-secondary);
}

.drawer-info {
  text-align: center;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.canvas-wrapper {
  display: flex;
  justify-content: center;
}

canvas {
  background: #fff;
  border-radius: 12px;
  touch-action: none;
  cursor: not-allowed;
}

canvas.can-draw {
  cursor: crosshair;
}

.draw-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: center;
}

.color-picker {
  display: flex;
  gap: 5px;
  align-items: center;
}

.color-picker input[type="color"] {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

.color-btn {
  width: 25px;
  height: 25px;
  border: 2px solid #fff;
  border-radius: 50%;
  cursor: pointer;
}

.size-picker {
  display: flex;
  align-items: center;
  gap: 5px;
}

.size-picker input[type="range"] {
  width: 80px;
}

.clear-btn {
  padding: 5px 15px;
  font-size: 0.85rem;
  background: #e74c3c !important;
}

/* 채팅 */
.chat-section {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 10px;
}

.chat-messages {
  height: 100px;
  overflow-y: auto;
  margin-bottom: 10px;
}

.chat-message {
  padding: 5px;
  font-size: 0.85rem;
}

.chat-message.system {
  color: #ffd93d;
  font-weight: bold;
}

.chat-player {
  color: #00b894;
  margin-right: 5px;
}

.chat-input-wrapper {
  display: flex;
  gap: 10px;
}

.chat-input-wrapper input {
  flex: 1;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.send-btn {
  padding: 10px 15px;
  font-size: 0.85rem;
}

/* 점수판 */
.scoreboard {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.score-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 12px;
  background: var(--card-bg);
  border-radius: 10px;
  font-size: 0.8rem;
}

.score-item.drawing {
  border: 2px solid #ffd93d;
}

.score-value {
  color: #00b894;
  font-weight: bold;
}

/* 결과 */
.result-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
  text-align: center;
}

.winner-display {
  padding: 30px;
  background: linear-gradient(135deg, rgba(255, 217, 61, 0.2), rgba(255, 165, 0, 0.2));
  border: 2px solid #ffd93d;
  border-radius: 16px;
}

.winner-title {
  font-size: 1.2rem;
  color: var(--text-secondary);
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

.final-scores {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 15px;
}

.final-scores h4 {
  margin-bottom: 15px;
  color: var(--text-secondary);
}

.final-score-item {
  display: flex;
  justify-content: space-between;
  padding: 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 5px;
}

.final-score-item .rank {
  color: #ffd93d;
  font-weight: bold;
}

.final-score-item .score {
  color: #00b894;
}

.result-actions {
  display: flex;
  gap: 10px;
}

.result-actions .btn {
  flex: 1;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
