# Đăng ký lịch làm việc lãnh đạo

Website đang hoạt động: **https://linhpmvpub.github.io/CalendarInput/**

Người dùng nhập và gửi ngay trên website, không cần Gmail hoặc đăng nhập và không chuyển sang Google Form. Form có ba nhóm chọn nhiều người, tìm tên không dấu, thời gian bắt đầu/kết thúc, địa điểm, nội dung, đơn vị, người liên hệ và link tài liệu. Kết quả tạo lịch hoặc chờ xử lý trùng hiển thị ngay trên trang.

## Luồng đang vận hành

GitHub Pages nhúng giao diện HTML riêng do Apps Script phục vụ. Giao diện gọi `google.script.run` để lưu vào tab **Đăng ký từ website** trong Google Sheet, sau đó kiểm tra và tạo sự kiện trên Google Calendar. Apps Script chạy bằng quyền quản trị; người gửi không cần được chia sẻ Sheet hoặc Calendar. Bản này không thu email đã xác minh.

Người có đường dẫn được xem danh sách nhân sự trong form và gửi đăng ký theo lựa chọn công khai của đơn vị. API không cho đọc các đăng ký khác hoặc sửa/xóa sự kiện. Quyền chia sẻ của Sheet và Calendar không bị thay đổi. Mã nguồn GitHub chỉ chứa cấu hình mẫu; tên thật được lưu trong Apps Script riêng và cấp cho giao diện lúc tải.

Google Form cũ và trigger cũ vẫn được giữ để bảo toàn hệ thống đã thiết lập; website hiện không dùng chúng. Các phản hồi cũ nằm ở tab **Câu trả lời biểu mẫu 1**.

## Kết quả kiểm thử ngày 26/11/2026

- Gửi từ chính github.io: Sheet nhận dữ liệu, Calendar tạo đúng giờ Việt Nam, trang hiển thị thành công mà không chuyển địa chỉ.
- Gửi cùng người trong khung giờ giao nhau: Sheet lưu **CHỜ XỬ LÝ TRÙNG LỊCH**, không tạo sự kiện thứ hai.
- Xử lý lại dòng thành công: vẫn chỉ có một sự kiện.
- Sự kiện thử đã được hủy. Hai dòng thử giữ lại với trạng thái **KIỂM THỬ ĐÃ DỌN** để đối chiếu.
- 12 kiểm tra dữ liệu/Calendar metadata và 13 kiểm tra API web đạt yêu cầu, gồm ngày sai, tên giả, thời gian đảo, link không hợp lệ, phiên không hợp lệ và gửi lại không tạo thêm dòng.
- Đã kiểm tra triển khai ở quyền **Bất kỳ ai**, thực thi bằng tài khoản quản trị. Chưa thử trên điện thoại thực tế hoặc phiên trình duyệt riêng đã đăng xuất.

## Vận hành

Quản trị xem tab **Đăng ký từ website** trong Sheet và theo dõi cột **Trạng thái xử lý**:

| Trạng thái | Ý nghĩa |
| --- | --- |
| ĐÃ LÊN LỊCH | Đã tạo sự kiện Calendar |
| CHỜ XỬ LÝ TRÙNG LỊCH | Có người trùng lịch hoặc sự kiện nhập tay cần kiểm tra; chưa tạo sự kiện |
| LỖI ĐỒNG BỘ | Đã lưu dữ liệu, cần xem Ghi chú xử lý và nhật ký Apps Script |
| ĐANG XỬ LÝ | Đang chờ xử lý hoặc lần thực thi bị gián đoạn |
| KIỂM THỬ ĐÃ DỌN | Dữ liệu kiểm thử, không phải lịch công tác |

Không chỉnh sửa mã đăng ký/ID sự kiện. Sửa hoặc hủy lịch đã tạo được thực hiện trên Calendar bởi quản trị. Bản này đồng bộ một chiều khi tạo, không tự đồng bộ các chỉnh sửa trong Sheet.

Hàm quản trị `retryPending_()` được đặt riêng tư để khách truy cập web không gọi được; khi cần chạy thủ công trong trình biên tập, quản trị có thể tạo hàm tạm `function runAdminRetry(){ retryPending_(); }`, chạy rồi gỡ hàm tạm; **không đưa hàm tạm vào phiên bản web triển khai**. Hàm xử lý lại chỉ xem các dòng trống trạng thái hoặc LỖI ĐỒNG BỘ; dòng đang xử lý bị gián đoạn cần được quản trị kiểm tra và đặt trạng thái LỖI ĐỒNG BỘ trước khi thử lại. Dòng chờ trùng chỉ xử lý lại sau khi giải quyết xung đột. Không tự thay thế sự kiện cũ.

