const firebaseConfig = {
  apiKey: "AIzaSyAbDQxojFodq6wIGZYLmZFxCFcUFP9H1oY",
  authDomain: "cognitive-flow-ffa86.firebaseapp.com",
  projectId: "cognitive-flow-ffa86",
  storageBucket: "cognitive-flow-ffa86.firebasestorage.app",
  messagingSenderId: "797186034614",
  appId: "1:797186034614:web:9a86f18d7507a36c6ccf17",
  measurementId: "G-0NSZ2NFGEX"
};

// Initialize Firebase using the global Compat object
firebase.initializeApp(firebaseConfig);
window.auth = firebase.auth();
window.db = firebase.firestore();
window.provider = new firebase.auth.GoogleAuthProvider();
