
const $ = id => document.getElementById(id);

// Initial demo posts
const defaultPosts = [
  {
    id: 1,
    text: "It would be great to have more interactive events for students.",
    likes: 3,
    time: Date.now() - 3600000
  },
  {
    id: 2,
    text: "A suggestion: create a space where everyone can share ideas freely.",
    likes: 1,
    time: Date.now() - 7200000
  }
];

const defaultOptions = [
  "More community events",
  "Better communication",
  "New activities",
  "More feedback opportunities"
];

// Load saved data from the browser
function load(key, fallback) {
  try {
    const data = localStorage.getItem(key);
    return data === null ? fallback : JSON.parse(data);
  } catch {
    return fallback;
  }
}

let posts = load("ov_posts", defaultPosts);
let votes = load("ov_votes", [0, 0, 0, 0]);
let voted = load("ov_voted", false);
let liked = load("ov_liked", []);
let moderator = false;
let currentFilter = "all";

// Save data in local browser storage
function save() {
  localStorage.setItem("ov_posts", JSON.stringify(posts));
  localStorage.setItem("ov_votes", JSON.stringify(votes));
  localStorage.setItem("ov_voted", JSON.stringify(voted));
  localStorage.setItem("ov_liked", JSON.stringify(liked));
}

// Prevent HTML injection in user-generated posts
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

// Display how long ago a post was submitted
function timeAgo(time) {
  const mins = Math.max(
    0,
    Math.floor((Date.now() - time) / 60000)
  );

  if (mins < 1) return "Just now";
  if (mins < 60) return mins + " min ago";
  if (mins < 1440) return Math.floor(mins / 60) + " hr ago";

  return Math.floor(mins / 1440) + " days ago";
}

// Display community feedback
function renderPosts() {
  const list = [...posts];

  if (currentFilter === "popular") {
    list.sort((a, b) => b.likes - a.likes);
  } else {
    list.sort((a, b) => b.time - a.time);
  }

  if (list.length === 0) {
    $("posts").innerHTML = `
      <div class="empty">
        No posts yet. Be the first to share an idea!
      </div>
    `;
  } else {
    $("posts").innerHTML = list.map(post => `
      <article class="post">
        <div class="post-top">
          <span class="post-label">Anonymous member</span>
          <span class="muted">${timeAgo(post.time)}</span>
        </div>

        <p>${escapeHTML(post.text)}</p>

        <div class="post-actions">
          <button class="small-btn" data-like="${post.id}">
            ♡ ${post.likes} Likes
          </button>

          ${moderator ? `
            <button class="small-btn btn-danger"
              data-delete="${post.id}">
              Remove post
            </button>
          ` : ""}
        </div>
      </article>
    `).join("");
  }

  $("postTotal").textContent = posts.length;

  $("likeTotal").textContent = posts.reduce(
    (total, post) => total + post.likes, 0
  );
}

// Display poll options and results
function renderPoll() {
  const total = votes.reduce((sum, value) => sum + value, 0);

  $("pollOptions").innerHTML = defaultOptions.map(
    (option, index) => {
      const percent = total
        ? Math.round(votes[index] / total * 100)
        : 0;

      return `
        <button class="poll-option"
          data-vote="${index}"
          ${voted ? "disabled" : ""}>

          ${voted ? `
            <span class="bar"
              style="width:${percent}%"></span>
          ` : ""}

          <span class="option-text">
            <span>${escapeHTML(option)}</span>
            ${voted ? `<strong>${percent}%</strong>` : ""}
          </span>
        </button>
      `;
    }
  ).join("");

  $("pollStatus").textContent = voted
    ? `${total} total votes · Results shown`
    : "Choose one option to vote.";

  $("voteTotal").textContent = total;
}

// Update the complete interface
function render() {
  renderPosts();
  renderPoll();
}

// Character counter for feedback
$("postText").addEventListener("input", event => {
  $("charCount").textContent =
    event.target.value.length + " / 1000";
});

// Submit anonymous feedback
$("postForm").addEventListener("submit", event => {
  event.preventDefault();

  const text = $("postText").value.trim();

  if (!text) return;

  posts.push({
    id: Date.now(),
    text: text,
    likes: 0,
    time: Date.now()
  });

  save();

  $("postText").value = "";
  $("charCount").textContent = "0 / 1000";

  currentFilter = "all";

  document.querySelectorAll(".tab").forEach(tab => {
    tab.classList.toggle(
      "active",
      tab.dataset.filter === "all"
    );
  });

  render();
});

// Filter posts
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    currentFilter = tab.dataset.filter;

    document.querySelectorAll(".tab").forEach(item => {
      item.classList.toggle("active", item === tab);
    });

    renderPosts();
  });
});

// Like posts and remove posts as moderator
$("posts").addEventListener("click", event => {
  const likeButton = event.target.closest("[data-like]");
  const deleteButton = event.target.closest("[data-delete]");

  if (likeButton) {
    const id = Number(likeButton.dataset.like);

    // One like per post in this browser
    if (liked.includes(id)) return;

    const post = posts.find(item => item.id === id);

    if (!post) return;

    post.likes++;
    liked.push(id);

    save();
    render();
  }

  if (deleteButton && moderator) {
    const id = Number(deleteButton.dataset.delete);

    posts = posts.filter(item => item.id !== id);

    save();
    render();
  }
});

// Vote in the community poll
$("pollOptions").addEventListener("click", event => {
  const button = event.target.closest("[data-vote]");

  if (!button || voted) return;

  const index = Number(button.dataset.vote);

  if (index < 0 || index >= votes.length) return;

  votes[index]++;
  voted = true;

  save();
  renderPoll();
});

// Reset the demo vote on this browser
$("resetVote").addEventListener("click", () => {
  voted = false;

  save();
  renderPoll();
});

// Demo moderator login
$("moderatorForm").addEventListener("submit", event => {
  event.preventDefault();

  if ($("modPassword").value === "mod123") {
    moderator = true;

    $("modStatus").textContent =
      "Demo moderation enabled.";

    $("modStatus").style.color = "green";
    $("modPassword").value = "";

    renderPosts();
  } else {
    $("modStatus").textContent =
      "Incorrect password.";

    $("modStatus").style.color = "red";
  }
});

// Load the interface when the page opens
render();
