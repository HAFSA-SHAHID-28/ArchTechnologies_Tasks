const firebaseErrorMessages = {
  "auth/email-already-in-use": "This email is already registered.",
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/invalid-credential": "Email or password is incorrect.",
  "auth/missing-password": "Please enter your password.",
  "auth/weak-password": "Password should be at least 6 characters.",
  "auth/too-many-requests": "Too many attempts. Please wait a bit and try again."
};

export function setStatus(target, message = "", options = {}) {
  if (!target) {
    return;
  }

  const { error = false } = options;

  target.textContent = message;
  target.classList.toggle("is-error", Boolean(message) && error);
  target.classList.toggle("is-success", Boolean(message) && !error);
}

export function humanizeFirebaseError(error) {
  if (!error) {
    return "Something went wrong. Please try again.";
  }

  return firebaseErrorMessages[error.code] || error.message || "Something went wrong. Please try again.";
}

export function escapeHtml(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function timestampToMs(value) {
  if (!value) {
    return 0;
  }

  if (typeof value.toDate === "function") {
    return value.toDate().getTime();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value.seconds === "number") {
    return value.seconds * 1000;
  }

  return 0;
}

export function formatTime(value) {
  const time = timestampToMs(value);

  if (!time) {
    return "Just now";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(time));
}

export function sortByCreatedAt(items = [], direction = "desc") {
  const copy = [...items];

  copy.sort((left, right) => {
    const diff = timestampToMs(left.createdAt) - timestampToMs(right.createdAt);
    return direction === "asc" ? diff : -diff;
  });

  return copy;
}

export function avatarPlaceholder(name = "User", size = 120) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "U";

  return `https://placehold.co/${size}x${size}/6e6a78/ffffff?text=${encodeURIComponent(initials)}`;
}

export function validateImageFile(file, maxSizeMb = 5) {
  if (!file) {
    return;
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }

  if (file.size > maxSizeMb * 1024 * 1024) {
    throw new Error(`Image size should be under ${maxSizeMb}MB.`);
  }
}

export function animateElements(target, options = {}) {
  if (!window.gsap) {
    return;
  }

  const items = typeof target === "string"
    ? [...document.querySelectorAll(target)]
    : [...(target || [])];

  if (!items.length) {
    return;
  }

  window.gsap.fromTo(
    items,
    { autoAlpha: 0, y: 14 },
    {
      autoAlpha: 1,
      y: 0,
      duration: 0.42,
      stagger: 0.06,
      ease: "power2.out",
      clearProps: "opacity,transform",
      ...options
    }
  );
}
