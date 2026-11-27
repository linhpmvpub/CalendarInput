/* Anonymous editing uses a private per-registration capability, never the public ID alone.
   Calendar conditional writes + a durable Sheet journal protect retries and concurrent edits. */
const EDIT={code:'Mã chỉnh sửa (giữ riêng)',original:'Đăng ký ban đầu (JSON)',pending:'Giao dịch chỉnh sửa',last:'Thao tác chỉnh sửa cuối',at:'Chỉnh sửa gần nhất',log:'Nhật ký chỉnh sửa'};
function editHash_(value){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');}
function editHeaders_(sheet){return reverseHeaders_(sheet,['Người đăng ký','Loại thời gian','Gợi ý thời gian','Cách xác định giờ kết thúc',...Object.values(EDIT).filter(x=>x!==EDIT.log)]);}
function editRead_(sheet,row){const h=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0],v=sheet.getRange(row,1,1,h.length).getValues()[0];return {sheet,row,h,record:Object.fromEntries(h.map((n,i)=>[n,v[i]]))};}
function editPut_(ref,name,value){ref.sheet.getRange(ref.row,ref.h.indexOf(name)+1).setValue(value instanceof Date?value:safe_(value));ref.record[name]=value;}
function ensureEditCode_(sheet,row){
  editHeaders_(sheet);const ref=editRead_(sheet,row),id=String(ref.record[META[0]]||'');
  if(!/^[a-f0-9]{32,41}$/.test(id))throw Error('Mã đăng ký không hợp lệ.');
  if(!ref.record[EDIT.code])editPut_(ref,EDIT.code,id+'.'+Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,''));
  return String(ref.record[EDIT.code]);
}
function enableRegistrationEditing_(){
  const lock=LockService.getScriptLock();lock.waitLock(30000);let count=0;
  try{const ss=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
    ss.getSheets().forEach(sheet=>{if(sheet.getLastRow()<2)return;const h=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];if(!Object.values(Q).every(n=>h.includes(n))||!h.includes(META[0]))return;
      editHeaders_(sheet);for(let row=2;row<=sheet.getLastRow();row++){const r=editRead_(sheet,row).record;if(/^[a-f0-9]{32,41}$/.test(String(r[META[0]]||''))&&!/KIỂM THỬ/.test(String(r[META[1]]||''))){ensureEditCode_(sheet,row);count++;}}});
    SpreadsheetApp.flush();return {enabled:count};
  }finally{lock.releaseLock();}
}
function editSession_(token){
  if(typeof token!=='string'||token.length!==72)throw Error('Phiên đã hết hạn. Hãy tải lại trang.');
  const cache=CacheService.getScriptCache(),key='web:'+token,session=JSON.parse(cache.get(key)||'null');
  if(!session)throw Error('Phiên đã hết hạn. Hãy tải lại trang.');
  if((session.editCalls||0)>=100)throw Error('Đã đạt giới hạn tra cứu trong phiên. Vui lòng thử lại sau.');
  session.editCalls=(session.editCalls||0)+1;cache.put(key,JSON.stringify(session),21600);
}
function editFind_(code){
  const error='Mã chỉnh sửa không đúng hoặc đã được thu hồi. Vui lòng kiểm tra mã hoặc liên hệ bộ phận tổng hợp.';
  if(typeof code!=='string'||!/^([a-f0-9]{32,41})\.[a-f0-9]{64}$/.test(code))throw Error(error);
  const id=code.split('.')[0],ss=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
  for(const sheet of ss.getSheets()){
    if(sheet.getLastRow()<2)continue;const h=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
    if(!h.includes(EDIT.code)||!h.includes(META[0]))continue;
    const match=sheet.getRange(2,h.indexOf(META[0])+1,sheet.getLastRow()-1,1).createTextFinder(id).matchEntireCell(true).findNext();
    if(match){const ref=editRead_(sheet,match.getRow()),expected=editHash_(String(ref.record[EDIT.code]||'')),given=editHash_(code);let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^given.charCodeAt(i);if(diff||/KIỂM THỬ ĐÃ DỌN/.test(ref.record[META[1]]))throw Error(error);return ref;}
  }throw Error(error);
}
function editEvent_(ref){
  const id=String(ref.record[META[2]]||ref.record[META[0]]||'');let event;
  try{event=Calendar.Events.get(CONFIG.calendarId,id);}catch(e){if(!reverseMissingError_(e))throw Error('Chưa kiểm tra được Calendar. Vui lòng thử lại.');if(ref.record[META[2]])throw Error('Lịch không còn trên Calendar. Liên hệ bộ phận tổng hợp; hệ thống không tự tạo lại lịch đã xóa.');return null;}
  if(event.status==='cancelled')throw Error('Lịch đã bị hủy trên Calendar, không thể chỉnh sửa tại đây.');
  if(event.recurrence||event.recurringEventId||!event.start?.dateTime||!event.end?.dateTime)throw Error('Lịch lặp lại hoặc cả ngày cần được chỉnh sửa bởi bộ phận tổng hợp trên Calendar.');
  return event;
}
function editData_(record,event){
  const fmt=d=>d?Utilities.formatDate(new Date(d),'Asia/Ho_Chi_Minh',"yyyy-MM-dd'T'HH:mm"):'',data={};
  const lines=String(event?.description||'').split(/\r?\n/),lineValue=label=>{const line=lines.find(l=>l.startsWith(label+':'));return line===undefined?undefined:line.slice(label.length+1).trim();};
  ['province','office','specialists'].forEach(k=>{const line=lineValue(Q[k]);data[k]=parsePeople_(line===undefined?reverseText_(record[Q[k]]):line);if(data[k].some(n=>!CONFIG[k].includes(n)))throw Error('Thành phần trên lịch đã thay đổi ngoài danh sách. Liên hệ bộ phận tổng hợp để cập nhật.');});
  data.title=event?String(event.summary||''):reverseText_(record[Q.title]);data.place=event?String(event.location||''):reverseText_(record[Q.place]);
  data.name=lineValue('Người đăng ký')??reverseText_(record['Người đăng ký']||record[Q.contact]);data.docs=lineValue('Tài liệu')??reverseText_(record[Q.docs]);
  data.start=fmt(event?event.start.dateTime:record[Q.start]);data.end=fmt(event?event.end.dateTime:record[Q.end]);
  if(data.start&&data.end&&data.start.slice(0,10)!==data.end.slice(0,10))throw Error('Lịch kéo dài qua nhiều ngày cần được bộ phận tổng hợp chỉnh sửa trên Calendar.');
  data.mode=event||data.start?'fixed':'flexible';data.timeNote=reverseText_(record['Gợi ý thời gian']);data.website='';return data;
}
function editRevision_(ref,event){return editHash_(JSON.stringify([Object.values(Q).map(k=>ref.record[k]),ref.record['Người đăng ký'],ref.record['Loại thời gian'],ref.record['Gợi ý thời gian'],ref.record[EDIT.last],event?.etag||'']));}
function editResource_(ref,record,event,operation){
  const v=validate_(record),id=String(ref.record[META[0]]),old=event?.extendedProperties?.private||{},props={...old,...encodePeople_(v.people),editOperation:operation,endEstimated:String(record['Cách xác định giờ kết thúc']==='Mặc định hết buổi')};
  // Remove obsolete chunk values when the number of participants shrinks.
  Object.keys(old).filter(k=>k==='people'||/^people\d+$/.test(k)&&Number(k.slice(6))>=Number(props.peopleChunks)).forEach(k=>props[k]=null);
  const replacement=Object.fromEntries(['province','office','specialists'].map(k=>[Q[k],String(record[Q[k]])]));
  replacement['Người đăng ký']=record['Người đăng ký'];replacement['Tài liệu']=v.docs;replacement['Mã đăng ký']=id;
  const kept=String(event?.description||'').split(/\r?\n/).filter(line=>!Object.keys(replacement).some(k=>line.startsWith(k+':'))&&!line.startsWith('Giờ kết thúc mặc định hết buổi:'));
  let description=[...Object.entries(replacement).filter(([k,x])=>x||k!=='Tài liệu').map(([k,x])=>k+': '+x),...kept.filter(Boolean)].join('\n');
  if(props.endEstimated==='true')description+='\nGiờ kết thúc mặc định hết buổi: '+Utilities.formatDate(v.end,'Asia/Ho_Chi_Minh','HH:mm')+'.';
  return {...colorFields_(record),summary:record[Q.title],location:record[Q.place],description,start:{dateTime:v.start.toISOString(),timeZone:'Asia/Ho_Chi_Minh'},end:{dateTime:v.end.toISOString(),timeZone:'Asia/Ho_Chi_Minh'},extendedProperties:{private:props}};
}
function editConflict_(record,exclude){
  const v=validate_(record);if(v.flexible)return;let pageToken,pages=0;
  do{const result=Calendar.Events.list(CONFIG.calendarId,{timeMin:v.start.toISOString(),timeMax:v.end.toISOString(),singleEvents:true,showDeleted:false,maxResults:2500,...(pageToken?{pageToken}:{})});
    for(const e of result.items||[]){if(e.id===exclude||e.status==='cancelled'||e.transparency==='transparent')continue;const names=reverseParticipants_(e).split('\n');let people=[];['province','office','specialists'].forEach(k=>{const line=names.find(l=>l.startsWith(Q[k]+':'));if(line)people.push(...parsePeople_(line.slice(Q[k].length+1)).map(n=>k+':'+n));});
      if(!people.length||v.people.some(n=>people.includes(n)))throw Error('Thời gian mới bị trùng lịch. Thông tin cũ vẫn được giữ nguyên; vui lòng chọn khung khác.');}
    pageToken=result.nextPageToken;if(pageToken&&++pages>=4)throw Error('Chưa kiểm tra đủ lịch. Vui lòng thử lại sau.');
  }while(pageToken);
}
function editFinish_(ref,tx,event){
  const record=webRecord_(tx.data),ss=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
  if(!ref.record[EDIT.original])editPut_(ref,EDIT.original,JSON.stringify(tx.original||tx.before));
  const entries={...record,[META[1]]:event?'ĐÃ LÊN LỊCH':'CHỜ XẾP NGÀY',[META[2]]:event?event.id:'',[META[3]]:'Đã chỉnh sửa từ website.'};
  // Preserve unit information and unrelated Sheet columns.
  delete entries[Q.unit];Object.entries(entries).forEach(([k,value])=>editPut_(ref,k,value));
  const log=ss.getSheetByName(EDIT.log)||ss.insertSheet(EDIT.log),headers=['Mã thao tác','Thời điểm','Mã đăng ký','Người đăng ký','Trước chỉnh sửa (JSON)','Sau chỉnh sửa (JSON)'];reverseHeaders_(log,headers);
  const duplicate=log.getLastRow()>1?log.getRange(2,1,log.getLastRow()-1,1).createTextFinder(tx.operation).matchEntireCell(true).findNext():null;
  if(!duplicate){log.getRange(log.getLastRow()+1,1,1,headers.length).setValues([[tx.operation,new Date(tx.at),ref.record[META[0]],safe_(record['Người đăng ký']),JSON.stringify(tx.before),JSON.stringify(tx.data)]]);log.getRange(2,2,log.getLastRow()-1,1).setNumberFormat('dd/MM/yyyy HH:mm:ss');}
  // Refresh Calendar mirror immediately; five-minute polling continues independently.
  if(event){const h=reverseHeaders_(ref.sheet,RS.columns);ref.h=h;const snap=reverseSnapshot_(event);const mirror={'Trạng thái Calendar':'ĐÃ LÊN LỊCH','Nội dung trên Calendar':snap.data.title,'Bắt đầu trên Calendar':snap.start,'Kết thúc trên Calendar':snap.end,'Địa điểm trên Calendar':snap.data.place,'Thành phần trên Calendar':snap.data.people,'Calendar cập nhật lúc':snap.updated,'Phát hiện thay đổi lúc':new Date(tx.at),'Lần kiểm tra Calendar':new Date(),'Link Calendar':snap.link,'Ghi chú đồng bộ ngược':'Đã chỉnh sửa từ website; xem Nhật ký chỉnh sửa.','Dấu đồng bộ Calendar':snap.hash};Object.entries(mirror).forEach(([k,x])=>editPut_(ref,k,x));}
  editPut_(ref,EDIT.last,tx.operation);editPut_(ref,EDIT.at,new Date(tx.at));SpreadsheetApp.flush();editPut_(ref,EDIT.pending,'');SpreadsheetApp.flush();
  return {id:String(ref.record[META[0]]),status:String(ref.record[META[1]]),editCode:String(ref.record[EDIT.code]),updated:true};
}
function editRecover_(ref){
  if(!ref.record[EDIT.pending])return null;
  const tx=JSON.parse(String(ref.record[EDIT.pending])),event=editEvent_(ref);
  if(tx.data.mode==='flexible'&&!event||event?.extendedProperties?.private?.editOperation===tx.operation)return editFinish_(ref,tx,event);
  return null;
}
function scheduleEditLoad(token,code){
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{editSession_(token);let ref=editFind_(code);editRecover_(ref);ref=editRead_(ref.sheet,ref.row);const event=editEvent_(ref);return {id:String(ref.record[META[0]]),status:String(ref.record[META[1]]),data:editData_(ref.record,event),revision:editRevision_(ref,event),scheduled:!!event};}finally{lock.releaseLock();}
}
function scheduleUpdate(token,code,revision,operation,data){
  if(typeof operation!=='string'||!/^w[a-f0-9]{32}$/.test(operation))throw Error('Mã thao tác không hợp lệ.');
  const record=webRecord_(data),lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    editSession_(token);let ref=editFind_(code);
    if(ref.record[EDIT.pending]){const pending=JSON.parse(String(ref.record[EDIT.pending]));if(pending.operation===operation&&editHash_(JSON.stringify(pending.data))!==editHash_(JSON.stringify(data)))throw Error('Lần lưu trước chưa hoàn tất. Hãy mở lại lịch trước khi sửa tiếp.');const recovered=editRecover_(ref);if(recovered&&pending.operation===operation)return recovered;ref=editRead_(ref.sheet,ref.row);}
    if(ref.record[EDIT.last]===operation)return {id:String(ref.record[META[0]]),status:String(ref.record[META[1]]),editCode:code,updated:true};
    const event=editEvent_(ref);if(revision!==editRevision_(ref,event))throw Error('Lịch đã được thay đổi ở nơi khác. Hãy bấm Mở lịch để tải bản mới nhất trước khi lưu.');
    if(event&&data.mode==='flexible')throw Error('Lịch đã lên Calendar phải giữ ngày giờ cụ thể. Liên hệ bộ phận tổng hợp nếu cần hủy lịch.');
    const before=editData_(ref.record,event);
    const next=validate_(record);
    const sameSlot=event&&+next.start===+new Date(event.start.dateTime)&&+next.end===+new Date(event.end.dateTime)&&['province','office','specialists'].every(k=>JSON.stringify([...data[k]].sort())===JSON.stringify([...before[k]].sort()));
    if(!sameSlot)editConflict_(record,event?.id);
    const original=Object.fromEntries([...Object.values(Q),'Người đăng ký','Loại thời gian','Gợi ý thời gian'].map(k=>[k,ref.record[k]||'']));
    const tx={operation,data,before,original,at:new Date().toISOString()};
    editPut_(ref,EDIT.pending,JSON.stringify(tx));SpreadsheetApp.flush();
    let updated=null;
    if(data.mode==='fixed'){
      const resource=editResource_(ref,record,event,operation);
      try{updated=event?Calendar.Events.patch(resource,CONFIG.calendarId,event.id,{sendUpdates:'none'},{'If-Match':event.etag}):Calendar.Events.insert({...resource,id:String(ref.record[META[0]]),guestsCanModify:false,guestsCanInviteOthers:false},CONFIG.calendarId,{sendUpdates:'none'});}
      catch(error){
        let check;try{check=Calendar.Events.get(CONFIG.calendarId,String(event?.id||ref.record[META[0]]));}catch(ignore){}
        if(check?.status!=='cancelled'&&check?.extendedProperties?.private?.editOperation===operation)updated=check;
        else if(/412|precondition|409|already exists/i.test(String(error))){editPut_(ref,EDIT.pending,'');throw Error('Lịch vừa thay đổi. Hãy mở lại lịch để kiểm tra bản mới nhất.');}
        else throw Error('Chưa xác nhận được kết quả lưu. Giữ nguyên trang và bấm Lưu thay đổi lại; hệ thống sẽ kiểm tra để tránh tạo trùng.');
      }
    }
    return editFinish_(ref,tx,updated);
  }finally{lock.releaseLock();}
}
