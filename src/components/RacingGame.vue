<script setup>
import { ref, inject, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { database, ref as dbRef, set, onValue, update, off } from '../firebase'

const emit = defineEmits(['go-back'])
const globalRoom = inject('globalRoom')

// 차량 정의 (이모지 제거, Canvas 렌더링용 데이터)
const CARS = [
  { id: 'sports', name: '스포츠카', color: '#e74c3c', accent: '#c0392b', speed: 8, handling: 9, acceleration: 7, type: 'sports' },
  { id: 'muscle', name: '머슬카', color: '#f39c12', accent: '#d68910', speed: 7, handling: 5, acceleration: 10, type: 'muscle' },
  { id: 'compact', name: '경차', color: '#3498db', accent: '#2980b9', speed: 6, handling: 10, acceleration: 8, type: 'compact' },
  { id: 'truck', name: '트럭', color: '#2ecc71', accent: '#27ae60', speed: 7, handling: 6, acceleration: 5, type: 'truck' },
  { id: 'bike', name: '바이크', color: '#9b59b6', accent: '#8e44ad', speed: 9, handling: 4, acceleration: 9, type: 'bike' },
  { id: 'bus', name: '버스', color: '#1abc9c', accent: '#16a085', speed: 5, handling: 8, acceleration: 4, type: 'bus' }
]

// 아이템 정의
const ITEMS = [
  { id: 'boost', name: '부스터', emoji: '🔥', effect: 'speed', duration: 2000 },
  { id: 'banana', name: '바나나', emoji: '🍌', effect: 'trap' },
  { id: 'missile', name: '미사일', emoji: '🚀', effect: 'attack' },
  { id: 'shield', name: '쉴드', emoji: '🛡️', effect: 'defense', duration: 5000 }
]

// ========== Pseudo-3D 트랙 설정 ==========
const ROAD = {
  length: 15000,       // 트랙 총 길이 (3배 증가)
  width: 2000,         // 도로 너비
  lanes: 3,            // 차선 수
  segmentLength: 100,  // 세그먼트 길이
  rumbleLength: 3,     // 럼블 스트립 세그먼트 수
}

const CAMERA = {
  height: 1000,        // 카메라 높이
  depth: 0.84,         // 카메라 깊이 (FOV 관련)
  drawDistance: 100,   // 그릴 세그먼트 수
}

// 3D 트랙 생성 (커브, 언덕 포함)
const generate3DTrack = () => {
  const segments = []
  const totalSegments = Math.floor(ROAD.length / ROAD.segmentLength)

  for (let i = 0; i < totalSegments; i++) {
    const segment = {
      index: i,
      p1: { world: { z: i * ROAD.segmentLength }, camera: {}, screen: {} },
      p2: { world: { z: (i + 1) * ROAD.segmentLength }, camera: {}, screen: {} },
      curve: 0,
      hill: 0,
      color: Math.floor(i / ROAD.rumbleLength) % 2 ? 'dark' : 'light',
      sprites: [],
      cars: []
    }

    // 커브 구간 설정 (서킷 형태로 - 폐쇄 루프가 되도록)
    const progress = i / totalSegments

    // 구간별 커브 (전체 커브 합이 360도가 되어야 폐쇄 루프)
    // 직진 구간 + 코너 반복 패턴
    if (progress > 0.02 && progress < 0.08) segment.curve = 4       // 1번 코너 (우회전)
    if (progress > 0.12 && progress < 0.16) segment.curve = -3      // 2번 코너 (좌회전)
    if (progress > 0.18 && progress < 0.22) segment.curve = -3      // 3번 코너 (좌회전)
    if (progress > 0.28 && progress < 0.35) segment.curve = 5       // 4번 코너 (긴 우회전)
    if (progress > 0.40 && progress < 0.44) segment.curve = 3       // 5번 코너
    if (progress > 0.48 && progress < 0.52) segment.curve = -4      // 6번 코너 (급좌회전)
    if (progress > 0.56 && progress < 0.60) segment.curve = 3       // 7번 코너
    if (progress > 0.65 && progress < 0.72) segment.curve = 4       // 8번 코너 (긴 우회전)
    if (progress > 0.76 && progress < 0.80) segment.curve = -2      // 9번 코너 (완만한 좌회전)
    if (progress > 0.84 && progress < 0.88) segment.curve = 3       // 10번 코너
    if (progress > 0.92 && progress < 0.98) segment.curve = 2       // 마지막 코너

    // 언덕 구간 (더 다양하게)
    if (progress > 0.05 && progress < 0.10) segment.hill = 25      // 1번 언덕 오르막
    if (progress > 0.10 && progress < 0.14) segment.hill = -25     // 1번 언덕 내리막
    if (progress > 0.30 && progress < 0.34) segment.hill = 40      // 2번 큰 언덕
    if (progress > 0.34 && progress < 0.38) segment.hill = -40
    if (progress > 0.50 && progress < 0.53) segment.hill = 20      // 3번 작은 언덕
    if (progress > 0.53 && progress < 0.56) segment.hill = -20
    if (progress > 0.70 && progress < 0.75) segment.hill = 35      // 4번 언덕
    if (progress > 0.75 && progress < 0.80) segment.hill = -35

    // 도로변 장식물 (더 다양하게)
    if (i % 8 === 0) {
      // 나무 (랜덤 종류)
      const treeTypes = ['tree', 'pine', 'palm', 'bush']
      const treeType = treeTypes[Math.floor(Math.random() * treeTypes.length)]
      segment.sprites.push({ type: treeType, offset: -1.1 - Math.random() * 0.3 })
      segment.sprites.push({ type: treeType, offset: 1.1 + Math.random() * 0.3 })
    }
    if (i % 12 === 0) {
      // 추가 식물
      segment.sprites.push({ type: 'bush', offset: -1.5 })
      segment.sprites.push({ type: 'rock', offset: 1.6 })
    }
    if (i % 25 === 0) {
      // 표지판 (다양한 종류)
      const signTypes = ['sign', 'arrow', 'billboard']
      segment.sprites.push({ type: signTypes[Math.floor(Math.random() * signTypes.length)], offset: -1.4 })
    }
    if (i % 40 === 0) {
      // 건물/구조물
      const buildingTypes = ['building', 'tower', 'house']
      segment.sprites.push({ type: buildingTypes[Math.floor(Math.random() * buildingTypes.length)], offset: 1.8 + Math.random() * 0.3 })
    }
    if (i % 60 === 0) {
      // 특별 오브젝트
      segment.sprites.push({ type: 'flag', offset: -1.3 })
    }

    segments.push(segment)
  }

  return segments
}

// 미니맵용 트랙 경로 계산
const calculateTrackPath = (segments) => {
  const path = []
  let x = 0
  let y = 0
  let angle = -Math.PI / 2

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    const curve = segment.curve * 0.003

    angle += curve
    x += Math.cos(angle)
    y += Math.sin(angle)

    path.push({ x, y, angle, index: i })
  }

  // 경로 정규화
  const minX = Math.min(...path.map(p => p.x))
  const maxX = Math.max(...path.map(p => p.x))
  const minY = Math.min(...path.map(p => p.y))
  const maxY = Math.max(...path.map(p => p.y))

  const width = maxX - minX || 1
  const height = maxY - minY || 1
  const mapSize = 120
  const padding = 15
  const scaleX = (mapSize - padding * 2) / width
  const scaleY = (mapSize - padding * 2) / height
  const finalScale = Math.min(scaleX, scaleY)

  const offsetX = (mapSize - width * finalScale) / 2
  const offsetY = (mapSize - height * finalScale) / 2

  return path.map(p => ({
    x: (p.x - minX) * finalScale + offsetX,
    y: (p.y - minY) * finalScale + offsetY,
    angle: p.angle,
    index: p.index
  }))
}

