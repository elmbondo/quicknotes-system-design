// the practice API - it pretends to save things but does not really store them
const API_URL = "https://jsonplaceholder.typicode.com/posts";

// find the parts of the page I need
const loadBtn = document.querySelector("#load-btn");
const statusText = document.querySelector("#status");
const form = document.querySelector("#note-form");
const titleInput = document.querySelector("#title-input");
const bodyInput = document.querySelector("#body-input");
const submitBtn = document.querySelector("#submit-btn");
const list = document.querySelector("#notes-list");

// the notes I am showing on the page right now
let notes = [];

// one function for every request - it checks the status and throws on errors
async function request(url, options) {
  const response = await fetch(url, options);

  // fetch does not throw on 404 or 500, so I check it myself
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  // a 204 reply has no body, so there is nothing to read
  let data = null;
  if (response.status !== 204) {
    data = await response.json();
  }

  return { status: response.status, data: data };
}

// GET - loads the first 10 notes
function getNotes() {
  return request(`${API_URL}?_limit=10`);
}

// shows a message, the type is "loading", "success" or "error"
function showStatus(message, type) {
  statusText.textContent = message;
  statusText.className = type;
}

// turns the buttons off while a request is running, and back on after
function setBusy(busy) {
  loadBtn.disabled = busy;
  submitBtn.disabled = busy;
  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.disabled = busy;
  });
}

// draws the notes on the page, or the empty message if there are none
function render() {
  list.replaceChildren(); // empty the list first

  if (notes.length === 0) {
    const empty = document.createElement("li");
    empty.classList.add("empty-message");
    empty.textContent = "No notes yet. Click Load notes, or create one below.";
    list.appendChild(empty);
    return;
  }

  notes.forEach((note) => {
    const li = document.createElement("li");
    li.classList.add("note-card");

    const info = document.createElement("div");

    const title = document.createElement("h3");
    title.textContent = note.title; // textContent only, never innerHTML

    const body = document.createElement("p");
    body.textContent = note.body;

    info.appendChild(title);
    info.appendChild(body);

    li.appendChild(info);
    // the Delete button gets added here in Task 3
    list.appendChild(li);
  });
}

// runs when the Load notes button is clicked
async function handleLoad() {
  showStatus("Loading notes...", "loading");
  setBusy(true);

  try {
    const result = await getNotes();

    // keep only what I need from each note
    notes = result.data.map((post) => {
      return {
        key: String(post.id),
        id: post.id,
        title: post.title,
        body: post.body,
        isLocal: false,
      };
    });

    render();

    if (notes.length === 0) {
      showStatus("The server has no notes to show.", "success");
    } else {
      showStatus(`Loaded ${notes.length} notes from the server.`, "success");
    }
  } catch (error) {
    showStatus("Could not load the notes. Please try again.", "error");
    console.error(error);
  } finally {
    setBusy(false); // runs whether it worked or not
  }
}

loadBtn.addEventListener("click", handleLoad);

// show the empty message when the page first opens
render();