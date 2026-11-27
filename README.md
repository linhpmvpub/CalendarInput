# Cổng đăng ký lịch công tác tuần UBND tỉnh Quảng Trị

Website đang hoạt động: **https://linhpmvpub.github.io/CalendarInput/**

Người dùng nhập và gửi ngay trên website, không cần Gmail hoặc đăng nhập và không chuyển sang Google Form. Form có ba nhóm chọn nhiều người, tìm tên không dấu, địa điểm, nội dung, tên người đăng ký và link tài liệu. Phần người đăng ký chỉ có họ tên; không yêu cầu đơn vị hoặc thông tin liên hệ. Có thể chọn ngày giờ cụ thể hoặc **Chưa cố định ngày**. Kết quả xử lý hiển thị ngay trên trang.

Giao diện có bảng **Lịch & khung giờ trống**, cập nhật từ Calendar chung và lọc theo người đã chọn. Bảng lịch có danh sách từng cuộc họp trong ngày và lãnh đạo UBND tỉnh tham dự, kể cả các cuộc họp trùng giờ. Lịch nhập tay chưa có thành phần rõ ràng được ghi “Chưa cập nhật thành phần lãnh đạo”. Chọn ngày, thời lượng 30/60/90/120 phút rồi bấm **Chọn giờ** để điền thời gian vào form. Trên điện thoại chuyển giữa hai tab Đăng ký và Xem lịch & giờ trống. Khung gợi ý là 07:00–18:00; người dùng vẫn có thể nhập giờ khác vào form.

## Luồng đang vận hành

GitHub Pages nhúng giao diện HTML riêng do Apps Script phục vụ. Giao diện gọi `google.script.run` để lưu vào tab **Đăng ký từ website** trong Google Sheet, sau đó kiểm tra và tạo sự kiện trên Google Calendar. Apps Script chạy bằng quyền quản trị; người gửi không cần được chia sẻ Sheet hoặc Calendar. Bản này không thu email đã xác minh.

Người có đường dẫn được xem danh sách nhân sự trong form và gửi đăng ký theo lựa chọn công khai của đơn vị. Theo yêu cầu công khai của đơn vị, API tra cứu cung cấp nội dung cuộc họp (summary), giờ và thành phần lãnh đạo UBND tỉnh. Không trả mô tả đầy đủ, tài liệu, email khách mời hoặc người đăng ký; không cho sửa/xóa sự kiện. Quyền chia sẻ của Sheet và Calendar không bị thay đổi. Mã nguồn GitHub chỉ chứa cấu hình mẫu; tên thật được lưu trong Apps Script riêng và cấp cho giao diện lúc tải.

Google Form cũ và trigger cũ vẫn được giữ để bảo toàn hệ thống đã thiết lập; website hiện không dùng chúng. Các phản hồi cũ nằm ở tab **Câu trả lời biểu mẫu 1**.

## Kết quả kiểm thử ngày 26/11/2026

- Gửi từ chính github.io: Sheet nhận dữ liệu, Calendar tạo đúng giờ Việt Nam, trang hiển thị thành công mà không chuyển địa chỉ.
- Gửi cùng người trong khung giờ giao nhau: Sheet lưu **CHỜ XỬ LÝ TRÙNG LỊCH**, không tạo sự kiện thứ hai.
- Xử lý lại dòng thành công: vẫn chỉ có một sự kiện.
- Sự kiện thử đã được hủy. Các dòng thử giữ lại với trạng thái **KIỂM THỬ ĐÃ DỌN** để đối chiếu.
- Các kiểm tra dữ liệu/Calendar metadata và API web đạt yêu cầu, gồm ngày sai, tên giả, thời gian đảo, link không hợp lệ, phiên không hợp lệ, gửi lại không tạo thêm dòng, lịch chưa cố định ngày, lọc giờ bận, phân trang, giờ kết thúc không bắt buộc, mặc định 11h30/17h30, yêu cầu giờ kết thúc từ 17h30 trở đi, hiển thị đúng nội dung/thành phần lãnh đạo và xử lý lỗi Calendar.
- Kiểm thử trực tiếp bản mới: tên người đăng ký được lưu; đăng ký chưa cố định ngày không có ngày/ID sự kiện; khoảng bận khớp sự kiện kiểm thử; chọn khung trống điền đúng giờ.
- Đã kiểm tra giao diện nhúng thực tế ở chiều rộng 390 px và 360 px, không tràn ngang; kiểm tra bảng lịch và các ô ngày giờ.
- Đã kiểm tra triển khai ở quyền **Bất kỳ ai**, thực thi bằng tài khoản quản trị. Chưa thử trên điện thoại thực tế hoặc phiên trình duyệt riêng đã đăng xuất.

