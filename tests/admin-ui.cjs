// Run the shipped frontend and its real login/list/edit/save callbacks with an
// in-memory DOM/RPC adapter. No production credentials or appointments are used.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const html=fs.readFileSync('apps-script/WebRegistration.html','utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const nodes=new Map(),all=[];
class Element{
 constructor(tag='div'){this.tagName=tag;this.children=[];this.dataset={};this.value='';this.hidden=false;this.disabled=false;this.checked=false;this.textContent='';this.classList={add(){},toggle(){}};all.push(this);}
 set id(id){this._id=id;nodes.set(id,this);}get id(){return this._id;}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}
 setAttribute(k,v){this[k]=v;}removeAttribute(k){delete this[k];}addEventListener(){}scrollIntoView(){}focus(){}select(){}
 querySelectorAll(sel){if(sel==='.option')return all.filter(n=>n.className==='option');if(sel==='input[name=mode]')return modes;
  if(sel.startsWith('input[data-group')){const group=sel.match(/data-group="([^"]+)"/)?.[1];return all.filter(n=>n.dataset.group&&(!group||n.dataset.group===group)&&(!sel.includes(':checked')||n.checked));}return [];}
 reset(){for(const e of Object.values(this.elements||{}))e.value='';this.elements.mode.value='fixed';all.filter(n=>n.dataset.group).forEach(n=>n.checked=false);}
 reportValidity(){return true;}
}
for(const m of html.matchAll(/\bid="([^"]+)"/g)){const n=new Element();n.id=m[1];}
const form=nodes.get('registration');form.elements={};for(const k of ['title','place','docs','name','timeNote','mode'])form.elements[k]=new Element('input');form.elements.mode.value='fixed';const modes=[new Element('input'),new Element('input')];modes[0].value='fixed';modes[1].value='flexible';
nodes.get('admin-scope').value='current';nodes.get('duration').value='60';const codeBox=new Element();
const document={getElementById:id=>nodes.get(id),createElement:t=>new Element(t),querySelector:sel=>sel==='.receipt-code-box'?codeBox:null,hidden:false};
const pending=[],timers=new Map();let timerId=0;
function runner(ok,fail){return new Proxy({}, {get(t,k){if(k==='withSuccessHandler')return fn=>runner(fn,fail);if(k==='withFailureHandler')return fn=>runner(ok,fn);return (...args)=>pending.push({name:k,args,ok,fail});}});}
class MockFormData{*[Symbol.iterator](){for(const [k,e] of Object.entries(form.elements))yield [k,e.value];yield ['website',''];yield ['date',nodes.get('date').value];yield ['startTime',nodes.get('start').value];yield ['endTime',nodes.get('end').value];}}
const ctx={URL,Blob,atob,Uint8Array,document,google:{script:{get run(){return runner();}}},crypto,console,Intl,Date,Map,Set,FormData:MockFormData,setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),setInterval(){},navigator:{}};
vm.createContext(ctx);vm.runInContext(script,ctx);
function take(name){const i=pending.findIndex(p=>p.name===name);assert.ok(i>=0,'Expected RPC '+name);return pending.splice(i,1)[0];}
function done(name,data){take(name).ok(data);}const submit={preventDefault(){}};
const day=new Date(Date.now()+86400000).toISOString().slice(0,10);
done('scheduleBootstrap',{token:'t'.repeat(72),today:day,province:['Lãnh đạo thử'],office:[],specialists:[]});
const item={id:'a'.repeat(32),title:'Họp kiểm thử giao diện',start:day+'T08:00',end:day+'T09:00',province:'Lãnh đạo thử',status:'ĐÃ LÊN LỊCH',scheduled:true,removed:false,sheet:'Đăng ký từ website'};
nodes.get('portal-admin').onclick();nodes.get('admin-password').value='fixture-password';nodes.get('admin-login').onsubmit(submit);
done('scheduleAdminLogin',{ticket:'s'.repeat(72),expires:Date.now()+1800000,index:{items:[item,{...item,id:'b'.repeat(32),start:'',end:'',title:'Chờ xếp lịch',scheduled:false,status:'CHỜ XẾP LỊCH'}],at:Date.now()}});
assert.equal(nodes.get('admin-list').children.length,2);assert.match(nodes.get('admin-status').textContent,/2 \/ 2/);
const beforeSearch=pending.length;nodes.get('admin-query').value='hop kiem thu';nodes.get('admin-query').oninput();assert.equal(nodes.get('admin-list').children.length,1);assert.equal(pending.length,beforeSearch);
const row=nodes.get('admin-list').children[0];assert.match(row.children[0].children[0].textContent,/08:00/);row.children.at(-1).onclick();
const data={title:item.title,start:item.start,end:item.end,province:['Lãnh đạo thử'],office:[],specialistLead:[],specialistSupport:[],specialists:[],place:'Phòng thử',name:'Người thử',docs:'',timeNote:'',mode:'fixed'};
done('scheduleAdminLoad',{id:item.id,status:item.status,data,revision:'rev1',scheduled:true,admin:true});
assert.equal(form.elements.title.value,item.title);assert.equal(nodes.get('edit-code').value,'');assert.equal(nodes.get('submit').textContent,'Lưu thay đổi');
form.elements.title.value='Nội dung sau chỉnh sửa';form.onsubmit(submit);const save=take('scheduleAdminUpdate');assert.equal(save.args[2],item.id);assert.equal(save.args[5].title,'Nội dung sau chỉnh sửa');
save.ok({id:item.id,status:item.status,updated:true,admin:true,item:{...item,title:'Nội dung sau chỉnh sửa'}});
assert.equal(nodes.get('receipt').hidden,false);assert.equal(codeBox.hidden,true);nodes.get('admin-query').value='';nodes.get('admin-back').onclick();assert.match(nodes.get('admin-list').children[0].children[1].children[0].textContent,/sau chỉnh sửa/);
nodes.get('admin-scope').value='waiting';nodes.get('admin-scope').onchange();assert.equal(nodes.get('admin-list').children.length,1);assert.match(nodes.get('admin-list').children[0].children[0].children[0].textContent,/Chưa cố định/);
nodes.get('admin-logout').onclick();assert.equal(nodes.get('admin-list').children.length,0);assert.equal(nodes.get('admin-login').hidden,false);
console.log('Admin UI passed: real login callback, dated/flexible lists, accent-free search without RPC, click-to-edit, save payload, refreshed summary and logout.');
// A slow server cannot strand the screen indefinitely or let late data reopen a timed-out login.
nodes.get('admin-password').value='fixture-password';nodes.get('admin-login').onsubmit(submit);const slow=take('scheduleAdminLogin');
const wait=[...timers.entries()].find(([id,t])=>t.ms===25000);assert.ok(wait);wait[1].fn();assert.equal(nodes.get('admin-login-button').disabled,false);assert.match(nodes.get('admin-status').textContent,/25 giây/);
slow.ok({ticket:'late',expires:Date.now()+1800000,index:{items:[item],at:Date.now()}});assert.equal(nodes.get('admin-content').hidden,true);assert.equal(nodes.get('admin-list').children.length,0);
// Errors in success-handler rendering are surfaced, not left at “loading”.
nodes.get('admin-password').value='fixture-password';nodes.get('admin-login').onsubmit(submit);const malformed=take('scheduleAdminLogin');malformed.ok({ticket:'s'.repeat(72),expires:Date.now()+1800000,index:{items:null,at:Date.now()}});assert.match(nodes.get('admin-status').textContent,/Không hiển thị được dữ liệu/);
console.log('Admin UI failure handling passed: timed-out reads unlock controls, stale responses ignored, rendering failures visible.');

