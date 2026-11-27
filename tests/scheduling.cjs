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

Range.prototype.setNote=function(){return this};Range.prototype.setDataValidation=function(){return this};
Range.prototype.getSheet=function(){return this.s};Range.prototype.getRow=function(){return this.r};Range.prototype.getLastRow=function(){return this.r+this.n-1};Range.prototype.getColumn=function(){return this.c};Range.prototype.getLastColumn=function(){return this.c+this.m-1};
Sheet.prototype.getParent=function(){return ss};ss.getId=()=> 'test';
context.SpreadsheetApp.newDataValidation=()=>({requireValueInList(){return this},setAllowInvalid(){return this},build(){return {}}});
const installed=[];context.ScriptApp={getProjectTriggers:()=>installed,newTrigger:handler=>({forSpreadsheet(target){assert.equal(target,ss);return this},onEdit(){return this},create(){const t={getHandlerFunction:()=>handler,getUniqueId:()=> 'private-trigger'};installed.push(t);return t}})};
vm.runInContext(fs.readFileSync('apps-script/Scheduling.gs','utf8'),context);
run("CONFIG.province=['Chủ tịch UBND tỉnh A','Phó Chủ tịch UBND tỉnh B'];CONFIG.office=['Văn phòng C'];CONFIG.specialists=['Chuyên viên D'];");
const boot=context.scheduleBootstrap(),token=boot.token;cache.set('web:'+token,JSON.stringify({created:Date.now()-5000,count:0}));
const op=()=> 'w'+crypto.randomUUID().replaceAll('-','');
const data={province:['Chủ tịch UBND tỉnh A'],office:[],specialists:[],start:'2027-12-01T08:00',end:'2027-12-01T09:00',title:'Lịch A',place:'Phòng A',name:'Kiểm thử',mode:'fixed',timeNote:'',docs:'',website:''};
const a=context.scheduleSubmit(token,op(),data),b=context.scheduleSubmit(token,op(),{...data,title:'Lịch B ưu tiên'});
assert.equal(a.status,'ĐÃ LÊN LỊCH');assert.equal(b.status,'CHỜ XỬ LÝ TRÙNG LỊCH');
const sheet=ss.getSheetByName('Đăng ký từ website');context.schedulingSetup_(ss);context.schedulingSetup_(ss);assert.equal(installed.length,1);
const get=(row,key)=>sheet.rows[row-1][sheet.rows[0].indexOf(key)],put=(row,key,val)=>sheet.getRange(row,sheet.rows[0].indexOf(key)+1).setValue(val);
const action=(row,text)=>{put(row,'Thao tác xếp lịch',text);context.schedulingRun_(sheet,row)};
// Invalid/fabricated edit event is ignored.
context.sheetSchedulingOnEdit_({triggerUid:'wrong',source:ss,range:sheet.getRange(2,sheet.rows[0].indexOf('Thao tác xếp lịch')+1)});assert.equal(events.get(a.id).status,'confirmed');
// Move A to waiting with timeout after Calendar already applied the cancellation.
afterPatchError=true;action(2,'ĐƯA VỀ CHỜ');assert.equal(events.get(a.id).status,'cancelled');assert.equal(get(2,'Trạng thái xử lý'),'CHỜ XẾP LỊCH');assert.equal(get(2,'Calendar Event ID'),'');assert.ok(get(2,'Lịch sử Event ID').includes(a.id));
assert.throws(()=>context.scheduleEditLoad(token,a.editCode),/danh sách chờ/);
context.processRow_(sheet,2);assert.equal(get(2,'Trạng thái xử lý'),'CHỜ XẾP LỊCH');
// Promote B; preserve original registration and private edit capability.
// A manually changed status must not block a registration still carrying a conflict note and no event.
put(3,'Trạng thái xử lý','ĐÃ LÊN LỊCH');
action(3,'ĐẨY LÊN CALENDAR');assert.equal(get(3,'Trạng thái xử lý'),'ĐÃ LÊN LỊCH');assert.equal(events.get(b.id).status,'confirmed');assert.equal(events.get(b.id).colorId,undefined);
const inserts=insertCalls;action(3,'ĐẨY LÊN CALENDAR');assert.equal(insertCalls,inserts);
// Held A cannot displace B silently.
action(2,'ĐẨY LÊN CALENDAR');assert.equal(get(2,'Trạng thái xử lý'),'CHỜ XẾP LỊCH');assert.match(get(2,'Kết quả xếp lịch'),/trùng lịch/);assert.equal(insertCalls,inserts);
// Return B to waiting, then restore A using a fresh event ID.
action(3,'ĐƯA VỀ CHỜ');action(2,'ĐẨY LÊN CALENDAR');const restored=get(2,'Calendar Event ID');assert.notEqual(restored,a.id);assert.equal(get(2,'Mã đăng ký'),a.id);assert.equal(get(2,'Mã chỉnh sửa (giữ riêng)'),a.editCode);assert.equal(events.get(restored).status,'confirmed');assert.equal(events.get(a.id).status,'cancelled');
context.processRow_(sheet,2);assert.equal(get(2,'Calendar Event ID'),restored);assert.equal(get(2,'Trạng thái xử lý'),'ĐÃ LÊN LỊCH');assert.equal(context.scheduleEditLoad(token,a.editCode).data.title,'Lịch A');
// A Calendar write followed by a Sheet failure recovers using the persisted transaction.
failWrite=true;action(2,'ĐƯA VỀ CHỜ');assert.ok(get(2,'Giao dịch xếp lịch (JSON)'));assert.equal(events.get(restored).status,'cancelled');context.schedulingRun_(sheet,2);assert.equal(get(2,'Giao dịch xếp lịch (JSON)'),'');assert.equal(get(2,'Trạng thái xử lý'),'CHỜ XẾP LỊCH');
// Supply a new time and leave end empty: afternoon default is applied.
put(2,'Bắt đầu',new Date('2027-12-02T07:00:00Z'));put(2,'Kết thúc','');action(2,'ĐẨY LÊN CALENDAR');assert.equal(get(2,'Trạng thái xử lý'),'ĐÃ LÊN LỊCH');assert.equal(events.get(get(2,'Calendar Event ID')).end.dateTime,'2027-12-02T10:30:00.000Z');
// A simultaneous Calendar edit must never be overwritten by hold.
race=true;action(2,'ĐƯA VỀ CHỜ');context.schedulingRun_(sheet,2);assert.equal(events.get(get(2,'Calendar Event ID')).status,'confirmed');assert.match(get(2,'Kết quả xếp lịch'),/vừa thay đổi/);
// A duplicated command delivered by the installed edit trigger is safe.
const cmdCol=sheet.rows[0].indexOf('Thao tác xếp lịch')+1;put(2,'Thao tác xếp lịch','ĐƯA VỀ CHỜ');context.sheetSchedulingOnEdit_({triggerUid:'private-trigger',source:ss,range:sheet.getRange(2,cmdCol)});assert.equal(get(2,'Trạng thái xử lý'),'CHỜ XẾP LỊCH');
context.syncCalendarToSheet_();assert.equal(get(2,'Trạng thái xử lý'),'CHỜ XẾP LỊCH');assert.equal(get(3,'Trạng thái xử lý'),'CHỜ XẾP LỊCH');
const log=ss.getSheetByName('Nhật ký xếp lịch');assert.equal(new Set(log.rows.slice(1).map(r=>r[0])).size,log.rows.length-1);
console.log('Sheet scheduling checks passed: A→waiting, priority B→Calendar, conflicts, rescheduling with new Event ID, retained edit code, cancellation timeout, partial Sheet recovery, concurrency, default end, private edit trigger, reverse sync and audit idempotency.');

