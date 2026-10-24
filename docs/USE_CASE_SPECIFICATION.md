**ĐẶC TẢ USE CASE**

Hệ thống đặt lịch và quản lý khám bệnh (UC-001 → UC-037)

*Phiên bản đã chỉnh sửa*

# PHẠM VI HỆ THỐNG (SRS)

## 1. Trong phạm vi (In-scope)

- Đăng ký, đăng nhập, đăng xuất; Admin quản lý tài khoản nhân viên (mỗi nhân viên một tài khoản cá nhân).

- Đặt lịch khám online, nhận mã QR, hủy lịch; check-in bằng QR trong khung thời gian quy định; lịch quá hạn tự động nhả slot.

- Tiếp đón bệnh nhân offline bằng CCCD; hai hàng đợi online/offline với tỉ lệ gọi 1:1; gọi bệnh nhân, xử lý vắng mặt.

- Khám bệnh: xem hồ sơ và lịch sử, nhập triệu chứng, chỉ định xét nghiệm, nhận kết quả, nhập và in chẩn đoán, lời dặn, đơn thuốc; đóng hồ sơ và gửi vào ứng dụng bệnh nhân.

- Phòng xét nghiệm: xem danh sách chờ, nhận chỉ định, tải kết quả, thông báo cho bệnh nhân.

- Quản trị: chuyên khoa, bác sĩ (cấp bậc, phí), phòng, lịch trực, khung giờ và slot, quy tắc hàng đợi, tin tức và quy trình khám.

## 2. Ngoài phạm vi (Out-of-scope)

- Thanh toán: hệ thống chỉ hiển thị phí khám ban đầu (tham khảo) của bác sĩ khi đặt lịch (UC-008). Hệ thống không thu phí, không tính tổng chi phí, không tích hợp cổng thanh toán. Việc thanh toán tổng chi phí sau khám diễn ra tại khu thanh toán của bệnh viện và hệ thống không quản lý.

- Thuốc: hệ thống không quản lý kho dược (nhập/xuất/tồn) và không làm luồng bệnh nhân đi lấy thuốc và ra về. Hệ thống dừng ở bước bác sĩ nhập và in đơn thuốc cho bệnh nhân.

- Từ chối mẫu xét nghiệm và yêu cầu lấy lại mẫu: chưa làm trong phiên bản này, sẽ phát triển sau.

## 3. Tham số mặc định (cấu hình tại UC-032)

| **Tham số**                                      | **Mặc định**   | **Áp dụng tại** |
|--------------------------------------------------|----------------|-----------------|
| Tỉ lệ gọi online : offline                       | 1 : 1          | UC-013, UC-016  |
| Check-in tối thiểu trước giờ hẹn                 | 10 phút        | UC-008, UC-011  |
| Check-in sớm nhất trước giờ hẹn                  | 60 phút        | UC-011          |
| Số lần gọi tối đa / khoảng cách giữa các lần gọi | 3 lần / 1 phút | UC-016          |
| Chu kỳ quét quy trình nền                        | 1 phút         | UC-011          |

# ĐẶC TẢ CHI TIẾT CÁC USE CASE

## UC-001 – Đăng ký tài khoản bệnh nhân

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-001 – Đăng ký tài khoản bệnh nhân</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Cho phép người bệnh tạo tài khoản mới để sử dụng các tính năng của hệ thống (đặt lịch khám, xem hồ sơ, tin tức…).</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Người bệnh nhập đầy đủ thông tin cá nhân bắt buộc để đăng ký tài khoản. Hệ thống kiểm tra tính hợp lệ và tạo tài khoản mới với vai trò “Bệnh nhân”.</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Bệnh nhân</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Người dùng chưa có tài khoản trong hệ thống.</p></li>
<li><p>Ứng dụng đang hoạt động bình thường.</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Người bệnh chọn chức năng “Đăng ký tài khoản”.</p>
<p>2. Hệ thống hiển thị form đăng ký với các trường: Họ tên, Ngày sinh, Số điện thoại, Tên đăng nhập, mã BHYT, Giới tính, Số CCCD/Hộ chiếu, Địa chỉ.</p>
<p>3. Người bệnh nhập đầy đủ thông tin và xác nhận.</p>
<p>4. Hệ thống kiểm tra tính hợp lệ của dữ liệu.</p>
<p>5. Hệ thống tạo tài khoản mới với vai trò Bệnh nhân và lưu vào cơ sở dữ liệu.</p>
<p>6. Hệ thống thông báo đăng ký thành công và chuyển đến trang đăng nhập.</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td><p>4a. Dữ liệu không hợp lệ: Hệ thống hiển thị thông báo lỗi cụ thể và yêu cầu nhập lại.</p>
<p>4b. Tên đăng nhập trùng: Hệ thống hiển thị thông báo lỗi cụ thể và yêu cầu đặt lại.</p></td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Tài khoản bệnh nhân được tạo thành công trong hệ thống.</p></li>
<li><p>Người bệnh có thể đăng nhập bằng tên đăng nhập/email và mật khẩu vừa tạo.</p></li>
</ul></td>
</tr>
</tbody>
</table>

## UC-002 – Đăng nhập

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-002 – Đăng nhập</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Cho phép người dùng đăng nhập vào hệ thống để sử dụng các chức năng tương ứng với quyền của mình.</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Người dùng nhập thông tin đăng nhập. Hệ thống xác thực và phân quyền theo vai trò.</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Bệnh nhân, Admin, Bác sĩ, Nhân viên phòng xét nghiệm, Lễ tân</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Người dùng đã có tài khoản trong hệ thống.</p></li>
<li><p>Hệ thống đang hoạt động.</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Người dùng chọn “Đăng nhập”.</p>
<p>2. Hệ thống hiển thị form đăng nhập (Tên đăng nhập + Mật khẩu).</p>
<p>3. Người dùng nhập thông tin và xác nhận.</p>
<p>4. Hệ thống kiểm tra thông tin đăng nhập.</p>
<p>5. Hệ thống tạo phiên đăng nhập và chuyển đến trang chủ tương ứng với vai trò của người dùng.</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td><p>4a. Thông tin đăng nhập sai: Hệ thống thông báo “Tên đăng nhập hoặc mật khẩu không đúng” và cho phép nhập lại.</p>
<p>4b. Tài khoản bị khóa: Hệ thống thông báo và không cho đăng nhập.</p></td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Người dùng đã đăng nhập thành công và có phiên làm việc theo đúng vai trò.</p></li>
</ul></td>
</tr>
</tbody>
</table>

## UC-003 – Đăng xuất

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-003 – Đăng xuất</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Cho phép người dùng kết thúc phiên làm việc hiện tại.</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Người dùng chọn chức năng đăng xuất. Hệ thống hủy phiên đăng nhập và quay về màn hình đăng nhập.</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Bệnh nhân, Admin, Bác sĩ, Nhân viên phòng xét nghiệm, Lễ tân</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Người dùng đang đăng nhập vào hệ thống.</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Người dùng chọn “Đăng xuất”.</p>
<p>2. Hệ thống hủy phiên đăng nhập (xóa token/session).</p>
<p>3. Hệ thống chuyển về màn hình đăng nhập.</p>
<p>4. Hệ thống thông báo đăng xuất thành công.</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td>Không có.</td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Phiên đăng nhập của người dùng đã bị hủy.</p></li>
<li><p>Người dùng không còn truy cập được các chức năng yêu cầu đăng nhập.</p></li>
</ul></td>
</tr>
</tbody>
</table>

## UC-004 – Admin tạo tài khoản nhân viên

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-004 – Admin tạo tài khoản nhân viên</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Cho phép Admin tạo tài khoản mới cho nhân viên (Bác sĩ, Lễ tân, Nhân viên phòng xét nghiệm).</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Admin nhập thông tin tài khoản nhân viên, chọn vai trò và tạo tài khoản. Mỗi nhân viên có một tài khoản cá nhân riêng, kể cả khi nhiều nhân viên dùng chung một máy tính tại phòng.</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Admin</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Admin đã đăng nhập thành công.</p></li>
<li><p>Có quyền quản lý tài khoản nhân viên.</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Admin chọn chức năng “Quản lý tài khoản nhân viên” → “Thêm mới”.</p>
<p>2. Hệ thống hiển thị form tạo tài khoản (Họ tên, Tên đăng nhập, Số điện thoại, Vai trò, Mật khẩu).</p>
<p>3. Admin nhập thông tin, chọn vai trò (Bác sĩ / Lễ tân / Nhân viên phòng xét nghiệm) và xác nhận.</p>
<p>4. Hệ thống kiểm tra dữ liệu hợp lệ.</p>
<p>5. Hệ thống tạo tài khoản mới và thông báo tạo thành công.</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td><p>4a. Dữ liệu trùng hoặc không hợp lệ: Hệ thống thông báo lỗi và yêu cầu sửa.</p>
<p>4b. Admin hủy: Quay về danh sách tài khoản.</p></td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Tài khoản nhân viên mới được tạo với đúng vai trò.</p></li>
<li><p>Nhân viên có thể đăng nhập.</p></li>
</ul></td>
</tr>
</tbody>
</table>

## UC-005 – Admin sửa/khóa tài khoản nhân viên

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-005 – Admin sửa/khóa tài khoản nhân viên</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Cho phép Admin chỉnh sửa thông tin hoặc khóa tài khoản nhân viên.</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Admin tìm tài khoản nhân viên, chỉnh sửa thông tin hoặc thực hiện khóa.</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Admin</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Admin đã đăng nhập.</p></li>
<li><p>Tài khoản nhân viên cần sửa đã tồn tại.</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Admin vào “Quản lý tài khoản nhân viên”.</p>
<p>2. Hệ thống hiển thị danh sách tài khoản.</p>
<p>3. Admin chọn tài khoản cần sửa hoặc khóa.</p>
<p>4. Trường hợp Sửa: Hệ thống hiển thị form chỉnh sửa; Admin thay đổi thông tin và lưu; Hệ thống cập nhật dữ liệu.</p>
<p>5. Trường hợp Khóa: Admin xác nhận khóa/mở khóa; Hệ thống vô hiệu hóa (hoặc kích hoạt lại) tài khoản.</p>
<p>6. Hệ thống thông báo thao tác thành công.</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td>Admin hủy thao tác: Quay về danh sách.</td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Thông tin tài khoản đã được cập nhật hoặc tài khoản đã bị vô hiệu hóa.</p></li>
<li><p>Nhân viên không còn đăng nhập được nếu tài khoản bị vô hiệu hóa.</p></li>
</ul></td>
</tr>
</tbody>
</table>