// 미니맵 렌더링
const renderMinimap = () => {
  const canvas = minimapRef.value
  if (!canvas || !trackPath.value.length) return

  const ctx = canvas.getContext('2d')
  const size = canvas.width
  const path = trackPath.value
  const totalSegments = track3D.value.length

  // 둥근 모서리 클리핑
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(0, 0, size, size, 12)
  ctx.clip()

  // 잔디 배경 그라데이션
  const grassGrad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size)
  grassGrad.addColorStop(0, '#2d5a27')
  grassGrad.addColorStop(1, '#1a3d15')
  ctx.fillStyle = grassGrad
  ctx.fillRect(0, 0, size, size)

  // 잔디 텍스처 (점들)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'
  for (let i = 0; i < 50; i++) {
    const gx = Math.random() * size
    const gy = Math.random() * size
    ctx.beginPath()
    ctx.arc(gx, gy, 1, 0, Math.PI * 2)
    ctx.fill()
  }

  // 트랙 그림자
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)'
  ctx.lineWidth = 14
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(path[0].x + 2, path[0].y + 2)
  for (let i = 1; i < path.length; i += 2) {
    ctx.lineTo(path[i].x + 2, path[i].y + 2)
  }
  ctx.closePath()
  ctx.stroke()

  // 트랙 외곽 (붉은색 연석)
  ctx.strokeStyle = '#cc3333'
  ctx.lineWidth = 12
  ctx.beginPath()
  ctx.moveTo(path[0].x, path[0].y)
  for (let i = 1; i < path.length; i += 2) {
    ctx.lineTo(path[i].x, path[i].y)
  }
  ctx.closePath()
  ctx.stroke()

  // 트랙 외곽 (흰색 연석)
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 10
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(path[0].x, path[0].y)
  for (let i = 1; i < path.length; i += 2) {
    ctx.lineTo(path[i].x, path[i].y)
  }
  ctx.closePath()
  ctx.stroke()
  ctx.setLineDash([])

  // 아스팔트 트랙
  const trackGrad = ctx.createLinearGradient(0, 0, size, size)
  trackGrad.addColorStop(0, '#4a4a4a')
  trackGrad.addColorStop(0.5, '#3a3a3a')
  trackGrad.addColorStop(1, '#4a4a4a')
  ctx.strokeStyle = trackGrad
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.moveTo(path[0].x, path[0].y)
  for (let i = 1; i < path.length; i += 2) {
    ctx.lineTo(path[i].x, path[i].y)
  }
  ctx.closePath()
  ctx.stroke()

  // 중앙선 (점선)
  ctx.strokeStyle = '#ffcc00'
  ctx.lineWidth = 1
  ctx.setLineDash([3, 6])
  ctx.beginPath()
  ctx.moveTo(path[0].x, path[0].y)
  for (let i = 1; i < path.length; i += 3) {
    ctx.lineTo(path[i].x, path[i].y)
  }
  ctx.closePath()
  ctx.stroke()
  ctx.setLineDash([])

  // 출발/결승선
  const startPoint = path[0]
  const nextPoint = path[1] || path[0]
  const lineAngle = Math.atan2(nextPoint.y - startPoint.y, nextPoint.x - startPoint.x) + Math.PI / 2
  const lineLen = 6

  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(startPoint.x - Math.cos(lineAngle) * lineLen, startPoint.y - Math.sin(lineAngle) * lineLen)
  ctx.lineTo(startPoint.x + Math.cos(lineAngle) * lineLen, startPoint.y + Math.sin(lineAngle) * lineLen)
  ctx.stroke()

  // 체커 플래그 패턴
  ctx.fillStyle = '#000'
  for (let i = 0; i < 3; i++) {
    const cx = startPoint.x + Math.cos(lineAngle) * (lineLen - i * 4)
    const cy = startPoint.y + Math.sin(lineAngle) * (lineLen - i * 4)
    if (i % 2 === 0) {
      ctx.beginPath()
      ctx.arc(cx, cy, 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // AI 차량 표시
  for (const ai of aiCars3D.value) {
    if (ai.finished) continue
    const segmentIndex = Math.floor(ai.z / ROAD.segmentLength) % totalSegments
    const pathPoint = path[segmentIndex % path.length]
    if (pathPoint) {
      const carData = CARS.find(c => c.id === ai.carId)

      // 차량 글로우
      ctx.shadowColor = carData?.color || '#888'
      ctx.shadowBlur = 4

      // 차량 외곽
      ctx.fillStyle = '#000'
      ctx.beginPath()
      ctx.arc(pathPoint.x, pathPoint.y, 5, 0, Math.PI * 2)
      ctx.fill()

      // 차량 색
      ctx.fillStyle = carData?.color || '#888'
      ctx.beginPath()
      ctx.arc(pathPoint.x, pathPoint.y, 4, 0, Math.PI * 2)
      ctx.fill()

      ctx.shadowBlur = 0
    }
  }

  // 플레이어 위치 (삼각형 화살표)
  const playerSegmentIndex = Math.floor(playerZ.value / ROAD.segmentLength) % totalSegments
  const playerPoint = path[playerSegmentIndex % path.length]
  const nextPlayerPoint = path[(playerSegmentIndex + 3) % path.length]

  if (playerPoint && nextPlayerPoint) {
    const dir = Math.atan2(nextPlayerPoint.y - playerPoint.y, nextPlayerPoint.x - playerPoint.x)

    // 플레이어 글로우
    ctx.shadowColor = '#00ffff'
    ctx.shadowBlur = 10

    // 삼각형 화살표
    ctx.save()
    ctx.translate(playerPoint.x, playerPoint.y)
    ctx.rotate(dir)

    // 외곽
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.moveTo(8, 0)
    ctx.lineTo(-5, -5)
    ctx.lineTo(-3, 0)
    ctx.lineTo(-5, 5)
    ctx.closePath()
    ctx.fill()

    // 내부
    ctx.fillStyle = '#00ccff'
    ctx.beginPath()
    ctx.moveTo(6, 0)
    ctx.lineTo(-4, -4)
    ctx.lineTo(-2, 0)
    ctx.lineTo(-4, 4)
    ctx.closePath()
    ctx.fill()

    ctx.restore()
    ctx.shadowBlur = 0
  }

  ctx.restore()

  // 미니맵 테두리
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(0, 0, size, size, 12)
  ctx.stroke()

  // 랩 카운터 배경
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
  ctx.beginPath()
  ctx.roundRect(size/2 - 30, size - 20, 60, 18, 4)
  ctx.fill()

  // 랩 카운터 텍스트
  ctx.fillStyle = '#00ffff'
  ctx.font = 'bold 11px "Segoe UI", Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`LAP ${currentLap.value + 1}/${totalLaps.value}`, size / 2, size - 11)
}

// ========== 탑뷰 트랙 설정 (기존) ==========
const TRACK_TOPDOWN = {
  width: 360,
  height: 500,
  laps: 3,
  centerX: 180,
  centerY: 250,
  radiusX: 140,
  radiusY: 180
}

// ========== 게임 상태 ==========
const viewMode = ref('3d') // '3d' or 'topdown'
const gamePhase = ref('lobby')
const selectedCar = ref(null)
const racers = ref([])
const countdown = ref(0)
const raceTime = ref(0)
const finishOrder = ref([])
const myFinished = ref(false)
const totalLaps = ref(3)

// 플레이어 상태
const playerX = ref(0)           // 도로 내 좌우 위치 (-1 ~ 1)
const playerZ = ref(0)           // 트랙 위치 (진행도)
const playerSpeed = ref(0)       // 현재 속도
const maxSpeed = ref(200)        // 최대 속도
const accel = ref(0)
const currentLap = ref(0)
const currentSegment = ref(0)

// 탑뷰 모드용
const myPosition = ref({ progress: 0, offset: 0 })
const myLap = ref(0)
const mySpeed = ref(0)

// 공통
const myItem = ref(null)
const effects = ref({ boost: false, shield: false, spin: false })
const controls = ref({ left: false, right: false, accelerate: true })
const isAutoMode = ref(true)
const traps = ref([])

// 3D 렌더링용
const canvasRef = ref(null)
const minimapRef = ref(null)
const track3D = ref([])
const aiCars3D = ref([])
const trackPath = ref([]) // 미니맵용 트랙 경로

// 시각 효과용
const speedLines = ref([])       // 스피드 라인
const clouds = ref([])           // 패럴랙스 구름
const boostParticles = ref([])   // 부스트 파티클
const driftSmoke = ref([])       // 드리프트 연기
const tireMarks = ref([])        // 타이어 자국
const cameraShake = ref({ x: 0, y: 0 })  // 카메라 흔들림
const lapFlash = ref(0)          // 랩 완료 플래시
const isDrifting = ref(false)    // 드리프트 중

// 게임플레이 시스템
const itemBoxes = ref([])        // 트랙 위 아이템 박스
const placedBananas = ref([])    // 설치된 바나나
const missiles = ref([])         // 발사된 미사일
const driftBoost = ref(0)        // 드리프트 부스터 충전량 (0~100)
const driftBoostReady = ref(false) // 드리프트 부스터 사용 가능

// 2순위 게임플레이 시스템
const slipstream = ref(0)        // 슬립스트림 게이지 (0~100)
const isSlipstreaming = ref(false) // 슬립스트림 중
const boostPads = ref([])        // 부스트 패드 위치
const miniTurboCharge = ref(0)   // 미니터보 충전 (출발 시)
const miniTurboReady = ref(false) // 미니터보 준비됨
const lastRank = ref(1)          // 이전 순위 (변동 감지용)
const rankChangeText = ref('')   // 순위 변동 텍스트
const rankChangeTimer = ref(0)   // 순위 변동 표시 타이머

// Firebase/멀티플레이어
let unsubscribers = []
let gameLoop = null
const isMultiplayer = computed(() => globalRoom?.isInRoom?.value)
const myPlayerId = computed(() => globalRoom?.myPlayerId?.value || 'solo')
const myPlayerName = computed(() => globalRoom?.myPlayerName?.value || '나')
const isHost = computed(() => !isMultiplayer.value || globalRoom?.isHost?.value)

// ========== 3D 렌더링 함수들 ==========
const project = (p, cameraX, cameraY, cameraZ, cameraDepth, width, height, roadWidth) => {
  p.camera.x = (p.world.x || 0) - cameraX
  p.camera.y = (p.world.y || 0) - cameraY
  p.camera.z = (p.world.z || 0) - cameraZ

  const scale = cameraDepth / p.camera.z
  p.screen.scale = scale
  p.screen.x = Math.round(width / 2 + scale * p.camera.x * width / 2)
  p.screen.y = Math.round(height / 2 - scale * p.camera.y * height / 2)
  p.screen.w = Math.round(scale * roadWidth * width / 2)
}

const renderSegment = (ctx, width, height, segment, clip) => {
  const p1 = segment.p1.screen
  const p2 = segment.p2.screen

  const isDark = segment.color === 'dark'
  const colors = isDark ? {
    road: '#4a4a4a',
    roadEdge: '#3a3a3a',
    grass: '#1e8b1e',
    grassEdge: '#167016',
    rumble: '#cc0000',
    rumbleAlt: '#ffffff',
    lane: '#ffcc00'
  } : {
    road: '#555555',
    roadEdge: '#454545',
    grass: '#22a022',
    grassEdge: '#1a801a',
    rumble: '#ffffff',
    rumbleAlt: '#cc0000',
    lane: '#555555'
  }

  // 풀밭 (더 풍부한 색상)
  ctx.fillStyle = colors.grass
  ctx.fillRect(0, p2.y, width, p1.y - p2.y)

  // 풀밭 가장자리 (도로 바로 옆)
  const grassEdgeW1 = p1.w * 0.3
  const grassEdgeW2 = p2.w * 0.3
  drawPolygon(ctx, p1.x - p1.w - grassEdgeW1 * 2, p1.y, p1.x - p1.w - grassEdgeW1, p1.y,
              p2.x - p2.w - grassEdgeW2, p2.y, p2.x - p2.w - grassEdgeW2 * 2, p2.y, colors.grassEdge)
  drawPolygon(ctx, p1.x + p1.w + grassEdgeW1, p1.y, p1.x + p1.w + grassEdgeW1 * 2, p1.y,
              p2.x + p2.w + grassEdgeW2 * 2, p2.y, p2.x + p2.w + grassEdgeW2, p2.y, colors.grassEdge)

  // 럼블 스트립 (빨강/흰 번갈아)
  const rumbleW1 = p1.w / 4
  const rumbleW2 = p2.w / 4
  const rumbleColor = isDark ? colors.rumble : colors.rumbleAlt
  drawPolygon(ctx, p1.x - p1.w - rumbleW1, p1.y, p1.x - p1.w, p1.y, p2.x - p2.w, p2.y, p2.x - p2.w - rumbleW2, p2.y, rumbleColor)
  drawPolygon(ctx, p1.x + p1.w, p1.y, p1.x + p1.w + rumbleW1, p1.y, p2.x + p2.w + rumbleW2, p2.y, p2.x + p2.w, p2.y, rumbleColor)

  // 도로 (약간 그라데이션 효과)
  drawPolygon(ctx, p1.x - p1.w, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x - p2.w, p2.y, colors.road)

  // 도로 가장자리 라인 (흰색)
  const edgeW1 = p1.w / 30
  const edgeW2 = p2.w / 30
  drawPolygon(ctx, p1.x - p1.w, p1.y, p1.x - p1.w + edgeW1, p1.y, p2.x - p2.w + edgeW2, p2.y, p2.x - p2.w, p2.y, '#ffffff')
  drawPolygon(ctx, p1.x + p1.w - edgeW1, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x + p2.w - edgeW2, p2.y, '#ffffff')

  // 중앙 차선 (점선 효과 - dark 세그먼트에서만)
  if (isDark) {
    const laneW1 = p1.w / 35
    const laneW2 = p2.w / 35
    // 중앙선
    drawPolygon(ctx, p1.x - laneW1, p1.y, p1.x + laneW1, p1.y, p2.x + laneW2, p2.y, p2.x - laneW2, p2.y, colors.lane)

    // 양쪽 차선
    const laneX1 = p1.w * 0.5
    const laneX2 = p2.w * 0.5
    drawPolygon(ctx, p1.x - laneX1 - laneW1, p1.y, p1.x - laneX1 + laneW1, p1.y, p2.x - laneX2 + laneW2, p2.y, p2.x - laneX2 - laneW2, p2.y, '#ffffff')
    drawPolygon(ctx, p1.x + laneX1 - laneW1, p1.y, p1.x + laneX1 + laneW1, p1.y, p2.x + laneX2 + laneW2, p2.y, p2.x + laneX2 - laneW2, p2.y, '#ffffff')
  }

  // 타이어 자국 렌더링
  for (const mark of tireMarks.value) {
    const relativeZ = mark.z - (segment.index * ROAD.segmentLength)
    if (relativeZ >= 0 && relativeZ < ROAD.segmentLength) {
      const markX = p1.x + (mark.x * p1.w * 0.8)
      const alpha = mark.life * 0.3
      if (alpha > 0.05) {
        ctx.fillStyle = `rgba(30, 30, 30, ${alpha})`
        ctx.fillRect(markX - p1.w * 0.02, p1.y - 2, p1.w * 0.04, 4)
        ctx.fillRect(markX + p1.w * 0.1, p1.y - 2, p1.w * 0.04, 4)
      }
      mark.life -= 0.001
    }
  }
  // 오래된 타이어 자국 제거
  tireMarks.value = tireMarks.value.filter(m => m.life > 0)
}

const drawPolygon = (ctx, x1, y1, x2, y2, x3, y3, x4, y4, color) => {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.lineTo(x3, y3)
  ctx.lineTo(x4, y4)
  ctx.closePath()
  ctx.fill()
}

const renderSprite = (ctx, width, height, sprite, segment, offset, clipY) => {
  const p = segment.p1.screen
  const scale = p.scale

  // 스프라이트 크기 설정
  const sizes = {
    tree: { w: 80, h: 120 },
    pine: { w: 60, h: 140 },
    palm: { w: 70, h: 130 },
    bush: { w: 50, h: 40 },
    rock: { w: 40, h: 35 },
    sign: { w: 60, h: 80 },
    arrow: { w: 50, h: 70 },
    billboard: { w: 120, h: 90 },
    building: { w: 100, h: 150 },
    tower: { w: 60, h: 200 },
    house: { w: 90, h: 80 },
    flag: { w: 30, h: 100 }
  }

  const size = sizes[sprite.type] || { w: 60, h: 80 }
  const destW = size.w * scale * 2
  const destH = size.h * scale * 2
  const destX = p.x + (scale * sprite.offset * ROAD.width * width / 2)
  const destY = p.y

  if (destY - destH < clipY) return
  if (destY > height) return
  if (destW < 3) return

  ctx.save()

  switch (sprite.type) {
    case 'tree':
      // 일반 나무
      ctx.fillStyle = '#5d4037'
      ctx.fillRect(destX - destW * 0.08, destY - destH * 0.4, destW * 0.16, destH * 0.4)
      ctx.fillStyle = '#2e7d32'
      ctx.beginPath()
      ctx.arc(destX, destY - destH * 0.55, destW * 0.25, 0, Math.PI * 2)
      ctx.arc(destX - destW * 0.12, destY - destH * 0.45, destW * 0.2, 0, Math.PI * 2)
      ctx.arc(destX + destW * 0.12, destY - destH * 0.45, destW * 0.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#43a047'
      ctx.beginPath()
      ctx.arc(destX, destY - destH * 0.7, destW * 0.18, 0, Math.PI * 2)
      ctx.fill()
      break

    case 'pine':
      // 소나무 (삼각형)
      ctx.fillStyle = '#4a3728'
      ctx.fillRect(destX - destW * 0.06, destY - destH * 0.25, destW * 0.12, destH * 0.25)
      ctx.fillStyle = '#1b5e20'
      ctx.beginPath()
      ctx.moveTo(destX, destY - destH)
      ctx.lineTo(destX - destW * 0.3, destY - destH * 0.3)
      ctx.lineTo(destX + destW * 0.3, destY - destH * 0.3)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#2e7d32'
      ctx.beginPath()
      ctx.moveTo(destX, destY - destH * 0.85)
      ctx.lineTo(destX - destW * 0.25, destY - destH * 0.4)
      ctx.lineTo(destX + destW * 0.25, destY - destH * 0.4)
      ctx.closePath()
      ctx.fill()
      break

    case 'palm':
      // 야자나무
      ctx.fillStyle = '#8d6e63'
      ctx.beginPath()
      ctx.moveTo(destX - destW * 0.08, destY)
      ctx.quadraticCurveTo(destX + destW * 0.1, destY - destH * 0.5, destX, destY - destH * 0.7)
      ctx.quadraticCurveTo(destX - destW * 0.1, destY - destH * 0.5, destX + destW * 0.08, destY)
      ctx.fill()
      // 잎
      ctx.strokeStyle = '#4caf50'
      ctx.lineWidth = Math.max(2, destW * 0.08)
      ctx.lineCap = 'round'
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(destX, destY - destH * 0.7)
        ctx.quadraticCurveTo(
          destX + Math.cos(angle) * destW * 0.3,
          destY - destH * 0.8,
          destX + Math.cos(angle) * destW * 0.4,
          destY - destH * 0.6
        )
        ctx.stroke()
      }
      break

    case 'bush':
      // 덤불
      ctx.fillStyle = '#388e3c'
      ctx.beginPath()
      ctx.arc(destX - destW * 0.15, destY - destH * 0.4, destW * 0.25, 0, Math.PI * 2)
      ctx.arc(destX + destW * 0.15, destY - destH * 0.4, destW * 0.25, 0, Math.PI * 2)
      ctx.arc(destX, destY - destH * 0.55, destW * 0.22, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#4caf50'
      ctx.beginPath()
      ctx.arc(destX, destY - destH * 0.45, destW * 0.2, 0, Math.PI * 2)
      ctx.fill()
      break

    case 'rock':
      // 바위
      ctx.fillStyle = '#757575'
      ctx.beginPath()
      ctx.moveTo(destX - destW * 0.4, destY)
      ctx.lineTo(destX - destW * 0.3, destY - destH * 0.7)
      ctx.lineTo(destX + destW * 0.1, destY - destH * 0.9)
      ctx.lineTo(destX + destW * 0.35, destY - destH * 0.5)
      ctx.lineTo(destX + destW * 0.4, destY)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#9e9e9e'
      ctx.beginPath()
      ctx.moveTo(destX - destW * 0.2, destY - destH * 0.3)
      ctx.lineTo(destX, destY - destH * 0.8)
      ctx.lineTo(destX + destW * 0.2, destY - destH * 0.4)
      ctx.closePath()
      ctx.fill()
      break

    case 'sign':
      // 경고 표지판
      ctx.fillStyle = '#757575'
      ctx.fillRect(destX - destW * 0.05, destY - destH * 0.8, destW * 0.1, destH * 0.8)
      ctx.fillStyle = '#ff9800'
      ctx.fillRect(destX - destW * 0.3, destY - destH * 0.95, destW * 0.6, destH * 0.25)
      ctx.fillStyle = '#000'
      ctx.fillRect(destX - destW * 0.2, destY - destH * 0.88, destW * 0.4, destH * 0.04)
      break

    case 'arrow':
      // 화살표 표지판
      ctx.fillStyle = '#616161'
      ctx.fillRect(destX - destW * 0.04, destY - destH * 0.7, destW * 0.08, destH * 0.7)
      ctx.fillStyle = '#2196f3'
      ctx.beginPath()
      ctx.moveTo(destX - destW * 0.35, destY - destH * 0.7)
      ctx.lineTo(destX + destW * 0.35, destY - destH * 0.85)
      ctx.lineTo(destX - destW * 0.35, destY - destH)
      ctx.closePath()
      ctx.fill()
      break

    case 'billboard':
      // 광고판
      ctx.fillStyle = '#424242'
      ctx.fillRect(destX - destW * 0.08, destY - destH * 0.5, destW * 0.06, destH * 0.5)
      ctx.fillRect(destX + destW * 0.02, destY - destH * 0.5, destW * 0.06, destH * 0.5)
      // 광고판 본체
      const gradient = ctx.createLinearGradient(destX - destW * 0.45, 0, destX + destW * 0.45, 0)
      gradient.addColorStop(0, '#e91e63')
      gradient.addColorStop(0.5, '#9c27b0')
      gradient.addColorStop(1, '#673ab7')
      ctx.fillStyle = gradient
      ctx.fillRect(destX - destW * 0.45, destY - destH, destW * 0.9, destH * 0.5)
      // 테두리
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = Math.max(1, destW * 0.02)
      ctx.strokeRect(destX - destW * 0.45, destY - destH, destW * 0.9, destH * 0.5)
      break

    case 'building':
      // 건물
      ctx.fillStyle = '#78909c'
      ctx.fillRect(destX - destW * 0.35, destY - destH * 0.9, destW * 0.7, destH * 0.9)
      // 창문
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 3; col++) {
          ctx.fillStyle = Math.random() > 0.3 ? '#fff9c4' : '#90caf9'
          ctx.fillRect(destX - destW * 0.25 + col * destW * 0.2, destY - destH * 0.85 + row * destH * 0.18, destW * 0.12, destH * 0.1)
        }
      }
      ctx.fillStyle = '#546e7a'
      ctx.beginPath()
      ctx.moveTo(destX - destW * 0.4, destY - destH * 0.9)
      ctx.lineTo(destX, destY - destH)
      ctx.lineTo(destX + destW * 0.4, destY - destH * 0.9)
      ctx.closePath()
      ctx.fill()
      break

    case 'tower':
      // 송전탑
      ctx.strokeStyle = '#616161'
      ctx.lineWidth = Math.max(1, destW * 0.04)
      // 다리
      ctx.beginPath()
      ctx.moveTo(destX - destW * 0.3, destY)
      ctx.lineTo(destX - destW * 0.1, destY - destH * 0.5)
      ctx.moveTo(destX + destW * 0.3, destY)
      ctx.lineTo(destX + destW * 0.1, destY - destH * 0.5)
      ctx.stroke()
      // 본체
      ctx.beginPath()
      ctx.moveTo(destX - destW * 0.1, destY - destH * 0.5)
      ctx.lineTo(destX, destY - destH)
      ctx.lineTo(destX + destW * 0.1, destY - destH * 0.5)
      ctx.stroke()
      // 가로대
      ctx.beginPath()
      ctx.moveTo(destX - destW * 0.25, destY - destH * 0.7)
      ctx.lineTo(destX + destW * 0.25, destY - destH * 0.7)
      ctx.moveTo(destX - destW * 0.15, destY - destH * 0.85)
      ctx.lineTo(destX + destW * 0.15, destY - destH * 0.85)
      ctx.stroke()
      break

    case 'house':
      // 집
      ctx.fillStyle = '#ffccbc'
      ctx.fillRect(destX - destW * 0.4, destY - destH * 0.6, destW * 0.8, destH * 0.6)
      // 지붕
      ctx.fillStyle = '#d84315'
      ctx.beginPath()
      ctx.moveTo(destX - destW * 0.5, destY - destH * 0.6)
      ctx.lineTo(destX, destY - destH)
      ctx.lineTo(destX + destW * 0.5, destY - destH * 0.6)
      ctx.closePath()
      ctx.fill()
      // 문
      ctx.fillStyle = '#5d4037'
      ctx.fillRect(destX - destW * 0.1, destY - destH * 0.35, destW * 0.2, destH * 0.35)
      // 창문
      ctx.fillStyle = '#b3e5fc'
      ctx.fillRect(destX - destW * 0.35, destY - destH * 0.5, destW * 0.15, destH * 0.15)
      ctx.fillRect(destX + destW * 0.2, destY - destH * 0.5, destW * 0.15, destH * 0.15)
      break

    case 'flag':
      // 깃발
      ctx.fillStyle = '#9e9e9e'
      ctx.fillRect(destX - destW * 0.05, destY - destH, destW * 0.1, destH)
      // 깃발 천
      const flagTime = Date.now() / 200
      ctx.fillStyle = '#f44336'
      ctx.beginPath()
      ctx.moveTo(destX + destW * 0.05, destY - destH)
      ctx.quadraticCurveTo(destX + destW * 0.3, destY - destH * 0.85 + Math.sin(flagTime) * destH * 0.05, destX + destW * 0.5, destY - destH * 0.9)
      ctx.lineTo(destX + destW * 0.5, destY - destH * 0.7)
      ctx.quadraticCurveTo(destX + destW * 0.3, destY - destH * 0.65 + Math.sin(flagTime) * destH * 0.05, destX + destW * 0.05, destY - destH * 0.7)
      ctx.closePath()
      ctx.fill()
      break
  }

  ctx.restore()
}

// ========== 차량 드로잉 함수 (이모지 대체) ==========
const drawCarShape = (ctx, x, y, size, carData, isPlayer = false) => {
  const w = size
  const h = size * 0.6

  ctx.save()
  ctx.translate(x, y)

  // 그림자
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
  ctx.beginPath()
  ctx.ellipse(0, h * 0.1, w * 0.4, h * 0.15, 0, 0, Math.PI * 2)
  ctx.fill()

  switch (carData.type) {
    case 'sports':
      // 스포츠카: 낮고 날렵한 형태
      ctx.fillStyle = carData.color
      ctx.beginPath()
      ctx.moveTo(-w * 0.4, 0)
      ctx.lineTo(-w * 0.3, -h * 0.3)
      ctx.lineTo(w * 0.2, -h * 0.35)
      ctx.lineTo(w * 0.45, -h * 0.15)
      ctx.lineTo(w * 0.45, h * 0.05)
      ctx.lineTo(-w * 0.4, h * 0.05)
      ctx.closePath()
      ctx.fill()
      // 창문
      ctx.fillStyle = '#1a1a2e'
      ctx.beginPath()
      ctx.moveTo(-w * 0.15, -h * 0.28)
      ctx.lineTo(w * 0.15, -h * 0.32)
      ctx.lineTo(w * 0.25, -h * 0.15)
      ctx.lineTo(-w * 0.1, -h * 0.15)
      ctx.closePath()
      ctx.fill()
      // 하이라이트
      ctx.fillStyle = 'rgba(255,255,255,0.3)'
      ctx.fillRect(-w * 0.35, -h * 0.25, w * 0.15, h * 0.08)
      break

    case 'muscle':
      // 머슬카: 넓고 강인한 형태
      ctx.fillStyle = carData.color
      ctx.beginPath()
      ctx.roundRect(-w * 0.4, -h * 0.3, w * 0.8, h * 0.4, 3)
      ctx.fill()
      ctx.fillStyle = carData.accent
      ctx.fillRect(-w * 0.35, -h * 0.05, w * 0.7, h * 0.15)
      // 창문
      ctx.fillStyle = '#1a1a2e'
      ctx.beginPath()
      ctx.roundRect(-w * 0.2, -h * 0.28, w * 0.35, h * 0.18, 2)
      ctx.fill()
      // 후드 스트라이프
      ctx.fillStyle = '#111'
      ctx.fillRect(-w * 0.05, -h * 0.25, w * 0.1, h * 0.3)
      break

    case 'compact':
      // 경차: 작고 둥근 형태
      ctx.fillStyle = carData.color
      ctx.beginPath()
      ctx.ellipse(0, -h * 0.1, w * 0.35, h * 0.25, 0, 0, Math.PI * 2)
      ctx.fill()
      // 창문
      ctx.fillStyle = '#87CEEB'
      ctx.beginPath()
      ctx.ellipse(w * 0.05, -h * 0.18, w * 0.15, h * 0.12, 0, 0, Math.PI * 2)
      ctx.fill()
      break

    case 'truck':
      // 트럭: 높고 각진 형태
      ctx.fillStyle = carData.color
      ctx.fillRect(-w * 0.35, -h * 0.4, w * 0.7, h * 0.5)
      ctx.fillStyle = carData.accent
      ctx.fillRect(-w * 0.35, -h * 0.1, w * 0.7, h * 0.2)
      // 캐빈
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(-w * 0.1, -h * 0.38, w * 0.3, h * 0.2)
      break

    case 'bike':
      // 바이크: 얇고 빠른 형태
      ctx.fillStyle = carData.color
      ctx.beginPath()
      ctx.ellipse(0, -h * 0.1, w * 0.15, h * 0.25, 0, 0, Math.PI * 2)
      ctx.fill()
      // 바퀴
      ctx.fillStyle = '#333'
      ctx.beginPath()
      ctx.ellipse(-w * 0.2, h * 0.05, w * 0.1, h * 0.1, 0, 0, Math.PI * 2)
      ctx.ellipse(w * 0.2, h * 0.05, w * 0.1, h * 0.1, 0, 0, Math.PI * 2)
      ctx.fill()
      // 라이더
      ctx.fillStyle = '#222'
      ctx.beginPath()
      ctx.ellipse(0, -h * 0.25, w * 0.1, h * 0.15, 0, 0, Math.PI * 2)
      ctx.fill()
      break

    case 'bus':
      // 버스: 길고 큰 형태
      ctx.fillStyle = carData.color
      ctx.fillRect(-w * 0.45, -h * 0.35, w * 0.9, h * 0.45)
      // 창문들
      ctx.fillStyle = '#87CEEB'
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(-w * 0.4 + i * w * 0.2, -h * 0.3, w * 0.12, h * 0.15)
      }
      // 스트라이프
      ctx.fillStyle = carData.accent
      ctx.fillRect(-w * 0.45, -h * 0.1, w * 0.9, h * 0.08)
      break
  }

  // 플레이어 차량 글로우 효과
  if (isPlayer) {
    ctx.shadowColor = carData.color
    ctx.shadowBlur = 15
  }

  ctx.restore()
}