## Vận hành

Quản trị xem tab **Đăng ký từ website** trong Sheet và theo dõi cột **Trạng thái xử lý**:

| Trạng thái | Ý nghĩa |
| --- | --- |
| ĐÃ LÊN LỊCH | Sự kiện đã tạo và vẫn tồn tại ở lần đối chiếu thành công gần nhất |
| ĐÃ HỦY TRÊN CALENDAR | Calendar xác nhận đã hủy; giữ dòng để tra lịch sử |
| KHÔNG TÌM THẤY TRÊN CALENDAR | Không truy cập được sự kiện theo ID; cần quản trị kiểm tra, không tự tạo lại |
| CHỜ XẾP NGÀY | Đăng ký chưa có ngày cụ thể; đã lưu Sheet, chưa tạo sự kiện Calendar |
| CHỜ XỬ LÝ TRÙNG LỊCH | Có người trùng lịch hoặc sự kiện nhập tay cần kiểm tra; chưa tạo sự kiện |
| LỖI ĐỒNG BỘ | Đã lưu dữ liệu, cần xem Ghi chú xử lý và nhật ký Apps Script |
| ĐANG XỬ LÝ | Đang chờ xử lý hoặc lần thực thi bị gián đoạn |
| KIỂM THỬ ĐÃ DỌN | Dữ liệu kiểm thử, không phải lịch công tác |

Không chỉnh sửa mã đăng ký/ID sự kiện. Sửa hoặc hủy lịch đã tạo được thực hiện trên Calendar bởi quản trị. Calendar → Sheet được kiểm tra mỗi 5 phút. Các cột đăng ký gốc giữ nguyên; các cột “trên Calendar” phản ánh bản hiện tại. Sửa các cột đăng ký gốc trong Sheet không tự sửa Calendar.

Hàm quản trị `retryPending_()` được đặt riêng tư để khách truy cập web không gọi được; khi cần chạy thủ công trong trình biên tập, quản trị có thể tạo hàm tạm `function runAdminRetry(){ retryPending_(); }`, chạy rồi gỡ hàm tạm; **không đưa hàm tạm vào phiên bản web triển khai**. Với đăng ký **CHỜ XẾP NGÀY**, quản trị điền cả ngày giờ bắt đầu và kết thúc trong Sheet bằng giá trị ngày giờ thực, rồi chạy `retryPending_()` để kiểm tra trùng và tạo lịch. Chỉ nhập ngày trong Sheet chưa tự kích hoạt đồng bộ. Hàm xử lý lại xem các dòng trống trạng thái, LỖI ĐỒNG BỘ, hoặc CHỜ XẾP NGÀY đã được điền đủ hai mốc thời gian; dòng đang xử lý bị gián đoạn cần được quản trị kiểm tra và đặt trạng thái LỖI ĐỒNG BỘ trước khi thử lại. Dòng chờ trùng chỉ xử lý lại sau khi giải quyết xung đột. Không tự thay thế sự kiện cũ.

## Đồng bộ ngược mỗi 5 phút