// Render the real weekly timeline with the enriched API contract.
const meeting={title:'Họp <script>không chạy</script>',start:day+'T08:00:00+07:00',end:day+'T09:00:00+07:00',province:['Lãnh đạo thử'],office:['VP thử'],specialists:['CV chủ trì thử','CV phối hợp thử'],specialistLead:['CV chủ trì thử'],specialistSupport:['CV phối hợp thử'],specialistRolesKnown:true,location:'Phòng thử',registrant:'Người thử',documents:'https://example.test/doc',participantsKnown:true,blocksTime:true};
nodes.get('portal-overview').onclick();done('scheduleOverview',{busy:[meeting],updatedAt:new Date().toISOString()});
const descend=n=>[n,...n.children.flatMap(descend)];
const timeline=descend(nodes.get('overview-days'));const meetingDetail=timeline.find(n=>n.tagName==='details');assert.ok(meetingDetail);
assert.equal(meetingDetail.children[0].tagName,'summary');assert.equal(meetingDetail.children[0].children[0].textContent,meeting.title);
const texts=descend(meetingDetail).map(n=>n.textContent).join(' ');for(const text of ['Phòng thử','VP thử','CV chủ trì thử','CV phối hợp thử','Người thử'])assert.ok(texts.includes(text));
const people=timeline.find(n=>n.className==='timeline-people');assert.ok(descend(people).some(n=>n.textContent==='VP thử'));
const link=descend(meetingDetail).find(n=>n.tagName==='a');assert.equal(link.href,'https://example.test/doc');assert.equal(link.rel,'noopener noreferrer');
const beforeDetails=pending.length;const unsafe=ctx.overviewMeetingDetails({...meeting,documents:'javascript:alert(1)'},day);assert.ok(!descend(unsafe).some(n=>n.tagName==='a'));assert.equal(pending.length,beforeDetails);
const old=ctx.overviewPeopleBlock({...meeting,specialistRolesKnown:false});assert.ok(descend(old).some(n=>n.textContent==='Chuyên viên'));assert.ok(!descend(old).some(n=>n.textContent==='CV chủ trì'));
console.log('Weekly UI passed: full timeline render, office/staff roles, inline native details, safe links/text, legacy roles and no detail RPC.');

