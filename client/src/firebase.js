import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
 apiKey: "AIzaSyBQxTF0Xs2XewA7K1MVlPNvSOPtBcEQ88U",
  authDomain: "chat-app-1f9c3.firebaseapp.com",
  projectId: "chat-app-1f9c3",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);