- `syncCalendarToSheet_` là trigger thời gian của Apps Script, chạy bằng tài khoản quản trị, không phụ thuộc việc mở website.
- Lần đầu đối chiếu các sự kiện; các lần sau lấy thay đổi bằng sync token, có phân trang và tự đối chiếu lại nếu token hết hạn. Lịch mới liên kết được kiểm tra bằng ID khi cần.
- Trong tab đăng ký, xem **Trạng thái Calendar**: ĐÃ LÊN LỊCH / ĐÃ THAY ĐỔI TRÊN CALENDAR / ĐÃ HỦY TRÊN CALENDAR / KHÔNG TÌM THẤY TRÊN CALENDAR. Trạng thái thay đổi được giữ để dễ nhận ra dòng đã chỉnh sửa.
- Các cột Nội dung, Bắt đầu, Kết thúc, Địa điểm, Thành phần **trên Calendar** là bản mới nhất; các cột đăng ký gốc không bị ghi đè.
- Có các mốc Calendar cập nhật lúc, Phát hiện thay đổi lúc, Phát hiện xóa lúc, Lần kiểm tra Calendar và Link Calendar. “Phát hiện xóa” là thời điểm hệ thống quan sát được, không phải thời điểm chính xác người dùng bấm xóa.
- Tab **Nhật ký đồng bộ lịch** giữ trước/sau của các thay đổi kể từ khi bật đồng bộ; tab **Theo dõi đồng bộ** cho biết lần chạy, lần thành công, số dòng theo dõi và lỗi.
- Lịch bị hủy giữ nội dung đã biết; khi khôi phục đúng sự kiện đó, trạng thái trở lại đã lên lịch. Nếu lỗi API/quota/quyền truy cập, giữ trạng thái xác minh trước đó và ghi lỗi, không báo nhầm đã xóa.
- Chỉ theo dõi các dòng có Calendar Event ID. Dòng chờ xếp ngày/chờ trùng chưa tạo sự kiện và dòng kiểm thử đã dọn được bỏ qua. Lịch tạo riêng trên Calendar không tự trở thành dòng đăng ký mới.
- Google có thể chạy trigger lệch thời điểm. Hạn mức Gmail cá nhân: tổng thời gian trigger 90 phút/ngày; vượt hạn mức có thể tạm ngừng. Thiết lập hiện tại không bật thanh toán.

Cài đặt: thêm `ReverseSync.gs`, giữ CONFIG và SHEET_ID hiện có; chạy `installReverseSync_()` qua hàm quản trị tạm trong trình biên tập rồi gỡ hàm tạm trước khi triển khai web. Chỉ duy trì một trigger `syncCalendarToSheet_`, chu kỳ 5 phút. Trigger chạy mã HEAD, không cần xuất bản lại web khi chỉ thay tệp đồng bộ. Không cung cấp hàm quản trị công khai qua `google.script.run`.

## Quy tắc xếp lịch

- Ít nhất một người trong ba nhóm; tên phải nằm trong danh sách máy chủ.
- Chưa cố định ngày: không yêu cầu ngày giờ, có ô gợi ý thời gian không bắt buộc; không chiếm khung giờ Calendar.
- Khi có ngày cụ thể: nhập Ngày, Giờ bắt đầu và Giờ kết thúc (nếu có); thứ hiển thị tự động bằng tiếng Việt. Giờ kết thúc nhập phải sau giờ bắt đầu trong cùng ngày. Để trống giờ kết thúc: bắt đầu trước 11h30 mặc định kết thúc 11h30; bắt đầu từ 11h30 đến trước 17h30 mặc định kết thúc 17h30; từ 17h30 trở đi phải nhập giờ kết thúc. Ghi rõ mặc định hết buổi trong Sheet/Calendar/tra cứu. Quản trị có thể điều chỉnh trên Calendar khi đã chốt; thời gian theo Asia/Ho_Chi_Minh (UTC+7).
- Nội dung tối đa 5.000 ký tự. Link tài liệu phải dùng HTTPS. Link không tự cấp quyền xem tài liệu.
- Trùng người trong Calendar chung: giữ đăng ký chờ xử lý.
- Lịch nhập thủ công chưa có mã thành phần: tạm giữ mọi đăng ký giao nhau để quản trị kiểm tra. Sự kiện free/transparent không chặn.
- Không kiểm tra lịch cá nhân hoặc phòng họp. Không có phân hạng ưu tiên hay màn hình duyệt riêng.
- Một sự kiện chung chứa thành phần trong mô tả, không gửi thư mời và không tạo lịch riêng cho từng người.
- ID cố định cho mỗi lần gửi và khóa xử lý hạn chế tạo trùng. Khi kết nối gián đoạn, bấm gửi lại trên cùng trang dùng lại mã cũ. Tải lại trang tạo phiên mới; không gửi lại một đăng ký đã thành công.
- Kiểm tra xung đột và tạo lịch không phải giao dịch nguyên tử với chỉnh sửa Calendar trực tiếp của quản trị; vẫn cần quản trị xử lý nếu hai bên thay đổi cùng lúc.

