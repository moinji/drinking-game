<script setup>
import { ref, provide, watch } from 'vue'
import { useGlobalRoom } from './composables/useGlobalRoom'
import GameMenu from './components/GameMenu.vue'
import RandomMission from './components/RandomMission.vue'
import Roulette from './components/Roulette.vue'
import BombGame from './components/BombGame.vue'
import TruthOrDare from './components/TruthOrDare.vue'
import UpDown from './components/UpDown.vue'
import BalanceGame from './components/BalanceGame.vue'
import MalePreference from './components/MalePreference.vue'
import FemalePreference from './components/FemalePreference.vue'
import CoinTruth from './components/CoinTruth.vue'
import RankingGame from './components/RankingGame.vue'
import WhisperGame from './components/WhisperGame.vue'
import Seotda from './components/Seotda.vue'
import CatchMind from './components/CatchMind.vue'
import RacingGame from './components/RacingGame.vue'
import TrafficLight from './components/TrafficLight.vue'

const currentGame = ref('menu')
const globalRoom = useGlobalRoom()

// 전역 방 상태 provide
provide('globalRoom', globalRoom)

const games = {
  menu: GameMenu,
  randomMission: RandomMission,
  roulette: Roulette,
  bomb: BombGame,
  truthOrDare: TruthOrDare,
  updown: UpDown,
  balance: BalanceGame,
  malePreference: MalePreference,
  femalePreference: FemalePreference,
  coinTruth: CoinTruth,
  ranking: RankingGame,
  whisper: WhisperGame,
  seotda: Seotda,
  catchmind: CatchMind,
  racing: RacingGame,
  trafficLight: TrafficLight
}

const selectGame = (game) => {
  currentGame.value = game
}

const goBack = () => {
  // 멀티플레이어 모드에서 게임 중이면 endGame 호출
  if (globalRoom.isInRoom.value && globalRoom.roomState.value === 'playing' && globalRoom.isHost.value) {
    globalRoom.endGame()
  }
  currentGame.value = 'menu'
}

// 멀티플레이어 게임 시작 감지
watch(() => globalRoom.currentGame.value, (gameType) => {
  if (gameType && globalRoom.roomState.value === 'playing') {
    currentGame.value = gameType
  }
})

// 게임 종료 시 메뉴로
watch(() => globalRoom.roomState.value, (state) => {
  if (state === 'waiting' && currentGame.value !== 'menu') {
    // 게임이 끝나고 대기실로 돌아오면 메뉴로
    if (globalRoom.isInRoom.value) {
      currentGame.value = 'menu'
    }
  }
})
</script>

<template>
  <div class="app-container">
    <button
      v-if="currentGame !== 'menu'"
      class="back-btn"
      @click="goBack"
    >
      ←
    </button>

    <Transition name="fade" mode="out-in">
      <component
        :is="games[currentGame]"
        :key="currentGame"
        @select-game="selectGame"
        @go-back="goBack"
      />
    </Transition>
  </div>
</template>

<style scoped>
.app-container {
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
}
</style>