const renderCar = (ctx, width, height, car, segment) => {
  const p = segment.p1.screen
  const scale = p.scale

  const carSize = Math.max(30, 100 * scale * 2)
  const carX = p.x + (scale * car.offset * ROAD.width * width / 4)
  const carY = p.y

  const carData = CARS.find(c => c.id === car.carId)
  if (carData) {
    // 스턴 상태면 차량이 흔들림
    let drawX = carX
    let drawY = carY - carSize * 0.3
    if (car.stunTime > 0) {
      drawX += (Math.random() - 0.5) * 10
      drawY += (Math.random() - 0.5) * 5
    }

    drawCarShape(ctx, drawX, drawY, carSize, carData, false)

    // 쉴드 효과 표시
    if (car.shield) {
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.7)'
      ctx.lineWidth = Math.max(2, 3 * scale)
      ctx.shadowColor = '#00ffff'
      ctx.shadowBlur = 10
      ctx.beginPath()
      ctx.arc(carX, carY - carSize * 0.3, carSize * 0.5, 0, Math.PI * 2)
      ctx.stroke()
      ctx.shadowBlur = 0
    }

    // 스턴 상태 표시 (별표)
    if (car.stunTime > 0) {
      ctx.fillStyle = '#ffff00'
      ctx.font = `${carSize * 0.4}px Arial`
      ctx.textAlign = 'center'
      ctx.fillText('★', carX - carSize * 0.3, drawY - carSize * 0.4)
      ctx.fillText('★', carX + carSize * 0.3, drawY - carSize * 0.4)
    }

    // 아이템 보유 표시
    if (car.item) {
      ctx.font = `${carSize * 0.4}px Arial`
      ctx.textAlign = 'center'
      ctx.fillText(car.item.emoji, carX, drawY - carSize * 0.6)
    }
  }
}

// ========== 시각 효과 함수들 ==========

// 구름 초기화
const initClouds = () => {
  clouds.value = []
  for (let i = 0; i < 8; i++) {
    clouds.value.push({
      x: Math.random() * 400,
      y: 20 + Math.random() * 80,
      size: 30 + Math.random() * 50,
      speed: 0.5 + Math.random() * 1,
      opacity: 0.3 + Math.random() * 0.4
    })
  }
}

// 구름 업데이트 & 렌더링
const renderClouds = (ctx, width, speed) => {
  for (const cloud of clouds.value) {
    // 속도에 따라 구름 이동 (패럴랙스)
    cloud.x -= (cloud.speed + speed * 0.01)
    if (cloud.x < -cloud.size) {
      cloud.x = width + cloud.size
      cloud.y = 20 + Math.random() * 80
    }

    // 구름 그리기
    ctx.fillStyle = `rgba(255, 255, 255, ${cloud.opacity})`
    ctx.beginPath()
    ctx.arc(cloud.x, cloud.y, cloud.size * 0.5, 0, Math.PI * 2)
    ctx.arc(cloud.x + cloud.size * 0.3, cloud.y - cloud.size * 0.1, cloud.size * 0.4, 0, Math.PI * 2)
    ctx.arc(cloud.x + cloud.size * 0.6, cloud.y, cloud.size * 0.35, 0, Math.PI * 2)
    ctx.arc(cloud.x - cloud.size * 0.3, cloud.y + cloud.size * 0.1, cloud.size * 0.3, 0, Math.PI * 2)
    ctx.fill()
  }
}

// 스피드 라인 업데이트 & 렌더링
const renderSpeedLines = (ctx, width, height, speed) => {
  const intensity = Math.min(speed / maxSpeed.value, 1)
  if (intensity < 0.3) return // 느릴 때는 표시 안 함

  const lineCount = Math.floor(intensity * 20)

  ctx.strokeStyle = `rgba(255, 255, 255, ${intensity * 0.6})`
  ctx.lineWidth = 2

  for (let i = 0; i < lineCount; i++) {
    const side = i % 2 === 0 ? -1 : 1
    const xBase = width / 2 + side * (width * 0.3 + Math.random() * width * 0.2)
    const yStart = height * 0.4 + Math.random() * height * 0.4
    const lineLength = 20 + intensity * 60

    ctx.beginPath()
    ctx.moveTo(xBase, yStart)
    ctx.lineTo(xBase + side * 10, yStart + lineLength)
    ctx.stroke()
  }
}

// 부스트 파티클 추가
const addBoostParticles = () => {
  for (let i = 0; i < 5; i++) {
    boostParticles.value.push({
      x: 180 + (Math.random() - 0.5) * 40,
      y: 450,
      vx: (Math.random() - 0.5) * 3,
      vy: Math.random() * 5 + 3,
      size: 5 + Math.random() * 10,
      life: 1,
      color: Math.random() > 0.5 ? '#ff6600' : '#ffcc00'
    })
  }
}

// 부스트 파티클 렌더링
const renderBoostParticles = (ctx) => {
  boostParticles.value = boostParticles.value.filter(p => {
    p.x += p.vx
    p.y += p.vy
    p.life -= 0.05
    p.size *= 0.95

    if (p.life <= 0) return false

    // 화염 파티클 그리기
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size)
    gradient.addColorStop(0, p.color)
    gradient.addColorStop(0.5, `rgba(255, 100, 0, ${p.life})`)
    gradient.addColorStop(1, 'rgba(255, 50, 0, 0)')

    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    ctx.fill()

    return true
  })
}

// 카메라 흔들림
const updateCameraShake = () => {
  if (effects.value.spin) {
    // 스핀 상태 - 강한 흔들림
    cameraShake.value.x = (Math.random() - 0.5) * 15
    cameraShake.value.y = (Math.random() - 0.5) * 10
  } else if (effects.value.boost) {
    cameraShake.value.x = (Math.random() - 0.5) * 4
    cameraShake.value.y = (Math.random() - 0.5) * 2
  } else if (isDrifting.value) {
    cameraShake.value.x = (Math.random() - 0.5) * 2
    cameraShake.value.y = (Math.random() - 0.5) * 1
  } else {
    cameraShake.value.x *= 0.9
    cameraShake.value.y *= 0.9
  }
}

// 드리프트 연기 추가
const addDriftSmoke = (side) => {
  const baseX = 180 + (side === 'left' ? -35 : 35)
  for (let i = 0; i < 3; i++) {
    driftSmoke.value.push({
      x: baseX + (Math.random() - 0.5) * 20,
      y: 440 + Math.random() * 20,
      vx: (Math.random() - 0.5) * 2 + (side === 'left' ? -1 : 1),
      vy: -Math.random() * 2,
      size: 8 + Math.random() * 15,
      life: 1,
      rotation: Math.random() * Math.PI * 2
    })
  }
}

// 드리프트 연기 렌더링
const renderDriftSmoke = (ctx) => {
  driftSmoke.value = driftSmoke.value.filter(p => {
    p.x += p.vx
    p.y += p.vy
    p.vy -= 0.05 // 위로 올라감
    p.life -= 0.03
    p.size *= 1.02
    p.rotation += 0.05

    if (p.life <= 0) return false

    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rotation)
    ctx.globalAlpha = p.life * 0.6

    // 연기 그라데이션
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size)
    gradient.addColorStop(0, 'rgba(200, 200, 200, 0.8)')
    gradient.addColorStop(0.5, 'rgba(150, 150, 150, 0.4)')
    gradient.addColorStop(1, 'rgba(100, 100, 100, 0)')

    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(0, 0, p.size, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
    ctx.globalAlpha = 1

    return true
  })
}

// 타이어 자국 추가
const addTireMarks = () => {
  if (tireMarks.value.length > 50) {
    tireMarks.value.shift()
  }
  tireMarks.value.push({
    z: playerZ.value,
    x: playerX.value,
    life: 1
  })
}

// 랩 완료 플래시
const triggerLapFlash = () => {
  lapFlash.value = 1
}

