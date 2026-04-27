import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db, ensureFirebaseConfigured, serverTimestamp } from "./firebase.js";
import { uploadImageToCloudinary } from "./cloudinary.js";
import {
  animateElements,
  avatarPlaceholder,
  escapeHtml,
  formatTime,
  setStatus,
  sortByCreatedAt,
  validateImageFile
} from "./ui.js";

const profileForm = document.getElementById("profileForm");
const profileMessage = document.getElementById("profileMessage");
const profilePreview = document.getElementById("profilePreview");
const profileName = document.getElementById("profileName");
const profileBio = document.getElementById("profileBio");
const profileTitle = document.getElementById("profileTitle");
const profileEmail = document.getElementById("profileEmail");
const publicAvatar = document.getElementById("publicAvatar");
const publicName = document.getElementById("publicName");
const publicBio = document.getElementById("publicBio");
const publicFollowers = document.getElementById("publicFollowers");
const publicFollowing = document.getElementById("publicFollowing");
const profilePosts = document.getElementById("profilePosts");
const followBtn = document.getElementById("followBtn");
const publicHeading = document.getElementById("publicHeading");
const publicHint = document.getElementById("publicHint");
const profilePicFile = document.getElementById("profilePicFile");

let viewedUid = "";
let viewedPostsCache = [];
let ownProfileUnsubscribe = null;
let viewedProfileUnsubscribe = null;
let viewedPostsUnsubscribe = null;
let currentProfilePreviewUrl = "";

function cleanupProfileSubscriptions() {
  ownProfileUnsubscribe?.();
  viewedProfileUnsubscribe?.();
  viewedPostsUnsubscribe?.();

  ownProfileUnsubscribe = null;
  viewedProfileUnsubscribe = null;
  viewedPostsUnsubscribe = null;
}

async function uploadProfileImage(file, uid) {
  if (!file) {
    return "";
  }

  return uploadImageToCloudinary(file, `profiles/${uid}`);
}

function showSelectedProfilePreview(file) {
  if (!file || !profilePreview) {
    return;
  }

  validateImageFile(file);

  if (currentProfilePreviewUrl) {
    URL.revokeObjectURL(currentProfilePreviewUrl);
  }

  currentProfilePreviewUrl = URL.createObjectURL(file);
  profilePreview.src = currentProfilePreviewUrl;
  animateElements([profilePreview], { duration: 0.35, stagger: 0 });
}

async function getProfile(uid) {
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? snapshot.data() : null;
}

async function ensureCurrentUserProfile(user) {
  const profile = await getProfile(user.uid);

  if (profile) {
    return profile;
  }

  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    email: user.email,
    name: user.email?.split("@")[0] || "New User",
    bio: "",
    profilePic: "",
    followersCount: 0,
    followingCount: 0,
    createdAt: serverTimestamp()
  }, { merge: true });

  return getProfile(user.uid);
}

async function renderProfilePosts(posts, viewerId) {
  if (!profilePosts) {
    return;
  }

  if (!posts.length) {
    profilePosts.innerHTML = '<p class="empty-state">User posts will appear here.</p>';
    return;
  }

  const followSnapshot = viewedUid !== viewerId
    ? await getDoc(doc(db, "follows", `${viewerId}_${viewedUid}`))
    : null;
  const canViewPrivate = viewedUid === viewerId || followSnapshot?.exists();
  const visiblePosts = posts.filter((post) => post.privacy === "public" || canViewPrivate);

  if (!visiblePosts.length) {
    profilePosts.innerHTML = '<p class="empty-state">No visible posts yet.</p>';
    return;
  }

  profilePosts.innerHTML = visiblePosts.map((post) => `
    <article class="post-card">
      <div class="post-header">
        <div class="post-author">
          <img class="avatar avatar-small" src="${post.authorPhoto || avatarPlaceholder(post.authorName, 44)}" alt="${escapeHtml(post.authorName || "User")} avatar">
          <div>
            <div class="post-topline">
              <strong>${escapeHtml(post.authorName || "Unnamed User")}</strong>
              <span class="privacy-badge ${post.privacy}">${post.privacy === "private" ? "Followers only" : "Public"}</span>
            </div>
            <p class="post-meta small">${formatTime(post.createdAt)}</p>
          </div>
        </div>
      </div>
      ${post.text ? `<p class="post-text">${escapeHtml(post.text)}</p>` : ""}
      ${post.imageUrl ? `<img class="post-image" src="${post.imageUrl}" alt="Post image">` : ""}
    </article>
  `).join("");

  animateElements(profilePosts.querySelectorAll(".post-card"), { stagger: 0.04 });
}