## Cấu trúc và cập nhật

- `docs/index.html`: trang GitHub Pages nhúng form riêng.
- `docs/mobile-preview.html`: trang kiểm tra bố cục ở các chiều rộng điện thoại/máy tính bảng.
- `docs/config.js`: URL công khai của Apps Script web app; không có khóa bí mật.
- `apps-script/Code.gs`: xử lý dữ liệu, kiểm tra trùng và Calendar; CONFIG trong repo là mẫu.
- `apps-script/ReverseSync.gs`: đồng bộ ngược, nhật ký và theo dõi lỗi mỗi 5 phút.
- `apps-script/Web.gs`: doGet, API gửi đăng ký và lấy khoảng giờ bận công khai.
- `apps-script/WebRegistration.html`: giao diện nhập liệu riêng.
- `apps-script/appsscript.json`: múi giờ Việt Nam, Calendar API v3.
- `tests/validation.cjs`, `tests/web.cjs`, `tests/reverse-sync.cjs`: kiểm tra bằng Node.js.

Hệ thống hiện có đã cấu hình CONFIG thật, Script Property `SHEET_ID`, Calendar API và quyền quản trị. **Không chạy lại setup trên hệ thống đang vận hành.** Khi cập nhật, giữ nguyên cấu hình và Script Properties. Dán Web.gs, WebRegistration.html vào đúng tên tệp trong Apps Script. Các hàm quản trị phải kết thúc bằng dấu gạch dưới để không thể gọi từ giao diện công khai.

Trong Apps Script chọn **Triển khai → Quản lý tùy chọn triển khai → Chỉnh sửa → Phiên bản mới → Triển khai**. Giữ **Thực thi bằng tên: Tôi**, **Người có quyền truy cập: Bất kỳ ai**. Dùng cùng hoạt động triển khai để giữ URL hiện có. Nếu tạo hoạt động triển khai khác, cập nhật `window.WEB_APP_URL` trong `docs/config.js`.

GitHub Pages dùng nhánh **main**, thư mục **/docs**. Mỗi commit tự triển khai lại. Nếu trang còn bản cũ, tải lại bằng Ctrl+F5.

## Giới hạn

Không cần máy chủ trả phí, không bật dịch vụ thanh toán. Apps Script và Calendar vẫn có hạn mức sử dụng. Form công khai có bẫy spam đơn giản, kiểm tra đầu vào, giới hạn 20 đăng ký/phiên và 300 đăng ký/ngày để bảo vệ quota; đây không phải cơ chế chống bot mạnh hoặc xác minh danh tính. Tên người đăng ký do người gửi tự nhập. Cần quản trị theo dõi lịch và trạng thái lỗi.

## Tài liệu chính thức

- https://developers.google.com/apps-script/guides/web
- https://developers.google.com/apps-script/guides/html/communication
- https://developers.google.com/apps-script/reference/html/x-frame-options-mode
- https://developers.google.com/apps-script/guides/services/quotas
- https://developers.google.com/workspace/calendar/api/guides/quotas

## Chỉnh sửa đăng ký trên website