## UC-006 – Xem danh sách chuyên khoa và bác sĩ

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-006 – Xem danh sách chuyên khoa và bác sĩ</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Cho phép Bệnh nhân chọn chuyên khoa và bác sĩ để đặt lịch khám. Bệnh nhân có thể tự chọn bác sĩ (xem giá, cấp bậc, tìm kiếm theo tên) hoặc chọn ngẫu nhiên nếu chưa biết chọn bác sĩ nào.</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Bệnh nhân chọn chuyên khoa trước. Sau đó hệ thống hiển thị danh sách bác sĩ thuộc chuyên khoa đó (cấp bậc, giá khám). Bệnh nhân có thể tìm kiếm bác sĩ theo tên hoặc nhấn nút “Ngẫu nhiên”, hệ thống hiện cấp bậc và giá; sau khi bệnh nhân chọn xong, hệ thống tự chọn bác sĩ.</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Bệnh nhân</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Bệnh nhân đã đăng nhập thành công.</p></li>
<li><p>Hệ thống đã có dữ liệu chuyên khoa và bác sĩ do Admin quản lý.</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Bệnh nhân chọn chức năng “Đặt lịch khám” → bước “Chọn chuyên khoa”.</p>
<p>2. Hệ thống hiển thị danh sách chuyên khoa.</p>
<p>3. Bệnh nhân chọn một chuyên khoa.</p>
<p>4. Hệ thống hiển thị danh sách bác sĩ thuộc chuyên khoa đó, bao gồm: Tên bác sĩ, Cấp bậc, Giá khám.</p>
<p>5. Bệnh nhân có hai lựa chọn:</p>
<p>5.1. Tự chọn bác sĩ: có thể tìm kiếm bác sĩ theo tên; chọn một bác sĩ cụ thể trong danh sách.</p>
<p>5.2. Chọn ngẫu nhiên: Bệnh nhân nhấn nút “Ngẫu nhiên”; hệ thống hiện giá và cấp bậc, sau khi bệnh nhân chọn xong hệ thống tự động chọn một bác sĩ bất kỳ trong chuyên khoa (giá khám theo cấp bậc của bác sĩ được chọn).</p>
<p>6. Hệ thống ghi nhận chuyên khoa và bác sĩ đã chọn, chuyển sang bước tiếp theo (chọn lịch khám).</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td><p>3a. Không có chuyên khoa nào: Hệ thống thông báo “Hiện chưa có chuyên khoa”.</p>
<p>4a. Không có bác sĩ nào trong chuyên khoa: Hệ thống thông báo “Chưa có bác sĩ thuộc chuyên khoa này”.</p>
<p>5.1a. Tìm kiếm không ra kết quả: Hệ thống thông báo “Không tìm thấy bác sĩ phù hợp”.</p>
<p>5.2a. Không còn bác sĩ nào để chọn ngẫu nhiên: Hệ thống thông báo và yêu cầu chọn lại chuyên khoa.</p></td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Hệ thống đã ghi nhận chuyên khoa và bác sĩ (hoặc bác sĩ ngẫu nhiên) mà Bệnh nhân chọn.</p></li>
<li><p>Bệnh nhân được chuyển sang bước chọn lịch khám (ngày giờ) tương ứng với bác sĩ đã chọn.</p></li>
</ul></td>
</tr>
</tbody>
</table>

## UC-007 – Xem slot trống theo lịch bác sĩ

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-007 – Xem slot trống theo lịch bác sĩ</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Cho phép Bệnh nhân xem được các khung giờ (slot) chưa có người đặt của một bác sĩ cụ thể để chuẩn bị đặt lịch.</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Bệnh nhân tra cứu lịch làm việc của bác sĩ đã chọn ở bước trước. Hệ thống hiển thị các khoảng thời gian trống theo ngày.</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Bệnh nhân</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Bệnh nhân đã đăng nhập thành công.</p></li>
<li><p>Bệnh nhân đã chọn một bác sĩ cụ thể trên hệ thống.</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Bệnh nhân chọn ngày muốn đi khám.</p>
<p>2. Hệ thống truy vấn dữ liệu lịch làm việc của bác sĩ trong ngày đó.</p>
<p>3. Hệ thống hiển thị danh sách các khung giờ (slot) còn trống để bệnh nhân xem.</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td><p>2a. Bác sĩ không có lịch làm việc trong ngày đã chọn: Hệ thống thông báo không có lịch làm việc và yêu cầu chọn ngày khác.</p>
<p>3a. Tất cả các slot trong ngày đã đầy: Hệ thống thông báo đã hết slot trống trong ngày.</p></td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Hệ thống hiển thị thành công các slot trống để Bệnh nhân chuyển sang bước đặt lịch.</p></li>
</ul></td>
</tr>
</tbody>
</table>

## UC-008 – Đặt lịch khám (nhận thông báo xác nhận + QR sau đặt lịch)

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-008 – Đặt lịch khám (nhận thông báo xác nhận + QR sau đặt lịch)</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Ghi nhận lịch hẹn khám của bệnh nhân thành công và cấp mã QR để sử dụng khi check-in.</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Bệnh nhân chọn giờ, điền thông tin và xác nhận đặt lịch. Hệ thống trừ slot trống, ghi nhận lịch (trạng thái “Đã đặt”) và gửi lại mã QR xác nhận. Mã QR chỉ có hiệu lực check-in trong khung thời gian quy định tại UC-011.</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Bệnh nhân</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Bệnh nhân đã xem và chọn được slot trống theo lịch bác sĩ.</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Bệnh nhân bấm chọn một khung giờ (slot) trống. Hệ thống hiển thị ra phòng khám tương ứng.</p>
<p>2. Bệnh nhân nhập các thông tin yêu cầu: Sử dụng BHYT (có/không), triệu chứng. Sau đó bấm tiếp theo.</p>
<p>3. Hệ thống hiển thị thông tin đặt lịch gồm: Tên bệnh nhân, SĐT, Thông tin khám (Khoa, Bác sĩ, Phòng khám, Thời gian khám, Phí khám tham khảo, BHYT, triệu chứng…), Lưu ý (bao gồm quy định phải check-in trước giờ hẹn tối thiểu 10 phút, nếu không mã QR hết hiệu lực).</p>
<p>4. Bệnh nhân bấm xác nhận đặt lịch.</p>
<p>5. Hệ thống kiểm tra tình trạng slot, nếu còn trống sẽ ghi nhận lịch hẹn và trừ đi 1 slot của bác sĩ.</p>
<p>6. Hệ thống tạo mã QR và hiển thị thông báo xác nhận lịch đặt thành công kèm mã QR cho bệnh nhân.</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td><p>2a. Bệnh nhân nhập thiếu thông tin bắt buộc: Hệ thống cảnh báo và yêu cầu bổ sung thông tin.</p>
<p>3a. Khung giờ đã chọn còn ít hơn thời gian check-in tối thiểu (10 phút) trước giờ hẹn: Hệ thống không cho đặt và yêu cầu chọn khung giờ khác.</p>
<p>5a. Slot vừa bị người khác đặt mất: Hệ thống báo lỗi và yêu cầu chọn lại khung giờ khác.</p></td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Lịch khám được lưu vào hệ thống ở trạng thái “Đã đặt”.</p></li>
<li><p>Bệnh nhân nhận được thông báo xác nhận và mã QR đặt lịch.</p></li>
</ul></td>
</tr>
<tr class="even">
<td><strong>Ghi chú</strong></td>
<td>Phí khám hiển thị ở bước này chỉ là phí khám ban đầu (tham khảo) của bác sĩ để bệnh nhân nắm được giá khám. Tổng chi phí sau khám do bệnh nhân thanh toán tại khu thanh toán của bệnh viện, hệ thống không quản lý (xem phần Phạm vi hệ thống).</td>
</tr>
</tbody>
</table>

## UC-009 – Hủy lịch khám (trả lại slot)

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-009 – Hủy lịch khám (trả lại slot)</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Cho phép bệnh nhân hủy lịch hẹn không thể đến và hệ thống hoàn trả lại slot đó thành trạng thái trống.</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Bệnh nhân chủ động chọn và hủy lịch hẹn đã đặt. Hệ thống thu hồi mã QR và cập nhật lại slot của bác sĩ.</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Bệnh nhân</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Bệnh nhân có ít nhất một lịch khám đã đặt thành công và chưa diễn ra.</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Bệnh nhân truy cập danh sách lịch khám và chọn lịch muốn hủy.</p>
<p>2. Bệnh nhân chọn chức năng Hủy lịch.</p>
<p>3. Hệ thống yêu cầu xác nhận thao tác hủy.</p>
<p>4. Bệnh nhân đồng ý xác nhận.</p>
<p>5. Hệ thống cập nhật trạng thái lịch thành “Đã hủy”, vô hiệu hóa mã QR và cộng lại 1 slot trống cho bác sĩ.</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td>2a. Đã quá thời gian quy định cho phép hủy lịch (trước giờ hẹn 2 tiếng): Hệ thống báo lỗi và không cho phép thao tác hủy.</td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Lịch khám bị hủy trên hệ thống.</p></li>
<li><p>Slot thời gian đó được trả lại và sẵn sàng cho bệnh nhân khác đặt.</p></li>
</ul></td>
</tr>
</tbody>
</table>

## UC-010 – Xem danh sách lịch đã đặt, chi tiết và QR

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-010 – Xem danh sách lịch đã đặt, chi tiết và QR</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Cho phép bệnh nhân tra cứu lại các lịch hẹn và lấy mã QR để sử dụng khi đến viện.</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Bệnh nhân xem toàn bộ danh sách lịch hẹn của mình. Khi chọn một lịch cụ thể, hệ thống hiển thị chi tiết thông tin và mã QR tương ứng.</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Bệnh nhân</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Bệnh nhân đã đăng nhập vào hệ thống.</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Bệnh nhân chọn chức năng xem danh sách lịch đã đặt.</p>
<p>2. Hệ thống hiển thị danh sách các lịch hẹn.</p>
<p>3. Bệnh nhân bấm vào một lịch khám cụ thể trong danh sách.</p>
<p>4. Hệ thống hiển thị thông tin chi tiết của lịch hẹn kèm theo mã QR.</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td><p>2a. Bệnh nhân chưa từng đặt lịch nào: Hệ thống hiển thị thông báo danh sách trống.</p>
<p>4a. Lịch hẹn ở trạng thái “Quá hạn check-in” hoặc “Đã hủy”: Hệ thống hiển thị trạng thái và không hiển thị mã QR.</p></td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Bệnh nhân xem được chi tiết thông tin lịch khám và mã QR thành công.</p></li>
</ul></td>
</tr>
</tbody>
</table>

