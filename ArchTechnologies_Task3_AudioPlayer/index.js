const audio = document.getElementById("audio");
let tracks = [],
  cur = -1,
  playing = false,
  sh = false,
  rp = false;
let liked = new Set(JSON.parse(localStorage.getItem("aura-liked") || "[]"));
let recent = [];
let view = "all",
  cat = "all";
const EMOJIS = [
  "🎵",
  "🎶",
  "🎸",
  "🎹",
  "🎷",
  "🎺",
  "🥁",
  "🎻",
  "🎙",
  "🎤",
  "🎼",
  "🪗",
];
const CC = {
  pop: "#ff6b6b",
  ost: "#ffd93d",
  urdu: "#c77dff",
  lofi: "#74c0fc",
  other: "#777",
};

// ── UPLOAD ──
const dz = document.getElementById("dz");
dz.addEventListener("dragover", (e) => {
  e.preventDefault();
  dz.classList.add("drag");
});
dz.addEventListener("dragleave", () => dz.classList.remove("drag"));
dz.addEventListener("drop", (e) => {
  e.preventDefault();
  dz.classList.remove("drag");
  handleFiles(e.dataTransfer.files);
});

function handleFiles(files) {
  const arr = Array.from(files).filter(
    (f) =>
      f.type.startsWith("audio/") ||
      /\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(f.name),
  );
  if (!arr.length) {
    toast("No audio files found!");
    return;
  }

  arr.forEach((file) => {
    const url = URL.createObjectURL(file);
    let name = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
    let artist = "Unknown Artist";
    const m = name.match(/^(.+?)\s*[-–]\s*(.+)$/);
    if (m) {
      artist = m[1].trim();
      name = m[2].trim();
    }
    const low = name.toLowerCase();
    let c = "other";
    if (/ost|soundtrack|bgm|theme|score/.test(low)) c = "ost";
    else if (
      /urdu|desi|pakistan|bollywood|hindi|punjabi|qawwali|ghazal/.test(low)
    )
      c = "urdu";
    else if (/lofi|lo.fi|chill|relax|sleep|study|ambient/.test(low)) c = "lofi";
    else if (/pop|kpop|k.pop|indie|rock|rap/.test(low)) c = "pop";
    const t = {
      id: "T" + Date.now() + Math.random().toString(36).slice(2),
      name,
      artist,
      cat: c,
      emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
      url,
      dur: "—",
    };
    const tmp = new Audio(url);
    tmp.onloadedmetadata = () => {
      t.dur = fmt(tmp.duration);
      render();
      updateCounts();
    };
    tracks.push(t);
  });
  render();
  updateCounts();
  toast("✓ " + arr.length + " track" + (arr.length > 1 ? "s" : "") + " added");
  document.getElementById("fin").value = "";
}

// ── PLAY ──
function playIdx(i) {
  const list = filtered();
  if (i < 0 || i >= list.length) return;
  const t = list[i];
  cur = i;
  audio.src = t.url;
  audio.volume = document.getElementById("vr").value / 100;
  audio.play();
  playing = true;
  setPico(true);
  document.getElementById("baSong").textContent = t.name;
  document.getElementById("baArt2").textContent = t.artist;
  document.getElementById("baArt").textContent = t.emoji;
  document.getElementById("npsTitle").textContent = t.name;
  document.getElementById("npsArtist").textContent = t.artist;
  const na = document.getElementById("npsArt");
  na.textContent = t.emoji;
  na.className = "nps-art spin";
  document.getElementById("nps").style.display = "flex";
  document.getElementById("lkb").classList.toggle("on", liked.has(t.id));
  recent = [t.id, ...recent.filter((x) => x !== t.id)].slice(0, 30);
  render();
}

function togglePlay() {
  if (cur === -1) {
    if (filtered().length) playIdx(0);
    return;
  }
  if (playing) {
    audio.pause();
    playing = false;
    setPico(false);
    document.getElementById("npsArt").classList.remove("spin");
  } else {
    audio.play();
    playing = true;
    setPico(true);
    document.getElementById("npsArt").classList.add("spin");
  }
}

function next() {
  const l = filtered();
  if (!l.length) return;
  playIdx(sh ? Math.floor(Math.random() * l.length) : (cur + 1) % l.length);
}

function prev() {
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  const l = filtered();
  if (!l.length) return;
  playIdx((cur - 1 + l.length) % l.length);
}

