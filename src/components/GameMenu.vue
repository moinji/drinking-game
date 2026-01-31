<script setup>
const emit = defineEmits(['select-game'])

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
  { id: 'whisper', icon: '🤫', label: '귓속말게임' }
]
</script>

<template>
  <div class="menu-container">
    <h1 class="game-title">술게임</h1>
    <p class="subtitle">친구들과 함께하는 재미있는 게임!</p>

    <div class="menu-grid">
      <div
        v-for="item in menuItems"
        :key="item.id"
        class="menu-item"
        @click="emit('select-game', item.id)"
      >
        <div class="icon">{{ item.icon }}</div>
        <div class="label">{{ item.label }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.menu-container {
  text-align: center;
  padding: 40px 20px;
}

.subtitle {
  color: var(--text-secondary);
  margin-bottom: 30px;
  font-size: 1.1rem;
}
</style>
