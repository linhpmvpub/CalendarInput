/* Public registration API. No API permits reading existing registrations or modifying events.
   Deploy as owner, access Anyone. Administrative functions must end with underscore. */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('WebRegistration').setTitle('Đăng ký lịch làm việc')
    .addMetaTag('viewport','width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function scheduleBootstrap() {
  const token=Utilities.getUuid()+Utilities.getUuid();
  CacheService.getScriptCache().put('web:'+token,JSON.stringify({created:Date.now(),count:0}),21600);
  return {token,province:CONFIG.province,office:CONFIG.office,specialists:CONFIG.specialists};
}
function webDate_(value) {
  if(typeof value!=='string'||!/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('Ngày giờ không hợp lệ.');
  const date=new Date(value+':00+07:00');
  if(!Number.isFinite(+date)||Utilities.formatDate(date,'Asia/Ho_Chi_Minh',"yyyy-MM-dd'T'HH:mm")!==value)throw Error('Ngày giờ không hợp lệ.');
  return date;
}
function webRecord_(data) {
  if(!data||typeof data!=='object'||data.website)throw Error('Không thể tiếp nhận đăng ký.');
  const record={};
  ['province','office','specialists'].forEach(k=>{
    if(!Array.isArray(data[k])||data[k].length>CONFIG[k].length||data[k].some(n=>typeof n!=='string'||!CONFIG[k].includes(n)))throw Error('Thành phần không hợp lệ.');
    record[Q[k]]=[...new Set(data[k])].join(', ');
  });
  ['unit','contact','place','title','docs'].forEach(k=>{
    if(typeof data[k]!=='string'||data[k].length>(k==='title'?5000:k==='docs'?2000:300))throw Error('Thông tin quá dài hoặc không hợp lệ.');
    record[Q[k]]=data[k].trim();
  });
  record[Q.start]=webDate_(data.start);record[Q.end]=webDate_(data.end);
  validate_(record);return record;
}
function scheduleSubmit(token,requestId,data) {
  if(typeof token!=='string'||token.length!==72||typeof requestId!=='string'||!/^w[a-f0-9]{32}$/.test(requestId))throw Error('Phiên đăng ký không hợp lệ. Hãy tải lại trang.');
  const record=webRecord_(data);
  const cache=CacheService.getScriptCache(),key='web:'+token;
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  let sheet,row;
  try {
    const session=JSON.parse(cache.get(key)||'null');
    if(!session||Date.now()-session.created<1500)throw Error('Phiên đã hết hạn hoặc chưa sẵn sàng. Hãy tải lại trang.');
    const ss=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
    sheet=ss.getSheetByName('Đăng ký từ website');
    const headers=['Dấu thời gian',...Object.values(Q),...META];
    if(!sheet){sheet=ss.insertSheet('Đăng ký từ website');sheet.getRange(1,1,1,headers.length).setValues([headers]);sheet.setFrozenRows(1);}
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
  } finally {lock.releaseLock();}
  try {processRow_(sheet,row);}catch(e){console.error('Web submission processing failed: '+String(e));}
  const h=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0],v=sheet.getRange(row,1,1,h.length).getValues()[0];
  return {id:String(v[h.indexOf(META[0])]),status:String(v[h.indexOf(META[1])])};
}
