const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
let failWrite=false;
class Range{constructor(s,r,c,n=1,m=1){Object.assign(this,{s,r,c,n,m});}getValues(){return Array.from({length:this.n},(_,i)=>Array.from({length:this.m},(_,j)=>this.s.rows[this.r-1+i]?.[this.c-1+j]??''));}setValues(v){if(failWrite&&this.r>1&&this.s.name==='Đăng ký từ website'&&this.s.rows[0][this.c-1]==='Nội dung'){failWrite=false;throw Error('Sheet unavailable');}v.forEach((line,i)=>{this.s.rows[this.r-1+i]??=[];line.forEach((x,j)=>this.s.rows[this.r-1+i][this.c-1+j]=x);});return this;}setValue(v){return this.setValues([[v]]);}setNumberFormat(){return this;}setFontWeight(){return this;}setBackground(){return this;}setWrap(){return this;}createTextFinder(value){const range=this;return {matchEntireCell(){return this;},findNext(){for(let i=range.r-1;i<range.r-1+range.n;i++)if(range.s.rows[i]?.[range.c-1]===value)return {getRow:()=>i+1};return null;}};}}
class Sheet{constructor(name){this.name=name;this.rows=[];this.maxColumns=26;}getName(){return this.name;}getLastRow(){return this.rows.length;}getLastColumn(){return Math.max(0,...this.rows.map(r=>r.length));}getMaxRows(){return 1000;}getMaxColumns(){return this.maxColumns;}insertColumnsAfter(c,n){this.maxColumns+=n;}getRange(...a){return new Range(this,...a);}getDataRange(){return this.getRange(1,1,this.getLastRow(),this.getLastColumn());}setFrozenRows(){}setColumnWidth(){}}
const sheets=[],cache=new Map(),props=new Map([['SHEET_ID','test']]),events=new Map();let etag=0,patchCalls=0,insertCalls=0,afterPatchError=false,race=false;
const ss={getSheets:()=>sheets,getSheetByName:n=>sheets.find(s=>s.name===n),insertSheet:n=>{const s=new Sheet(n);sheets.push(s);return s;}};
const cp=x=>JSON.parse(JSON.stringify(x));
const api={get(cal,id){if(!events.has(id))throw Error('404 Not Found');return cp(events.get(id));},list(cal,args){return {items:[...events.values()].filter(e=>e.status!=='cancelled'&&(!args.timeMin||+new Date(e.end.dateTime)>+new Date(args.timeMin)&&+new Date(e.start.dateTime)<+new Date(args.timeMax))).map(cp),nextSyncToken:'cursor'};},insert(resource){insertCalls++;if(events.has(resource.id))throw Error('409 already exists');const event={...cp(resource),status:'confirmed',etag:'e'+(++etag),updated:new Date().toISOString()};events.set(event.id,event);return cp(event);},patch(resource,cal,id,opts,headers){patchCalls++;assert.equal(opts.sendUpdates,'none');const event=events.get(id);if(race){race=false;event.etag='e'+(++etag);event.summary='Edited elsewhere';}if(headers['If-Match']!==event.etag)throw Error('412 Precondition Failed');Object.assign(event,cp(resource),{etag:'e'+(++etag),updated:new Date().toISOString()});if(afterPatchError){afterPatchError=false;throw Error('Timeout after apply');}return cp(event);}};
const context={assert,console,Date,Map,Set,JSON,Calendar:{Events:api},Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(a,s)=>[...crypto.createHash(a).update(s).digest()],newBlob:s=>({getBytes:()=>Buffer.from(s)}),formatDate:(d,tz,pattern)=>{const x=new Date(+d+7*3600000).toISOString();return pattern==='yyyy-MM-dd'?x.slice(0,10):pattern==='HH:mm'?x.slice(11,16):x.slice(0,16);}},SpreadsheetApp:{openById:()=>ss,flush(){}},CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)})},LockService:{getUserLock:()=>({waitLock(){},releaseLock(){}}),getScriptLock:()=>({waitLock(){},tryLock:()=>true,releaseLock(){}})}};
vm.createContext(context);vm.runInContext(['Code','Web','ReverseSync','Edit'].map(f=>fs.readFileSync('apps-script/'+f+'.gs','utf8')).join('\n'),context);const run=s=>vm.runInContext(s,context);
run("CONFIG.province=['Nguyễn A','Nguyễn B'];CONFIG.office=['Trần B'];CONFIG.specialists=['Lê C'];");
const boot=context.scheduleBootstrap();cache.set('web:'+boot.token,JSON.stringify({created:Date.now()-5000,count:0}));const token=boot.token;
const data={province:['Nguyễn A'],office:[],specialists:[],start:'2026-12-01T08:00',end:'2026-12-01T09:00',title:'Họp',place:'Phòng A',name:'Linh',mode:'fixed',timeNote:'',docs:'',website:''},op=()=> 'w'+crypto.randomUUID().replaceAll('-','');
const first=context.scheduleSubmit(token,op(),data);assert.equal(first.status,'ĐÃ LÊN LỊCH');assert.match(first.editCode,/^[a-f0-9]+\.[a-f0-9]{64}$/);assert.equal(events.size,1);
assert.throws(()=>context.scheduleEditLoad(token,first.id),/Mã chỉnh sửa/);assert.throws(()=>context.scheduleEditLoad(token,first.editCode.slice(0,-1)+'z'),/Mã chỉnh sửa/);assert.throws(()=>context.scheduleEditLoad('x'.repeat(72),first.editCode),/Phiên/);
let load=context.scheduleEditLoad(token,first.editCode);assert.equal(load.data.title,'Họp');const operation=op(),changed={...data,title:'=Họp đã sửa',place:'Phòng B',province:['Nguyễn B'],end:''};
let result=context.scheduleUpdate(token,first.editCode,load.revision,operation,changed);assert.equal(result.updated,true);assert.equal(insertCalls,1);assert.equal(patchCalls,1);assert.equal(events.get(first.id).summary,'=Họp đã sửa');assert.equal(events.get(first.id).end.dateTime,'2026-12-01T04:30:00.000Z');
const sheet=ss.getSheetByName('Đăng ký từ website'),get=(name,row=1)=>sheet.rows[row][sheet.rows[0].indexOf(name)];assert.equal(get('Nội dung'),"'=Họp đã sửa");assert.equal(JSON.parse(get('Đăng ký ban đầu (JSON)'))['Nội dung'],'Họp');assert.equal(get('Nội dung trên Calendar'),"'=Họp đã sửa");assert.equal(get('Giao dịch chỉnh sửa'),'');
context.scheduleUpdate(token,first.editCode,load.revision,operation,changed);assert.equal(patchCalls,1);assert.equal(ss.getSheetByName('Nhật ký chỉnh sửa').rows.length,2);
assert.throws(()=>context.scheduleUpdate(token,first.editCode,load.revision,op(),data),/đã được thay đổi/);
load=context.scheduleEditLoad(token,first.editCode);events.get(first.id).summary='Sửa trực tiếp';events.get(first.id).etag='external';assert.throws(()=>context.scheduleUpdate(token,first.editCode,load.revision,op(),data),/đã được thay đổi/);
load=context.scheduleEditLoad(token,first.editCode);assert.equal(load.data.title,'Sửa trực tiếp');race=true;assert.throws(()=>context.scheduleUpdate(token,first.editCode,load.revision,op(),data),/vừa thay đổi/);assert.equal(events.get(first.id).summary,'Edited elsewhere');assert.equal(get('Giao dịch chỉnh sửa'),'');
load=context.scheduleEditLoad(token,first.editCode);events.set('other',{id:'other',summary:'Other',start:{dateTime:'2026-12-02T01:00:00Z'},end:{dateTime:'2026-12-02T05:00:00Z'},description:'Lãnh đạo UBND tỉnh: Nguyễn A'});const before=events.get(first.id).summary;assert.throws(()=>context.scheduleUpdate(token,first.editCode,load.revision,op(),{...data,start:'2026-12-02T08:00',end:''}),/trùng lịch/);assert.equal(events.get(first.id).summary,before);
assert.throws(()=>context.scheduleUpdate(token,first.editCode,load.revision,op(),{...data,mode:'flexible'}),/giữ ngày giờ/);
// Unknown Calendar description lines, attachments and unrelated event settings survive a patch.
events.get(first.id).description+='\nGhi chú quản trị: giữ nguyên';events.get(first.id).colorId='4';events.get(first.id).attachments=[{fileUrl:'https://example.test/document'}];events.get(first.id).etag='manual';load=context.scheduleEditLoad(token,first.editCode);afterPatchError=true;
context.scheduleUpdate(token,first.editCode,load.revision,op(),{...load.data,title:'Sửa sau timeout'});assert.match(events.get(first.id).description,/Ghi chú quản trị: giữ nguyên/);assert.equal(events.get(first.id).colorId,'4');assert.equal(events.get(first.id).attachments.length,1);
// Calendar succeeds, Sheet fails. Same request recovers without a second Calendar mutation.
load=context.scheduleEditLoad(token,first.editCode);const recoverOp=op(),recoverData={...load.data,title:'Khôi phục ghi Sheet'};failWrite=true;assert.throws(()=>context.scheduleUpdate(token,first.editCode,load.revision,recoverOp,recoverData),/Sheet unavailable/);const priorCalls=patchCalls;
context.scheduleUpdate(token,first.editCode,load.revision,recoverOp,recoverData);assert.equal(patchCalls,priorCalls);assert.equal(get('Nội dung'),'Khôi phục ghi Sheet');assert.equal(get('Giao dịch chỉnh sửa'),'');
// Pending registrations remain editable and can be given their first fixed date.
const flexible=context.scheduleSubmit(token,op(),{...data,mode:'flexible',start:'',end:'',title:'Chờ ngày'});assert.equal(flexible.status,'CHỜ XẾP NGÀY');load=context.scheduleEditLoad(token,flexible.editCode);assert.equal(load.scheduled,false);
context.scheduleUpdate(token,flexible.editCode,load.revision,op(),{...load.data,title:'Chờ ngày đã sửa',timeNote:'Tuần sau'});load=context.scheduleEditLoad(token,flexible.editCode);assert.equal(load.data.timeNote,'Tuần sau');
context.scheduleUpdate(token,flexible.editCode,load.revision,op(),{...load.data,mode:'fixed',start:'2026-12-03T14:00',end:''});assert.equal(events.get(flexible.id).end.dateTime,'2026-12-03T10:30:00.000Z');assert.equal(insertCalls,2);
// Cancelled events cannot be revived by editing.
events.get(flexible.id).status='cancelled';assert.throws(()=>context.scheduleEditLoad(token,flexible.editCode),/đã bị hủy/);assert.equal(insertCalls,2);
// Existing registration IDs alone cannot edit; migration is private and idempotent.
const key=get('Mã chỉnh sửa (giữ riêng)');const enabled=context.enableRegistrationEditing_();assert.equal(enabled.enabled,2);assert.equal(get('Mã chỉnh sửa (giữ riêng)'),key);
// Original Google Form tabs do not have website-specific fields. Migration adds them before editing.
const legacy=new Sheet('Câu trả lời biểu mẫu 1'),lh=run('[...Object.values(Q),...META]'),legacyId='b'.repeat(32);legacy.rows=[lh,lh.map(n=>({'Lãnh đạo UBND tỉnh':'Nguyễn A','Nội dung':'Đăng ký cũ','Địa điểm':'Phòng cũ','Người liên hệ':'Linh','Đơn vị đăng ký':'Văn phòng','Mã đăng ký':legacyId,'Trạng thái xử lý':'CHỜ XỬ LÝ TRÙNG LỊCH','Bắt đầu':new Date('2026-12-08T01:00:00Z'),'Kết thúc':new Date('2026-12-08T02:00:00Z')}[n]||''))];sheets.push(legacy);context.enableRegistrationEditing_();const legacyCode=legacy.rows[1][legacy.rows[0].indexOf('Mã chỉnh sửa (giữ riêng)')];load=context.scheduleEditLoad(token,legacyCode);context.scheduleUpdate(token,legacyCode,load.revision,op(),{...load.data,title:'Đã sửa đăng ký cũ'});assert.equal(events.get(legacyId).summary,'Đã sửa đăng ký cũ');assert.equal(legacy.rows[1][legacy.rows[0].indexOf('Đơn vị đăng ký')],'Văn phòng');assert.equal(legacy.rows[1][legacy.rows[0].indexOf('Người đăng ký')],'Linh');
console.log('Editing tests passed: private codes, fixed/flexible edits, default end, conflict exclusion, If-Match concurrency, audit, API timeout and partial-Sheet recovery, cancelled events.');

