import { initializeApp } from 'firebase/app'
import { getDatabase, ref, set, onValue, push, remove, onDisconnect } from 'firebase/database'

const firebaseConfig = {
  apiKey: "AIzaSyBfpPEB25mgR_jWWQ3bGt9YXz0LPf-tHvo",
  authDomain: "drinking-game-e2978.firebaseapp.com",
  databaseURL: "https://drinking-game-e2978-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "drinking-game-e2978",
  storageBucket: "drinking-game-e2978.firebasestorage.app",
  messagingSenderId: "450463301862",
  appId: "1:450463301862:web:aad36a62360d78aeeafb27",
  measurementId: "G-EMQDKT12ZK"
}

const app = initializeApp(firebaseConfig)
const database = getDatabase(app)

export { database, ref, set, onValue, push, remove, onDisconnect }