## UC-011 – Check-in online bằng quét QR đặt lịch

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-011 – Check-in online bằng quét QR đặt lịch</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Lễ tân xác nhận bệnh nhân đặt lịch online đã đến viện trong khung check-in hợp lệ và hệ thống phân bổ vào hàng đợi online theo đúng logic. Lịch hẹn không check-in kịp thì mã QR hết hiệu lực và slot được giải phóng để chống giữ chỗ ảo.</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Lễ tân quét mã QR của bệnh nhân. Hệ thống so sánh thời điểm quét với giờ hẹn: bệnh nhân phải check-in trong khung từ “mốc sớm nhất” (mặc định 60 phút) đến “mốc muộn nhất” (mặc định trước giờ hẹn 10 phút). Check-in hợp lệ thì bệnh nhân được ghi nhận “Đã check-in”, chờ trong quy trình nền và tự động vào hàng đợi online (A) của bác sĩ khi đến giờ hẹn. Quá mốc muộn nhất thì mã QR hết hiệu lực, slot được nhả; nếu vẫn muốn khám, bệnh nhân đăng ký theo quy trình offline và xếp cuối hàng offline (B). Các mốc thời gian được Admin cấu hình tại UC-032.</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Lễ tân / Hệ thống (quy trình nền tự động)</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Bệnh nhân đã đặt lịch thành công (trạng thái “Đã đặt”) và cung cấp mã QR.</p></li>
<li><p>Lễ tân đã đăng nhập vào hệ thống quản lý.</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Bệnh nhân xuất trình mã QR đặt lịch.</p>
<p>2. Lễ tân sử dụng thiết bị/hệ thống để quét mã QR (hoặc nhập mã đặt lịch thủ công).</p>
<p>3. Hệ thống xác nhận thông tin QR hợp lệ (tồn tại, chưa sử dụng, chưa hủy, chưa hết hiệu lực).</p>
<p>4. Hệ thống kiểm tra thời điểm quét so với giờ hẹn:</p>
<p>4.1. Nếu quét trong khung hợp lệ (từ mốc sớm nhất đến mốc muộn nhất, tức còn tối thiểu 10 phút trước giờ hẹn): Hệ thống chuyển lịch hẹn sang trạng thái “Đã check-in” và xếp bệnh nhân vào quy trình nền, bệnh nhân chưa vào hàng đợi của bác sĩ cho đến giờ hẹn.</p>
<p>5. Quy trình nền quét và cập nhật theo chu kỳ (mặc định mỗi phút). Khi đến giờ hẹn (giờ hẹn − giờ hiện tại = 0), hệ thống tự động chuyển trạng thái sang “Chờ khám” và đưa bệnh nhân vào hàng đợi online (A) của bác sĩ.</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td><p>3a. Mã QR lỗi, không tồn tại, đã sử dụng hoặc đã hủy: Hệ thống báo mã QR không hợp lệ, Lễ tân từ chối check-in.</p>
<p>4a. Bệnh nhân đến quá sớm (trước mốc sớm nhất): Hệ thống báo chưa đến thời gian check-in và cho biết giờ bắt đầu được check-in. Mã QR vẫn còn hiệu lực, bệnh nhân quay lại sau.</p>
<p>4b. Bệnh nhân đến muộn (còn dưới 10 phút trước giờ hẹn hoặc đã quá giờ hẹn): Hệ thống báo mã QR đã hết hiệu lực do quá hạn check-in. Nếu bệnh nhân vẫn muốn khám trong ngày, Lễ tân hướng dẫn đăng ký theo quy trình offline (UC-012); bệnh nhân được xếp vào cuối hàng offline (B) và được gọi như bệnh nhân offline thông thường.</p>
<p>5a. Quy trình nền phát hiện lịch hẹn quá hạn (tự động): Hệ thống quét các lịch hẹn ở trạng thái “Đã đặt” chưa check-in. Khi qua mốc muộn nhất (10 phút trước giờ hẹn), hệ thống chuyển lịch hẹn sang “Quá hạn check-in”, vô hiệu hóa mã QR, giải phóng (cộng lại) 1 slot cho bác sĩ và gửi thông báo cho bệnh nhân trên ứng dụng.</p></td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Check-in hợp lệ: bệnh nhân được ghi nhận đã có mặt, ở trạng thái “Đã check-in” (chờ trong quy trình nền) và tự vào hàng đợi online (A) khi đến giờ hẹn.</p></li>
<li><p>Check-in quá hạn: lịch hẹn ở trạng thái “Quá hạn check-in”, mã QR hết hiệu lực và slot đã được giải phóng.</p></li>
</ul></td>
</tr>
</tbody>
</table>

## UC-012 – Check-in offline bằng quét QR CCCD

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-012 – Check-in offline bằng quét QR CCCD</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Tiếp nhận bệnh nhân đến khám trực tiếp (offline) nhanh chóng bằng cách lấy thông tin từ CCCD.</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Lễ tân quét mã QR trên CCCD của bệnh nhân để tự động điền hồ sơ và cấp số thứ tự vào hàng offline (B). Use case này cũng được dùng để tiếp nhận bệnh nhân đặt lịch online nhưng đến muộn (UC-011) hoặc bị bỏ lượt (UC-016).</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Lễ tân</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Bệnh nhân vãng lai có mang theo thẻ CCCD gắn chip.</p></li>
<li><p>Lễ tân đang ở giao diện tiếp nhận bệnh nhân.</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Bệnh nhân xuất trình CCCD cho Lễ tân.</p>
<p>2. Lễ tân chọn chức năng check-in offline và quét mã QR trên CCCD.</p>
<p>3. Hệ thống tự động trích xuất thông tin hành chính và điền vào form tạo mới hồ sơ.</p>
<p>3.1. Lễ tân nhập nội dung mô tả triệu chứng vào trường thông tin trên phần mềm.</p>
<p>3.2. Dựa vào triệu chứng, Lễ tân chọn chuyên khoa/phòng khám phù hợp trên hệ thống.</p>
<p>3.3. Lễ tân nhấn lưu hồ sơ.</p>
<p>3.4. Hệ thống cập nhật thông tin triệu chứng và chuyển hồ sơ vào hàng đợi của phòng khám đã chọn.</p>
<p>4. Hệ thống cấp số thứ tự và đẩy bệnh nhân vào hàng đợi offline (B).</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td><p>2a. Không quét được QR do thẻ mờ/hỏng: Lễ tân chọn chức năng nhập thủ công và tự gõ thông tin bệnh nhân vào hệ thống.</p>
<p>4a. Bệnh nhân đến từ lịch online quá hạn check-in (UC-011) hoặc bị bỏ lượt (UC-016): Lễ tân dùng lại thông tin từ lịch hẹn/lượt khám cũ (không nhập lại triệu chứng), hệ thống cấp số thứ tự mới ở cuối hàng offline (B).</p></td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Hồ sơ bệnh nhân offline được tạo thành công.</p></li>
<li><p>Bệnh nhân được phân vào hàng đợi offline (B).</p></li>
</ul></td>
</tr>
</tbody>
</table>

## UC-013 – Xem danh sách hàng đợi hiện tại theo phòng

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-013 – Xem danh sách hàng đợi hiện tại theo phòng</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Giúp lễ tân theo dõi thứ tự và danh sách bệnh nhân đang chờ tại từng phòng khám để dễ dàng điều phối.</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Lễ tân tra cứu danh sách bệnh nhân đang chờ trước các phòng. Danh sách hiển thị theo quy tắc STT phân bổ giữa hàng online và offline.</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Lễ tân</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Lễ tân đang truy cập vào hệ thống ở giao diện quản lý khám bệnh.</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Lễ tân chọn chức năng xem danh sách hàng đợi hiện tại.</p>
<p>2. Lễ tân chọn phòng khám cần kiểm tra danh sách.</p>
<p>3. Hệ thống hiển thị danh sách bệnh nhân đang chờ tại phòng đó.</p>
<p>4. Thứ tự danh sách hiển thị tuân thủ quy tắc STT: có hai hàng đợi offline và online chạy song song với tỉ lệ gọi 1 người online đến 1 người offline.</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td>3a. Phòng khám không có bệnh nhân nào chờ: Hệ thống hiển thị thông báo danh sách trống.</td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Lễ tân nắm bắt được thứ tự gọi bệnh nhân tiếp theo và tình trạng hàng đợi của phòng khám.</p></li>
</ul></td>
</tr>
</tbody>
</table>

## UC-014 – Xem danh sách bệnh nhân trong ca theo hàng đợi

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-014 – Xem danh sách bệnh nhân trong ca theo hàng đợi</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Cho phép bác sĩ xem danh sách bệnh nhân thuộc ca khám của mình theo hàng đợi để biết bệnh nhân nào đang chờ khám, đang khám hoặc đã khám xong.</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Bác sĩ truy cập chức năng khám bệnh trong ca trực. Hệ thống hiển thị danh sách bệnh nhân đã được check-in và được xếp vào hàng đợi tương ứng với bác sĩ, phòng khám và ca khám hiện tại.</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Bác sĩ</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Bác sĩ đã đăng nhập vào hệ thống.</p></li>
<li><p>Bác sĩ có ca khám/lịch trực được phân công.</p></li>
<li><p>Có dữ liệu hàng đợi bệnh nhân tương ứng với ca khám.</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Bác sĩ chọn chức năng “Danh sách bệnh nhân trong ca”.</p>
<p>2. Hệ thống xác định ca khám hiện tại của bác sĩ.</p>
<p>3. Hệ thống lấy danh sách bệnh nhân trong hàng đợi tương ứng.</p>
<p>4. Hệ thống hiển thị danh sách bệnh nhân theo hàng đợi.</p>
<p>5. Hệ thống hiển thị các thông tin cần thiết như số thứ tự, họ tên bệnh nhân, loại hàng đợi online/offline và trạng thái chờ khám/đang khám/đã xong.</p>
<p>6. Bác sĩ xem danh sách để tiếp tục lọc trạng thái hoặc gọi bệnh nhân vào khám.</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td><p>2a. Bác sĩ không có ca khám hiện tại: Hệ thống thông báo bác sĩ chưa có ca khám phù hợp.</p>
<p>3a. Không có bệnh nhân trong hàng đợi: Hệ thống hiển thị thông báo chưa có bệnh nhân trong hàng đợi của ca khám hiện tại.</p>
<p>3b. Không tải được dữ liệu hàng đợi: Hệ thống thông báo lỗi và cho phép thử lại.</p></td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Danh sách bệnh nhân trong ca khám được hiển thị.</p></li>
<li><p>Dữ liệu hàng đợi không bị thay đổi sau khi xem danh sách.</p></li>
</ul></td>
</tr>
</tbody>
</table>

## UC-015 – Lọc bệnh nhân theo trạng thái (chờ / đang khám / xong)

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-015 – Lọc bệnh nhân theo trạng thái (chờ / đang khám / xong)</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Cho phép bác sĩ lọc danh sách bệnh nhân trong ca khám theo trạng thái để dễ theo dõi và xử lý bệnh nhân.</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Bác sĩ đang xem danh sách bệnh nhân trong ca khám và chọn trạng thái cần lọc. Hệ thống hiển thị các bệnh nhân tương ứng với trạng thái được chọn gồm chờ khám, đang khám hoặc đã xong.</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Bác sĩ</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Bác sĩ đã đăng nhập vào hệ thống.</p></li>
<li><p>Bác sĩ có ca khám/lịch trực được phân công.</p></li>
<li><p>Danh sách bệnh nhân trong ca khám đã được hiển thị.</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Bác sĩ chọn chức năng lọc bệnh nhân theo trạng thái.</p>
<p>2. Hệ thống hiển thị các trạng thái có thể lọc: chờ khám, đang khám, đã xong.</p>
<p>3. Bác sĩ chọn trạng thái cần xem.</p>
<p>4. Hệ thống lấy danh sách bệnh nhân trong ca khám tương ứng với trạng thái đã chọn.</p>
<p>5. Hệ thống hiển thị danh sách bệnh nhân sau khi lọc.</p>
<p>6. Bác sĩ xem danh sách đã lọc để tiếp tục theo dõi hoặc xử lý bệnh nhân.</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td>4a. Không có bệnh nhân thuộc trạng thái đã chọn: Hệ thống hiển thị thông báo hiện không có bệnh nhân.</td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Danh sách bệnh nhân được hiển thị theo trạng thái bác sĩ đã chọn.</p></li>
<li><p>Dữ liệu hàng đợi không bị thay đổi sau khi thực hiện thao tác lọc.</p></li>
</ul></td>
</tr>
</tbody>
</table>

