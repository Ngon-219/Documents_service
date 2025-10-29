# Document Service

Service quản lý cấp phát và xác minh chứng chỉ/bằng cấp dưới dạng NFT trên blockchain.

## 🏗️ Architecture

- **Framework**: NestJS + TypeScript
- **Database**: PostgreSQL (shared với auth_service)
- **ORM**: TypeORM
- **Blockchain**: Ethereum (Sepolia testnet) với ethers.js
- **Storage**: IPFS cho document metadata
- **Structure**: Routes pattern tương tự auth_service (Rust) cho consistency

## 📋 Features

1. **JWT Authentication** - Token-based authentication với auth_service
2. **Role-Based Authorization** - Phân quyền theo role (Admin, Manager, Teacher, Student)
3. **Student Request Document** - Sinh viên yêu cầu cấp phát giấy tờ (draft)
4. **Manager Approve & Sign** - Manager duyệt và ký trên blockchain
5. **Verify Document** - Xác minh tính hợp lệ của document (public)
6. **Revoke Document** - Thu hồi document nếu cần (admin only)

## 🚀 Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment Variables

**Option 1: Quick start (Development)**
```bash
cp .env.development .env
# Edit JWT_SECRET, contract addresses, and API keys
```

**Option 2: From template**
```bash
cp .env.example .env
# Fill in all required values
```

**⚠️ CRITICAL Variables:**

| Variable | Description | Must Match |
|----------|-------------|------------|
| `JWT_SECRET` | JWT signing secret | **Same as auth_service!** |
| `DATABASE_URL` | PostgreSQL connection | **Same DB as auth_service** |
| `BLOCKCHAIN_RPC_URL` | Ethereum node URL | - |
| `ISSUANCE_CONTRACT_ADDRESS` | Smart contract address | From deployment |
| `DOCUMENT_NFT_CONTRACT_ADDRESS` | NFT contract address | From deployment |
| `ADMIN_PRIVATE_KEY` | Transaction signer | Needs ETH for gas |

📖 **Detailed guide:** See [ENV_SETUP_GUIDE.md](./ENV_SETUP_GUIDE.md)

### 3. Copy Contract ABIs

Copy ABI files từ `smart_contract/artifacts`:

```bash
mkdir -p src/blockchain/abis

# Copy IssuanceOfDocument ABI
cp ../smart_contract/artifacts/contracts/issuance_of_documents.sol/IssuanceOfDocument.json \
   src/blockchain/abis/IssuanceOfDocument.json

# Copy DocumentNFT ABI
cp ../smart_contract/artifacts/contracts/DocumentNFT.sol/DocumentNFT.json \
   src/blockchain/abis/DocumentNFT.json
```

### 4. Run Migrations

```bash
npm run migration:run
```

Điều này sẽ tạo 2 tables trong database:
- `document_type` - Loại chứng chỉ (Diploma, Transcript, etc.)
- `documents` - Danh sách documents

### 5. Start Development Server

```bash
npm run start:dev
```

Server sẽ chạy tại `http://localhost:3000`

## 📚 API Documentation (Swagger)

Swagger UI đã được tích hợp vào project. Sau khi chạy server, bạn có thể truy cập:

```
http://localhost:3000/api/docs
```

### Swagger Features:

- 📖 **Interactive API Documentation** - Xem tất cả endpoints với mô tả chi tiết
- 🔐 **Authentication Support** - Test API với JWT Bearer token
- 🧪 **Try It Out** - Thực hiện request trực tiếp từ browser
- 📝 **Request/Response Examples** - Xem cấu trúc dữ liệu đầy đủ
- 🏷️ **Schema Definitions** - DTOs và response models tự động sinh

### Cách sử dụng Swagger:

1. Khởi động server: `npm run start:dev`
2. Truy cập: `http://localhost:3000/api/docs`
3. Để test protected endpoints:
   - Click nút **"Authorize"** ở góc trên bên phải
   - Nhập JWT token (lấy từ auth_service)
   - Click **"Authorize"** để lưu
   - Giờ bạn có thể test tất cả các endpoints cần authentication

## 📡 API Endpoints

### 🔓 Public Endpoints (No Auth)

```http
# Get document types
GET /api/v1/documents/types/all

# Verify document authenticity
GET /api/v1/documents/verify/:tokenId
```

### 🔐 Student Operations

#### Request Document (Student only)
```http
POST /api/v1/documents/request
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "document_type_id": "uuid-document-type",
  "metadata": {
    "grades": [...],
    "gpa": 3.8
  }
}
# Note: user_id auto-filled from JWT token
```

#### Get Student's Documents
```http
GET /api/v1/documents/student/:userId
Authorization: Bearer <jwt_token>
# Students: can only view own documents
# Manager/Admin/Teacher: can view any student
```

