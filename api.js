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
    title.textContent = note.title; 

    const body = document.createElement("p");
    body.textContent = note.body;

    info.appendChild(title);
    info.appendChild(body);

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.classList.add("delete-btn");
    deleteBtn.dataset.key = note.key;

    li.appendChild(info);
    li.appendChild(deleteBtn);
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

// POST - creates a note
function createNote(title, body) {
  return request(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: title, body: body, userId: 1 }),
  });
}

// runs when the form is submitted
async function handleSubmit(event) {
  event.preventDefault(); // stop the page from reloading

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  if (title === "") {
    showStatus("Please enter a title.", "error");
    return;
  }
  if (title.length > 100) {
    showStatus("The title must be 100 characters or fewer.", "error");
    return;
  }

  showStatus("Saving the note...", "loading");
  setBusy(true);

  try {
    const result = await createNote(title, body);
    const created = result.data;

    // the server sends the note back with a new id, so I show it at the top
    notes.unshift({
      key: `new-${Date.now()}`,
      id: created.id,
      title: created.title,
      body: created.body,
      isLocal: true,
    });

    render();
    showStatus(`Note created (status ${result.status}, id ${created.id}).`, "success");
    form.reset(); // clear the form
    titleInput.focus();
  } catch (error) {
    showStatus("Could not create the note. Please try again.", "error");
    console.error(error);
  } finally {
    setBusy(false);
  }
}

form.addEventListener("submit", handleSubmit);

// DELETE - removes a note from the server
function deleteNote(id) {
  return request(`${API_URL}/${id}`, { method: "DELETE" });
}

// runs when anything in the list is clicked (one listener for every Delete button)
async function handleDelete(event) {
  if (!event.target.classList.contains("delete-btn")) {
    return;
  }

  const key = event.target.dataset.key;
  const note = notes.find((n) => n.key === key);
  if (!note) {
    return;
  }

  /*
    How I handle the fake server:
    JSONPlaceholder never really saves the notes I create, so a note I just
    created does not exist on the server and there is nothing to delete there.
    For those notes I only remove them from the list and I do not send a request.
    Notes that were loaded from the server do get a real DELETE request, and it
    replies with status 200. But the server only pretends to delete them, so
    they come back when I click Load notes again. That is normal for this
    practice API.
  */
  if (note.isLocal) {
    notes = notes.filter((n) => n.key !== key);
    render();
    showStatus("Note removed. It was never saved on the server, so no request was sent.", "success");
    return;
  }

  showStatus("Deleting the note...", "loading");
  setBusy(true);

  try {
    const result = await deleteNote(note.id);
    notes = notes.filter((n) => n.key !== key);
    render();
    showStatus(`Note deleted (status ${result.status}).`, "success");
  } catch (error) {
    showStatus("Could not delete the note. Please try again.", "error");
    console.error(error);
  } finally {
    setBusy(false);
  }
}

list.addEventListener("click", handleDelete);