## UC-016 – Gọi bệnh nhân vào khám

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-016 – Gọi bệnh nhân vào khám</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Cho phép bác sĩ gọi bệnh nhân tiếp theo vào khám, do hệ thống tự chọn theo quy tắc điều phối hàng đợi, và xử lý trường hợp bệnh nhân được gọi nhưng vắng mặt.</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Bác sĩ nhấn “Bệnh nhân tiếp theo”. Hệ thống tự động chọn bệnh nhân theo tỉ lệ gọi 1 online : 1 offline (nếu một hàng trống thì gọi hàng còn lại), chuyển bệnh nhân sang trạng thái “Đang gọi” và hiển thị số thứ tự trên màn hình gọi số. Hệ thống tự động gọi lại số đó nếu bệnh nhân chưa vào, bác sĩ không phải bấm lại. Khi bệnh nhân vào phòng, bác sĩ bấm “Bắt đầu khám”, hệ thống chuyển sang “Đang khám” và mở hồ sơ. Bác sĩ không chọn trực tiếp bệnh nhân trong danh sách để gọi.</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Bác sĩ (chính); Lễ tân (phụ: xếp lại bệnh nhân bị bỏ lượt)</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Bác sĩ đã đăng nhập vào hệ thống.</p></li>
<li><p>Bác sĩ có ca khám/lịch trực được phân công.</p></li>
<li><p>Có bệnh nhân đang ở trạng thái “Chờ khám”.</p></li>
<li><p>Không yêu cầu phòng khám đang trống: bác sĩ có thể thoát hồ sơ của bệnh nhân đang đi xét nghiệm (vẫn ở trạng thái “Đang khám”) rồi gọi bệnh nhân tiếp theo.</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Bác sĩ nhấn “Bệnh nhân tiếp theo”.</p>
<p>2. Hệ thống xác định bệnh nhân tiếp theo theo tỉ lệ 1:1 giữa hàng online (A) và hàng offline (B); nếu một hàng không có bệnh nhân thì lấy bệnh nhân của hàng còn lại.</p>
<p>3. Hệ thống chuyển bệnh nhân sang trạng thái “Đang gọi” (bệnh nhân rời khỏi hàng “Chờ khám”) và hiển thị số thứ tự trên màn hình gọi số.</p>
<p>4. Bệnh nhân vào phòng khám.</p>
<p>5. Bác sĩ chọn “Bắt đầu khám”.</p>
<p>6. Hệ thống chuyển bệnh nhân sang “Đang khám” và mở hồ sơ bệnh nhân để bác sĩ bắt đầu khám.</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td><p>2a. Không còn bệnh nhân ở trạng thái “Chờ khám”: Hệ thống thông báo không còn bệnh nhân chờ khám.</p>
<p>4a. Bệnh nhân được gọi nhưng không vào phòng: Hệ thống tự động gọi lại số thứ tự tối đa N lần (mặc định 3 lần), mỗi lần cách nhau M phút (mặc định 1 phút), cấu hình tại UC-032. Bác sĩ không cần thao tác trong lúc này.</p>
<p>4b. Hết số lần gọi mà bệnh nhân vẫn không vào: Bác sĩ bấm “Vắng mặt” để chuyển bệnh nhân sang trạng thái “Bỏ lượt”. Hệ thống cộng 1 vào bộ đếm số lần bỏ lượt của lượt khám (xem quy tắc bộ đếm ở phần Ghi chú) rồi xử lý theo 4c hoặc 4d. Lượt gọi này không tính vào tỉ lệ 1:1; bác sĩ bấm “Bệnh nhân tiếp theo” thì hệ thống chọn tiếp theo quy tắc ở bước 2 như chưa có lượt vừa rồi.</p>
<p>4c. Bộ đếm bỏ lượt = 1 (bỏ lượt lần đầu) và bệnh nhân vẫn còn ở bệnh viện: Lễ tân chọn “Xếp lại” để đưa bệnh nhân (kể cả bệnh nhân đến từ hàng online) vào cuối hàng offline (B) với số thứ tự mới, trạng thái trở về “Chờ khám”. Bộ đếm giữ nguyên là 1.</p>
<p>4d. Bộ đếm bỏ lượt = 2 (bỏ lượt lần thứ hai, sau khi đã xếp lại), hoặc Lễ tân xác nhận bệnh nhân không còn ở bệnh viện: Hệ thống không cho xếp lại, chuyển lượt khám sang trạng thái “Vắng mặt” và đóng lượt khám. Muốn khám, bệnh nhân phải đăng ký lại (UC-012) và được tính là một lượt khám mới.</p></td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Bệnh nhân được chuyển sang “Đang khám” và hồ sơ bệnh nhân được mở để bác sĩ tiếp tục khám; hoặc</p></li>
<li><p>Bệnh nhân vắng mặt được chuyển sang “Bỏ lượt” (và được xếp lại một lần hoặc chuyển “Vắng mặt”), bác sĩ tiếp tục gọi bệnh nhân khác.</p></li>
</ul></td>
</tr>
<tr class="even">
<td><strong>Ghi chú</strong></td>
<td><p>Quy tắc bộ đếm bỏ lượt:</p>
<ul>
<li><p>Bộ đếm gắn với lượt khám của bệnh nhân, không gắn với số thứ tự (vì số thứ tự đổi khi xếp lại).</p></li>
<li><p>Bắt đầu từ 0 khi bệnh nhân vào hàng (check-in online hoặc tiếp đón offline).</p></li>
<li><p>Mỗi lần bệnh nhân chuyển sang “Bỏ lượt”, hệ thống cộng 1.</p></li>
<li><p>Sau khi cộng: bằng 1 thì cho phép lễ tân xếp lại (bộ đếm giữ nguyên là 1); bằng 2 thì chuyển “Vắng mặt”, không cho xếp lại.</p></li>
<li><p>Bệnh nhân đăng ký lại sau khi “Vắng mặt” là lượt khám mới, bộ đếm quay về 0.</p></li>
</ul>
<p>Ví dụ: B05 được gọi và vắng mặt (bộ đếm = 1), lễ tân xếp lại thành A12 ở cuối hàng offline. Đến lượt A12 được gọi mà vẫn vắng mặt (bộ đếm = 2) thì chuyển “Vắng mặt”, muốn khám phải đăng ký lại.</p></td>
</tr>
</tbody>
</table>

## UC-017 – Xem hồ sơ và lịch sử khám của bệnh nhân

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-017 – Xem hồ sơ và lịch sử khám của bệnh nhân</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Cho phép bác sĩ xem hồ sơ bệnh án và lịch sử khám của bệnh nhân để phục vụ quá trình khám.</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Sau khi gọi bệnh nhân vào khám, bác sĩ mở hồ sơ bệnh án để xem thông tin cá nhân, lịch sử khám, kết quả khám và kết quả xét nghiệm trước đó (nếu có). Bác sĩ chỉ xem được hồ sơ khi bệnh nhân đang ở trạng thái “Đang khám”.</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Bác sĩ</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Bác sĩ đã đăng nhập vào hệ thống.</p></li>
<li><p>Bệnh nhân đang ở trạng thái “Đang khám”.</p></li>
<li><p>Hồ sơ bệnh án của bệnh nhân tồn tại trong hệ thống.</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Bác sĩ chọn bệnh nhân.</p>
<p>2. Bác sĩ chọn “Xem hồ sơ”.</p>
<p>3. Hệ thống hiển thị hồ sơ.</p>
<p>4. Bác sĩ xem thông tin.</p>
<p>5. Hệ thống duy trì màn hình để tiếp tục khám.</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td>Không có.</td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Hồ sơ bệnh án của bệnh nhân được hiển thị.</p></li>
<li><p>Bác sĩ có thể tiếp tục nhập triệu chứng hoặc thực hiện các bước khám tiếp theo.</p></li>
</ul></td>
</tr>
</tbody>
</table>

## UC-018 – Nhập triệu chứng và chỉ định xét nghiệm

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-018 – Nhập triệu chứng và chỉ định xét nghiệm</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Cho phép bác sĩ ghi nhận triệu chứng, thông tin lâm sàng của bệnh nhân và chỉ định xét nghiệm (nếu cần) trong quá trình khám.</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Sau khi xem hồ sơ bệnh án, bác sĩ nhập triệu chứng và thông tin lâm sàng của bệnh nhân. Nếu cần, bác sĩ lựa chọn các xét nghiệm cần thực hiện. Hệ thống lưu thông tin khám và cập nhật chỉ định xét nghiệm. Bệnh nhân vẫn ở trạng thái “Đang khám” trong lúc đi xét nghiệm.</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Bác sĩ</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Bác sĩ đã đăng nhập vào hệ thống.</p></li>
<li><p>Bệnh nhân đang ở trạng thái “Đang khám”.</p></li>
<li><p>Hồ sơ bệnh án của bệnh nhân đã được mở.</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Bác sĩ chọn chức năng “Nhập triệu chứng”.</p>
<p>2. Hệ thống hiển thị biểu mẫu nhập thông tin khám.</p>
<p>3. Bác sĩ nhập triệu chứng và thông tin lâm sàng.</p>
<p>4. Nếu cần, bác sĩ chọn một hoặc nhiều xét nghiệm.</p>
<p>5. Bác sĩ chọn chức năng “Lưu”.</p>
<p>6. Hệ thống lưu thông tin khám và chỉ định xét nghiệm (nếu có).</p>
<p>7. Hệ thống cập nhật danh sách chờ xét nghiệm đối với các chỉ định đã được tạo.</p>
<p>8. Hệ thống thông báo lưu thành công.</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td><p>4a. Bác sĩ không chỉ định xét nghiệm: Hệ thống chỉ lưu thông tin khám.</p>
<p>4b. Bác sĩ chọn chức năng chỉ định nhưng chưa chọn xét nghiệm nào: Hệ thống thông báo yêu cầu chọn ít nhất một xét nghiệm.</p></td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Triệu chứng và thông tin lâm sàng được lưu vào hồ sơ bệnh án.</p></li>
<li><p>Chỉ định xét nghiệm (nếu có) được tạo và cập nhật vào danh sách chờ xét nghiệm.</p></li>
</ul></td>
</tr>
</tbody>
</table>

## UC-019 – Nhận kết quả xét nghiệm từ phòng xét nghiệm

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-019 – Nhận kết quả xét nghiệm từ phòng xét nghiệm</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Cho phép bác sĩ xem kết quả xét nghiệm của bệnh nhân để phục vụ quá trình chẩn đoán.</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Sau khi phòng xét nghiệm hoàn thành xét nghiệm, hệ thống cập nhật kết quả vào cùng hồ sơ của bệnh nhân. Hệ thống không gửi thông báo riêng cho bác sĩ: khi bệnh nhân quay lại phòng khám báo đã có kết quả, bác sĩ mở hồ sơ bệnh nhân trong danh sách “Đang khám” và xem kết quả.</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Bác sĩ</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Bác sĩ đã đăng nhập vào hệ thống.</p></li>
<li><p>Bệnh nhân đang ở trạng thái “Đang khám”.</p></li>
<li><p>Kết quả xét nghiệm của bệnh nhân đã có trong hệ thống.</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Bác sĩ chọn chức năng “Xem kết quả xét nghiệm”.</p>
<p>2. Hệ thống hiển thị kết quả xét nghiệm của bệnh nhân.</p>
<p>3. Bác sĩ xem kết quả xét nghiệm.</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td>2a. Chưa có kết quả xét nghiệm: Hệ thống thông báo kết quả xét nghiệm chưa sẵn sàng.</td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Kết quả xét nghiệm được hiển thị để bác sĩ phục vụ cho quá trình khám bệnh.</p></li>
</ul></td>
</tr>
</tbody>
</table>