function renderPublicSection(profile) {
  if (!profile) {
    publicAvatar.src = avatarPlaceholder("User", 140);
    publicName.textContent = "User not found";
    publicBio.textContent = "This profile is not available.";
    publicFollowers.textContent = "0";
    publicFollowing.textContent = "0";
    return;
  }

  publicAvatar.src = profile.profilePic || avatarPlaceholder(profile.name, 140);
  publicName.textContent = profile.name || "Unnamed User";
  publicBio.textContent = profile.bio || "No bio yet.";
  publicFollowers.textContent = profile.followersCount || 0;
  publicFollowing.textContent = profile.followingCount || 0;
}

function updatePublicContext(viewerId) {
  const isOwnProfile = viewedUid === viewerId;

  publicHeading.textContent = isOwnProfile ? "Your public profile" : "User profile";
  publicHint.textContent = isOwnProfile
    ? "This is how your profile appears to other signed-in users."
    : "Follow this user to view followers-only posts.";
}

async function sendFollowNotification(targetUserId, actorName) {
  if (!targetUserId || !auth.currentUser || targetUserId === auth.currentUser.uid) {
    return;
  }

  await addDoc(collection(db, "users", targetUserId, "notifications"), {
    actorId: auth.currentUser.uid,
    actorName,
    message: "started following you",
    type: "follow",
    read: false,
    createdAt: serverTimestamp()
  });
}

async function toggleFollow() {
  const user = auth.currentUser;
  if (!user || !viewedUid || viewedUid === user.uid) {
    return;
  }

  const viewerProfile = await getProfile(user.uid);
  const followRef = doc(db, "follows", `${user.uid}_${viewedUid}`);
  const snapshot = await getDoc(followRef);

  if (snapshot.exists()) {
    await deleteDoc(followRef);
    await updateDoc(doc(db, "users", user.uid), { followingCount: increment(-1) });
    await updateDoc(doc(db, "users", viewedUid), { followersCount: increment(-1) });
  } else {
    await setDoc(followRef, {
      followerId: user.uid,
      followingId: viewedUid,
      createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, "users", user.uid), { followingCount: increment(1) });
    await updateDoc(doc(db, "users", viewedUid), { followersCount: increment(1) });
    await sendFollowNotification(viewedUid, viewerProfile?.name || "Someone");
  }

  await syncFollowButton(user.uid);
  await renderProfilePosts(viewedPostsCache, user.uid);
}

async function syncFollowButton(viewerId) {
  if (!followBtn || !viewedUid || viewedUid === viewerId) {
    followBtn?.classList.add("hidden");
    return;
  }

  const snapshot = await getDoc(doc(db, "follows", `${viewerId}_${viewedUid}`));
  followBtn.classList.remove("hidden");
  followBtn.textContent = snapshot.exists() ? "Unfollow" : "Follow";
}

async function syncAuthoredPosts(uid, profile) {
  const postsSnapshot = await getDocs(query(collection(db, "posts"), where("authorId", "==", uid)));

  if (postsSnapshot.empty) {
    return;
  }

  const batch = writeBatch(db);

  postsSnapshot.forEach((item) => {
    batch.update(item.ref, {
      authorName: profile.name,
      authorPhoto: profile.profilePic || ""
    });
  });

  await batch.commit();
}

