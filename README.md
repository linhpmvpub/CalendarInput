# Cổng đăng ký lịch công tác tuần UBND tỉnh Quảng Trị

Website đang hoạt động: **https://linhpmvpub.github.io/CalendarInput/**

Người dùng nhập và gửi ngay trên website, không cần Gmail hoặc đăng nhập và không chuyển sang Google Form. Form có ba nhóm chọn nhiều người, tìm tên không dấu, địa điểm, nội dung, tên người đăng ký và link tài liệu. Phần người đăng ký chỉ có họ tên; không yêu cầu đơn vị hoặc thông tin liên hệ. Có thể chọn ngày giờ cụ thể hoặc **Chưa cố định ngày**. Kết quả xử lý hiển thị ngay trên trang.

Giao diện có bảng **Lịch & khung giờ trống**, cập nhật từ Calendar chung và lọc theo Lãnh đạo UBND tỉnh đã chọn. Bảng lịch có danh sách từng cuộc họp trong ngày và lãnh đạo UBND tỉnh tham dự, kể cả các cuộc họp trùng giờ. Lịch nhập tay chưa có thành phần rõ ràng được ghi “Chưa cập nhật thành phần lãnh đạo”. Chọn ngày, thời lượng 30/60/90/120 phút rồi bấm **Chọn giờ** để điền thời gian vào form. Trên điện thoại chuyển giữa hai tab Đăng ký và Xem lịch & giờ trống. Khung gợi ý là 07:00–18:00; người dùng vẫn có thể nhập giờ khác vào form.

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
- Chỉ trùng Chủ tịch hoặc các Phó Chủ tịch UBND tỉnh trong Calendar chung mới giữ đăng ký chờ xử lý. Trùng Lãnh đạo Văn phòng hoặc chuyên viên không chặn đăng ký, chỉnh sửa hay đẩy lịch chờ lên Calendar.
- Lịch nhập thủ công chưa xác định thành phần: chỉ tạm giữ đăng ký giao nhau có chọn Lãnh đạo UBND tỉnh để quản trị kiểm tra. Đăng ký chỉ có Lãnh đạo Văn phòng/chuyên viên không kiểm tra xung đột. Sự kiện free/transparent không chặn.
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

### Màu lịch mặc định

Đã bỏ màu tự động theo thành phần. Lịch mới dùng màu mặc định của Calendar; website không còn chú giải/nhãn màu lãnh đạo.

Lượt đồng bộ đầu tiên rà soát và xóa `colorId` nếu còn khớp quy tắc tự động cũ. Màu chỉnh tay khác quy tắc và lịch chưa xác định thành phần được giữ nguyên. Sau khi hoàn tất, `PARTICIPANT_COLORS_REMOVED=1` và `PARTICIPANT_COLORS_ENABLED=0`; không tiếp tục cưỡng chế màu. Chỉ thay trường màu, dùng If-Match, không đổi lịch họp và không gửi thông báo khách mời.

### Điều phối lịch trực tiếp từ Sheet

Các tab đăng ký có thêm cột **Thao tác xếp lịch**, **Lý do điều phối**, **Kết quả xếp lịch**, **Cập nhật xếp lịch lúc**. Chỉ người có quyền sửa Sheet sử dụng được các thao tác quản trị này; không có API quản trị công khai trên trang đăng ký.

1. Ở dòng lịch cần nhường chỗ, ghi lý do rồi chọn **ĐƯA VỀ CHỜ**. Đợi Kết quả xếp lịch báo THÀNH CÔNG. Sự kiện được gỡ khỏi Calendar, trạng thái Sheet thành **CHỜ XẾP LỊCH**. Nội dung, giờ cũ và mã đăng ký được giữ; Event ID cũ và bản sao sự kiện lưu riêng để đối chiếu.
2. Ở dòng lịch ưu tiên đang chờ, kiểm tra/sửa **Bắt đầu**, **Kết thúc**, thành phần; chọn **ĐẨY LÊN CALENDAR**. Chỉ tạo khi không trùng; thành công tự chuyển **ĐÃ LÊN LỊCH**, cập nhật Event ID. Nếu còn trùng, lịch vẫn chờ và cột kết quả nêu lỗi.
3. Khi xếp lại lịch từng nhường chỗ, sửa ngày giờ trên dòng đó rồi chọn **ĐẨY LÊN CALENDAR**. Hệ thống dùng Event ID mới, giữ nguyên mã đăng ký và mã chỉnh sửa. Không sửa tay Trạng thái xử lý, Calendar Event ID, các cột JSON hoặc xóa dòng đăng ký để điều phối.

