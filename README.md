# Healthcare Appointment System

Healthcare appointment and clinic management system - Project 1.

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: PostgreSQL (Neon) - cấu hình ở task tiếp theo
- Version Control: Git + GitHub
- Node.js: 22.22.2

## Yêu cầu môi trường

Cài đặt:

- Visual Studio Code
- Git
- NVM for Windows

Nhóm sử dụng PowerShell trong VS Code Terminal.

Kiểm tra Git và NVM:

```powershell
git --version
nvm version
```

## Cài Node.js

Project sử dụng Node.js 22.22.2.

```powershell
nvm install 22.22.2
nvm use 22.22.2
node --version
npm --version
```

Node setup thành công khi:

```text
v22.22.2
```

## Cài đặt project lần đầu

### 1. Clone repository

```powershell
git clone https://github.com/Minh08012005/healthcare-appointment-system.git
cd healthcare-appointment-system
```

### 2. Chuyển sang develop

```powershell
git switch develop
```

### 3. Cài Frontend

```powershell
cd frontend
npm install
```

### 4. Cài Backend

```powershell
cd ..\backend
npm install
```

## Chạy project

Frontend và backend chạy ở hai terminal riêng.

### Terminal 1 - Frontend

Từ thư mục gốc project:

```powershell
cd frontend
npm run dev
```

Frontend chạy thành công khi terminal hiển thị địa chỉ dạng:

```text
Local: http://localhost:5173/
```

### Terminal 2 - Backend

Từ thư mục gốc project:

```powershell
cd backend
npm run dev
```

Backend chạy thành công khi terminal hiển thị:

```text
Server running on http://localhost:3000
```

Mở `http://localhost:3000` trên trình duyệt.

Kết quả mong đợi:

```json
{
  "message": "Healthcare Appointment System API is running"
}
```

## Cấu trúc project

```text
healthcare-appointment-system/
├── frontend/        # React + Vite
├── backend/         # Node.js + Express
├── .gitignore
├── .nvmrc
└── README.md
```

## Quy tắc branch cơ bản

Không code trực tiếp trên `main` hoặc `develop`.

Mỗi task được thực hiện trên feature branch riêng tạo từ `develop`.

```powershell
git switch develop
git pull origin develop
git switch -c feature/<task-id>-<ten-task>
```

Sau khi hoàn thành, push feature branch lên GitHub và tạo Pull Request về `develop`.

## Setup được coi là hoàn thành khi

- `node --version` trả về `v22.22.2`
- Frontend chạy được tại `http://localhost:5173`
- Backend chạy được tại `http://localhost:3000`
- Không có lỗi làm frontend/backend không thể khởi động
