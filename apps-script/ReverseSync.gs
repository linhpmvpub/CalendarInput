/* Calendar -> Sheet. Private handlers cannot be called through google.script.run.
   The time trigger executes project HEAD; no web deployment is needed for this file. */
const RS = {
  handler:'syncCalendarToSheet_', token:'REVERSE_SYNC_TOKEN', calendar:'REVERSE_SYNC_CALENDAR',
  health:'Theo dõi đồng bộ', log:'Nhật ký đồng bộ lịch',
  columns:['Trạng thái Calendar','Nội dung trên Calendar','Bắt đầu trên Calendar','Kết thúc trên Calendar','Địa điểm trên Calendar','Thành phần trên Calendar','Calendar cập nhật lúc','Phát hiện thay đổi lúc','Phát hiện xóa lúc','Lần kiểm tra Calendar','Link Calendar','Ghi chú đồng bộ ngược','Dấu đồng bộ Calendar'],
  logColumns:['Thời điểm phát hiện','Tab đăng ký','Mã đăng ký','Calendar Event ID','Thay đổi','Trạng thái trước','Trạng thái sau','Nội dung trước','Nội dung sau','Bắt đầu trước','Bắt đầu sau','Kết thúc trước','Kết thúc sau','Địa điểm trước','Địa điểm sau','Thành phần trước','Thành phần sau'],
  maxLookups:150,maxPages:30,maxMs:150000
};
function installReverseSync_(){
  const triggers=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()===RS.handler);
  if(!triggers.length)ScriptApp.newTrigger(RS.handler).timeBased().everyMinutes(5).create();
  triggers.slice(1).forEach(t=>ScriptApp.deleteTrigger(t));
  const p=PropertiesService.getScriptProperties();p.setProperty('REVERSE_SYNC_INTERVAL','5');
  return syncCalendarToSheet_();
}
function reverseCell_(value){
  if(value instanceof Date)return value;
  const s=String(value==null?'':value).slice(0,45000);return /^[=+@\-]/.test(s)?"'"+s:s;
}
function reverseText_(value){return String(value==null?'':value).replace(/^'(?=[=+@\-])/,'');}
function reverseDate_(part){
  if(!part)return '';
  const value=part.dateTime||part.date&&part.date+'T00:00:00+07:00',d=new Date(value);
  if(!value||!Number.isFinite(+d))throw Error('Ngày giờ trên Calendar không hợp lệ.');return d;
}
function reverseParticipants_(event){
  const lines=String(event.description||'').split(/\r?\n/),out=[];
  let metadata=null;try{metadata=decodePeople_(event.extendedProperties&&event.extendedProperties.private);}catch(ignore){}
  ['province','office','specialists'].forEach(k=>{
    const line=lines.find(s=>s.startsWith(Q[k]+':'));
    const names=line?line.slice(Q[k].length+1).trim():Array.isArray(metadata)?metadata.filter(n=>n.startsWith(k+':')).map(n=>n.slice(k.length+1)).join(', '):'';
    if(names)out.push(Q[k]+': '+names);
  });
  return out.join('\n');
}
function reverseSnapshot_(event){
  const cancelled=event.status==='cancelled';
  const start=cancelled?'':reverseDate_(event.start),end=cancelled?'':reverseDate_(event.end);
  const data={status:cancelled?'cancelled':event.status||'confirmed',title:String(event.summary||''),start:start?start.toISOString():'',end:end?end.toISOString():'',place:String(event.location||''),people:reverseParticipants_(event),description:String(event.description||''),allDay:!!(event.start&&event.start.date),recurrence:event.recurrence||[],transparency:event.transparency||'opaque'};
  const hash=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(data)).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');
  return {data,start,end,hash,updated:event.updated?new Date(event.updated):'',link:String(event.htmlLink||'')};
}
function reverseOriginalDiffers_(row,h,snap){
  const eqDate=(a,b)=>a instanceof Date&&Number.isFinite(+a)&&+a===+b;
  return reverseText_(row[h.indexOf(Q.title)])!==snap.data.title||reverseText_(row[h.indexOf(Q.place)])!==snap.data.place||!eqDate(row[h.indexOf(Q.start)],snap.start)||!eqDate(row[h.indexOf(Q.end)],snap.end)||['province','office','specialists'].some(k=>{
    const old=reverseText_(row[h.indexOf(Q[k])]);
    const line=snap.data.people.split('\n').find(l=>l.startsWith(Q[k]+':'));
    return old!==(line?line.slice(Q[k].length+1).trim():'');
  });
}
function reverseHeaders_(sheet,columns){
  let h=sheet.getLastRow()?sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0]:[];
  const before=h.length;columns.forEach(n=>{if(!h.includes(n))h.push(n);});
  if(h.length!==before){
    if(h.length>sheet.getMaxColumns())sheet.insertColumnsAfter(sheet.getMaxColumns(),h.length-sheet.getMaxColumns());
    sheet.getRange(1,1,1,h.length).setValues([h]);sheet.setFrozenRows(1);
    columns.forEach(name=>{if(/lúc$|Lần kiểm tra|Bắt đầu trên|Kết thúc trên/.test(name))sheet.getRange(2,h.indexOf(name)+1,Math.max(1,sheet.getMaxRows()-1),1).setNumberFormat('dd/MM/yyyy HH:mm:ss');});
  }
  return h;
}
function reverseHealth_(ss,summary){
  const p=PropertiesService.getScriptProperties();let sheet=ss.getSheetByName(RS.health);const created=!sheet;if(!sheet)sheet=ss.insertSheet(RS.health);
  const rows=[['ĐỒNG BỘ CALENDAR → SHEET','Giá trị'],['Chu kỳ','Mỗi 5 phút (thời điểm chạy có thể lệch)'],['Trạng thái lần gần nhất',summary.ok?'THÀNH CÔNG':'LỖI — giữ nguyên trạng thái lịch đã xác minh'],['Lần chạy gần nhất',new Date()],['Lần thành công gần nhất',p.getProperty('REVERSE_SYNC_LAST_OK')?new Date(p.getProperty('REVERSE_SYNC_LAST_OK')):''],['Số dòng theo dõi',summary.tracked||0],['Số thay đổi ghi nhận',summary.changed||0],['Số lịch đã hủy phát hiện',summary.deleted||0],['Số yêu cầu Calendar',summary.calls||0],['Số lịch đổi màu lần này',summary.colors?.changed||0],['Lịch chưa xác định thành phần (lượt này)',summary.colors?.unclassified||0],['Thời gian chạy (giây)',Math.round((summary.duration||0)/100)/10],['Thông tin',summary.error||'Giữ nguyên đăng ký gốc. Xem cột Trạng thái Calendar và tab Nhật ký đồng bộ lịch.'],['Phạm vi','Các lịch được tạo từ đăng ký trong Sheet; không nhập lịch tạo riêng trên Calendar thành dòng đăng ký mới.']];
  sheet.getRange(1,1,rows.length,2).setValues(rows.map(r=>r.map(reverseCell_)));if(created){sheet.setFrozenRows(1);sheet.setColumnWidth(1,230);sheet.setColumnWidth(2,620);sheet.getRange(1,1,rows.length,2).setWrap(true);sheet.getRange(4,2,2,1).setNumberFormat('dd/MM/yyyy HH:mm:ss');sheet.getRange(1,1,1,2).setFontWeight('bold').setBackground('#dcefe8');}
}
function reverseFetch_(token,ids,deadline){
  const found=new Map(),colors={changed:0,matched:0,unclassified:0,deadline};
  const colorEnabled=PropertiesService.getScriptProperties().getProperty('PARTICIPANT_COLORS_ENABLED')==='1';
  let pageToken,nextToken,calls=0,pages=0;
  do{
    if(Date.now()>deadline||pages>=RS.maxPages)throw Error('Chưa đọc đủ Calendar; sẽ thử lại ở lượt kế tiếp.');
    const result=Calendar.Events.list(CONFIG.calendarId,{maxResults:2500,singleEvents:false,showDeleted:true,...(token?{syncToken:token}:{}),...(pageToken?{pageToken}:{})});calls++;pages++;
    (result.items||[]).forEach(item=>{const event=colorEnabled?colorApply_(item,colors):item;if(ids.has(event.id))found.set(event.id,event);});
    pageToken=result.nextPageToken;nextToken=result.nextSyncToken;
  }while(pageToken);
  if(!nextToken)throw Error('Calendar chưa trả mốc đồng bộ; không bỏ qua thay đổi.');
  return {found,nextToken,calls:calls+colors.changed,colors};
}
function reverseMissingError_(error){return /\b404\b|\b410\b|not found|resource has been deleted|\bgone\b/i.test(String(error));}
function syncCalendarToSheet_(){
  const began=Date.now(),lock=LockService.getScriptLock();
  if(!lock.tryLock(1500))return {skipped:'Đang xử lý đăng ký hoặc đồng bộ khác'};
  let ss,summary={ok:false,tracked:0,changed:0,deleted:0,calls:0};
  try{
    const p=PropertiesService.getScriptProperties();ss=SpreadsheetApp.openById(p.getProperty('SHEET_ID'));
    const sheets=[],refs=[],ids=new Set();
    ss.getSheets().forEach(sheet=>{
      if(sheet.getLastRow()<1||[RS.health,RS.log].includes(sheet.getName()))return;
      let values=sheet.getDataRange().getValues(),h=values[0];
      if(!Object.values(Q).every(k=>h.includes(k))||!META.every(k=>h.includes(k)))return;
      h=reverseHeaders_(sheet,RS.columns);values=sheet.getDataRange().getValues();const state={sheet,h,values};sheets.push(state);
      for(let i=1;i<values.length;i++){
        const row=values[i],status=String(row[h.indexOf(META[1])]||''),eventId=String(row[h.indexOf(META[2])]||'');
        // A registration with no confirmed Calendar ID must never be interpreted as deleted.
        if(!eventId||status==='KIỂM THỬ ĐÃ DỌN')continue;
        ids.add(eventId);refs.push({state,row,index:i,id:eventId});
      }
    });
    summary.tracked=refs.length;
    const colorBackfill=p.getProperty('PARTICIPANT_COLORS_ENABLED')==='1'&&p.getProperty('PARTICIPANT_COLORS_BACKFILLED')!=='1';
    let token=!colorBackfill&&p.getProperty(RS.calendar)===CONFIG.calendarId?p.getProperty(RS.token):null,full=!token,result;
    try{result=reverseFetch_(token,ids,began+RS.maxMs);}catch(e){
      if(token&&/\b410\b|sync token.*invalid|full sync.*required|fullSyncRequired/i.test(String(e))){full=true;result=reverseFetch_(null,ids,began+RS.maxMs);}else throw e;
    }
    summary.calls+=result.calls;summary.colors=result.colors;
    // New linked rows can appear after the token was issued. Bootstrap those by ID.
    // Full resync also checks missing IDs, without inferring deletion from a missing list item.
    let lookups=0;const failures=new Map();
    refs.forEach(ref=>{
      const fresh=!ref.row[ref.state.h.indexOf('Dấu đồng bộ Calendar')];
      if(result.found.has(ref.id)||failures.has(ref.id)||(!full&&!fresh))return;
      if(++lookups>RS.maxLookups||Date.now()>began+RS.maxMs)throw Error('Quá nhiều lịch cần đối chiếu lần đầu. Chưa cập nhật mốc đồng bộ.');
      try{result.found.set(ref.id,Calendar.Events.get(CONFIG.calendarId,ref.id));summary.calls++;}
      catch(e){summary.calls++;if(reverseMissingError_(e))failures.set(ref.id,'Không tìm thấy sự kiện theo ID. Có thể đã xóa vĩnh viễn hoặc chuyển lịch; cần quản trị kiểm tra.');else throw e;}
    });
    const logs=[];
    refs.forEach(ref=>{
      const {state,row,id}=ref,h=state.h,read=n=>row[h.indexOf(n)]||'',write=(n,v)=>row[h.indexOf(n)]=v;
      const oldState=String(read('Trạng thái Calendar')),oldHash=String(read('Dấu đồng bộ Calendar'));
      const event=result.found.get(id),missing=failures.get(id);
      if(!event&&!missing){write('Lần kiểm tra Calendar',new Date());return;}
      const previous=[read('Nội dung trên Calendar'),read('Bắt đầu trên Calendar'),read('Kết thúc trên Calendar'),read('Địa điểm trên Calendar'),read('Thành phần trên Calendar')];
      let action='',nextState=oldState;
      if(missing){
        nextState='KHÔNG TÌM THẤY TRÊN CALENDAR';write(META[1],nextState);write('Ghi chú đồng bộ ngược',missing);write('Dấu đồng bộ Calendar','missing');
        // Preserve last verified contents; absence alone is not an explicit cancellation.
        if(oldState!==nextState)action='KHÔNG TÌM THẤY';
      }else{
        const snap=reverseSnapshot_(event);
        if(snap.data.status==='cancelled'){
          nextState='ĐÃ HỦY TRÊN CALENDAR';write(META[1],nextState);
          if(oldState!==nextState){write('Phát hiện xóa lúc',new Date());action='ĐÃ HỦY';summary.deleted++;}
          write('Ghi chú đồng bộ ngược','Calendar báo đã hủy. Giữ dòng đăng ký và nội dung đã biết; không tự tạo lại.');
        }else{
          const restored=oldState==='ĐÃ HỦY TRÊN CALENDAR'||oldState==='KHÔNG TÌM THẤY TRÊN CALENDAR';
          const changed=oldHash?oldHash!==snap.hash:reverseOriginalDiffers_(row,h,snap);
          nextState=changed||oldState==='ĐÃ THAY ĐỔI TRÊN CALENDAR'?'ĐÃ THAY ĐỔI TRÊN CALENDAR':'ĐÃ LÊN LỊCH';
          if(restored){action='ĐÃ KHÔI PHỤC';nextState='ĐÃ LÊN LỊCH';}
          else if(changed)action='ĐÃ THAY ĐỔI';else if(!oldHash)action='ĐÃ ĐỐI CHIẾU';
          if(action==='ĐÃ THAY ĐỔI'||action==='ĐÃ KHÔI PHỤC')write('Phát hiện thay đổi lúc',new Date());
          write(META[1],'ĐÃ LÊN LỊCH');
          const current=[snap.data.title,snap.start,snap.end,snap.data.place,snap.data.people];
          ['Nội dung trên Calendar','Bắt đầu trên Calendar','Kết thúc trên Calendar','Địa điểm trên Calendar','Thành phần trên Calendar'].forEach((n,i)=>write(n,current[i]));
          write('Ghi chú đồng bộ ngược',snap.data.allDay?'Lịch cả ngày; ngày kết thúc trên Calendar là mốc loại trừ.':action==='ĐÃ THAY ĐỔI'?'Đã cập nhật bản hiện tại từ Calendar; các cột đăng ký gốc được giữ nguyên.':restored?'Sự kiện đã tồn tại trở lại trên Calendar.':'');
        }
        write('Dấu đồng bộ Calendar',snap.hash);if(snap.updated)write('Calendar cập nhật lúc',snap.updated);if(snap.link)write('Link Calendar',snap.link);
      }
      write('Trạng thái Calendar',nextState);write('Lần kiểm tra Calendar',new Date());
      if(action){summary.changed++;const current=['Nội dung trên Calendar','Bắt đầu trên Calendar','Kết thúc trên Calendar','Địa điểm trên Calendar','Thành phần trên Calendar'].map(read);
        logs.push([new Date(),state.sheet.getName(),read(META[0]),id,action,oldState,nextState,previous[0],current[0],previous[1],current[1],previous[2],current[2],previous[3],current[3],previous[4],current[4]]);}
    });
    // Write only sync-owned columns, never rewrite original inputs/formulas.
    sheets.forEach(({sheet,h,values})=>{
      if(values.length<2)return;
      const owned=[META[1],...RS.columns].map(name=>h.indexOf(name)).sort((a,b)=>a-b),groups=[];
      owned.forEach(col=>{const last=groups[groups.length-1];if(last&&col===last[last.length-1]+1)last.push(col);else groups.push([col]);});
      groups.forEach(cols=>sheet.getRange(2,cols[0]+1,values.length-1,cols.length).setValues(values.slice(1).map(r=>cols.map(col=>reverseCell_(r[col])))));
    });
    if(logs.length){const log=ss.getSheetByName(RS.log)||ss.insertSheet(RS.log);reverseHeaders_(log,RS.logColumns);log.getRange(log.getLastRow()+1,1,logs.length,RS.logColumns.length).setValues(logs.map(r=>r.map(reverseCell_)));log.getRange(2,1,log.getLastRow()-1,1).setNumberFormat('dd/MM/yyyy HH:mm:ss');}
    SpreadsheetApp.flush();
    // Commit cursor only after all Sheet writes succeed. A failed poll is replayed.
    if(colorBackfill)p.setProperty('PARTICIPANT_COLORS_BACKFILLED','1');
    p.setProperty(RS.token,result.nextToken);p.setProperty(RS.calendar,CONFIG.calendarId);p.setProperty('REVERSE_SYNC_LAST_OK',new Date().toISOString());
    summary.ok=true;summary.duration=Date.now()-began;reverseHealth_(ss,summary);console.log(JSON.stringify(summary));return summary;
  }catch(e){summary.error=String(e).slice(0,1000);summary.duration=Date.now()-began;if(ss)try{reverseHealth_(ss,summary);}catch(ignore){}console.error(JSON.stringify(summary));throw e;}
  finally{lock.releaseLock();}
}
