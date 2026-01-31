<script setup>
import { ref, computed } from 'vue'

const targetNumber = ref(0)
const guessedNumber = ref('')
const hint = ref('')
const attempts = ref(0)
const isPlaying = ref(false)
const isWon = ref(false)
const previousGuesses = ref([])

const startGame = () => {
  targetNumber.value = Math.floor(Math.random() * 100) + 1
  guessedNumber.value = ''
  hint.value = ''
  attempts.value = 0
  isPlaying.value = true
  isWon.value = false
  previousGuesses.value = []
}

const makeGuess = () => {
  const guess = parseInt(guessedNumber.value)
  if (isNaN(guess) || guess < 1 || guess > 100) {
    hint.value = '1~100 사이의 숫자를 입력하세요!'
    return
  }

  attempts.value++
  previousGuesses.value.push({
    number: guess,
    result: guess < targetNumber.value ? 'up' : guess > targetNumber.value ? 'down' : 'correct'
  })

  if (guess === targetNumber.value) {
    isWon.value = true
    isPlaying.value = false
    hint.value = '정답!'
  } else if (guess < targetNumber.value) {
    hint.value = 'UP!'
  } else {
    hint.value = 'DOWN!'
  }

  guessedNumber.value = ''
}

const handleKeypress = (e) => {
  if (e.key === 'Enter') {
    makeGuess()
  }
}

const hintClass = computed(() => {
  if (hint.value === 'UP!') return 'up'
  if (hint.value === 'DOWN!') return 'down'
  return ''
})
</script>

<template>
  <div class="game-container">
    <h2 class="game-title">업다운</h2>

    <div v-if="!isPlaying && !isWon" class="start-section">
      <div class="number-display">?</div>
      <p>1부터 100 사이의 숫자를 맞춰보세요!</p>
      <button class="btn" @click="startGame">
        게임 시작!
      </button>
    </div>

    <div v-if="isPlaying" class="playing-section">
      <div class="hint-display" :class="hintClass">
        {{ hint || '숫자를 입력하세요' }}
      </div>

      <div class="guess-history" v-if="previousGuesses.length > 0">
        <span
          v-for="(g, i) in previousGuesses"
          :key="i"
          class="guess-item"
          :class="g.result"
        >
          {{ g.number }}
        </span>
      </div>

      <input
        v-model="guessedNumber"
        type="number"
        class="number-input"
        placeholder="1-100"
        min="1"
        max="100"
        @keypress="handleKeypress"
      />

      <button class="btn" @click="makeGuess">
        확인!
      </button>

      <p class="attempts">시도 횟수: {{ attempts }}회</p>
    </div>

    <div v-if="isWon" class="won-section">
      <div class="number-display">{{ targetNumber }}</div>
      <div class="result-box">
        {{ attempts }}번 만에 정답! 🎉
      </div>
      <button class="btn" @click="startGame">
        다시 하기
      </button>
    </div>
  </div>
</template>

<style scoped>
.game-container {
  text-align: center;
  padding: 40px 20px;
  width: 100%;
  max-width: 500px;
}

.start-section p {
  color: var(--text-secondary);
  margin: 20px 0;
}

.playing-section {
  padding: 20px 0;
}

.guess-history {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin: 20px 0;
}

.guess-item {
  padding: 5px 15px;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 600;
}

.guess-item.up {
  background: rgba(255, 46, 99, 0.3);
  color: var(--neon-pink);
}

.guess-item.down {
  background: rgba(8, 217, 214, 0.3);
  color: var(--neon-blue);
}

.guess-item.correct {
  background: rgba(255, 215, 0, 0.3);
  color: var(--neon-yellow);
}

.won-section {
  padding: 20px 0;
}
</style>
