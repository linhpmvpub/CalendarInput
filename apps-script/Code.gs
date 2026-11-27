/* Chạy trong Apps Script gắn với Sheet riêng. Bật Advanced Google Calendar API v3.
   Cấu hình tên thật CHỈ trong Apps Script, không đẩy bản cấu hình nội bộ lên GitHub. */
const CONFIG = {
  calendarId: 'THAY_CALENDAR_ID',
  province: ['THAY_DANH_SACH_LANH_DAO_TINH'],
  office: ['THAY_DANH_SACH_LANH_DAO_VAN_PHONG'],
  specialists: ['THAY_DANH_SACH_CHUYEN_VIEN']
};
const Q = { province:'Lãnh đạo UBND tỉnh', office:'Lãnh đạo Văn phòng UBND tỉnh',
  specialists:'Chuyên viên', place:'Địa điểm', start:'Bắt đầu', end:'Kết thúc',
  title:'Nội dung', unit:'Đơn vị đăng ký', contact:'Người liên hệ', docs:'Link tài liệu' };
const META = ['Mã đăng ký','Trạng thái xử lý','Calendar Event ID','Ghi chú xử lý'];
function onOpen_() {
  SpreadsheetApp.getUi().createMenu('Xếp lịch').addItem('Xử lý lại dòng đang chọn','retrySelected_').addToUi();
}
function setup_() {
  if (JSON.stringify(CONFIG).includes('THAY_')) throw Error('Điền CONFIG trước khi chạy setup.');
  const p=PropertiesService.getScriptProperties();
  if(p.getProperty('FORM_ID')) throw Error('Đã tạo biểu mẫu. Không chạy setup lần nữa.');
  if (['province','office','specialists'].some(k=>CONFIG[k].some(n=>n.includes(',')))) throw Error('Tên nhân sự không được chứa dấu phẩy.');
  Calendar.Calendars.get(CONFIG.calendarId); // Xác minh kết nối trước khi tạo.
  const ss=SpreadsheetApp.getActive() || SpreadsheetApp.create('Đăng ký lịch làm việc lãnh đạo');
  p.setProperty('SHEET_ID',ss.getId());
  console.log('Google Sheet: '+ss.getUrl());
  ss.setSpreadsheetTimeZone('Asia/Ho_Chi_Minh');
  const form=FormApp.create('Đăng ký lịch làm việc lãnh đạo');
  p.setProperty('FORM_ID',form.getId());
  form.setAcceptingResponses(false);
  form.setDescription('Giờ Việt Nam (UTC+7). Gửi đăng ký chưa đồng nghĩa lịch đã được xác nhận.');
  form.setCollectEmail(true).setAllowResponseEdits(false).setPublishingSummary(false);
  ['province','office','specialists'].forEach(k=>form.addCheckboxItem().setTitle(Q[k]).setChoiceValues(CONFIG[k]));
  form.addTextItem().setTitle(Q.unit).setRequired(true);
  form.addTextItem().setTitle(Q.contact).setRequired(true);
  form.addTextItem().setTitle(Q.place).setRequired(true);
  form.addDateTimeItem().setTitle(Q.start).setIncludesYear(true).setRequired(true);
  form.addDateTimeItem().setTitle(Q.end).setIncludesYear(true).setRequired(true);
  form.addParagraphTextItem().setTitle(Q.title).setRequired(true);
  form.addTextItem().setTitle(Q.docs).setHelpText('Link Google Drive; quyền xem tài liệu được quản lý riêng.');
  form.setConfirmationMessage('Đã nhận đăng ký. Bộ phận tổng hợp kiểm tra kết quả xếp lịch trên Calendar chính thức.');
  form.setDestination(FormApp.DestinationType.SPREADSHEET,ss.getId());
  ScriptApp.newTrigger('handleSubmit').forSpreadsheet(ss).onFormSubmit().create();
  console.log('Mở để cấu hình quyền người trả lời và email Verified, sau đó Publish: '+form.getEditUrl());
  console.log('URL người trả lời: '+form.getPublishedUrl());
}
function handleSubmit(e) {
  if(!e || !e.range || typeof e.range.getSheet!=='function') throw Error('Hàm này chỉ chạy bằng trigger From spreadsheet → On form submit.');
  processRow_(e.range.getSheet(),e.range.getRow());
}
function retryPending_() {
  const ss=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
  ss.getSheets().forEach(s=>{
    if(s.getLastRow()<2)return;
    const h=s.getRange(1,1,1,s.getLastColumn()).getValues()[0];
    if(!Object.values(Q).every(k=>h.includes(k)))return;
    const status=h.indexOf(META[1]);
    const values=s.getDataRange().getValues();
    for(let i=1;i<values.length;i++){
      if(status<0||!values[i][status]||values[i][status]==='LỖI ĐỒNG BỘ'||(values[i][status]==='CHỜ XẾP NGÀY'&&values[i][h.indexOf(Q.start)] instanceof Date&&values[i][h.indexOf(Q.end)] instanceof Date)){
        try{processRow_(s,i+1);}catch(e){console.error(String(e));}
      }
    }
  });
}
function retrySelected_() {
  const s=SpreadsheetApp.getActiveSheet(),r=s.getActiveRange().getRow();
  processRow_(s,r);
}
function safe_(v){const s=String(v||'');return /^[=+@\-]/.test(s)?"'"+s:s;}
function parsePeople_(v){return String(v||'').split(',').map(s=>s.trim()).filter(Boolean);}
function validate_(record){
  const start=record[Q.start],end=record[Q.end];
  const flexible=record['Loại thời gian']==='Chưa cố định ngày'&&!start&&!end;
  if(!flexible&&(!(start instanceof Date)||!(end instanceof Date)||!Number.isFinite(+start)||!Number.isFinite(+end)||end<=start))
    throw Error('Ngày giờ không hợp lệ hoặc kết thúc không sau bắt đầu.');
  const people=[];
  ['province','office','specialists'].forEach(k=>parsePeople_(record[Q[k]]).forEach(name=>{
    if(!CONFIG[k].includes(name)) throw Error('Tên không thuộc danh sách cấu hình: '+name);
    people.push(k+':'+name);
  }));
  if(!people.length) throw Error('Phải chọn ít nhất một người tham dự.');
  [Q.title,Q.place,Q.contact].forEach(k=>{if(!String(record[k]||'').trim())throw Error('Thiếu '+k);});
  if(String(record[Q.title]).length>5000)throw Error('Nội dung tối đa 5000 ký tự.');
  const docs=String(record[Q.docs]||'').trim();
  if(docs&&!/^https:\/\//i.test(docs))throw Error('Link tài liệu phải bắt đầu bằng https://');
  return {start,end,people,docs,flexible};
}
function encodePeople_(people){
  const chunks=[];let current=[];
  people.forEach(person=>{
    if(Utilities.newBlob(JSON.stringify([...current,person])).getBytes().length>900){
      if(!current.length)throw Error('Tên thành phần quá dài.');
      chunks.push(current);current=[];
    }
    current.push(person);
  });
  if(current.length)chunks.push(current);
  const result={peopleChunks:String(chunks.length)};
  chunks.forEach((chunk,i)=>{result['people'+i]=JSON.stringify(chunk);});
  return result;
}
function decodePeople_(properties){
  if(!properties)return null;
  if(properties.people)return JSON.parse(properties.people);
  const count=Number(properties.peopleChunks);
  if(!Number.isInteger(count)||count<1||count>50)return null;
  let result=[];
  for(let i=0;i<count;i++){
    if(!properties['people'+i])return null;
    result=result.concat(JSON.parse(properties['people'+i]));
  }
  return result;
}
function calendarGet_(id){
  try{return Calendar.Events.get(CONFIG.calendarId,id);}catch(e){
    if(/404|not found/i.test(String(e)))return null;
    throw e;
  }
}
function processRow_(sheet,row){
  if(row<2)throw Error('Chọn một dòng dữ liệu.');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    let headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
    if(!Object.values(Q).every(k=>headers.includes(k)))throw Error('Chọn đúng tab phản hồi của Form.');
    META.forEach(k=>{if(!headers.includes(k)){headers.push(k);sheet.getRange(1,headers.length).setValue(k);}});
    const values=sheet.getRange(row,1,1,headers.length).getValues()[0];
    const record=Object.fromEntries(headers.map((k,i)=>[k,values[i]]));
    const put=(key,value)=>sheet.getRange(row,headers.indexOf(key)+1).setValue(safe_(value));
    if(typeof schedulingGuard_==='function'){try{schedulingGuard_(record);}catch(e){put(META[3],String(e.message||e));return;}}
    let id=String(record[META[0]]||'');
    if(!id){id=Utilities.getUuid().replace(/-/g,'');put(META[0],id);SpreadsheetApp.flush();}
    try{
      const existing=calendarGet_(String(record[META[2]]||id));
      if(existing){
        if(existing.status==='cancelled'){put(META[1],'ĐÃ HỦY TRÊN CALENDAR');return;}
        put(META[1],'ĐÃ LÊN LỊCH');put(META[2],existing.id);put(META[3],'');return;
      }
      // A previously linked event must never be recreated by a retry after removal.
      if(record[META[2]]){put(META[1],'KHÔNG TÌM THẤY TRÊN CALENDAR');put(META[3],'Sự kiện đã liên kết không còn truy cập được. Không tự tạo lại; kiểm tra Calendar.');return;}
      const v=validate_(record);
      if(v.flexible){put(META[1],'CHỜ XẾP NGÀY');put(META[3],'Chưa cố định ngày. Chưa tạo sự kiện Calendar.');return;}
      let pageToken,conflict=false;
      do{
        const result=Calendar.Events.list(CONFIG.calendarId,{timeMin:v.start.toISOString(),timeMax:v.end.toISOString(),singleEvents:true,showDeleted:false,maxResults:2500,...(pageToken?{pageToken}:{})});
        for(const event of result.items||[]){
          if(event.transparency==='transparent')continue;
          const others=decodePeople_(event.extendedProperties&&event.extendedProperties.private);
          // Lịch nhập thủ công không có mã người: giữ lại để quản trị kiểm tra, không tự chèn.
          if(!others){conflict=true;break;}
          if(v.people.some(x=>others.includes(x))){conflict=true;break;}
        }
        pageToken=result.nextPageToken;
      }while(pageToken&&!conflict);
      if(conflict){put(META[1],'CHỜ XỬ LÝ TRÙNG LỊCH');put(META[3],'Trùng thành phần hoặc khoảng thời gian có lịch nhập thủ công. Không tự thay thế.');return;}
      const peopleProperties=encodePeople_(v.people);
      const endEstimated=String(record['Cách xác định giờ kết thúc']||'').startsWith('Mặc định hết buổi');
      if(endEstimated)peopleProperties.endEstimated='true';
      const description=[...['province','office','specialists'].map(k=>Q[k]+': '+String(record[Q[k]]||'')),record[Q.unit]?Q.unit+': '+record[Q.unit]:'','Người đăng ký: '+(record['Người đăng ký']||record[Q.contact]),v.docs?'Tài liệu: '+v.docs:'','Mã đăng ký: '+id].join('\n');
      const resource={id,...colorFields_(record),summary:String(record[Q.title]),location:String(record[Q.place]),description:description+(endEstimated?'\nGiờ kết thúc mặc định hết buổi: '+Utilities.formatDate(v.end,'Asia/Ho_Chi_Minh','HH:mm')+'.':''),
        start:{dateTime:v.start.toISOString(),timeZone:'Asia/Ho_Chi_Minh'},end:{dateTime:v.end.toISOString(),timeZone:'Asia/Ho_Chi_Minh'},
        guestsCanModify:false,guestsCanInviteOthers:false,visibility:'default',extendedProperties:{private:peopleProperties}};
      let event;
      try{event=Calendar.Events.insert(resource,CONFIG.calendarId,{sendUpdates:'none'});}catch(e){
        // Đã tạo nhưng mất phản hồi: đọc lại đúng ID, không tạo sự kiện thứ hai.
        event=calendarGet_(id);if(!event)throw e;
      }
      put(META[1],'ĐÃ LÊN LỊCH');put(META[2],event.id);put(META[3],'');
    }catch(e){put(META[1],'LỖI ĐỒNG BỘ');put(META[3],String(e).slice(0,800));throw e;}
  }finally{lock.releaseLock();}
}

