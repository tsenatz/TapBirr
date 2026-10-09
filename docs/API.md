# TapBirr API Contract & Specification

This document defines the REST API contract between the **Flutter Mobile App** (`apps/mobile`) and the **Express Backend API** (`apps/api`).

---

## 1. General Principles & Standards

### Base URL
- **Development**: `http://localhost:5000/api` (or LAN IP for physical mobile devices)
- **Production**: `https://api.tapbirr.com/api`

### Headers
- `Content-Type: application/json`
- `Accept: application/json`
- `Authorization: Bearer <JWT_TOKEN>` *(for protected routes)*

---

## 2. Standard Response & Error Formats

### Standard Success Response (General Format)
```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully"
}
```

### Standard Error Response Format
When any request fails (HTTP 4xx / 5xx), the backend will always return this standard JSON structure:

```json
{
  "success": false,
  "errorCode": "INVALID_CREDENTIALS",
  "message": "Incorrect email or password.",
  "details": null
}
```

#### Common Error Codes
| HTTP Status | Error Code | Description |
| :--- | :--- | :--- |
| `400` | `VALIDATION_ERROR` | Request payload has missing or invalid fields |
| `401` | `UNAUTHORIZED` | Token missing, invalid, or expired |
| `401` | `INVALID_CREDENTIALS` | Incorrect login email/phone or password |
| `403` | `FORBIDDEN` | Access denied for this resource |
| `404` | `NOT_FOUND` | Resource (user, transaction, payment) does not exist |
| `409` | `CONFLICT` | Resource already exists (e.g., email or phone already registered) |
| `500` | `INTERNAL_SERVER_ERROR` | Unexpected server failure |

---

## 3. Authentication Endpoints

### 3.1 Register User
- **Route**: `POST /api/auth/register`
- **Auth Required**: No

#### Request JSON
```json
{
  "fullName": "Abebe Bikila",
  "email": "user@example.com",
  "phoneNumber": "+251911223344",
  "password": "mypassword123"
}
```

#### Response JSON (`201 Created`)
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "usr_101",
  "user": {
    "id": "usr_101",
    "fullName": "Abebe Bikila",
    "email": "user@example.com",
    "phoneNumber": "+251911223344"
  }
}
```

---

### 3.2 Login User
- **Route**: `POST /api/auth/login`
- **Auth Required**: No

#### Request JSON
```json
{
  "email": "user@example.com",
  "password": "mypassword123"
}
```

#### Response JSON (`200 OK`)
```json
{
  "token": "abc123xyz_token",
  "userId": "1",
  "user": {
    "id": "1",
    "fullName": "Abebe Bikila",
    "email": "user@example.com",
    "phoneNumber": "+251911223344"
  }
}
```

---

## 4. Payment Endpoints

### 4.1 Initiate Payment
- **Route**: `POST /api/payments/initiate`
- **Auth Required**: Yes (`Bearer <token>`)

#### Request JSON
```json
{
  "amount": 500,
  "currency": "ETB",
  "paymentMethod": "TELEBIRR",
  "description": "Merchant Payment"
}
```

#### Response JSON (`200 OK` or `201 Created`)
```json
{
  "checkoutUrl": "https://bank-gateway.com/pay/123",
  "transactionId": "txn_987",
  "status": "PENDING"
}
```

---

### 4.2 Payment Callback / Webhook
- **Route**: `POST /api/payments/callback`
- **Auth Required**: Gateway signature verification / Secret header

#### Request JSON (Sent by Payment Gateway)
```json
{
  "transactionId": "txn_987",
  "gatewayReference": "GW-5582910",
  "status": "SUCCESS",
  "amount": 500,
  "currency": "ETB",
  "timestamp": "2026-10-05T20:30:00Z"
}
```

#### Response JSON (`200 OK`)
```json
{
  "success": true,
  "message": "Callback processed successfully"
}
```

---

### 4.3 Check Payment Status
- **Route**: `GET /api/payments/:id/status`
- **Auth Required**: Yes (`Bearer <token>`)

#### Response JSON (`200 OK`)
```json
{
  "transactionId": "txn_987",
  "status": "SUCCESS",
  "amount": 500,
  "currency": "ETB",
  "paidAt": "2026-10-05T20:32:10Z"
}
```

---

## 5. Transaction Endpoints

### 5.1 List Transactions
- **Route**: `GET /api/transactions`
- **Auth Required**: Yes (`Bearer <token>`)
- **Query Parameters**: `?page=1&limit=20&status=SUCCESS`

#### Response JSON (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "id": "txn_987",
      "amount": 500,
      "currency": "ETB",
      "type": "PAYMENT",
      "status": "SUCCESS",
      "recipient": "Merchant Store",
      "createdAt": "2026-10-05T20:30:00Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 1,
    "totalCount": 1
  }
}
```

---

### 5.2 Get Transaction Details
- **Route**: `GET /api/transactions/:id`
- **Auth Required**: Yes (`Bearer <token>`)

#### Response JSON (`200 OK`)
```json
{
  "success": true,
  "transaction": {
    "id": "txn_987",
    "amount": 500,
    "currency": "ETB",
    "fee": 0,
    "type": "PAYMENT",
    "status": "SUCCESS",
    "paymentMethod": "TELEBIRR",
    "reference": "GW-5582910",
    "description": "Merchant Payment",
    "createdAt": "2026-10-05T20:30:00Z",
    "updatedAt": "2026-10-05T20:32:10Z"
  }
}
```