// 랩 플래시 렌더링
const renderLapFlash = (ctx, width, height) => {
  if (lapFlash.value > 0) {
    // 화면 플래시
    ctx.fillStyle = `rgba(255, 255, 255, ${lapFlash.value * 0.4})`
    ctx.fillRect(0, 0, width, height)

    // LAP COMPLETE 텍스트
    if (lapFlash.value > 0.5) {
      const textAlpha = (lapFlash.value - 0.5) * 2
      const scale = 1 + (1 - lapFlash.value) * 0.5

      ctx.save()
      ctx.translate(width / 2, height / 3)
      ctx.scale(scale, scale)

      // 텍스트 그림자
      ctx.font = 'bold 28px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = `rgba(0, 0, 0, ${textAlpha * 0.5})`
      ctx.fillText(`LAP ${currentLap.value}`, 2, 2)

      // 메인 텍스트
      ctx.fillStyle = `rgba(255, 220, 0, ${textAlpha})`
      ctx.strokeStyle = `rgba(255, 150, 0, ${textAlpha})`
      ctx.lineWidth = 2
      ctx.strokeText(`LAP ${currentLap.value}`, 0, 0)
      ctx.fillText(`LAP ${currentLap.value}`, 0, 0)

      // COMPLETE 텍스트
      ctx.font = 'bold 18px Arial'
      ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`
      ctx.fillText('COMPLETE!', 0, 30)

      ctx.restore()
    }

    lapFlash.value -= 0.03
  }
}

// 드리프트 체크 + 부스터 충전
const checkDrift = () => {
  const isTurning = controls.value.left || controls.value.right
  const isHighSpeed = playerSpeed.value > maxSpeed.value * 0.5

  if (isTurning && isHighSpeed) {
    isDrifting.value = true
    if (controls.value.left) {
      addDriftSmoke('left')
    }
    if (controls.value.right) {
      addDriftSmoke('right')
    }
    addTireMarks()

    // 드리프트 부스터 충전
    driftBoost.value = Math.min(100, driftBoost.value + 1.5)
    if (driftBoost.value >= 100 && !driftBoostReady.value) {
      driftBoostReady.value = true
    }
  } else {
    // 드리프트 끝나면 부스터 발동
    if (isDrifting.value && driftBoostReady.value) {
      activateDriftBoost()
    }
    isDrifting.value = false
    // 드리프트 안하면 천천히 감소
    if (!driftBoostReady.value) {
      driftBoost.value = Math.max(0, driftBoost.value - 0.5)
    }
  }
}

// 드리프트 부스터 발동
const activateDriftBoost = () => {
  effects.value.boost = true
  driftBoost.value = 0
  driftBoostReady.value = false
  setTimeout(() => {
    effects.value.boost = false
  }, 1500) // 1.5초 부스트
}

// ========== 아이템 박스 시스템 ==========

// 아이템 박스 생성 (트랙에 배치)
const generateItemBoxes = () => {
  itemBoxes.value = []
  const trackLength = track3D.value.length * ROAD.segmentLength

  // 트랙을 따라 일정 간격으로 아이템 박스 배치
  const boxInterval = trackLength / 8 // 8개 구간
  for (let i = 1; i < 8; i++) {
    // 각 구간에 3개의 아이템 박스 (좌, 중, 우)
    const baseZ = boxInterval * i
    itemBoxes.value.push(
      { z: baseZ, x: -0.4, collected: false, respawnTime: 0 },
      { z: baseZ, x: 0, collected: false, respawnTime: 0 },
      { z: baseZ, x: 0.4, collected: false, respawnTime: 0 }
    )
  }
}

// ========== 부스트 패드 시스템 ==========

// 부스트 패드 생성
const generateBoostPads = () => {
  boostPads.value = []
  const trackLength = track3D.value.length * ROAD.segmentLength

  // 긴 직선 구간에 부스트 패드 배치 (5개)
  const positions = [0.15, 0.35, 0.55, 0.75, 0.90]
  positions.forEach((pos, i) => {
    const z = trackLength * pos
    // 좌우 랜덤 위치
    const x = (i % 2 === 0) ? -0.3 : 0.3
    boostPads.value.push({ z, x, width: 0.25 })
  })
}

// 부스트 패드 충돌 체크
const checkBoostPadCollision = () => {
  const pZ = playerZ.value
  const pX = playerX.value
  const trackLength = track3D.value.length * ROAD.segmentLength

  for (const pad of boostPads.value) {
    let relativeZ = pZ - pad.z
    // 트랙 순환 처리
    if (relativeZ > trackLength / 2) relativeZ -= trackLength
    if (relativeZ < -trackLength / 2) relativeZ += trackLength

    const zDist = Math.abs(relativeZ)
    const xDist = Math.abs(pX - pad.x)

    if (zDist < 200 && xDist < pad.width) {
      // 부스트 패드 밟음!
      if (!effects.value.boost) {
        effects.value.boost = true
        setTimeout(() => effects.value.boost = false, 1000) // 1초 부스트
      }
    }
  }
}

// ========== 슬립스트림 시스템 ==========

// 슬립스트림 체크 (앞차 뒤에서 속도 보너스)
const checkSlipstream = () => {
  const pZ = playerZ.value
  const pX = playerX.value
  let inSlipstream = false

  for (const ai of aiCars3D.value) {
    if (ai.finished) continue

    // 앞에 있는 차량만 체크
    const zDiff = ai.z - pZ
    if (zDiff > 200 && zDiff < 1500) {
      // 좌우 정렬 체크 (같은 라인에 있어야 함)
      const xDiff = Math.abs(ai.offset - pX)
      if (xDiff < 0.25) {
        inSlipstream = true
        break
      }
    }
  }

  isSlipstreaming.value = inSlipstream

  if (inSlipstream) {
    // 슬립스트림 게이지 충전
    slipstream.value = Math.min(100, slipstream.value + 2)
    // 속도 보너스 (최대 10%)
    const bonus = (slipstream.value / 100) * 0.1
    playerSpeed.value = Math.min(maxSpeed.value * (1.1 + bonus), playerSpeed.value * (1 + bonus * 0.01))
  } else {
    // 슬립스트림 게이지 감소
    slipstream.value = Math.max(0, slipstream.value - 1)
  }
}

// ========== 차량 충돌 시스템 ==========

// 차량 간 충돌 체크
const checkCarCollision = () => {
  const pZ = playerZ.value
  const pX = playerX.value

  for (const ai of aiCars3D.value) {
    if (ai.finished || ai.stunTime > 0) continue

    const zDiff = Math.abs(ai.z - pZ)
    const xDiff = Math.abs(ai.offset - pX)

    // 충돌 범위
    if (zDiff < 300 && xDiff < 0.2) {
      // 충돌! 서로 밀려남
      const pushDirection = pX > ai.offset ? 1 : -1

      // 플레이어 밀려남
      playerX.value = Math.max(-0.8, Math.min(0.8, playerX.value + pushDirection * 0.1))
      playerSpeed.value *= 0.95 // 약간 감속

      // AI 밀려남
      ai.offset = Math.max(-0.6, Math.min(0.6, ai.offset - pushDirection * 0.1))
      ai.speed *= 0.95

      // 충돌 효과 (잠시 무적)
      ai.collisionCooldown = 30 // 0.5초 쿨다운
    }
  }
}

// ========== 순위 변동 알림 ==========

// 순위 변동 체크
const checkRankChange = () => {
  const currentRankVal = currentRank.value

  if (currentRankVal !== lastRank.value) {
    if (currentRankVal < lastRank.value) {
      // 순위 상승
      if (currentRankVal === 1) {
        rankChangeText.value = '🏆 1위!'
      } else {
        rankChangeText.value = `⬆️ ${currentRankVal}위로 상승!`
      }
    } else {
      // 순위 하락
      rankChangeText.value = `⬇️ ${currentRankVal}위로 하락...`
    }
    rankChangeTimer.value = 120 // 2초 표시
    lastRank.value = currentRankVal
  }

  // 타이머 감소
  if (rankChangeTimer.value > 0) {
    rankChangeTimer.value--
  }
}

// 아이템 박스 충돌 체크
const checkItemBoxCollision = () => {
  const pZ = playerZ.value
  const playerXPos = playerX.value

  for (const box of itemBoxes.value) {
    if (box.collected) {
      // 리스폰 체크
      if (box.respawnTime > 0) {
        box.respawnTime--
        if (box.respawnTime <= 0) {
          box.collected = false
        }
      }
      continue
    }

    // 충돌 범위
    const zDist = Math.abs(pZ - box.z)
    const xDist = Math.abs(playerXPos - box.x)

    if (zDist < 300 && xDist < 0.2) {
      // 아이템 획득!
      box.collected = true
      box.respawnTime = 300 // 5초 후 리스폰 (60fps * 5)

      if (!myItem.value) {
        // 순위에 따른 아이템 확률 조정
        const rank = currentRank.value
        myItem.value = getItemByRank(rank)
        // 획득 효과
        triggerItemGet()
      }
    }
  }
}

// 순위 기반 아이템 선택
const getItemByRank = (rank) => {
  const totalRacers = 4
  const isLeading = rank <= Math.ceil(totalRacers / 2)

  if (isLeading) {
    // 선두권: 방어/트랩 아이템 위주
    const items = [
      { ...ITEMS[0], weight: 2 }, // 부스터
      { ...ITEMS[1], weight: 4 }, // 바나나
      { ...ITEMS[3], weight: 3 }, // 쉴드
    ]
    return weightedRandom(items)
  } else {
    // 후발권: 공격/속도 아이템 위주
    const items = [
      { ...ITEMS[0], weight: 4 }, // 부스터
      { ...ITEMS[2], weight: 4 }, // 미사일
      { ...ITEMS[3], weight: 2 }, // 쉴드
    ]
    return weightedRandom(items)
  }
}

const weightedRandom = (items) => {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)
  let random = Math.random() * totalWeight
  for (const item of items) {
    random -= item.weight
    if (random <= 0) return item
  }
  return items[0]
}

// 아이템 획득 효과
const itemGetFlash = ref(0)
const triggerItemGet = () => {
  itemGetFlash.value = 1
}

// ========== 바나나/미사일 구현 ==========

// 바나나 설치
const placeBanana = () => {
  placedBananas.value.push({
    z: playerZ.value - 500, // 플레이어 뒤에 설치
    x: playerX.value,
    active: true
  })
}

// 미사일 발사
const fireMissile = () => {
  missiles.value.push({
    z: playerZ.value + 200,
    x: playerX.value,
    speed: 400,
    active: true,
    fromPlayer: true
  })
}

// 바나나 충돌 체크 (플레이어)
const checkBananaCollision = () => {
  if (effects.value.shield) return // 쉴드 있으면 무시

  for (const banana of placedBananas.value) {
    if (!banana.active) continue

    const zDist = Math.abs(playerZ.value - banana.z)
    const xDist = Math.abs(playerX.value - banana.x)

    if (zDist < 200 && xDist < 0.15) {
      // 바나나에 맞음!
      banana.active = false
      triggerSpin()
    }
  }
}

// 미사일 업데이트
const updateMissiles = () => {
  const trackLength = track3D.value.length * ROAD.segmentLength

  for (const missile of missiles.value) {
    if (!missile.active) continue

    missile.z += missile.speed

    // 트랙 순환
    if (missile.z >= trackLength) {
      missile.z -= trackLength
    }

    // AI와 충돌 체크
    if (missile.fromPlayer) {
      for (const ai of aiCars3D.value) {
        if (ai.finished) continue

        const zDist = Math.abs(missile.z - ai.z)
        const xDist = Math.abs(missile.x - ai.offset)

        if (zDist < 300 && xDist < 0.3) {
          // AI에게 명중!
          missile.active = false
          ai.speed *= 0.5 // 속도 감소
          ai.stunTime = 120 // 2초 스턴
        }
      }
    }

    // 일정 거리 후 소멸
    if (missile.z - playerZ.value > 5000) {
      missile.active = false
    }
  }

  // 비활성 미사일 제거
  missiles.value = missiles.value.filter(m => m.active)
  placedBananas.value = placedBananas.value.filter(b => b.active)
}

// AI 미사일이 플레이어에게 명중 체크
const checkPlayerMissileCollision = () => {
  if (effects.value.shield) return // 쉴드 있으면 무시

  for (const missile of missiles.value) {
    if (!missile.active || missile.fromPlayer) continue

    const zDist = Math.abs(playerZ.value - missile.z)
    const xDist = Math.abs(playerX.value - missile.x)

    if (zDist < 300 && xDist < 0.2) {
      // 미사일에 맞음!
      missile.active = false
      triggerSpin()
    }
  }
}

// 스핀 효과
const triggerSpin = () => {
  effects.value.spin = true
  playerSpeed.value *= 0.3
  setTimeout(() => {
    effects.value.spin = false
  }, 1500)
}

// ========== AI 아이템 시스템 ==========

const updateAIItems = () => {
  for (const ai of aiCars3D.value) {
    if (ai.finished) continue

    // 스턴 상태 처리
    if (ai.stunTime > 0) {
      ai.stunTime--
      continue
    }

    // 아이템 획득 체크
    for (const box of itemBoxes.value) {
      if (box.collected) continue

      const zDist = Math.abs(ai.z - box.z)
      const xDist = Math.abs(ai.offset - box.x)

      if (zDist < 300 && xDist < 0.3) {
        box.collected = true
        box.respawnTime = 300

        // AI 아이템 획득
        if (!ai.item) {
          ai.item = ITEMS[Math.floor(Math.random() * ITEMS.length)]
          ai.itemUseDelay = 60 + Math.random() * 120 // 1~3초 후 사용
        }
      }
    }

    // AI 아이템 사용
    if (ai.item && ai.itemUseDelay !== undefined) {
      ai.itemUseDelay--
      if (ai.itemUseDelay <= 0) {
        useAIItem(ai)
        ai.item = null
        ai.itemUseDelay = undefined
      }
    }
  }
}

// AI 아이템 사용
const useAIItem = (ai) => {
  if (!ai.item) return

  switch (ai.item.effect) {
    case 'speed':
      // 부스터: 속도 증가
      ai.speed *= 1.3
      setTimeout(() => {
        ai.speed /= 1.3
      }, 2000)
      break
    case 'trap':
      // 바나나 설치
      placedBananas.value.push({
        z: ai.z - 500,
        x: ai.offset,
        active: true
      })
      break
    case 'attack':
      // 미사일 발사 (플레이어 방향)
      if (ai.z < playerZ.value) {
        missiles.value.push({
          z: ai.z + 200,
          x: ai.offset,
          speed: 350,
          active: true,
          fromPlayer: false,
          targetPlayer: true
        })
      }
      break
    case 'defense':
      // 쉴드: AI에게 쉴드 부여
      ai.shield = true
      setTimeout(() => {
        ai.shield = false
      }, 5000)
      break
  }
}

// ========== 아이템/바나나/미사일 렌더링 ==========

const renderItemBoxes = (ctx, width, height, segments, pZ) => {
  const trackLength = segments.length * ROAD.segmentLength

  for (const box of itemBoxes.value) {
    if (box.collected) continue

    let boxZ = box.z
    let relativeZ = boxZ - pZ
    if (relativeZ < -trackLength / 2) relativeZ += trackLength
    if (relativeZ > trackLength / 2) relativeZ -= trackLength

    if (relativeZ < 100 || relativeZ > ROAD.segmentLength * CAMERA.drawDistance * 0.8) continue

    const segmentIndex = Math.floor(boxZ / ROAD.segmentLength) % segments.length
    const segment = segments[segmentIndex]
    if (!segment || !segment.p1.screen) continue

    const p = segment.p1.screen
    const scale = p.scale

    // 아이템 박스 위치
    const boxX = p.x + (box.x * p.w * 0.8)
    const boxY = p.y - 30 * scale
    const boxSize = Math.max(15, 40 * scale)

    if (boxY < 0 || boxY > height || boxSize < 5) continue

    // 물음표 박스 그리기 (카트라이더 스타일)
    const time = Date.now() * 0.005
    const bounce = Math.sin(time + box.z * 0.01) * 3

    ctx.save()
    ctx.translate(boxX, boxY + bounce)

    // 박스 그림자
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
    ctx.beginPath()
    ctx.ellipse(0, boxSize * 0.6, boxSize * 0.5, boxSize * 0.15, 0, 0, Math.PI * 2)
    ctx.fill()

    // 박스 본체 (3D 효과)
    const boxGrad = ctx.createLinearGradient(-boxSize/2, -boxSize/2, boxSize/2, boxSize/2)
    boxGrad.addColorStop(0, '#ffdd00')
    boxGrad.addColorStop(0.5, '#ff9900')
    boxGrad.addColorStop(1, '#ff6600')
    ctx.fillStyle = boxGrad
    ctx.fillRect(-boxSize/2, -boxSize/2, boxSize, boxSize)

    // 박스 테두리
    ctx.strokeStyle = '#cc5500'
    ctx.lineWidth = Math.max(1, boxSize * 0.08)
    ctx.strokeRect(-boxSize/2, -boxSize/2, boxSize, boxSize)

    // 물음표
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${boxSize * 0.7}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = '#000'
    ctx.shadowBlur = 3
    ctx.fillText('?', 0, 0)
    ctx.shadowBlur = 0

    // 반짝임 효과
    const sparkle = (Math.sin(time * 2 + box.z) + 1) * 0.5
    ctx.fillStyle = `rgba(255, 255, 255, ${sparkle * 0.5})`
    ctx.beginPath()
    ctx.arc(-boxSize * 0.25, -boxSize * 0.25, boxSize * 0.15, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }
}

const renderBananas = (ctx, width, height, segments, pZ) => {
  const trackLength = segments.length * ROAD.segmentLength

  for (const banana of placedBananas.value) {
    if (!banana.active) continue

    let relativeZ = banana.z - pZ
    if (relativeZ < -trackLength / 2) relativeZ += trackLength
    if (relativeZ > trackLength / 2) relativeZ -= trackLength

    if (relativeZ < 100 || relativeZ > ROAD.segmentLength * CAMERA.drawDistance * 0.8) continue

    const segmentIndex = Math.floor(banana.z / ROAD.segmentLength) % segments.length
    const segment = segments[segmentIndex]
    if (!segment || !segment.p1.screen) continue

    const p = segment.p1.screen
    const scale = p.scale

    const bananaX = p.x + (banana.x * p.w * 0.8)
    const bananaY = p.y - 5 * scale
    const bananaSize = Math.max(10, 25 * scale)

    if (bananaY < 0 || bananaY > height || bananaSize < 5) continue

    ctx.save()
    ctx.translate(bananaX, bananaY)

    // 바나나 그리기
    ctx.fillStyle = '#ffe135'
    ctx.strokeStyle = '#c4a000'
    ctx.lineWidth = Math.max(1, bananaSize * 0.1)

    // 바나나 모양 (곡선)
    ctx.beginPath()
    ctx.moveTo(-bananaSize * 0.4, bananaSize * 0.2)
    ctx.quadraticCurveTo(-bananaSize * 0.5, -bananaSize * 0.3, 0, -bananaSize * 0.4)
    ctx.quadraticCurveTo(bananaSize * 0.5, -bananaSize * 0.3, bananaSize * 0.4, bananaSize * 0.2)
    ctx.quadraticCurveTo(bananaSize * 0.2, bananaSize * 0.1, 0, bananaSize * 0.15)
    ctx.quadraticCurveTo(-bananaSize * 0.2, bananaSize * 0.1, -bananaSize * 0.4, bananaSize * 0.2)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // 바나나 끝 (검은 점)
    ctx.fillStyle = '#4a3000'
    ctx.beginPath()
    ctx.arc(bananaSize * 0.35, bananaSize * 0.15, bananaSize * 0.08, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(-bananaSize * 0.35, bananaSize * 0.15, bananaSize * 0.08, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }
}

const renderMissilesOnTrack = (ctx, width, height, segments, pZ) => {
  const trackLength = segments.length * ROAD.segmentLength

  for (const missile of missiles.value) {
    if (!missile.active) continue

    let relativeZ = missile.z - pZ
    if (relativeZ < -trackLength / 2) relativeZ += trackLength
    if (relativeZ > trackLength / 2) relativeZ -= trackLength

    if (relativeZ < 50 || relativeZ > ROAD.segmentLength * CAMERA.drawDistance) continue

    const segmentIndex = Math.floor(missile.z / ROAD.segmentLength) % segments.length
    const segment = segments[segmentIndex]
    if (!segment || !segment.p1.screen) continue

    const p = segment.p1.screen
    const scale = p.scale

    const missileX = p.x + (missile.x * p.w * 0.8)
    const missileY = p.y - 20 * scale
    const missileSize = Math.max(8, 20 * scale)

    if (missileY < 0 || missileY > height || missileSize < 4) continue

    ctx.save()
    ctx.translate(missileX, missileY)

    // 미사일 배기 화염
    const flameGrad = ctx.createLinearGradient(0, 0, 0, missileSize * 1.5)
    flameGrad.addColorStop(0, '#ff6600')
    flameGrad.addColorStop(0.5, '#ff3300')
    flameGrad.addColorStop(1, 'rgba(255, 100, 0, 0)')

    ctx.fillStyle = flameGrad
    ctx.beginPath()
    ctx.moveTo(-missileSize * 0.2, missileSize * 0.3)
    ctx.lineTo(0, missileSize + Math.random() * missileSize * 0.5)
    ctx.lineTo(missileSize * 0.2, missileSize * 0.3)
    ctx.closePath()
    ctx.fill()

    // 미사일 본체 (로켓 모양)
    ctx.fillStyle = missile.fromPlayer ? '#ff4444' : '#44ff44'
    ctx.beginPath()
    ctx.moveTo(0, -missileSize * 0.6)
    ctx.lineTo(missileSize * 0.3, missileSize * 0.3)
    ctx.lineTo(-missileSize * 0.3, missileSize * 0.3)
    ctx.closePath()
    ctx.fill()

    // 미사일 머리
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(0, -missileSize * 0.3, missileSize * 0.15, 0, Math.PI * 2)
    ctx.fill()

    // 날개
    ctx.fillStyle = '#888888'
    ctx.fillRect(-missileSize * 0.5, missileSize * 0.1, missileSize * 0.2, missileSize * 0.2)
    ctx.fillRect(missileSize * 0.3, missileSize * 0.1, missileSize * 0.2, missileSize * 0.2)

    ctx.restore()
  }
}

// 부스트 패드 렌더링
const renderBoostPads = (ctx, width, height, segments, pZ) => {
  const trackLength = segments.length * ROAD.segmentLength

  for (const pad of boostPads.value) {
    let relativeZ = pad.z - pZ
    if (relativeZ < -trackLength / 2) relativeZ += trackLength
    if (relativeZ > trackLength / 2) relativeZ -= trackLength

    if (relativeZ < 100 || relativeZ > ROAD.segmentLength * CAMERA.drawDistance * 0.8) continue

    const segmentIndex = Math.floor(pad.z / ROAD.segmentLength) % segments.length
    const segment = segments[segmentIndex]
    if (!segment || !segment.p1.screen) continue

    const p = segment.p1.screen
    const scale = p.scale

    const padX = p.x + (pad.x * p.w * 0.8)
    const padY = p.y
    const padW = Math.max(20, p.w * pad.width * 1.5)
    const padH = Math.max(5, 15 * scale)

    if (padY < 0 || padY > height || padW < 10) continue

    // 부스트 패드 그리기 (화살표 패턴)
    const time = Date.now() * 0.01
    const pulse = Math.sin(time) * 0.3 + 0.7

    ctx.save()

    // 패드 배경
    const padGrad = ctx.createLinearGradient(padX - padW/2, padY, padX + padW/2, padY)
    padGrad.addColorStop(0, `rgba(255, 100, 0, ${pulse * 0.8})`)
    padGrad.addColorStop(0.5, `rgba(255, 200, 0, ${pulse})`)
    padGrad.addColorStop(1, `rgba(255, 100, 0, ${pulse * 0.8})`)
    ctx.fillStyle = padGrad
    ctx.fillRect(padX - padW/2, padY - padH/2, padW, padH)

    // 화살표 패턴
    ctx.fillStyle = `rgba(255, 255, 255, ${pulse * 0.9})`
    const arrowCount = Math.max(2, Math.floor(padW / 15))
    const arrowSpacing = padW / (arrowCount + 1)
    for (let i = 1; i <= arrowCount; i++) {
      const ax = padX - padW/2 + arrowSpacing * i
      const arrowSize = padH * 0.4
      ctx.beginPath()
      ctx.moveTo(ax, padY - arrowSize)
      ctx.lineTo(ax + arrowSize * 0.6, padY)
      ctx.lineTo(ax, padY + arrowSize)
      ctx.lineTo(ax - arrowSize * 0.6, padY)
      ctx.closePath()
      ctx.fill()
    }

    // 테두리 글로우
    ctx.strokeStyle = `rgba(255, 200, 0, ${pulse})`
    ctx.lineWidth = Math.max(1, 2 * scale)
    ctx.shadowColor = '#ff6600'
    ctx.shadowBlur = 10
    ctx.strokeRect(padX - padW/2, padY - padH/2, padW, padH)
    ctx.shadowBlur = 0

    ctx.restore()
  }
}

// 슬립스트림 효과 렌더링 (플레이어 차량 주변)
const renderSlipstreamEffect = (ctx, width, height) => {
  if (!isSlipstreaming.value || slipstream.value < 10) return

  const intensity = slipstream.value / 100
  const playerY = height - 70

  ctx.save()

  // 공기 흐름 라인
  ctx.strokeStyle = `rgba(100, 200, 255, ${intensity * 0.5})`
  ctx.lineWidth = 2

  for (let i = 0; i < 5; i++) {
    const offset = (Date.now() * 0.01 + i * 20) % 100
    const startY = playerY - 100 - offset
    const lineLength = 30 + intensity * 20

    ctx.beginPath()
    ctx.moveTo(width/2 - 30 + i * 15, startY)
    ctx.lineTo(width/2 - 30 + i * 15, startY + lineLength)
    ctx.stroke()
  }

  // SLIPSTREAM 텍스트
  if (slipstream.value > 50) {
    ctx.font = 'bold 16px Arial'
    ctx.fillStyle = `rgba(100, 200, 255, ${intensity})`
    ctx.textAlign = 'center'
    ctx.shadowColor = '#00aaff'
    ctx.shadowBlur = 10
    ctx.fillText('SLIPSTREAM', width/2, height - 140)
    ctx.shadowBlur = 0
  }

  ctx.restore()
}

const render3D = () => {
  const canvas = canvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  const width = canvas.width
  const height = canvas.height

  // 카메라 흔들림 적용
  updateCameraShake()
  ctx.save()
  ctx.translate(cameraShake.value.x, cameraShake.value.y)

  // 하늘 배경 (더 풍부한 그라데이션)
  const skyGradient = ctx.createLinearGradient(0, 0, 0, height / 2)
  skyGradient.addColorStop(0, '#4a90d9')
  skyGradient.addColorStop(0.3, '#87CEEB')
  skyGradient.addColorStop(0.7, '#b8e0f6')
  skyGradient.addColorStop(1, '#e8f4f8')
  ctx.fillStyle = skyGradient
  ctx.fillRect(0, 0, width, height / 2)

  // 태양
  ctx.fillStyle = '#fff5cc'
  ctx.shadowColor = '#ffdd00'
  ctx.shadowBlur = 30
  ctx.beginPath()
  ctx.arc(width * 0.8, 50, 25, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  // 패럴랙스 구름
  renderClouds(ctx, width, playerSpeed.value)

  // 먼 산 (패럴랙스)
  const mountainOffset = (playerX.value * 20) % width
  ctx.fillStyle = '#6b8e7d'
  ctx.beginPath()
  ctx.moveTo(-50 - mountainOffset * 0.3, height / 2)
  for (let i = 0; i < 5; i++) {
    const x = i * 100 - mountainOffset * 0.3
    ctx.lineTo(x + 50, height / 2 - 40 - Math.sin(i * 1.5) * 20)
  }
  ctx.lineTo(width + 50, height / 2)
  ctx.closePath()
  ctx.fill()

  // 가까운 산
  ctx.fillStyle = '#5a7d6d'
  ctx.beginPath()
  ctx.moveTo(-50 - mountainOffset * 0.5, height / 2)
  for (let i = 0; i < 6; i++) {
    const x = i * 80 - mountainOffset * 0.5
    ctx.lineTo(x + 40, height / 2 - 25 - Math.cos(i * 2) * 15)
  }
  ctx.lineTo(width + 50, height / 2)
  ctx.closePath()
  ctx.fill()

  // 기본 풀밭 (그라데이션)
  const grassGradient = ctx.createLinearGradient(0, height / 2, 0, height)
  grassGradient.addColorStop(0, '#228b22')
  grassGradient.addColorStop(0.5, '#1e7b1e')
  grassGradient.addColorStop(1, '#165816')
  ctx.fillStyle = grassGradient
  ctx.fillRect(0, height / 2, width, height / 2)

  const segments = track3D.value
  if (!segments.length) return

  const baseSegment = Math.floor(playerZ.value / ROAD.segmentLength) % segments.length
  const basePercent = (playerZ.value % ROAD.segmentLength) / ROAD.segmentLength

  let maxY = height
  let x = 0
  let dx = 0

  // 카메라 위치
  const cameraHeight = CAMERA.height
  const cameraDepth = CAMERA.depth

  // 세그먼트 렌더링 (뒤에서 앞으로)
  for (let n = 0; n < CAMERA.drawDistance; n++) {
    const index = (baseSegment + n) % segments.length
    const segment = segments[index]
    const looped = index < baseSegment

    // 월드 좌표 계산
    segment.p1.world.x = x
    segment.p1.world.y = segment.hill
    segment.p1.world.z = (n - basePercent) * ROAD.segmentLength

    segment.p2.world.x = x + dx
    segment.p2.world.y = segments[(index + 1) % segments.length].hill
    segment.p2.world.z = (n + 1 - basePercent) * ROAD.segmentLength

    x += dx
    dx += segment.curve

    // 카메라 뒤는 스킵
    if (segment.p1.world.z <= 0) continue

    // 프로젝션
    project(segment.p1, playerX.value * ROAD.width, cameraHeight, 0, cameraDepth, width, height, ROAD.width)
    project(segment.p2, playerX.value * ROAD.width, cameraHeight, 0, cameraDepth, width, height, ROAD.width)

    // 클리핑
    if (segment.p1.screen.y >= maxY) continue
    if (segment.p2.screen.y >= segment.p1.screen.y) continue

    renderSegment(ctx, width, height, segment, maxY)

    // 스프라이트 렌더링
    for (const sprite of segment.sprites) {
      renderSprite(ctx, width, height, sprite, segment, 0, maxY)
    }

    maxY = segment.p2.screen.y
  }

  // 아이템 박스 렌더링
  renderItemBoxes(ctx, width, height, segments, playerZ.value)

  // 부스트 패드 렌더링
  renderBoostPads(ctx, width, height, segments, playerZ.value)

  // 바나나 렌더링
  renderBananas(ctx, width, height, segments, playerZ.value)

  // 미사일 렌더링
  renderMissilesOnTrack(ctx, width, height, segments, playerZ.value)

  // AI 차량 렌더링
  for (const car of aiCars3D.value) {
    const carZ = car.z
    const relativeZ = carZ - playerZ.value

    if (relativeZ < 0 || relativeZ > ROAD.segmentLength * CAMERA.drawDistance) continue

    const segmentIndex = Math.floor(carZ / ROAD.segmentLength) % segments.length
    const segment = segments[segmentIndex]

    if (segment.p1.screen.y < maxY) {
      renderCar(ctx, width, height, car, segment)
    }
  }

  // 스피드 라인 효과
  renderSpeedLines(ctx, width, height, playerSpeed.value)

  // 플레이어 차량 (화면 하단 중앙)
  const playerCarData = CARS.find(c => c.id === selectedCar.value)
  if (playerCarData) {
    // 좌우 기울기 효과
    const tilt = controls.value.left ? -0.15 : (controls.value.right ? 0.15 : 0)

    ctx.save()
    ctx.translate(width / 2, height - 70)
    ctx.rotate(tilt)

    // 부스트 시 화염 효과
    if (effects.value.boost) {
      addBoostParticles()

      // 배기 화염
      const flameGradient = ctx.createLinearGradient(0, 20, 0, 60)
      flameGradient.addColorStop(0, '#ff6600')
      flameGradient.addColorStop(0.5, '#ff3300')
      flameGradient.addColorStop(1, 'rgba(255, 0, 0, 0)')

      ctx.fillStyle = flameGradient
      ctx.beginPath()
      ctx.moveTo(-25, 25)
      ctx.lineTo(-35, 50 + Math.random() * 15)
      ctx.lineTo(-15, 35)
      ctx.closePath()
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(25, 25)
      ctx.lineTo(35, 50 + Math.random() * 15)
      ctx.lineTo(15, 35)
      ctx.closePath()
      ctx.fill()
    }

    // 차량 그리기
    drawCarShape(ctx, 0, 0, 80, playerCarData, true)

    ctx.restore()

    // 쉴드 효과
    if (effects.value.shield) {
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)'
      ctx.lineWidth = 4
      ctx.shadowColor = '#00ffff'
      ctx.shadowBlur = 20
      ctx.beginPath()
      ctx.arc(width / 2, height - 70, 55, 0, Math.PI * 2)
      ctx.stroke()
      ctx.shadowBlur = 0
    }
  }

  // 부스트 파티클 렌더링
  renderBoostParticles(ctx)

  // 드리프트 연기 렌더링
  renderDriftSmoke(ctx)

  // 슬립스트림 효과 렌더링
  renderSlipstreamEffect(ctx, width, height)

  // 랩 완료 플래시
  renderLapFlash(ctx, width, height)

  // 속도에 따른 비네팅 효과
  const speedRatio = playerSpeed.value / maxSpeed.value
  if (speedRatio > 0.7) {
    const vignetteIntensity = (speedRatio - 0.7) / 0.3 * 0.4
    const vignette = ctx.createRadialGradient(width/2, height/2, height * 0.3, width/2, height/2, height * 0.8)
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)')
    vignette.addColorStop(1, `rgba(0, 0, 0, ${vignetteIntensity})`)
    ctx.fillStyle = vignette
    ctx.fillRect(0, 0, width, height)
  }

  // 아이템 획득 플래시
  if (itemGetFlash.value > 0) {
    ctx.fillStyle = `rgba(255, 200, 0, ${itemGetFlash.value * 0.3})`
    ctx.fillRect(0, 0, width, height)
    itemGetFlash.value = Math.max(0, itemGetFlash.value - 0.05)
  }

  // 스핀 상태 오버레이
  if (effects.value.spin) {
    // 빨간 깜빡임
    const spinFlash = Math.sin(Date.now() * 0.02) * 0.5 + 0.5
    ctx.fillStyle = `rgba(255, 0, 0, ${spinFlash * 0.3})`
    ctx.fillRect(0, 0, width, height)

    // 회전 효과 텍스트
    ctx.save()
    ctx.translate(width / 2, height / 2)
    ctx.rotate(Date.now() * 0.01)
    ctx.font = 'bold 60px Arial'
    ctx.fillStyle = '#ff0000'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = '#000'
    ctx.shadowBlur = 10
    ctx.fillText('SPIN!', 0, 0)
    ctx.restore()
  }

  ctx.restore() // 카메라 흔들림 복원
}

// ========== 게임 로직 ==========
const initGame = async () => {
  if (isMultiplayer.value) {
    setupMultiplayerListeners()
  }
  gamePhase.value = 'carSelect'
}

const setupMultiplayerListeners = () => {
  // 기존 멀티플레이어 로직 유지
}

const startGame = async () => {
  if (!isHost.value) return

  gamePhase.value = 'countdown'
  miniTurboCharge.value = 0
  miniTurboReady.value = false

  for (let i = 3; i >= 0; i--) {
    countdown.value = i
    if (i > 0) await sleep(1000)
  }

  gamePhase.value = 'racing'

  // 미니터보 판정 - GO! 순간에 충전이 70-100% 사이면 성공
  const charge = miniTurboCharge.value
  const miniTurboSuccess = charge >= 70 && charge <= 100

  if (viewMode.value === '3d') {
    start3DRacing()
    // 미니터보 성공 시 출발 부스트
    if (miniTurboSuccess) {
      effects.value.boost = true
      setTimeout(() => effects.value.boost = false, 1500)
      rankChangeText.value = '🚀 미니 터보!'
      rankChangeTimer.value = 90
    }
  } else {
    startTopDownRacing()
  }
}

// 미니터보 충전 (카운트다운 중 스페이스바/터치)
const chargeMiniTurbo = () => {
  if (gamePhase.value !== 'countdown') return

  // 충전 증가
  miniTurboCharge.value = Math.min(100, miniTurboCharge.value + 5)

  // 과충전 체크 (100 넘으면 실패로 리셋)
  if (miniTurboCharge.value >= 100) {
    setTimeout(() => {
      if (gamePhase.value === 'countdown') {
        miniTurboCharge.value = 0 // 과충전 실패
      }
    }, 200)
  }
}

const start3DRacing = () => {
  // 트랙 생성
  track3D.value = generate3DTrack()

  // 미니맵용 트랙 경로 계산
  trackPath.value = calculateTrackPath(track3D.value)

  // 시각 효과 초기화
  initClouds()
  boostParticles.value = []
  speedLines.value = []
  driftBoost.value = 0
  driftBoostReady.value = false

  // 게임플레이 초기화
  generateItemBoxes()
  generateBoostPads()
  placedBananas.value = []
  missiles.value = []

  // 2순위 게임플레이 초기화
  slipstream.value = 0
  isSlipstreaming.value = false
  lastRank.value = 4 // 시작 순위
  rankChangeText.value = ''
  rankChangeTimer.value = 0

  // 플레이어 초기화
  playerX.value = 0
  playerZ.value = 0
  playerSpeed.value = 0
  currentLap.value = 0
  myFinished.value = false
  finishOrder.value = []

  const car = CARS.find(c => c.id === selectedCar.value)
  maxSpeed.value = 150 + car.speed * 15
  accel.value = car.acceleration * 0.5

  // AI 차량 생성
  const aiCarsList = CARS.filter(c => c.id !== selectedCar.value).slice(0, 3)
  aiCars3D.value = aiCarsList.map((car, i) => ({
    id: `ai_${i}`,
    name: `AI ${car.name}`,
    carId: car.id,
    z: 500 + i * 300,
    offset: (i - 1) * 0.3,
    speed: 100 + car.speed * 12 + Math.random() * 30,
    baseSpeed: 100 + car.speed * 12 + Math.random() * 30,
    lap: 0,
    finished: false,
    luck: 0.85 + Math.random() * 0.3,
    // 아이템 시스템용 속성
    item: null,
    itemUseDelay: undefined,
    stunTime: 0,
    shield: false
  }))

  const startTime = Date.now()

  gameLoop = setInterval(() => {
    if (gamePhase.value !== 'racing') {
      clearInterval(gameLoop)
      return
    }

    raceTime.value = Date.now() - startTime
    update3DGame()
    render3D()
    renderMinimap()
  }, 1000 / 60)
}

const update3DGame = () => {
  if (myFinished.value) return

  const car = CARS.find(c => c.id === selectedCar.value)
  const handling = car.handling * 0.0003

  // 속도 조절
  const speedMult = effects.value.boost ? 1.5 : 1
  const targetSpeed = (controls.value.accelerate || isAutoMode.value) ? maxSpeed.value * speedMult : 0

  if (playerSpeed.value < targetSpeed) {
    playerSpeed.value = Math.min(playerSpeed.value + accel.value, targetSpeed)
  } else {
    playerSpeed.value = Math.max(playerSpeed.value - accel.value * 2, targetSpeed)
  }

  // 스핀 상태
  if (effects.value.spin) {
    playerSpeed.value = Math.max(0, playerSpeed.value - 5)
    playerX.value += (Math.random() - 0.5) * 0.1
  }

  // 좌우 이동
  if (controls.value.left) {
    playerX.value = Math.max(-0.8, playerX.value - handling * (playerSpeed.value / maxSpeed.value))
  }
  if (controls.value.right) {
    playerX.value = Math.min(0.8, playerX.value + handling * (playerSpeed.value / maxSpeed.value))
  }

  // 커브에서 자동으로 밀려남
  const segmentIndex = Math.floor(playerZ.value / ROAD.segmentLength) % track3D.value.length
  const segment = track3D.value[segmentIndex]
  if (segment) {
    const centrifugal = segment.curve * playerSpeed.value / maxSpeed.value * 0.003
    playerX.value += centrifugal
    playerX.value = Math.max(-0.8, Math.min(0.8, playerX.value))
  }

  // 도로 이탈 감속
  if (Math.abs(playerX.value) > 0.7) {
    playerSpeed.value *= 0.98
  }

  // 전진
  playerZ.value += playerSpeed.value

  // 드리프트 체크
  checkDrift()

  // 랩 체크
  const trackLength = track3D.value.length * ROAD.segmentLength
  if (playerZ.value >= trackLength) {
    playerZ.value -= trackLength
    currentLap.value++
    triggerLapFlash() // 랩 완료 플래시

    if (currentLap.value >= totalLaps.value) {
      finishRace('player')
    }
  }

  // AI 업데이트
  updateAI3D()

  // 아이템 시스템 업데이트
  checkItemBoxCollision()
  checkBananaCollision()
  checkPlayerMissileCollision() // AI 미사일 피격
  updateMissiles()
  updateAIItems()

  // 2순위 게임플레이 시스템
  checkBoostPadCollision()
  checkSlipstream()
  checkCarCollision()
  checkRankChange()
}

const updateAI3D = () => {
  const trackLength = track3D.value.length * ROAD.segmentLength

  for (const ai of aiCars3D.value) {
    if (ai.finished) continue

    // 스턴 상태 처리
    if (ai.stunTime > 0) {
      ai.stunTime--
      // 스턴 중에는 느리게 이동
      ai.z += ai.speed * 0.2
      // 스턴 끝나면 속도 복구
      if (ai.stunTime <= 0 && ai.baseSpeed) {
        ai.speed = ai.baseSpeed
      }
      continue
    }

    // AI 속도 변동
    const speedVar = 0.95 + Math.random() * 0.1
    ai.z += ai.speed * ai.luck * speedVar

    // 바나나 충돌 체크
    for (const banana of placedBananas.value) {
      if (!banana.active) continue
      const zDist = Math.abs(ai.z - banana.z)
      const xDist = Math.abs(ai.offset - banana.x)
      if (zDist < 200 && xDist < 0.2 && !ai.shield) {
        banana.active = false
        ai.stunTime = 90 // 1.5초 스턴
        ai.speed *= 0.3
      }
    }

    // 좌우 움직임
    ai.offset += (Math.random() - 0.5) * 0.02
    ai.offset = Math.max(-0.6, Math.min(0.6, ai.offset))

    // 랩 체크
    if (ai.z >= trackLength) {
      ai.z -= trackLength
      ai.lap++

      if (ai.lap >= totalLaps.value) {
        ai.finished = true
        finishOrder.value.push(ai.id)
      }
    }
  }
}

// ========== 탑뷰 모드 (기존 코드) ==========
const startTopDownRacing = () => {
  const startTime = Date.now()
  const aiCars = CARS.filter(c => c.id !== selectedCar.value).slice(0, 3)

  racers.value = [
    {
      id: 'player',
      name: '나',
      car: selectedCar.value,
      progress: 0,
      offset: 0,
      lap: 0,
      speed: 0,
      isPlayer: true,
      finished: false
    },
    ...aiCars.map((car, i) => ({
      id: `ai_${i}`,
      name: `AI ${car.name}`,
      car: car.id,
      progress: 0,
      offset: (i - 1) * 15,
      lap: 0,
      speed: 0,
      isAI: true,
      finished: false,
      luck: 0.75 + Math.random() * 0.5,
      mistakeChance: (10 - car.handling) * 0.003
    }))
  ]

  myPosition.value = { progress: 0, offset: 0 }
  myLap.value = 0
  mySpeed.value = 0
  myFinished.value = false
  finishOrder.value = []

  gameLoop = setInterval(() => {
    if (gamePhase.value !== 'racing') {
      clearInterval(gameLoop)
      return
    }

    raceTime.value = Date.now() - startTime
    updateTopDownGame()
  }, 1000 / 60)
}

const updateTopDownGame = () => {
  if (myFinished.value) return

  const car = CARS.find(c => c.id === selectedCar.value)
  if (!car) return

  if (effects.value.spin) {
    mySpeed.value = Math.max(0, mySpeed.value - 0.002)
    return
  }

  const baseSpeed = car.speed * 0.0004
  const accelVal = car.acceleration * 0.00002
  const handling = car.handling * 0.3
  const speedMultiplier = effects.value.boost ? 1.8 : 1

  if (controls.value.accelerate || isAutoMode.value) {
    mySpeed.value = Math.min(mySpeed.value + accelVal, baseSpeed * speedMultiplier)
  } else {
    mySpeed.value = Math.max(mySpeed.value - accelVal * 2, 0)
  }

  if (controls.value.left) {
    myPosition.value.offset = Math.max(-30, myPosition.value.offset - handling * 0.05)
  }
  if (controls.value.right) {
    myPosition.value.offset = Math.min(30, myPosition.value.offset + handling * 0.05)
  }

  myPosition.value.progress += mySpeed.value

  if (myPosition.value.progress >= 1) {
    myPosition.value.progress -= 1
    myLap.value++

    if (myLap.value >= totalLaps.value) {
      finishRace('player')
    }
  }

  updateTopDownRacersList()
}

const updateTopDownRacersList = () => {
  const myRacer = racers.value.find(r => r.id === 'player')
  if (myRacer) {
    myRacer.progress = myPosition.value.progress
    myRacer.offset = myPosition.value.offset
    myRacer.lap = myLap.value
    myRacer.speed = mySpeed.value
    myRacer.coords = getPositionCoords(myPosition.value.progress, myPosition.value.offset)
  }

  racers.value.filter(r => r.isAI && !r.finished).forEach(ai => {
    const car = CARS.find(c => c.id === ai.car)
    const baseSpeed = 0.0028
    const speedBonus = 1 + (car.speed - 7) * 0.025
    const accelBonus = ai.lap === 0 && ai.progress < 0.3 ? (car.acceleration / 10) : 1
    let handlingPenalty = 1
    if (Math.random() < ai.mistakeChance) handlingPenalty = 0.3
    const frameRandom = 0.9 + Math.random() * 0.2
    const aiSpeed = baseSpeed * speedBonus * accelBonus * handlingPenalty * ai.luck * frameRandom

    ai.progress += aiSpeed
    ai.offset += (Math.random() - 0.5) * 0.5

    if (ai.progress >= 1) {
      ai.progress -= 1
      ai.lap++
      if (ai.lap >= totalLaps.value) {
        ai.finished = true
        finishOrder.value.push(ai.id)
      }
    }

    ai.coords = getPositionCoords(ai.progress, ai.offset)
  })
}

const getPositionCoords = (progress, offset = 0) => {
  const angle = progress * Math.PI * 2 - Math.PI / 2
  const x = TRACK_TOPDOWN.centerX + Math.cos(angle) * (TRACK_TOPDOWN.radiusX + offset)
  const y = TRACK_TOPDOWN.centerY + Math.sin(angle) * (TRACK_TOPDOWN.radiusY + offset)
  const rotation = (progress * 360 + 90) % 360
  return { x, y, rotation }
}

// ========== 공통 함수들 ==========
const finishRace = (id) => {
  if (id === 'player') {
    myFinished.value = true
  }
  if (!finishOrder.value.includes(id)) {
    finishOrder.value.push(id)
  }

  setTimeout(checkAllFinished, 1000)
}

const checkAllFinished = () => {
  const allRacers = viewMode.value === '3d' ? aiCars3D.value : racers.value.filter(r => r.isAI)
  const allFinished = allRacers.every(r => r.finished) || finishOrder.value.length >= allRacers.length + 1

  if (allFinished || myFinished.value) {
    gamePhase.value = 'result'
    if (gameLoop) clearInterval(gameLoop)
  }
}

const useItem = async () => {
  if (!myItem.value) return

  // 드리프트 부스트가 준비되었으면 먼저 발동
  if (driftBoostReady.value) {
    activateDriftBoost()
    return
  }

  const item = myItem.value

  switch (item.effect) {
    case 'speed':
      effects.value.boost = true
      setTimeout(() => effects.value.boost = false, item.duration)
      break
    case 'defense':
      effects.value.shield = true
      setTimeout(() => effects.value.shield = false, item.duration)
      break
    case 'trap':
      placeBanana()
      break
    case 'attack':
      fireMissile()
      break
  }

  myItem.value = null
}

const selectCarAndReady = async (carId) => {
  selectedCar.value = carId
}

// 차량 선택 화면용 미리보기 렌더링
const renderCarPreview = (canvas, carData) => {
  if (!canvas || !carData) return
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height

  ctx.clearRect(0, 0, w, h)

  // 배경 그라데이션
  const bg = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w/2)
  bg.addColorStop(0, 'rgba(255, 255, 255, 0.1)')
  bg.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  // 차량 그리기
  drawCarShape(ctx, w/2, h/2 + 10, 60, carData, false)
}

// 차량 미리보기 업데이트
const updateCarPreviews = () => {
  nextTick(() => {
    CARS.forEach(car => {
      const canvas = document.getElementById(`car-preview-${car.id}`)
      if (canvas) {
        renderCarPreview(canvas, car)
      }
    })
  })
}

const handleKeyDown = (e) => {
  // 카운트다운 중 미니터보 충전
  if (gamePhase.value === 'countdown') {
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') {
      chargeMiniTurbo()
    }
    return
  }

  if (gamePhase.value !== 'racing') return

  switch (e.key) {
    case 'ArrowLeft':
    case 'a':
      controls.value.left = true
      break
    case 'ArrowRight':
    case 'd':
      controls.value.right = true
      break
    case 'ArrowUp':
    case 'w':
      controls.value.accelerate = true
      break
    case ' ':
      useItem()
      break
  }
}

const handleKeyUp = (e) => {
  switch (e.key) {
    case 'ArrowLeft':
    case 'a':
      controls.value.left = false
      break
    case 'ArrowRight':
    case 'd':
      controls.value.right = false
      break
    case 'ArrowUp':
    case 'w':
      if (!isAutoMode.value) controls.value.accelerate = false
      break
  }
}

const touchLeft = (pressed) => { controls.value.left = pressed }
const touchRight = (pressed) => { controls.value.right = pressed }

const getResultData = computed(() => {
  const allRacers = viewMode.value === '3d'
    ? [{ id: 'player', name: '나', car: selectedCar.value }, ...aiCars3D.value.map(ai => ({ id: ai.id, name: ai.name, car: ai.carId }))]
    : racers.value.map(r => ({ id: r.id, name: r.name, car: r.car }))

  return finishOrder.value.map((id, index) => {
    const racer = allRacers.find(r => r.id === id)
    const carData = CARS.find(c => c.id === racer?.car)
    return { rank: index + 1, ...racer, carData }
  })
})

const currentRank = computed(() => {
  if (viewMode.value === '3d') {
    const ahead = aiCars3D.value.filter(ai => !ai.finished && ai.z > playerZ.value).length
    return ahead + finishOrder.value.length + 1
  } else {
    const sorted = [...racers.value].filter(r => !r.finished).sort((a, b) => {
      if (a.lap !== b.lap) return b.lap - a.lap
      return b.progress - a.progress
    })
    const myIndex = sorted.findIndex(r => r.id === 'player')
    return myIndex + finishOrder.value.length + 1
  }
})

const restartGame = () => {
  gamePhase.value = 'carSelect'
  selectedCar.value = null
  finishOrder.value = []
  myFinished.value = false
  playerZ.value = 0
  playerX.value = 0
  playerSpeed.value = 0
  currentLap.value = 0
  myPosition.value = { progress: 0, offset: 0 }
  myLap.value = 0
  aiCars3D.value = []
  racers.value = []
}

const exitGame = async () => {
  if (gameLoop) clearInterval(gameLoop)
  if (isMultiplayer.value && isHost.value) {
    await globalRoom.endGame()
  }
  emit('go-back')
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const formatTime = (ms) => {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  const millis = Math.floor((ms % 1000) / 10)
  return `${minutes}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(2, '0')}`
}

// gamePhase 변경 감지하여 차량 미리보기 업데이트
watch(gamePhase, (newPhase) => {
  if (newPhase === 'carSelect') {
    updateCarPreviews()
  }
})

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  initGame()
  updateCarPreviews()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  if (gameLoop) clearInterval(gameLoop)
  unsubscribers.forEach(u => { try { u() } catch(e) {} })
})
</script>

<template>
  <div class="racing-game">
    <h2 class="game-title">Racing</h2>

    <!-- 차량 선택 -->
    <div v-if="gamePhase === 'carSelect'" class="car-select">
      <!-- 뷰 모드 선택 -->
      <div class="view-mode-select">
        <button
          class="view-btn"
          :class="{ active: viewMode === '3d' }"
          @click="viewMode = '3d'"
        >
          3D 모드
        </button>
        <button
          class="view-btn"
          :class="{ active: viewMode === 'topdown' }"
          @click="viewMode = 'topdown'"
        >
          탑뷰 모드
        </button>
      </div>

      <h3>차량 선택</h3>
      <div class="cars-grid">
        <div
          v-for="car in CARS"
          :key="car.id"
          class="car-card"
          :class="{ selected: selectedCar === car.id }"
          :style="{ '--car-color': car.color }"
          @click="selectCarAndReady(car.id)"
        >
          <canvas
            :id="`car-preview-${car.id}`"
            width="100"
            height="70"
            class="car-preview-canvas"
          ></canvas>
          <div class="car-name">{{ car.name }}</div>
          <div class="car-stats">
            <div class="stat">
              <span class="stat-label">속도</span>
              <div class="stat-bar">
                <div class="stat-fill speed" :style="{ width: car.speed * 10 + '%' }"></div>
              </div>
            </div>
            <div class="stat">
              <span class="stat-label">핸들링</span>
              <div class="stat-bar">
                <div class="stat-fill handling" :style="{ width: car.handling * 10 + '%' }"></div>
              </div>
            </div>
            <div class="stat">
              <span class="stat-label">가속</span>
              <div class="stat-bar">
                <div class="stat-fill accel" :style="{ width: car.acceleration * 10 + '%' }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="selectedCar" class="mode-select">
        <label class="mode-option">
          <input type="radio" v-model="isAutoMode" :value="true" />
          자동 (방향키만 조작)
        </label>
        <label class="mode-option">
          <input type="radio" v-model="isAutoMode" :value="false" />
          수동 (가속도 조작)
        </label>
      </div>

      <button
        v-if="selectedCar && isHost"
        class="btn start-btn"
        @click="startGame"
      >
        게임 시작
      </button>
    </div>

    <!-- 카운트다운 -->
    <div v-if="gamePhase === 'countdown'" class="countdown-screen">
      <div class="countdown-number">{{ countdown || 'GO!' }}</div>

      <!-- 미니터보 게이지 -->
      <div class="mini-turbo-section">
        <div class="mini-turbo-hint">Space/↑ 연타로 충전!</div>
        <div class="mini-turbo-meter">
          <div
            class="mini-turbo-fill"
            :class="{
              'charging': miniTurboCharge > 0 && miniTurboCharge < 70,
              'ready': miniTurboCharge >= 70 && miniTurboCharge < 100,
              'overcharge': miniTurboCharge >= 100
            }"
            :style="{ width: miniTurboCharge + '%' }"
          ></div>
          <div class="mini-turbo-zone" style="left: 70%; width: 30%;"></div>
        </div>
        <div class="mini-turbo-status">
          <span v-if="miniTurboCharge < 70">충전 중...</span>
          <span v-else-if="miniTurboCharge < 100" class="ready-text">READY!</span>
          <span v-else class="fail-text">과충전!</span>
        </div>
      </div>
    </div>

    <!-- 3D 레이싱 -->
    <div v-if="gamePhase === 'racing' && viewMode === '3d'" class="racing-screen-3d">
      <canvas
        ref="canvasRef"
        width="360"
        height="480"
        class="game-canvas"
      ></canvas>

      <!-- 미니맵 -->
      <canvas
        ref="minimapRef"
        width="120"
        height="120"
        class="minimap"
      ></canvas>

      <!-- 아이템 슬롯 -->
      <div class="item-slot-3d" @click="useItem">
        <div v-if="myItem" class="item-icon">{{ myItem.emoji }}</div>
        <div v-else class="item-empty">?</div>
      </div>

      <!-- HUD 패널 -->
      <div class="hud-3d">
        <div class="hud-3d-item rank">
          <span class="hud-3d-value">{{ currentRank }}</span>
          <span class="hud-3d-label">위</span>
        </div>
        <div class="hud-3d-item speed" :class="{ boosting: effects.boost }">
          <span class="hud-3d-value">{{ Math.round(playerSpeed) }}</span>
          <span class="hud-3d-label">km/h</span>
        </div>
        <div class="hud-3d-item time">
          <span class="hud-3d-value">{{ formatTime(raceTime) }}</span>
        </div>
      </div>

      <!-- 드리프트 표시 -->
      <div v-if="isDrifting" class="drift-indicator">
        DRIFT!
      </div>

      <!-- 드리프트 부스트 바 -->
      <div class="drift-boost-bar" v-if="driftBoost > 0 || driftBoostReady">
        <div class="drift-boost-label">DRIFT BOOST</div>
        <div class="drift-boost-track">
          <div
            class="drift-boost-fill"
            :class="{ ready: driftBoostReady }"
            :style="{ width: driftBoost + '%' }"
          ></div>
        </div>
        <div v-if="driftBoostReady" class="drift-boost-ready">READY! (Space)</div>
      </div>

      <!-- 부스트 표시 -->
      <div v-if="effects.boost" class="boost-indicator">
        BOOST!
      </div>

      <!-- 슬립스트림 게이지 -->
      <div class="slipstream-bar" v-if="slipstream > 10">
        <div class="slipstream-label">SLIPSTREAM</div>
        <div class="slipstream-track">
          <div
            class="slipstream-fill"
            :style="{ width: slipstream + '%' }"
          ></div>
        </div>
      </div>

      <!-- 순위 변동 알림 -->
      <div
        v-if="rankChangeTimer > 0"
        class="rank-change-notification"
        :class="{ 'rank-up': rankChangeText.includes('상승') || rankChangeText.includes('1위'), 'rank-down': rankChangeText.includes('하락') }"
      >
        {{ rankChangeText }}
      </div>

      <!-- 터치 컨트롤 -->
      <div class="touch-controls">
        <button
          class="control-btn left"
          @touchstart.prevent="touchLeft(true)"
          @touchend.prevent="touchLeft(false)"
          @mousedown="touchLeft(true)"
          @mouseup="touchLeft(false)"
          @mouseleave="touchLeft(false)"
        >◀</button>
        <button
          class="control-btn right"
          @touchstart.prevent="touchRight(true)"
          @touchend.prevent="touchRight(false)"
          @mousedown="touchRight(true)"
          @mouseup="touchRight(false)"
          @mouseleave="touchRight(false)"
        >▶</button>
      </div>
    </div>

    <!-- 탑뷰 레이싱 (기존) -->
    <div v-if="gamePhase === 'racing' && viewMode === 'topdown'" class="racing-screen">
      <div class="race-hud">
        <div class="hud-item">
          <span class="hud-label">LAP</span>
          <span class="hud-value">{{ myLap + 1 }}/{{ totalLaps }}</span>
        </div>
        <div class="hud-item">
          <span class="hud-label">TIME</span>
          <span class="hud-value">{{ formatTime(raceTime) }}</span>
        </div>
        <div class="hud-item">
          <span class="hud-label">RANK</span>
          <span class="hud-value">{{ currentRank }}/{{ racers.length }}</span>
        </div>
      </div>

      <div class="track-container">
        <svg class="track-svg" :viewBox="`0 0 ${TRACK_TOPDOWN.width} ${TRACK_TOPDOWN.height}`">
          <ellipse
            :cx="TRACK_TOPDOWN.centerX"
            :cy="TRACK_TOPDOWN.centerY"
            :rx="TRACK_TOPDOWN.radiusX + 40"
            :ry="TRACK_TOPDOWN.radiusY + 40"
            fill="#1a1a2e"
            stroke="#333"
            stroke-width="2"
          />
          <ellipse
            :cx="TRACK_TOPDOWN.centerX"
            :cy="TRACK_TOPDOWN.centerY"
            :rx="TRACK_TOPDOWN.radiusX"
            :ry="TRACK_TOPDOWN.radiusY"
            fill="none"
            stroke="#555"
            stroke-width="60"
          />
          <ellipse
            :cx="TRACK_TOPDOWN.centerX"
            :cy="TRACK_TOPDOWN.centerY"
            :rx="TRACK_TOPDOWN.radiusX"
            :ry="TRACK_TOPDOWN.radiusY"
            fill="none"
            stroke="#ffd93d"
            stroke-width="2"
            stroke-dasharray="10 10"
          />
          <line
            :x1="TRACK_TOPDOWN.centerX - 30"
            :y1="TRACK_TOPDOWN.centerY - TRACK_TOPDOWN.radiusY"
            :x2="TRACK_TOPDOWN.centerX + 30"
            :y2="TRACK_TOPDOWN.centerY - TRACK_TOPDOWN.radiusY"
            stroke="white"
            stroke-width="4"
          />

          <g v-for="racer in racers" :key="racer.id">
            <text
              :x="racer.coords?.x || TRACK_TOPDOWN.centerX"
              :y="racer.coords?.y || TRACK_TOPDOWN.centerY - TRACK_TOPDOWN.radiusY"
              font-size="28"
              text-anchor="middle"
              dominant-baseline="middle"
              :transform="`rotate(${racer.coords?.rotation || 0}, ${racer.coords?.x || TRACK_TOPDOWN.centerX}, ${racer.coords?.y || TRACK_TOPDOWN.centerY - TRACK_TOPDOWN.radiusY})`"
              :class="{ 'my-car': racer.id === 'player' }"
            >
              {{ CARS.find(c => c.id === racer.car)?.emoji }}
            </text>
            <text
              :x="racer.coords?.x || TRACK_TOPDOWN.centerX"
              :y="(racer.coords?.y || TRACK_TOPDOWN.centerY - TRACK_TOPDOWN.radiusY) - 20"
              font-size="10"
              fill="white"
              text-anchor="middle"
            >
              {{ racer.name?.slice(0, 5) }}
            </text>
          </g>
        </svg>

        <div v-if="effects.boost" class="effect-indicator boost">BOOST!</div>
        <div v-if="effects.shield" class="effect-indicator shield">SHIELD</div>
        <div v-if="effects.spin" class="effect-indicator spin">SPIN!</div>
      </div>

      <div class="item-slot" @click="useItem">
        <div v-if="myItem" class="item-icon">{{ myItem.emoji }}</div>
        <div v-else class="item-empty">?</div>
        <span class="item-hint">Space/터치</span>
      </div>

      <div class="touch-controls">
        <button
          class="control-btn left"
          @touchstart.prevent="touchLeft(true)"
          @touchend.prevent="touchLeft(false)"
          @mousedown="touchLeft(true)"
          @mouseup="touchLeft(false)"
          @mouseleave="touchLeft(false)"
        >←</button>
        <button
          class="control-btn right"
          @touchstart.prevent="touchRight(true)"
          @touchend.prevent="touchRight(false)"
          @mousedown="touchRight(true)"
          @mouseup="touchRight(false)"
          @mouseleave="touchRight(false)"
        >→</button>
      </div>
    </div>

    <!-- 결과 -->
    <div v-if="gamePhase === 'result'" class="result-screen">
      <h3>레이스 결과</h3>

      <div class="podium">
        <div class="podium-place second" v-if="getResultData[1]">
          <div class="podium-emoji">{{ getResultData[1].carData?.emoji }}</div>
          <div class="podium-name">{{ getResultData[1].name }}</div>
          <div class="podium-rank">2</div>
        </div>
        <div class="podium-place first" v-if="getResultData[0]">
          <div class="confetti">🎊</div>
          <div class="podium-emoji winner">{{ getResultData[0].carData?.emoji }}</div>
          <div class="podium-name">{{ getResultData[0].name }}</div>
          <div class="podium-rank">1</div>
        </div>
        <div class="podium-place third" v-if="getResultData[2]">
          <div class="podium-emoji">{{ getResultData[2].carData?.emoji }}</div>
          <div class="podium-name">{{ getResultData[2].name }}</div>
          <div class="podium-rank">3</div>
        </div>
      </div>

      <div class="full-rankings">
        <div
          v-for="result in getResultData"
          :key="result.id"
          class="rank-item"
          :class="{
            winner: result.rank === 1,
            loser: result.rank === getResultData.length
          }"
        >
          <span class="rank-num">{{ result.rank }}</span>
          <span class="rank-car">{{ result.carData?.emoji }}</span>
          <span class="rank-name">{{ result.name }}</span>
        </div>
      </div>

      <div v-if="getResultData.length > 1" class="loser-penalty">
        <h4>벌칙 대상</h4>
        <div class="loser-info">
          <span class="loser-emoji">{{ getResultData[getResultData.length - 1]?.carData?.emoji }}</span>
          <span class="loser-name">{{ getResultData[getResultData.length - 1]?.name }}</span>
        </div>
      </div>

      <div class="result-actions">
        <button class="btn" @click="restartGame">다시하기</button>
        <button class="btn secondary" @click="exitGame">나가기</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.racing-game {
  padding: 15px;
  max-width: 400px;
  margin: 0 auto;
}

.game-title {
  text-align: center;
  font-size: 2rem;
  margin-bottom: 20px;
  background: linear-gradient(135deg, #e74c3c, #f39c12);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* 뷰 모드 선택 */
.view-mode-select {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.view-btn {
  flex: 1;
  padding: 12px;
  border: 2px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-primary);
  border-radius: 12px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s;
}

.view-btn.active {
  border-color: var(--neon-pink);
  background: linear-gradient(135deg, var(--neon-pink), var(--neon-purple));
  color: white;
}

/* 차량 선택 */
.car-select {
  text-align: center;
}

.car-select h3 {
  margin-bottom: 20px;
  color: var(--text-secondary);
}

.cars-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.car-card {
  background: var(--card-bg);
  border: 2px solid var(--border-color);
  border-radius: 16px;
  padding: 15px;
  cursor: pointer;
  transition: all 0.3s;
}

.car-card.selected {
  border-color: var(--car-color, var(--neon-pink));
  box-shadow: 0 0 25px color-mix(in srgb, var(--car-color) 50%, transparent);
  transform: scale(1.02);
}

.car-preview-canvas {
  display: block;
  margin: 0 auto 8px;
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.1) 100%);
}

.car-name {
  font-weight: bold;
  margin-bottom: 10px;
}

.car-stats {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.stat {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
}

.stat-label {
  width: 45px;
  color: var(--text-secondary);
}

.stat-bar {
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.stat-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.stat-fill.speed {
  background: linear-gradient(90deg, #e74c3c, #ff6b6b);
  box-shadow: 0 0 8px rgba(231, 76, 60, 0.5);
}

.stat-fill.handling {
  background: linear-gradient(90deg, #3498db, #5dade2);
  box-shadow: 0 0 8px rgba(52, 152, 219, 0.5);
}

.stat-fill.accel {
  background: linear-gradient(90deg, #2ecc71, #58d68d);
  box-shadow: 0 0 8px rgba(46, 204, 113, 0.5);
}

.mode-select {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
  text-align: left;
  padding: 15px;
  background: var(--card-bg);
  border-radius: 12px;
}

.mode-option {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.start-btn {
  width: 100%;
  padding: 15px;
  font-size: 1.1rem;
}

/* 카운트다운 */
.countdown-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 30px;
}

.countdown-number {
  font-size: 8rem;
  font-weight: bold;
  color: var(--neon-yellow);
  text-shadow: 0 0 50px var(--neon-yellow);
  animation: countPulse 1s ease-out;
}

@keyframes countPulse {
  0% { transform: scale(1.5); opacity: 0; }
  50% { transform: scale(1); opacity: 1; }
  100% { transform: scale(0.95); }
}

/* 미니터보 게이지 */
.mini-turbo-section {
  text-align: center;
  width: 250px;
}

.mini-turbo-hint {
  font-size: 0.9rem;
  color: #aaa;
  margin-bottom: 10px;
}

.mini-turbo-meter {
  position: relative;
  height: 20px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 10px;
  overflow: hidden;
  border: 2px solid #444;
}

.mini-turbo-fill {
  height: 100%;
  transition: width 0.05s linear;
  border-radius: 8px;
}

.mini-turbo-fill.charging {
  background: linear-gradient(90deg, #666, #888);
}

.mini-turbo-fill.ready {
  background: linear-gradient(90deg, #00cc00, #00ff00);
  box-shadow: 0 0 15px rgba(0, 255, 0, 0.7);
}

.mini-turbo-fill.overcharge {
  background: linear-gradient(90deg, #ff0000, #ff4444);
  animation: overchargeFlash 0.1s infinite alternate;
}

@keyframes overchargeFlash {
  from { opacity: 1; }
  to { opacity: 0.5; }
}

.mini-turbo-zone {
  position: absolute;
  top: 0;
  height: 100%;
  background: rgba(0, 255, 0, 0.15);
  border-left: 2px dashed #00ff00;
}

.mini-turbo-status {
  margin-top: 8px;
  font-size: 0.85rem;
  color: #888;
}

.mini-turbo-status .ready-text {
  color: #00ff00;
  font-weight: bold;
  animation: readyBlink 0.5s infinite alternate;
}

.mini-turbo-status .fail-text {
  color: #ff4444;
  font-weight: bold;
}

@keyframes readyBlink {
  from { opacity: 0.7; }
  to { opacity: 1; }
}

/* 3D 레이싱 화면 */
.racing-screen-3d {
  position: relative;
}

.game-canvas {
  width: 100%;
  height: auto;
  border-radius: 16px;
  display: block;
}

.minimap {
  position: absolute;
  top: 8px;
  right: 8px;
  border-radius: 12px;
  box-shadow:
    0 4px 20px rgba(0, 0, 0, 0.6),
    0 0 0 1px rgba(255, 255, 255, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.item-slot-3d {
  position: absolute;
  top: 138px;
  right: 8px;
  width: 50px;
  height: 50px;
  background: linear-gradient(145deg, rgba(30, 30, 40, 0.9), rgba(20, 20, 30, 0.9));
  border: 2px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow:
    0 4px 15px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  transition: transform 0.2s, box-shadow 0.2s;
}

.item-slot-3d:hover {
  transform: scale(1.05);
  box-shadow:
    0 6px 20px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.item-slot-3d:active {
  transform: scale(0.95);
}

.item-slot-3d .item-icon {
  font-size: 1.8rem;
}

.item-slot-3d .item-empty {
  font-size: 1.5rem;
  color: var(--text-secondary);
}

.hud-3d {
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.hud-3d-item {
  background: linear-gradient(145deg, rgba(20, 20, 30, 0.95), rgba(10, 10, 20, 0.95));
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow:
    0 4px 15px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: baseline;
  gap: 4px;
  min-width: 80px;
}

.hud-3d-item.rank {
  background: linear-gradient(145deg, rgba(255, 204, 0, 0.15), rgba(255, 150, 0, 0.1));
  border-color: rgba(255, 204, 0, 0.3);
}

.hud-3d-item.speed {
  background: linear-gradient(145deg, rgba(0, 200, 255, 0.15), rgba(0, 150, 255, 0.1));
  border-color: rgba(0, 200, 255, 0.3);
}

.hud-3d-value {
  font-size: 1.4rem;
  font-weight: bold;
  font-family: 'Segoe UI', 'Arial', sans-serif;
}

.hud-3d-item.rank .hud-3d-value {
  color: #ffcc00;
  text-shadow: 0 0 15px rgba(255, 204, 0, 0.6);
}

.hud-3d-item.speed .hud-3d-value {
  color: #00ccff;
  text-shadow: 0 0 15px rgba(0, 200, 255, 0.6);
}

.hud-3d-item.time .hud-3d-value {
  color: #ffffff;
  font-size: 1rem;
}

.hud-3d-label {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
}

.hud-3d-item.speed.boosting {
  animation: boostPulse 0.3s infinite;
  background: linear-gradient(145deg, rgba(255, 100, 0, 0.3), rgba(255, 50, 0, 0.2));
  border-color: rgba(255, 100, 0, 0.5);
}

.hud-3d-item.speed.boosting .hud-3d-value {
  color: #ff6600;
  text-shadow: 0 0 20px rgba(255, 100, 0, 0.8);
}

@keyframes boostPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

/* 드리프트 표시 */
.drift-indicator {
  position: absolute;
  bottom: 140px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 1.5rem;
  font-weight: bold;
  color: #ffffff;
  text-shadow:
    0 0 10px rgba(150, 150, 150, 0.8),
    0 0 20px rgba(100, 100, 100, 0.6),
    2px 2px 0 #333;
  animation: driftShake 0.1s infinite;
  letter-spacing: 4px;
}

@keyframes driftShake {
  0%, 100% { transform: translateX(-50%) rotate(-2deg); }
  50% { transform: translateX(-50%) rotate(2deg); }
}

/* 부스트 표시 */
.boost-indicator {
  position: absolute;
  bottom: 170px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 1.8rem;
  font-weight: bold;
  color: #ff6600;
  text-shadow:
    0 0 15px rgba(255, 100, 0, 0.9),
    0 0 30px rgba(255, 50, 0, 0.7),
    0 0 45px rgba(255, 0, 0, 0.5);
  animation: boostFlame 0.15s infinite;
  letter-spacing: 3px;
}

@keyframes boostFlame {
  0%, 100% { transform: translateX(-50%) scale(1); opacity: 1; }
  50% { transform: translateX(-50%) scale(1.1); opacity: 0.9; }
}

/* 드리프트 부스트 바 */
.drift-boost-bar {
  position: absolute;
  bottom: 200px;
  left: 50%;
  transform: translateX(-50%);
  width: 200px;
  text-align: center;
}

.drift-boost-label {
  font-size: 0.7rem;
  color: #aaa;
  margin-bottom: 4px;
  letter-spacing: 2px;
}

.drift-boost-track {
  height: 12px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #444;
}

.drift-boost-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff6600, #ff9900);
  border-radius: 6px;
  transition: width 0.05s linear;
}

.drift-boost-fill.ready {
  background: linear-gradient(90deg, #00ff00, #00ffaa);
  animation: boostReady 0.3s infinite alternate;
}

@keyframes boostReady {
  from { box-shadow: 0 0 10px #00ff00; }
  to { box-shadow: 0 0 20px #00ffaa, 0 0 30px #00ff00; }
}

.drift-boost-ready {
  font-size: 0.8rem;
  color: #00ff00;
  margin-top: 4px;
  font-weight: bold;
  animation: readyPulse 0.5s infinite alternate;
}

@keyframes readyPulse {
  from { opacity: 0.7; }
  to { opacity: 1; }
}

/* 슬립스트림 게이지 */
.slipstream-bar {
  position: absolute;
  bottom: 240px;
  left: 50%;
  transform: translateX(-50%);
  width: 180px;
  text-align: center;
}

.slipstream-label {
  font-size: 0.65rem;
  color: #64c8ff;
  margin-bottom: 3px;
  letter-spacing: 2px;
}

.slipstream-track {
  height: 8px;
  background: rgba(0, 50, 100, 0.6);
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid #336699;
}

.slipstream-fill {
  height: 100%;
  background: linear-gradient(90deg, #0088ff, #00ccff);
  border-radius: 4px;
  transition: width 0.1s linear;
  box-shadow: 0 0 10px rgba(0, 150, 255, 0.5);
}

/* 순위 변동 알림 */
.rank-change-notification {
  position: absolute;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 25px;
  border-radius: 25px;
  font-size: 1.3rem;
  font-weight: bold;
  animation: rankNotify 0.5s ease-out;
  white-space: nowrap;
}

.rank-change-notification.rank-up {
  background: linear-gradient(135deg, rgba(0, 200, 100, 0.9), rgba(0, 150, 50, 0.9));
  color: #ffffff;
  box-shadow: 0 0 20px rgba(0, 255, 100, 0.5);
}

.rank-change-notification.rank-down {
  background: linear-gradient(135deg, rgba(200, 50, 50, 0.9), rgba(150, 0, 0, 0.9));
  color: #ffffff;
  box-shadow: 0 0 20px rgba(255, 50, 50, 0.5);
}

@keyframes rankNotify {
  0% { transform: translateX(-50%) scale(0.5); opacity: 0; }
  50% { transform: translateX(-50%) scale(1.2); }
  100% { transform: translateX(-50%) scale(1); opacity: 1; }
}

/* 탑뷰 레이싱 화면 */
.racing-screen {
  position: relative;
}

.race-hud {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  padding: 10px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 10px;
}

.hud-item {
  text-align: center;
}

.hud-label {
  display: block;
  font-size: 0.7rem;
  color: var(--text-secondary);
}

.hud-value {
  font-size: 1.1rem;
  font-weight: bold;
  color: var(--neon-yellow);
}

.track-container {
  position: relative;
  background: #0a0a15;
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 15px;
}

.track-svg {
  width: 100%;
  height: auto;
  display: block;
}

.my-car {
  filter: drop-shadow(0 0 10px var(--neon-pink));
}

.effect-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 2rem;
  font-weight: bold;
  animation: effectPop 0.5s ease-out;
}

.effect-indicator.boost { color: #f39c12; }
.effect-indicator.shield { color: #3498db; }
.effect-indicator.spin { color: #e74c3c; }

@keyframes effectPop {
  0% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
  50% { opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
}

.item-slot {
  position: absolute;
  top: 60px;
  right: 10px;
  width: 50px;
  height: 50px;
  background: var(--card-bg);
  border: 2px solid var(--border-color);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.item-icon {
  font-size: 1.8rem;
}

.item-empty {
  font-size: 1.5rem;
  color: var(--text-secondary);
}

.item-hint {
  font-size: 0.6rem;
  color: var(--text-secondary);
}

/* 터치 컨트롤 */
.touch-controls {
  display: flex;
  justify-content: space-between;
  padding: 10px 20px;
  margin-top: 15px;
}

.control-btn {
  width: 80px;
  height: 80px;
  border: none;
  border-radius: 50%;
  background: var(--card-bg);
  color: var(--text-primary);
  font-size: 2rem;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  touch-action: manipulation;
  transition: all 0.1s;
}

.control-btn:active {
  background: var(--neon-blue);
  transform: scale(0.95);
}

/* 결과 화면 */
.result-screen {
  text-align: center;
}

.result-screen h3 {
  margin-bottom: 20px;
  color: var(--neon-yellow);
}

.podium {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 10px;
  margin-bottom: 30px;
}

.podium-place {
  text-align: center;
  padding: 15px;
  border-radius: 12px;
  background: var(--card-bg);
}

.podium-place.first {
  transform: translateY(-20px);
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 165, 0, 0.2));
  border: 2px solid gold;
}

.podium-place.second {
  background: linear-gradient(135deg, rgba(192, 192, 192, 0.2), rgba(169, 169, 169, 0.2));
  border: 2px solid silver;
}

.podium-place.third {
  background: linear-gradient(135deg, rgba(205, 127, 50, 0.2), rgba(184, 115, 51, 0.2));
  border: 2px solid #cd7f32;
}

.podium-emoji {
  font-size: 2rem;
  margin-bottom: 5px;
}

.podium-emoji.winner {
  font-size: 2.5rem;
  animation: bounce 1s infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.confetti {
  font-size: 1.5rem;
  animation: confettiFall 2s infinite;
}

@keyframes confettiFall {
  0% { opacity: 1; transform: translateY(0) rotate(0); }
  100% { opacity: 0; transform: translateY(30px) rotate(360deg); }
}

.podium-name {
  font-size: 0.9rem;
  font-weight: bold;
  margin-bottom: 5px;
}

.podium-rank {
  font-size: 1.5rem;
  font-weight: bold;
  color: gold;
}

.full-rankings {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 15px;
  margin-bottom: 20px;
}

.rank-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 5px;
}

.rank-item.winner {
  background: rgba(255, 215, 0, 0.15);
  border: 1px solid rgba(255, 215, 0, 0.3);
}

.rank-item.loser {
  background: rgba(255, 100, 100, 0.15);
  border: 1px solid rgba(255, 100, 100, 0.3);
}

.rank-num {
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

.rank-car {
  font-size: 1.3rem;
}

.rank-name {
  flex: 1;
}

.loser-penalty {
  background: rgba(255, 100, 100, 0.1);
  border: 1px solid rgba(255, 100, 100, 0.3);
  border-radius: 12px;
  padding: 15px;
  margin-bottom: 20px;
}

.loser-penalty h4 {
  color: #ff6b6b;
  margin-bottom: 10px;
}

.loser-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.loser-emoji {
  font-size: 2rem;
}

.loser-name {
  font-size: 1.2rem;
  font-weight: bold;
}

.result-actions {
  display: flex;
  gap: 10px;
}

.result-actions .btn {
  flex: 1;
  padding: 15px;
}

.btn.secondary {
  background: var(--card-bg);
  border: 2px solid var(--border-color);
}
</style>