Lệnh chạy qua trigger sửa ô (thường vài giây); lượt kiểm tra 5 phút xử lý dự phòng khi trigger chậm hoặc kết nối lỗi. Trigger `sheetSchedulingOnEdit_` được cài một lần bởi lượt đồng bộ nền. Script/API ghi ô không kích hoạt onEdit, nên những yêu cầu nhập bằng API được lượt nền xử lý. Thao tác thành công tự xóa lựa chọn, để chọn lại lần sau. Nhật ký ở tab **Nhật ký xếp lịch**. Một giao dịch được lưu trước khi đổi Calendar, có kiểm tra phiên bản, phục hồi sau lỗi và không tạo trùng. Lịch bị quản trị đưa về chờ không thể tự đẩy lại bằng mã chỉnh sửa web. Lịch có khách mời, hội nghị trực tuyến, lặp lại hoặc cả ngày yêu cầu quản trị xử lý trực tiếp để tránh ảnh hưởng lời mời. Không tự chọn lịch nào nhường chỗ thay người quản trị.

Kiểm tra luồng nhường chỗ/ưu tiên/xếp lại và lỗi giữa chừng: `node tests/scheduling.cjs`.

## Bảng lịch công tác tuần từ Calendar

`WeeklyReport.gs` tạo tab **Lịch công tác tuần** trong workbook hiện có. Chạy qua trigger `syncCalendarToSheet_` mỗi 5 phút, sau khi nhả khóa đăng ký; không thêm trigger và không cần triển khai lại web. Mọi hàm quản trị đều riêng tư (đuôi `_`).

- Ô **C3** chọn một ngày trong tuần cần xem; bảng tự tính thứ hai–chủ nhật. Tuần ban đầu 30/11–06/12/2026 theo mẫu cung cấp. Không tự chuyển tuần; đổi C3 để chọn tuần khác.
- Cột Thời gian, Nội dung, Địa điểm, LĐVP + Chuyên viên; chia sáng/chiều/tối. Nội dung hiển thị `08h00: [nguyên văn nội dung cuộc họp]`, chỉ giờ bắt đầu theo định dạng 24h, không thêm giờ kết thúc hoặc dòng liệt kê Lãnh đạo UBND tỉnh. Cột LĐVP/CV giữ riêng. Lịch song song nằm ở các dòng riêng. Lịch kéo dài nhiều buổi/ngày được hiện ở các phần tương ứng. Lịch cả ngày dùng đúng ngày kết thúc loại trừ của Calendar.
- Đọc tất cả sự kiện trong Calendar chung ở tuần đã chọn, kể cả sự kiện tạo trực tiếp và từng lần của lịch lặp. Lịch hủy bị loại khỏi bảng; lịch chưa lên Calendar không xuất hiện.
- Tên lãnh đạo lấy từ mô tả có nhãn hoặc metadata đăng ký. Hỗ trợ nhãn LĐVP/CV khi nhập tay; không suy đoán thành phần còn thiếu. Lịch có LĐVP và không có lãnh đạo tỉnh được tách xuống phần lịch riêng Văn phòng khi thông tin đủ rõ.
- Dòng 4 ghi lần cập nhật và số sự kiện (không phải số dòng, vì một sự kiện có thể chiếm nhiều buổi). Ghi chú ô Nội dung chứa ID và liên kết Calendar.
- Calendar là nguồn chính. Chỉnh sửa lịch trên Calendar; các ô nội dung báo cáo là đầu ra tự sinh. Chỉ ô C3 là điều khiển tuần. Không ghi ngược từ báo cáo lên Calendar hoặc vào đăng ký gốc.
- Có phân trang, giới hạn thời gian, chống chạy đồng thời, kiểm tra ngày chọn trước khi ghi và chỉ dựng lại nội dung khi dữ liệu đổi. Lỗi đọc Calendar giữ bản đã tải trước đó và hiện cảnh báo cùng mốc thành công gần nhất.
- Kiểm thử: `node tests/weekly-report.cjs` và `node tests/reverse-sync.cjs`.

