<script setup>
import { ref } from 'vue'
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

const currentGame = ref('menu')

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
  whisper: WhisperGame
}

const selectGame = (game) => {
  currentGame.value = game
}

const goBack = () => {
  currentGame.value = 'menu'
}
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
