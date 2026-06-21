# high-performance-products-api

A production-grade backend service built for paginating and searching over large product databases containing hundreds of thousands of records. This API uses optimized keyset (cursor) pagination, composite indexing, and database-level seeding.

---

## Tech Stack
- **Runtime**: Node.js
- **Web Framework**: Express
- **Database**: PostgreSQL (hosted on Neon Serverless)
- **Database Client**: `pg` (PostgreSQL Connection Pooling)
- **Development Tooling**: `nodemon`

---

## Architecture

```
                  +------------------+
                  |      Client      |
                  +--------+---------+
                           |
                           | HTTP Requests
                           v
                  +--------+---------+
                  |   Express API    |
                  |  (GET /products) | <---+ (GET /health)
                  +--------+---------+     |
                           |               v
                           | Call          +------------------+
                           v               |  DB Conn Check   |
                  +--------+---------+     +--------+---------+
                  | Products Service |              |
                  +--------+---------+              |
                           |                        |
                           | Query                  |
                           v                        v
                  +--------+------------------------+---------+
                  |             PostgreSQL (Neon)             |
                  |                                           |
                  |  +-------------------------------------+  |
                  |  |          Products Table             |  |
                  |  |     (200,000 Seeded Products)       |  |
                  |  +------------------^------------------+  |
                  +---------------------|---------------------+
                                        |
                             Populates  |
                                        |
                              +---------+---------+
                              |    Seed Script    |
                              | (generate_series) |
                              +-------------------+
```

---

## Database Schema & Indexes

### Schema Design
```sql
CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    category VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

### Indexing Strategy
To support fast lookups, filter matches, and descending pagination ordering:

1. **`idx_products_category_created_at_id`**
   - **Fields**: `(category, created_at DESC, id DESC)`
   - **Purpose**: Handles queries filtered by `category` and ordered by `created_at DESC`. By including `id DESC` in the index, we guarantee deterministic ordering for cursor comparison (resolving ties on identical timestamps) and benefit from **Index Only Scans**.

2. **`idx_products_created_at_id`**
   - **Fields**: `(created_at DESC, id DESC)`
   - **Purpose**: Optimizes global catalog fetches (where no category filter is applied) sorted newest first.

---

## Architecture Decisions: Pagination Design

### Why Keyset Pagination Wins over Offset Pagination

| Dimension | Offset Pagination (`OFFSET + LIMIT`) | Keyset Pagination (Cursor) |
| :--- | :--- | :--- |
| **Complexity & Performance** | **$O(N)$** — Database must scan and sort all preceding rows up to the offset, then discard them. Latency degrades progressively on deep pages. | **O(log N) index seek + O(limit) retrieval**. In practice, latency remains nearly constant even at large page depths. |
| **Real-time Inserts** | Causes **duplicate records** as newly added items push read items onto subsequent pages. | **Cursor-based pagination prevents duplicate records caused by inserts that shift row positions between requests.** |
| **Real-time Updates** | Causes **skipped records** when items move position in the sorting order. | **Using created_at as the immutable ordering key prevents products from moving between pages during browsing sessions.** |

### Keyset Cursor Contract
The cursor is a Base64-encoded string representation of a JSON payload mapping the last element of the page:
```json
{
  "t": 1782065298799, 
  "i": "13"
}
```
- `t`: Epoch millisecond timestamp of `created_at`.
- `i`: Product database `id` (breaks sorting ties).

---

## Performance

- **Seed Time**: ~6.3 seconds for 200,000 products
- **Dataset Size**: 200,000 products
- **Pagination Strategy**: Keyset (Cursor) Pagination
- **Index Strategy**:
  - `(created_at DESC, id DESC)`
  - `(category, created_at DESC, id DESC)`
- **Expected Query Complexity**:
  - **Index Seek**: O(log N)
  - **Fetch**: O(limit)

The API avoids OFFSET-based scans entirely and relies on indexed keyset lookups, ensuring predictable query performance even at deep pagination levels. Latency remains effectively constant even at deep page depths because queries seek directly into indexed data rather than scanning discarded rows.

---

## Local Setup & Seeding

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy the environment template and insert your database credentials:
```bash
cp .env.example .env
```
Inside `.env`:
```env
PORT=3000
DATABASE_URL=postgresql://<username>:<password>@<host>/<dbname>?sslmode=require
```

### 3. Seed Database
Execute the optimized seeder script to populate exactly 200,000 products:
```bash
node scripts/seed.js
```
*Note: Seeding is idempotent and completes in under 10 seconds because it leverages PostgreSQL's native `generate_series()` function on the server side.*

### 4. Start the Application
Run the local development server:
```bash
npm run dev
```

---

## API Endpoints

### 1. Health Status check
`GET /api/health`

Verifies server status and queries the PostgreSQL database (`SELECT NOW()`) to validate connection health.

**Example Request**:
```bash
curl http://localhost:3000/api/health
```

**Example Response**:
```json
{
  "status": "ok",
  "db": "connected",
  "time": "2026-06-21T18:08:24.368Z"
}
```

---

### 2. Product Listing API
`GET /api/products`

Retrieves a chronologically ordered list of products using keyset cursor pagination.

#### Query Parameters
- `limit` (optional, default: `20`, max: `100`): Number of records to return.
- `category` (optional): Filter products by category name.
- `cursor` (optional): Base64-encoded cursor value for subsequent page requests.

**Example Request (First Page)**:
```bash
curl "http://localhost:3000/api/products?limit=2&category=Electronics"
```

**Response**:
```json
{
  "data": [
    {
      "id": "2",
      "name": "Product 2",
      "description": "This is the description for Product 2",
      "price": "31.15",
      "category": "Electronics",
      "created_at": "2026-06-21T18:08:19.799Z",
      "updated_at": "2026-06-21T18:08:19.799Z"
    },
    {
      "id": "4",
      "name": "Product 4",
      "description": "This is the description for Product 4",
      "price": "637.84",
      "category": "Electronics",
      "created_at": "2026-06-21T18:08:17.799Z",
      "updated_at": "2026-06-21T18:08:17.799Z"
    }
  ],
  "nextCursor": "eyJ0IjoxNzgyMDY1Mjk3Nzk5LCJpIjoiNCJ9",
  "hasMore": true
}
```

**Example Request (Subsequent Page)**:
```bash
curl "http://localhost:3000/api/products?limit=2&category=Electronics&cursor=eyJ0IjoxNzgyMDY1Mjk3Nzk5LCJpIjoiNCJ9"
```
