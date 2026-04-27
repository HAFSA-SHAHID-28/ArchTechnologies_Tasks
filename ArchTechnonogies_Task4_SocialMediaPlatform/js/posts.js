import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp as firestoreServerTimestamp,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db, ensureFirebaseConfigured, serverTimestamp } from "./firebase.js";
import { uploadImageToCloudinary } from "./cloudinary.js";
import {
  animateElements,
  avatarPlaceholder,
  escapeHtml,
  formatTime,
  setStatus,
  validateImageFile
} from "./ui.js";

const postForm = document.getElementById("postForm");
const feed = document.getElementById("feed");
const postMessage = document.getElementById("postMessage");
const postImageInput = document.getElementById("postImage");
const postImagePreviewWrap = document.getElementById("postImagePreviewWrap");
const postImagePreview = document.getElementById("postImagePreview");
const clearPostImageBtn = document.getElementById("clearPostImageBtn");

let feedUnsubscribe = null;
let currentViewerId = "";
const commentUnsubscribes = new Map();
const expandedCommentIds = new Set();
let currentPreviewUrl = "";
let hasAnimatedFeed = false;

async function uploadImage(file, folder) {
  if (!file) {
    return "";
  }

  return uploadImageToCloudinary(file, folder);
}

function clearPostPreview() {
  if (currentPreviewUrl) {
    URL.revokeObjectURL(currentPreviewUrl);
    currentPreviewUrl = "";
  }

  if (postImagePreview) {
    postImagePreview.removeAttribute("src");
  }

  postImagePreviewWrap?.classList.add("hidden");
}

function showPostPreview(file) {
  if (!file || !postImagePreview || !postImagePreviewWrap) {
    clearPostPreview();
    return;
  }

  validateImageFile(file);
  clearPostPreview();
  currentPreviewUrl = URL.createObjectURL(file);
  postImagePreview.src = currentPreviewUrl;
  postImagePreviewWrap.classList.remove("hidden");
  animateElements([postImagePreviewWrap], { duration: 0.35, stagger: 0 });
}

async function getUserProfile(uid) {
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? snapshot.data() : null;
}

async function isFollowing(viewerId, authorId) {
  if (!viewerId || !authorId || viewerId === authorId) {
    return true;
  }

  const snapshot = await getDoc(doc(db, "follows", `${viewerId}_${authorId}`));
  return snapshot.exists();
}

async function canViewPost(post, viewerId) {
  if (post.privacy === "public" || post.authorId === viewerId) {
    return true;
  }

  return isFollowing(viewerId, post.authorId);
}

async function sendNotification(targetUserId, actorName, message, type, postId = "") {
  if (!targetUserId || !auth.currentUser || targetUserId === auth.currentUser.uid) {
    return;
  }

  await addDoc(collection(db, "users", targetUserId, "notifications"), {
    actorId: auth.currentUser.uid,
    actorName,
    message,
    type,
    postId,
    read: false,
    createdAt: serverTimestamp()
  });
}

async function handleCreatePost(event) {
  event.preventDefault();

  try {
    ensureFirebaseConfigured();

    const user = auth.currentUser;
    if (!user) {
      throw new Error("Please login first.");
    }

    const profile = await getUserProfile(user.uid);
    const postText = document.getElementById("postText").value.trim();
    const privacy = document.getElementById("postPrivacy").value;
    const postImage = postImageInput?.files[0];

    if (!postText && !postImage) {
      throw new Error("Write something or upload an image.");
    }

    const imageUrl = await uploadImage(postImage, `posts/${user.uid}`);

    await addDoc(collection(db, "posts"), {
      authorId: user.uid,
      authorName: profile?.name || "Unnamed User",
      authorPhoto: profile?.profilePic || "",
      text: postText,
      imageUrl,
      privacy,
      likesCount: 0,
      commentsCount: 0,
      createdAt: serverTimestamp()
    });

    postForm.reset();
    clearPostPreview();
    setStatus(postMessage, "Post shared successfully.");
  } catch (error) {
    setStatus(postMessage, error.message, { error: true });
  }
}

