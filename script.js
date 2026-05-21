const feedItems = [
  {
    name: "Mira Flash",
    handle: "@miraflash",
    time: "2 мин",
    text: "Открыла комнату про странные новости дня. Уже 800 человек и один спор про роботов в очередях.",
    tag: "#wtfновости",
    reactions: ["🔥 324", "💬 88", "↗ 41"],
  },
  {
    name: "Max Noise",
    handle: "@maxnoise",
    time: "8 мин",
    text: "Соцсеть должна быть как быстрый звонок другу: написал, посмеялся, обсудил, пошёл дальше.",
    tag: "#безфильтра",
    reactions: ["⚡ 512", "💬 129", "↗ 73"],
  },
  {
    name: "Nova Byte",
    handle: "@novabyte",
    time: "14 мин",
    text: "WTF-круги — лучшая идея: один пост для команды, другой для всех, третий только для тех, кто понял мем.",
    tag: "#технологии",
    reactions: ["🧠 205", "💬 47", "↗ 18"],
  },
];

const feedList = document.querySelector("#feed-list");
const postInput = document.querySelector("#post-input");
const counter = document.querySelector("#counter");
const postButton = document.querySelector("#post-button");
const shuffleButton = document.querySelector("#shuffle-button");

function initials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("");
}

function renderFeed(items) {
  feedList.innerHTML = items
    .map(
      (item) => `
        <article class="feed-post">
          <div class="feed-post__header">
            <div class="feed-post__author">
              <span class="avatar">${initials(item.name)}</span>
              <div>
                <strong>${item.name}</strong>
                <div class="feed-post__meta">
                  <span>${item.handle}</span>
                  <span>${item.time}</span>
                  <span>${item.tag}</span>
                </div>
              </div>
            </div>
          </div>
          <p>${item.text}</p>
          <div class="reactions">
            ${item.reactions.map((reaction) => `<button type="button">${reaction}</button>`).join("")}
          </div>
        </article>
      `,
    )
    .join("");
}

function updateCounter() {
  counter.textContent = `${postInput.value.length}/180`;
}

postInput.addEventListener("input", updateCounter);

postButton.addEventListener("click", () => {
  const text = postInput.value.trim();

  if (!text) {
    postInput.focus();
    return;
  }

  feedItems.unshift({
    name: "WTF User",
    handle: "@you",
    time: "сейчас",
    text,
    tag: "#мойwtf",
    reactions: ["⚡ 1", "💬 0", "↗ 0"],
  });

  postInput.value = "";
  updateCounter();
  renderFeed(feedItems);
});

shuffleButton.addEventListener("click", () => {
  renderFeed([...feedItems].sort(() => Math.random() - 0.5));
});

renderFeed(feedItems);
updateCounter();
