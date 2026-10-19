# TEAM WORKFLOW

## Cách làm một task

### 1. Nhận task

Xem GitHub Issue được giao để biết cần làm gì.

Trước khi code:

```powershell
git switch develop
git pull origin develop
git switch -c feature/<task-id>-<ten-ngan>
```

Ví dụ:

```powershell
git switch -c feature/S0-02-neon-schema
```

Không code trực tiếp trên `main` hoặc `develop`.

---

### 2. Code

Có thể dùng AI để hỗ trợ.

Khi đưa task cho AI, gửi nội dung Issue và cho AI đọc code hiện tại.

Yêu cầu AI:

- đọc code trước;
- nói ngắn cách định làm;
- chỉ làm đúng task;
- không tự đổi cấu trúc project, database hay API chung;
- code xong tự kiểm tra lại.

Nếu AI đề xuất thay đổi lớn ảnh hưởng phần của người khác thì hỏi nhóm trước.

---

### 3. Kiểm tra

Code xong thì tự chạy thử chức năng mình vừa làm.

Nếu có lỗi, sửa trước khi đưa code lên.

Không commit:

- `.env`
- password/API key/DATABASE_URL
- `node_modules`

---

### 4. Đưa code lên GitHub

Commit và push feature branch.

Có thể dùng VS Code Source Control hoặc Terminal.

Sau đó tạo Pull Request:

```text
feature/... → develop
```

Không merge task thẳng vào `main`.

---

### 5. Merge

PR ổn thì merge vào `develop`.

GitHub Project dùng:

```text
Todo → Doing → Review → Done
```

- Bắt đầu làm → `Doing`
- Tạo PR → `Review`
- Merge xong → `Done`

---

## Nếu gặp vấn đề

Nếu lỗi không xử lý được hoặc cần sửa phần code của người khác thì báo vào nhóm.

Đừng tự thay đổi kiến trúc chung để xử lý một task nhỏ.

---

## Chỉ cần nhớ

```text
Nhận task
→ tạo branch từ develop
→ code + test
→ push
→ PR vào develop
→ merge
→ Done
```