- Sau khi gửi, người đăng ký nhận **Mã chỉnh sửa** riêng (khác Mã đăng ký) và nút **Sửa đăng ký này**. Sao chép mã để dùng lại ở mục **Chỉnh sửa lịch đã đăng ký → Mở lịch**. Không cần đăng nhập; ai có mã này có thể chỉnh sửa, vì vậy phải giữ riêng.
- Có thể đổi nội dung, ba nhóm thành phần, địa điểm, ngày/giờ, link tài liệu và tên người đăng ký. Lịch chờ ngày có thể chuyển thành ngày giờ cụ thể. Lịch đã lên Calendar phải giữ ngày giờ cụ thể; hủy lịch do quản trị thực hiện.
- Khi mở, hệ thống lấy nội dung mới nhất từ Calendar. Sửa ngày/giờ hoặc thành phần sẽ kiểm tra trùng, bỏ qua chính sự kiện đang sửa. Lưu cập nhật đúng Event ID, không tạo thêm sự kiện. ETag/If-Match ngăn ghi đè thay đổi đồng thời trên Calendar.
- Sheet cập nhật các cột đăng ký hiện tại, giữ bản đăng ký trước lần sửa đầu trong **Đăng ký ban đầu (JSON)**, ghi lịch sử trước/sau ở tab **Nhật ký chỉnh sửa**. Các cột đối chiếu Calendar được cập nhật ngay; timer đồng bộ ngược 5 phút tiếp tục hoạt động.
- Mã nằm trong cột **Mã chỉnh sửa (giữ riêng)** của Sheet riêng tư. Quản trị cấp mã của đúng dòng cho người đăng ký cũ hoặc người mất mã. Không công khai Sheet/cột này. Quản trị có thể thu hồi mã bằng cách xóa nội dung ô rồi chạy `enableRegistrationEditing_()` để cấp mã mới. Các hàm quản trị kết thúc `_` nên không gọi được từ `google.script.run`.
- Khi triển khai, thêm `Edit.gs`, cập nhật `Web.gs` và `WebRegistration.html`, chạy `enableRegistrationEditing_()` từ Apps Script (có thể dùng hàm bọc quản trị tạm rồi xóa trước triển khai), sau đó tạo phiên bản mới cho deployment hiện tại. Không cần thêm API hay quyền truy cập.
- Dữ liệu giao dịch được lưu trước khi cập nhật Calendar. Nếu Calendar đã nhận thay đổi nhưng Sheet/kết nối gặp lỗi, gửi lại cùng thao tác hoặc mở lại bằng mã sẽ hoàn tất ghi Sheet và nhật ký mà không nhân đôi sự kiện.
- Lịch đã hủy/mất, lịch lặp, cả ngày hoặc kéo dài qua nhiều ngày được yêu cầu xử lý bởi quản trị; không tự khôi phục hay chuyển kiểu lịch.
- Kiểm thử: `node tests/edit.cjs`, `node tests/web.cjs`, `node tests/validation.cjs`, `node tests/reverse-sync.cjs`.

### Màu theo thành phần tham dự

Ứng dụng gán màu khi tạo/sửa lịch: có Chủ tịch = đỏ (11); từ hai Phó Chủ tịch không có Chủ tịch = tím (3); một Phó Chủ tịch = màu riêng; chỉ Văn phòng và chuyên viên = xanh lá (10); chỉ chuyên viên = xám (8). Năm màu Phó Chủ tịch (9, 5, 6, 7, 1) được gán theo danh sách riêng lúc kích hoạt và lưu `PARTICIPANT_COLOR_MAP`, không đổi khi sắp xếp lại danh sách. Không công khai tên nhân sự trong repository.

Kích hoạt qua **Cài đặt dự án → Thuộc tính của tập lệnh** (chỉ quản trị): lưu `PARTICIPANT_COLOR_MAP` dưới dạng JSON tên Phó Chủ tịch → mã màu và đặt `PARTICIPANT_COLORS_ENABLED=1`. Lượt đồng bộ tiếp theo tự rà soát toàn bộ lịch một lần, đánh dấu `PARTICIPANT_COLORS_BACKFILLED=1` khi thành công; không cần mở một hàm quản trị công khai. Trigger đồng bộ ngược 5 phút tiếp tục áp dụng màu cho sự kiện có thay đổi, kể cả sự kiện nhập trực tiếp. Không tạo thêm trigger. Mỗi lượt cập nhật tối đa 100 màu; nếu vượt mức, lượt sau đọc lại và bỏ qua những sự kiện đã đúng màu. Chỉ gửi `colorId`, dùng `If-Match` để tránh ghi đè thay đổi đồng thời, không gửi thông báo khách mời.

