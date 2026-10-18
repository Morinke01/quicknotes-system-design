# QuickNotes system architecture

## Requirements

### Functional requirements

- Users can register, authenticate, and access only their own notes.
- Users can create, read, update, and delete notes with a required title and optional body.
- Users can add tags and list or filter notes by tag.
- The service returns clear validation and authorization errors.

### Non-functional requirements

- Serve 1 million registered users with room to scale horizontally as traffic grows.
- Keep common note-list reads fast and available; a small amount of cache or replica staleness is acceptable.
- Protect user data with authentication, authorization, encrypted transport, backups, and durable database storage.
- Recover from an app-server or availability-zone failure without losing committed notes.
- Keep the initial design understandable and cost-effective; add sharding only after measurements require it.

## Load estimate for 1 million users

Use the supplied QuickNotes assumptions: 10 million registered users in the worked example and 20% active daily, with five note writes and 20 note-list reads per active user per day. For this assignment's **1 million registered user** target, preserve those same usage ratios:

- Daily active users: 1,000,000 × 20% = **200,000 DAU**.
- Writes: 200,000 × 5 = 1,000,000 notes/day; divide by 100,000 seconds/day ≈ **10 writes/second average**, or about **50 writes/second at 5× peak**.
- Reads: 200,000 × 20 = 4,000,000 list reads/day; divide by 100,000 ≈ **40 reads/second average**, or about **200 reads/second at 5× peak**.
- Storage: 1,000,000 notes/day × 500 bytes = 500 MB/day; × 365 ≈ **182.5 GB/year** (about 180 GB using rounded units), before indexes, replicas, and backups.

The service is read-heavy, with roughly four reads per write. Cache note lists and send read queries to a replica; send writes to the primary. These are planning estimates, not capacity guarantees, so observe real traffic and database latency before scaling further.

## Architecture diagram

```text
                              ┌──────────────┐
                              │ DNS          │
                              │ quicknotes.io│
                              └──────┬───────┘
                                     │ resolve domain
                                     v
   ┌─────────────────┐ static ┌───────────────┐
   │ Client          │───────>│ CDN           │
   │ browser/mobile  │        │ HTML/CSS/JS   │
   └───────┬─────────┘        └───────────────┘
           │ API requests (HTTPS/JSON)
           v
   ┌─────────────────┐
   │ Load balancer   │  health checks; route to healthy instances
   └───────┬─────────┘
           │
       ┌───┴───────────────┐
       v                   v
   ┌──────────┐        ┌──────────┐
   │ App 1    │        │ App 2    │  stateless, multi-zone
   └─┬──┬──┬──┘        └─┬──┬──┬──┘
     │  │  │             │  │  │
     │  │  └──── jobs ───┼──┼──┼──────────┐
     │  │                │  │            v
     │  │                │  │       ┌──────────────┐       ┌──────────┐
     │  │                │  └──────>│ Cache        │       │ Worker   │
     │  │                └─────────>│ Redis        │       │ exports, │
     │  └──── writes ─────────────>│              │       │ emails   │
     │                              └──────────────┘       └────▲─────┘
     │                                                           │
     v                                                           │
   ┌────────────────────┐      replicate      ┌──────────────┐   │
   │ Primary database   │────────────────────>│ Read replica│   │
   │ (authoritative)    │                     │ (read queries)│  │
   └────────────────────┘                     └──────────────┘   │
     │                                                           │
     └──── enqueue slow/background work ──────>[ Message queue ]─┘
```

## Component responsibilities

- **Client** renders the interface and sends authenticated HTTPS requests to the API.
- **DNS** maps the public QuickNotes name to the service endpoints.
- **CDN** serves versioned static files close to users, reducing page latency and origin traffic.
- **Load balancer** distributes requests across healthy app servers and removes unhealthy instances from rotation.
- **App servers** validate identity and input and run API logic; stateless replicas can be added without moving user data.
- **Cache** keeps hot note lists in memory so repeated reads return faster and the databases do less work.
- **Primary database** stores the authoritative users, notes, and tags and accepts all note writes.
- **Read replica** serves read queries to reduce load on the primary, accepting a small replication delay.
- **Message queue** buffers slow tasks so a traffic burst does not block API responses or overwhelm workers.
- **Worker** processes queued work such as email and export jobs outside the user's request path.

## GET /notes flow

1. The client resolves the QuickNotes hostname with DNS; it downloads the static page assets from the CDN (usually cached after the first visit).
2. The client sends `GET /v1/notes` with its access token to the load balancer.
3. The load balancer selects a healthy stateless app server, which validates the token and derives the user's ID.
4. The app checks the shared cache for that user's note list. On a hit, it returns the cached page; on a miss, it queries the read replica and stores the result in cache with a short TTL.
5. The app returns the JSON page to the client. If the replica is briefly behind the primary, the list may be slightly stale; a read-after-write can be sent to the primary or served from an invalidated/repopulated cache.

## POST /notes flow

1. The client sends `POST /v1/notes` with its access token and JSON title/body through the load balancer.
2. A healthy app server validates the token and fields, then inserts the note into the primary database in a transaction.
3. After the database confirms the write, the app invalidates the user's cached note list and returns `201 Created` with the new note.
4. The primary asynchronously replicates the committed row to the read replica. Slow optional follow-up work, such as a notification, is added to the message queue and handled by a worker.

## Trade-offs and failure handling

- **Fast reads versus freshest data:** caching and read replicas reduce latency and primary load, but may briefly return an older list. QuickNotes accepts short staleness for ordinary lists and invalidates the affected user's cache after writes.
- **Simplicity versus independent scaling:** a stateless monolith is easier to build and operate at launch; splitting services may let teams scale them independently later, but adds network failures and operational overhead.
- **Availability versus cost:** multi-zone app servers, a database standby, replicas, and durable backups improve recovery, but require more infrastructure and monitoring.
- **Synchronous work versus quick responses:** queueing email and export tasks returns control quickly and absorbs bursts, but introduces eventual completion and requires retries and dead-letter handling.

There is no single point of failure in the production plan: run app servers in multiple availability zones behind a redundant managed load balancer; configure the database with a same-region standby and tested automatic failover; deploy Redis with replication/failover; use a durable replicated queue and multiple workers; and rely on a multi-zone CDN and object/static origin. Monitor each layer and test recovery. DNS should use a resilient provider and health-checked records; DNS caching means endpoint changes may take time to reach every client.
