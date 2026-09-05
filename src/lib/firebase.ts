// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyDvcZLGgQVN1C8sG6_UKDap7TpxjyxLXoc",
    authDomain: "post-upp-19d90.firebaseapp.com",
    projectId: "post-upp-19d90",
    storageBucket: "post-upp-19d90.firebasestorage.app",
    messagingSenderId: "369970614932",
    appId: "1:369970614932:web:6016f7ef0622f5750e5a81",
    measurementId: "G-70LTCJT94V"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);