## Quy tắc xếp lịch

- Ít nhất một người trong ba nhóm; tên phải nằm trong danh sách máy chủ.
- Kết thúc sau bắt đầu; thời gian theo Asia/Ho_Chi_Minh (UTC+7).
- Nội dung tối đa 5.000 ký tự. Link tài liệu phải dùng HTTPS. Link không tự cấp quyền xem tài liệu.
- Trùng người trong Calendar chung: giữ đăng ký chờ xử lý.
- Lịch nhập thủ công chưa có mã thành phần: tạm giữ mọi đăng ký giao nhau để quản trị kiểm tra. Sự kiện free/transparent không chặn.
- Không kiểm tra lịch cá nhân hoặc phòng họp. Không có phân hạng ưu tiên hay màn hình duyệt riêng.
- Một sự kiện chung chứa thành phần trong mô tả, không gửi thư mời và không tạo lịch riêng cho từng người.
- ID cố định cho mỗi lần gửi và khóa xử lý hạn chế tạo trùng. Khi kết nối gián đoạn, bấm gửi lại trên cùng trang dùng lại mã cũ. Tải lại trang tạo phiên mới; không gửi lại một đăng ký đã thành công.
- Kiểm tra xung đột và tạo lịch không phải giao dịch nguyên tử với chỉnh sửa Calendar trực tiếp của quản trị; vẫn cần quản trị xử lý nếu hai bên thay đổi cùng lúc.

## Cấu trúc và cập nhật

- `docs/index.html`: trang GitHub Pages nhúng form riêng.
- `docs/config.js`: URL công khai của Apps Script web app; không có khóa bí mật.
- `apps-script/Code.gs`: xử lý dữ liệu, kiểm tra trùng và Calendar; CONFIG trong repo là mẫu.
- `apps-script/Web.gs`: doGet và API gửi đăng ký công khai.
- `apps-script/WebRegistration.html`: giao diện nhập liệu riêng.
- `apps-script/appsscript.json`: múi giờ Việt Nam, Calendar API v3.
- `tests/validation.cjs`, `tests/web.cjs`: kiểm tra bằng Node.js.

Hệ thống hiện có đã cấu hình CONFIG thật, Script Property `SHEET_ID`, Calendar API và quyền quản trị. **Không chạy lại setup trên hệ thống đang vận hành.** Khi cập nhật, giữ nguyên cấu hình và Script Properties. Dán Web.gs, WebRegistration.html vào đúng tên tệp trong Apps Script. Các hàm quản trị phải kết thúc bằng dấu gạch dưới để không thể gọi từ giao diện công khai.

Trong Apps Script chọn **Triển khai → Quản lý tùy chọn triển khai → Chỉnh sửa → Phiên bản mới → Triển khai**. Giữ **Thực thi bằng tên: Tôi**, **Người có quyền truy cập: Bất kỳ ai**. Dùng cùng hoạt động triển khai để giữ URL hiện có. Nếu tạo hoạt động triển khai khác, cập nhật `window.WEB_APP_URL` trong `docs/config.js`.

GitHub Pages dùng nhánh **main**, thư mục **/docs**. Mỗi commit tự triển khai lại. Nếu trang còn bản cũ, tải lại bằng Ctrl+F5.

## Giới hạn

Không cần máy chủ trả phí, không bật dịch vụ thanh toán. Apps Script và Calendar vẫn có hạn mức sử dụng. Form công khai có bẫy spam đơn giản, kiểm tra đầu vào, giới hạn 20 đăng ký/phiên và 300 đăng ký/ngày để bảo vệ quota; đây không phải cơ chế chống bot mạnh hoặc xác minh danh tính. Tên người liên hệ do người gửi tự nhập. Cần quản trị theo dõi lịch và trạng thái lỗi.

## Tài liệu chính thức

- https://developers.google.com/apps-script/guides/web
- https://developers.google.com/apps-script/guides/html/communication
- https://developers.google.com/apps-script/reference/html/x-frame-options-mode
- https://developers.google.com/apps-script/guides/services/quotas
- https://developers.google.com/workspace/calendar/api/guides/quotas
