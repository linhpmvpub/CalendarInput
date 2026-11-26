# Đăng ký lịch làm việc lãnh đạo

Bản triển khai tối giản: **GitHub Pages → Google Form → Google Sheets → Apps Script → Google Calendar**.

## Trạng thái

Mã nguồn sẵn sàng cấu hình. Chưa kết nối Google Form, chưa kiểm thử đầu-cuối với tài khoản Google thật. Trang sẽ báo chưa kết nối cho đến khi `docs/config.js` có URL Form hợp lệ. Không dùng trang chưa cấu hình để nhận đăng ký thật.

## Vì sao chọn cách này?

GitHub Pages chỉ phục vụ HTML/CSS/JavaScript tĩnh. Google Forms đảm nhiệm nhập liệu, đăng nhập Google và lưu phản hồi vào Sheet. Apps Script chạy bằng quyền của người cài trigger để tạo sự kiện. Không cần VPS, Firebase, Zapier hay Make. Google Forms hỗ trợ nhúng và checkbox chọn nhiều người. Form có giao diện theo Google; nếu cần giao diện riêng, tìm tên tức thời, tra cứu trạng thái hoặc cảnh báo trùng ngay trước khi gửi thì cần bản ứng dụng tùy biến sau này.

## Cấu trúc

- `docs/index.html`: trang dùng trên GitHub Pages, tối ưu điện thoại.
- `docs/config.js`: chỉ chứa đường dẫn Form dành cho người trả lời.
- `apps-script/Code.gs`: tạo Form, liên kết Sheet, cài trigger, kiểm tra và tạo lịch.
- `apps-script/appsscript.json`: múi giờ Việt Nam và Calendar API v3.
- `tests/validation.cjs`: kiểm tra dữ liệu và múi giờ, chạy bằng `node tests/validation.cjs`.

## Thiết lập Google, theo đúng thứ tự

1. Dùng Gmail của người quản trị, tạo **Google Sheet trống riêng**. Gmail đó phải có quyền tạo/sửa sự kiện trong Calendar đích. Chỉ chia sẻ quyền sửa Sheet cho quản trị viên.
2. Trong Sheet chọn **Extensions → Apps Script**. Dán `apps-script/Code.gs` vào `Code.gs`.
3. Trong `CONFIG`, nhập Calendar ID và ba danh sách nhân sự thật. Tên phải duy nhất trong từng nhóm và không chứa dấu phẩy. Không commit cấu hình nhân sự này lên GitHub công khai.
4. Calendar ID đã được cung cấp trong cuộc trao đổi; lấy từ **Calendar → Settings and sharing → Integrate calendar → Calendar ID**, hoặc tham số `src` của liên kết nhúng. Không dán toàn bộ URL vào `calendarId`.
5. Trong Project Settings, đặt time zone **Asia/Ho_Chi_Minh**, bật hiển thị `appsscript.json` và thay bằng tệp manifest kèm theo. Kiểm tra **Services → Google Calendar API v3** đã được bật. Nếu dự án dùng Google Cloud project tự quản lý, bật Google Calendar API trong Cloud Console.
6. Chạy `setup()` một lần và cấp quyền. Script kiểm tra Calendar, tạo Form, nối với Sheet và cài trigger **From spreadsheet → On form submit**. Form ban đầu ngừng nhận đăng ký để chờ cấu hình quyền. Không chạy lại setup khi đã tạo Form; nếu setup lỗi giữa chừng, kiểm tra đối tượng đã tạo trước khi sửa.
7. Mở đường dẫn chỉnh sửa Form trong Execution log. **Settings → Responses → Collect email addresses → Verified**. Không chọn Responder input. Tắt giới hạn một phản hồi vì mỗi người cần đăng ký nhiều lần. Tắt sửa phản hồi và chia sẻ bản tóm tắt kết quả.
8. **Publish/Manage responders**: chỉ cấp quyền trả lời cho các Gmail được phép hoặc nhóm được quản lý; không bật “Anyone with the link” khi dùng nội bộ. Thu email Verified xác minh danh tính nhưng không tự giới hạn người được phép — cần cả hai thiết lập. Kiểm tra bằng một Gmail được phép và một Gmail ngoài danh sách.
9. Bật nhận phản hồi và Publish Form. Copy URL đầy đủ dạng `https://docs.google.com/forms/d/e/.../viewform`, không dùng link chỉnh sửa hoặc link rút gọn. Dán vào `docs/config.js`.
10. Người quản trị xem tab phản hồi trong Sheet. Sau lần gửi đầu tiên, các cột trạng thái xử lý sẽ tự xuất hiện. Trigger chạy tự động, không cần bấm chạy tay.

Không cần deploy Apps Script thành web app cho phương án này. Không cần cấp quyền Sheet/Calendar cho người chỉ đăng ký. Link tài liệu không tự cấp quyền truy cập tài liệu.

## Bật GitHub Pages

Trong repository **Settings → Pages → Build and deployment**:

- Source: **Deploy from a branch**.
- Branch: **main**, folder: **/docs**, Save.
- Địa chỉ dự kiến: `https://linhpmvpub.github.io/CalendarInput/`.

Chỉ `/docs` được xuất bản thành website. Repository hiện công khai: không đưa tên nhân sự nội bộ, tài liệu, dữ liệu đăng ký hoặc thông tin đăng nhập vào repository. URL Form không phải mật khẩu; quyền truy cập phải do Google Forms kiểm soát.

## Trường nhập liệu