## UC-020 – Nhập, lưu và in kết quả khám (Chẩn đoán, lời dặn, đơn thuốc)

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-020 – Nhập, lưu và in kết quả khám (Chẩn đoán, lời dặn, đơn thuốc)</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Cho phép bác sĩ nhập kết quả khám của bệnh nhân gồm chẩn đoán, lời dặn và đơn thuốc; lưu vào hồ sơ bệnh án và in kết quả khám cho bệnh nhân.</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Sau khi hoàn tất quá trình khám và xem kết quả xét nghiệm (nếu có), bác sĩ nhập chẩn đoán, lời dặn và đơn thuốc. Sau đó bác sĩ thực hiện lưu và in kết quả khám. Hệ thống lưu dữ liệu vào hồ sơ bệnh án và tạo bản in kết quả khám.</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Bác sĩ</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Bác sĩ đã đăng nhập vào hệ thống.</p></li>
<li><p>Bệnh nhân đang ở trạng thái “Đang khám”.</p></li>
<li><p>Hồ sơ bệnh án của bệnh nhân đã được mở.</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Bác sĩ chọn chức năng “Nhập kết quả khám”.</p>
<p>2. Hệ thống hiển thị biểu mẫu nhập kết quả khám.</p>
<p>3. Bác sĩ nhập chẩn đoán, lời dặn và đơn thuốc.</p>
<p>4. Bác sĩ chọn chức năng “Lưu và in kết quả khám”.</p>
<p>5. Hệ thống lưu kết quả khám vào hồ sơ bệnh án.</p>
<p>6. Hệ thống tạo bản in kết quả khám.</p>
<p>7. Bác sĩ kiểm tra và thực hiện in kết quả khám.</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td>3a. Thông tin nhập chưa đầy đủ hoặc không hợp lệ: Hệ thống thông báo lỗi và yêu cầu bác sĩ nhập lại.</td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Kết quả khám được lưu vào hồ sơ bệnh án.</p></li>
<li><p>Kết quả khám được in thành công.</p></li>
</ul></td>
</tr>
<tr class="even">
<td><strong>Ghi chú</strong></td>
<td>Hệ thống chỉ dừng ở bước bác sĩ nhập và in đơn thuốc cho bệnh nhân; không có luồng lấy thuốc và ra về (xem phần Phạm vi hệ thống).</td>
</tr>
</tbody>
</table>

## UC-021 – Đóng hồ sơ khám (khóa chỉnh sửa, gửi hồ sơ vào app bệnh nhân)

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-021 – Đóng hồ sơ khám (khóa chỉnh sửa, gửi hồ sơ vào app bệnh nhân)</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Kết thúc quá trình khám của một bệnh nhân trong ca, khóa chỉnh sửa hồ sơ của phiên khám hôm đó và gửi hồ sơ khám vào ứng dụng của bệnh nhân.</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Sau khi đã nhập xong kết quả khám, chẩn đoán và đơn thuốc, bác sĩ đóng hồ sơ. Đóng hồ sơ nghĩa là hoàn tất lần khám tại bệnh viện: hồ sơ phiên khám không còn chỉnh sửa được, bệnh nhân rời khỏi danh sách đang khám và hồ sơ khám của ngày hôm đó được gửi vào ứng dụng của bệnh nhân. Hồ sơ đã đóng vẫn xem được ở chế độ chỉ đọc, dùng làm lịch sử khám cho các lần sau (bác sĩ xem qua UC-017, bệnh nhân xem qua UC-037). Nếu bệnh nhân quay lại khám đợt mới thì mở phiên khám mới.</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Bác sĩ</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Bệnh nhân đang ở trạng thái “Đang khám”.</p></li>
<li><p>Hồ sơ đã được nhập đầy đủ kết quả khám hoặc đã nhận đủ kết quả xét nghiệm cần thiết (nếu có chỉ định).</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Bác sĩ chọn “Đóng hồ sơ” trên hồ sơ bệnh nhân đang khám.</p>
<p>2. Hệ thống hiển thị xác nhận đóng hồ sơ.</p>
<p>3. Bác sĩ xác nhận.</p>
<p>4. Hệ thống chuyển trạng thái bệnh nhân sang “Đã khám xong” và khóa quyền chỉnh sửa hồ sơ của phiên khám này (hồ sơ chỉ còn ở chế độ xem).</p>
<p>5. Hệ thống loại bệnh nhân khỏi danh sách hàng đợi đang khám.</p>
<p>6. Hệ thống gửi hồ sơ khám của ngày hôm đó (triệu chứng, chẩn đoán, lời dặn, đơn thuốc, kết quả xét nghiệm) vào mục “Lịch sử khám” trên ứng dụng của bệnh nhân (UC-037).</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td><p>3a. Bác sĩ hủy xác nhận: Hệ thống giữ nguyên trạng thái “Đang khám”.</p>
<p>6a. Gửi hồ sơ vào ứng dụng bị lỗi: Hồ sơ vẫn được đóng; hệ thống tự động thử gửi lại, bệnh nhân xem được hồ sơ khi gửi thành công.</p></td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Hồ sơ bệnh nhân ở trạng thái “Đã khám xong”, chỉ còn quyền xem; hồ sơ được lưu vào lịch sử khám của bệnh nhân.</p></li>
<li><p>Hồ sơ khám của ngày hôm đó có trong ứng dụng của bệnh nhân.</p></li>
</ul></td>
</tr>
</tbody>
</table>

## UC-022 – Xem lịch trực của bản thân theo tuần

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-022 – Xem lịch trực của bản thân theo tuần</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Giúp bác sĩ nắm được thời gian và phòng khám được phân công trong tuần để chủ động sắp xếp công việc.</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Bác sĩ tra cứu lịch trực do Admin phân công, xem theo tuần, gồm ngày, giờ, phòng khám và chuyên khoa phụ trách.</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Bác sĩ</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Bác sĩ đã đăng nhập; lịch trực đã được Admin phân công cho tuần cần xem.</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Bác sĩ chọn mục “Lịch trực”.</p>
<p>2. Hệ thống hiển thị lịch trực tuần hiện tại theo mặc định.</p>
<p>3. Bác sĩ chọn xem tuần trước hoặc tuần sau (nếu cần).</p>
<p>4. Hệ thống hiển thị danh sách ca trực: ngày, khung giờ, phòng khám.</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td>2a. Tuần được chọn chưa có lịch phân công: Hệ thống hiển thị thông báo “Chưa có lịch trực trong tuần này”.</td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Bác sĩ nắm được lịch trực của tuần đã chọn; không có dữ liệu nào bị thay đổi.</p></li>
</ul></td>
</tr>
</tbody>
</table>

## UC-023 – Xem danh sách bệnh nhân chờ xét nghiệm

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-023 – Xem danh sách bệnh nhân chờ xét nghiệm</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Giúp nhân viên phòng xét nghiệm nắm được danh sách bệnh nhân cần xử lý.</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Hệ thống hiển thị danh sách bệnh nhân đã được bác sĩ chỉ định xét nghiệm và đang chờ xử lý, tại phòng xét nghiệm mà nhân viên phụ trách.</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Nhân viên phòng xét nghiệm</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Nhân viên phòng xét nghiệm đã đăng nhập bằng tài khoản cá nhân; tài khoản đã được gắn với phòng xét nghiệm cụ thể (UC-029).</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Nhân viên phòng xét nghiệm chọn mục “Danh sách chờ xét nghiệm”.</p>
<p>2. Hệ thống lấy danh sách bệnh nhân có chỉ định xét nghiệm gửi đến phòng của nhân viên, trạng thái “Chờ xử lý”.</p>
<p>3. Hệ thống hiển thị danh sách theo thứ tự thời gian chỉ định.</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td>2a. Không có bệnh nhân nào đang chờ: Hệ thống hiển thị danh sách trống kèm thông báo.</td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Danh sách bệnh nhân chờ xét nghiệm được hiển thị; không có dữ liệu nào bị thay đổi.</p></li>
</ul></td>
</tr>
</tbody>
</table>

## UC-024 – Lọc theo trạng thái (chờ / đang xử lý / xong)

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-024 – Lọc theo trạng thái (chờ / đang xử lý / xong)</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Giúp nhân viên phòng xét nghiệm thu hẹp danh sách để tập trung xử lý theo từng trạng thái.</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Use case mở rộng của UC-023, cho phép lọc danh sách bệnh nhân xét nghiệm theo trạng thái xử lý.</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Nhân viên phòng xét nghiệm</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Đang xem danh sách bệnh nhân xét nghiệm (UC-023).</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Nhân viên phòng xét nghiệm chọn một trạng thái lọc: Chờ / Đang xử lý / Xong.</p>
<p>2. Hệ thống lọc và hiển thị lại danh sách theo trạng thái đã chọn.</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td><p>1a. Không có bệnh nhân nào ở trạng thái được chọn: Hệ thống hiển thị danh sách trống.</p>
<p>2a. Nhân viên bỏ chọn bộ lọc: Hệ thống trả về danh sách đầy đủ.</p></td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Danh sách hiển thị đúng theo trạng thái đã lọc.</p></li>
</ul></td>
</tr>
</tbody>
</table>

## UC-025 – Mở hồ sơ, nhận chỉ định và cập nhật trạng thái xử lý

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-025 – Mở hồ sơ, nhận chỉ định và cập nhật trạng thái xử lý</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Cho phép nhân viên phòng xét nghiệm xem chi tiết chỉ định của bác sĩ và xác nhận bắt đầu xử lý mẫu xét nghiệm.</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Nhân viên mở hồ sơ bệnh nhân từ danh sách chờ, xem loại xét nghiệm được chỉ định, sau đó chuyển trạng thái từ “Chờ xử lý” sang “Đang xử lý” khi bắt đầu thực hiện. Với bệnh nhân offline, nhân viên báo thời gian ước chừng có kết quả.</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Nhân viên phòng xét nghiệm</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Bệnh nhân có trong danh sách chờ xét nghiệm (UC-023), trạng thái đang là “Chờ xử lý”.</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Nhân viên chọn một bệnh nhân từ danh sách.</p>
<p>2. Hệ thống hiển thị hồ sơ, gồm loại xét nghiệm được chỉ định và thông tin liên quan của bệnh nhân.</p>
<p>3. Nhân viên chọn “Bắt đầu xử lý”.</p>
<p>4. Hệ thống chuyển trạng thái bệnh nhân sang “Đang xử lý”, ghi nhận người xử lý và thời điểm bắt đầu.</p>
<p>5. Đối với bệnh nhân offline (không dùng ứng dụng), nhân viên thông báo trực tiếp thời gian ước chừng có kết quả.</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td>3a. Nhân viên chỉ xem hồ sơ mà không bắt đầu xử lý: Trạng thái giữ nguyên “Chờ xử lý”.</td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Trạng thái bệnh nhân chuyển thành “Đang xử lý” (nếu nhân viên xác nhận bắt đầu); hồ sơ ghi nhận người và thời điểm xử lý.</p></li>
</ul></td>
</tr>
<tr class="even">
<td><strong>Ghi chú</strong></td>
<td>Luồng từ chối mẫu xét nghiệm và yêu cầu lấy lại mẫu chưa nằm trong phạm vi hiện tại, sẽ phát triển sau (xem phần Phạm vi hệ thống).</td>
</tr>
</tbody>
</table>

