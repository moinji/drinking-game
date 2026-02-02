<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { bombTopicCategories } from '../data/gameData'

const currentTopic = ref('')
const isPlaying = ref(false)
const isExploded = ref(false)
const timeLeft = ref(0)

// 설정 값
const customTime = ref('')
const customTopic = ref('')
const selectedCategory = ref('전체')

// 카테고리 목록
const categories = computed(() => {
  return ['전체', ...Object.keys(bombTopicCategories)]
})

// 선택된 카테고리의 주제들
const availableTopics = computed(() => {
  if (selectedCategory.value === '전체') {
    return Object.values(bombTopicCategories).flatMap(cat => cat.topics)
  }
  return bombTopicCategories[selectedCategory.value]?.topics || []
})

let timer = null

const startGame = () => {
  isExploded.value = false
  isPlaying.value = true

  // 주제 설정: 직접 입력한 게 있으면 사용, 없으면 카테고리에서 랜덤
  if (customTopic.value.trim()) {
    currentTopic.value = customTopic.value.trim()
  } else {
    const topics = availableTopics.value
    currentTopic.value = topics[Math.floor(Math.random() * topics.length)]
  }

  // 시간 설정: 직접 입력한 게 있으면 사용, 없으면 10초
  const inputTime = parseInt(customTime.value)
  if (inputTime && inputTime > 0) {
    timeLeft.value = Math.min(inputTime, 300) // 최대 5분
  } else {
    timeLeft.value = 10 // 기본 10초
  }

  timer = setInterval(() => {
    timeLeft.value--
    if (timeLeft.value <= 0) {
      explode()
    }
  }, 1000)
}

const explode = () => {
  clearInterval(timer)
  isPlaying.value = false
  isExploded.value = true
}

const resetGame = () => {
  clearInterval(timer)
  isPlaying.value = false
  isExploded.value = false
  currentTopic.value = ''
  timeLeft.value = 0
}

const selectRandomTopic = () => {
  const topics = availableTopics.value
  customTopic.value = topics[Math.floor(Math.random() * topics.length)]
}

const getCategoryIcon = (category) => {
  if (category === '전체') return '🎲'
  return bombTopicCategories[category]?.icon || '📝'
}

onUnmounted(() => {
  clearInterval(timer)
})
</script>

<template>
  <div class="game-container">
    <h2 class="game-title">폭탄 돌리기</h2>

    <div class="bomb-container">
      <div v-if="!isPlaying && !isExploded" class="start-section">
        <div class="bomb-icon">💣</div>
        <p class="desc">주제에 맞는 답을 말하고 폭탄을 넘기세요!</p>

        <!-- 설정 영역 -->
        <div class="settings">
          <!-- 카테고리 선택 -->
          <div class="setting-group">
            <label>🏷️ 카테고리</label>
            <div class="category-grid">
              <button
                v-for="category in categories"
                :key="category"
                class="category-btn"
                :class="{ active: selectedCategory === category }"
                @click="selectedCategory = category; customTopic = ''"
              >
                <span class="category-icon">{{ getCategoryIcon(category) }}</span>
                <span class="category-name">{{ category }}</span>
              </button>
            </div>
          </div>

          <!-- 시간 설정 -->
          <div class="setting-group">
            <label>⏱️ 시간 (초)</label>
            <input
              v-model="customTime"
              type="number"
              placeholder="10"
              min="1"
              max="300"
              class="setting-input"
            />
          </div>

          <!-- 주제 설정 -->
          <div class="setting-group">
            <label>📝 주제 (직접 입력 또는 랜덤)</label>
            <div class="topic-input-group">
              <input
                v-model="customTopic"
                type="text"
                :placeholder="selectedCategory === '전체' ? '랜덤 주제' : `${selectedCategory}에서 랜덤`"
                class="setting-input topic-input"
                maxlength="30"
              />
              <button class="btn-random" @click="selectRandomTopic" :title="'랜덤 주제 뽑기'">🎲</button>
            </div>
          </div>
        </div>

        <p class="hint">* 비워두면 시간 10초, 선택한 카테고리에서 랜덤 주제</p>
      </div>

      <div v-if="isPlaying" class="playing-section">
        <div class="bomb-icon ticking">💣</div>
        <div class="topic-display">주제: {{ currentTopic }}</div>
        <div class="timer-display" :class="{ danger: timeLeft <= 3 }">
          ⏱️ {{ timeLeft }}초
        </div>
        <p>빨리 답을 말하고 다음 사람에게 넘기세요!</p>
      </div>

      <div v-if="isExploded" class="exploded-section">
        <div class="bomb-icon exploded">💥</div>
        <div class="result-box">펑! 벌칙이다!</div>
        <p class="topic-reminder">주제: {{ currentTopic }}</p>
      </div>
    </div>

    <div class="button-group">
      <button v-if="!isPlaying && !isExploded" class="btn" @click="startGame">
        게임 시작!
      </button>
      <button v-if="isExploded" class="btn" @click="resetGame">
        다시 하기
      </button>
      <button v-if="isPlaying" class="btn btn-secondary" @click="resetGame">
        게임 중단
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

.bomb-container {
  min-height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.start-section .desc {
  color: var(--text-secondary);
  margin: 15px 0;
}

.settings {
  width: 100%;
  max-width: 350px;
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-top: 20px;
  padding: 20px;
  background: var(--card-bg);
  border-radius: 12px;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
}

.setting-group label {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

/* 카테고리 그리드 */
.category-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.category-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid var(--border-color);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.category-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--neon-purple);
}

.category-btn.active {
  background: linear-gradient(135deg, var(--neon-purple), var(--neon-pink));
  border-color: transparent;
}

.category-icon {
  font-size: 1.3rem;
}

.category-name {
  font-size: 0.75rem;
  color: var(--text-primary);
}

.setting-input {
  padding: 12px 16px;
  border: 2px solid var(--border-color);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
  font-size: 1rem;
  width: 100%;
  box-sizing: border-box;
}

.setting-input:focus {
  outline: none;
  border-color: var(--neon-pink);
}

.setting-input::placeholder {
  color: var(--text-secondary);
  opacity: 0.7;
}

.topic-input-group {
  display: flex;
  gap: 8px;
}

.topic-input {
  flex: 1;
}

.btn-random {
  padding: 12px 16px;
  background: linear-gradient(135deg, var(--neon-purple), var(--neon-blue));
  border: none;
  border-radius: 10px;
  font-size: 1.2rem;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.btn-random:hover {
  transform: scale(1.05);
  box-shadow: 0 0 15px var(--neon-purple);
}

.btn-random:active {
  transform: scale(0.95);
}

.hint {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-top: 15px;
  opacity: 0.7;
}

.playing-section p {
  color: var(--text-secondary);
  margin-top: 15px;
}

.bomb-icon.ticking {
  animation: shake 0.5s infinite;
}

@keyframes shake {
  0%, 100% { transform: rotate(-5deg); }
  50% { transform: rotate(5deg); }
}

.timer-display {
  font-size: 2rem;
  font-weight: bold;
  margin: 15px 0;
  transition: all 0.3s;
}

.timer-display.danger {
  color: #ff4444;
  animation: pulse 0.5s infinite;
  text-shadow: 0 0 20px #ff4444;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.button-group {
  display: flex;
  gap: 15px;
  justify-content: center;
  margin-top: 20px;
}

.exploded-section .result-box {
  margin-top: 20px;
}

.topic-reminder {
  margin-top: 15px;
  color: var(--text-secondary);
  font-size: 0.9rem;
}
</style>
