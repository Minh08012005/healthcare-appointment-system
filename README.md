# Healthcare Appointment System

Healthcare appointment and clinic management system - Project 1.

## 1. Công nghệ sử dụng

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: PostgreSQL (Neon)
- Node.js: **22.22.2**
- Version Control: Git + GitHub

---

## 2. Setup lần đầu

> Chỉ cần thực hiện phần này lần đầu khi setup project trên máy.

### Bước 1 - Cài công cụ

Cần cài:

- Visual Studio Code
- Git
- NVM for Windows

Lưu ý: Không cần cài Node.js riêng. Sau khi cài NVM for Windows, Node.js 22.22.2 sẽ được cài bằng các lệnh bên dưới.

Sau khi cài xong:

1. Mở Visual Studio Code.
2. Chọn **Terminal → New Terminal → PowerShell**.
3. Kiểm tra:

```powershell
git --version
nvm version
```

Nếu cả hai lệnh đều hiện version thì tiếp tục.

Nếu báo `not recognized`, dừng lại và gửi ảnh Terminal vào nhóm để được hỗ trợ.

### Bước 2 - Cài đúng Node.js của nhóm

Trong PowerShell:

```powershell
nvm install 22.22.2
nvm use 22.22.2
```

Kiểm tra:

```powershell
node --version
npm --version
```

Node phải hiện:

```text
v22.22.2
```

### Bước 3 - Clone project

Chọn thư mục trên máy dùng để chứa project, sau đó:

```powershell
git clone https://github.com/Minh08012005/healthcare-appointment-system.git
cd healthcare-appointment-system
git switch develop
```

Kiểm tra:

```powershell
git branch
```

Phải thấy dấu `*` tại:

```text
* develop
```

### Bước 4 - Cài Frontend

```powershell
cd frontend
npm install
```

### Bước 5 - Cài Backend

```powershell
cd ..\backend
npm install
```

Setup dependency hoàn tất.

---

## 3. Chạy project

Frontend và Backend cần chạy ở **2 Terminal riêng** trong VS Code.

### Terminal 1 - Frontend

Từ thư mục gốc project:

```powershell
cd frontend
npm run dev
```

Thành công khi thấy:

```text
Local: http://localhost:5173/
```

Mở địa chỉ trên bằng trình duyệt và kiểm tra trang React hiển thị.

### Terminal 2 - Backend

Mở thêm một PowerShell Terminal:

```powershell
cd backend
npm run dev
```

Thành công khi thấy:

```text
Server running on http://localhost:3000
```

Mở:

```text
http://localhost:3000
```

Kết quả mong đợi:

```json
{
  "message": "Healthcare Appointment System API is running"
}
```

---

## 4. Xác nhận Setup PASS

Setup hoàn thành khi đủ cả 3 điều kiện:

- [ ] `node --version` → `v22.22.2`
- [ ] Frontend chạy được tại `http://localhost:5173/`
- [ ] Backend chạy được tại `http://localhost:3000/`

Nếu đủ cả 3, nhắn vào nhóm:

```text
[Tên] - Setup PASS
```

**Không cần gửi ảnh nếu mọi thứ chạy bình thường.**

Nếu gặp lỗi, chụp toàn bộ Terminal có lỗi và gửi vào nhóm hoặc đưa cho AI để kiểm tra.

---

## 5. Cấu trúc project

```text
healthcare-appointment-system/
├── frontend/       # React + Vite
├── backend/        # Node.js + Express
├── .gitignore
├── .nvmrc
└── README.md
```

---

## 6. Quy tắc khi bắt đầu một task code

Không code trực tiếp trên `main` hoặc `develop`.

Trước khi làm task:

```powershell
git switch develop
git pull origin develop
git switch -c feature/<task-id>-<ten-task>
```

Ví dụ:

```powershell
git switch -c feature/S0-02-neon-schema
```

Sau đó mới bắt đầu code task được giao.

Quy trình chi tiết về Git, GitHub Issue, Pull Request và sử dụng AI sẽ được hướng dẫn trong tài liệu workflow của nhóm.