## UC-026 – Tải kết quả xét nghiệm, thông báo và đóng hồ sơ

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-026 – Tải kết quả xét nghiệm, thông báo và đóng hồ sơ</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Ghi nhận kết quả xét nghiệm vào hồ sơ bệnh án, báo cho bệnh nhân biết kết quả đã sẵn sàng, đồng thời khóa quyền chỉnh sửa để tránh thay đổi kết quả sau khi đã gửi.</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Sau khi có kết quả, nhân viên phòng xét nghiệm tải file kết quả (PDF/hình ảnh) lên hồ sơ bệnh nhân. Bệnh nhân dùng ứng dụng nhận thông báo tự động; bệnh nhân offline được nhân viên báo trực tiếp. Sau đó nhân viên đóng hồ sơ để khóa quyền truy cập phần xét nghiệm này. Hệ thống không gửi thông báo cho bác sĩ: bệnh nhân quay lại phòng khám ban đầu và bác sĩ tự mở hồ sơ trong danh sách “Đang khám” (UC-019).</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Nhân viên phòng xét nghiệm</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Bệnh nhân đang ở trạng thái “Đang xử lý”; đã có kết quả xét nghiệm hoàn chỉnh.</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Nhân viên chọn file kết quả từ máy tính.</p>
<p>2. Hệ thống kiểm tra định dạng và dung lượng file hợp lệ.</p>
<p>3. Hệ thống lưu file vào hồ sơ, gắn với lần chỉ định xét nghiệm tương ứng.</p>
<p>4. Hệ thống chuyển trạng thái bệnh nhân sang “Xong”.</p>
<p>5. Đối với bệnh nhân có dùng ứng dụng (đặt lịch online): Hệ thống gửi thông báo “Đã có kết quả xét nghiệm, vui lòng quay lại phòng khám”, không kèm số liệu kết quả.</p>
<p>6. Đối với bệnh nhân offline (không nhận được thông báo trên ứng dụng): Nhân viên thông báo trực tiếp kết quả đã sẵn sàng (hoặc theo thời gian ước chừng đã báo ở UC-025) và dặn bệnh nhân quay lại thẳng phòng khám ban đầu.</p>
<p>7. Nhân viên chọn “Đóng hồ sơ” trên hồ sơ bệnh nhân đã có kết quả.</p>
<p>8. Hệ thống hiển thị yêu cầu xác nhận.</p>
<p>9. Nhân viên xác nhận.</p>
<p>10. Hệ thống khóa quyền truy cập phần hồ sơ xét nghiệm này.</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td><p>2a. Nhân viên hủy thao tác giữa chừng: Không có gì được lưu, trạng thái giữ “Đang xử lý”.</p>
<p>3a. File sai định dạng hoặc vượt dung lượng cho phép: Hệ thống từ chối và yêu cầu chọn lại file (quay lại bước 2).</p>
<p>9a. Nhân viên hủy xác nhận đóng hồ sơ: Kết quả và thông báo vẫn giữ nguyên, hồ sơ ở trạng thái “Xong”, chưa khóa. Nhân viên có thể đóng hồ sơ sau.</p></td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Kết quả xét nghiệm được lưu trong hồ sơ, trạng thái bệnh nhân là “Xong”.</p></li>
<li><p>Bệnh nhân đã được thông báo (qua ứng dụng hoặc trực tiếp).</p></li>
<li><p>Phần kết quả xét nghiệm bị khóa, không thể chỉnh sửa.</p></li>
<li><p>Bác sĩ xem được kết quả khi mở hồ sơ bệnh nhân đang khám (UC-019). Bệnh nhân xem được kết quả trong ứng dụng sau khi bác sĩ đóng hồ sơ khám (UC-021, UC-037).</p></li>
</ul></td>
</tr>
<tr class="even">
<td><strong>Ghi chú</strong></td>
<td>Luồng từ chối mẫu xét nghiệm và lấy lại mẫu chưa nằm trong phạm vi hiện tại.</td>
</tr>
</tbody>
</table>

## UC-027 – Quản lý danh mục chuyên khoa

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-027 – Quản lý danh mục chuyên khoa</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Duy trì danh sách chuyên khoa của bệnh viện để dùng trong việc đặt lịch, phân bác sĩ và tra cứu.</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Admin thêm, sửa, hoặc xóa các chuyên khoa (ví dụ: Nội, Ngoại, Nhi, Tai Mũi Họng…). Danh mục này được dùng khi bệnh nhân xem danh sách chuyên khoa.</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Admin</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Admin đã đăng nhập với quyền quản trị danh mục.</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Admin chọn mục “Quản lý chuyên khoa”.</p>
<p>2. Hệ thống hiển thị danh sách chuyên khoa hiện có.</p>
<p>3. Admin chọn thêm mới, sửa hoặc xóa một chuyên khoa.</p>
<p>4. Admin nhập/chỉnh thông tin (tên, mô tả).</p>
<p>5. Hệ thống kiểm tra hợp lệ và lưu thay đổi.</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td><p>3a. Admin chọn xóa một chuyên khoa đang có bác sĩ hoặc lịch khám gắn với nó: Hệ thống từ chối xóa, yêu cầu gỡ liên kết trước.</p>
<p>4a. Tên chuyên khoa bị trùng: Hệ thống báo lỗi, yêu cầu nhập lại.</p></td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Danh mục chuyên khoa được cập nhật; các use case liên quan (đặt lịch, phân công bác sĩ) sử dụng danh sách mới.</p></li>
</ul></td>
</tr>
</tbody>
</table>

## UC-028 – Quản lý thông tin bác sĩ (cấp bậc, phí)

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-028 – Quản lý thông tin bác sĩ (cấp bậc, phí)</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Duy trì hồ sơ hành chính của bác sĩ, gồm chuyên khoa phụ trách, cấp bậc và phí khám tương ứng.</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Admin thêm mới bác sĩ, cập nhật thông tin cấp bậc (ví dụ: Bác sĩ, Thạc sĩ, Tiến sĩ, Phó Giáo sư) và phí khám, chuyên khoa gắn với từng bác sĩ. Thông tin này hiển thị cho bệnh nhân khi đặt lịch.</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Admin</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Admin đã đăng nhập; tài khoản bác sĩ đã tồn tại trong hệ thống (nếu cập nhật) hoặc chuẩn bị tạo mới.</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Admin chọn mục “Quản lý bác sĩ”.</p>
<p>2. Hệ thống hiển thị danh sách bác sĩ hiện có.</p>
<p>3. Admin chọn thêm mới hoặc chỉnh sửa một bác sĩ.</p>
<p>4. Admin nhập/chỉnh thông tin: chuyên khoa, cấp bậc, phí khám.</p>
<p>5. Hệ thống kiểm tra hợp lệ và lưu thay đổi.</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td>4a. Thông tin bắt buộc còn thiếu (chuyên khoa, phí): Hệ thống báo lỗi, yêu cầu nhập đầy đủ.</td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Thông tin bác sĩ được cập nhật; phí khám và cấp bậc mới được áp dụng cho các lượt đặt lịch tiếp theo.</p></li>
</ul></td>
</tr>
</tbody>
</table>

## UC-029 – Quản lý phòng khám và phòng xét nghiệm

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-029 – Quản lý phòng khám và phòng xét nghiệm</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Cho phép Admin quản lý danh sách phòng khám và phòng xét nghiệm, bao gồm thêm, sửa, xóa phòng và gán tài khoản nhân viên tương ứng với từng phòng.</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Admin xem danh sách các phòng khám/xét nghiệm trong hệ thống, thực hiện thêm mới, chỉnh sửa thông tin hoặc xóa phòng. Ngoài ra, Admin gán tài khoản nhân viên (bác sĩ, nhân viên phòng xét nghiệm) vào phòng tương ứng để hệ thống nhận biết phòng nào đang được quản lý bởi tài khoản nào. Phòng là một thuộc tính/địa điểm; người thao tác trên hệ thống luôn là một nhân viên có tài khoản cá nhân.</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Admin</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Admin đã đăng nhập thành công và có quyền quản lý phòng khám.</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Admin chọn chức năng “Quản lý phòng khám &amp; phòng xét nghiệm”.</p>
<p>2. Hệ thống hiển thị danh sách các phòng hiện có (tên phòng, chuyên khoa, loại phòng, tài khoản được gán).</p>
<p>3. Admin chọn thao tác: Thêm mới, Sửa, hoặc Xóa.</p>
<p>4. Trường hợp Thêm mới: Hệ thống hiển thị form (tên phòng, chuyên khoa, loại phòng: khám/xét nghiệm). Admin nhập thông tin và xác nhận. Hệ thống lưu phòng mới vào CSDL.</p>
<p>5. Trường hợp Sửa: Hệ thống hiển thị form chỉnh sửa với thông tin hiện tại. Admin cập nhật thông tin và lưu.</p>
<p>6. Trường hợp Xóa: Hệ thống yêu cầu xác nhận. Admin xác nhận, hệ thống xóa/vô hiệu hóa phòng.</p>
<p>7. Gán tài khoản vào phòng: Admin chọn phòng, chọn tài khoản nhân viên tương ứng (bác sĩ hoặc nhân viên phòng xét nghiệm) và lưu liên kết. Một phòng có thể được gán nhiều tài khoản; mỗi nhân viên dùng tài khoản cá nhân riêng.</p>
<p>8. Hệ thống thông báo thao tác thành công.</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td><p>4a. Tên phòng đã tồn tại: Hệ thống thông báo lỗi trùng tên và yêu cầu nhập lại.</p>
<p>6a. Phòng đang có lịch khám/bệnh nhân hoạt động: Hệ thống cảnh báo và không cho phép xóa.</p>
<p>7a. Tài khoản đã được gán vào phòng khác: Hệ thống thông báo và yêu cầu Admin xác nhận thay đổi.</p>
<p>8a. Admin hủy thao tác: Quay về danh sách phòng.</p></td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Danh sách phòng khám/xét nghiệm đã được cập nhật.</p></li>
<li><p>Tài khoản nhân viên đã được liên kết đúng với phòng tương ứng trong hệ thống.</p></li>
</ul></td>
</tr>
</tbody>
</table>