function setPico(p) {
  document.getElementById("pico").innerHTML = p
    ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'
    : '<polygon points="5,3 19,12 5,21"/>';
}
function toggleShuffle() {
  sh = !sh;
  document.getElementById("shBtn").classList.toggle("on", sh);
  toast(sh ? "Shuffle on 🔀" : "Shuffle off");
}
function toggleRepeat() {
  rp = !rp;
  audio.loop = rp;
  document.getElementById("rpBtn").classList.toggle("on", rp);
  toast(rp ? "Repeat on 🔁" : "Repeat off");
}
function toggleLike() {
  const l = filtered();
  if (cur < 0 || cur >= l.length) return;
  const id = l[cur].id;
  liked.has(id) ? liked.delete(id) : liked.add(id);
  localStorage.setItem("aura-liked", JSON.stringify([...liked]));
  document.getElementById("lkb").classList.toggle("on", liked.has(id));
  toast(liked.has(id) ? "♥ Liked" : "Removed from liked");
  if (view === "liked") render();
}
function setVol(v) {
  audio.volume = v / 100;
  document.getElementById("vico").innerHTML =
    v == 0
      ? '<polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/><line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" stroke-width="2"/><line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" stroke-width="2"/>'
      : '<polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/><path d="M15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14"/>';
}
function toggleMute() {
  const r = document.getElementById("vr");
  const v = audio.volume > 0 ? 0 : 80;
  r.value = v;
  setVol(v);
}
function seekA(e) {
  if (!audio.duration) return;
  audio.currentTime =
    (e.offsetX / document.getElementById("pt2").offsetWidth) * audio.duration;
}
function miniSeek(e) {
  if (!audio.duration) return;
  audio.currentTime =
    (e.offsetX / document.getElementById("mb").offsetWidth) * audio.duration;
}

audio.addEventListener("timeupdate", () => {
  if (!audio.duration) return;
  const p = (audio.currentTime / audio.duration) * 100;
  document.getElementById("pf").style.width = p + "%";
  document.getElementById("mf").style.width = p + "%";
  document.getElementById("curT").textContent = fmt(audio.currentTime);
  document.getElementById("npsCur").textContent = fmt(audio.currentTime);
  document.getElementById("totT").textContent = fmt(audio.duration);
  document.getElementById("npsDur").textContent = fmt(audio.duration);
});
audio.addEventListener("ended", () => {
  if (!rp) next();
});

// ── FILTERS ──
function setView(v, btn) {
  view = v;
  document.querySelectorAll(".nb").forEach((b) => b.classList.remove("on"));
  btn.classList.add("on");
  const map = {
    all: "Your Library",
    liked: "Liked Songs",
    recent: "Recently Played",
  };
  document.getElementById("pgTitle").textContent = map[v];
  document.getElementById("listTitle").textContent = map[v];
  render();
}
function setCat(c, btn) {
  cat = c;
  document.querySelectorAll(".cb").forEach((b) => b.classList.remove("on"));
  btn.classList.add("on");
  render();
}
function filtered() {
  let r = [...tracks];
  const q = document.getElementById("searchIn").value.trim().toLowerCase();
  if (view === "liked") r = r.filter((t) => liked.has(t.id));
  else if (view === "recent")
    r = recent.map((id) => tracks.find((t) => t.id === id)).filter(Boolean);
  if (cat !== "all") r = r.filter((t) => t.cat === cat);
  if (q)
    r = r.filter(
      (t) =>
        t.name.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q),
    );
  return r;
}

// ── RENDER ──
function render() {
  const list = filtered();
  document.getElementById("listCount").textContent =
    list.length + " song" + (list.length !== 1 ? "s" : "");
  if (!list.length) {
    document.getElementById("trackList").innerHTML =
      `<div class="empty"><div class="ei">🎵</div><p>${tracks.length === 0 ? "Drop your audio files above<br>to start building your library." : "No tracks match this filter."}</p></div>`;
    return;
  }
  document.getElementById("trackList").innerHTML = list
    .map((t, i) => {
      const on = cur === i;
      const col = CC[t.cat] || "#666";
      return `<div class="ti ${on ? "on" : ""}" onclick="playIdx(${i})">
      <div class="tn"><span class="nl">${i + 1}</span><div class="eq"><div class="eb"></div><div class="eb"></div><div class="eb"></div></div></div>
      <div class="tinfo"><div class="tem">${t.emoji}</div><div><div class="tname">${t.name}</div><div class="tartist">${t.artist}</div></div></div>
      <span class="tcat" style="color:${col};background:${col}18;border:1px solid ${col}28">${t.cat}</span>
      <div class="tdur">${t.dur}</div>
    </div>`;
    })
    .join("");
}
function updateCounts() {
  document.getElementById("c-all").textContent = tracks.length;
  ["pop", "ost", "urdu", "lofi", "other"].forEach(
    (c) =>
      (document.getElementById("c-" + c).textContent = tracks.filter(
        (t) => t.cat === c,
      ).length),
  );
}
function fmt(s) {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60),
    sc = Math.floor(s % 60);
  return m + ":" + (sc < 10 ? "0" : "") + sc;
}
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2200);
}

render();
updateCounts();