Với lịch nhập trực tiếp, dùng các dòng mô tả `Lãnh đạo UBND tỉnh: ...`, `Lãnh đạo Văn phòng UBND tỉnh: ...`, `Chuyên viên: ...`, các tên phân cách bằng dấu phẩy và khớp danh sách CONFIG. Dòng hiện tại (kể cả dòng rỗng) ưu tiên hơn metadata cũ. Không đoán tên từ tiêu đề/nội dung tự do; lịch không xác định được thành phần giữ nguyên màu. Lịch có thành phần hợp lệ được quản lý màu tự động, nên thay màu thủ công sẽ được đưa về quy tắc ở lượt kiểm tra kế tiếp. Màu không tham gia dấu thay đổi nội dung, tránh báo giả rằng cuộc họp đã sửa. Tab `Theo dõi đồng bộ` có số lịch đổi màu ở lượt gần nhất. Website hiển thị chú giải và nhãn chữ kèm màu; không phụ thuộc khả năng hiển thị màu riêng của Google Calendar ở chế độ xem/chia sẻ khác nhau.

Kiểm tra: `node tests/colors.cjs` cùng các bộ kiểm tra đăng ký, chỉnh sửa và đồng bộ hiện có.

### Điều phối lịch trực tiếp từ Sheet

Các tab đăng ký có thêm cột **Thao tác xếp lịch**, **Lý do điều phối**, **Kết quả xếp lịch**, **Cập nhật xếp lịch lúc**. Chỉ người có quyền sửa Sheet sử dụng được các thao tác quản trị này; không có API quản trị công khai trên trang đăng ký.

1. Ở dòng lịch cần nhường chỗ, ghi lý do rồi chọn **ĐƯA VỀ CHỜ**. Đợi Kết quả xếp lịch báo THÀNH CÔNG. Sự kiện được gỡ khỏi Calendar, trạng thái Sheet thành **CHỜ XẾP LỊCH**. Nội dung, giờ cũ và mã đăng ký được giữ; Event ID cũ và bản sao sự kiện lưu riêng để đối chiếu.
2. Ở dòng lịch ưu tiên đang chờ, kiểm tra/sửa **Bắt đầu**, **Kết thúc**, thành phần; chọn **ĐẨY LÊN CALENDAR**. Chỉ tạo khi không trùng; thành công tự chuyển **ĐÃ LÊN LỊCH**, cập nhật Event ID và màu. Nếu còn trùng, lịch vẫn chờ và cột kết quả nêu lỗi.
3. Khi xếp lại lịch từng nhường chỗ, sửa ngày giờ trên dòng đó rồi chọn **ĐẨY LÊN CALENDAR**. Hệ thống dùng Event ID mới, giữ nguyên mã đăng ký và mã chỉnh sửa. Không sửa tay Trạng thái xử lý, Calendar Event ID, các cột JSON hoặc xóa dòng đăng ký để điều phối.

Lệnh chạy qua trigger sửa ô (thường vài giây); lượt kiểm tra 5 phút xử lý dự phòng khi trigger chậm hoặc kết nối lỗi. Trigger `sheetSchedulingOnEdit_` được cài một lần bởi lượt đồng bộ nền. Script/API ghi ô không kích hoạt onEdit, nên những yêu cầu nhập bằng API được lượt nền xử lý. Thao tác thành công tự xóa lựa chọn, để chọn lại lần sau. Nhật ký ở tab **Nhật ký xếp lịch**. Một giao dịch được lưu trước khi đổi Calendar, có kiểm tra phiên bản, phục hồi sau lỗi và không tạo trùng. Lịch bị quản trị đưa về chờ không thể tự đẩy lại bằng mã chỉnh sửa web. Lịch có khách mời, hội nghị trực tuyến, lặp lại hoặc cả ngày yêu cầu quản trị xử lý trực tiếp để tránh ảnh hưởng lời mời. Không tự chọn lịch nào nhường chỗ thay người quản trị.

Kiểm tra luồng nhường chỗ/ưu tiên/xếp lại và lỗi giữa chừng: `node tests/scheduling.cjs`.
