# QuickNotes System Design

This project has two parts. The first is a small web page that talks to a practice API (JSONPlaceholder) to load, create and delete notes. The second is a set of design documents for the real QuickNotes service, covering the API, the data model and the architecture for 1 million users.

## API client features

- Load 10 notes from the server with a GET request
- Create a note with a POST request (the title is required and must be 100 characters or fewer, and the body is optional)
- Delete a note with a DELETE request
- Loading, success, error and empty messages shown on the page
- Buttons are disabled while a request is running
- User text is added to the page with `textContent` only

## How to run the API client

1. Clone the repository: `git clone https://github.com/elmbondo/quicknotes-system-design.git`
2. Open the folder in VS Code.
3. Right-click `index.html` and choose **Open with Live Server**. You need an internet connection, because the page talks to JSONPlaceholder.
4. Click **Load notes**, then try creating and deleting a note.

JSONPlaceholder is a fake API. It replies as if a note was created or deleted, but it does not really save anything. A deleted note comes back the next time you load, and a note you create is only kept on the page until you reload.

## Design documents

- [API design](docs/api-design.md)
- [Data model](docs/data-model.md)
- [Architecture](docs/architecture.md)

## What I learned

- How a client and a server talk using HTTP, and why `fetch` needs a `response.ok` check, because it does not throw on a 404 or a 500.
- How `async` and `await` with `try`, `catch` and `finally` make loading and error states easier to handle, and why buttons should be disabled while a request runs.
- How to design a REST API with plural nouns, the right methods and status codes, and a clear error format.
- How to turn a feature into tables, keys and a join table, and why an index on `user_id` matters when the data grows.
- How to estimate load for a system, and how a CDN, cache, read replica and queue each solve a different problem.