// Province-only conflicts, with real submission/edit/Sheet promotion paths.
const sameStaff={...data,start:'2027-12-10T08:00',end:'2027-12-10T09:00',office:['Văn phòng C'],specialists:['Chuyên viên D']};
const leaderA=context.scheduleSubmit(token,op(),{...sameStaff,title:'Leader A'});
const leaderB=context.scheduleSubmit(token,op(),{...sameStaff,title:'Leader B',province:['Phó Chủ tịch UBND tỉnh B']});
assert.equal(leaderA.status,'ĐÃ LÊN LỊCH');assert.equal(leaderB.status,'ĐÃ LÊN LỊCH');
assert.ok(events.get(leaderB.id).description.includes('Chuyên viên D'));
const sameLeader=context.scheduleSubmit(token,op(),{...sameStaff,title:'Still conflicts with A',office:[],specialists:[]});assert.equal(sameLeader.status,'CHỜ XỬ LÝ TRÙNG LỊCH');
const staffOnly=context.scheduleSubmit(token,op(),{...sameStaff,province:[],title:'Office and specialists only'});assert.equal(staffOnly.status,'ĐÃ LÊN LỊCH');
let editLoad=context.scheduleEditLoad(token,leaderB.editCode);
assert.equal(context.scheduleUpdate(token,leaderB.editCode,editLoad.revision,op(),{...editLoad.data,title:'Edited B with shared staff'}).status,'ĐÃ LÊN LỊCH');
editLoad=context.scheduleEditLoad(token,leaderB.editCode);
assert.throws(()=>context.scheduleUpdate(token,leaderB.editCode,editLoad.revision,op(),{...editLoad.data,province:['Chủ tịch UBND tỉnh A']}),/trùng lịch/);
const rowOf=id=>sheet.rows.findIndex(r=>r[sheet.rows[0].indexOf('Mã đăng ký')]===id)+1;
const bRow=rowOf(leaderB.id);action(bRow,'ĐƯA VỀ CHỜ');action(bRow,'ĐẨY LÊN CALENDAR');assert.equal(get(bRow,'Trạng thái xử lý'),'ĐÃ LÊN LỊCH');
const cRow=rowOf(sameLeader.id);put(cRow,'Lãnh đạo UBND tỉnh','');put(cRow,'Lãnh đạo Văn phòng UBND tỉnh','Văn phòng C');put(cRow,'Chuyên viên','Chuyên viên D');action(cRow,'ĐẨY LÊN CALENDAR');assert.equal(get(cRow,'Trạng thái xử lý'),'ĐÃ LÊN LỊCH');
events.set('manual-unknown',{id:'manual-unknown',summary:'Manual unknown',start:{dateTime:'2027-12-11T01:00:00Z'},end:{dateTime:'2027-12-11T02:00:00Z'}});
const unknownStaff=context.scheduleSubmit(token,op(),{...sameStaff,province:[],start:'2027-12-11T08:00',end:'2027-12-11T09:00'});assert.equal(unknownStaff.status,'ĐÃ LÊN LỊCH');
const unknownLeader=context.scheduleSubmit(token,op(),{...sameStaff,start:'2027-12-11T08:00',end:'2027-12-11T09:00'});assert.equal(unknownLeader.status,'CHỜ XỬ LÝ TRÙNG LỊCH');
console.log('Province-only integration passed: shared staff allowed, same leader blocked, staff-only allowed, edits and Sheet promotion use the same rule, participant metadata retained.');

