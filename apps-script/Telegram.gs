/* Telegram notifications. All workers/helpers are private; setup RPCs require an admin session.
   Credentials stay in Script Properties. State/outbox contain only allowlisted schedule fields.
   Delivery is retried; a network timeout after Telegram accepts a message can cause a duplicate. */
const TG={state:'Trạng thái thông báo',outbox:'Nhật ký thông báo Telegram',handler:'telegramWorker_',url:'https://linhpmvpub.github.io/CalendarInput/',tz:'Asia/Ho_Chi_Minh'};
function tgProps_(){return PropertiesService.getScriptProperties();}
function tgConfig_(){return JSON.parse(tgProps_().getProperty('TELEGRAM_CONFIG')||'{}');}
function tgSave_(c){tgProps_().setProperty('TELEGRAM_CONFIG',JSON.stringify(c));}
function tgHash_(v){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(v)).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');}
function tgText_(v,n=6000){return reverseText_(v).slice(0,n);}
function tgDate_(v){if(!v)return '';const d=new Date(v);return Number.isFinite(+d)?d.toISOString():'';}
function tgDisplayDate_(v){return v?Utilities.formatDate(new Date(v),TG.tz,'dd/MM/yyyy HH:mm'):'Chưa cố định';}
function tgApi_(token,method,payload){
  if(!/^\d{5,16}:[A-Za-z0-9_-]{20,100}$/.test(token||''))throw Error('Khóa bot không hợp lệ.');
  let response,data;try{response=UrlFetchApp.fetch('https://api.telegram.org/bot'+token+'/'+method,{method:'post',contentType:'application/json',payload:JSON.stringify(payload||{}),muteHttpExceptions:true});data=JSON.parse(response.getContentText());}catch(e){throw Error('Chưa kết nối được Telegram. Sẽ thử lại; kiểm tra quyền kết nối dịch vụ ngoài trong Apps Script.');}
  if(response.getResponseCode()!==200||!data.ok){const code=Number(data.error_code||response.getResponseCode()),e=Error('Telegram trả lỗi '+code+(code===401?': khóa bot không đúng.':code===403?': hãy mở bot và bỏ chặn.':code===409?': bot đang được ứng dụng khác sử dụng.':'.'));e.retryAfter=Number(data.parameters?.retry_after)||0;e.code=code;throw e;}
  return data.result;
}
function tgTable_(ss,name,headers){let s=ss.getSheetByName(name);if(!s){s=ss.insertSheet(name);s.getRange(1,1,1,headers.length).setValues([headers]);s.setFrozenRows(1);}return s;}
function tgStore_(ss){
  const state=tgTable_(ss,TG.state,['Khóa lịch','Bản hiện tại (JSON)','Lần thay đổi']);
  const outbox=tgTable_(ss,TG.outbox,['Mã thông báo','Ghi nhận lúc','Nội dung','Trạng thái','Số lần gửi','Thử lại lúc','Đã gửi lúc','Kết quả','Người nhận','Phiên kết nối']);
  const states=new Map();if(state.getLastRow()>1)state.getDataRange().getValues().slice(1).forEach((r,i)=>{if(r[0])states.set(String(r[0]),{row:i+2,data:JSON.parse(r[1]),seq:Number(r[2])||0});});
  const queue=outbox.getLastRow()>1?outbox.getDataRange().getValues().slice(1):[];
  return {state,outbox,states,ids:new Set(queue.map(r=>String(r[0]))),queue};
}
function tgRegistrations_(ss){
  const items=[],linked=new Set();
  ss.getSheets().forEach(sheet=>{
    if(!sheet.getLastRow()||[TG.state,TG.outbox].includes(sheet.getName()))return;
    const rows=sheet.getDataRange().getValues(),h=rows[0];if(![...Object.values(Q),...META].every(k=>h.includes(k)))return;
    rows.slice(1).forEach(row=>{
      const r=Object.fromEntries(h.map((k,i)=>[k,row[i]])),id=String(r[META[0]]||''),eventId=String(r[META[2]]||'');
      if(eventId)linked.add(eventId);try{JSON.parse(r['Lịch sử Event ID']||'[]').forEach(x=>linked.add(x));}catch(ignore){}
      if(!id||/KIỂM THỬ|ĐANG XỬ LÝ/.test(String(r[META[1]]))||r['Giao dịch xếp lịch (JSON)']||r['Giao dịch chỉnh sửa'])return;
      const mirror=!!eventId&&!!r['Dấu đồng bộ Calendar'],people=mirror?tgText_(r['Thành phần trên Calendar']):['province','office','specialists'].map(k=>r[Q[k]]?Q[k]+': '+tgText_(r[Q[k]]):'').filter(Boolean).join('\n');
      items.push({key:'r:'+id,data:{title:tgText_(mirror?r['Nội dung trên Calendar']:r[Q.title]),start:tgDate_(mirror?r['Bắt đầu trên Calendar']:r[Q.start]),end:tgDate_(mirror?r['Kết thúc trên Calendar']:r[Q.end]),place:tgText_(mirror?r['Địa điểm trên Calendar']:r[Q.place],600),people,status:tgText_(r[META[1]],150),eventId,name:tgText_(r['Người đăng ký']||r[Q.contact],150),note:tgText_(r['Gợi ý thời gian'],300)}});
    });
  });
  const health=ss.getSheetByName('Theo dõi đồng bộ');if(health&&health.getLastRow()>=3){const ok=String(health.getRange(3,2).getValues()[0][0]).startsWith('THÀNH CÔNG');items.push({key:'system:sync',data:{title:'Đồng bộ Calendar và Google Sheet',start:'',end:'',place:'',people:'',status:ok?'ĐỒNG BỘ BÌNH THƯỜNG':'LỖI ĐỒNG BỘ',eventId:'',name:'',note:''}});}
  return {items,linked};
}
function tgKind_(before,after,key){
  if(key==='system:sync')return after.status==='LỖI ĐỒNG BỘ'?'CẦN KIỂM TRA ĐỒNG BỘ':'ĐỒNG BỘ ĐÃ KHÔI PHỤC';
  if(!before)return key.startsWith('r:')?'ĐĂNG KÝ MỚI':'LỊCH MỚI TRÊN CALENDAR';
  if(/HỦY/.test(after.status)&&after.status!==before.status)return 'ĐÃ HỦY LỊCH';
  if(before.eventId&&!after.eventId)return 'CHUYỂN VỀ CHỜ XẾP LỊCH';
  if((!before.eventId&&after.eventId)||(/CHỜ|LỖI|HỦY/.test(before.status)&&after.status==='ĐÃ LÊN LỊCH'))return 'ĐÃ ĐẨY LÊN CALENDAR';
  if(/LỖI|KHÔNG TÌM THẤY/.test(after.status)&&before.status!==after.status)return 'CẦN KIỂM TRA ĐỒNG BỘ';
  return 'ĐIỀU CHỈNH LỊCH';
}
function tgMessage_(key,before,after,seq){
  const lines=[tgKind_(before,after,key),after.title||before?.title||'(Chưa có nội dung)','Bắt đầu: '+tgDisplayDate_(after.start),'Trạng thái: '+after.status];
  if(after.place)lines.push('Địa điểm: '+after.place);if(after.people)lines.push(after.people);if(after.name)lines.push('Đăng ký: '+after.name);
  if(before){const fields={title:'Nội dung',start:'Bắt đầu',end:'Kết thúc',place:'Địa điểm',people:'Thành phần',status:'Trạng thái',note:'Gợi ý thời gian'};const changes=[];Object.keys(fields).forEach(k=>{if(before[k]!==after[k]){const fmt=v=>k==='start'||k==='end'?tgDisplayDate_(v):String(v||'—');changes.push(fields[k]+': '+fmt(before[k]).slice(0,300)+' → '+fmt(after[k]).slice(0,300));}});if(changes.length)lines.push('Thay đổi:\n'+changes.join('\n'));}
  return lines.join('\n').slice(0,2800)+'\nMã: '+key.slice(0,45)+' / '+seq;
}
function tgObserve_(store,items,c,baseline){
  items.forEach(({key,data})=>{
    const old=store.states.get(key);if(old&&tgHash_(old.data)===tgHash_(data))return;
    const seq=(old?.seq||0)+1,id=tgHash_([c.generation,key,seq,data]);
    if(!baseline&&!store.ids.has(id)){
      const row=[id,new Date(),tgMessage_(key,old?.data,data,seq),'CHỜ GỬI',0,'','','',c.chatId,c.generation];
      store.outbox.getRange(store.outbox.getLastRow()+1,1,1,row.length).setValues([row.map(reverseCell_)]);SpreadsheetApp.flush();store.ids.add(id);
    }
    // Cursor follows the durable outbox write; replay uses the same message ID.
    const row=old?.row||store.state.getLastRow()+1;store.state.getRange(row,1,1,3).setValues([[key,JSON.stringify(data),seq]]);store.states.set(key,{row,data,seq});
  });
}
function tgCalendar_(linked,token){
  const items=[];let pageToken,nextToken,pages=0;
  do{if(++pages>30)throw Error('Calendar có quá nhiều trang; chưa cập nhật mốc thông báo.');
    const r=Calendar.Events.list(CONFIG.calendarId,{maxResults:2500,showDeleted:true,singleEvents:false,...(token?{syncToken:token}:{}),...(pageToken?{pageToken}:{})});
    (r.items||[]).forEach(e=>{if(linked.has(e.id))return;items.push(e);});pageToken=r.nextPageToken;nextToken=r.nextSyncToken;
  }while(pageToken);if(!nextToken)throw Error('Calendar chưa trả mốc thông báo.');return {items,nextToken};
}
function tgCalendarObserve_(store,raw,c,baseline){
  const items=[];raw.forEach(e=>{const key='c:'+e.id,old=store.states.get(key)?.data;
    if(e.status==='cancelled'){if(old)items.push({key,data:{...old,status:'ĐÃ HỦY TRÊN CALENDAR'}});return;}
    items.push({key,data:{title:tgText_(e.summary),start:tgDate_(e.start?.dateTime||e.start?.date&&e.start.date+'T00:00:00+07:00'),end:tgDate_(e.end?.dateTime||e.end?.date&&e.end.date+'T00:00:00+07:00'),place:tgText_(e.location,600),people:tgText_(reverseParticipants_(e)),status:'ĐÃ LÊN LỊCH',eventId:e.id,name:'',note:e.recurrence?e.recurrence.join('; '):''}});
  });tgObserve_(store,items,c,baseline);
}
function tgCaptureSafe_(){try{tgCapture_();}catch(e){console.error('Telegram: chưa ghi nhận thay đổi; sẽ thử lại.');}}
function tgCapture_(){
  if(!tgConfig_().enabled)return;const lock=LockService.getScriptLock();if(!lock.tryLock(500))return;
  try{const c=tgConfig_();if(!c.enabled)return;const ss=SpreadsheetApp.openById(tgProps_().getProperty('SHEET_ID'));tgObserve_(tgStore_(ss),tgRegistrations_(ss).items,c,false);SpreadsheetApp.flush();}
  catch(e){tgProps_().setProperty('TELEGRAM_HEALTH','Chưa ghi nhận đủ thay đổi; hệ thống sẽ kiểm tra lại.');}
  finally{lock.releaseLock();}
}
function telegramWorker_(){
  if(!tgConfig_().enabled)return;
  tgCapture_();const lock=LockService.getScriptLock();let batch=[],c,store,lease;
  if(!lock.tryLock(500))return;
  try{
    c=tgConfig_();if(!c.enabled)return;const p=tgProps_();if(Number(p.getProperty('TELEGRAM_SEND_LEASE')||0)>Date.now())return;
    const ss=SpreadsheetApp.openById(p.getProperty('SHEET_ID'));store=tgStore_(ss);
    if(Date.now()-Number(p.getProperty('TELEGRAM_CAL_AT')||0)>300000){
      try{let delta;try{delta=tgCalendar_(tgRegistrations_(ss).linked,p.getProperty('TELEGRAM_CAL_TOKEN'));}catch(e){if(/410|fullSyncRequired/i.test(String(e)))delta=tgCalendar_(tgRegistrations_(ss).linked,null);else throw e;}
        tgCalendarObserve_(store,delta.items,c,false);p.setProperty('TELEGRAM_CAL_TOKEN',delta.nextToken);p.setProperty('TELEGRAM_CAL_AT',String(Date.now()));
      }catch(e){p.setProperty('TELEGRAM_HEALTH','Chưa đọc đủ Calendar; giữ mốc cũ và thử lại.');}
    }
    // Reload because the Calendar scan may have appended notifications.
    store=tgStore_(ss);let length=0;store.queue.forEach((r,i)=>{if(batch.length>=10||r[3]==='ĐÃ GỬI'||String(r[8])!==String(c.chatId)||r[9]!==c.generation||Number(r[5]||0)>Date.now())return;const text=reverseText_(r[2]);if(length+text.length+10>3500)return;batch.push({row:i+2,id:r[0],text,attempts:Number(r[4])||0});length+=text.length+10;});
    if(!batch.length)return;lease=String(Date.now()+240000);p.setProperty('TELEGRAM_SEND_LEASE',lease);
  }finally{lock.releaseLock();}
  if(!batch.length)return;
  let error=null,result;try{result=tgApi_(tgProps_().getProperty('TELEGRAM_BOT_TOKEN'),'sendMessage',{chat_id:c.chatId,text:batch.map(x=>x.text).join('\n\n———\n\n'),link_preview_options:{is_disabled:true},reply_markup:{inline_keyboard:[[{text:'Mở lịch tuần',url:TG.url}]]}});}catch(e){error=e;}
  lock.waitLock(10000);try{batch.forEach(item=>{const attempt=item.attempts+1,next=error?Date.now()+Math.max(Number(error.retryAfter||0)*1000,Math.min(3600000,60000*Math.pow(2,Math.min(attempt-1,6)))):0;store.outbox.getRange(item.row,4,1,5).setValues([[error?'CHỜ THỬ LẠI':'ĐÃ GỬI',attempt,next,error?'':new Date(),error?error.message:'Telegram message '+result.message_id]]);});SpreadsheetApp.flush();tgProps_().setProperty('TELEGRAM_HEALTH',error?error.message:'Đã gửi lúc '+Utilities.formatDate(new Date(),TG.tz,'dd/MM/yyyy HH:mm'));if(tgProps_().getProperty('TELEGRAM_SEND_LEASE')===lease)tgProps_().deleteProperty('TELEGRAM_SEND_LEASE');}finally{lock.releaseLock();}
}
function prepareTelegram_(){
  // Run once by the project owner to authorize the external request scope before web setup.
  UrlFetchApp.fetch('https://api.telegram.org',{muteHttpExceptions:true});
  const found=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()===TG.handler);
  if(!found.length)ScriptApp.newTrigger(TG.handler).timeBased().everyMinutes(1).create();
  found.slice(1).forEach(t=>ScriptApp.deleteTrigger(t));return 'Telegram đã sẵn sàng. Kết nối bot trong Quản trị lịch.';
}
function scheduleTelegramStatus(token,ticket){
  adminSession_(token,ticket);const c=tgConfig_();return {configured:!!c.username,enabled:!!c.enabled,username:c.username||'',recipient:c.recipient||'',health:tgProps_().getProperty('TELEGRAM_HEALTH')||'',pairUrl:c.pair&&c.pairExpires>Date.now()?'https://t.me/'+c.username+'?start='+c.pair:''};
}
function scheduleTelegramSetup(token,ticket,botToken){
  adminSession_(token,ticket);if(typeof botToken!=='string')throw Error('Nhập khóa bot.');botToken=botToken.trim();
  const me=tgApi_(botToken,'getMe',{}),hook=tgApi_(botToken,'getWebhookInfo',{});if(hook.url)throw Error('Bot đang kết nối ứng dụng khác. Hãy tạo bot riêng cho lịch công tác.');
  if(!/^[A-Za-z0-9_]{5,64}$/.test(me.username||''))throw Error('Bot chưa có tên hợp lệ.');
  const lock=LockService.getScriptLock();lock.waitLock(10000);try{adminSession_(token,ticket);if(Number(tgProps_().getProperty('TELEGRAM_SEND_LEASE')||0)>Date.now())throw Error('Đang gửi thông báo. Thử lại sau ít phút.');
    const c={username:me.username,pair:Utilities.getUuid().replace(/-/g,''),pairExpires:Date.now()+900000,enabled:false,generation:Utilities.getUuid()};tgProps_().setProperty('TELEGRAM_BOT_TOKEN',botToken);tgSave_(c);tgProps_().deleteProperty('TELEGRAM_PAIR_OFFSET');
  }finally{lock.releaseLock();}return scheduleTelegramStatus(token,ticket);
}
function scheduleTelegramConnect(token,ticket){
  adminSession_(token,ticket);const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{const c=tgConfig_(),p=tgProps_();if(c.enabled)return scheduleTelegramStatus(token,ticket);if(!c.pair||c.pairExpires<Date.now())throw Error('Liên kết đã hết hạn. Nhập lại khóa bot để tạo liên kết mới.');
    const updates=tgApi_(p.getProperty('TELEGRAM_BOT_TOKEN'),'getUpdates',{offset:Number(p.getProperty('TELEGRAM_PAIR_OFFSET')||0),limit:100,timeout:0,allowed_updates:['message']});
    const candidates=updates.map(u=>u.message).filter(m=>m?.chat?.type==='private'&&m.from?.id===m.chat.id&&m.text==='/start '+c.pair&&m.date*1000>=c.pairExpires-900000);
    if(updates.length)p.setProperty('TELEGRAM_PAIR_OFFSET',String(Math.max(...updates.map(u=>u.update_id))+1));
    if(!candidates.length)throw Error('Chưa nhận được Start từ liên kết. Mở liên kết Telegram, bấm Start rồi thử lại.');
    const ids=[...new Set(candidates.map(m=>String(m.chat.id)))];if(ids.length!==1)throw Error('Liên kết được dùng bởi nhiều tài khoản. Hãy tạo lại liên kết riêng.');
    c.chatId=ids[0];c.recipient=tgText_(candidates[0].chat.first_name||'Tài khoản cá nhân',100);
    const ss=SpreadsheetApp.openById(p.getProperty('SHEET_ID')),store=tgStore_(ss),regs=tgRegistrations_(ss),calendar=tgCalendar_(regs.linked,null);
    tgObserve_(store,regs.items,c,true);tgCalendarObserve_(store,calendar.items,c,true);SpreadsheetApp.flush();p.setProperty('TELEGRAM_CAL_TOKEN',calendar.nextToken);p.setProperty('TELEGRAM_CAL_AT',String(Date.now()));
    const found=ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()===TG.handler);if(!found)ScriptApp.newTrigger(TG.handler).timeBased().everyMinutes(1).create();
    tgApi_(p.getProperty('TELEGRAM_BOT_TOKEN'),'sendMessage',{chat_id:c.chatId,text:'Đã kết nối thông báo lịch công tác UBND tỉnh Quảng Trị. Chỉ gửi thay đổi phát sinh từ lúc kết nối; không gửi lại lịch cũ.',link_preview_options:{is_disabled:true}});
    c.enabled=true;delete c.pair;delete c.pairExpires;tgSave_(c);p.setProperty('TELEGRAM_HEALTH','Đã kết nối và gửi tin xác nhận.');
  }finally{lock.releaseLock();}return scheduleTelegramStatus(token,ticket);
}
function scheduleTelegramStop(token,ticket){
  adminSession_(token,ticket);const lock=LockService.getScriptLock();lock.waitLock(10000);try{if(Number(tgProps_().getProperty('TELEGRAM_SEND_LEASE')||0)>Date.now())throw Error('Đang gửi thông báo. Thử lại sau ít phút.');const c=tgConfig_();c.enabled=false;delete c.pair;tgSave_(c);tgProps_().deleteProperty('TELEGRAM_BOT_TOKEN');}finally{lock.releaseLock();}return scheduleTelegramStatus(token,ticket);
}
