# QuickNotes System Design

QuickNotes is a small browser client that demonstrates GET, POST, and DELETE requests against the JSONPlaceholder practice API, paired with design documents for a production notes service. The front end is intentionally static; the documents describe the backend architecture, REST API, and PostgreSQL data model that a real service could implement.

## Run the API client

You need Python 3 (or another static HTTP server) and an internet connection to reach JSONPlaceholder.

1. Clone this repository or download its files.
2. From the repository root, start a local web server:

   ```bash
   python3 -m http.server 8000
   ```

3. Open [http://localhost:8000](http://localhost:8000) in a browser.
4. Choose **Load notes**, or enter a title and optional body and choose **Create note**. Use a note's **Delete** button to remove it from the current page.

JSONPlaceholder is a practice API: it returns simulated create/delete responses but does not persist changes. Newly created notes are displayed in the current page session, and a reload fetches the server's sample posts again.

## Design documents

- [REST API design](docs/api-design.md)
- [Data model](docs/data-model.md)
- [System architecture](docs/architecture.md)

## What I learned

- A reusable request helper can centralize fetch behavior, HTTP error handling, and response parsing.
- User-provided content should be added with `textContent`, and requests should expose loading, success, error, and empty states.
- A read-heavy service can use a cache and read replicas, while writes remain directed to the primary database.
- Large files belong in object storage, and slow work can be moved to a queue and worker so users do not wait for it.
- A relational schema and explicit ownership constraints help keep users, notes, and tags consistent.
