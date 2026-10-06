import assert from "node:assert/strict";
import {localToday,addDays} from "../shared/operations";
import {formatCalendarDate} from "../shared/calendar-date";
let count=0;
function equal(a:any,b:any){assert.equal(a,b);count++;}
equal(localToday(new Date("2026-09-27T02:46:00Z")),"2026-09-26");
equal(localToday(new Date("2026-09-27T05:59:59Z")),"2026-09-26");
equal(localToday(new Date("2026-09-27T06:00:00Z")),"2026-09-27");
equal(localToday(new Date("2027-01-01T06:59:59Z")),"2026-12-31");
equal(localToday(new Date("2027-01-01T07:00:00Z")),"2027-01-01");
equal(addDays("2026-09-26",30),"2026-10-26");
equal(addDays("2026-10-15",30),"2026-11-14");
equal(addDays("2028-02-28",1),"2028-02-29");
for(const zone of ["UTC","America/Boise","Pacific/Honolulu","Asia/Tokyo"]){
 process.env.TZ=zone;
 equal(formatCalendarDate("2026-09-26"),"9/26/2026");
 equal(formatCalendarDate("2026-02-30"),"");
}
console.log(`${count} calendar-date assertions passed`);
