/* Private Sheet administration. No callable public web endpoint.
   An installable edit trigger and the existing five-minute poll share one lock. */
const PLAN={command:'Thao tác xếp lịch',reason:'Lý do điều phối',result:'Kết quả xếp lịch',at:'Cập nhật xếp lịch lúc',state:'Trạng thái điều phối',history:'Lịch sử Event ID',snapshot:'Bản lưu trước khi chờ (JSON)',pending:'Giao dịch xếp lịch (JSON)',log:'Nhật ký xếp lịch',hold:'ĐƯA VỀ CHỜ',push:'ĐẨY LÊN CALENDAR',waiting:'CHỜ XẾP LỊCH'};
function schedulingGuard_(record){
  if(record[PLAN.pending])throw Error('Bộ phận tổng hợp đang điều phối lịch này. Vui lòng chờ xử lý hoàn tất.');
  if(record[PLAN.state]==='ĐANG CHỜ')throw Error('Lịch đã được bộ phận tổng hợp chuyển về danh sách chờ. Liên hệ bộ phận tổng hợp để sửa hoặc xếp lại lịch.');
}
function schedulingIsSheet_(sheet){
  if(!sheet.getLastRow())return false;
  const h=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];return [...Object.values(Q),...META].every(n=>h.includes(n));
}
function schedulingSetup_(ss){
  const p=PropertiesService.getScriptProperties();
  if(!p.getProperty('SHEET_SCHEDULING_EDIT_TRIGGER')){
    const found=ScriptApp.getProjectTriggers().find(t=>t.getHandlerFunction()==='sheetSchedulingOnEdit_');
    const trigger=found||ScriptApp.newTrigger('sheetSchedulingOnEdit_').forSpreadsheet(ss).onEdit().create();
    p.setProperty('SHEET_SCHEDULING_EDIT_TRIGGER',trigger.getUniqueId());
  }
  ss.getSheets().filter(schedulingIsSheet_).forEach(sheet=>{
    editHeaders_(sheet);reverseHeaders_(sheet,RS.columns);
    const before=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
    const h=reverseHeaders_(sheet,[PLAN.command,PLAN.reason,PLAN.result,PLAN.at,PLAN.state,PLAN.history,PLAN.snapshot,PLAN.pending]);
    if(!before.includes(PLAN.command)){
      sheet.getRange(2,h.indexOf(PLAN.command)+1,Math.max(1,sheet.getMaxRows()-1),1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList([PLAN.hold,PLAN.push],true).setAllowInvalid(false).build());
      const instructions='Chọn ĐƯA VỀ CHỜ để gỡ lịch khỏi Calendar và giữ đăng ký; chờ báo thành công rồi chọn ĐẨY LÊN CALENDAR ở dòng ưu tiên. Khi xếp lại, sửa Bắt đầu/Kết thúc trước. Không sửa tay trạng thái hoặc Event ID. Lệnh chạy khi sửa ô; nếu bị gián đoạn sẽ kiểm tra lại trong 5 phút.';
      sheet.getRange(1,h.indexOf(PLAN.command)+1).setNote(instructions).setBackground('#dcefe8').setFontWeight('bold');
      sheet.setColumnWidth(h.indexOf(PLAN.command)+1,220);sheet.setColumnWidth(h.indexOf(PLAN.reason)+1,240);sheet.setColumnWidth(h.indexOf(PLAN.result)+1,420);
      sheet.getRange(2,h.indexOf(PLAN.result)+1,Math.max(1,sheet.getMaxRows()-1),1).setWrap(true);
    }
  });
}
function sheetSchedulingOnEdit_(e){
  // Private handler, and only accept the installed trigger on the configured spreadsheet.
  const p=PropertiesService.getScriptProperties();
  if(!e||String(e.triggerUid)!==p.getProperty('SHEET_SCHEDULING_EDIT_TRIGGER')||!e.source||e.source.getId()!==p.getProperty('SHEET_ID')||!e.range)return;
  const sheet=e.range.getSheet();if(!schedulingIsSheet_(sheet))return;
  const h=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0],col=h.indexOf(PLAN.command)+1;
  if(!col||e.range.getColumn()>col||e.range.getLastColumn()<col)return;
  const lock=LockService.getScriptLock();if(!lock.tryLock(25000))return;
  try{for(let row=Math.max(2,e.range.getRow());row<=Math.min(sheet.getLastRow(),e.range.getLastRow(),e.range.getRow()+19);row++)schedulingRun_(sheet,row);}finally{lock.releaseLock();}
}
function schedulingMaintenance_(ss,deadline){
  schedulingSetup_(ss);let count=0;
  // Release requested slots before processing promotions in the same poll.
  const work=[];
  ss.getSheets().filter(schedulingIsSheet_).forEach(sheet=>{
    const values=sheet.getDataRange().getValues(),h=values[0];
    for(let row=2;row<=values.length;row++){
      const v=values[row-1],command=String(v[h.indexOf(PLAN.command)]||''),pending=v[h.indexOf(PLAN.pending)];
      if(pending||[PLAN.hold,PLAN.push].includes(command))work.push({sheet,row,command});
    }
  });
  work.sort((a,b)=>(a.command===PLAN.hold?0:1)-(b.command===PLAN.hold?0:1));
  for(const item of work){if(++count>20||Date.now()>deadline)break;schedulingRun_(item.sheet,item.row);}
}
function schedulingGet_(id){
  try{return Calendar.Events.get(CONFIG.calendarId,id);}catch(e){if(/\b404\b|not found/i.test(String(e)))return null;throw e;}
}
function schedulingInput_(record){return Object.fromEntries([...Object.values(Q),'Người đăng ký','Loại thời gian','Gợi ý thời gian','Cách xác định giờ kết thúc'].map(k=>[k,record[k]||'']));}
function schedulingRecord_(raw){
  const record={...raw};Object.keys(record).forEach(k=>{if(!(record[k] instanceof Date))record[k]=reverseText_(record[k]);});
  if(record[Q.start] instanceof Date&&!record[Q.end]){record[Q.end]=defaultEnd_(record[Q.start]);record['Cách xác định giờ kết thúc']='Mặc định hết buổi';}
  return record;
}
function schedulingRevive_(raw){const record={...raw};[Q.start,Q.end].forEach(k=>{if(record[k])record[k]=new Date(record[k]);});return record;}
function schedulingRun_(sheet,row){
  let ref=editRead_(sheet,row),tx;
  const put=(k,v)=>editPut_(ref,k,v);
  try{
    if(/KIỂM THỬ ĐÃ DỌN/.test(String(ref.record[META[1]])))return;
    if(ref.record[PLAN.pending])tx=JSON.parse(String(ref.record[PLAN.pending]));
    else{
      const command=String(ref.record[PLAN.command]||'');if(![PLAN.hold,PLAN.push].includes(command))return;
      if(!/^[a-f0-9]{32,41}$/.test(String(ref.record[META[0]]||'')))throw Error('Dòng chưa có mã đăng ký hợp lệ.');
      if(ref.record[EDIT.pending])throw Error('Có lần chỉnh sửa website chưa hoàn tất; cần mở và hoàn tất chỉnh sửa trước.');
      tx={id:'s'+Utilities.getUuid().replace(/-/g,''),registration:String(ref.record[META[0]]),action:command,at:new Date().toISOString(),reason:String(ref.record[PLAN.reason]||''),before:schedulingInput_(ref.record),oldId:String(ref.record[META[2]]||'')};
      if(command===PLAN.hold){
        if(ref.record[PLAN.state]==='ĐANG CHỜ'&&!tx.oldId){put(PLAN.result,'Lịch đã ở danh sách chờ.');put(PLAN.command,'');return;}
        if(!tx.oldId)throw Error('Dòng này chưa có lịch trên Calendar để đưa về chờ.');
        const event=schedulingGet_(tx.oldId);
        if(!event||event.status==='cancelled')throw Error('Lịch đã bị xóa hoặc không còn truy cập được; không tự coi đây là thao tác đưa về chờ.');
        if(event.recurrence||event.recurringEventId||!event.start?.dateTime||!event.end?.dateTime)throw Error('Lịch lặp lại hoặc cả ngày cần xử lý trực tiếp bởi quản trị.');
        if(event.attendees?.length||event.conferenceData)throw Error('Lịch có khách mời hoặc hội nghị trực tuyến cần quản trị xử lý trực tiếp để bảo toàn lời mời.');
        tx.event=event;tx.record=webRecord_(editData_(ref.record,event));tx.record[Q.unit]=ref.record[Q.unit]||'';
      }else{
        if(tx.oldId){const event=schedulingGet_(tx.oldId);if(event&&event.status!=='cancelled'){put(PLAN.result,'Lịch đã có trên Calendar. Không tạo thêm bản trùng.');put(PLAN.command,'');return;}throw Error('Sự kiện đã liên kết bị xóa hoặc mất quyền truy cập. Cần kiểm tra trước khi xếp lại.');}
        const blockedWithoutEvent=!tx.oldId&&/Trùng thành phần hoặc khoảng thời gian|Trùng lịch Lãnh đạo UBND tỉnh/.test(String(ref.record[META[3]]||''));
        if(ref.record[PLAN.state]!=='ĐANG CHỜ'&&!/^CHỜ /.test(String(ref.record[META[1]]))&&!blockedWithoutEvent)throw Error('Chỉ đẩy lịch đang chờ lên Calendar.');
        const record=schedulingRecord_(schedulingInput_(ref.record));
        if(record[Q.start] instanceof Date)record['Loại thời gian']='Ngày giờ cụ thể';
        const v=validate_(record);if(v.flexible)throw Error('Điền Bắt đầu và Kết thúc (hoặc để trống kết thúc để mặc định hết buổi) trước khi đẩy lịch.');
        editConflict_(record,null);tx.record=record;
        // A held registration gets a new Calendar ID; keep the original registration/edit code.
        tx.newId=ref.record[PLAN.state]==='ĐANG CHỜ'?'b'+Utilities.getUuid().replace(/-/g,''):tx.registration;
        tx.resource=editResource_(ref,record,null,tx.id);
        const saved=ref.record[PLAN.snapshot]?JSON.parse(String(ref.record[PLAN.snapshot])):null;
        if(saved){['attachments','reminders','visibility','transparency','guestsCanModify','guestsCanInviteOthers','guestsCanSeeOtherGuests'].forEach(k=>{if(saved[k]!==undefined)tx.resource[k]=saved[k];});}
        tx.resource.extendedProperties.private.schedulingOperation=tx.id;
      }
      if(JSON.stringify(tx).length>42000)throw Error('Thông tin sự kiện quá lớn; cần quản trị xử lý trực tiếp.');
      put(PLAN.pending,JSON.stringify(tx));SpreadsheetApp.flush();
    }
    if(tx.registration!==String(ref.record[META[0]]))throw Error('Mã đăng ký đã thay đổi trong khi xử lý.');
    let event;
    if(tx.action===PLAN.hold){
      event=schedulingGet_(tx.oldId);
      if(!event)throw Error('Chưa xác minh được sự kiện đã gỡ. Giữ giao dịch để kiểm tra lại.');
      if(event.status!=='cancelled'){
        if(event.etag!==tx.event.etag){put(PLAN.pending,'');throw Error('Calendar vừa thay đổi; chọn lại ĐƯA VỀ CHỜ sau khi kiểm tra nội dung mới.');}
        try{event=Calendar.Events.patch({status:'cancelled'},CONFIG.calendarId,tx.oldId,{sendUpdates:'none'},{'If-Match':tx.event.etag});}
        catch(e){event=schedulingGet_(tx.oldId);if(!event||event.status!=='cancelled')throw e;}
        if(event.status!=='cancelled')throw Error('Calendar chưa xác nhận gỡ lịch.');
      }
    }else{
      event=schedulingGet_(tx.newId);
      if(event){if(event.status==='cancelled'||event.extendedProperties?.private?.schedulingOperation!==tx.id)throw Error('Mã sự kiện đã được dùng; cần kiểm tra, không tự tạo trùng.');}
      else{
        editConflict_(schedulingRevive_(tx.record),null);
        try{event=Calendar.Events.insert({...tx.resource,id:tx.newId,guestsCanModify:false,guestsCanInviteOthers:false},CONFIG.calendarId,{sendUpdates:'none',supportsAttachments:true});}
        catch(e){event=schedulingGet_(tx.newId);if(!event||event.status==='cancelled'||event.extendedProperties?.private?.schedulingOperation!==tx.id)throw e;}
      }
    }
    schedulingFinish_(ref,tx,event);
  }catch(e){
    ref=editRead_(sheet,row);editPut_(ref,PLAN.result,'CHƯA HOÀN TẤT: '+String(e.message||e).slice(0,1500)+(ref.record[PLAN.pending]?' — Hệ thống giữ giao dịch và sẽ kiểm tra lại.':''));
    editPut_(ref,PLAN.at,new Date());
    if(!ref.record[PLAN.pending])editPut_(ref,PLAN.command,'');
    console.error('Điều phối '+String(ref.record[META[0]])+': '+String(e));
  }
}
function schedulingFinish_(ref,tx,event){
  const put=(k,v)=>editPut_(ref,k,v),ss=ref.sheet.getParent();
  const history=JSON.parse(String(ref.record[PLAN.history]||'[]'));
  const wasHeld=tx.action===PLAN.hold;
  if(!ref.record[EDIT.original])put(EDIT.original,JSON.stringify(tx.before));
  // Refresh current input values from the pre-hold Calendar snapshot only if the user hasn't edited them meanwhile.
  if(JSON.stringify(schedulingInput_(ref.record))===JSON.stringify(tx.before)){
    Object.entries(schedulingRevive_(tx.record)).forEach(([k,v])=>{if(ref.h.includes(k))put(k,v);});
  }
  if(wasHeld){
    if(!history.includes(tx.oldId))history.push(tx.oldId);
    put(PLAN.snapshot,JSON.stringify(tx.event));put(PLAN.history,JSON.stringify(history));
    put(PLAN.state,'ĐANG CHỜ');put(META[2],'');put(META[1],PLAN.waiting);
    put('Trạng thái Calendar',PLAN.waiting);put('Link Calendar','');put('Dấu đồng bộ Calendar','');
    put('Ghi chú đồng bộ ngược','Đã đưa về chờ theo yêu cầu quản trị. Event ID cũ được lưu trong Lịch sử Event ID.');
    put(META[3],'Đã gỡ khỏi Calendar để chờ xếp lại. '+tx.reason);
    put(PLAN.result,'THÀNH CÔNG: đã đưa về chờ và giải phóng khung giờ. Có thể đẩy lịch ưu tiên lên.');
  }else{
    put(PLAN.state,'ĐÃ XẾP');put(META[2],event.id);put(META[1],'ĐÃ LÊN LỊCH');put(META[3],'Đã xếp lịch từ Google Sheet.');
    const snap=reverseSnapshot_(event),mirror={'Trạng thái Calendar':'ĐÃ LÊN LỊCH','Nội dung trên Calendar':snap.data.title,'Bắt đầu trên Calendar':snap.start,'Kết thúc trên Calendar':snap.end,'Địa điểm trên Calendar':snap.data.place,'Thành phần trên Calendar':snap.data.people,'Calendar cập nhật lúc':snap.updated,'Lần kiểm tra Calendar':new Date(),'Link Calendar':snap.link,'Dấu đồng bộ Calendar':snap.hash,'Ghi chú đồng bộ ngược':'Đã xếp lịch từ Google Sheet.'};Object.entries(mirror).forEach(([k,v])=>put(k,v));
    put(PLAN.result,'THÀNH CÔNG: đã đẩy lên Calendar và cập nhật trạng thái.');
  }
  put(PLAN.at,new Date(tx.at));put(EDIT.last,tx.id);put(EDIT.at,new Date(tx.at));
  const log=ss.getSheetByName(PLAN.log)||ss.insertSheet(PLAN.log),headers=['Mã thao tác','Thời điểm','Mã đăng ký','Tab đăng ký','Thao tác','Lý do','Event ID trước','Event ID sau','Dữ liệu trước (JSON)','Dữ liệu xếp lịch (JSON)'];reverseHeaders_(log,headers);
  const exists=log.getLastRow()>1?log.getRange(2,1,log.getLastRow()-1,1).createTextFinder(tx.id).matchEntireCell(true).findNext():null;
  if(!exists)log.getRange(log.getLastRow()+1,1,1,headers.length).setValues([[tx.id,new Date(tx.at),tx.registration,ref.sheet.getName(),tx.action,safe_(tx.reason),tx.oldId,wasHeld?'':event.id,JSON.stringify(tx.before),JSON.stringify(tx.record)]]);
  SpreadsheetApp.flush();put(PLAN.command,'');put(PLAN.pending,'');SpreadsheetApp.flush();
}
