# 🔄 Pinata API v3 Update

## ❌ Vấn Đề Gặp Phải

```
Error: Pinata file upload failed: Bad Request - {"error":"Invalid request format."}
```

**Nguyên nhân:** Code đang dùng Pinata API cũ (v2), nhưng Pinata đã chuyển sang **API v3** với format khác.

---

## ✅ Giải Pháp

### API Cũ (v2) - ❌ Không hoạt động

```typescript
// OLD - v2 API
const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${JWT}`,
  },
  body: formData,
});

// FormData bao gồm:
formData.append('file', buffer, { filename: fileName });
formData.append('pinataMetadata', metadata); // ← Không cần nữa
```

### API Mới (v3) - ✅ Hoạt động

```typescript
// NEW - v3 API
const response = await fetch('https://uploads.pinata.cloud/v3/files', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${JWT}`,
  },
  body: formData,
});

// FormData chỉ cần:
formData.append('file', buffer, { filename: fileName });
formData.append('network', 'public'); // ← BẮT BUỘC cho v3
```

---

## 🔧 Thay Đổi Trong Code

### 1. Thêm Interface Mới

```typescript
interface PinataV3UploadResponse {
  data: {
    id: string;
    name: string;
    cid: string;        // ← v3 dùng 'cid' thay vì 'IpfsHash'
    size: number;
    created_at: string;
  };
}
```

### 2. Cập Nhật `uploadFile()`

**Trước:**
```typescript
const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${this.pinataJwt}`,
    ...formData.getHeaders(),
  },
  body: formData,
});

const data: PinataUploadResponse = await response.json();
return data.IpfsHash; // ← Field cũ
```

**Sau:**
```typescript
const response = await fetch('https://uploads.pinata.cloud/v3/files', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${this.pinataJwt}`,
    ...formData.getHeaders(),
  },
  body: formData,
});

const result: PinataV3UploadResponse = await response.json();
return result.data.cid; // ← Field mới
```

### 3. Cập Nhật `uploadMetadata()`

**Trước:** Dùng `pinJSONToIPFS` endpoint riêng
```typescript
const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${this.pinataJwt}`,
  },
  body: JSON.stringify({
    pinataContent: metadata,
    pinataMetadata: { name, keyvalues },
  }),
});
```

**Sau:** Convert JSON thành file và dùng endpoint v3 giống nhau
```typescript
// Convert JSON to Buffer
const jsonString = JSON.stringify(metadata, null, 2);
const buffer = Buffer.from(jsonString, 'utf-8');
const fileName = name || `metadata-${Date.now()}.json`;

// Upload as file
formData.append('file', buffer, { 
  filename: fileName,
  contentType: 'application/json'
});
formData.append('network', 'public');

