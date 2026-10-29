# QuickNotes Architecture

This document describes how QuickNotes could be built as an online service for a million users. It covers the requirements, a load estimate, the architecture, how two requests travel through it, and the trade-offs.

## 1. Requirements

### Functional requirements

- A user can sign up and log in.
- A user can create, read, update and delete their own notes.
- Notes can have a category (personal, work or study) and tags.
- A user can search their notes and filter them by category.
- A user can open their notes from any device.

### Non-functional requirements

- **Fast:** most requests should get a reply in under 300 ms.
- **Available:** the service should be up 99.9% of the time, so one broken machine must not take it down.
- **Scalable:** it should handle 1 million users, and grow by adding machines.
- **Secure:** all traffic uses HTTPS, passwords are stored as hashes, and users can only reach their own notes.
- **Durable:** notes must not be lost, so the database is backed up regularly.

## 2. Load estimate for 1 million users

### Assumptions

- 1,000,000 registered users, and 20% are active each day, which is 200,000 daily active users
- Each active user creates 3 notes and edits or deletes 2 more, so 5 writes per day
- Each active user opens or lists their notes 30 times a day, so 30 reads per day
- One note takes about 1 KB of storage (text and details)
- One day has 86,400 seconds, and peak traffic is 5 times the average

### Results

| What | Per day | Average per second | Peak per second (5x) |
|------|---------|--------------------|----------------------|
| Reads | 200,000 x 30 = 6,000,000 | about 69 | about 347 |
| Writes | 200,000 x 5 = 1,000,000 | about 12 | about 58 |

**Storage per year:** 200,000 users x 3 new notes = 600,000 notes a day. At 1 KB each that is 600 MB a day, and 600 MB x 365 is about **219 GB per year**. If indexes and tags add about 50% (an assumption), I should plan for about 330 GB per year.

**Read-heavy or write-heavy:** QuickNotes is read-heavy, with about 6 reads for every write. So caching and a read replica will help a lot.

**Server count:** peak traffic is about 405 requests per second in total. If one app server can handle about 200 requests per second (an assumption), two servers can just cover the peak. I would run three, so one can fail and the others still cope.

## 3. Architecture diagram

```
     +----------------------------------+
     |    Client (browser or phone)     |
     +----------------------------------+
         |         |              |
         1         2              3
         v         v              v
     +-------+ +-------+ +-----------------+
     |  DNS  | |  CDN  | |  Load balancer  |
     +-------+ +-------+ +-----------------+
                                  |
                         +--------+--------+
                         |                 |
                         v                 v
                 +---------------+ +---------------+
                 | App server 1  | | App server 2  |
                 +---------------+ +---------------+
                         |                 |
                         +--------+--------+
                                  |
                                  +--- reads ---------> [ Cache ] --(on a miss)--> [ Read replica ]
                                  |
                                  +--- writes --------> [ Primary database ] --(copies every change)--> [ Read replica ]
                                  |
                                  +--- slow jobs -----> [ Queue ] --> [ Worker ] --(sends emails, exports notes)
```

How to read it:

1. The client asks DNS for the IP address of `quicknotes.com`.
2. Static files (the HTML, CSS and JavaScript) come from the CDN.
3. API requests go through the load balancer to one of the app servers.

The read replica appears twice to keep the lines short, but it is one component. In production I would run three app servers, and the diagram shows two to keep it readable.

## 4. What each component does

- **Client:** it shows the app to the user and sends their requests to the API.
- **DNS:** it turns the name `quicknotes.com` into an IP address so the client knows where to send requests.
- **CDN:** it keeps copies of the static files on servers close to the user, so pages load fast and our servers do less work.
- **Load balancer:** it spreads requests across the app servers so none is overloaded, and it stops sending traffic to one that is down.
- **App servers:** they run the QuickNotes code (login, validation, notes), and they keep no data themselves, so I can add more whenever traffic grows.
- **Cache:** it keeps recent note lists in fast memory so the database does not repeat the same work again and again.
- **Primary database:** it is the single place where all changes are written, so the data stays correct.
- **Read replica:** it is a live copy of the primary that answers read requests, which takes load off the primary.
- **Queue:** it holds slow jobs, like sending emails, so the app server can reply to the user straight away.
- **Worker:** it takes jobs from the queue one by one and does the slow work in the background.

## 5. Request flows

### GET /notes

1. The client sends `GET /notes` with its token over HTTPS. DNS has already given it the address.
2. The load balancer picks a healthy app server.
3. The app server checks the token and finds out which user is asking.
4. The app server looks in the cache for that user's notes (for example the key `notes:user:1:page:1`).
5. If the notes are in the cache (a hit), they are returned straight away with 200 OK.
6. If not (a miss), the app server asks the read replica: `SELECT ... FROM notes WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`.
7. The app server saves the result in the cache for about a minute, so the next request is fast.
8. The app server sends the notes back as JSON with 200 OK.

### POST /notes

1. The client sends `POST /notes` with its token and the note as JSON.
2. The load balancer picks a healthy app server.
3. The app server checks the token and validates the note. The title is required and must be 100 characters or fewer, and the category must be allowed. If not, it replies with 400 Bad Request.
4. The app server saves the note in the primary database, together with its tags, in one transaction so it either all saves or none of it does.
5. The app server clears that user's cached note lists, so the next GET shows the new note.
6. If this is the user's first note, the app server puts a "send tips email" job on the queue. A worker sends it later, so the user does not wait.
7. The app server replies with 201 Created and the new note as JSON.

## 6. Trade-offs

1. **Cache: speed against fresh data.** The cache makes note lists fast and protects the database, but data in it can be slightly out of date. I clear the user's cache on every write and set a short expiry, so the risk is small. It is also one more thing to run and watch.
2. **Read replica: less load against a short delay.** The replica takes the read traffic, but it can lag a moment behind the primary. A user could save a note and not see it on the next load. To avoid that, I would read from the primary for a few seconds after a user writes.
3. **Queue and worker: fast replies against a delay.** Users do not wait for slow jobs like emails, but those jobs happen a little later. It also means running and monitoring the queue and the workers.
4. **One primary database: simple and correct against a limit on writes.** With one place for writes, the data stays consistent and the design stays simple. It limits how much writing the system can do, but at about 58 writes per second at peak that is not a problem. If it ever is, the notes could be split across several databases by user id.

## 7. Avoiding single points of failure

A single point of failure is a part that stops the whole system if it breaks. This is how each part is protected:

- **App servers:** there are three or more identical copies. If one dies, the load balancer sends traffic to the others.
- **Load balancer:** I use a managed load balancer that runs on several machines, or two in a pair, so one failing does not matter.
- **Primary database:** the read replica keeps a copy of the data, and it can be promoted to primary if the primary fails. Backups are taken every night and I would test restoring them.
- **Cache:** it runs as a small group of nodes. If it fails, requests fall back to the read replica. The app is slower but still works.
- **Queue and workers:** the queue is a managed, replicated service, and there are several workers. A job that fails goes back on the queue and is tried again.
- **DNS and CDN:** both are run by providers with many servers around the world, so one machine failing does not affect users.
- **A whole data center:** I would spread the app servers and databases over at least two availability zones, so one zone going down does not take the service with it.