function createPostMarkup(post, isLiked, showCommentBox, commentsHtml) {
  const privacyLabel = post.privacy === "private" ? "Followers only" : "Public";
  const imageHtml = post.imageUrl
    ? `<img class="post-image" src="${post.imageUrl}" alt="Post image">`
    : "";

  return `
    <article class="post-card" data-post-id="${post.id}">
      <div class="post-header">
        <div class="post-author">
          <img class="avatar avatar-small" src="${post.authorPhoto || avatarPlaceholder(post.authorName, 44)}" alt="${escapeHtml(post.authorName || "User")} avatar">
          <div>
            <div class="post-topline">
              <strong>${escapeHtml(post.authorName || "Unnamed User")}</strong>
              <span class="privacy-badge ${post.privacy}">${privacyLabel}</span>
            </div>
            <p class="post-meta small">${formatTime(post.createdAt)}</p>
          </div>
        </div>
        <a class="post-author-link" href="./profile.html?uid=${post.authorId}">Profile</a>
      </div>
      <div class="post-content">
        ${post.text ? `<p class="post-text">${escapeHtml(post.text)}</p>` : ""}
        ${imageHtml}
      </div>
      <div class="post-actions">
        <button class="like-btn ${isLiked ? "active" : ""}" data-action="like" data-post-id="${post.id}" type="button">
          ${isLiked ? "Liked" : "Like"} <span>${post.likesCount || 0}</span>
        </button>
        <button class="comment-toggle" data-action="toggle-comments" data-post-id="${post.id}" type="button">
          Comments <span>${post.commentsCount || 0}</span>
        </button>
      </div>
      <div class="comments-wrap ${showCommentBox ? "" : "hidden"}" id="comments-${post.id}">
        <form class="comment-form" data-post-id="${post.id}">
          <input name="commentText" type="text" placeholder="Write a comment..." required>
          <button class="secondary-btn" type="submit">Add Comment</button>
        </form>
        <div class="comments-list" id="comment-list-${post.id}">
          ${commentsHtml || '<p class="empty-state small">No comments yet.</p>'}
        </div>
      </div>
    </article>
  `;
}

async function renderFeedPosts(posts, viewerId) {
  const visiblePosts = [];

  for (const post of posts) {
    if (await canViewPost(post, viewerId)) {
      visiblePosts.push(post);
    }
  }

  if (!visiblePosts.length) {
    resetCommentSubscriptions();
    feed.innerHTML = '<p class="empty-state">No visible posts yet.</p>';
    return;
  }

  const fragments = await Promise.all(visiblePosts.map(async (post) => {
    const likeSnapshot = await getDoc(doc(db, "posts", post.id, "likes", viewerId));
    return createPostMarkup(post, likeSnapshot.exists(), expandedCommentIds.has(post.id), "");
  }));

  feed.innerHTML = fragments.join("");
  resetCommentSubscriptions();
  bindFeedInteractions();

  visiblePosts.forEach((post) => {
    if (expandedCommentIds.has(post.id)) {
      subscribeComments(post.id);
    }
  });

  if (!hasAnimatedFeed) {
    animateElements(feed.querySelectorAll(".post-card"), { stagger: 0.04, duration: 0.38 });
    hasAnimatedFeed = true;
  }
}

async function toggleLike(postId) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Please login first.");
  }

  const profile = await getUserProfile(user.uid);
  const postRef = doc(db, "posts", postId);
  const likeRef = doc(db, "posts", postId, "likes", user.uid);
  const postSnapshot = await getDoc(postRef);
  const likeSnapshot = await getDoc(likeRef);

  if (!postSnapshot.exists()) {
    throw new Error("Post not found.");
  }

  if (likeSnapshot.exists()) {
    await deleteDoc(likeRef);
    await updateDoc(postRef, { likesCount: increment(-1) });
    return;
  }

  await setDoc(likeRef, {
    userId: user.uid,
    createdAt: firestoreServerTimestamp()
  });
  await updateDoc(postRef, { likesCount: increment(1) });

  const postData = postSnapshot.data();
  await sendNotification(
    postData.authorId,
    profile?.name || "Someone",
    "liked your post",
    "like",
    postId
  );
}