## UC-030 – Phân công lịch trực bác sĩ theo tuần

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-030 – Phân công lịch trực bác sĩ theo tuần</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Cho phép Admin phân công lịch trực cho từng bác sĩ theo tuần, xác định bác sĩ nào trực tại phòng nào và trong khung giờ nào.</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Admin chọn tuần cần phân công, sau đó gán lịch trực cho từng bác sĩ bao gồm thông tin ngày, phòng khám và khung giờ làm việc. Hệ thống lưu lịch trực và hiển thị lại tổng quan để Admin kiểm tra trước khi xác nhận.</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Admin</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Admin đã đăng nhập thành công.</p></li>
<li><p>Danh sách bác sĩ và phòng khám đã được thiết lập trong hệ thống.</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Admin chọn chức năng “Phân công lịch trực bác sĩ”.</p>
<p>2. Hệ thống hiển thị giao diện chọn tuần (theo lịch).</p>
<p>3. Admin chọn tuần cần phân công.</p>
<p>4. Hệ thống hiển thị danh sách bác sĩ và khung lịch trống của tuần đó.</p>
<p>5. Admin chọn bác sĩ, chọn ngày, chọn phòng khám và chọn khung giờ làm việc (sáng 6h–11h / chiều 13h–16h, mỗi slot cách nhau 1 tiếng).</p>
<p>6. Hệ thống ghi nhận phân công và hiển thị lại tổng quan lịch tuần.</p>
<p>7. Admin kiểm tra và xác nhận lưu lịch.</p>
<p>8. Hệ thống lưu lịch trực vào CSDL (bảng LichKhamBacSi) và thông báo thành công.</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td><p>5a. Khung giờ đã được phân công cho bác sĩ khác tại cùng phòng: Hệ thống cảnh báo xung đột lịch.</p>
<p>5b. Bác sĩ đã có lịch trực trong khung giờ đó: Hệ thống thông báo trùng lịch và yêu cầu chọn lại.</p>
<p>7a. Admin hủy thao tác: Hệ thống không lưu thay đổi và quay về màn hình trước.</p></td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Lịch trực của các bác sĩ trong tuần được chọn đã được lưu thành công.</p></li>
<li><p>Bác sĩ có thể xem lịch trực của mình (UC-022).</p></li>
<li><p>Hệ thống mở slot đặt lịch cho bệnh nhân tương ứng với lịch vừa phân công.</p></li>
</ul></td>
</tr>
</tbody>
</table>

## UC-031 – Tạo khung giờ và cấu hình số slot tối đa mỗi khung giờ

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-031 – Tạo khung giờ và cấu hình số slot tối đa mỗi khung giờ</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Cho phép Admin định nghĩa các khung giờ khám và thiết lập số lượt đặt lịch tối đa (slot) cho mỗi khung giờ, bao gồm phân chia slot online và offline.</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Admin thiết lập hoặc chỉnh sửa cấu hình khung giờ khám trong ngày (giờ bắt đầu, giờ kết thúc) và số slot tối đa cho mỗi khung giờ đó, đồng thời chỉ định số slot dành riêng cho bệnh nhân online. Cấu hình này được áp dụng khi Admin phân công lịch trực bác sĩ.</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Admin</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Admin đã đăng nhập thành công và có quyền cấu hình hệ thống.</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Admin chọn chức năng “Cấu hình khung giờ &amp; slot”.</p>
<p>2. Hệ thống hiển thị danh sách các khung giờ đã được tạo (giờ bắt đầu, slot online).</p>
<p>3. Admin chọn “Thêm mới” hoặc chọn giờ có sẵn để chỉnh sửa.</p>
<p>4. Hệ thống hiển thị form nhập: Giờ bắt đầu, Số slot dành cho online.</p>
<p>5. Admin nhập thông tin và xác nhận.</p>
<p>6. Hệ thống kiểm tra tính hợp lệ (slot online, giờ không trùng lặp).</p>
<p>7. Hệ thống lưu cấu hình vào CSDL và thông báo thành công.</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td><p>6a. Khung giờ mới trùng với khung giờ đã tồn tại: Hệ thống cảnh báo và yêu cầu điều chỉnh.</p>
<p>6b. Khung giờ đang được sử dụng trong lịch trực hiện tại: Hệ thống cảnh báo ảnh hưởng và yêu cầu Admin xác nhận trước khi lưu.</p>
<p>7a. Admin hủy: Quay về danh sách cấu hình.</p></td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Khung giờ và số slot tối đa được lưu thành công. Cấu hình được áp dụng cho các lịch trực bác sĩ được phân công từ thời điểm này trở đi.</p></li>
</ul></td>
</tr>
</tbody>
</table>

## UC-032 – Cấu hình quy tắc hàng đợi STT, check-in và tham số chu kỳ quét

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-032 – Cấu hình quy tắc hàng đợi STT, check-in và tham số chu kỳ quét</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Cho phép Admin thiết lập các tham số điều hành hàng đợi và check-in: tỉ lệ gọi online/offline, các mốc thời gian check-in của lịch hẹn online, số lần gọi bệnh nhân vắng mặt và chu kỳ quét tự động.</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td><p>Admin thiết lập các tham số sau (giá trị mặc định):</p>
<ul>
<li><p>Tỉ lệ gọi online : offline (1:1).</p></li>
<li><p>Thời gian check-in tối thiểu trước giờ hẹn (10 phút): bệnh nhân phải check-in trước giờ hẹn ít nhất khoảng này, nếu không mã QR hết hiệu lực và slot được nhả.</p></li>
<li><p>Thời gian check-in sớm nhất trước giờ hẹn (60 phút): không cho check-in sớm hơn mốc này.</p></li>
<li><p>Số lần gọi tối đa cho bệnh nhân vắng mặt (3 lần) và khoảng cách giữa các lần gọi (1 phút).</p></li>
<li><p>Chu kỳ quét tự động cập nhật trạng thái hàng đợi và lịch hẹn quá hạn (1 phút).</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Admin</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Admin đã đăng nhập thành công và có quyền cấu hình hệ thống.</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Admin chọn chức năng “Cấu hình quy tắc hàng đợi”.</p>
<p>2. Hệ thống hiển thị giao diện cấu hình với các tham số hiện tại: Tỉ lệ gọi online:offline; Thời gian check-in tối thiểu trước giờ hẹn (phút); Thời gian check-in sớm nhất trước giờ hẹn (phút); Số lần gọi tối đa và khoảng cách giữa các lần gọi; Chu kỳ quét cập nhật trạng thái (giây/phút).</p>
<p>3. Admin chỉnh sửa các tham số theo nhu cầu vận hành.</p>
<p>4. Admin xác nhận lưu cấu hình.</p>
<p>5. Hệ thống kiểm tra tính hợp lệ của các giá trị (số dương, trong ngưỡng cho phép; mốc sớm nhất phải lớn hơn mốc tối thiểu).</p>
<p>6. Hệ thống lưu cấu hình và thông báo thành công. Cấu hình mới được áp dụng cho các phiên hàng đợi tiếp theo.</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td><p>5a. Tham số nhập vào không hợp lệ (âm, bằng 0, vượt ngưỡng tối đa, hoặc mốc sớm nhất không lớn hơn mốc tối thiểu): Hệ thống thông báo lỗi và yêu cầu nhập lại.</p>
<p>5b. Admin hủy thao tác: Hệ thống giữ nguyên cấu hình cũ và quay về màn hình trước.</p></td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Cấu hình quy tắc hàng đợi, mốc check-in và chu kỳ quét được lưu thành công.</p></li>
<li><p>Hệ thống điều phối STT, kiểm tra check-in (UC-011) và gọi bệnh nhân (UC-016) theo tham số mới từ thời điểm áp dụng.</p></li>
</ul></td>
</tr>
</tbody>
</table>

## UC-033 – Xem tổng thể lịch khám tất cả bác sĩ

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-033 – Xem tổng thể lịch khám tất cả bác sĩ</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Cho phép Admin xem toàn bộ lịch khám của tất cả bác sĩ trong hệ thống theo ngày hoặc theo tuần để nắm bắt tổng quan tình trạng hoạt động.</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Admin truy cập màn hình tổng quan lịch khám, lọc theo ngày/tuần hoặc theo chuyên khoa/bác sĩ. Hệ thống hiển thị lịch của từng bác sĩ bao gồm phòng khám, khung giờ, số slot đã đặt và còn trống.</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Admin</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Admin đã đăng nhập thành công.</p></li>
<li><p>Đã có lịch trực bác sĩ được phân công trong hệ thống.</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Admin chọn chức năng “Xem tổng thể lịch khám”.</p>
<p>2. Hệ thống hiển thị giao diện lịch tổng quan mặc định theo ngày hiện tại.</p>
<p>3. Admin có thể lọc theo: Ngày cụ thể hoặc tuần, Chuyên khoa, Bác sĩ, Phòng khám.</p>
<p>4. Hệ thống truy vấn và hiển thị danh sách lịch khám theo bộ lọc, gồm: Tên bác sĩ, Phòng khám, Khung giờ, Số slot đã đặt / tổng slot, Trạng thái (mở/khóa/nghỉ).</p>
<p>5. Admin xem thông tin chi tiết từng lịch nếu cần.</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td><p>4a. Không có lịch nào trong khoảng thời gian được chọn: Hệ thống thông báo “Không có lịch khám trong khoảng thời gian này”.</p>
<p>4b. Admin thay đổi bộ lọc: Hệ thống cập nhật lại kết quả hiển thị tương ứng.</p></td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Admin đã xem được toàn bộ lịch khám của các bác sĩ theo bộ lọc đã chọn. Không có thay đổi dữ liệu nào được thực hiện trong use case này.</p></li>
</ul></td>
</tr>
</tbody>
</table>

## UC-034 – Đăng/sửa/xóa tin tức bệnh viện và quy trình khám bệnh

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-034 – Đăng/sửa/xóa tin tức bệnh viện và quy trình khám bệnh</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Cho phép Admin quản lý nội dung hiển thị cho bệnh nhân trên ứng dụng, bao gồm tin tức bệnh viện và quy trình các bước khám bệnh.</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Admin thực hiện đăng mới, chỉnh sửa hoặc xóa các bài tin tức và các bước quy trình khám bệnh. Nội dung sau khi đăng sẽ hiển thị cho bệnh nhân ở màn hình tương ứng.</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Admin</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Admin đã đăng nhập thành công và có quyền quản lý nội dung.</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Admin chọn chức năng “Quản lý nội dung”.</p>
<p>2. Hệ thống hiển thị hai mục: Tin tức bệnh viện và Quy trình khám bệnh.</p>
<p>3. Admin chọn mục cần quản lý và thao tác: Thêm mới, Sửa, hoặc Xóa.</p>
<p>4. Trường hợp Thêm mới tin tức: Admin nhập tiêu đề, nội dung, chọn trạng thái (hiển thị/ẩn) và xác nhận. Hệ thống lưu bài tin tức mới.</p>
<p>5. Trường hợp Sửa tin tức/quy trình: Hệ thống hiển thị form với nội dung hiện tại. Admin chỉnh sửa và lưu.</p>
<p>6. Trường hợp Xóa: Hệ thống yêu cầu xác nhận. Admin xác nhận, hệ thống xóa nội dung.</p>
<p>7. Trường hợp Thêm mới/sửa bước quy trình: Admin nhập/sửa tiêu đề bước, mô tả và số thứ tự hiển thị. Hệ thống lưu và sắp xếp lại các bước theo thứ tự.</p>
<p>8. Hệ thống thông báo thao tác thành công.</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td><p>4a. Thiếu tiêu đề hoặc nội dung bắt buộc: Hệ thống thông báo lỗi và yêu cầu nhập đủ thông tin.</p>
<p>7a. Số thứ tự bước quy trình bị trùng: Hệ thống cảnh báo và yêu cầu Admin điều chỉnh.</p>
<p>8a. Admin hủy thao tác: Quay về danh sách nội dung, không lưu thay đổi.</p></td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Nội dung tin tức hoặc quy trình khám bệnh đã được cập nhật thành công. Bệnh nhân có thể xem nội dung mới ngay sau khi Admin lưu (UC-035, UC-036).</p></li>
</ul></td>
</tr>
</tbody>
</table>

