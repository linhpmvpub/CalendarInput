/* Public registration API. Availability exposes meeting titles and provincial leaders.
   Deploy as owner, access Anyone. Administrative functions must end with underscore. */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('WebRegistration').setTitle('Cổng đăng ký lịch công tác tuần UBND tỉnh Quảng Trị')
    .addMetaTag('viewport','width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function scheduleBootstrap() {
  const token=Utilities.getUuid()+Utilities.getUuid();
  CacheService.getScriptCache().put('web:'+token,JSON.stringify({created:Date.now(),count:0}),21600);
  return {token,colorLegend:colorLegend_(),province:CONFIG.province,office:CONFIG.office,specialists:CONFIG.specialists,today:Utilities.formatDate(new Date(),'Asia/Ho_Chi_Minh','yyyy-MM-dd')};
}
function webDate_(value) {
  if(typeof value!=='string'||!/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('Ngày giờ không hợp lệ.');
  const date=new Date(value+':00+07:00');
  if(!Number.isFinite(+date)||Utilities.formatDate(date,'Asia/Ho_Chi_Minh',"yyyy-MM-dd'T'HH:mm")!==value)throw Error('Ngày giờ không hợp lệ.');
  return date;
}
function defaultEnd_(start){
  const day=Utilities.formatDate(start,'Asia/Ho_Chi_Minh','yyyy-MM-dd');
  const morning=webDate_(day+'T11:30'),afternoon=webDate_(day+'T17:30');
  if(start<morning)return morning;
  if(start<afternoon)return afternoon;
  throw Error('Lịch bắt đầu từ 17h30 trở đi cần nhập giờ kết thúc.');
}
function webRecord_(data) {
  if(!data||typeof data!=='object'||data.website)throw Error('Không thể tiếp nhận đăng ký.');
  const record={};
  ['province','office','specialists'].forEach(k=>{
    if(!Array.isArray(data[k])||data[k].length>CONFIG[k].length||data[k].some(n=>typeof n!=='string'||!CONFIG[k].includes(n)))throw Error('Thành phần không hợp lệ.');
    record[Q[k]]=[...new Set(data[k])].join(', ');
  });
  ['place','title','docs'].forEach(k=>{
    if(typeof data[k]!=='string'||data[k].length>(k==='title'?5000:k==='docs'?2000:300))throw Error('Thông tin quá dài hoặc không hợp lệ.');
    record[Q[k]]=data[k].trim();
  });
  if(typeof data.name!=='string'||!data.name.trim()||data.name.length>120)throw Error('Vui lòng ghi tên người đăng ký (tối đa 120 ký tự).');
  if(!['fixed','flexible'].includes(data.mode))throw Error('Vui lòng chọn loại thời gian.');
  if(typeof data.timeNote!=='string'||data.timeNote.length>500)throw Error('Gợi ý thời gian tối đa 500 ký tự.');
  record['Người đăng ký']=data.name.trim();record[Q.contact]=data.name.trim();record[Q.unit]='';
  record['Loại thời gian']=data.mode==='flexible'?'Chưa cố định ngày':'Ngày giờ cụ thể';
  record['Gợi ý thời gian']=data.timeNote.trim();
  record[Q.start]=data.mode==='flexible'?'':webDate_(data.start);
  if(data.mode==='fixed'&&typeof data.end!=='string')throw Error('Giờ kết thúc không hợp lệ.');
  const estimated=data.mode==='fixed'&&data.end==='';
  record[Q.end]=data.mode==='flexible'?'':estimated?defaultEnd_(record[Q.start]):webDate_(data.end);
  record['Cách xác định giờ kết thúc']=estimated?'Mặc định hết buổi':data.mode==='flexible'?'':'Đã xác định';
  validate_(record);return record;
}
function scheduleSubmit(token,requestId,data) {
  if(typeof token!=='string'||token.length!==72||typeof requestId!=='string'||!/^w[a-f0-9]{32}$/.test(requestId))throw Error('Phiên đăng ký không hợp lệ. Hãy tải lại trang.');
  const record=webRecord_(data);
  const cache=CacheService.getScriptCache(),key='web:'+token;
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  let sheet,row,editCode;
  try {
    const session=JSON.parse(cache.get(key)||'null');
    if(!session||Date.now()-session.created<1500)throw Error('Phiên đã hết hạn hoặc chưa sẵn sàng. Hãy tải lại trang.');
    const ss=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
    sheet=ss.getSheetByName('Đăng ký từ website');
    const required=['Dấu thời gian',...Object.values(Q),...META,'Người đăng ký','Loại thời gian','Gợi ý thời gian','Cách xác định giờ kết thúc'];
    if(!sheet){sheet=ss.insertSheet('Đăng ký từ website');sheet.setFrozenRows(1);}
    let headers=sheet.getLastRow()?sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0]:[];
    required.forEach(h=>{if(!headers.includes(h))headers.push(h);});
    if(headers.length>sheet.getMaxColumns())sheet.insertColumnsAfter(sheet.getMaxColumns(),headers.length-sheet.getMaxColumns());
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
    // Include the server-issued token in the ID; clients cannot guess another session's registration ID.
    const id='a'+Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,token+requestId).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('').slice(0,40);
    const idColumn=headers.indexOf(META[0])+1;
    const match=sheet.getLastRow()>1?sheet.getRange(2,idColumn,sheet.getLastRow()-1,1).createTextFinder(id).matchEntireCell(true).findNext():null;
    if(match)row=match.getRow();
    else {
      if(session.count>=20)throw Error('Đã đạt giới hạn đăng ký trong phiên. Vui lòng thử lại sau.');
      const p=PropertiesService.getScriptProperties(),day=Utilities.formatDate(new Date(),'Asia/Ho_Chi_Minh','yyyy-MM-dd');
      const budget=JSON.parse(p.getProperty('WEB_DAILY_COUNT')||'{}');
      const count=budget.day===day?Number(budget.count)||0:0;
      if(count>=300)throw Error('Hệ thống đã đạt giới hạn 300 đăng ký hôm nay. Vui lòng liên hệ bộ phận tổng hợp.');
      session.count++;cache.put(key,JSON.stringify(session),21600);
      p.setProperty('WEB_DAILY_COUNT',JSON.stringify({day,count:count+1}));
      record['Dấu thời gian']=new Date();record[META[0]]=id;record[META[1]]='ĐANG XỬ LÝ';
      row=sheet.getLastRow()+1;
      sheet.getRange(row,1,1,headers.length).setValues([headers.map(h=>record[h] instanceof Date?record[h]:safe_(record[h]||''))]);
      [Q.start,Q.end,'Dấu thời gian'].forEach(h=>sheet.getRange(row,headers.indexOf(h)+1).setNumberFormat('dd/MM/yyyy HH:mm'));
      SpreadsheetApp.flush();
    }
    editCode=ensureEditCode_(sheet,row);
  } finally {lock.releaseLock();}
  try {processRow_(sheet,row);}catch(e){console.error('Web submission processing failed: '+String(e));}
  const h=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0],v=sheet.getRange(row,1,1,h.length).getValues()[0];
  return {id:String(v[h.indexOf(META[0])]),status:String(v[h.indexOf(META[1])]),editCode};
}