// Explicit Sheet-only override: preserve other events, update mirrors/audit and never duplicate.
const force=run('PLAN.force');
const exception=context.scheduleSubmit(token,op(),{...sameStaff,title:'Ngoại lệ trùng Chủ tịch'}),forceRow=rowOf(exception.id);
assert.equal(exception.status,'CHỜ XỬ LÝ TRÙNG LỊCH');
const existingA=JSON.stringify(events.get(leaderA.id)),countBefore=insertCalls;
action(forceRow,'ĐẨY LÊN CALENDAR');assert.equal(insertCalls,countBefore);assert.match(get(forceRow,'Kết quả xếp lịch'),/trùng lịch/);
put(forceRow,'Lý do điều phối','Đã được lãnh đạo chấp thuận');put(forceRow,'Thao tác xếp lịch',force);
context.sheetSchedulingOnEdit_({triggerUid:'private-trigger',source:ss,range:sheet.getRange(forceRow,cmdCol)});
assert.equal(get(forceRow,'Trạng thái xử lý'),'ĐÃ LÊN LỊCH');assert.match(get(forceRow,'Kết quả xếp lịch'),/XẾP NGOẠI LỆ/);
assert.equal(get(forceRow,'Calendar Event ID'),exception.id);assert.equal(get(forceRow,'Thao tác xếp lịch'),'');assert.equal(get(forceRow,'Giao dịch xếp lịch (JSON)'),'');
assert.equal(events.get(exception.id).extendedProperties.private.schedulingConflictOverride,'true');assert.equal(JSON.stringify(events.get(leaderA.id)),existingA);
assert.match(get(forceRow,'Ghi chú xử lý'),/Đã được lãnh đạo chấp thuận/);
assert.ok(log.rows.some(r=>r[2]===exception.id&&r[4]===force&&r[5]==='Đã được lãnh đạo chấp thuận'));
const once=insertCalls;action(forceRow,force);assert.equal(insertCalls,once);
// Public payload flags cannot enable override.
const publicAttempt=context.scheduleSubmit(token,op(),{...sameStaff,force:true,ignoreConflict:true,title:'Public override forbidden'});assert.equal(publicAttempt.status,'CHỜ XỬ LÝ TRÙNG LỊCH');assert.equal(insertCalls,once);
// Missing fixed time remains invalid even for override.
const missing=context.scheduleSubmit(token,op(),{...sameStaff,mode:'flexible',start:'',end:'',title:'Chưa có ngày'});action(rowOf(missing.id),force);assert.equal(insertCalls,once);assert.match(get(rowOf(missing.id),'Kết quả xếp lịch'),/Điền Bắt đầu/);
// Calendar success followed by partial Sheet failure is recoverable by the normal maintenance poll.
const recovery=context.scheduleSubmit(token,op(),{...sameStaff,title:'Ngoại lệ khôi phục'}),recoveryRow=rowOf(recovery.id);failWrite=true;action(recoveryRow,force);
assert.ok(get(recoveryRow,'Giao dịch xếp lịch (JSON)'));assert.ok(events.has(recovery.id));const recoveryCount=insertCalls;
context.schedulingMaintenance_(ss,Date.now()+10000);assert.equal(insertCalls,recoveryCount);assert.equal(get(recoveryRow,'Trạng thái xử lý'),'ĐÃ LÊN LỊCH');assert.equal(get(recoveryRow,'Giao dịch xếp lịch (JSON)'),'');
assert.equal(log.rows.filter(r=>r[2]===recovery.id&&r[4]===force).length,1);
// A normal transaction blocked between prepare and creation can explicitly switch to the override.
const upgrade=context.scheduleSubmit(token,op(),{...sameStaff,title:'Ngoại lệ sau xung đột mới'}),upgradeRow=rowOf(upgrade.id),originalConflict=context.editConflict_;let conflictCalls=0;
context.editConflict_=()=>{if(++conflictCalls===2)throw Error('Trùng lịch sau khi chuẩn bị');};action(upgradeRow,'ĐẨY LÊN CALENDAR');context.editConflict_=originalConflict;
assert.ok(get(upgradeRow,'Giao dịch xếp lịch (JSON)'));assert.equal(events.has(upgrade.id),false);
action(upgradeRow,force);assert.equal(events.get(upgrade.id).extendedProperties.private.schedulingConflictOverride,'true');assert.equal(get(upgradeRow,'Trạng thái xử lý'),'ĐÃ LÊN LỊCH');
// Registered action handlers and helpers stay private.
for(const match of fs.readFileSync('apps-script/Scheduling.gs','utf8').matchAll(/function\s+(\w+)\(/g))assert.ok(match[1].endsWith('_'));
console.log('Exception scheduling passed: explicit private action, conflict bypass only, other events intact, status/audit, invalid dates, public flag rejection, duplicate prevention and recovery.');
