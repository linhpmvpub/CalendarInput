const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../apps-script/Code.gs','utf8');
vm.runInNewContext(source+`
CONFIG.province=['Nguyễn A'];CONFIG.office=['Trần B'];CONFIG.specialists=['Lê C'];
const base={ [Q.province]:'Nguyễn A', [Q.start]:new Date('2026-12-01T08:00:00+07:00'),[Q.end]:new Date('2026-12-01T09:00:00+07:00'),[Q.title]:'Họp', [Q.place]:'Phòng họp', [Q.unit]:'Văn phòng', [Q.contact]:'Người đăng ký'};
assert.equal(validate_(base).start.toISOString(),'2026-12-01T01:00:00.000Z');
assert.equal(validate_({...base,[Q.office]:'Trần B',[Q.specialists]:'Lê C'}).people.length,3);
assert.throws(()=>validate_({...base,[Q.end]:base[Q.start]}));
assert.throws(()=>validate_({...base,[Q.province]:''}));
assert.throws(()=>validate_({...base,[Q.province]:'Người lạ'}));
assert.throws(()=>validate_({...base,[Q.docs]:'javascript:alert(1)'}));
assert.throws(()=>validate_({...base,[Q.start]:'01/12/2026'}));
assert.equal(safe_('=IMPORTXML("x")').charAt(0),"'");
`,{assert});
console.log('8 validation checks passed');
