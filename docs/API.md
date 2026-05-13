# Voucher Tracker API v2 — Reference

Base URL: `http://localhost:3001/api`

All responses are JSON. Successful responses use `{ data: ... }`. Errors use `{ error: "message" }`.

---

## Vouchers

### `GET /vouchers`
Returns all vouchers sorted by `dateAdded ASC` (oldest first).

**Response**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Amazon Gift Voucher",
      "voucherCode": "AMZN-HDFC-Q1-2025",
      "brand": "Amazon",
      "sourceProgramOrCard": "HDFC Millennia",
      "description": "Q1 2025 RuPay quarterly benefit",
      "voucherType": "Gift Card",
      "value": 500,
      "expiryDate": "2025-06-30T00:00:00.000Z",
      "issueDate": "2025-01-15T00:00:00.000Z",
      "dateAdded": "2025-01-15T10:00:00.000Z",
      "status": "UNREDEEMED",
      "redeemedAt": null,
      "emailId": "user@example.com",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

---

### `GET /vouchers/next?brand=Amazon`
Returns the **oldest eligible unredeemed** voucher. Excludes expired and redeemed.

**Query params**
| Param | Required | Description |
|-------|----------|-------------|
| `brand` | No | Filter by brand. Omit for any brand. |

**Response** — `data` is the voucher or `null` if none available.
```json
{ "data": { ...voucher } }
{ "data": null, "message": "No unredeemed vouchers available" }
```

---

### `GET /vouchers/:id`
Returns a single voucher by ID.

---

### `POST /vouchers`
Creates a new voucher. `dateAdded` is always set server-side.

**Body**
```json
{
  "title": "Amazon Gift Voucher",
  "voucherCode": "AMZN-HDFC-Q1-2025",
  "brand": "Amazon",
  "sourceProgramOrCard": "HDFC Millennia",
  "description": "Q1 RuPay benefit",
  "voucherType": "Gift Card",
  "value": 500,
  "expiryDate": "2025-06-30",
  "issueDate": "2025-01-15",
  "emailId": "user@example.com"
}
```

Required: `title`, `voucherCode`.
All other fields optional. `brand` defaults to `"Uncategorized"`. `issueDate` defaults to now.

**Status codes**
- `201` Created
- `400` Missing required field
- `409` Duplicate `voucherCode`

---

### `PATCH /vouchers/:id/redeem`
Marks a voucher as REDEEMED and sets `redeemedAt` to current time.
Idempotent — safe to call multiple times.

---

### `PATCH /vouchers/:id/unredeem`
Reverts a voucher to UNREDEEMED and clears `redeemedAt`.

---

### `DELETE /vouchers/:id`
Hard-deletes a voucher. Returns `{ "success": true }`.

---

## Cards

### `GET /cards`
Returns all saved cards, ordered by `createdAt ASC`.

### `GET /cards/:id`
Returns a single card.

### `POST /cards`
Creates a card.

**Body**
```json
{
  "accountOwner": "Rushabh Shah",
  "cardName": "HDFC Millennia",
  "bank": "HDFC Bank",
  "email": "user@example.com",
  "mobileNumber": "9876543210",
  "notes": ""
}
```
Required: `accountOwner`, `cardName`, `bank`.
Also persists `bank`, `accountOwner`, `email` to autocomplete table automatically.

### `PATCH /cards/:id`
Partial update — all fields optional.

### `DELETE /cards/:id`
Hard-deletes a card.

---

## Autocomplete

### `GET /autocomplete?field=bank&q=hd`
Returns up to 20 suggestion strings for the given field, ordered by usage frequency.

**Supported fields:** `bank`, `accountOwner`, `email`, `mobileNumber`, `brand`, `sourceProgramOrCard`, `voucherType`

**Response**
```json
{ "data": ["HDFC Bank", "HDFC Diners Black"] }
```

### `POST /autocomplete`
Manually upsert a value. Called automatically when creating vouchers and cards.

**Body**
```json
{ "field": "bank", "value": "HDFC Bank" }
```

---

## Analytics

### `GET /analytics`
Returns computed analytics for charts and dashboard.

**Response shape**
```json
{
  "data": {
    "summary": {
      "total": 12,
      "unredeemed": 8,
      "redeemed": 3,
      "expired": 1,
      "totalValue": 5400,
      "redeemedValue": 950
    },
    "brandBreakdown": [
      { "brand": "Amazon", "total": 3, "unredeemed": 2, "redeemed": 1, "expired": 0 }
    ],
    "monthlyTrend": [
      { "month": "Jan 25", "added": 4, "redeemed": 1 }
    ],
    "statusPie": [
      { "name": "Unredeemed", "value": 8 },
      { "name": "Redeemed",   "value": 3 },
      { "name": "Expired",    "value": 1 }
    ],
    "expiringIn7Days": 1,
    "expiringIn30Days": 3
  }
}
```

---

## Export

### `GET /export/excel`
Downloads a `.xlsx` file with 3 sheets: Vouchers, Dashboard Summary, Monthly Trend.

### `GET /export/pdf`
Downloads a PDF report with cover, summary stats, brand breakdown, trend, and voucher list.

### `POST /export/email`
Triggers the monthly summary email immediately. Requires SMTP env vars to be set.

**Response:** `{ "success": true, "message": "Monthly report email sent" }`

---

## Health

### `GET /health`
```json
{ "status": "ok", "version": "2.0.0", "timestamp": "..." }
```

---

## Status logic

Effective status is computed from stored `status` + `expiryDate`:

| Stored status | expiryDate | Effective status |
|---|---|---|
| `UNREDEEMED` | null or future | `UNREDEEMED` |
| `UNREDEEMED` | past | `EXPIRED` |
| `REDEEMED` | any | `REDEEMED` |

The `status` field in API responses always reflects the effective status.

---

## Business rules enforced

- `dateAdded` set server-side at creation — never trusted from frontend
- Viewing/fetching a voucher never changes its status
- Only `PATCH .../redeem` changes status to REDEEMED
- `GET /vouchers/next` never returns REDEEMED or effectively-EXPIRED vouchers
- Duplicate `voucherCode` → HTTP 409
- `PATCH .../redeem` is idempotent — double-call safe