| Trường | Cách nhập |
| --- | --- |
| Lãnh đạo UBND tỉnh | Checkbox, nhiều người |
| Lãnh đạo Văn phòng UBND tỉnh | Checkbox, nhiều người |
| Chuyên viên | Checkbox, nhiều người |
| Đơn vị đăng ký; người liên hệ | Văn bản bắt buộc |
| Địa điểm | Văn bản bắt buộc |
| Bắt đầu; kết thúc | Ngày và giờ bắt buộc, UTC+7 |
| Nội dung | Nhiều dòng, bắt buộc |
| Link tài liệu | HTTPS, không bắt buộc |
| Email người gửi | Google Forms thu email Verified |

Ít nhất một người phải được chọn trong ba nhóm. Google Forms không kiểm tra được điều kiện gộp này trước khi gửi; Script kiểm tra sau và ghi lỗi vào Sheet. Trạng thái gửi thành công của Form chỉ là xác nhận đã nhận dữ liệu.

## Quy tắc vận hành đã có trong mã

- Lịch không trùng người tham dự sẽ tự tạo vào Calendar chung.
- Nếu có người trùng lịch, đăng ký vẫn lưu trên Sheet nhưng trạng thái là **CHỜ XỬ LÝ TRÙNG LỊCH**; không tạo Calendar event và không sửa lịch cũ.
- Sự kiện Calendar nhập thủ công không có mã thành phần: tạm giữ mọi đăng ký trùng khoảng thời gian để quản trị kiểm tra. Quy tắc thận trọng này có thể giữ cả lịch không thực sự trùng người. Sự kiện free/transparent không chặn.
- Chỉ kiểm tra Calendar chung đã cấu hình, không quét lịch riêng của từng Gmail; không kiểm tra trùng phòng họp.
- Mã đăng ký cố định đồng thời là Calendar event ID. Khi mất kết nối sau khi tạo, chạy lại sẽ đọc đúng sự kiện thay vì tạo bản thứ hai. ScriptLock tuần tự hóa các lượt xử lý trong cùng script.
- Trạng thái **LỖI ĐỒNG BỘ** lưu nguyên nhân. Người quản trị sửa dữ liệu cần thiết rồi chọn dòng → menu **Xếp lịch → Xử lý lại dòng đang chọn**. Không cài vòng lặp tự thử lại; phải theo dõi lỗi trigger qua Apps Script/Google email.
- Với lịch đã lên Calendar, chạy lại chỉ đối chiếu ID, **không cập nhật nội dung hoặc giờ**. Bản này đồng bộ một chiều khi tạo; đổi/hủy lịch do quản trị xử lý trên Calendar. Không sửa/xóa mã đăng ký hoặc ID sự kiện.
- Người đăng ký không có nút sửa/xóa lịch. Chỉ cấp quyền xem Calendar cho họ; chỉ quản trị có quyền sửa. Đây là cách bảo vệ lịch đã chốt, bao gồm lịch ưu tiên. Chưa có phân hạng ưu tiên hay màn hình duyệt riêng. Người có quyền sửa trực tiếp Calendar vẫn có thể sửa mọi lịch theo quyền Google cấp.
- Nếu quản trị sửa Calendar cùng lúc script đang kiểm tra/tạo sự kiện, vẫn có khả năng phát sinh trùng. Google Calendar không có thao tác “kiểm tra rồi đặt chỗ” nguyên tử; cần quản trị xử lý trường hợp này.
- Một sự kiện chung chứa danh sách người tham dự trong mô tả, không tạo bản riêng cho từng lãnh đạo và không tự gửi thư mời. Người xem dùng Calendar chung.

## Nghiệm thu trước khi dùng thật

1. Dùng Calendar thử riêng trước; không gửi thử vào lịch lãnh đạo đang vận hành.
2. Kiểm tra Gmail ngoài danh sách bị từ chối vào Form.
3. Gửi lịch 08:00–09:00, chọn nhiều người: Sheet có dữ liệu, trạng thái ĐÃ LÊN LỊCH, Calendar đúng giờ Việt Nam.
4. Gửi 08:30–09:30 có người trùng: chờ xử lý, Calendar không thêm sự kiện.
5. Gửi cùng khung giờ nhưng thành phần khác: tạo được, trừ khi có lịch nhập thủ công chưa xác định người.
6. Chạy lại dòng đã thành công: vẫn chỉ một event.
7. Giờ kết thúc trước bắt đầu hoặc không chọn người: lưu lỗi, không tạo event.
8. Ngắt quyền Calendar: ghi lỗi; khôi phục quyền và chạy lại, không mất đăng ký.
9. Kiểm tra người xem không sửa/xóa được lịch; không công khai Calendar/Sheet nếu nội dung chỉ dành cho nội bộ.
10. Kiểm tra Form trên điện thoại và đăng nhập trong iframe. Nếu trình duyệt chặn đăng nhập/nhúng, dùng link “Mở biểu mẫu đăng ký”.

## Giới hạn và chi phí

Thông thường không có phí máy chủ hoặc công cụ trung gian riêng cho quy mô nội bộ nhỏ với các tài khoản sẵn có. Apps Script có quota và giới hạn thời gian chạy; đây không phải cam kết vận hành không giới hạn. Thời điểm chạy trigger không có cam kết tức thì. Người quản trị cần theo dõi trạng thái lỗi và tránh đổi chủ sở hữu/cắt quyền tài khoản cài trigger mà chưa bàn giao.

## Nguồn chính thức

- https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- https://support.google.com/docs/answer/2839588
- https://support.google.com/docs/answer/139706
- https://developers.google.com/apps-script/guides/triggers/installable
- https://developers.google.com/apps-script/reference/forms/form
- https://developers.google.com/workspace/calendar/api/v3/reference/events/insert
- https://support.google.com/calendar/answer/15716974
