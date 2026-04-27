import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db, ensureFirebaseConfigured, serverTimestamp } from "./firebase.js";
import {
  animateElements,
  humanizeFirebaseError,
  setStatus
} from "./ui.js";

const showLoginBtn = document.getElementById("showLoginBtn");
const showSignupBtn = document.getElementById("showSignupBtn");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const authMessage = document.getElementById("authMessage");

function animateAuthScene() {
  if (!window.gsap) {
    return;
  }

  const timeline = window.gsap.timeline({ defaults: { ease: "power2.out" } });
  timeline
    .fromTo(".showcase-copy > *", { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, stagger: 0.08, duration: 0.5 })
    .fromTo(".soft-pill", { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, stagger: 0.05, duration: 0.28 }, "-=0.18")
    .fromTo(".showcase-card", { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, stagger: 0.08, duration: 0.38 }, "-=0.15")
    .fromTo(".auth-stage-card", { autoAlpha: 0, y: 22, scale: 0.985 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.42 }, "-=0.25");
}

function showLogin() {
  loginForm.classList.remove("hidden");
  signupForm.classList.add("hidden");
  showLoginBtn.classList.add("active");
  showSignupBtn.classList.remove("active");
  animateElements([loginForm], { duration: 0.32, stagger: 0 });
}

function showSignup() {
  signupForm.classList.remove("hidden");
  loginForm.classList.add("hidden");
  showSignupBtn.classList.add("active");
  showLoginBtn.classList.remove("active");
  animateElements([signupForm], { duration: 0.32, stagger: 0 });
}

async function createUserProfile(user, fullName) {
  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    name: fullName || user.email?.split("@")[0] || "New User",
    email: user.email,
    bio: "",
    profilePic: "",
    followersCount: 0,
    followingCount: 0,
    createdAt: serverTimestamp()
  }, { merge: true });
}

async function ensureUserProfile(user) {
  const snapshot = await getDoc(doc(db, "users", user.uid));

  if (snapshot.exists()) {
    return snapshot.data();
  }

  await createUserProfile(user, user.email?.split("@")[0] || "New User");
  return null;
}

async function handleSignup(event) {
  event.preventDefault();

  try {
    ensureFirebaseConfigured();
    const fullName = document.getElementById("signupName").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value.trim();
    const credentials = await createUserWithEmailAndPassword(auth, email, password);
    await createUserProfile(credentials.user, fullName);
    setStatus(authMessage, "Account created successfully.");
    signupForm.reset();
    window.location.href = "./feed.html";
  } catch (error) {
    setStatus(authMessage, humanizeFirebaseError(error), { error: true });
  }
}

async function handleLogin(event) {
  event.preventDefault();

  try {
    ensureFirebaseConfigured();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value.trim();
    await signInWithEmailAndPassword(auth, email, password);
    setStatus(authMessage, "Logged in successfully.");
    loginForm.reset();
    window.location.href = "./feed.html";
  } catch (error) {
    setStatus(authMessage, humanizeFirebaseError(error), { error: true });
  }
}

showLoginBtn?.addEventListener("click", showLogin);
showSignupBtn?.addEventListener("click", showSignup);
signupForm?.addEventListener("submit", handleSignup);
loginForm?.addEventListener("submit", handleLogin);

animateAuthScene();

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    return;
  }

  try {
    ensureFirebaseConfigured();
    await ensureUserProfile(user);
    window.location.href = "./feed.html";
  } catch (error) {
    setStatus(authMessage, error.message, { error: true });
  }
});