function scheduleAvailability(day,selection) {
  const start=webDate_(day+'T00:00'),end=new Date(+start+7*86400000);
  if(!selection||typeof selection!=='object')throw Error('Thành phần không hợp lệ.');
  const people=[];
  ['province','office','specialists'].forEach(k=>{
    if(!Array.isArray(selection[k])||selection[k].length>CONFIG[k].length||selection[k].some(n=>!CONFIG[k].includes(n)))throw Error('Thành phần không hợp lệ.');
    [...new Set(selection[k])].forEach(n=>people.push(k+':'+n));
  });
  const busy=[];let pageToken,pages=0;
  do{
    const result=Calendar.Events.list(CONFIG.calendarId,{timeMin:start.toISOString(),timeMax:end.toISOString(),singleEvents:true,showDeleted:false,maxResults:2500,timeZone:'Asia/Ho_Chi_Minh',...(pageToken?{pageToken}:{})});
    for(const e of result.items||[]){
      if(e.status==='cancelled'||e.transparency==='transparent')continue;
      const currentPeople=colorParticipants_(e),others=currentPeople?Object.entries(currentPeople).flatMap(([k,names])=>names.map(n=>k+':'+n)):null;
      if(people.length&&others&&!people.some(p=>others.includes(p)))continue;
      const a=e.start.dateTime?new Date(e.start.dateTime):webDate_(e.start.date+'T00:00');
      const b=e.end.dateTime?new Date(e.end.dateTime):webDate_(e.end.date+'T00:00');
      if(!Number.isFinite(+a)||!Number.isFinite(+b)||b<=a)throw Error('Chưa đọc đủ dữ liệu lịch. Vui lòng thử lại.');
      const props=e.extendedProperties&&e.extendedProperties.private||{};
      const province=Array.isArray(others)?CONFIG.province.filter(n=>others.includes('province:'+n)):[];
      // Legacy/manual events: only read the explicit provincial-leaders line.
      if(!others){
        const line=String(e.description||'').split(/\r?\n/).find(s=>s.startsWith(Q.province+':'));
        if(line){const names=parsePeople_(line.slice(Q.province.length+1));CONFIG.province.forEach(n=>{if(names.includes(n))province.push(n);});}
      }
      const color=colorEvent_(e);
      busy.push({color:color?{...color,...COLOR_STYLE[color.id]}:null,start:a.toISOString(),end:b.toISOString(),title:String(e.summary||'(Chưa có nội dung)').slice(0,5000),province,participantsKnown:Array.isArray(others)||province.length>0,endEstimated:props.endEstimated==='true',allDay:!e.start.dateTime});
    }
    pageToken=result.nextPageToken;pages++;
    if(pageToken&&pages>=4)throw Error('Lịch có quá nhiều sự kiện. Vui lòng liên hệ bộ phận tổng hợp.');
  }while(pageToken);
  return {day,busy,updatedAt:new Date().toISOString(),filtered:people.length>0};
}