## UC-035 – Xem tin tức bệnh viện

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-035 – Xem tin tức bệnh viện</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Cho phép bệnh nhân xem các tin tức, thông báo và thông tin mới nhất từ bệnh viện.</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Bệnh nhân truy cập mục tin tức trên ứng dụng. Hệ thống hiển thị danh sách các bài tin tức đang ở trạng thái hiển thị, sắp xếp theo ngày đăng mới nhất. Bệnh nhân có thể chọn đọc chi tiết từng bài.</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Bệnh nhân</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Ứng dụng đang hoạt động bình thường.</p></li>
<li><p>Admin đã đăng ít nhất một bài tin tức ở trạng thái hiển thị.</p></li>
<li><p>Bệnh nhân không cần đăng nhập để xem tin tức.</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Bệnh nhân chọn mục “Tin tức bệnh viện” trên ứng dụng.</p>
<p>2. Hệ thống truy vấn danh sách tin tức có trạng thái “hiển thị”.</p>
<p>3. Hệ thống hiển thị danh sách tin tức gồm: Tiêu đề, Ngày đăng.</p>
<p>4. Bệnh nhân chọn một bài tin tức.</p>
<p>5. Hệ thống hiển thị nội dung chi tiết của bài tin tức đó.</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td>3a. Chưa có tin tức nào được đăng hoặc tất cả đang ở trạng thái ẩn: Hệ thống hiển thị thông báo “Hiện chưa có tin tức nào”.</td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Bệnh nhân đã xem được danh sách và nội dung chi tiết tin tức bệnh viện. Không có thay đổi dữ liệu nào được thực hiện.</p></li>
</ul></td>
</tr>
</tbody>
</table>

## UC-036 – Xem quy trình các bước khám bệnh

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-036 – Xem quy trình các bước khám bệnh</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Cho phép bệnh nhân xem hướng dẫn các bước trong quy trình khám bệnh tại bệnh viện để chuẩn bị trước khi đến khám.</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Bệnh nhân truy cập mục quy trình khám bệnh. Hệ thống hiển thị danh sách các bước theo thứ tự đã được Admin thiết lập, mỗi bước gồm tiêu đề và mô tả chi tiết.</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Bệnh nhân</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Ứng dụng đang hoạt động bình thường.</p></li>
<li><p>Admin đã cập nhật ít nhất một bước trong quy trình khám bệnh.</p></li>
<li><p>Bệnh nhân không cần đăng nhập để xem quy trình.</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Bệnh nhân chọn mục “Quy trình khám bệnh” trên ứng dụng.</p>
<p>2. Hệ thống truy vấn danh sách các bước quy trình đã được thiết lập.</p>
<p>3. Hệ thống hiển thị các bước theo thứ tự từ nhỏ đến lớn, mỗi bước gồm: Số thứ tự, Tiêu đề bước, Mô tả chi tiết.</p>
<p>4. Bệnh nhân đọc và theo dõi từng bước.</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td>3a. Chưa có bước quy trình nào được thiết lập: Hệ thống hiển thị thông báo “Quy trình khám bệnh đang được cập nhật”.</td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Bệnh nhân đã nắm được các bước trong quy trình khám bệnh. Không có thay đổi dữ liệu nào được thực hiện.</p></li>
</ul></td>
</tr>
</tbody>
</table>

## UC-037 – Xem lịch sử khám và kết quả khám/xét nghiệm

<table>
<colgroup>
<col style="width: 21%" />
<col style="width: 78%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Use case</strong></th>
<th><strong>UC-037 – Xem lịch sử khám và kết quả khám/xét nghiệm</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Mục đích</strong></td>
<td>Cho phép bệnh nhân xem lại toàn bộ lịch sử các lần khám bệnh của mình, bao gồm kết quả khám và kết quả xét nghiệm đã được bác sĩ và phòng xét nghiệm cập nhật.</td>
</tr>
<tr class="even">
<td><strong>Mô tả</strong></td>
<td>Bệnh nhân truy cập mục hồ sơ sức khỏe để xem danh sách các lần khám đã thực hiện. Với mỗi lần khám, bệnh nhân có thể xem chi tiết gồm: ngày khám, bác sĩ điều trị, triệu chứng, chẩn đoán, lời dặn, đơn thuốc và file kết quả xét nghiệm (nếu có). Dữ liệu chỉ hiển thị các hồ sơ đã hoàn tất (đã được bác sĩ đóng hồ sơ tại UC-021, khi đó hồ sơ khám của ngày hôm đó được gửi vào ứng dụng).</td>
</tr>
<tr class="odd">
<td><strong>Tác nhân</strong></td>
<td>Bệnh nhân</td>
</tr>
<tr class="even">
<td><strong>Điều kiện trước</strong></td>
<td><ul>
<li><p>Bệnh nhân đã đăng nhập thành công.</p></li>
<li><p>Bệnh nhân đã có ít nhất một lần khám hoàn tất trong hệ thống (hồ sơ đã được đóng).</p></li>
</ul></td>
</tr>
<tr class="odd">
<td><strong>Luồng sự kiện chính (Basic flows)</strong></td>
<td><p>1. Bệnh nhân chọn mục “Lịch sử khám bệnh”.</p>
<p>2. Hệ thống truy vấn và hiển thị danh sách các lần khám đã hoàn tất của bệnh nhân, sắp xếp theo ngày khám mới nhất, gồm: Ngày khám, Chuyên khoa, Tên bác sĩ.</p>
<p>3. Bệnh nhân chọn một lần khám để xem chi tiết.</p>
<p>4. Hệ thống hiển thị chi tiết hồ sơ khám gồm: Ngày khám, Bác sĩ điều trị, Triệu chứng ghi nhận, Chẩn đoán, Lời dặn dò, Đơn thuốc, Kết quả xét nghiệm (file đính kèm, nếu có).</p>
<p>5. Bệnh nhân xem thông tin và có thể tải file kết quả xét nghiệm về (nếu có).</p></td>
</tr>
<tr class="even">
<td><strong>Luồng sự kiện phụ (Alternative Flows)</strong></td>
<td><p>2a. Bệnh nhân chưa có lần khám nào hoàn tất: Hệ thống hiển thị thông báo “Chưa có lịch sử khám bệnh”.</p>
<p>4a. Hồ sơ chưa có kết quả xét nghiệm: Hệ thống hiển thị thông tin khám nhưng phần kết quả xét nghiệm để trống.</p></td>
</tr>
<tr class="odd">
<td><strong>Điều kiện sau</strong></td>
<td><ul>
<li><p>Bệnh nhân đã xem được lịch sử khám và kết quả chi tiết của từng lần khám. Không có thay đổi dữ liệu nào được thực hiện.</p></li>
<li><p>Bảo mật được đảm bảo: chỉ bệnh nhân đang đăng nhập mới xem được hồ sơ của chính mình.</p></li>
</ul></td>
</tr>
</tbody>
</table>

# PHỤ LỤC – DANH SÁCH NỘI DUNG ĐÃ CHỈNH SỬA

| **Use case**                              | **Nội dung chỉnh sửa**                                                                                                                                                                                                                                                                                                                                                                                                 |
|-------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| UC-011                                    | Check-in trong khung từ mốc sớm nhất (60 phút) đến mốc muộn nhất (còn tối thiểu 10 phút trước giờ hẹn). Quá mốc muộn nhất: QR hết hiệu lực, lịch chuyển “Quá hạn check-in”, nhả slot, bệnh nhân đăng ký offline xếp cuối hàng offline. Thêm nhánh quá sớm và quy trình nền tự động quét lịch quá hạn.                                                                                                                  |
| UC-032                                    | Sửa Mục đích (trước đó chép nhầm từ UC-031). Thêm tham số: check-in tối thiểu 10 phút, sớm nhất 60 phút, số lần gọi tối đa và khoảng cách giữa các lần gọi.                                                                                                                                                                                                                                                            |
| UC-016                                    | Bỏ “bác sĩ chọn bệnh nhân”, chỉ còn “Bệnh nhân tiếp theo” do hệ thống chọn theo 1:1 (hàng trống thì gọi hàng kia). Hệ thống tự gọi lại tối đa N lần (bác sĩ chỉ bấm một lần); lượt gọi người vắng mặt không tính vào tỉ lệ 1:1. Thêm trạng thái “Đang gọi”, “Bỏ lượt”, “Vắng mặt” và quy tắc bộ đếm bỏ lượt (bằng 1: xếp lại cuối hàng offline; bằng 2: vắng mặt); cho phép gọi tiếp khi bệnh nhân đang đi xét nghiệm. |
| UC-021                                    | Đổi tiêu đề; làm rõ đóng hồ sơ = hoàn tất khám và khóa chỉnh sửa; thêm bước gửi hồ sơ khám vào ứng dụng bệnh nhân và nhánh lỗi gửi.                                                                                                                                                                                                                                                                                    |
| UC-026                                    | Bỏ chữ “bác sĩ” ở Mục đích; thông báo cho bệnh nhân online qua ứng dụng (không kèm số liệu), nhân viên báo trực tiếp cho bệnh nhân offline.                                                                                                                                                                                                                                                                            |
| UC-002, 003, 004, 023, 024, 025, 026, 029 | Đổi tác nhân “Phòng xét nghiệm” thành “Nhân viên phòng xét nghiệm”.                                                                                                                                                                                                                                                                                                                                                    |
| UC-008                                    | Phí khám là phí tham khảo; thêm lưu ý check-in 10 phút; không cho đặt khung giờ còn dưới 10 phút; sửa trùng số thứ tự bước 3.                                                                                                                                                                                                                                                                                          |
| UC-010, UC-012                            | UC-010: thêm trạng thái “Quá hạn check-in” (ẩn QR). UC-012: thêm nhánh tiếp nhận bệnh nhân đến muộn hoặc bị bỏ lượt, xếp cuối hàng offline.                                                                                                                                                                                                                                                                            |
| UC-019, 020, 025                          | UC-019: bác sĩ tự mở hồ sơ, không có thông báo riêng. UC-020: ghi chú không có luồng lấy thuốc. UC-025: báo thời gian ước chừng cho bệnh nhân offline; ghi chú từ chối mẫu làm sau.                                                                                                                                                                                                                                    |
| Sửa tham chiếu                            | UC-024 (UC-28 → UC-023), UC-030 (UC-027 → UC-022), UC-034 (UC-041/042 → UC-035/036), UC-031 (6c → 6b); thống nhất mã UC dạng UC-0xx.                                                                                                                                                                                                                                                                                   |
| SRS                                       | Thêm phần Phạm vi hệ thống: không thanh toán tổng, không lấy thuốc, chưa làm từ chối mẫu.                                                                                                                                                                                                                                                                                                                              |