// Lead/support roles survive Sheet, Calendar, edits and report output; legacy names aren't promoted.
run("CONFIG.specialists=['Lê C','Trần D','Nguyễn E'];");
const rolesData={...data,province:[],specialists:[],specialistLead:['Nguyễn E'],specialistSupport:['Lê C','Trần D'],start:'2026-12-10T08:00',end:'2026-12-10T09:00'};
assert.throws(()=>context.webRecord_({...rolesData,specialistLead:['Lê C','Trần D']}),/không hợp lệ/);
assert.throws(()=>context.webRecord_({...rolesData,specialistLead:['Ngoài danh sách']}),/không hợp lệ/);
assert.throws(()=>context.webRecord_({...rolesData,specialistSupport:['Nguyễn E']}),/đồng thời/);
assert.throws(()=>context.webRecord_({...rolesData,specialistLead:'Nguyễn E'}),/không hợp lệ/);
const roles=context.scheduleSubmit(token,op(),rolesData),row=sheet.rows.findIndex(r=>r[sheet.rows[0].indexOf('Mã đăng ký')]===roles.id);
assert.equal(get('Chuyên viên',row),'Nguyễn E, Lê C, Trần D');assert.equal(get('Chuyên viên chủ trì',row),'Nguyễn E');assert.equal(get('Chuyên viên phối hợp',row),'Lê C, Trần D');
assert.match(events.get(roles.id).description,/Chuyên viên: Nguyễn E, Lê C, Trần D/);
assert.match(events.get(roles.id).description,/Chuyên viên chủ trì: Nguyễn E/);
load=context.scheduleEditLoad(token,roles.editCode);assert.deepEqual([...load.data.specialistLead],['Nguyễn E']);assert.deepEqual([...load.data.specialistSupport],['Lê C','Trần D']);
context.scheduleUpdate(token,roles.editCode,load.revision,op(),{...load.data,specialistLead:['Trần D'],specialistSupport:['Nguyễn E','Lê C']});
assert.equal(get('Chuyên viên',row),'Trần D, Nguyễn E, Lê C');assert.equal(get('Chuyên viên chủ trì',row),'Trần D');
load=context.scheduleEditLoad(token,roles.editCode);assert.deepEqual([...load.data.specialistLead],['Trần D']);
vm.runInContext(fs.readFileSync('apps-script/WeeklyReport.gs','utf8'),context);
assert.deepEqual([...context.weeklyPeople_(events.get(roles.id)).specialists],['Trần D','Nguyễn E','Lê C']);
const legacyRoles=context.editData_({'Chuyên viên':'Lê C, Trần D'},null);
assert.deepEqual([...legacyRoles.specialistLead],[]);assert.deepEqual([...legacyRoles.specialistSupport],['Lê C','Trần D']);
// Removing lead preserves the other people, and explicit blank roles override stale stored roles.
load=context.scheduleEditLoad(token,roles.editCode);context.scheduleUpdate(token,roles.editCode,load.revision,op(),{...load.data,specialistLead:[],specialistSupport:['Lê C']});
assert.equal(get('Chuyên viên chủ trì',row),'');assert.equal(get('Chuyên viên',row),'Lê C');
assert.deepEqual([...context.scheduleEditLoad(token,roles.editCode).data.specialistLead],[]);
console.log('Specialist role tests passed: selection limits, duplicate rejection, submit/edit ordering, Calendar, weekly report and legacy compatibility.');