function subscribeComments(postId) {
  const target = document.getElementById(`comment-list-${postId}`);

  if (!target || commentUnsubscribes.has(postId)) {
    return;
  }

  const unsubscribe = onSnapshot(
    query(collection(db, "posts", postId, "comments"), orderBy("createdAt", "asc")),
    (snapshot) => {
      if (snapshot.empty) {
        target.innerHTML = '<p class="empty-state small">No comments yet.</p>';
        return;
      }

      target.innerHTML = snapshot.docs.map((commentDoc) => {
        const comment = commentDoc.data();
        return `
          <article class="comment-item">
            <div>
              <strong>${escapeHtml(comment.authorName || "Anonymous")}</strong>
              <p class="post-text small">${escapeHtml(comment.text || "")}</p>
              <p class="comment-meta small">${formatTime(comment.createdAt)}</p>
            </div>
          </article>
        `;
      }).join("");
    }
  );

  commentUnsubscribes.set(postId, unsubscribe);
}

async function handleAddComment(postId, form) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Please login first.");
  }

  const profile = await getUserProfile(user.uid);
  const textField = form.querySelector('input[name="commentText"]');
  const text = textField.value.trim();

  if (!text) {
    throw new Error("Comment cannot be empty.");
  }

  const postRef = doc(db, "posts", postId);
  const postSnapshot = await getDoc(postRef);

  await addDoc(collection(db, "posts", postId, "comments"), {
    authorId: user.uid,
    authorName: profile?.name || "Anonymous",
    text,
    createdAt: serverTimestamp()
  });

  await updateDoc(postRef, { commentsCount: increment(1) });
  textField.value = "";

  if (postSnapshot.exists()) {
    const postData = postSnapshot.data();
    await sendNotification(
      postData.authorId,
      profile?.name || "Someone",
      "commented on your post",
      "comment",
      postId
    );
  }
}

function bindFeedInteractions() {
  document.querySelectorAll('[data-action="like"]').forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await toggleLike(button.dataset.postId);
      } catch (error) {
        setStatus(postMessage, error.message, { error: true });
      }
    });
  });

  document.querySelectorAll('[data-action="toggle-comments"]').forEach((button) => {
    button.addEventListener("click", () => {
      const postId = button.dataset.postId;
      const wrapper = document.getElementById(`comments-${postId}`);
      const isHidden = wrapper.classList.toggle("hidden");

      if (!isHidden) {
        expandedCommentIds.add(postId);
        subscribeComments(postId);
        return;
      }

      expandedCommentIds.delete(postId);
      const unsubscribe = commentUnsubscribes.get(postId);
      unsubscribe?.();
      commentUnsubscribes.delete(postId);
    });
  });

  document.querySelectorAll(".comment-form").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      try {
        await handleAddComment(form.dataset.postId, form);
      } catch (error) {
        setStatus(postMessage, error.message, { error: true });
      }
    });
  });
}

function resetCommentSubscriptions() {
  commentUnsubscribes.forEach((unsubscribe) => unsubscribe());
  commentUnsubscribes.clear();
}

export function stopFeed() {
  if (feedUnsubscribe) {
    feedUnsubscribe();
    feedUnsubscribe = null;
  }

  resetCommentSubscriptions();
  expandedCommentIds.clear();
  hasAnimatedFeed = false;
}

export function startFeed(viewerId) {
  if (!feed) {
    return;
  }

  stopFeed();
  currentViewerId = viewerId;

  feedUnsubscribe = onSnapshot(
    query(collection(db, "posts"), orderBy("createdAt", "desc")),
    async (snapshot) => {
      const posts = snapshot.docs.map((postDoc) => ({ id: postDoc.id, ...postDoc.data() }));
      await renderFeedPosts(posts, currentViewerId);
    }
  );
}

postForm?.addEventListener("submit", handleCreatePost);
postImageInput?.addEventListener("change", () => {
  try {
    showPostPreview(postImageInput.files[0]);
  } catch (error) {
    setStatus(postMessage, error.message, { error: true });
    postImageInput.value = "";
    clearPostPreview();
  }
});

clearPostImageBtn?.addEventListener("click", () => {
  if (postImageInput) {
    postImageInput.value = "";
  }

  clearPostPreview();
});