const response = await fetch('https://uploads.pinata.cloud/v3/files', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${this.pinataJwt}`,
    ...formData.getHeaders(),
  },
  body: formData,
});
```

---

## 📊 So Sánh Chi Tiết

### Endpoint

| Aspect | v2 (Old) | v3 (New) |
|--------|----------|----------|
| **File Upload** | `api.pinata.cloud/pinning/pinFileToIPFS` | `uploads.pinata.cloud/v3/files` |
| **JSON Upload** | `api.pinata.cloud/pinning/pinJSONToIPFS` | `uploads.pinata.cloud/v3/files` |
| **Domain** | `api.pinata.cloud` | `uploads.pinata.cloud` |

### Request Format

| Field | v2 | v3 |
|-------|----|----|
| **file** | ✅ Required | ✅ Required |
| **pinataMetadata** | ✅ Required | ❌ Not needed |
| **network** | ❌ Not needed | ✅ Required (`'public'`) |

### Response Format

| Field | v2 | v3 |
|-------|----|----|
| **IpfsHash** | ✅ `data.IpfsHash` | ❌ N/A |
| **cid** | ❌ N/A | ✅ `data.data.cid` |
| **PinSize** | ✅ `data.PinSize` | ✅ `data.data.size` |
| **Timestamp** | ✅ `data.Timestamp` | ✅ `data.data.created_at` |

---

## 🎯 Ví Dụ Response

### v2 Response (Old)
```json
{
  "IpfsHash": "QmXXX...",
  "PinSize": 125634,
  "Timestamp": "2024-10-30T00:00:00Z"
}
```

### v3 Response (New)
```json
{
  "data": {
    "id": "uuid-xxx-yyy",
    "name": "document-123.pdf",
    "cid": "bafkreih5aznjvttude6c3wbvqeebb6rlx5wkbzyppv7garjiubll2ceym4",
    "size": 125634,
    "created_at": "2024-10-30T00:00:00Z"
  }
}
```

---

## 🔑 Gateway Configuration

### Lấy File từ IPFS

**Format cũ (vẫn hoạt động):**
```
https://gateway.pinata.cloud/ipfs/{cid}
```

**Format mới (recommended):**
```
https://your-gateway.mypinata.cloud/ipfs/{cid}
```

### Trong Code

```typescript
// Config trong .env
PINATA_GATEWAY=your-gateway.mypinata.cloud

// Hoặc dùng default
const gateway = this.configService.get<string>('PINATA_GATEWAY') || 'gateway.pinata.cloud';
const url = `https://${gateway}/ipfs/${ipfsHash}`;
```

---

## ⚙️ Configuration

### Environment Variables

Không cần thay đổi! Vẫn dùng biến cũ:

```bash
PINATA_JWT=your_pinata_jwt_token_here
PINATA_GATEWAY=gateway.pinata.cloud  # hoặc custom gateway
```

### Lấy JWT Token

1. Đăng nhập https://pinata.cloud
2. Vào **API Keys**
3. Tạo **New Key**
4. Chọn permissions:
   - ✅ `pinFileToIPFS`
   - ✅ `pinJSONToIPFS`
   - ✅ `unpin`
5. Copy JWT token
6. Paste vào `.env`

---

## 🧪 Testing

### 1. Build Project
```bash
npm run build
```
✅ **Result:** Build thành công, không có lỗi

### 2. Test Upload
```bash
# Start service
npm run start:dev

# Approve một document
curl -X POST http://localhost:3000/documents/{id}/approve \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"student_blockchain_id": 12345}'
```

### 3. Check Logs
```
✅ Should see:
📄 Generating PDF certificate...
✅ PDF generated successfully (125634 bytes)
📤 Uploading PDF to IPFS...
📌 Successfully uploaded file to IPFS: bafkreih5azn...
📌 Successfully uploaded metadata to IPFS: bafkreih5bzm...
✅ Document xxx successfully minted as NFT!

❌ Should NOT see:
Error: Pinata file upload failed: Bad Request
```

---

## 📋 Checklist

- [x] Update `uploadFile()` to v3 API
- [x] Update `uploadMetadata()` to v3 API
- [x] Add `PinataV3UploadResponse` interface
- [x] Change endpoint to `uploads.pinata.cloud/v3/files`
- [x] Add `network: 'public'` parameter
- [x] Remove `pinataMetadata` (not needed in v3)
- [x] Update response parsing (`data.cid` instead of `IpfsHash`)
- [x] Build successfully
- [ ] Test upload PDF
- [ ] Test upload metadata
- [ ] Verify files on IPFS gateway

---

## 🔍 Troubleshooting

### Error: "Invalid request format"
✅ **Fixed!** - Đã update sang v3 API

### Error: "Authorization failed"
```bash
# Check JWT token
echo $PINATA_JWT

# Test authentication
curl https://api.pinata.cloud/data/testAuthentication \
  -H "Authorization: Bearer $PINATA_JWT"
```

### Error: "Failed to fetch from IPFS"
```bash
# Check gateway
curl https://gateway.pinata.cloud/ipfs/{cid}

# Try custom gateway
curl https://your-gateway.mypinata.cloud/ipfs/{cid}
```

---

## 📚 References

- [Pinata v3 API Docs](https://docs.pinata.cloud/api-reference/endpoint/upload-a-file)
- [Pinata Migration Guide](https://docs.pinata.cloud/migration-guide)
- [IPFS Gateway Docs](https://docs.pinata.cloud/gateways/dedicated-ipfs-gateways)

---

## ✅ Status

**Update Completed:** October 30, 2024  
**API Version:** Pinata v3  
**Build Status:** ✅ Success  
**Ready for Testing:** ✅ Yes

---

**Next Steps:**
1. ✅ Code updated
2. ✅ Build successful
3. 🔄 Test with real Pinata JWT
4. 🔄 Verify uploads on IPFS
5. 🔄 Check PDF download works

