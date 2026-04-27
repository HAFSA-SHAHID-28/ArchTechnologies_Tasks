import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db, ensureFirebaseConfigured, serverTimestamp } from "./firebase.js";
import { startFeed, stopFeed } from "./posts.js";
import {
  animateElements,
  avatarPlaceholder,
  formatTime,
  setStatus
} from "./ui.js";

const logoutBtn = document.getElementById("logoutBtn");
const profileNavLink = document.getElementById("profileNavLink");
const menuToggleBtn = document.getElementById("menuToggleBtn");
const mobileOverlay = document.getElementById("mobileOverlay");
const sidebarColumn = document.getElementById("sidebarColumn");
const sidebarName = document.getElementById("sidebarName");
const sidebarEmail = document.getElementById("sidebarEmail");
const sidebarBio = document.getElementById("sidebarBio");
const sidebarAvatar = document.getElementById("sidebarAvatar");
const sidebarFollowers = document.getElementById("sidebarFollowers");
const sidebarFollowing = document.getElementById("sidebarFollowing");
const notificationList = document.getElementById("notificationList");
const markReadBtn = document.getElementById("markReadBtn");
const welcomeLine = document.getElementById("welcomeLine");
const feedStatus = document.getElementById("feedStatus");

let profileUnsubscribe = null;
let notificationUnsubscribe = null;
let hasAnimatedPanels = false;

function closeMobileMenu() {
  sidebarColumn?.classList.remove("open");
  mobileOverlay?.classList.add("hidden");
}

function openMobileMenu() {
  sidebarColumn?.classList.add("open");
  mobileOverlay?.classList.remove("hidden");

  if (window.gsap && sidebarColumn) {
    window.gsap.fromTo(
      sidebarColumn,
      { x: -24, autoAlpha: 0.88 },
      { x: 0, autoAlpha: 1, duration: 0.22, ease: "power2.out" }
    );
  }
}

function toggleMobileMenu() {
  if (!sidebarColumn) {
    return;
  }

  if (sidebarColumn.classList.contains("open")) {
    closeMobileMenu();
    return;
  }

  openMobileMenu();
}

async function fetchCurrentUserProfile(uid) {
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? snapshot.data() : null;
}

async function ensureUserProfile(user) {
  const existingProfile = await fetchCurrentUserProfile(user.uid);

  if (existingProfile) {
    if (existingProfile.email !== user.email) {
      await setDoc(doc(db, "users", user.uid), { email: user.email }, { merge: true });
    }

    return existingProfile;
  }

  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    name: user.email?.split("@")[0] || "New User",
    email: user.email,
    bio: "",
    profilePic: "",
    followersCount: 0,
    followingCount: 0,
    createdAt: serverTimestamp()
  }, { merge: true });

  return fetchCurrentUserProfile(user.uid);
}

function renderSidebar(profile) {
  if (!profile) {
    return;
  }

  sidebarName.textContent = profile.name || "Unnamed User";
  sidebarEmail.textContent = profile.email || "";
  sidebarBio.textContent = profile.bio || "Add your short intro from the profile page.";
  sidebarAvatar.src = profile.profilePic || avatarPlaceholder(profile.name, 120);
  sidebarFollowers.textContent = profile.followersCount || 0;
  sidebarFollowing.textContent = profile.followingCount || 0;
  welcomeLine.textContent = `Welcome back, ${profile.name || "friend"}.`;
}

function renderNotifications(items = []) {
  if (!notificationList) {
    return;
  }

  if (!items.length) {
    notificationList.innerHTML = '<p class="empty-state small">No notifications yet.</p>';
    return;
  }

  notificationList.innerHTML = items.map((item) => `
    <article class="notification-item ${item.read ? "" : "unread"}">
      <div>
        <strong>${item.actorName || "Someone"}</strong>
        <p class="small">${item.message}</p>
        <p class="notification-meta small">${formatTime(item.createdAt)}</p>
      </div>
    </article>
  `).join("");
}

function subscribeProfile(uid) {
  profileUnsubscribe?.();
  profileUnsubscribe = onSnapshot(doc(db, "users", uid), (snapshot) => {
    if (snapshot.exists()) {
      renderSidebar(snapshot.data());
    }
  });
}

function subscribeNotifications(uid) {
  notificationUnsubscribe?.();
  notificationUnsubscribe = onSnapshot(
    query(collection(db, "users", uid, "notifications"), orderBy("createdAt", "desc")),
    (snapshot) => {
      const items = snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
      renderNotifications(items);
    }
  );
}

async function markNotificationsRead() {
  const user = auth.currentUser;

  if (!user) {
    return;
  }

  const snapshot = await getDocs(query(collection(db, "users", user.uid, "notifications")));
  const batch = writeBatch(db);

  snapshot.forEach((item) => {
    batch.update(item.ref, { read: true });
  });

  await batch.commit();
}

function cleanSubscriptions() {
  stopFeed();
  profileUnsubscribe?.();
  notificationUnsubscribe?.();
  profileUnsubscribe = null;
  notificationUnsubscribe = null;
}

logoutBtn?.addEventListener("click", async () => {
  await signOut(auth);
});

menuToggleBtn?.addEventListener("click", toggleMobileMenu);
mobileOverlay?.addEventListener("click", closeMobileMenu);

markReadBtn?.addEventListener("click", async () => {
  try {
    await markNotificationsRead();
    setStatus(feedStatus, "Notifications marked as read.");
  } catch (error) {
    setStatus(feedStatus, error.message, { error: true });
  }
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 760) {
    closeMobileMenu();
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    cleanSubscriptions();
    window.location.href = "./index.html";
    return;
  }

  try {
    ensureFirebaseConfigured();
    await ensureUserProfile(user);
    profileNavLink?.classList.remove("hidden");
    logoutBtn?.classList.remove("hidden");
    subscribeProfile(user.uid);
    subscribeNotifications(user.uid);
    startFeed(user.uid);
    closeMobileMenu();

    if (!hasAnimatedPanels) {
      animateElements(document.querySelectorAll('[data-animate="panel"]'), { duration: 0.45 });
      hasAnimatedPanels = true;
    }
  } catch (error) {
    setStatus(feedStatus, error.message, { error: true });
  }
});
