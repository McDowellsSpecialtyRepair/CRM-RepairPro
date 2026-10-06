import type {Express} from "express";
import {sqlite} from "./storage-db";
import {fail} from "./billing";
import {hasPermission,type Role} from "../shared/security";
import {normalizeVin,isModernVin} from "../shared/vin";
const query=(sql:string,...p:any[])=>sqlite.prepare(sql).all(...p) as any[];
export const vinSource=(vin:string)=>`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`;
export function parseVinResponse(vin:string,data:any){
  const r=data?.Results?.[0];if(!r||typeof r!=="object")fail("VIN provider returned an unreadable response.",502);
  const code=String(r.ErrorCode??"");
  const result={
    vin,year:r.ModelYear||"",make:r.Make||"",model:r.Model||"",trim:r.Trim||"",bodyClass:r.BodyClass||"",
    vehicleType:r.VehicleType||"",engineInfo:[r.DisplacementL?`${Number(r.DisplacementL).toFixed(1)} L`:"",r.EngineCylinders?`${r.EngineCylinders} cylinders`:"",r.EngineModel||""].filter(Boolean).join(" · "),
    fuelType:r.FuelTypePrimary||"",gvwr:r.GVWR||"",plantCountry:r.PlantCountry||"",series:r.Series||"",
    driveType:r.DriveType||"",manufacturer:r.Manufacturer||"",errorCode:code,
    errorText:code==="0"?null:r.ErrorText||"Provider did not confirm this VIN.",suggestedVin:r.SuggestedVIN||"",
    clean:code==="0"&&!!r.ModelYear&&!!r.Make&&!!r.Model,sourceUrl:vinSource(vin),
  };
  return result;
}
const cache=new Map<string,{expires:number,data:any}>();
export async function decodeVin(vin:string){
  if(!isModernVin(vin))fail("Automatic decoding needs a 17-character VIN without I, O or Q.",400);
  const found=cache.get(vin);if(found&&found.expires>Date.now())return found.data;
  let response:Response;
  try{response=await fetch(vinSource(vin),{signal:AbortSignal.timeout(12000),headers:{Accept:"application/json"}});}
  catch{fail("VIN decoder is temporarily unavailable. Shop history is checked separately; retry or enter vehicle details manually.",502);}
  if(!response!.ok)fail("VIN provider is unavailable. Retry or enter details manually.",502);
  let data;try{data=await response!.json();}catch{fail("VIN provider returned an unreadable response.",502);}
  const result=parseVinResponse(vin,data);
  if(cache.size>=500)cache.delete(cache.keys().next().value!);
  cache.set(vin,{expires:Date.now()+3600000,data:result});return result;
}
// Exact normalized identity only. No fuzzy VIN joins and no customer ownership changes.
export function vinHistory(identifier:string,customerId:number|null,role:Role){
  const vin=normalizeVin(identifier);
  if(!/^[A-Z0-9]{5,30}$/.test(vin))fail("Enter a valid VIN or historical vehicle identifier.",400);
  const vehicles=query(`SELECT v.id,v.customer_id customerId,v.year,v.make,v.model,v.trim,v.vehicle_type vehicleType,
    coalesce(nullif(c.company_name,''),trim(coalesce(c.first_name,'')||' '||coalesce(c.last_name,''))) customer
    FROM vehicles v JOIN customers c ON c.id=v.customer_id
    WHERE upper(replace(replace(replace(replace(coalesce(v.vin,''),' ',''),'-',''),char(9),''),char(10),''))=?
    ORDER BY v.id`,vin).map(v=>({...v,sameCustomer:customerId!==null&&v.customerId===customerId}));
  const ids=vehicles.map(v=>v.id);
  if(!ids.length)return {vin,vehicles:[],estimates:[],invoices:[],jobs:[],matched:false,checkedAt:new Date().toISOString(),limited:!hasPermission(role,"estimates.read")||!hasPermission(role,"billing.read")};
  const marks=ids.map(()=>"?").join(",");
  const name=`coalesce(nullif(c.company_name,''),trim(coalesce(c.first_name,'')||' '||coalesce(c.last_name,'')))`;
  const common=(rows:any[])=>rows.map(r=>({...r,sameCustomer:customerId!==null&&r.customerId===customerId}));
  const estimates=hasPermission(role,"estimates.read")?common(query(`SELECT DISTINCT e.id,e.estimate_number number,e.status,e.created_at date,e.customer_id customerId,${name} customer,e.service_type serviceType
    FROM estimates e JOIN customers c ON c.id=e.customer_id LEFT JOIN jobs j ON j.id=e.job_id
    WHERE e.vehicle_id IN (${marks}) OR j.vehicle_id IN (${marks}) OR e.id IN(SELECT estimate_id FROM service_history WHERE vehicle_id IN (${marks}))
    ORDER BY e.created_at DESC,e.id DESC`,...ids,...ids,...ids)):[];
  const invoices=hasPermission(role,"billing.read")?common(query(`SELECT DISTINCT i.id,i.invoice_number number,i.status,i.issue_date date,i.customer_id customerId,${name} customer,
    coalesce(e.service_type,j.service_type) serviceType,j.status jobStatus
    FROM invoices i JOIN customers c ON c.id=i.customer_id LEFT JOIN estimates e ON e.id=i.estimate_id LEFT JOIN jobs j ON j.id=i.job_id LEFT JOIN jobs ej ON ej.id=e.job_id
    WHERE e.vehicle_id IN (${marks}) OR j.vehicle_id IN (${marks}) OR ej.vehicle_id IN (${marks}) OR i.id IN(SELECT invoice_id FROM service_history WHERE vehicle_id IN (${marks}))
    ORDER BY i.issue_date DESC,i.id DESC`,...ids,...ids,...ids,...ids)):[];
  const jobs=hasPermission(role,"jobs.read")?common(query(`SELECT j.id,j.job_number number,j.status,j.created_at date,j.customer_id customerId,${name} customer,j.service_type serviceType
    FROM jobs j JOIN customers c ON c.id=j.customer_id WHERE j.vehicle_id IN (${marks}) ORDER BY j.created_at DESC,j.id DESC`,...ids)):[];
  return {vin,vehicles,estimates,invoices,jobs,matched:true,checkedAt:new Date().toISOString(),limited:!hasPermission(role,"estimates.read")||!hasPermission(role,"billing.read")};
}
export function registerVin(app:Express){
  app.get("/api/vin-decode/:vin",async(req,res)=>{
    try{res.json(await decodeVin(normalizeVin(String(req.params.vin))));}
    catch(e:any){res.status(e.status||502).json({message:e.message});}
  });
  app.get("/api/vin-history/:vin",(req,res)=>{
    const customerId=req.query.customerId?Number(req.query.customerId):null;
    if(customerId!==null&&(!Number.isSafeInteger(customerId)||customerId<1))fail("Invalid customer.",400);
    res.json(sqlite.transaction(()=>vinHistory(String(req.params.vin),customerId,res.locals.staff.role))());
  });
}
