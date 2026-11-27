const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const props=new Map();let patches=[],conflict=false,items=[],page=0;
const context={console,Date,Map,Set,JSON,Utilities:{newBlob:s=>({getBytes:()=>Buffer.from(s)})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)})},Calendar:{Events:{patch(body,calendar,id,opts,headers){assert.deepEqual(Object.keys(body),['colorId']);assert.equal(opts.sendUpdates,'none');assert.equal(headers['If-Match'],'current');if(conflict)throw Error('412 Precondition Failed');patches.push({id,...body});return {...items.find(e=>e.id===id),...body};},list(cal,args){page++;return {items,nextSyncToken:'new-token'};}}}};
vm.createContext(context);vm.runInContext(['Code','ReverseSync'].map(f=>fs.readFileSync(__dirname+'/../apps-script/'+f+'.gs','utf8')).join('\n'),context);
const run=s=>vm.runInContext(s,context);
run("CONFIG.province=['Chủ tịch UBND tỉnh A','Phó Chủ tịch Thường trực UBND tỉnh B','Phó Chủ tịch UBND tỉnh C','Phó Chủ tịch UBND tỉnh D','Phó Chủ tịch UBND tỉnh E','Phó Chủ tịch UBND tỉnh F'];CONFIG.office=['Văn phòng G'];CONFIG.specialists=['Chuyên viên H'];");
const names=Array.from(run('CONFIG.province')),choice=(province=[],office=[],specialists=[])=>context.colorChoice_({province,office,specialists});
assert.equal(choice([names[0],names[1],names[2]]).id,'11');
assert.equal(choice([names[1],names[2]]).id,'3');
assert.equal(choice([names[1],names[1]]).id,'9');
assert.equal(new Set(names.slice(1).map(n=>choice([n]).id)).size,5);
assert.equal(choice([],['Văn phòng G'],['Chuyên viên H']).id,'10');
assert.equal(choice([],[],['Chuyên viên H']).id,'8');
assert.equal(choice(),null);assert.equal(choice(['Người chưa rõ'],['Văn phòng G']),null);
assert.equal(choice([],['Người chưa rõ'],['Chuyên viên H']),null);
// Stable mapping survives roster reorder and process restart.
props.set('PARTICIPANT_COLOR_MAP',JSON.stringify(context.colorDeputies_()));
run('CONFIG.province.reverse();colorMapMemo_=null;');assert.equal(choice([names[1]]).id,'9');
const description='Lãnh đạo UBND tỉnh: '+names[0]+'\nLãnh đạo Văn phòng UBND tỉnh: \nChuyên viên: ';
const event={id:'existing',etag:'current',status:'confirmed',description,summary:'Do not change title',colorId:'8'};
const budget=()=>({changed:0,matched:0,unclassified:0,deadline:Date.now()+10000});
items=[event];let b=budget();const updated=context.colorApply_(event,b);assert.equal(updated.colorId,'11');assert.equal(b.changed,1);assert.equal(patches.length,1);
context.colorApply_(updated,b);assert.equal(patches.length,1);assert.equal(b.matched,1);
context.colorApply_({...event,status:'cancelled'},b);assert.equal(patches.length,1);
context.colorApply_({...event,description:'Họp với '+names[0]},b);assert.equal(patches.length,1); // no inference from arbitrary prose
const metadata=run("encodePeople_(['province:Chủ tịch UBND tỉnh A'])");
const manual={...event,extendedProperties:{private:metadata},description:'Lãnh đạo UBND tỉnh: '+names[2]};assert.equal(context.colorEvent_(manual).id,'5');
assert.equal(context.colorEvent_({...manual,description:'Lãnh đạo UBND tỉnh: \nLãnh đạo Văn phòng UBND tỉnh: Văn phòng G'}).id,'10');
// Legacy metadata still works if group lines are absent.
assert.equal(context.colorEvent_({...manual,description:''}).id,'11');
conflict=true;assert.throws(()=>context.colorApply_(event,budget()),/412/);conflict=false;
assert.throws(()=>context.colorApply_(event,{...budget(),changed:100}),/từng đợt/);
// The existing incremental sync sees unlinked manual events too, and preserves its cursor on failure.
props.set('PARTICIPANT_COLORS_ENABLED','1');const result=context.reverseFetch_('old-token',new Set(),Date.now()+10000);assert.equal(result.colors.changed,1);assert.equal(result.found.size,0);assert.equal(result.nextToken,'new-token');
conflict=true;assert.throws(()=>context.reverseFetch_('old-token',new Set(),Date.now()+10000),/412/);
const html=fs.readFileSync(__dirname+'/../apps-script/WebRegistration.html','utf8');new vm.Script(html.match(/<script>([\s\S]*)<\/script>/)[1]);
console.log('Color checks passed: priorities, all five deputy colors, stable mappings, explicit descriptions, metadata fallback, no guesses, idempotency, canceled events, conditional patches, unlinked events, batch limits and UI syntax.');
