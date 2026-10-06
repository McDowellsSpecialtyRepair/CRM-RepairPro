export const normalizeVin=(value:string)=>String(value||"").toUpperCase().replace(/[\s-]/g,"");
export const isModernVin=(value:string)=>/^[A-HJ-NPR-Z0-9]{17}$/.test(normalizeVin(value));
export const vehicleDescription=(v:any)=>[v.year,v.make,v.model,v.trim].filter(Boolean).join(" ");
export const decodeFields=["year","make","model","trim","bodyClass","engineInfo","fuelType","gvwr","plantCountry"] as const;
export function decodedVehicleType(value:string,current:string){
  // Motorhome VINs may identify the chassis, not the RV body.
  if(current==="rv"||current==="marine")return current;
  const type=(value||"").toUpperCase();
  return type.includes("MOTORCYCLE")?"motorcycle":type.includes("TRUCK")?"truck":type.includes("PASSENGER")||type.includes("MULTIPURPOSE")?"auto":current||"other";
}