// Privileged sessions: auth, isolation, lifetime, held edits and recovery.
context.CacheService.getScriptCache=()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)});
const adminPassword='test-only-not-production',secret={salt:crypto.randomUUID(),hash:''};secret.hash=context.editHash_(secret.salt+':'+adminPassword);props.set('ADMIN_EDIT_SECRET',JSON.stringify(secret));
assert.throws(()=>context.scheduleAdminList(token,'',{}),/Phiên quản trị/);
assert.throws(()=>context.scheduleAdminLoad(token,'',first.id),/Phiên quản trị/);
assert.throws(()=>context.scheduleAdminUpdate(token,'',first.id,load.revision,op(),data),/Phiên quản trị/);
assert.throws(()=>context.scheduleAdminLogin(token,'wrong'),/không đúng/);
const admin=context.scheduleAdminLogin(token,adminPassword),ticket=admin.ticket;
assert.equal(ticket.length,72);assert.ok(admin.expires>Date.now());
const otherToken=context.scheduleBootstrap().token;assert.throws(()=>context.scheduleAdminList(otherToken,ticket,{}),/hết hạn/);
let adminList=context.scheduleAdminList(token,ticket,{scope:'all'});assert.ok(adminList.items.some(i=>i.id===first.id));assert.ok(!JSON.stringify(adminList).includes(first.editCode));assert.ok(!JSON.stringify(adminList).includes(adminPassword));
assert.equal(context.scheduleAdminList(token,ticket,{scope:'all',query:'zzzz-no-result'}).total,0);
let adminLoad=context.scheduleAdminLoad(token,ticket,first.id);assert.equal(adminLoad.admin,true);assert.equal(adminLoad.editCode,undefined);
const beforeAdmin=patchCalls;
const adminResult=context.scheduleAdminUpdate(token,ticket,first.id,adminLoad.revision,op(),{...adminLoad.data,title:'Admin edited existing'});
assert.equal(adminResult.editCode,undefined);assert.equal(adminResult.admin,true);assert.equal(patchCalls,beforeAdmin+1);assert.equal(events.get(first.id).summary,'Admin edited existing');
const audit=ss.getSheetByName('Nhật ký chỉnh sửa');assert.equal(audit.rows.at(-1)[audit.rows[0].indexOf('Vai trò chỉnh sửa')],'QUẢN TRỊ');
assert.throws(()=>context.scheduleAdminUpdate(token,ticket,first.id,adminLoad.revision,op(),adminLoad.data),/đã được thay đổi/);
assert.throws(()=>context.scheduleEditLoad(token,ticket),/Mã chỉnh sửa/);
context.schedulingGuard_=r=>{if(r['Trạng thái điều phối']==='ĐANG CHỜ')throw Error('đang chờ');};
const held=context.scheduleSubmit(token,op(),{...data,mode:'flexible',start:'',end:'',title:'Held'}),heldRow=sheet.rows.findIndex(r=>r[sheet.rows[0].indexOf('Mã đăng ký')]===held.id);
context.reverseHeaders_(sheet,['Trạng thái điều phối','Giao dịch xếp lịch (JSON)']);sheet.rows[heldRow][sheet.rows[0].indexOf('Trạng thái điều phối')]='ĐANG CHỜ';sheet.rows[heldRow][sheet.rows[0].indexOf('Trạng thái xử lý')]='CHỜ XẾP LỊCH';
assert.throws(()=>context.scheduleEditLoad(token,held.editCode),/đang chờ/);
adminLoad=context.scheduleAdminLoad(token,ticket,held.id);const heldInserts=insertCalls;
let heldResult=context.scheduleAdminUpdate(token,ticket,held.id,adminLoad.revision,op(),{...adminLoad.data,title:'Held revised',mode:'fixed',start:'2026-12-02T08:00',end:''});
assert.equal(heldResult.status,'CHỜ XẾP LỊCH');assert.equal(insertCalls,heldInserts);assert.equal(get('Trạng thái điều phối',heldRow),'ĐANG CHỜ');assert.equal(get('Nội dung',heldRow),'Held revised');assert.ok(context.scheduleAdminList(token,ticket,{scope:'waiting'}).items.some(i=>i.id===held.id));
adminLoad=context.scheduleAdminLoad(token,ticket,held.id);const heldOp=op(),heldData={...adminLoad.data,title:'Held recovered'};failWrite=true;
assert.throws(()=>context.scheduleAdminUpdate(token,ticket,held.id,adminLoad.revision,heldOp,heldData),/Sheet unavailable/);
context.scheduleAdminUpdate(token,ticket,held.id,adminLoad.revision,heldOp,heldData);assert.equal(get('Nội dung',heldRow),'Held recovered');assert.equal(insertCalls,heldInserts);
adminLoad=context.scheduleAdminLoad(token,ticket,first.id);
assert.throws(()=>context.scheduleAdminUpdate(token,ticket,first.id,adminLoad.revision,op(),{...adminLoad.data,province:['Nguyễn A'],start:'2026-12-02T08:00',end:''}),/trùng lịch/);
assert.throws(()=>context.scheduleAdminUpdate(token,ticket,first.id,adminLoad.revision,op(),{...adminLoad.data,province:['fake']}),/không hợp lệ/);
const sessionKey='admin:'+context.editHash_(ticket),savedSession=cache.get(sessionKey);cache.set(sessionKey,JSON.stringify({...JSON.parse(savedSession),expires:Date.now()-1}));
assert.throws(()=>context.scheduleAdminLoad(token,ticket,first.id),/hết hạn/);cache.set(sessionKey,savedSession);
props.set('ADMIN_EDIT_SECRET',JSON.stringify({...secret,hash:'0'.repeat(64)}));assert.throws(()=>context.scheduleAdminList(token,ticket,{}),/hết hạn/);props.set('ADMIN_EDIT_SECRET',JSON.stringify(secret));
context.scheduleAdminLogout(token,ticket);assert.throws(()=>context.scheduleAdminList(token,ticket,{}),/hết hạn/);
const attackToken=context.scheduleBootstrap().token;for(let i=0;i<5;i++)assert.throws(()=>context.scheduleAdminLogin(attackToken,'wrong'),/không đúng/);assert.throws(()=>context.scheduleAdminLogin(attackToken,adminPassword),/15 phút/);
console.log('Admin tests passed: authentication, session binding/expiry/revocation, throttling, code isolation, audit/conflicts, held edits and recovery.');