### Phạm vi kiểm tra trùng lịch

Đăng ký mới, sửa đăng ký và lệnh ĐẨY LÊN CALENDAR dùng chung `provinceConflict_`: chỉ đối chiếu nhóm `province`. Lãnh đạo Văn phòng và chuyên viên vẫn được lưu đầy đủ trong Sheet/Calendar nhưng không giữ khung giờ. Mô tả thành phần hiện tại trên Calendar ưu tiên hơn metadata cũ. Lịch chỉ có Văn phòng/chuyên viên không bị giữ lại kể cả khi giao nhau với lịch nhập tay chưa rõ thành phần.

Tra cứu vẫn hiện nội dung lịch; `blocksTime` tách sự kiện hiển thị khỏi sự kiện chặn khung giờ. Khi chọn lãnh đạo tỉnh, lọc theo những lãnh đạo đó. Khi chỉ chọn Văn phòng/chuyên viên, hiển thị lịch chung để tham khảo và không chặn khung giờ. Khi chưa chọn ai, khung giờ chung phản ánh lịch lãnh đạo tỉnh. Không tự đẩy các đăng ký chờ cũ; quản trị dùng ĐẨY LÊN CALENDAR theo quy tắc mới.

### Chuyên viên chủ trì và phối hợp

Website tách chuyên viên thành hai phần: chủ trì tối đa một người (radio), phối hợp nhiều người (checkbox). Không chọn một người ở cả hai vai trò. Cả hai dùng danh sách chuyên viên hiện có. Nếu lịch không có chuyên viên, có thể để trống.

Cột **Chuyên viên** vẫn dùng để tương thích và xuất lịch tuần: chủ trì trước, phối hợp sau, không lặp tên. Thêm hai cột riêng **Chuyên viên chủ trì**, **Chuyên viên phối hợp** để lưu vai trò khi đăng ký/sửa; mô tả Calendar lưu cả danh sách tổng và các vai trò. Lịch cũ không tự gán người đầu tiên làm chủ trì: khi mở sửa, giữ người cũ trong phần phối hợp để người dùng phân vai. Kiểm tra trùng vẫn chỉ áp dụng Lãnh đạo UBND tỉnh.

### Toàn bộ lịch tuần trên website

Nút **Toàn bộ lịch tuần** mở lịch thứ hai–chủ nhật, có chọn ngày, tuần trước/sau và bộ lọc từng Lãnh đạo UBND tỉnh độc lập với form đăng ký. Mỗi cuộc họp nằm trong một ô riêng, chỉ hiện giờ, nguyên văn nội dung và lãnh đạo tỉnh tham dự. Có cả lịch đánh dấu không bận; các lịch này không chặn giờ trống. Dưới mỗi ngày hiển thị giờ trống 07–18 của lãnh đạo đang lọc, hoặc giờ trống chung khi xem tất cả. Lịch chưa rõ thành phần vẫn hiển thị và chặn giờ tham khảo để quản trị kiểm tra. Lịch chờ chưa lên Calendar không có trong bảng.

API `scheduleOverview` dùng cùng bộ đọc có phân trang, trả về duy nhất các trường hiển thị công khai; không gửi mô tả, chuyên viên, tài liệu, mã chỉnh sửa hay thông tin liên hệ. Tải khi mở mục, làm mới thủ công hoặc mỗi 5 phút khi mục đang hiển thị. Không ghi vào Calendar/Sheet.

Bố cục lịch tuần dạng bảng phẳng theo mẫu lịch công tác: Thứ/ngày → Buổi → Giờ → Nội dung → Lãnh đạo UBND tỉnh. Mỗi sự kiện một dòng theo giờ bắt đầu; lịch kéo dài nhiều buổi xuất hiện tại các buổi liên quan, lịch cả ngày ở nhóm riêng. Trên mobile, ngày và buổi thành tiêu đề nhóm, giờ ở lề trái, lãnh đạo dưới nội dung. Giữ bộ lọc và giờ trống theo dữ liệu Calendar; không đưa địa điểm/LĐVP/chuyên viên vào bảng công khai này.
