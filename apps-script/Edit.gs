/* Anonymous editing uses a private per-registration capability, never the public ID alone.
   Calendar conditional writes + a durable Sheet journal protect retries and concurrent edits. */
const EDIT={code:'Mã chỉnh sửa (giữ riêng)',original:'Đăng ký ban đầu (JSON)',pending:'Giao dịch chỉnh sửa',last:'Thao tác chỉnh sửa cuối',at:'Chỉnh sửa gần nhất',log:'Nhật ký chỉnh sửa'};
function editHash_(value){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');}
function editHeaders_(sheet){return reverseHeaders_(sheet,[...Object.values(SPECIALIST_ROLES),'Người đăng ký','Loại thời gian','Gợi ý thời gian','Cách xác định giờ kết thúc',...Object.values(EDIT).filter(x=>x!==EDIT.log)]);}
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
function editEvent_(ref,admin){
  if(admin&&ref.record['Giao dịch xếp lịch (JSON)'])throw Error('Lịch đang được điều phối. Vui lòng thử lại sau.');
  if(admin&&ref.record['Trạng thái điều phối']==='ĐANG CHỜ')return null;
  if(!admin&&typeof schedulingGuard_==='function')schedulingGuard_(ref.record);
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
  Object.assign(data,specialistRoles_(record,event,data.specialists));
  data.specialists=[...data.specialistLead,...data.specialistSupport];
  data.title=event?String(event.summary||''):reverseText_(record[Q.title]);data.place=event?String(event.location||''):reverseText_(record[Q.place]);
  data.name=lineValue('Người đăng ký')??reverseText_(record['Người đăng ký']||record[Q.contact]);data.docs=lineValue('Tài liệu')??reverseText_(record[Q.docs]);
  data.start=fmt(event?event.start.dateTime:record[Q.start]);data.end=fmt(event?event.end.dateTime:record[Q.end]);
  if(data.start&&data.end&&data.start.slice(0,10)!==data.end.slice(0,10))throw Error('Lịch kéo dài qua nhiều ngày cần được bộ phận tổng hợp chỉnh sửa trên Calendar.');
  data.mode=event||data.start?'fixed':'flexible';data.timeNote=reverseText_(record['Gợi ý thời gian']);data.website='';return data;
}
function editRevision_(ref,event){return editHash_(JSON.stringify([[...Object.values(Q),...Object.values(SPECIALIST_ROLES)].map(k=>ref.record[k]),ref.record['Người đăng ký'],ref.record['Loại thời gian'],ref.record['Gợi ý thời gian'],ref.record[EDIT.last],event?.etag||'']));}
function editResource_(ref,record,event,operation){
  const v=validate_(record),id=String(ref.record[META[0]]),old=event?.extendedProperties?.private||{},props={...old,...encodePeople_(v.people),editOperation:operation,endEstimated:String(record['Cách xác định giờ kết thúc']==='Mặc định hết buổi')};
  // Remove obsolete chunk values when the number of participants shrinks.
  Object.keys(old).filter(k=>k==='people'||/^people\d+$/.test(k)&&Number(k.slice(6))>=Number(props.peopleChunks)).forEach(k=>props[k]=null);
  const replacement=Object.fromEntries(['province','office','specialists'].map(k=>[Q[k],String(record[Q[k]])]));
  Object.assign(replacement,specialistRoleFields_(record));
  replacement['Người đăng ký']=record['Người đăng ký'];replacement['Tài liệu']=v.docs;replacement['Mã đăng ký']=id;
  const kept=String(event?.description||'').split(/\r?\n/).filter(line=>!Object.keys(replacement).some(k=>line.startsWith(k+':'))&&!line.startsWith('Giờ kết thúc mặc định hết buổi:'));
  let description=[...Object.entries(replacement).filter(([k,x])=>x||k!=='Tài liệu').map(([k,x])=>k+': '+x),...kept.filter(Boolean)].join('\n');
  if(props.endEstimated==='true')description+='\nGiờ kết thúc mặc định hết buổi: '+Utilities.formatDate(v.end,'Asia/Ho_Chi_Minh','HH:mm')+'.';
  return {...colorFields_(record),summary:record[Q.title],location:record[Q.place],description,start:{dateTime:v.start.toISOString(),timeZone:'Asia/Ho_Chi_Minh'},end:{dateTime:v.end.toISOString(),timeZone:'Asia/Ho_Chi_Minh'},extendedProperties:{private:props}};
}
function editConflict_(record,exclude){
  const v=validate_(record);if(v.flexible||!v.people.some(n=>n.startsWith('province:')))return;let pageToken,pages=0;
  do{const result=Calendar.Events.list(CONFIG.calendarId,{timeMin:v.start.toISOString(),timeMax:v.end.toISOString(),singleEvents:true,showDeleted:false,maxResults:2500,...(pageToken?{pageToken}:{})});
    for(const e of result.items||[]){if(e.id===exclude)continue;
      if(provinceConflict_(v.people,e))throw Error('Thời gian mới bị trùng lịch Lãnh đạo UBND tỉnh hoặc có lịch nhập tay chưa rõ thành phần lãnh đạo tỉnh. Thông tin cũ vẫn được giữ nguyên; vui lòng chọn khung khác.');}
    pageToken=result.nextPageToken;if(pageToken&&++pages>=4)throw Error('Chưa kiểm tra đủ lịch. Vui lòng thử lại sau.');
  }while(pageToken);
}
function editFinish_(ref,tx,event){
  adminInvalidate_();
  editHeaders_(ref.sheet);ref=editRead_(ref.sheet,ref.row);
  const record=webRecord_(tx.data),ss=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
  if(!ref.record[EDIT.original])editPut_(ref,EDIT.original,JSON.stringify(tx.original||tx.before));
  const entries={...record,[META[1]]:event?'ĐÃ LÊN LỊCH':tx.keepWaiting?(tx.waitingStatus||'CHỜ XẾP LỊCH'):'CHỜ XẾP NGÀY',[META[2]]:event?event.id:'',[META[3]]:tx.admin?'Đã chỉnh sửa bởi quản trị trên website.'+(tx.keepWaiting?' Giữ nguyên trạng thái chờ, chưa đẩy lên Calendar.':''):'Đã chỉnh sửa từ website.'};
  // Preserve unit information and unrelated Sheet columns.
  delete entries[Q.unit];Object.entries(entries).forEach(([k,value])=>editPut_(ref,k,value));
  const log=ss.getSheetByName(EDIT.log)||ss.insertSheet(EDIT.log),headers=['Mã thao tác','Thời điểm','Mã đăng ký','Người đăng ký','Trước chỉnh sửa (JSON)','Sau chỉnh sửa (JSON)','Vai trò chỉnh sửa'];reverseHeaders_(log,headers);
  const duplicate=log.getLastRow()>1?log.getRange(2,1,log.getLastRow()-1,1).createTextFinder(tx.operation).matchEntireCell(true).findNext():null;
  if(!duplicate){log.getRange(log.getLastRow()+1,1,1,headers.length).setValues([[tx.operation,new Date(tx.at),ref.record[META[0]],safe_(record['Người đăng ký']),JSON.stringify(tx.before),JSON.stringify(tx.data),tx.admin?'QUẢN TRỊ':'MÃ RIÊNG']]);log.getRange(2,2,log.getLastRow()-1,1).setNumberFormat('dd/MM/yyyy HH:mm:ss');}
  // Refresh Calendar mirror immediately; five-minute polling continues independently.
  if(event){const h=reverseHeaders_(ref.sheet,RS.columns);ref.h=h;const snap=reverseSnapshot_(event);const mirror={'Trạng thái Calendar':'ĐÃ LÊN LỊCH','Nội dung trên Calendar':snap.data.title,'Bắt đầu trên Calendar':snap.start,'Kết thúc trên Calendar':snap.end,'Địa điểm trên Calendar':snap.data.place,'Thành phần trên Calendar':snap.data.people,'Calendar cập nhật lúc':snap.updated,'Phát hiện thay đổi lúc':new Date(tx.at),'Lần kiểm tra Calendar':new Date(),'Link Calendar':snap.link,'Ghi chú đồng bộ ngược':'Đã chỉnh sửa từ website; xem Nhật ký chỉnh sửa.','Dấu đồng bộ Calendar':snap.hash};Object.entries(mirror).forEach(([k,x])=>editPut_(ref,k,x));}
  editPut_(ref,EDIT.last,tx.operation);editPut_(ref,EDIT.at,new Date(tx.at));SpreadsheetApp.flush();editPut_(ref,EDIT.pending,'');SpreadsheetApp.flush();
  adminInvalidate_();
  const {row,...item}=adminSummary_(ref.record,ref.sheet.getName(),ref.row);
  return {id:String(ref.record[META[0]]),status:String(ref.record[META[1]]),editCode:String(ref.record[EDIT.code]),updated:true,item};
}
function editRecover_(ref,admin){
  if(!ref.record[EDIT.pending])return null;
  const tx=JSON.parse(String(ref.record[EDIT.pending])),event=editEvent_(ref,admin);
  if((tx.data.mode==='flexible'||tx.keepWaiting)&&!event||event?.extendedProperties?.private?.editOperation===tx.operation)return editFinish_(ref,tx,event);
  return null;
}
function scheduleEditLoad(token,code){
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{editSession_(token);let ref=editFind_(code);editRecover_(ref);ref=editRead_(ref.sheet,ref.row);const event=editEvent_(ref);return {id:String(ref.record[META[0]]),status:String(ref.record[META[1]]),data:editData_(ref.record,event),revision:editRevision_(ref,event),scheduled:!!event};}finally{lock.releaseLock();}
}
function scheduleUpdate(token,code,revision,operation,data){
  return editUpdate_(token,code,revision,operation,data,null);
}
function editUpdate_(token,code,revision,operation,data,adminId){
  if(typeof operation!=='string'||!/^w[a-f0-9]{32}$/.test(operation))throw Error('Mã thao tác không hợp lệ.');
  const record=webRecord_(data),lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    if(adminId)adminSession_(token,code);else editSession_(token);let ref=adminId?adminFind_(adminId):editFind_(code);
    if(ref.record[EDIT.pending]){const pending=JSON.parse(String(ref.record[EDIT.pending]));if(pending.operation===operation&&editHash_(JSON.stringify(pending.data))!==editHash_(JSON.stringify(data)))throw Error('Lần lưu trước chưa hoàn tất. Hãy mở lại lịch trước khi sửa tiếp.');const recovered=editRecover_(ref,!!adminId);if(recovered&&pending.operation===operation)return recovered;ref=editRead_(ref.sheet,ref.row);}
    if(ref.record[EDIT.last]===operation){const {row,...item}=adminSummary_(ref.record,ref.sheet.getName(),ref.row);return {id:String(ref.record[META[0]]),status:String(ref.record[META[1]]),editCode:adminId?'':code,updated:true,item};}
    const event=editEvent_(ref,!!adminId);if(revision!==editRevision_(ref,event))throw Error('Lịch đã được thay đổi ở nơi khác. Hãy bấm Mở lịch để tải bản mới nhất trước khi lưu.');
    if(event&&data.mode==='flexible')throw Error('Lịch đã lên Calendar phải giữ ngày giờ cụ thể. Liên hệ bộ phận tổng hợp nếu cần hủy lịch.');
    const before=editData_(ref.record,event);
    const next=validate_(record);
    const sameSlot=event&&+next.start===+new Date(event.start.dateTime)&&+next.end===+new Date(event.end.dateTime)&&['province','office','specialists'].every(k=>JSON.stringify(parsePeople_(record[Q[k]]).sort())===JSON.stringify([...before[k]].sort()));
    const keepWaiting=!!adminId&&!event;
    if(!sameSlot&&!keepWaiting)editConflict_(record,event?.id);
    const original=Object.fromEntries([...Object.values(Q),...Object.values(SPECIALIST_ROLES),'Người đăng ký','Loại thời gian','Gợi ý thời gian'].map(k=>[k,ref.record[k]||'']));
    const tx={operation,data,before,original,at:new Date().toISOString(),admin:!!adminId,keepWaiting,waitingStatus:keepWaiting?String(ref.record[META[1]]):''};
    if(!ref.h.includes(EDIT.pending)){editHeaders_(ref.sheet);ref=editRead_(ref.sheet,ref.row);}
    editPut_(ref,EDIT.pending,JSON.stringify(tx));SpreadsheetApp.flush();
    let updated=null;
    if(data.mode==='fixed'&&!keepWaiting){
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
  }finally{lock.releaseLock();if(typeof tgCaptureSafe_==='function')tgCaptureSafe_();}
}

/* Administrative sessions are server-side, short lived and bound to the bootstrap session.
   ADMIN_EDIT_SECRET is a private Script Property containing JSON {salt,hash}.
   Neither this property nor per-registration edit codes are returned by admin endpoints. */
function adminSecret_(){
  let value;try{value=JSON.parse(PropertiesService.getScriptProperties().getProperty('ADMIN_EDIT_SECRET')||'null');}catch(e){}
  if(!value||typeof value.salt!=='string'||!/^[a-f0-9]{64}$/.test(value.hash||''))throw Error('Chưa cấu hình mã quản trị.');
  return value;
}
function adminEqual_(a,b){let diff=a.length^b.length;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^(b.charCodeAt(i)||0);return diff===0;}
function adminWeb_(token){
  if(typeof token!=='string'||token.length!==72||!CacheService.getScriptCache().get('web:'+token))throw Error('Phiên trang đã hết hạn. Hãy tải lại trang.');
}
function scheduleAdminLogin(token,password,skipIndex){
  const lock=LockService.getUserLock();lock.waitLock(10000);let result;
  try{
    adminWeb_(token);const cache=CacheService.getScriptCache(),key='admin-attempt:'+editHash_(token),now=Date.now();
    const read=k=>{const v=JSON.parse(cache.get(k)||'null');return v&&v.until>now?v:{count:0,until:now+900000};};
    const local=read(key),global=read('admin-attempt:global');
    if(local.count>=5||global.count>=30)throw Error('Đã nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.');
    const secret=adminSecret_();
    if(typeof password!=='string'||password.length>200||!adminEqual_(editHash_(secret.salt+':'+password),secret.hash)){
      local.count++;global.count++;cache.put(key,JSON.stringify(local),900);cache.put('admin-attempt:global',JSON.stringify(global),900);throw Error('Mã quản trị không đúng.');
    }
    const ticket=Utilities.getUuid()+Utilities.getUuid(),expires=now+1800000;
    cache.put('admin:'+editHash_(ticket),JSON.stringify({web:editHash_(token),expires,secret:secret.hash}),1800);
    cache.remove(key);result={ticket,expires};
  }finally{lock.releaseLock();}
  if(skipIndex===true)return result;
  try{return {...result,index:adminIndexPublic_(adminIndex_())};}catch(e){return {...result,listError:'Chưa tải được danh sách. Bấm Làm mới để thử lại.'};}
}
function adminSession_(token,ticket){
  adminWeb_(token);
  if(typeof ticket!=='string'||ticket.length!==72)throw Error('Phiên quản trị đã hết hạn. Vui lòng đăng nhập lại.');
  const session=JSON.parse(CacheService.getScriptCache().get('admin:'+editHash_(ticket))||'null');
  if(!session||session.expires<=Date.now()||session.web!==editHash_(token)||session.secret!==adminSecret_().hash)throw Error('Phiên quản trị đã hết hạn. Vui lòng đăng nhập lại.');
}
function scheduleAdminLogout(token,ticket){adminSession_(token,ticket);CacheService.getScriptCache().remove('admin:'+editHash_(ticket));return {ok:true};}
function adminFind_(id){
  if(typeof id!=='string'||!/^[a-f0-9]{32,41}$/.test(id))throw Error('Mã đăng ký không hợp lệ.');
  const ss=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
  const hint=adminIndexRead_()?.items.find(item=>item.id===id);
  if(hint){const sheet=ss.getSheetByName(hint.sheet);if(sheet&&hint.row<=sheet.getLastRow()){const ref=editRead_(sheet,hint.row);if(String(ref.record[META[0]])===id&&!/KIỂM THỬ/.test(ref.record[META[1]]))return ref;}}
  for(const sheet of adminSourceSheets_(ss)){
    if(sheet.getLastRow()<2)continue;const h=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
    if(!Object.values(Q).every(n=>h.includes(n))||!h.includes(META[0]))continue;
    const match=sheet.getRange(2,h.indexOf(META[0])+1,sheet.getLastRow()-1,1).createTextFinder(id).matchEntireCell(true).findNext();
    if(match){const ref=editRead_(sheet,match.getRow());if(/KIỂM THỬ/.test(ref.record[META[1]]))break;return ref;}
  }throw Error('Không tìm thấy đăng ký. Hãy tải lại danh sách.');
}
// Two input tabs only: never scan the weekly report or audit log data.
function adminSourceSheets_(ss){return ['Đăng ký từ website','Câu trả lời biểu mẫu 1'].map(name=>ss.getSheetByName(name)).filter(Boolean);}
function adminDate_(value){if(!value)return '';const d=new Date(value);return Number.isFinite(+d)?new Date(+d+7*3600000).toISOString().slice(0,16):'';}
function adminSummary_(r,sheet,row){
  const scheduled=!!r[META[2]]&&r['Trạng thái điều phối']!=='ĐANG CHỜ',removed=/ĐÃ XÓA|ĐÃ HỦY|KHÔNG CÒN|KHÔNG TÌM THẤY/.test(String(r['Trạng thái Calendar']||''));
  const mirror=scheduled?String(r['Thành phần trên Calendar']||'').split(/\r?\n/).find(line=>line.startsWith(Q.province+':')):null;
  return {id:String(r[META[0]]),title:reverseText_((scheduled?r['Nội dung trên Calendar']:'')||r[Q.title]),start:adminDate_((scheduled?r['Bắt đầu trên Calendar']:'')||r[Q.start]),end:adminDate_((scheduled?r['Kết thúc trên Calendar']:'')||r[Q.end]),province:mirror!==undefined&&mirror!==null?mirror.slice(Q.province.length+1).trim():reverseText_(r[Q.province]),status:removed?String(r['Trạng thái Calendar']):String(r[META[1]]||''),scheduled,removed,sheet,row};
}
function adminInvalidate_(){const cache=CacheService.getScriptCache();cache.put('admin-index:generation',Utilities.getUuid(),600);cache.remove('admin-index:manifest');}
function adminIndexRead_(){
  const cache=CacheService.getScriptCache();let manifest;
  try{manifest=JSON.parse(cache.get('admin-index:manifest')||'null');}catch(e){return null;}
  if(!manifest||Date.now()-manifest.at>120000||manifest.generation!==(cache.get('admin-index:generation')||'0'))return null;
  try{const parts=[];for(let i=0;i<manifest.parts;i++){const part=cache.get('admin-index:'+manifest.id+':'+i);if(part===null||part===undefined)return null;parts.push(part);}return {items:JSON.parse(parts.join('')),at:manifest.at};}catch(e){return null;}
}
function adminIndex_(fresh){
  if(!fresh){const hit=adminIndexRead_();if(hit)return hit;}
  const cache=CacheService.getScriptCache(),generation=cache.get('admin-index:generation')||'0';
  const ss=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID')),items=[];
  const needed=[META[0],META[1],META[2],Q.title,Q.province,Q.start,Q.end,'Trạng thái Calendar','Nội dung trên Calendar','Bắt đầu trên Calendar','Kết thúc trên Calendar','Thành phần trên Calendar','Trạng thái điều phối'];
  for(const sheet of adminSourceSheets_(ss)){
    const last=sheet.getLastRow();if(last<2)continue;const h=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
    if(!h.includes(META[0]))continue;
    // Group nearby summary columns. Never read edit codes or large original/transaction JSON columns.
    const cols=needed.map(k=>h.indexOf(k)).filter(i=>i>=0).sort((a,b)=>a-b),groups=[];
    cols.forEach(col=>{const prev=groups[groups.length-1];if(prev&&col-prev[prev.length-1]<=3)prev.push(col);else groups.push([col]);});
    const records=Array.from({length:last-1},()=>({}));
    for(const group of groups){const first=group[0],values=sheet.getRange(2,first+1,last-1,group[group.length-1]-first+1).getValues();values.forEach((v,i)=>group.forEach(col=>records[i][h[col]]=v[col-first]));}
    records.forEach((r,i)=>{if(/^[a-f0-9]{32,41}$/.test(String(r[META[0]]||''))&&!/KIỂM THỬ/.test(r[META[1]]))items.push(adminSummary_(r,sheet.getName(),i+2));});
  }
  items.sort((a,b)=>(a.start||'9999').localeCompare(b.start||'9999')||a.id.localeCompare(b.id));
  const at=Date.now(),id=Utilities.getUuid(),json=JSON.stringify(items),parts=Math.ceil(json.length/20000);
  // Small chunks fit Apps Script's per-entry limit even with Vietnamese Unicode.
  if(parts<=100&&generation===(cache.get('admin-index:generation')||'0')){
    for(let i=0;i<parts;i++)cache.put('admin-index:'+id+':'+i,json.slice(i*20000,(i+1)*20000),120);
    if(generation===(cache.get('admin-index:generation')||'0'))cache.put('admin-index:manifest',JSON.stringify({id,parts,at,generation}),120);
  }
  return {items,at};
}
function adminIndexPublic_(index){return {items:index.items.map(({row,...item})=>item),at:index.at};}
function scheduleAdminSnapshot(token,ticket,fresh){adminSession_(token,ticket);return adminIndexPublic_(adminIndex_(fresh===true));}
// Retained for older open pages; their searches now use the same compact cached index.
function scheduleAdminList(token,ticket,options){
  adminSession_(token,ticket);options=options||{};const normalize=t=>String(t).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d');
  const query=normalize(String(options.query||'').slice(0,200)),offset=Math.max(0,Math.floor(Number(options.offset)||0)),scope=String(options.scope||'current'),today=adminDate_(new Date()).slice(0,10);
  const items=adminIndexPublic_(adminIndex_()).items.filter(item=>!(scope==='current'&&(item.removed||item.scheduled&&item.end&&item.end.slice(0,10)<today))&&!(scope==='waiting'&&(item.scheduled||item.removed))&&(!query||normalize(Object.values(item).join(' ')).includes(query)));
  return {items:items.slice(offset,offset+100),total:items.length,next:offset+100<items.length?offset+100:null};
}
function scheduleAdminLoad(token,ticket,id){
  adminSession_(token,ticket);let ref=adminFind_(id);
  // Ordinary reads do not wait behind the five-minute sync or rewrite Sheet headers.
  if(ref.record[EDIT.pending]){const lock=LockService.getScriptLock();lock.waitLock(30000);try{adminSession_(token,ticket);ref=adminFind_(id);editRecover_(ref,true);ref=editRead_(ref.sheet,ref.row);}finally{lock.releaseLock();}}
  const event=editEvent_(ref,true);return {id,status:String(ref.record[META[1]]),data:editData_(ref.record,event),revision:editRevision_(ref,event),scheduled:!!event,admin:true};
}
function scheduleAdminUpdate(token,ticket,id,revision,operation,data){
  // Authentication must precede lookup, including empty/forged IDs. The core rechecks under lock.
  adminSession_(token,ticket);if(typeof id!=='string'||!/^[a-f0-9]{32,41}$/.test(id))throw Error('Mã đăng ký không hợp lệ.');
  const result=editUpdate_(token,ticket,revision,operation,data,id);return {id:result.id,status:result.status,updated:true,admin:true,item:result.item};
}

/* Admin-only PDF. Use a fresh Calendar read, never client-supplied event contents.
   Conversion returns bytes directly; no public Drive file or temporary Sheet. */
function scheduleAdminExportPdf(token,ticket,day,leader){
  adminSession_(token,ticket);
  if(typeof leader!=='string'||(leader&&!CONFIG.province.includes(leader)))throw Error('Lãnh đạo được chọn không hợp lệ.');
  const week=weeklyWeek_(day),data=scheduleOverview(week);
  const events=data.busy.filter(e=>!leader||e.province.includes(leader)||!e.participantsKnown);
  if(!events.length)throw Error('Không có lịch phù hợp với bộ lọc để xuất PDF.');
  const html=weeklyPdfHtml_(week,leader,events);
  if(html.length>1500000)throw Error('Lịch tuần quá lớn để xuất một file. Hãy lọc theo từng lãnh đạo.');
  const bytes=Utilities.newBlob(html,'text/html','lich-tuan.html').getAs('application/pdf').getBytes();
  if(bytes.length<5||bytes.slice(0,5).map(b=>String.fromCharCode((b+256)%256)).join('')!=='%PDF-')throw Error('Chưa tạo được file PDF. Vui lòng thử lại.');
  adminSession_(token,ticket);
  const suffix=leader?'-'+leader.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,''):'';
  return {filename:'Lich-cong-tac-'+week+suffix+'.pdf',mime:'application/pdf',base64:Utilities.base64Encode(bytes)};
}
