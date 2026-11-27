/* Private Calendar -> weekly publication view. Uses the existing 5-minute trigger.
   Calendar is authoritative; this module NEVER writes to Calendar or registration tabs. */
const WR={name:'Lịch công tác tuần',tz:'Asia/Ho_Chi_Minh',initialWeek:'2026-11-30',firstRow:7,version:'1',maxPages:10,maxMs:90000};
function weeklyDay_(date){return Utilities.formatDate(date,WR.tz,'yyyy-MM-dd');}
function weeklyMidnight_(day){const d=new Date(day+'T00:00:00+07:00');if(!Number.isFinite(+d))throw Error('Ngày không hợp lệ.');return d;}
function weeklyAddDay_(day,n){return weeklyDay_(new Date(+weeklyMidnight_(day)+n*86400000));}
function weeklyWeek_(value){
  let day;if(value instanceof Date&&Number.isFinite(+value))day=weeklyDay_(value);
  else{const s=String(value||'').trim(),m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);day=m?m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'):s;}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||weeklyDay_(weeklyMidnight_(day))!==day)throw Error('Ô C3 cần là một ngày hợp lệ, ví dụ 30/11/2026.');
  const weekday=new Date(day+'T12:00:00Z').getUTCDay();return weeklyAddDay_(day,-((weekday+6)%7));
}
function weeklyPlain_(value){return String(value||'').replace(/<br\s*\/?\s*>|<\/p>|<\/div>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&#39;/g,"'").replace(/&quot;/gi,'"').trim();}
function weeklyPeople_(event){
  const clean={...event,description:weeklyPlain_(event.description)},base=colorParticipants_(clean)||{province:[],office:[],specialists:[]};
  const aliases={province:['Lãnh đạo UBND tỉnh','LĐ UBND tỉnh'],office:['Lãnh đạo Văn phòng UBND tỉnh','LĐVP','LĐ VP'],specialists:['Chuyên viên','CV']};
  const lines=clean.description.split(/\r?\n/);
  Object.keys(aliases).forEach(k=>{for(const alias of aliases[k]){const line=lines.find(l=>l.trim().toLocaleLowerCase('vi').startsWith(alias.toLocaleLowerCase('vi')+':'));if(line!==undefined){base[k]=parsePeople_(line.trim().slice(alias.length+1));break;}}});
  return base;
}
function weeklyFetch_(start,deadline){
  let pageToken,items=[],pages=0;
  do{
    if(Date.now()>deadline||++pages>WR.maxPages)throw Error('Chưa đọc hết lịch tuần; giữ bản đã cập nhật trước đó.');
    const result=Calendar.Events.list(CONFIG.calendarId,{timeMin:weeklyMidnight_(start).toISOString(),timeMax:weeklyMidnight_(weeklyAddDay_(start,7)).toISOString(),singleEvents:true,showDeleted:false,orderBy:'startTime',timeZone:WR.tz,maxResults:2500,...(pageToken?{pageToken}:{})});
    items=items.concat(result.items||[]);pageToken=result.nextPageToken;
  }while(pageToken);
  const unique=new Map();items.filter(e=>e.status!=='cancelled').forEach(e=>unique.set(e.id,e));return [...unique.values()];
}
function weeklyEvent_(event){
  const start=reverseDate_(event.start),end=reverseDate_(event.end);
  if(!(start instanceof Date)||!(end instanceof Date)||+end<=+start)throw Error('Lịch có thời gian không hợp lệ: '+String(event.summary||event.id).slice(0,120));
  const people=weeklyPeople_(event),title=weeklyPlain_(event.summary)||'(Chưa có nội dung)',provincialTitle=/\bPCT(?:TT)?\b|Chủ tịch|Phó Chủ tịch/i.test(title);
  // Unknown manual events stay in the main section; only explicit office-only events are separated.
  return {event,start,end,people,title,allDay:!!event.start.date,officeOnly:people.office.length>0&&!people.province.length&&!provincialTitle};
}
function weeklyModel_(events,week){
  const rows=[],notes=[],merges=[],dayGroups=[],sectionRows=[];
  const normalized=events.filter(e=>e.status!=='cancelled').map(weeklyEvent_).sort((a,b)=>+a.start-+b.start||a.title.localeCompare(b.title,'vi')||String(a.event.id).localeCompare(String(b.event.id)));
  const weekdays=['Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy','Chủ nhật'];
  const add=(r,n)=>{rows.push(r);notes.push(n||['','','','','']);};
  function section(items,office){
    if(office){sectionRows.push(rows.length);add(['Lịch riêng lãnh đạo Văn phòng UBND tỉnh','','','','']);merges.push({row:rows.length-1,col:0,rows:1,cols:5});}
    for(let d=0;d<7;d++){
      const day=weeklyAddDay_(week,d),from=+weeklyMidnight_(day),to=from+86400000,dayStart=rows.length;
      const todays=items.filter(e=>+e.start<to&&+e.end>from);
      if(office&&!todays.length)continue;
      const groups=[['Cả ngày',0,24,true],['Sáng',0,12,false],['Chiều',12,18,false],['Tối',18,24,false]];
      groups.forEach(([label,a,b,allDay])=>{
        const list=todays.filter(e=>e.allDay===allDay&&(allDay||+e.start<from+b*3600000&&+e.end>from+a*3600000));
        if(!list.length&&(allDay||label==='Tối'||office))return;
        const groupStart=rows.length;
        if(!list.length)add(['',label,'—','','']);
        list.forEach((e,i)=>{
          const time=e.allDay?'Cả ngày':Utilities.formatDate(new Date(Math.max(+e.start,from)),WR.tz,"HH'h'mm")+'–'+(+e.end>=to?'24h00':Utilities.formatDate(e.end,WR.tz,"HH'h'mm"));
          const names=e.people.province,missingNames=names.length&&!names.every(n=>e.title.toLocaleLowerCase('vi').includes(n.toLocaleLowerCase('vi')));
          const content=time+': '+e.title+(missingNames?'\nLãnh đạo UBND tỉnh: '+names.join(', '):'');
          const attendees=[e.people.office.length?'LĐVP: '+e.people.office.join(', '):'',e.people.specialists.length?'CV: '+e.people.specialists.join(', '):''].filter(Boolean).join('\n');
          const note='Nguồn: Google Calendar\nMã sự kiện: '+e.event.id+(e.event.htmlLink?'\n'+e.event.htmlLink:'')+'\n'+(e.allDay?'Lịch cả ngày':Utilities.formatDate(e.start,WR.tz,'dd/MM/yyyy HH:mm')+' → '+Utilities.formatDate(e.end,WR.tz,'dd/MM/yyyy HH:mm'));
          add(['',i?'':label,content,weeklyPlain_(e.event.location),attendees],['','',note,'',attendees?'Thành phần đọc từ mô tả/metadata của Calendar.':'Calendar chưa ghi rõ LĐVP/Chuyên viên; không tự suy đoán.']);
        });
        if(rows.length-groupStart>1)merges.push({row:groupStart,col:1,rows:rows.length-groupStart,cols:1});
      });
      if(rows.length>dayStart){rows[dayStart][0]=weekdays[d]+'\n'+Utilities.formatDate(weeklyMidnight_(day),WR.tz,'dd/MM/yyyy');dayGroups.push({row:dayStart,rows:rows.length-dayStart,day:d});if(rows.length-dayStart>1)merges.push({row:dayStart,col:0,rows:rows.length-dayStart,cols:1});}
    }
  }
  section(normalized.filter(e=>!e.officeOnly),false);
  const office=normalized.filter(e=>e.officeOnly);if(office.length)section(office,true);
  return {rows,notes,merges,dayGroups,sectionRows,count:normalized.length,week};
}
function weeklySheet_(ss){
  const p=PropertiesService.getScriptProperties(),id=p.getProperty('WEEKLY_REPORT_SHEET_ID');
  let sheet=id?ss.getSheets().find(s=>String(s.getSheetId())===id):null;
  if(!sheet){
    if(ss.getSheetByName(WR.name))throw Error('Tab '+WR.name+' đã tồn tại nhưng chưa được nhận diện là tab tự đồng bộ.');
    sheet=ss.insertSheet(WR.name);p.setProperty('WEEKLY_REPORT_SHEET_ID',String(sheet.getSheetId()));['WEEKLY_REPORT_HASH','WEEKLY_REPORT_LAYOUT','WEEKLY_REPORT_ROWS','WEEKLY_REPORT_LAST_OK'].forEach(k=>p.deleteProperty(k));
  }
  if(p.getProperty('WEEKLY_REPORT_LAYOUT')!==WR.version){
    sheet.getRange('A1:E1').merge().setValue('LỊCH CÔNG TÁC CỦA LÃNH ĐẠO UBND TỈNH,\nLÃNH ĐẠO VĂN PHÒNG UBND TỈNH').setFontFamily('Times New Roman').setFontSize(15).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true).setBackground('#e7f2ef');
    sheet.getRange('A2:E2').merge().setHorizontalAlignment('center').setFontFamily('Times New Roman').setFontSize(12).setFontWeight('bold');
    sheet.getRange('A3:B3').merge().setValue('Tuần cần xem:').setFontWeight('bold');
    if(!sheet.getRange('C3').getValue())sheet.getRange('C3').setValue(weeklyMidnight_(WR.initialWeek));
    sheet.getRange('C3').setNumberFormat('dd/MM/yyyy').setBackground('#fff2cc').setFontColor('#174ea6').setFontWeight('bold').setNote('Nhập một ngày trong tuần muốn xem. Hệ thống tự tính từ thứ hai đến chủ nhật và làm mới mỗi 5 phút.').setDataValidation(SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false).build());
    sheet.getRange('D3:E3').merge().setValue('← Đổi ngày để xem tuần khác').setFontColor('#52656c');
    sheet.getRange('A4:E4').merge().setFontSize(10).setWrap(true);
    sheet.getRange('A5:E5').merge().setValue('Tự cập nhật từ Calendar mỗi 5 phút • Sửa lịch trên Calendar; nội dung bảng này được tự làm mới.').setFontSize(10).setFontColor('#52656c').setWrap(true);
    sheet.getRange('A6:B6').merge();sheet.getRange('A6:E6').setValues([['Thời gian','','Nội dung','Địa điểm','LĐVP + Chuyên viên']]).setBackground('#176b64').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle').setFontFamily('Arial').setFontSize(11);
    [115,65,430,205,250].forEach((w,i)=>sheet.setColumnWidth(i+1,w));sheet.setRowHeight(1,56);sheet.setRowHeight(2,28);sheet.setRowHeight(3,30);sheet.setRowHeight(4,30);sheet.setRowHeight(5,30);sheet.setRowHeight(6,32);sheet.setFrozenRows(6);sheet.setHiddenGridlines(true);sheet.setTabColor('#176b64');
    p.setProperty('WEEKLY_REPORT_LAYOUT',WR.version);
  }
  return sheet;
}
function weeklyRender_(sheet,model){
  const p=PropertiesService.getScriptProperties(),old=Number(p.getProperty('WEEKLY_REPORT_ROWS')||0),n=model.rows.length,extent=Math.max(old,n);
  if(extent+WR.firstRow-1>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),extent+WR.firstRow-1-sheet.getMaxRows());
  if(extent){const area=sheet.getRange(WR.firstRow,1,extent,5);area.breakApart();area.clearContent();area.clearNote();area.clearFormat();}
  const body=sheet.getRange(WR.firstRow,1,n,5);body.setValues(model.rows.map(r=>r.map(reverseCell_))).setNotes(model.notes).setFontFamily('Times New Roman').setFontSize(12).setFontColor('#172a32').setWrap(true).setVerticalAlignment('top').setBorder(true,true,true,true,true,true,'#c1ccce',SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(WR.firstRow,1,n,2).setHorizontalAlignment('center').setVerticalAlignment('middle').setFontWeight('bold');
  const backgrounds=model.rows.map(()=>Array(5).fill('#ffffff'));
  model.dayGroups.forEach(g=>{for(let i=g.row;i<g.row+g.rows;i++)backgrounds[i]=Array(5).fill(g.day%2?'#f2f7f6':'#ffffff');});body.setBackgrounds(backgrounds);
  model.sectionRows.forEach(r=>sheet.getRange(WR.firstRow+r,1,1,5).setBackground('#dcefe8').setFontWeight('bold'));
  // Explicit heights: Google auto-resize does not reliably expand rows containing merged cells.
  model.rows.forEach((row,i)=>{
    const lengths=[12,7,46,22,27],lines=row.map((v,j)=>String(v).split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil(line.length/lengths[j])),0));
    sheet.setRowHeight(WR.firstRow+i,Math.max(48,Math.max(...lines)*20+14));
  });
  model.merges.forEach(m=>sheet.getRange(WR.firstRow+m.row,m.col+1,m.rows,m.cols).merge());
  sheet.getRange('A2').setValue('Từ ngày '+Utilities.formatDate(weeklyMidnight_(model.week),WR.tz,'dd/MM/yyyy')+' đến ngày '+Utilities.formatDate(weeklyMidnight_(weeklyAddDay_(model.week,6)),WR.tz,'dd/MM/yyyy'));
  SpreadsheetApp.flush();p.setProperty('WEEKLY_REPORT_ROWS',String(n));
}
function weeklyReportRefresh_(ss){
  const p=PropertiesService.getScriptProperties(),lock=LockService.getScriptLock(),lease=String(Date.now());
  if(!lock.tryLock(500))return;
  let acquired=false;try{if(Date.now()-Number(p.getProperty('WEEKLY_REPORT_LEASE')||0)<180000)return;p.setProperty('WEEKLY_REPORT_LEASE',lease);acquired=true;}finally{lock.releaseLock();}
  if(!acquired)return;
  let sheet;
  try{
    sheet=weeklySheet_(ss);const selected=sheet.getRange('C3').getValue(),week=weeklyWeek_(selected),events=weeklyFetch_(week,Date.now()+WR.maxMs),model=weeklyModel_(events,week);
    // Do not publish a stale week if the user changed the date during the API read.
    if(weeklyWeek_(sheet.getRange('C3').getValue())!==week)return;
    const hash=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,WR.version+JSON.stringify(model)).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');
    if(p.getProperty('WEEKLY_REPORT_HASH')!==hash){weeklyRender_(sheet,model);p.setProperty('WEEKLY_REPORT_HASH',hash);}
    const now=new Date();sheet.getRange('A4').setValue('Cập nhật thành công: '+Utilities.formatDate(now,WR.tz,'dd/MM/yyyy HH:mm:ss')+' • '+model.count+' sự kiện • Giờ Việt Nam').setFontColor('#176b64');p.setProperty('WEEKLY_REPORT_LAST_OK',now.toISOString());
    console.log('Weekly report: '+week+', '+model.count+' events');
  }catch(e){
    console.error('Weekly report: '+String(e));
    if(sheet)try{const last=p.getProperty('WEEKLY_REPORT_LAST_OK');sheet.getRange('A4').setValue(reverseCell_('CHƯA CẬP NHẬT: '+String(e).slice(0,220)+(last?' • Thành công gần nhất: '+Utilities.formatDate(new Date(last),WR.tz,'dd/MM HH:mm'):''))).setFontColor('#b3261e');}catch(ignore){}
  }finally{if(p.getProperty('WEEKLY_REPORT_LEASE')===lease)p.deleteProperty('WEEKLY_REPORT_LEASE');}
}