// Export requires admin login and freezes the chosen week/leader at click time.
nodes.get('admin-logout').onclick();nodes.get('overview-leader').value='Lãnh đạo thử';nodes.get('overview-pdf').onclick();assert.equal(nodes.get('pdf-auth').hidden,false);assert.ok(!pending.some(p=>p.name==='scheduleAdminExportPdf'));
nodes.get('pdf-password').value='fixture-password';nodes.get('pdf-auth').onsubmit(submit);const loginPdf=take('scheduleAdminLogin');assert.equal(loginPdf.args[2],true);assert.equal(nodes.get('pdf-password').value,'');
nodes.get('overview-leader').value='';loginPdf.ok({ticket:'p'.repeat(72),expires:Date.now()+1800000});const exportPdf=take('scheduleAdminExportPdf');assert.equal(exportPdf.args[3],'Lãnh đạo thử');assert.equal(exportPdf.args[1],'p'.repeat(72));
exportPdf.ok({filename:'fixture.pdf',mime:'application/pdf',base64:Buffer.from('%PDF-1.4 fixture').toString('base64')});assert.equal(nodes.get('pdf-download').hidden,false);assert.equal(nodes.get('pdf-download').download,'fixture.pdf');assert.match(nodes.get('pdf-download').href,/^blob:/);
nodes.get('admin-logout').onclick();assert.equal(nodes.get('pdf-download').hidden,true);assert.equal(nodes.get('pdf-download').href,undefined);
nodes.get('overview-pdf').onclick();nodes.get('pdf-password').value='wrong';nodes.get('pdf-auth').onsubmit(submit);take('scheduleAdminLogin').fail({message:'Mã quản trị không đúng.'});assert.match(nodes.get('pdf-status').textContent,/không đúng/);assert.equal(nodes.get('overview-pdf').disabled,false);assert.ok(!pending.some(p=>p.name==='scheduleAdminExportPdf'));
console.log('PDF UI passed: login gate, password clearing, filter snapshot, direct download, logout cleanup and wrong-password handling.');