### 👔 Manager/Admin Operations

#### Approve and Sign Document (Manager/Admin only)
```http
POST /api/v1/documents/:id/approve
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "student_blockchain_id": 123
}
# Note: issuer_id auto-filled from JWT token
```

**Flow:**
1. Uploads metadata to IPFS
2. Calls blockchain: `IssuanceOfDocument.signDocument()`
3. Mints NFT to student's wallet
4. Updates database với blockchain data

### 🔒 Admin Only Operations

#### Revoke Document (Admin only)
```http
PUT /api/v1/documents/:id/revoke
Authorization: Bearer <jwt_token>
```

---

## 🔐 Authentication

### Get JWT Token

Login through auth_service to get token:

```bash
# Login
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your.email@example.com",
    "password": "your_password"
  }'

# Response
{
  "access_token": "eyJhbGc...",
  "user": {
    "user_id": "uuid",
    "email": "your.email@example.com",
    "role": "Student"
  }
}
```

### Use Token in Requests

```bash
export TOKEN="eyJhbGc..."

curl http://localhost:3000/api/v1/documents/request \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"document_type_id":"uuid","metadata":{}}'
```

### Roles & Permissions

- **Admin**: Full access to all endpoints
- **Manager**: Approve documents, view all students
- **Teacher**: View all students' documents
- **Student**: Request own documents, view own documents only

See [AUTH_GUIDE.md](./AUTH_GUIDE.md) for detailed authentication documentation.

## 🔄 Document Lifecycle

```
DRAFT → (Manager approves) → PENDING_BLOCKCHAIN → (Blockchain confirms) → MINTED

MINTED → (Admin revokes) → REVOKED
```

### Status Enum

- `draft` - Student đã request, chưa được approve
- `pending_approval` - Đang chờ manager approve
- `approved` - Manager approved, chưa lên blockchain
- `pending_blockchain` - Đang gửi transaction lên blockchain
- `minted` - Đã mint thành công NFT
- `revoked` - Đã thu hồi
- `failed` - Blockchain transaction thất bại

## 🗃️ Database Schema

### document_type
- `document_type_id` (UUID, PK)
- `document_type_name` (VARCHAR, UNIQUE)
- `description` (TEXT)
- `created_at`, `updated_at`

### documents
- `document_id` (UUID, PK)
- `user_id` (UUID) - Student
- `issuer_id` (UUID) - Manager
- `document_type_id` (UUID, FK)
- `blockchain_doc_id` (VARCHAR) - bytes32 from contract
- `token_id` (BIGINT) - NFT token ID
- `tx_hash` (VARCHAR) - Transaction hash
- `contract_address` (VARCHAR)
- `ipfs_hash` (VARCHAR) - IPFS CID
- `document_hash` (VARCHAR) - SHA256/keccak256
- `metadata` (JSONB) - Flexible data
- `status` (ENUM)
- `is_valid` (BOOLEAN)
- `issued_at`, `verified_at`
- `created_at`, `updated_at`

## 🔗 Integration với Auth Service

Document Service share database với Auth Service:

- Đọc thông tin user từ bảng `users` (auth_service)
- Đọc wallet từ bảng `wallets` (auth_service)
- Query `blockchain_student_id` để mint NFT

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage
npm run test:cov
```

## 📦 Scripts

```bash
npm run start:dev     # Development với hot reload
npm run start:prod    # Production
npm run build         # Build TypeScript
npm run migration:run # Chạy migrations
npm run migration:revert # Rollback migration
```

## 🔧 Troubleshooting

### Migration Errors

```bash
# Revert migration
npm run migration:revert

# Re-run migration
npm run migration:run
```

### Blockchain Connection Issues

- Check `BLOCKCHAIN_RPC_URL` có đúng không
- Verify contract addresses đã deploy
- Check admin wallet có đủ ETH (gas) không

### Database Connection Issues

- Verify PostgreSQL đang chạy
- Check credentials trong `.env`
- Ensure database `auth_db` đã tồn tại

## 🚀 Deployment

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
CMD ["npm", "run", "start:prod"]
```

### Environment Variables (Production)

```env
NODE_ENV=production
DATABASE_HOST=your-prod-db-host
BLOCKCHAIN_RPC_URL=https://mainnet.infura.io/...
```

## 📚 Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [TypeORM Documentation](https://typeorm.io/)
- [Ethers.js Documentation](https://docs.ethers.org/)
- [Smart Contracts](../smart_contract/)

## 🤝 Contributing

1. Create feature branch
2. Make changes
3. Add tests
4. Submit PR

## 📝 License

UNLICENSED
