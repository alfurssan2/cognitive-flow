import { initializeApp } from "https://esm.sh/firebase@10.9.0/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://esm.sh/firebase@10.9.0/auth";
import { getFirestore, doc, getDoc, setDoc } from "https://esm.sh/firebase@10.9.0/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAbDQxojFodq6wIGZYLmZFxCFcUFP9H1oY",
  authDomain: "cognitive-flow-ffa86.firebaseapp.com",
  projectId: "cognitive-flow-ffa86",
  storageBucket: "cognitive-flow-ffa86.firebasestorage.app",
  messagingSenderId: "797186034614",
  appId: "1:797186034614:web:9a86f18d7507a36c6ccf17",
  measurementId: "G-0NSZ2NFGEX"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const provider = new GoogleAuthProvider();

export { signInWithPopup, signOut, onAuthStateChanged, doc, getDoc, setDoc };