/* Participant color rules. Names stay in private CONFIG / Script Properties.
   One event color: chair > multiple deputies > one deputy > office > specialists.
   Description group lines override old metadata, including explicitly empty lines. */
const COLOR_STYLE = {
  '11':{hex:'#d50000',name:'Đỏ'}, '3':{hex:'#8e24aa',name:'Tím'},
  '9':{hex:'#3f51b5',name:'Xanh dương'}, '5':{hex:'#f6bf26',name:'Vàng'},
  '6':{hex:'#f4511e',name:'Cam'}, '7':{hex:'#039be5',name:'Xanh da trời'},
  '1':{hex:'#7986cb',name:'Xanh oải hương'}, '10':{hex:'#0b8043',name:'Xanh lá'},
  '8':{hex:'#616161',name:'Xám'}
};
let colorMapMemo_=null;
function colorRole_(name){
  const s=String(name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().trim();
  return /^chu tich\b/.test(s)?'chair':/^pho chu tich\b/.test(s)?'deputy':null;
}
function colorDeputies_(){
  if(colorMapMemo_)return colorMapMemo_;
  const p=PropertiesService.getScriptProperties(),stored=JSON.parse(p.getProperty('PARTICIPANT_COLOR_MAP')||'{}');
  const palette=['9','5','6','7','1'],map={...stored};
  CONFIG.province.filter(n=>colorRole_(n)==='deputy').forEach(n=>{
    if(!palette.includes(map[n])){const free=palette.find(c=>!Object.values(map).includes(c));if(free)map[n]=free;}
  });
  return colorMapMemo_=map;
}
function colorChoice_(people){
  if(!people)return null;
  const province=[...new Set(people.province||[])];
  // Known chair always takes priority; never guess a lower rank for unknown provincial names.
  if(province.some(n=>CONFIG.province.includes(n)&&colorRole_(n)==='chair'))return {id:'11',label:'Có Chủ tịch UBND tỉnh'};
  if(province.some(n=>!CONFIG.province.includes(n)||colorRole_(n)!=='deputy'))return null;
  if(province.length>=2)return {id:'3',label:'Phối hợp từ hai Phó Chủ tịch UBND tỉnh'};
  if(province.length===1){const id=colorDeputies_()[province[0]];return id?{id,label:province[0]}:null;}
  if((people.office||[]).length){return people.office.every(n=>CONFIG.office.includes(n))?{id:'10',label:'Lãnh đạo Văn phòng UBND tỉnh'}:null;}
  if((people.specialists||[]).length&&people.specialists.every(n=>CONFIG.specialists.includes(n)))return {id:'8',label:'Chuyên viên'};
  return null;
}
function colorFields_(record){
  const choice=colorChoice_(Object.fromEntries(['province','office','specialists'].map(k=>[k,parsePeople_(record[Q[k]])])));
  return choice?{colorId:choice.id}:{};
}
function colorParticipants_(event){
  const lines=String(event.description||'').split(/\r?\n/);let metadata=null,known=false;
  try{metadata=decodePeople_(event.extendedProperties&&event.extendedProperties.private);}catch(ignore){}
  const people={};['province','office','specialists'].forEach(k=>{
    const line=lines.find(s=>s.trim().startsWith(Q[k]+':'));
    if(line!==undefined){people[k]=parsePeople_(line.trim().slice(Q[k].length+1));known=true;}
    else people[k]=Array.isArray(metadata)?metadata.filter(n=>n.startsWith(k+':')).map(n=>n.slice(k.length+1)):[];
  });
  return known||Array.isArray(metadata)?people:null;
}
function colorEvent_(event){return event.status==='cancelled'?null:colorChoice_(colorParticipants_(event));}
function colorLegend_(){
  const items=[{id:'11',label:'Có Chủ tịch UBND tỉnh'},...CONFIG.province.filter(n=>colorRole_(n)==='deputy').map(n=>({id:colorDeputies_()[n],label:n})),{id:'3',label:'Từ hai Phó Chủ tịch (không có Chủ tịch)'},{id:'10',label:'Chỉ lãnh đạo Văn phòng và chuyên viên'},{id:'8',label:'Chỉ chuyên viên'}];
  return items.filter(x=>COLOR_STYLE[x.id]).map(x=>({...x,...COLOR_STYLE[x.id]}));
}
function colorApply_(event,budget){
  const choice=colorEvent_(event);
  if(!choice){if(event.status!=='cancelled')budget.unclassified++;return event;}
  if(String(event.colorId||'')===choice.id){budget.matched++;return event;}
  if(!event.etag)throw Error('Chưa có phiên bản sự kiện để cập nhật màu an toàn.');
  if(budget.changed>=100||Date.now()>budget.deadline)throw Error('Đang tô màu theo từng đợt; lượt kiểm tra kế tiếp sẽ tiếp tục.');
  const updated=Calendar.Events.patch({colorId:choice.id},CONFIG.calendarId,event.id,{sendUpdates:'none'},{'If-Match':event.etag});
  budget.changed++;return updated;
}
function enableParticipantColors_(){
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const p=PropertiesService.getScriptProperties();colorMapMemo_=null;
    p.setProperty('PARTICIPANT_COLOR_MAP',JSON.stringify(colorDeputies_()));
    p.setProperty('PARTICIPANT_COLORS_ENABLED','1');
    // Replay all existing events once, then reuse incremental five-minute polling.
    p.setProperty('REVERSE_SYNC_TOKEN','');
  }finally{lock.releaseLock();}
  console.log(JSON.stringify({colors:colorLegend_()}));
  return syncCalendarToSheet_();
}