// Performance contract: one authenticated compact snapshot, zero Sheet/Calendar
// reads for a warm list/search, and row hints always checked against the actual ID.
const perfLogin=context.scheduleAdminLogin(token,adminPassword),perfTicket=perfLogin.ticket;
assert.ok(perfLogin.index.items.length);assert.equal(perfLogin.index.items[0].row,undefined);
let sheetReads=0,calendarReads=0,readRanges=[];
const savedGetValues=Range.prototype.getValues,savedList=api.list,savedGet=api.get;
Range.prototype.getValues=function(){sheetReads++;readRanges.push(this);return savedGetValues.call(this);};
api.list=function(...a){calendarReads++;return savedList.apply(this,a);};api.get=function(...a){calendarReads++;return savedGet.apply(this,a);};
context.adminInvalidate_();const cold=context.scheduleAdminSnapshot(token,perfTicket,false),coldReads=sheetReads;
assert.ok(coldReads>0);assert.equal(calendarReads,0);
const privateCols=['Mã chỉnh sửa (giữ riêng)','Đăng ký ban đầu (JSON)','Giao dịch chỉnh sửa','Giao dịch xếp lịch (JSON)'];
for(const r of readRanges.filter(r=>r.r>1))for(const col of privateCols){const i=r.s.rows[0].indexOf(col);if(i>=0)assert.ok(i<r.c-1||i>=r.c-1+r.m,'List must not read '+col);}
sheetReads=0;context.scheduleAdminSnapshot(token,perfTicket,false);context.scheduleAdminList(token,perfTicket,{scope:'all',query:'admin'});assert.equal(sheetReads,0);assert.equal(calendarReads,0);
assert.throws(()=>context.scheduleAdminSnapshot(otherToken,perfTicket,false),/hết hạn/);assert.equal(sheetReads,0);
// A row sort after caching cannot cause an edit of the wrong row.
const oldRows=[...sheet.rows];[sheet.rows[1],sheet.rows[2]]=[sheet.rows[2],sheet.rows[1]];
assert.equal(context.scheduleAdminLoad(token,perfTicket,first.id).id,first.id);sheet.rows=oldRows;
// Saving invalidates other sessions' index and returns an immediate canonical UI summary.
adminLoad=context.scheduleAdminLoad(token,perfTicket,first.id);const freshTitle='Admin index refreshed';
const updatedIndex=context.scheduleAdminUpdate(token,perfTicket,first.id,adminLoad.revision,op(),{...adminLoad.data,title:freshTitle});assert.equal(updatedIndex.item.title,freshTitle);assert.equal(updatedIndex.item.row,undefined);
assert.equal(context.adminIndexRead_(),null);assert.equal(context.scheduleAdminSnapshot(token,perfTicket,false).items.find(i=>i.id===first.id).title,freshTitle);
// Evicted cache chunks rebuild safely; manual refresh sees direct Sheet changes.
const manifest=JSON.parse(cache.get('admin-index:manifest'));cache.delete('admin-index:'+manifest.id+':0');assert.ok(context.scheduleAdminSnapshot(token,perfTicket,false).items.length);
const heldTitleCol=sheet.rows[0].indexOf('Nội dung');sheet.rows[heldRow][heldTitleCol]='Direct Sheet edit';assert.equal(context.scheduleAdminSnapshot(token,perfTicket,true).items.find(i=>i.id===held.id).title,'Direct Sheet edit');
Range.prototype.getValues=savedGetValues;api.list=savedList;api.get=savedGet;
// Exercise the exact client filter, without a server or DOM dependency.
const html=fs.readFileSync('apps-script/WebRegistration.html','utf8'),filterSource=html.slice(html.indexOf('function adminFilteredItems('),html.indexOf('function renderAdminList('));
const client={};vm.createContext(client);vm.runInContext("const normalize=t=>t.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/đ/g,'d');\n"+filterSource,client);
const fixture=[{id:'1',title:'Họp Đông Hà',province:'Nguyễn A',status:'ĐÃ LÊN LỊCH',sheet:'Web',start:'2026-12-01T08:00',end:'2026-12-01T09:00',scheduled:true},{id:'2',title:'Chờ bố trí',province:'Nguyễn B',status:'CHỜ XẾP LỊCH',sheet:'Web',scheduled:false},{id:'3',title:'Cũ',province:'Nguyễn A',status:'ĐÃ LÊN LỊCH',sheet:'Web',start:'2026-10-01T08:00',end:'2026-10-01T09:00',scheduled:true}];
assert.deepEqual([...client.adminFilteredItems(fixture,'dong ha','all','2026-11-27')].map(i=>i.id),['1']);assert.deepEqual([...client.adminFilteredItems(fixture,'','waiting','2026-11-27')].map(i=>i.id),['2']);assert.equal(client.adminFilteredItems(fixture,'','current','2026-11-27').length,2);
const handlers=html.slice(html.indexOf("$('admin-filter').onsubmit"),html.indexOf("$('admin-logout').onclick"));assert.ok(!handlers.includes('scheduleAdminList'));assert.match(handlers,/oninput=.*renderAdminList/);
console.log('Fast admin tests passed: cold summary reads='+coldReads+', warm list/search=0 Sheet and 0 Calendar reads; authenticated cache, safe row hints, invalidation, refresh, and client search.');