async function saveProfile(event) {
  event.preventDefault();

  try {
    ensureFirebaseConfigured();

    const user = auth.currentUser;
    if (!user) {
      throw new Error("Please login first.");
    }

    const imageFile = profilePicFile?.files[0];
    const existingProfile = await getProfile(user.uid);
    const nextProfile = {
      name: profileName.value.trim() || user.email?.split("@")[0] || "New User",
      bio: profileBio.value.trim(),
      profilePic: imageFile
        ? await uploadProfileImage(imageFile, user.uid)
        : (existingProfile?.profilePic || "")
    };

    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: user.email,
      name: nextProfile.name,
      bio: nextProfile.bio,
      profilePic: nextProfile.profilePic,
      followersCount: existingProfile?.followersCount || 0,
      followingCount: existingProfile?.followingCount || 0,
      updatedAt: serverTimestamp()
    }, { merge: true });

    if (currentProfilePreviewUrl && nextProfile.profilePic) {
      URL.revokeObjectURL(currentProfilePreviewUrl);
      currentProfilePreviewUrl = "";
    }

    await syncAuthoredPosts(user.uid, nextProfile);
    setStatus(profileMessage, "Profile updated successfully.");
  } catch (error) {
    setStatus(profileMessage, error.message, { error: true });
  }
}

function renderOwnProfile(profile) {
  if (!profile) {
    return;
  }

  if (currentProfilePreviewUrl && profile.profilePic) {
    URL.revokeObjectURL(currentProfilePreviewUrl);
    currentProfilePreviewUrl = "";
  }

  profilePreview.src = profile.profilePic || avatarPlaceholder(profile.name, 140);
  profileName.value = profile.name || "";
  profileBio.value = profile.bio || "";
  profileTitle.textContent = profile.name || "Your Profile";
  profileEmail.textContent = profile.email || auth.currentUser?.email || "";
}

function getViewedUid(currentUid) {
  const params = new URLSearchParams(window.location.search);
  return params.get("uid") || currentUid;
}

function subscribeOwnProfile(uid) {
  ownProfileUnsubscribe?.();
  ownProfileUnsubscribe = onSnapshot(doc(db, "users", uid), (snapshot) => {
    if (snapshot.exists()) {
      renderOwnProfile(snapshot.data());
    }
  });
}

function subscribeViewedProfile(uid) {
  viewedProfileUnsubscribe?.();
  viewedProfileUnsubscribe = onSnapshot(doc(db, "users", uid), (snapshot) => {
    renderPublicSection(snapshot.exists() ? snapshot.data() : null);
  });
}

function subscribeViewedPosts(uid, viewerId) {
  viewedPostsUnsubscribe?.();
  viewedPostsUnsubscribe = onSnapshot(
    query(collection(db, "posts"), where("authorId", "==", uid)),
    async (snapshot) => {
      viewedPostsCache = sortByCreatedAt(
        snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      );
      await renderProfilePosts(viewedPostsCache, viewerId);
    }
  );
}

profileForm?.addEventListener("submit", saveProfile);
followBtn?.addEventListener("click", toggleFollow);
profilePicFile?.addEventListener("change", () => {
  try {
    if (profilePicFile.files[0]) {
      showSelectedProfilePreview(profilePicFile.files[0]);
    }
  } catch (error) {
    setStatus(profileMessage, error.message, { error: true });
    profilePicFile.value = "";
  }
});

animateElements('[data-animate="profile-panel"]');

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "./index.html";
    return;
  }

  try {
    ensureFirebaseConfigured();
    cleanupProfileSubscriptions();
    await ensureCurrentUserProfile(user);
    viewedUid = getViewedUid(user.uid);
    updatePublicContext(user.uid);
    subscribeOwnProfile(user.uid);
    subscribeViewedProfile(viewedUid);
    subscribeViewedPosts(viewedUid, user.uid);
    await syncFollowButton(user.uid);
    animateElements(document.querySelectorAll('[data-animate="profile-panel"]'));
  } catch (error) {
    setStatus(profileMessage, error.message, { error: true });
  }
});
