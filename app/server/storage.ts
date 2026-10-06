import { db } from "./storage-db";
import { customers, contacts, vehicles, assets, jobs, estimates, estimateLineItems, invoices, invoiceLineItems, payments, serviceTemplates, pricingMatrices, campaigns, activities, qbSyncLog, users, technicians, scheduleSlots, bookings, serviceHistory, coiCertificates, thirdPartyPayers, fleetAccounts, fleetAuthorizedContacts, warrantyClaims, assetDetails, taxJurisdictions } from '@shared/schema';
import { eq } from "drizzle-orm";
import type { Customer, Contact, Vehicle, Asset, Job, Estimate, EstimateLineItem, Invoice, InvoiceLineItem, Payment, ServiceTemplate, PricingMatrix, Campaign, Activity, QbSyncLog, User, Technician, ScheduleSlot, Booking, ServiceHistory, CoiCertificate, ThirdPartyPayer, FleetAccount, FleetAuthorizedContact, WarrantyClaim, AssetDetail, TaxJurisdiction } from '@shared/schema';

export interface IStorage {
  // Customers
  getCustomers(): Customer[];
  getCustomer(id: number): Customer | undefined;
  createCustomer(data: Partial<Customer>): Customer;
  updateCustomer(id: number, data: Partial<Customer>): Customer | undefined;
  deleteCustomer(id: number): void;
  // Contacts
  getContacts(customerId: number): Contact[];
  createContact(data: Partial<Contact>): Contact;
  // Vehicles
  getVehicles(customerId: number): Vehicle[];
  getVehicle(id: number): Vehicle | undefined;
  createVehicle(data: Partial<Vehicle>): Vehicle;
  updateVehicle(id: number, data: Partial<Vehicle>): Vehicle | undefined;
  // Service History
  getServiceHistory(customerId: number): ServiceHistory[];
  getServiceHistoryByVehicle(vehicleId: number): ServiceHistory[];
  getServiceHistoryByAsset(assetId: number): ServiceHistory[];
  createServiceHistory(data: Partial<ServiceHistory>): ServiceHistory;
  // Assets
  getAssets(customerId: number): Asset[];
  createAsset(data: Partial<Asset>): Asset;
  // Jobs
  getJobs(): Job[];
  getJob(id: number): Job | undefined;
  createJob(data: Partial<Job>): Job;
  updateJob(id: number, data: Partial<Job>): Job | undefined;
  // Estimates
  getEstimates(): Estimate[];
  getEstimate(id: number): Estimate | undefined;
  createEstimate(data: Partial<Estimate>): Estimate;
  updateEstimate(id: number, data: Partial<Estimate>): Estimate | undefined;
  // Estimate Line Items
  getEstimateLineItems(estimateId: number): EstimateLineItem[];
  createEstimateLineItem(data: Partial<EstimateLineItem>): EstimateLineItem;
  deleteEstimateLineItem(id: number): void;
  // Invoices
  getInvoices(): Invoice[];
  getInvoice(id: number): Invoice | undefined;
  createInvoice(data: Partial<Invoice>): Invoice;
  updateInvoice(id: number, data: Partial<Invoice>): Invoice | undefined;
  // Invoice Line Items
  getInvoiceLineItems(invoiceId: number): InvoiceLineItem[];
  createInvoiceLineItem(data: Partial<InvoiceLineItem>): InvoiceLineItem;
  // Payments
  getPayments(): Payment[];
  getPaymentsByInvoice(invoiceId: number): Payment[];
  createPayment(data: Partial<Payment>): Payment;
  // Service Templates
  getServiceTemplates(): ServiceTemplate[];
  createServiceTemplate(data: Partial<ServiceTemplate>): ServiceTemplate;
  // Pricing Matrices
  getPricingMatrices(): PricingMatrix[];
  createPricingMatrix(data: Partial<PricingMatrix>): PricingMatrix;
  // Campaigns
  getCampaigns(): Campaign[];
  getCampaign(id: number): Campaign | undefined;
  createCampaign(data: Partial<Campaign>): Campaign;
  updateCampaign(id: number, data: Partial<Campaign>): Campaign | undefined;
  // Activities
  getActivities(): Activity[];
  getActivitiesByCustomer(customerId: number): Activity[];
  createActivity(data: Partial<Activity>): Activity;
  // QB Sync
  getQbSyncLog(): QbSyncLog[];
  createQbSyncLog(data: Partial<QbSyncLog>): QbSyncLog;
  // Technicians
  getTechnicians(): Technician[];
  getTechnician(id: number): Technician | undefined;
  createTechnician(data: Partial<Technician>): Technician;
  updateTechnician(id: number, data: Partial<Technician>): Technician | undefined;
  // Schedule Slots
  getScheduleSlots(): ScheduleSlot[];
  getScheduleSlot(id: number): ScheduleSlot | undefined;
  createScheduleSlot(data: Partial<ScheduleSlot>): ScheduleSlot;
  updateScheduleSlot(id: number, data: Partial<ScheduleSlot>): ScheduleSlot | undefined;
  deleteScheduleSlot(id: number): void;
  // Bookings
  getBookings(): Booking[];
  getBooking(id: number): Booking | undefined;
  createBooking(data: Partial<Booking>): Booking;
  updateBooking(id: number, data: Partial<Booking>): Booking | undefined;
  // COI Certificates
  getCoiCertificates(): CoiCertificate[];
  getCoiCertificatesByCustomer(customerId: number): CoiCertificate[];
  createCoiCertificate(data: Partial<CoiCertificate>): CoiCertificate;
  updateCoiCertificate(id: number, data: Partial<CoiCertificate>): CoiCertificate | undefined;
  deleteCoiCertificate(id: number): void;
  // Third-Party Payers
  getThirdPartyPayers(): ThirdPartyPayer[];
  getThirdPartyPayersByCustomer(customerId: number): ThirdPartyPayer[];
  createThirdPartyPayer(data: Partial<ThirdPartyPayer>): ThirdPartyPayer;
  updateThirdPartyPayer(id: number, data: Partial<ThirdPartyPayer>): ThirdPartyPayer | undefined;
  deleteThirdPartyPayer(id: number): void;
  // Fleet Accounts and Authorized Contacts
  getFleetAccounts(): FleetAccount[];
  getFleetAccountsByCustomer(customerId: number): FleetAccount[];
  createFleetAccount(data: Partial<FleetAccount>): FleetAccount;
  updateFleetAccount(id: number, data: Partial<FleetAccount>): FleetAccount | undefined;
  deleteFleetAccount(id: number): void;
  getFleetAuthorizedContacts(): FleetAuthorizedContact[];
  getFleetAuthorizedContactsByCustomer(customerId: number): FleetAuthorizedContact[];
  createFleetAuthorizedContact(data: Partial<FleetAuthorizedContact>): FleetAuthorizedContact;
  updateFleetAuthorizedContact(id: number, data: Partial<FleetAuthorizedContact>): FleetAuthorizedContact | undefined;
  deleteFleetAuthorizedContact(id: number): void;
  // Warranty Claims
  getWarrantyClaims(): WarrantyClaim[];
  getWarrantyClaimsByCustomer(customerId: number): WarrantyClaim[];
  createWarrantyClaim(data: Partial<WarrantyClaim>): WarrantyClaim;
  updateWarrantyClaim(id: number, data: Partial<WarrantyClaim>): WarrantyClaim | undefined;
  deleteWarrantyClaim(id: number): void;
  // Asset Details
  getAssetDetails(): AssetDetail[];
  getAssetDetailsByCustomer(customerId: number): AssetDetail[];
  createAssetDetail(data: Partial<AssetDetail>): AssetDetail;
  updateAssetDetail(id: number, data: Partial<AssetDetail>): AssetDetail | undefined;
  deleteAssetDetail(id: number): void;
  // Tax Jurisdictions
  getTaxJurisdictions(): TaxJurisdiction[];
  createTaxJurisdiction(data: Partial<TaxJurisdiction>): TaxJurisdiction;
  updateTaxJurisdiction(id: number, data: Partial<TaxJurisdiction>): TaxJurisdiction | undefined;
  deleteTaxJurisdiction(id: number): void;
  // Dashboard
  getDashboardStats(): {
    totalCustomers: number;
    activeJobs: number;
    pendingEstimates: number;
    outstandingInvoices: number;
    monthlyRevenue: number;
    unpaidBalance: number;
  };
  seedData(): void;
}

export class DatabaseStorage implements IStorage {
  // ===== CUSTOMERS =====
  getCustomers(): Customer[] {
    return db.select().from(customers).all();
  }
  getCustomer(id: number): Customer | undefined {
    return db.select().from(customers).where(eq(customers.id, id)).get();
  }
  createCustomer(data: Partial<Customer>): Customer {
    return db.insert(customers).values(data as any).returning().get();
  }
  updateCustomer(id: number, data: Partial<Customer>): Customer | undefined {
    return db.update(customers).set(data as any).where(eq(customers.id, id)).returning().get();
  }
  deleteCustomer(id: number): void {
    db.delete(customers).where(eq(customers.id, id)).run();
  }

  // ===== CONTACTS =====
  getContacts(customerId: number): Contact[] {
    return db.select().from(contacts).where(eq(contacts.customerId, customerId)).all();
  }
  createContact(data: Partial<Contact>): Contact {
    return db.insert(contacts).values(data as any).returning().get();
  }

  // ===== VEHICLES =====
  getVehicles(customerId: number): Vehicle[] {
    return db.select().from(vehicles).where(eq(vehicles.customerId, customerId)).all();
  }
  getVehicle(id: number): Vehicle | undefined {
    return db.select().from(vehicles).where(eq(vehicles.id, id)).get();
  }
  createVehicle(data: Partial<Vehicle>): Vehicle {
    return db.insert(vehicles).values(data as any).returning().get();
  }
  updateVehicle(id: number, data: Partial<Vehicle>): Vehicle | undefined {
    db.update(vehicles).set(data as any).where(eq(vehicles.id, id)).run();
    return db.select().from(vehicles).where(eq(vehicles.id, id)).get();
  }

  // ===== SERVICE HISTORY =====
  getServiceHistory(customerId: number): ServiceHistory[] {
    return db.select().from(serviceHistory).where(eq(serviceHistory.customerId, customerId)).all();
  }
  getServiceHistoryByVehicle(vehicleId: number): ServiceHistory[] {
    return db.select().from(serviceHistory).where(eq(serviceHistory.vehicleId, vehicleId)).all();
  }
  getServiceHistoryByAsset(assetId: number): ServiceHistory[] {
    return db.select().from(serviceHistory).where(eq(serviceHistory.assetId, assetId)).all();
  }
  createServiceHistory(data: Partial<ServiceHistory>): ServiceHistory {
    return db.insert(serviceHistory).values(data as any).returning().get();
  }

  // ===== ASSETS =====
  getAssets(customerId: number): Asset[] {
    return db.select().from(assets).where(eq(assets.customerId, customerId)).all();
  }
  createAsset(data: Partial<Asset>): Asset {
    return db.insert(assets).values(data as any).returning().get();
  }

  // ===== JOBS =====
  getJobs(): Job[] {
    return db.select().from(jobs).all();
  }
  getJob(id: number): Job | undefined {
    return db.select().from(jobs).where(eq(jobs.id, id)).get();
  }
  createJob(data: Partial<Job>): Job {
    return db.insert(jobs).values(data as any).returning().get();
  }
  updateJob(id: number, data: Partial<Job>): Job | undefined {
    return db.update(jobs).set(data as any).where(eq(jobs.id, id)).returning().get();
  }

  // ===== ESTIMATES =====
  getEstimates(): Estimate[] {
    return db.select().from(estimates).all();
  }
  getEstimate(id: number): Estimate | undefined {
    return db.select().from(estimates).where(eq(estimates.id, id)).get();
  }
  createEstimate(data: Partial<Estimate>): Estimate {
    return db.insert(estimates).values(data as any).returning().get();
  }
  updateEstimate(id: number, data: Partial<Estimate>): Estimate | undefined {
    return db.update(estimates).set(data as any).where(eq(estimates.id, id)).returning().get();
  }

  // ===== ESTIMATE LINE ITEMS =====
  getEstimateLineItems(estimateId: number): EstimateLineItem[] {
    return db.select().from(estimateLineItems).where(eq(estimateLineItems.estimateId, estimateId)).all();
  }
  createEstimateLineItem(data: Partial<EstimateLineItem>): EstimateLineItem {
    return db.insert(estimateLineItems).values(data as any).returning().get();
  }
  deleteEstimateLineItem(id: number): void {
    db.delete(estimateLineItems).where(eq(estimateLineItems.id, id)).run();
  }

  // ===== INVOICES =====
  getInvoices(): Invoice[] {
    return db.select().from(invoices).all();
  }
  getInvoice(id: number): Invoice | undefined {
    return db.select().from(invoices).where(eq(invoices.id, id)).get();
  }
  createInvoice(data: Partial<Invoice>): Invoice {
    return db.insert(invoices).values(data as any).returning().get();
  }
  updateInvoice(id: number, data: Partial<Invoice>): Invoice | undefined {
    return db.update(invoices).set(data as any).where(eq(invoices.id, id)).returning().get();
  }

  // ===== INVOICE LINE ITEMS =====
  getInvoiceLineItems(invoiceId: number): InvoiceLineItem[] {
    return db.select().from(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, invoiceId)).all();
  }
  createInvoiceLineItem(data: Partial<InvoiceLineItem>): InvoiceLineItem {
    return db.insert(invoiceLineItems).values(data as any).returning().get();
  }

  // ===== PAYMENTS =====
  getPayments(): Payment[] {
    return db.select().from(payments).all();
  }
  getPaymentsByInvoice(invoiceId: number): Payment[] {
    return db.select().from(payments).where(eq(payments.invoiceId, invoiceId)).all();
  }
  createPayment(data: Partial<Payment>): Payment {
    return db.insert(payments).values(data as any).returning().get();
  }

  // ===== SERVICE TEMPLATES =====
  getServiceTemplates(): ServiceTemplate[] {
    return db.select().from(serviceTemplates).all();
  }
  createServiceTemplate(data: Partial<ServiceTemplate>): ServiceTemplate {
    return db.insert(serviceTemplates).values(data as any).returning().get();
  }

  // ===== PRICING MATRICES =====
  getPricingMatrices(): PricingMatrix[] {
    return db.select().from(pricingMatrices).all();
  }
  createPricingMatrix(data: Partial<PricingMatrix>): PricingMatrix {
    return db.insert(pricingMatrices).values(data as any).returning().get();
  }

  // ===== CAMPAIGNS =====
  getCampaigns(): Campaign[] {
    return db.select().from(campaigns).all();
  }
  getCampaign(id: number): Campaign | undefined {
    return db.select().from(campaigns).where(eq(campaigns.id, id)).get();
  }
  createCampaign(data: Partial<Campaign>): Campaign {
    return db.insert(campaigns).values(data as any).returning().get();
  }
  updateCampaign(id: number, data: Partial<Campaign>): Campaign | undefined {
    return db.update(campaigns).set(data as any).where(eq(campaigns.id, id)).returning().get();
  }

  // ===== ACTIVITIES =====
  getActivities(): Activity[] {
    return db.select().from(activities).all();
  }
  getActivitiesByCustomer(customerId: number): Activity[] {
    return db.select().from(activities).where(eq(activities.customerId, customerId)).all();
  }
  createActivity(data: Partial<Activity>): Activity {
    return db.insert(activities).values({ ...data, performedBy: actorLabel() } as any).returning().get();
  }

  // ===== QB SYNC =====
  getQbSyncLog(): QbSyncLog[] {
    return db.select().from(qbSyncLog).all();
  }
  createQbSyncLog(data: Partial<QbSyncLog>): QbSyncLog {
    return db.insert(qbSyncLog).values(data as any).returning().get();
  }

  // ===== TECHNICIANS =====
  getTechnicians(): Technician[] {
    return db.select().from(technicians).all();
  }
  getTechnician(id: number): Technician | undefined {
    return db.select().from(technicians).where(eq(technicians.id, id)).get();
  }
  createTechnician(data: Partial<Technician>): Technician {
    return db.insert(technicians).values(data as any).returning().get();
  }
  updateTechnician(id: number, data: Partial<Technician>): Technician | undefined {
    return db.update(technicians).set(data as any).where(eq(technicians.id, id)).returning().get();
  }

  // ===== SCHEDULE SLOTS =====
  getScheduleSlots(): ScheduleSlot[] {
    return db.select().from(scheduleSlots).all();
  }
  getScheduleSlot(id: number): ScheduleSlot | undefined {
    return db.select().from(scheduleSlots).where(eq(scheduleSlots.id, id)).get();
  }
  createScheduleSlot(data: Partial<ScheduleSlot>): ScheduleSlot {
    return db.insert(scheduleSlots).values(data as any).returning().get();
  }
  updateScheduleSlot(id: number, data: Partial<ScheduleSlot>): ScheduleSlot | undefined {
    return db.update(scheduleSlots).set(data as any).where(eq(scheduleSlots.id, id)).returning().get();
  }
  deleteScheduleSlot(id: number): void {
    db.delete(scheduleSlots).where(eq(scheduleSlots.id, id)).run();
  }

  // ===== BOOKINGS =====
  getBookings(): Booking[] {
    return db.select().from(bookings).all();
  }
  getBooking(id: number): Booking | undefined {
    return db.select().from(bookings).where(eq(bookings.id, id)).get();
  }
  createBooking(data: Partial<Booking>): Booking {
    return db.insert(bookings).values(data as any).returning().get();
  }
  updateBooking(id: number, data: Partial<Booking>): Booking | undefined {
    return db.update(bookings).set(data as any).where(eq(bookings.id, id)).returning().get();
  }

  // ===== COI CERTIFICATES =====
  getCoiCertificates(): CoiCertificate[] { return db.select().from(coiCertificates).all(); }
  getCoiCertificatesByCustomer(customerId: number): CoiCertificate[] { return db.select().from(coiCertificates).where(eq(coiCertificates.customerId, customerId)).all(); }
  createCoiCertificate(data: Partial<CoiCertificate>): CoiCertificate { return db.insert(coiCertificates).values(data as any).returning().get(); }
  updateCoiCertificate(id: number, data: Partial<CoiCertificate>): CoiCertificate | undefined { return db.update(coiCertificates).set(data as any).where(eq(coiCertificates.id, id)).returning().get(); }
  deleteCoiCertificate(id: number): void { db.delete(coiCertificates).where(eq(coiCertificates.id, id)).run(); }

  // ===== THIRD-PARTY PAYERS =====
  getThirdPartyPayers(): ThirdPartyPayer[] { return db.select().from(thirdPartyPayers).all(); }
  getThirdPartyPayersByCustomer(customerId: number): ThirdPartyPayer[] { return db.select().from(thirdPartyPayers).where(eq(thirdPartyPayers.customerId, customerId)).all(); }
  createThirdPartyPayer(data: Partial<ThirdPartyPayer>): ThirdPartyPayer { return db.insert(thirdPartyPayers).values(data as any).returning().get(); }
  updateThirdPartyPayer(id: number, data: Partial<ThirdPartyPayer>): ThirdPartyPayer | undefined { return db.update(thirdPartyPayers).set(data as any).where(eq(thirdPartyPayers.id, id)).returning().get(); }
  deleteThirdPartyPayer(id: number): void { db.delete(thirdPartyPayers).where(eq(thirdPartyPayers.id, id)).run(); }

  // ===== FLEET ACCOUNTS =====
  getFleetAccounts(): FleetAccount[] { return db.select().from(fleetAccounts).all(); }
  getFleetAccountsByCustomer(customerId: number): FleetAccount[] { return db.select().from(fleetAccounts).where(eq(fleetAccounts.customerId, customerId)).all(); }
  createFleetAccount(data: Partial<FleetAccount>): FleetAccount { return db.insert(fleetAccounts).values(data as any).returning().get(); }
  updateFleetAccount(id: number, data: Partial<FleetAccount>): FleetAccount | undefined { return db.update(fleetAccounts).set(data as any).where(eq(fleetAccounts.id, id)).returning().get(); }
  deleteFleetAccount(id: number): void { db.delete(fleetAccounts).where(eq(fleetAccounts.id, id)).run(); }

  // ===== FLEET AUTHORIZED CONTACTS =====
  getFleetAuthorizedContacts(): FleetAuthorizedContact[] { return db.select().from(fleetAuthorizedContacts).all(); }
  getFleetAuthorizedContactsByCustomer(customerId: number): FleetAuthorizedContact[] { return db.select().from(fleetAuthorizedContacts).where(eq(fleetAuthorizedContacts.customerId, customerId)).all(); }
  createFleetAuthorizedContact(data: Partial<FleetAuthorizedContact>): FleetAuthorizedContact { return db.insert(fleetAuthorizedContacts).values(data as any).returning().get(); }
  updateFleetAuthorizedContact(id: number, data: Partial<FleetAuthorizedContact>): FleetAuthorizedContact | undefined { return db.update(fleetAuthorizedContacts).set(data as any).where(eq(fleetAuthorizedContacts.id, id)).returning().get(); }
  deleteFleetAuthorizedContact(id: number): void { db.delete(fleetAuthorizedContacts).where(eq(fleetAuthorizedContacts.id, id)).run(); }

  // ===== WARRANTY CLAIMS =====
  getWarrantyClaims(): WarrantyClaim[] { return db.select().from(warrantyClaims).all(); }
  getWarrantyClaimsByCustomer(customerId: number): WarrantyClaim[] { return db.select().from(warrantyClaims).where(eq(warrantyClaims.customerId, customerId)).all(); }
  createWarrantyClaim(data: Partial<WarrantyClaim>): WarrantyClaim { return db.insert(warrantyClaims).values(data as any).returning().get(); }
  updateWarrantyClaim(id: number, data: Partial<WarrantyClaim>): WarrantyClaim | undefined { return db.update(warrantyClaims).set(data as any).where(eq(warrantyClaims.id, id)).returning().get(); }
  deleteWarrantyClaim(id: number): void { db.delete(warrantyClaims).where(eq(warrantyClaims.id, id)).run(); }

  // ===== ASSET DETAILS =====
  getAssetDetails(): AssetDetail[] { return db.select().from(assetDetails).all(); }
  getAssetDetailsByCustomer(customerId: number): AssetDetail[] { return db.select().from(assetDetails).where(eq(assetDetails.customerId, customerId)).all(); }
  createAssetDetail(data: Partial<AssetDetail>): AssetDetail { return db.insert(assetDetails).values(data as any).returning().get(); }
  updateAssetDetail(id: number, data: Partial<AssetDetail>): AssetDetail | undefined { return db.update(assetDetails).set(data as any).where(eq(assetDetails.id, id)).returning().get(); }
  deleteAssetDetail(id: number): void { db.delete(assetDetails).where(eq(assetDetails.id, id)).run(); }

  // ===== TAX JURISDICTIONS =====
  getTaxJurisdictions(): TaxJurisdiction[] { return db.select().from(taxJurisdictions).all(); }
  createTaxJurisdiction(data: Partial<TaxJurisdiction>): TaxJurisdiction { return db.insert(taxJurisdictions).values(data as any).returning().get(); }
  updateTaxJurisdiction(id: number, data: Partial<TaxJurisdiction>): TaxJurisdiction | undefined { return db.update(taxJurisdictions).set(data as any).where(eq(taxJurisdictions.id, id)).returning().get(); }
  deleteTaxJurisdiction(id: number): void { db.delete(taxJurisdictions).where(eq(taxJurisdictions.id, id)).run(); }

  // ===== DASHBOARD =====
  getDashboardStats() {
    const allCustomers = db.select().from(customers).all();
    const allJobs = db.select().from(jobs).all();
    const allEstimates = db.select().from(estimates).all();
    const allInvoices = db.select().from(invoices).all();
    const allPayments = db.select().from(payments).all();

    const activeJobs = allJobs.filter(j => j.status === 'in_progress' || j.status === 'scheduled').length;
    const pendingEstimates = allEstimates.filter(e => e.status === 'draft' || e.status === 'sent').length;
    const unpaidInvoices = allInvoices.filter(i => i.status !== 'paid' && i.status !== 'void');
    const outstandingInvoices = unpaidInvoices.length;
    const unpaidBalance = unpaidInvoices.reduce((sum, i) => sum + (i.balanceDue || 0), 0);

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthlyRevenue = allPayments
      .filter(p => {
        const d = new Date(p.paymentDate);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    return {
      totalCustomers: allCustomers.length,
      activeJobs,
      pendingEstimates,
      outstandingInvoices,
      monthlyRevenue,
      unpaidBalance,
    };
  }

  // ===== SEED DATA =====
  seedData() {
    const existing = db.select().from(customers).all();
    if (existing.length > 0) return;

    // Users
    db.insert(users).values([
      { username: 'admin', password: 'admin', fullName: 'System Admin', role: 'admin', email: 'admin@repairco.com' },
      { username: 'estimator', password: 'est', fullName: 'Mike Torres', role: 'estimator', email: 'mike@repairco.com' },
      { username: 'tech', password: 'tech', fullName: 'James Wilson', role: 'technician', email: 'james@repairco.com' },
    ]).run();

    // Customers
    const custData = [
      { customerNumber: 'CUST-001', firstName: 'Robert', lastName: 'Chen', customerType: 'retail', email: 'rchen@email.com', phone: '208-555-0142', mobile: '208-555-0143', address: '1425 W State St', city: 'Boise', state: 'ID', zip: '83702', referralSource: 'Google', status: 'active' },
      { customerNumber: 'CUST-002', companyName: 'Boise Ford Lincoln', customerType: 'dealership', email: 'service@boiseford.com', phone: '208-555-0199', address: '1000 E Automall Dr', city: 'Boise', state: 'ID', zip: '83716', referralSource: 'Cold call', status: 'active' },
      { customerNumber: 'CUST-003', companyName: 'State Farm Insurance', customerType: 'insurance', email: 'claims@statefarm.com', phone: '208-555-0300', address: '500 W Front St', city: 'Boise', state: 'ID', zip: '83702', status: 'active' },
      { customerNumber: 'CUST-004', firstName: 'Sarah', lastName: 'Mitchell', customerType: 'retail', email: 'sarah.m@email.com', phone: '208-555-0177', mobile: '208-555-0178', address: '842 Park Hill Dr', city: 'Meridian', state: 'ID', zip: '83646', referralSource: 'Referral', status: 'active' },
      { customerNumber: 'CUST-005', companyName: 'Sun Valley RV Resort', customerType: 'commercial', email: 'manager@sunvalleyrv.com', phone: '208-555-0420', address: '200 RV Park Rd', city: 'Boise', state: 'ID', zip: '83709', status: 'active' },
      { customerNumber: 'CUST-006', companyName: 'Idaho Boat Works', customerType: 'commercial', email: 'service@idahoboat.com', phone: '208-555-0510', address: '1500 Dock Rd', city: 'Nampa', state: 'ID', zip: '83686', status: 'active' },
      { customerNumber: 'CUST-007', firstName: 'David', lastName: 'Kowalski', customerType: 'fleet', companyName: 'Kowalski Fleet Services', email: 'dave@kowalskifleet.com', phone: '208-555-0680', address: '300 Industrial Blvd', city: 'Boise', state: 'ID', zip: '83707', status: 'active' },
      { customerNumber: 'CUST-008', companyName: 'The Grove Hotel', customerType: 'commercial', email: 'facilities@grovehotel.com', phone: '208-555-0750', address: '245 S Capitol Blvd', city: 'Boise', state: 'ID', zip: '83702', status: 'active' },
      { customerNumber: 'CUST-009', firstName: 'Jennifer', lastName: 'Alvarez', customerType: 'retail', email: 'jen.alvarez@email.com', phone: '208-555-0922', address: '1700 N Warm Springs', city: 'Boise', state: 'ID', zip: '83712', referralSource: 'Facebook', status: 'active' },
      { customerNumber: 'CUST-010', companyName: 'Treasure Valley Dodge', customerType: 'dealership', email: 'service@tvdodge.com', phone: '208-555-1000', address: '950 E Fairview Ave', city: 'Meridian', state: 'ID', zip: '83642', status: 'active' },
    ];
    const createdCustomers = custData.map(c => db.insert(customers).values(c as any).returning().get());

    // Contacts
    db.insert(contacts).values([
      { customerId: createdCustomers[1].id, name: 'Tom Bradley', title: 'Service Manager', email: 'tom@boiseford.com', phone: '208-555-0199', isPrimary: 1 },
      { customerId: createdCustomers[2].id, name: 'Lisa Park', title: 'Claims Adjuster', email: 'lpark@statefarm.com', phone: '208-555-0301', isPrimary: 1 },
      { customerId: createdCustomers[4].id, name: 'Frank Daly', title: 'Operations Manager', email: 'frank@sunvalleyrv.com', phone: '208-555-0421', isPrimary: 1 },
      { customerId: createdCustomers[5].id, name: 'Karen Moss', title: 'Owner', email: 'karen@idahoboat.com', phone: '208-555-0511', isPrimary: 1 },
      { customerId: createdCustomers[6].id, name: 'David Kowalski', title: 'Owner', email: 'dave@kowalskifleet.com', phone: '208-555-0680', isPrimary: 1 },
      { customerId: createdCustomers[7].id, name: 'Maria Santos', title: 'Facilities Director', email: 'maria@grovehotel.com', phone: '208-555-0751', isPrimary: 1 },
      { customerId: createdCustomers[9].id, name: 'Steve Holt', title: 'GM', email: 'steve@tvdodge.com', phone: '208-555-1001', isPrimary: 1 },
    ]).run();

    // Vehicles
    db.insert(vehicles).values([
      { customerId: createdCustomers[0].id, vin: '1HGCM82633A123456', year: '2021', make: 'Honda', model: 'Accord', trim: 'EX-L', bodyClass: 'Sedan', color: 'Silver', engineInfo: '1.5L I4 Gasoline', fuelType: 'Gasoline', plantCountry: 'United States (USA)', licensePlate: 'IDA-1234', vehicleType: 'auto' },
      { customerId: createdCustomers[3].id, vin: '5TFAY5F12LX987654', year: '2023', make: 'Toyota', model: 'Tundra', trim: 'SR5', bodyClass: 'Pickup', color: 'Black', engineInfo: '3.5L V6 Gasoline', fuelType: 'Gasoline', plantCountry: 'United States (USA)', licensePlate: 'IDB-5678', vehicleType: 'truck' },
      { customerId: createdCustomers[1].id, vin: '1FTFW1ET5DFK456789', year: '2022', make: 'Ford', model: 'F-150', trim: 'XLT', bodyClass: 'Pickup', color: 'Blue', engineInfo: '5.0L V8 Gasoline', fuelType: 'Gasoline', plantCountry: 'United States (USA)', licensePlate: 'IDC-9012', vehicleType: 'auto' },
      { customerId: createdCustomers[1].id, vin: '1FAHP3K2XDG111111', year: '2022', make: 'Ford', model: 'Edge', trim: 'SEL', bodyClass: 'SUV', color: 'White', engineInfo: '2.0L I4 Turbo', fuelType: 'Gasoline', plantCountry: 'United States (USA)', vehicleType: 'auto' },
      { customerId: createdCustomers[5].id, vin: 'MARINE-001', year: '2020', make: 'Sea Ray', model: 'Sundancer 320', color: 'White/Blue', vehicleType: 'marine' },
      { customerId: createdCustomers[6].id, vin: '5TFAY5F12LX555555', year: '2024', make: 'Toyota', model: 'Tundra', trim: 'Platinum', bodyClass: 'Pickup', color: 'Red', engineInfo: '3.5L V6 Hybrid', fuelType: 'Hybrid', plantCountry: 'United States (USA)', vehicleType: 'truck' },
      { customerId: createdCustomers[8].id, vin: '1G1ZK54758F222222', year: '2024', make: 'Chevrolet', model: 'Malibu', trim: 'LT', bodyClass: 'Sedan', color: 'Gray', engineInfo: '1.5L I4 Turbo', fuelType: 'Gasoline', plantCountry: 'United States (USA)', vehicleType: 'auto' },
    ]).run();

    // Service History
    db.insert(serviceHistory).values([
      { customerId: createdCustomers[0].id, vehicleId: 1, jobId: 1, invoiceId: 1, serviceDate: '2026-09-08', serviceType: 'pdr', description: 'Driver door dent repair - quarter size', technician: 'James Wilson', warrantyMonths: 12, warrantyExpiry: '2027-09-08', warrantyStatus: 'active', cost: 302.10, status: 'completed' },
      { customerId: createdCustomers[3].id, vehicleId: 2, jobId: 3, invoiceId: 2, serviceDate: '2026-09-05', serviceType: 'window_tint', description: 'Full vehicle ceramic window tint', technician: 'Sarah Chen', warrantyMonths: 60, warrantyExpiry: '2031-09-05', warrantyStatus: 'active', cost: 402.80, status: 'completed' },
      { customerId: createdCustomers[4].id, assetId: 1, jobId: 4, invoiceId: 3, serviceDate: '2026-09-07', serviceType: 'rv_interior', description: 'RV dashboard vinyl repair - cracking and peeling', technician: 'James Wilson', warrantyMonths: 6, warrantyExpiry: '2027-03-07', warrantyStatus: 'active', cost: 445.20, status: 'completed' },
      { customerId: createdCustomers[8].id, vehicleId: 7, jobId: 8, invoiceId: 4, serviceDate: '2026-09-05', serviceType: 'window_tint', description: 'Full vehicle standard window tint', technician: 'Sarah Chen', warrantyMonths: 36, warrantyExpiry: '2029-09-05', warrantyStatus: 'active', cost: 360.40, status: 'completed' },
      { customerId: createdCustomers[1].id, vehicleId: 4, jobId: 9, invoiceId: 5, serviceDate: '2026-08-15', serviceType: 'interior_repair', description: 'Ford Edge leather seat repair - driver side', technician: 'Maria Santos', warrantyMonths: 12, warrantyExpiry: '2027-08-15', warrantyStatus: 'active', cost: 196.10, status: 'completed' },
      { customerId: createdCustomers[1].id, vehicleId: 3, jobId: 2, serviceDate: '2026-09-12', serviceType: 'hail', description: 'Hail damage repair - hood, roof, doors (pending)', technician: 'James Wilson', warrantyMonths: 12, warrantyExpiry: '2027-09-12', warrantyStatus: 'none', cost: 0, status: 'in_progress' },
      { customerId: createdCustomers[5].id, assetId: 4, jobId: 6, serviceDate: '2026-09-15', serviceType: 'marine_upholstery', description: 'Marine cabin cushion reupholstery - V-berth and salon', technician: 'Maria Santos', warrantyMonths: 24, warrantyExpiry: '2028-09-15', warrantyStatus: 'none', cost: 0, status: 'pending' },
      { customerId: createdCustomers[7].id, assetId: 2, jobId: 5, serviceDate: '2026-09-20', serviceType: 'upholstery', description: 'Conference room chair reupholstery - 120 units', technician: 'Tyler Brooks', warrantyMonths: 36, warrantyExpiry: '2029-09-20', warrantyStatus: 'none', cost: 0, status: 'pending' },
    ]).run();

    // Assets (non-vehicle)
    db.insert(assets).values([
      { customerId: createdCustomers[4].id, assetType: 'rv', name: 'Forest River Georgetown', description: '35ft Class A Motorhome', location: 'Site 42' },
      { customerId: createdCustomers[7].id, assetType: 'hotel', name: 'Conference Room A', description: '120 chair reupholstery', location: '2nd Floor' },
      { customerId: createdCustomers[7].id, assetType: 'hotel', name: 'Lobby Seating', description: '8 lobby armchairs', location: 'Ground Floor' },
      { customerId: createdCustomers[5].id, assetType: 'marine', name: 'Cabin Interior', description: 'V-berth and salon cushions', location: 'Slip 12' },
    ]).run();

    // Jobs
    const jobData = [
      { jobNumber: 'JOB-2026-001', customerId: createdCustomers[0].id, vehicleId: 1, serviceType: 'pdr', title: 'Door dent repair - Honda Accord', status: 'in_progress', assignedTech: 'James Wilson', scheduledDate: '2026-09-10', priority: 'normal' },
      { jobNumber: 'JOB-2026-002', customerId: createdCustomers[1].id, vehicleId: 3, serviceType: 'pdr', title: 'Hail damage - Ford F-150', status: 'scheduled', assignedTech: 'James Wilson', scheduledDate: '2026-09-12', priority: 'high', insuranceClaim: 'SF-2026-4471', insuranceAdjuster: 'Lisa Park' },
      { jobNumber: 'JOB-2026-003', customerId: createdCustomers[3].id, vehicleId: 2, serviceType: 'window_tint', title: 'Full tint - Toyota Tundra', status: 'completed', assignedTech: 'James Wilson', completedDate: '2026-09-08', priority: 'normal' },
      { jobNumber: 'JOB-2026-004', customerId: createdCustomers[4].id, assetId: 1, serviceType: 'rv_interior', title: 'RV vinyl dashboard repair', status: 'in_progress', assignedTech: 'James Wilson', scheduledDate: '2026-09-09', priority: 'normal' },
      { jobNumber: 'JOB-2026-005', customerId: createdCustomers[7].id, assetId: 2, serviceType: 'upholstery', title: 'Conference room chair reupholstery (120 units)', status: 'pending', priority: 'normal' },
      { jobNumber: 'JOB-2026-006', customerId: createdCustomers[5].id, assetId: 4, serviceType: 'marine_upholstery', title: 'Marine cabin cushion reupholstery', status: 'scheduled', assignedTech: 'James Wilson', scheduledDate: '2026-09-15', priority: 'normal' },
      { jobNumber: 'JOB-2026-007', customerId: createdCustomers[6].id, vehicleId: 6, serviceType: 'pdr', title: 'Fleet door ding repair (3 vehicles)', status: 'pending', priority: 'low' },
      { jobNumber: 'JOB-2026-008', customerId: createdCustomers[8].id, vehicleId: 7, serviceType: 'window_tint', title: 'Chevy Malibu full tint', status: 'completed', assignedTech: 'James Wilson', completedDate: '2026-09-05', priority: 'normal' },
      { jobNumber: 'JOB-2026-009', customerId: createdCustomers[1].id, vehicleId: 4, serviceType: 'interior_repair', title: 'Ford Edge leather seat repair', status: 'in_progress', assignedTech: 'James Wilson', priority: 'normal' },
    ];
    const createdJobs = jobData.map(j => db.insert(jobs).values(j as any).returning().get());

    // Estimates
    const estData = [
      { estimateNumber: 'EST-2026-001', jobId: createdJobs[0].id, customerId: createdCustomers[0].id, vehicleId: 1, serviceType: 'pdr', status: 'approved', subtotal: 285, taxRate: 6, taxAmount: 17.10, discount: 0, total: 302.10, notes: 'Driver side door - quarter-size dent', validUntil: '2026-09-20', approvedDate: '2026-09-08' },
      { estimateNumber: 'EST-2026-002', jobId: createdJobs[1].id, customerId: createdCustomers[1].id, vehicleId: 3, serviceType: 'hail', status: 'sent', subtotal: 2150, taxRate: 6, taxAmount: 129, discount: 0, total: 2279, notes: 'Hail damage - hood, roof, both doors. Insurance claim SF-2026-4471', validUntil: '2026-09-25' },
      { estimateNumber: 'EST-2026-003', jobId: createdJobs[2].id, customerId: createdCustomers[3].id, vehicleId: 2, serviceType: 'window_tint', status: 'invoiced', subtotal: 380, taxRate: 6, taxAmount: 22.80, discount: 0, total: 402.80, notes: 'Full vehicle tint - ceramic film', validUntil: '2026-09-20' },
      { estimateNumber: 'EST-2026-004', jobId: createdJobs[3].id, customerId: createdCustomers[4].id, assetId: 1, serviceType: 'rv_interior', status: 'approved', subtotal: 420, taxRate: 6, taxAmount: 25.20, discount: 0, total: 445.20, notes: 'RV dashboard vinyl repair - cracking and peeling', validUntil: '2026-09-22', approvedDate: '2026-09-07' },
      { estimateNumber: 'EST-2026-005', jobId: createdJobs[4].id, customerId: createdCustomers[7].id, assetId: 2, serviceType: 'upholstery', status: 'draft', subtotal: 8400, taxRate: 6, taxAmount: 504, discount: 400, total: 8504, notes: '120 conference room chairs - reupholster seats and backs', validUntil: '2026-10-01' },
      { estimateNumber: 'EST-2026-006', jobId: createdJobs[5].id, customerId: createdCustomers[5].id, assetId: 4, serviceType: 'marine_upholstery', status: 'sent', subtotal: 2800, taxRate: 6, taxAmount: 168, discount: 0, total: 2968, notes: 'Marine cabin cushions - V-berth and salon. Sunbrella marine fabric', validUntil: '2026-09-28' },
      { estimateNumber: 'EST-2026-007', jobId: createdJobs[7].id, customerId: createdCustomers[8].id, vehicleId: 7, serviceType: 'window_tint', status: 'invoiced', subtotal: 340, taxRate: 6, taxAmount: 20.40, discount: 0, total: 360.40, notes: 'Full tint - standard film', validUntil: '2026-09-18' },
    ];
    const createdEstimates = estData.map(e => db.insert(estimates).values(e as any).returning().get());

    // Estimate Line Items
    db.insert(estimateLineItems).values([
      { estimateId: createdEstimates[0].id, serviceCategory: 'pdr_dent', description: 'PDR - Driver door dent (quarter size)', quantity: 1, unit: 'each', unitPrice: 285, total: 285, panelLocation: 'Driver door', damageSize: 'quarter', damageSeverity: 'moderate' },
      { estimateId: createdEstimates[1].id, serviceCategory: 'pdr_hail', description: 'PDR Hail - Hood damage repair', quantity: 1, unit: 'panel', unitPrice: 650, total: 650, panelLocation: 'Hood', damageSize: 'multiple', damageSeverity: 'severe' },
      { estimateId: createdEstimates[1].id, serviceCategory: 'pdr_hail', description: 'PDR Hail - Roof damage repair', quantity: 1, unit: 'panel', unitPrice: 750, total: 750, panelLocation: 'Roof', damageSize: 'multiple', damageSeverity: 'severe' },
      { estimateId: createdEstimates[1].id, serviceCategory: 'pdr_hail', description: 'PDR Hail - Driver side door', quantity: 1, unit: 'panel', unitPrice: 375, total: 375, panelLocation: 'Driver door', damageSize: 'multiple', damageSeverity: 'moderate' },
      { estimateId: createdEstimates[1].id, serviceCategory: 'pdr_hail', description: 'PDR Hail - Passenger door', quantity: 1, unit: 'panel', unitPrice: 375, total: 375, panelLocation: 'Passenger door', damageSize: 'multiple', damageSeverity: 'moderate' },
      { estimateId: createdEstimates[2].id, serviceCategory: 'window_tint', description: 'Ceramic window tint - Full vehicle', quantity: 1, unit: 'each', unitPrice: 380, total: 380 },
      { estimateId: createdEstimates[3].id, serviceCategory: 'interior_vinyl', description: 'RV dashboard vinyl repair', quantity: 1, unit: 'each', unitPrice: 420, total: 420 },
      { estimateId: createdEstimates[4].id, serviceCategory: 'upholstery', description: 'Conference chair reupholster - seat', quantity: 120, unit: 'each', unitPrice: 55, total: 6600 },
      { estimateId: createdEstimates[4].id, serviceCategory: 'upholstery', description: 'Conference chair reupholster - back', quantity: 120, unit: 'each', unitPrice: 25, total: 3000 },
      { estimateId: createdEstimates[4].id, serviceCategory: 'material', description: 'Volume discount', quantity: 1, unit: 'each', unitPrice: -400, total: -400 },
      { estimateId: createdEstimates[5].id, serviceCategory: 'upholstery', description: 'V-berth cushions - Sunbrella marine', quantity: 4, unit: 'each', unitPrice: 450, total: 1800 },
      { estimateId: createdEstimates[5].id, serviceCategory: 'upholstery', description: 'Salon cushions - Sunbrella marine', quantity: 2, unit: 'each', unitPrice: 500, total: 1000 },
      { estimateId: createdEstimates[6].id, serviceCategory: 'window_tint', description: 'Standard window tint - Full vehicle', quantity: 1, unit: 'each', unitPrice: 340, total: 340 },
    ]).run();

    // Invoices
    const invData = [
      { invoiceNumber: 'INV-2026-001', customerId: createdCustomers[0].id, jobId: createdJobs[0].id, estimateId: createdEstimates[0].id, status: 'sent', subtotal: 285, taxRate: 6, taxAmount: 17.10, discount: 0, total: 302.10, amountPaid: 0, balanceDue: 302.10, issueDate: '2026-09-08', dueDate: '2026-10-08', notes: 'Driver door dent repair', qbSynced: 1, qbTxnId: 'QB-INV-1001' },
      { invoiceNumber: 'INV-2026-002', customerId: createdCustomers[3].id, jobId: createdJobs[2].id, estimateId: createdEstimates[2].id, status: 'paid', subtotal: 380, taxRate: 6, taxAmount: 22.80, discount: 0, total: 402.80, amountPaid: 402.80, balanceDue: 0, issueDate: '2026-09-03', dueDate: '2026-10-03', notes: 'Full vehicle ceramic tint', qbSynced: 1, qbTxnId: 'QB-INV-1002' },
      { invoiceNumber: 'INV-2026-003', customerId: createdCustomers[4].id, jobId: createdJobs[3].id, estimateId: createdEstimates[3].id, status: 'partial', subtotal: 420, taxRate: 6, taxAmount: 25.20, discount: 0, total: 445.20, amountPaid: 200, balanceDue: 245.20, issueDate: '2026-09-07', dueDate: '2026-10-07', notes: 'RV dashboard vinyl repair', qbSynced: 1, qbTxnId: 'QB-INV-1003' },
      { invoiceNumber: 'INV-2026-004', customerId: createdCustomers[8].id, jobId: createdJobs[7].id, estimateId: createdEstimates[6].id, status: 'paid', subtotal: 340, taxRate: 6, taxAmount: 20.40, discount: 0, total: 360.40, amountPaid: 360.40, balanceDue: 0, issueDate: '2026-09-05', dueDate: '2026-10-05', notes: 'Full vehicle standard tint', qbSynced: 1, qbTxnId: 'QB-INV-1004' },
      { invoiceNumber: 'INV-2026-005', customerId: createdCustomers[1].id, jobId: createdJobs[8].id, status: 'overdue', subtotal: 185, taxRate: 6, taxAmount: 11.10, discount: 0, total: 196.10, amountPaid: 0, balanceDue: 196.10, issueDate: '2026-08-15', dueDate: '2026-09-14', notes: 'Ford Edge leather seat repair', qbSynced: 0 },
      { invoiceNumber: 'INV-2026-006', customerId: createdCustomers[6].id, status: 'draft', subtotal: 0, taxRate: 6, taxAmount: 0, discount: 0, total: 0, amountPaid: 0, balanceDue: 0, issueDate: '2026-09-10', notes: 'Fleet service - pending estimate', qbSynced: 0 },
    ];
    db.insert(invoices).values(invData as any).run();

    // Invoice Line Items
    db.insert(invoiceLineItems).values([
      { invoiceId: 1, description: 'PDR - Driver door dent repair', quantity: 1, unit: 'each', unitPrice: 285, total: 285 },
      { invoiceId: 2, description: 'Ceramic window tint - Full vehicle', quantity: 1, unit: 'each', unitPrice: 380, total: 380 },
      { invoiceId: 3, description: 'RV dashboard vinyl repair', quantity: 1, unit: 'each', unitPrice: 420, total: 420 },
      { invoiceId: 4, description: 'Standard window tint - Full vehicle', quantity: 1, unit: 'each', unitPrice: 340, total: 340 },
      { invoiceId: 5, description: 'Leather seat repair - Driver seat', quantity: 1, unit: 'each', unitPrice: 185, total: 185 },
    ]).run();

    // Payments
    db.insert(payments).values([
      { paymentNumber: 'PMT-001', invoiceId: 2, customerId: createdCustomers[3].id, amount: 402.80, paymentMethod: 'credit_card', paymentDate: '2026-09-03', reference: 'CC-4471', qbSynced: 1, qbTxnId: 'QB-PMT-2001' },
      { paymentNumber: 'PMT-002', invoiceId: 3, customerId: createdCustomers[4].id, amount: 200, paymentMethod: 'check', paymentDate: '2026-09-07', reference: 'CHK-1042', qbSynced: 1, qbTxnId: 'QB-PMT-2002' },
      { paymentNumber: 'PMT-003', invoiceId: 4, customerId: createdCustomers[8].id, amount: 360.40, paymentMethod: 'cash', paymentDate: '2026-09-05', qbSynced: 1, qbTxnId: 'QB-PMT-2003' },
      { paymentNumber: 'PMT-004', invoiceId: 1, customerId: createdCustomers[0].id, amount: 150, paymentMethod: 'credit_card', paymentDate: '2026-09-09', reference: 'CC-8821', qbSynced: 0 },
    ]).run();

    // Service Templates
    db.insert(serviceTemplates).values([
      { name: 'PDR - Quarter Size Dent', serviceType: 'pdr', description: 'Standard quarter-sized dent repair', basePrice: 285, unitType: 'each', isActive: 1 },
      { name: 'PDR - Dime Size Dent', serviceType: 'pdr', description: 'Small dime-sized dent repair', basePrice: 125, unitType: 'each', isActive: 1 },
      { name: 'PDR - Nickel Size Dent', serviceType: 'pdr', description: 'Nickel-sized dent repair', basePrice: 175, unitType: 'each', isActive: 1 },
      { name: 'PDR - Half Dollar Dent', serviceType: 'pdr', description: 'Half-dollar sized dent repair', basePrice: 350, unitType: 'each', isActive: 1 },
      { name: 'PDR - Softball Size Dent', serviceType: 'pdr', description: 'Large softball-sized dent repair', basePrice: 475, unitType: 'each', isActive: 1 },
      { name: 'Hail Damage - Per Panel', serviceType: 'hail', description: 'Hail damage repair per panel', basePrice: 400, unitType: 'panel', isActive: 1 },
      { name: 'Ceramic Window Tint', serviceType: 'window_tint', description: 'Full vehicle ceramic tint', basePrice: 380, unitType: 'each', isActive: 1 },
      { name: 'Standard Window Tint', serviceType: 'window_tint', description: 'Full vehicle standard tint', basePrice: 340, unitType: 'each', isActive: 1 },
      { name: 'Vinyl Interior Repair', serviceType: 'interior_repair', description: 'Vinyl/plastic interior repair', basePrice: 150, unitType: 'each', isActive: 1 },
      { name: 'Fabric Interior Repair', serviceType: 'interior_repair', description: 'Fabric/upholstery interior repair', basePrice: 185, unitType: 'each', isActive: 1 },
      { name: 'Upholstery - Per Cushion', serviceType: 'upholstery', description: 'Custom cushion reupholstery', basePrice: 85, unitType: 'each', isActive: 1 },
      { name: 'Leather Seat Repair', serviceType: 'interior_repair', description: 'Leather seat repair', basePrice: 185, unitType: 'each', isActive: 1 },
    ]).run();

    // Pricing Matrices
    const pricingMatrixEntries: any[] = [
      // PDR Dent Matrix
      { name: 'Standard PDR Dent Pricing', matrixType: 'pdr_dent', panel: 'Any', sizeCategory: 'dime', price: 125, vehicleCategory: 'sedan' },
      { name: 'Standard PDR Dent Pricing', matrixType: 'pdr_dent', panel: 'Any', sizeCategory: 'nickel', price: 175, vehicleCategory: 'sedan' },
      { name: 'Standard PDR Dent Pricing', matrixType: 'pdr_dent', panel: 'Any', sizeCategory: 'quarter', price: 285, vehicleCategory: 'sedan' },
      { name: 'Standard PDR Dent Pricing', matrixType: 'pdr_dent', panel: 'Any', sizeCategory: 'half_dollar', price: 350, vehicleCategory: 'sedan' },
      { name: 'Standard PDR Dent Pricing', matrixType: 'pdr_dent', panel: 'Any', sizeCategory: 'softball', price: 475, vehicleCategory: 'sedan' },
      { name: 'SUV/Truck PDR Pricing', matrixType: 'pdr_dent', panel: 'Any', sizeCategory: 'dime', price: 145, vehicleCategory: 'suv' },
      { name: 'SUV/Truck PDR Pricing', matrixType: 'pdr_dent', panel: 'Any', sizeCategory: 'nickel', price: 195, vehicleCategory: 'suv' },
      { name: 'SUV/Truck PDR Pricing', matrixType: 'pdr_dent', panel: 'Any', sizeCategory: 'quarter', price: 315, vehicleCategory: 'suv' },
      { name: 'SUV/Truck PDR Pricing', matrixType: 'pdr_dent', panel: 'Any', sizeCategory: 'half_dollar', price: 385, vehicleCategory: 'suv' },
      { name: 'SUV/Truck PDR Pricing', matrixType: 'pdr_dent', panel: 'Any', sizeCategory: 'softball', price: 525, vehicleCategory: 'suv' },

      // Generic Hail Matrix
      { name: 'Hail Matrix - Hood', matrixType: 'pdr_hail', panel: 'Hood', sizeCategory: 'multiple', price: 650, vehicleCategory: 'sedan' },
      { name: 'Hail Matrix - Roof', matrixType: 'pdr_hail', panel: 'Roof', sizeCategory: 'multiple', price: 750, vehicleCategory: 'sedan' },
      { name: 'Hail Matrix - Door', matrixType: 'pdr_hail', panel: 'Door', sizeCategory: 'multiple', price: 375, vehicleCategory: 'sedan' },
      { name: 'Hail Matrix - Fender', matrixType: 'pdr_hail', panel: 'Fender', sizeCategory: 'multiple', price: 350, vehicleCategory: 'sedan' },
      { name: 'Hail Matrix - Hood', matrixType: 'pdr_hail', panel: 'Hood', sizeCategory: 'multiple', price: 750, vehicleCategory: 'suv' },
      { name: 'Hail Matrix - Roof', matrixType: 'pdr_hail', panel: 'Roof', sizeCategory: 'multiple', price: 850, vehicleCategory: 'suv' },

      // Window Tint Matrix - complete vehicles
      { name: 'Standard Film Full Vehicle', matrixType: 'window_tint', panel: 'Full Vehicle', filmType: 'standard', vehicleCategory: 'sedan', price: 340, unitType: 'each' },
      { name: 'Standard Film Full Vehicle', matrixType: 'window_tint', panel: 'Full Vehicle', filmType: 'standard', vehicleCategory: 'suv', price: 380, unitType: 'each' },
      { name: 'Standard Film Full Vehicle', matrixType: 'window_tint', panel: 'Full Vehicle', filmType: 'standard', vehicleCategory: 'truck', price: 360, unitType: 'each' },
      { name: 'Ceramic Film Full Vehicle', matrixType: 'window_tint', panel: 'Full Vehicle', filmType: 'ceramic', vehicleCategory: 'sedan', price: 380, unitType: 'each' },
      { name: 'Ceramic Film Full Vehicle', matrixType: 'window_tint', panel: 'Full Vehicle', filmType: 'ceramic', vehicleCategory: 'suv', price: 450, unitType: 'each' },
      { name: 'Ceramic Film Full Vehicle', matrixType: 'window_tint', panel: 'Full Vehicle', filmType: 'ceramic', vehicleCategory: 'truck', price: 420, unitType: 'each' },
      { name: 'Carbon Film Full Vehicle', matrixType: 'window_tint', panel: 'Full Vehicle', filmType: 'carbon', vehicleCategory: 'sedan', price: 360, unitType: 'each' },
      { name: 'Carbon Film Full Vehicle', matrixType: 'window_tint', panel: 'Full Vehicle', filmType: 'carbon', vehicleCategory: 'suv', price: 400, unitType: 'each' },
      { name: 'Carbon Film Full Vehicle', matrixType: 'window_tint', panel: 'Full Vehicle', filmType: 'carbon', vehicleCategory: 'truck', price: 380, unitType: 'each' },
      { name: 'Standard Film Front Doors', matrixType: 'window_tint', panel: 'Front Doors', filmType: 'standard', price: 80, unitType: 'pair' },
      { name: 'Standard Film Rear Doors', matrixType: 'window_tint', panel: 'Rear Doors', filmType: 'standard', price: 80, unitType: 'pair' },
      { name: 'Standard Film Back Glass', matrixType: 'window_tint', panel: 'Back Glass', filmType: 'standard', price: 120, unitType: 'each' },
      { name: 'Standard Film Sunroof', matrixType: 'window_tint', panel: 'Sunroof', filmType: 'standard', price: 60, unitType: 'each' },
      { name: 'Ceramic Film Front Doors', matrixType: 'window_tint', panel: 'Front Doors', filmType: 'ceramic', price: 100, unitType: 'pair' },
      { name: 'Ceramic Film Rear Doors', matrixType: 'window_tint', panel: 'Rear Doors', filmType: 'ceramic', price: 100, unitType: 'pair' },
      { name: 'Ceramic Film Back Glass', matrixType: 'window_tint', panel: 'Back Glass', filmType: 'ceramic', price: 150, unitType: 'each' },
      { name: 'Ceramic Film Sunroof', matrixType: 'window_tint', panel: 'Sunroof', filmType: 'ceramic', price: 80, unitType: 'each' },
    ];

    const addInsuranceHailMatrix = (
      company: string,
      rows: Record<string, Record<string, (number | [number, string])[]>>,
    ) => {
      for (const [dentCountRange, panels] of Object.entries(rows)) {
        for (const [panel, prices] of Object.entries(panels)) {
          (['dime', 'nickel', 'quarter', 'half_dollar'] as const).forEach((sizeCategory, index) => {
            const value = prices[index];
            const [price, notes] = Array.isArray(value) ? value : [value, undefined];
            pricingMatrixEntries.push({
              name: `${company} Hail Matrix`, matrixType: 'hail_insurance', insuranceCompany: company,
              panel, sizeCategory, dentCountRange, vehicleCategory: null, price, unitType: 'panel', notes,
            });
          });
        }
      }
    };

    addInsuranceHailMatrix('State Farm', {
      '1-5': { Hood: [80,100,125,150], Roof: [100,125,150,200], 'Deck Lid': [80,100,125,150], 'Roof Rail': [85,100,125,150], Fender: [80,100,125,150], Door: [80,100,125,150], Quarter: [80,100,125,150], Cowl: [100,125,150,175] },
      '6-15': { Hood: [125,175,200,250], Roof: [175,225,250,325], 'Deck Lid': [125,150,200,250], 'Roof Rail': [125,150,175,[300,'MCE']], Fender: [125,150,175,200], Door: [125,150,175,200], Quarter: [125,150,175,200], Cowl: [150,175,200,225] },
      '16-30': { Hood: [200,225,275,350], Roof: [250,300,350,425], 'Deck Lid': [175,225,275,300], 'Roof Rail': [200,250,275,[400,'MCE']], Fender: [175,225,275,300], Door: [175,225,250,300], Quarter: [175,225,250,300], Cowl: [200,225,250,275] },
      '31-50': { Hood: [300,350,425,500], Roof: [375,425,525,600], 'Deck Lid': [275,325,400,475], 'Roof Rail': [300,400,[500,'MCE'],[600,'MCE']], Fender: [275,300,350,375], Door: [275,300,350,[450,'MCE']], Quarter: [275,325,400,475], Cowl: [[350,'MCE'],[400,'MCE'],[450,'MCE'],[500,'MCE']] },
    });
    addInsuranceHailMatrix('Allstate', {
      '6-15': { Hood: [75,100,125,150], Roof: [100,125,150,200], Decklid: [75,100,125,150], 'Door/Fender/QP': [75,100,125,150], 'Roof Rail': [100,125,150,200], Uniside: [100,125,150,200], Cowl: [100,125,150,200] },
      '16-30': { Hood: [125,175,200,300], Roof: [175,225,250,400], Decklid: [125,175,200,300], 'Door/Fender/QP': [125,150,175,300], 'Roof Rail': [150,200,250,[400,'MCE']], Uniside: [150,200,250,[400,'MCE']], Cowl: [150,200,250,400] },
      '31-50': { Hood: [200,250,300,400], Roof: [250,300,375,525], Decklid: [200,250,300,400], 'Door/Fender/QP': [200,225,250,400], 'Roof Rail': [250,300,450,[600,'MCE']], Uniside: [250,300,450,[600,'MCE']], Cowl: [[300,'MCE'],[350,'MCE'],[400,'MCE'],[500,'MCE']] },
    });
    addInsuranceHailMatrix('Progressive', {
      '1-5': { Hood: [75,100,125,150], Roof: [100,125,150,200], 'Deck Lid': [75,100,125,150], Quarter: [75,100,125,150], Door: [75,100,125,150], Fender: [75,100,125,150], 'Cowl/Other': [100,125,150,200] },
      '6-15': { Hood: [125,175,200,300], Roof: [175,225,250,400], 'Deck Lid': [125,175,200,300], Quarter: [125,150,175,225], Door: [125,150,175,225], Fender: [125,150,175,225], 'Cowl/Other': [150,200,250,400] },
      '16-30': { Hood: [200,250,300,400], Roof: [250,300,375,525], 'Deck Lid': [200,250,300,400], Quarter: [200,225,250,375], Door: [200,225,250,[350,'CR']], Fender: [200,225,250,[350,'CR']], 'Cowl/Other': [[300,'CR'],[350,'CR'],[400,'CR'],[500,'CR']] },
      '31-50': { Hood: [300,350,400,525], Roof: [375,450,550,675], 'Deck Lid': [300,350,425,525], Quarter: [300,325,400,525], Door: [300,325,350,[450,'CR']], Fender: [300,325,350,[450,'CR']], 'Cowl/Other': [[400,'CR'],[450,'CR'],[500,'CR'],[600,'CR']] },
    });
    addInsuranceHailMatrix('Farmers', {
      '1-5': { Hood: [75,100,125,150], Roof: [100,125,150,200], 'Deck Lid': [75,100,125,150], 'Quarter Panel': [75,100,125,150], 'Roof Rail': [100,125,150,200], Door: [75,100,125,150], Fender: [75,100,125,150], Cowl: [100,125,150,200] },
      '6-15': { Hood: [125,175,200,300], Roof: [175,225,250,375], 'Deck Lid': [125,175,200,300], 'Quarter Panel': [125,150,175,225], 'Roof Rail': [150,200,225,250], Door: [125,150,175,215], Fender: [125,150,175,215], Cowl: [150,200,250,300] },
      '16-30': { Hood: [200,250,300,375], Roof: [250,300,375,475], 'Deck Lid': [200,250,300,375], 'Quarter Panel': [200,225,250,300], 'Roof Rail': [235,275,375,[450,'MCE']], Door: [200,225,250,275], Fender: [200,225,250,275], Cowl: [175,225,250,300] },
      '31-50': { Hood: [300,350,425,515], Roof: [375,450,550,625], 'Deck Lid': [300,350,425,515], 'Quarter Panel': [275,300,375,400], 'Roof Rail': [385,475,500,[600,'MCE']], Door: [285,315,325,350], Fender: [285,315,325,350], Cowl: [200,250,275,350] },
    });
    addInsuranceHailMatrix('GEICO', {
      '1-5': { Hood: [75,100,125,150], Roof: [100,125,150,200], 'Deck Lid': [75,90,125,140], 'LF/RF Fender': [75,90,125,140], Quarter: [75,90,125,140], Doors: [75,90,125,140] },
      '6-15': { Hood: [125,175,200,250], Roof: [175,200,250,300], 'Deck Lid': [100,150,175,200], 'LF/RF Fender': [100,150,175,200], Quarter: [100,150,175,200], Doors: [100,150,175,200] },
      '16-30': { Hood: [175,200,250,325], Roof: [200,250,325,400], 'Deck Lid': [175,200,225,250], 'LF/RF Fender': [175,200,225,275], Quarter: [175,200,225,275], Doors: [175,200,225,275] },
      '31-50': { Hood: [275,325,400,475], Roof: [300,350,450,525], 'Deck Lid': [225,250,300,325], 'LF/RF Fender': [225,250,300,325], Quarter: [225,250,300,325], Doors: [225,250,300,325] },
    });
    addInsuranceHailMatrix('USAA', {
      '1-5': { Hood: [80,100,125,150], Roof: [100,125,150,200], 'Deck Lid/Gate': [80,100,125,150], Quarter: [80,100,125,150], 'Roof Rail': [85,100,125,150], Door: [80,100,125,150], Fender: [80,100,125,150], Cowl: [100,125,150,175] },
      '6-15': { Hood: [125,175,200,250], Roof: [175,225,250,325], 'Deck Lid/Gate': [125,150,200,250], Quarter: [125,150,175,225], 'Roof Rail': [125,150,175,225], Door: [125,150,175,200], Fender: [125,150,175,200], Cowl: [150,175,200,225] },
      '16-30': { Hood: [200,225,275,350], Roof: [250,300,350,425], 'Deck Lid/Gate': [175,225,275,300], Quarter: [175,225,250,300], 'Roof Rail': [200,250,275,325], Door: [175,225,250,300], Fender: [175,225,275,300], Cowl: [200,225,250,275] },
      '31-50': { Hood: [300,350,425,500], Roof: [375,425,525,600], 'Deck Lid/Gate': [275,325,400,475], Quarter: [275,300,375,400], 'Roof Rail': [300,400,500,575], Door: [275,300,350,375], Fender: [275,300,350,375], Cowl: [[350,'MCA'],[400,'MCA'],[450,'MCA'],[500,'MCA']] },
    });
    addInsuranceHailMatrix('Travelers', {
      '1-5': { Hood: [100,130,190,230], Roof: [100,130,190,230], 'Deck Lid': [100,130,185,250], 'L&R Quarter': [75,100,135,195], 'L/R Roof Rail': [100,125,135,175], 'L/R Doors': [75,100,125,175], 'L/R Fenders': [75,100,125,175], 'Metal Sunroof': [75,100,125,175], 'Cowl/Other': [100,130,190,230] },
      '6-15': { Hood: [175,210,250,325], Roof: [175,215,260,295], 'Deck Lid': [175,215,270,290], 'L&R Quarter': [165,190,220,290], 'L/R Roof Rail': [165,195,230,295], 'L/R Doors': [150,175,205,290], 'L/R Fenders': [150,175,205,295], 'Metal Sunroof': [150,175,205,290], 'Cowl/Other': [175,215,260,295] },
      '16-30': { Hood: [225,280,340,445], Roof: [225,280,365,440], 'Deck Lid': [230,290,370,430], 'L&R Quarter': [215,245,310,395], 'L/R Roof Rail': [215,250,320,[400,'RR']], 'L/R Doors': [195,235,280,[350,'RR']], 'L/R Fenders': [195,235,285,[350,'RR']], 'Metal Sunroof': [195,235,285,[350,'RR']], 'Cowl/Other': [[300,'RR'],[350,'RR'],[400,'RR'],[500,'RR']] },
      '31-50': { Hood: [275,340,415,500], Roof: [300,365,450,545], 'Deck Lid': [290,365,455,525], 'L&R Quarter': [255,310,390,465], 'L/R Roof Rail': [265,325,[400,'RR'],[500,'RR']], 'L/R Doors': [240,295,[350,'RR'],[450,'RR']], 'L/R Fenders': [240,290,[350,'RR'],[450,'RR']], 'Metal Sunroof': [240,295,[350,'RR'],[450,'RR']], 'Cowl/Other': [[400,'RR'],[450,'RR'],[500,'RR'],[600,'RR']] },
    });
    addInsuranceHailMatrix('Nationwide', {
      '1-5': { Hood: [75,100,125,150], 'R/L Fender': [75,100,125,150], Roof: [100,125,150,175], 'R Rail/Corner': [100,125,150,175], Doors: [75,100,125,150], Quarter: [75,100,125,150], 'Deck Lid': [75,100,125,150] },
      '6-15': { Hood: [125,175,200,200], 'R/L Fender': [125,175,200,200], Roof: [175,200,250,300], 'R Rail/Corner': [175,225,250,300], Doors: [125,175,175,200], Quarter: [125,175,175,200], 'Deck Lid': [125,150,175,175] },
      '16-30': { Hood: [175,225,250,300], 'R/L Fender': [175,225,250,300], Roof: [200,250,300,375], 'R Rail/Corner': [200,250,275,300], Doors: [175,225,250,300], Quarter: [175,225,250,300], 'Deck Lid': [175,200,250,300] },
      '31-50': { Hood: [225,250,300,300], 'R/L Fender': [225,250,300,300], Roof: [250,300,375,400], 'R Rail/Corner': [250,250,300,300], Doors: [225,250,300,300], Quarter: [225,250,300,325], 'Deck Lid': [200,250,300,325] },
    });
    addInsuranceHailMatrix('Liberty Mutual/Safeco', {
      '1-5': { 'Average Size': [85,100,125,150], 'L Fender': [85,100,125,150], Roof: [100,125,150,200], 'Roof Trunk': [85,100,125,150], 'L/R Door': [85,100,125,150], 'LF/RF Door': [85,100,125,150], 'R Quarter': [75,100,125,150], 'L Quarter': [75,100,125,150] },
      '6-15': { 'Average Size': [125,150,175,300], 'L Fender': [125,150,175,200], Roof: [175,200,250,400], 'Roof Trunk': [125,150,175,300], 'L/R Door': [125,150,175,200], 'LF/RF Door': [125,150,175,200], 'R Quarter': [125,150,175,200], 'L Quarter': [125,150,175,200] },
      '16-30': { 'Average Size': [125,150,175,300], 'L Fender': [140,175,200,250], Roof: [175,200,250,400], 'Roof Trunk': [125,150,175,300], 'L/R Door': [125,150,175,200], 'LF/RF Door': [125,150,175,200], 'R Quarter': [125,150,175,200], 'L Quarter': [125,150,175,200] },
      '31-50': { 'Average Size': [125,150,175,300], 'L Fender': [140,175,200,250], Roof: [175,200,250,400], 'Roof Trunk': [125,150,175,300], 'L/R Door': [125,150,175,200], 'LF/RF Door': [125,150,175,200], 'R Quarter': [125,150,175,200], 'L Quarter': [125,150,175,200] },
    });

    const addDamageMatrix = (matrixType: string, title: string, rows: Record<string, number[]>) => {
      for (const [damageType, prices] of Object.entries(rows)) {
        (['minor', 'moderate', 'severe'] as const).forEach((severity, index) => {
          pricingMatrixEntries.push({ name: `${title} - ${damageType}`, matrixType, damageType, severity, price: prices[index], unitType: 'each' });
        });
      }
    };
    addDamageMatrix('interior_vinyl', 'Interior Vinyl/Plastic Repair', {
      crack: [75,125,200], tear: [85,140,225], burn: [90,150,250], fade: [60,100,175], puncture: [70,120,190],
    });
    addDamageMatrix('interior_fabric', 'Interior Fabric Repair', {
      tear: [85,140,225], burn: [95,155,260], stain: [50,85,150], rip: [80,130,210], hole: [75,125,200],
    });

    pricingMatrixEntries.push(
      { name: 'Chair Seat Reupholster', matrixType: 'upholstery', panel: 'Chair seat reupholster', price: 85, unitType: 'each' },
      { name: 'Chair Back Reupholster', matrixType: 'upholstery', panel: 'Chair back reupholster', price: 65, unitType: 'each' },
      { name: 'Sofa Cushion', matrixType: 'upholstery', panel: 'Sofa cushion', price: 120, unitType: 'each' },
      { name: 'Booth Seat', matrixType: 'upholstery', panel: 'Booth seat', price: 95, unitType: 'each' },
      { name: 'Booth Back', matrixType: 'upholstery', panel: 'Booth back', price: 75, unitType: 'each' },
      { name: 'Marine Cushion', matrixType: 'upholstery', panel: 'Marine cushion', price: 110, unitType: 'each' },
      { name: 'Dashboard Vinyl', matrixType: 'upholstery', panel: 'Dashboard vinyl', price: 150, unitType: 'each' },
      { name: 'Door Panel', matrixType: 'upholstery', panel: 'Door panel', price: 95, unitType: 'each' },
      { name: 'Headliner', matrixType: 'upholstery', panel: 'Headliner', price: 180, unitType: 'each' },
      { name: 'Steering Wheel Wrap', matrixType: 'upholstery', panel: 'Steering wheel wrap', price: 45, unitType: 'each' },
      { name: 'PDR Technician Labor', matrixType: 'labor', panel: 'PDR Technician', price: 95, unitType: 'hour' },
      { name: 'Interior Specialist Labor', matrixType: 'labor', panel: 'Interior Specialist', price: 85, unitType: 'hour' },
      { name: 'Upholstery Labor', matrixType: 'labor', panel: 'Upholstery', price: 75, unitType: 'hour' },
      { name: 'Window Tint Labor', matrixType: 'labor', panel: 'Window Tint', price: 70, unitType: 'hour' },
      { name: 'Apprentice Labor', matrixType: 'labor', panel: 'Apprentice', price: 45, unitType: 'hour' },
      { name: 'Vinyl (Automotive Grade)', matrixType: 'material', panel: 'Vinyl (automotive grade)', price: 12, unitType: 'sq_ft' },
      { name: 'Leather (Automotive Grade)', matrixType: 'material', panel: 'Leather (automotive grade)', price: 25, unitType: 'sq_ft' },
      { name: 'Marine Vinyl (Sunbrella)', matrixType: 'material', panel: 'Marine vinyl (Sunbrella)', price: 18, unitType: 'sq_ft' },
      { name: 'Fabric (Upholstery)', matrixType: 'material', panel: 'Fabric (upholstery)', price: 8, unitType: 'sq_ft' },
      { name: 'Foam Cushion', matrixType: 'material', panel: 'Foam cushion', price: 6, unitType: 'sq_ft' },
      { name: 'Window Tint Film (Standard)', matrixType: 'material', panel: 'Window tint film (standard)', filmType: 'standard', price: 2.5, unitType: 'sq_ft' },
      { name: 'Window Tint Film (Ceramic)', matrixType: 'material', panel: 'Window tint film (ceramic)', filmType: 'ceramic', price: 5, unitType: 'sq_ft' },
      { name: 'Adhesive', matrixType: 'material', panel: 'Adhesive', price: 15, unitType: 'each' },
      { name: 'Thread (Upholstery)', matrixType: 'material', panel: 'Thread (upholstery)', price: 8, unitType: 'each' },
    );

    db.insert(pricingMatrices).values(pricingMatrixEntries).run();

    // Campaigns
    db.insert(campaigns).values([
      { name: 'Post-Hail Season Follow-up', campaignType: 'seasonal', status: 'active', targetSegment: 'retail', startDate: '2026-09-01', endDate: '2026-09-30', budget: 500, sentCount: 142, responseCount: 28, conversionCount: 12, notes: 'Reach out to past PDR customers after hail season' },
      { name: 'Dealership Monthly Check-in', campaignType: 'follow_up', status: 'active', targetSegment: 'dealership', startDate: '2026-09-05', endDate: '2026-09-12', budget: 200, sentCount: 8, responseCount: 5, conversionCount: 3, notes: 'Monthly check-in with dealership partners' },
      { name: 'RV Winterization Promo', campaignType: 'email', status: 'draft', targetSegment: 'commercial', startDate: '2026-10-01', endDate: '2026-10-15', budget: 800, sentCount: 0, responseCount: 0, conversionCount: 0, notes: 'Promote RV interior repairs before winter storage' },
      { name: 'Referral Rewards Program', campaignType: 'referral', status: 'active', targetSegment: 'all', startDate: '2026-08-15', endDate: '2026-12-31', budget: 1500, sentCount: 320, responseCount: 45, conversionCount: 22, notes: '$50 credit for each successful referral' },
      { name: 'Hotel/Restaurant Outreach', campaignType: 'email', status: 'draft', targetSegment: 'commercial', startDate: '2026-09-20', endDate: '2026-10-20', budget: 600, sentCount: 0, responseCount: 0, conversionCount: 0, notes: 'Target hospitality businesses for upholstery work' },
    ]).run();

    // Activities
    db.insert(activities).values([
      { customerId: createdCustomers[0].id, jobId: createdJobs[0].id, activityType: 'estimate_created', description: 'Estimate EST-2026-001 created for door dent repair', performedBy: 'Mike Torres' },
      { customerId: createdCustomers[0].id, jobId: createdJobs[0].id, activityType: 'note', description: 'Customer approved estimate over phone', performedBy: 'Mike Torres' },
      { customerId: createdCustomers[0].id, jobId: createdJobs[0].id, activityType: 'job_update', description: 'Job started - technician assigned', performedBy: 'James Wilson' },
      { customerId: createdCustomers[1].id, jobId: createdJobs[1].id, activityType: 'call', description: 'Called dealership re: hail damage assessment', performedBy: 'Mike Torres' },
      { customerId: createdCustomers[1].id, activityType: 'email', description: 'Sent hail damage estimate for insurance approval', performedBy: 'Mike Torres' },
      { customerId: createdCustomers[3].id, jobId: createdJobs[2].id, invoiceId: 2, activityType: 'payment_received', description: 'Payment received - $402.80 via credit card', performedBy: 'System' },
      { customerId: createdCustomers[4].id, jobId: createdJobs[3].id, activityType: 'note', description: 'RV owner reported additional cracking on passenger side', performedBy: 'James Wilson' },
      { customerId: createdCustomers[7].id, jobId: createdJobs[4].id, activityType: 'estimate_created', description: 'Estimate EST-2026-005 created for 120 conference chairs', performedBy: 'Mike Torres' },
      { customerId: createdCustomers[8].id, jobId: createdJobs[7].id, invoiceId: 4, activityType: 'payment_received', description: 'Payment received - $360.40 cash', performedBy: 'System' },
      { customerId: createdCustomers[5].id, jobId: createdJobs[5].id, activityType: 'email', description: 'Sent marine upholstery estimate to Idaho Boat Works', performedBy: 'Mike Torres' },
    ]).run();

    // QB Sync Log
    db.insert(qbSyncLog).values([
      { syncDirection: 'push', recordType: 'invoice', recordId: 1, qbTxnId: 'QB-INV-1001', status: 'success', message: 'Invoice INV-2026-001 pushed to QuickBooks', syncedAt: '2026-09-08T10:30:00Z' },
      { syncDirection: 'push', recordType: 'invoice', recordId: 2, qbTxnId: 'QB-INV-1002', status: 'success', message: 'Invoice INV-2026-002 pushed to QuickBooks', syncedAt: '2026-09-03T14:20:00Z' },
      { syncDirection: 'push', recordType: 'payment', recordId: 1, qbTxnId: 'QB-PMT-2001', status: 'success', message: 'Payment PMT-001 pushed to QuickBooks', syncedAt: '2026-09-03T14:25:00Z' },
      { syncDirection: 'push', recordType: 'invoice', recordId: 3, qbTxnId: 'QB-INV-1003', status: 'success', message: 'Invoice INV-2026-003 pushed to QuickBooks', syncedAt: '2026-09-07T09:15:00Z' },
      { syncDirection: 'push', recordType: 'payment', recordId: 2, qbTxnId: 'QB-PMT-2002', status: 'success', message: 'Payment PMT-002 pushed to QuickBooks', syncedAt: '2026-09-07T09:20:00Z' },
      { syncDirection: 'push', recordType: 'invoice', recordId: 4, qbTxnId: 'QB-INV-1004', status: 'success', message: 'Invoice INV-2026-004 pushed to QuickBooks', syncedAt: '2026-09-05T16:00:00Z' },
      { syncDirection: 'push', recordType: 'payment', recordId: 3, qbTxnId: 'QB-PMT-2003', status: 'success', message: 'Payment PMT-003 pushed to QuickBooks', syncedAt: '2026-09-05T16:05:00Z' },
      { syncDirection: 'pull', recordType: 'customer', status: 'success', message: 'Synced 10 customers from QuickBooks', syncedAt: '2026-09-09T08:00:00Z' },
      { syncDirection: 'push', recordType: 'invoice', recordId: 5, status: 'error', message: 'Failed to push INV-2026-005 - QB connection timeout', syncedAt: '2026-09-09T11:30:00Z' },
      { syncDirection: 'push', recordType: 'payment', recordId: 4, status: 'pending', message: 'Payment PMT-004 queued for sync', syncedAt: '2026-09-09T15:00:00Z' },
    ]).run();

    // Technicians
    db.insert(technicians).values([
      { name: 'James Wilson', email: 'james@repairco.com', phone: '(208) 555-0101', skillAreas: 'pdr,hail,interior_repair', technicianType: 'mobile', status: 'active', color: '#20808D', capacity: '3' },
      { name: 'Maria Santos', email: 'maria@repairco.com', phone: '(208) 555-0102', skillAreas: 'upholstery,interior_repair', technicianType: 'in_shop', status: 'active', color: '#A84B2F', capacity: '2' },
      { name: 'Dave Thompson', email: 'dave@repairco.com', phone: '(208) 555-0103', skillAreas: 'pdr,hail', technicianType: 'mobile', status: 'active', color: '#1B474D', capacity: '3' },
      { name: 'Sarah Chen', email: 'sarah@repairco.com', phone: '(208) 555-0104', skillAreas: 'window_tint,interior_repair', technicianType: 'in_shop', status: 'active', color: '#944454', capacity: '4' },
      { name: 'Robert Garcia', email: 'robert@repairco.com', phone: '(208) 555-0105', skillAreas: 'upholstery', technicianType: 'mobile', status: 'on_leave', color: '#848456', capacity: '2' },
      { name: 'Tyler Brooks', email: 'tyler@repairco.com', phone: '(208) 555-0106', skillAreas: 'pdr,interior_repair,window_tint', technicianType: 'mobile', status: 'active', color: '#6E522B', capacity: '3' },
    ]).run();

    // Schedule Slots
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const dayAfter = new Date(Date.now() + 172800000).toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 604800000).toISOString().split('T')[0];
    db.insert(scheduleSlots).values([
      { jobId: createdJobs[0].id, customerId: createdCustomers[0].id, technicianId: 1, date: today, startTime: '09:00', endTime: '12:00', durationHours: 3, slotType: 'work', status: 'in_progress', notes: 'Ford Edge leather seat - driver side' },
      { jobId: createdJobs[1].id, customerId: createdCustomers[0].id, technicianId: 4, date: today, startTime: '10:00', endTime: '16:00', durationHours: 6, slotType: 'work', status: 'in_progress', notes: 'Chevy Malibu full tint' },
      { jobId: createdJobs[2].id, customerId: createdCustomers[1].id, technicianId: 2, date: tomorrow, startTime: '08:00', endTime: '12:00', durationHours: 4, slotType: 'estimate', status: 'scheduled', notes: 'Hail damage assessment - 3 vehicles' },
      { jobId: createdJobs[3].id, customerId: createdCustomers[4].id, technicianId: 2, date: tomorrow, startTime: '13:00', endTime: '17:00', durationHours: 4, slotType: 'work', status: 'scheduled', notes: 'RV cabin reupholstery' },
      { jobId: createdJobs[4].id, customerId: createdCustomers[7].id, technicianId: 6, date: dayAfter, startTime: '09:00', endTime: '15:00', durationHours: 6, slotType: 'work', status: 'scheduled', notes: '120 conference room chairs' },
      { jobId: createdJobs[7].id, customerId: createdCustomers[8].id, technicianId: 2, date: today, startTime: '08:00', endTime: '11:00', durationHours: 3, slotType: 'work', status: 'completed', notes: 'Marine cabin cushions' },
      { customerId: createdCustomers[5].id, technicianId: 3, date: nextWeek, startTime: '10:00', endTime: '14:00', durationHours: 4, slotType: 'estimate', status: 'scheduled', notes: 'Boat upholstery consultation' },
    ]).run();

    // Bookings (customer-requested appointments)
    db.insert(bookings).values([
      { bookingNumber: 'BK-2026-001', customerId: createdCustomers[0].id, customerName: 'John Smith', customerEmail: 'john@email.com', customerPhone: '(208) 555-0142', vehicleInfo: '2023 Ford Edge', serviceType: 'interior_repair', bookingType: 'estimate', preferredDate: tomorrow, preferredTime: '10:00', description: 'Leather seat cracking on driver side', status: 'confirmed', confirmedDate: tomorrow, confirmedTime: '10:00', assignedTechnicianId: 1, notes: 'Customer called in, confirmed for tomorrow AM' },
      { bookingNumber: 'BK-2026-002', customerId: createdCustomers[1].id, customerName: 'Boise Auto Dealership', customerEmail: 'service@boiseauto.com', customerPhone: '(208) 555-0188', vehicleInfo: '2022 Tesla Model 3', serviceType: 'hail', bookingType: 'work', preferredDate: dayAfter, preferredTime: '08:00', description: 'Hail damage on hood and roof - insurance claim SF-2026-4471', status: 'pending', notes: 'Insurance approved, needs scheduling' },
      { bookingNumber: 'BK-2026-003', customerName: 'Jennifer Walsh', customerEmail: 'jen.walsh@email.com', customerPhone: '(208) 555-0192', vehicleInfo: '2021 Jeep Grand Cherokee', serviceType: 'window_tint', bookingType: 'estimate', preferredDate: nextWeek, preferredTime: '14:00', description: 'Interested in full vehicle tint, want to get quote first', status: 'pending' },
      { bookingNumber: 'BK-2026-004', customerName: 'Mike Pearson', customerEmail: 'mikep@email.com', customerPhone: '(208) 555-0203', vehicleInfo: '2019 Jayco RV', serviceType: 'upholstery', bookingType: 'work', preferredDate: nextWeek, preferredTime: '09:00', description: 'Cabin cushions need reupholstering - V-berth and salon', status: 'pending' },
    ]).run();

    // COI Certificates
    db.insert(coiCertificates).values([
      { customerId: createdCustomers[4].id, certificateName: 'Sun Valley RV Resort General Liability', insuranceCompany: 'Mountain West Insurance', policyNumber: 'MWI-GL-2026-8841', policyType: 'general liability', certificateHolder: 'McDowells Specialty Repair', coverageLimit: '$2,000,000 aggregate', effectiveDate: '2026-01-01', expirationDate: '2026-12-31', agentName: 'Derek Olson', agentEmail: 'derek@mountainwest.example', agentPhone: '208-555-2101', status: 'active', requiredBeforeWork: 1, notes: 'Required for all on-site RV resort work.' },
      { customerId: createdCustomers[7].id, certificateName: 'The Grove Hotel Vendor COI', insuranceCompany: 'Idaho Preferred Insurance', policyNumber: 'IPI-GL-2026-2219', policyType: 'garage keepers', certificateHolder: 'The Grove Hotel', coverageLimit: '$1,000,000 per occurrence', effectiveDate: '2026-03-01', expirationDate: '2027-02-28', agentName: 'Nicole Hart', agentEmail: 'nicole@idpreferred.example', agentPhone: '208-555-2102', status: 'active', requiredBeforeWork: 1 },
      { customerId: createdCustomers[5].id, certificateName: 'Idaho Boat Works Marine Operations COI', insuranceCompany: 'Northwest Marine Underwriters', policyNumber: 'NMU-2026-1138', policyType: 'general liability', certificateHolder: 'Idaho Boat Works', coverageLimit: '$1,000,000 per occurrence', effectiveDate: '2026-02-15', expirationDate: '2027-02-14', status: 'active', requiredBeforeWork: 0 },
    ] as any).run();

    // Third-Party Payers
    const createdPayers = [
      db.insert(thirdPartyPayers).values({ customerId: createdCustomers[1].id, payerType: 'insurance', payerName: 'State Farm Insurance', contactName: 'Lisa Park', contactTitle: 'Claims Adjuster', email: 'lpark@statefarm.com', phone: '208-555-0301', billingAddress: '500 W Front St', billingCity: 'Boise', billingState: 'ID', billingZip: '83702', accountNumber: 'SF-BOI-882', claimNumber: 'SF-2026-4471', authorizationNumber: 'AUTH-4471', poRequired: 0, approvalRequired: 1, paymentTerms: 'Net 30', taxExempt: 0, status: 'active' } as any).returning().get(),
      db.insert(thirdPartyPayers).values({ customerId: createdCustomers[6].id, payerType: 'fleet', payerName: 'Kowalski Fleet Services AP', contactName: 'Amy Kowalski', contactTitle: 'Accounts Payable Manager', email: 'ap@kowalskifleet.com', phone: '208-555-0682', billingAddress: '300 Industrial Blvd', billingCity: 'Boise', billingState: 'ID', billingZip: '83707', accountNumber: 'KFS-2026', poRequired: 1, approvalRequired: 1, paymentTerms: 'Net 30', taxExempt: 0, status: 'active' } as any).returning().get(),
      db.insert(thirdPartyPayers).values({ customerId: createdCustomers[9].id, payerType: 'dealership', payerName: 'Treasure Valley Dodge Service', contactName: 'Steve Holt', contactTitle: 'General Manager', email: 'steve@tvdodge.com', phone: '208-555-1001', billingAddress: '950 E Fairview Ave', billingCity: 'Meridian', billingState: 'ID', billingZip: '83642', accountNumber: 'TVD-SVC-001', poRequired: 1, approvalRequired: 0, paymentTerms: 'Net 15', status: 'active' } as any).returning().get(),
    ];

    // Fleet Accounts and Authorized Contacts
    const createdFleetAccounts = [
      db.insert(fleetAccounts).values({ customerId: createdCustomers[6].id, fleetName: 'Kowalski Fleet Services', fleetSize: 42, accountNumber: 'KFS-2026', billingCycle: 'monthly', paymentTerms: 'Net 30', contractedRateType: 'discount', pdrDiscountPercent: 15, hailDiscountPercent: 10, interiorDiscountPercent: 10, upholsteryDiscountPercent: '10', tintDiscountPercent: 5, laborRate: 95, poRequired: 1, authorizationRequired: 1, defaultThirdPartyPayerId: createdPayers[1].id, contractStartDate: '2026-01-01', contractEndDate: '2026-12-31', status: 'active', notes: 'Monthly consolidated billing.' } as any).returning().get(),
      db.insert(fleetAccounts).values({ customerId: createdCustomers[1].id, fleetName: 'Boise Ford Lincoln Loaner Fleet', fleetSize: 28, accountNumber: 'BFL-LF-2026', billingCycle: 'per_job', paymentTerms: 'Net 15', contractedRateType: 'matrix', pdrDiscountPercent: 12, hailDiscountPercent: 8, interiorDiscountPercent: 5, upholsteryDiscountPercent: '5', tintDiscountPercent: 0, laborRate: 100, poRequired: 0, authorizationRequired: 1, defaultThirdPartyPayerId: createdPayers[0].id, contractStartDate: '2026-01-01', contractEndDate: '2026-12-31', status: 'active' } as any).returning().get(),
      db.insert(fleetAccounts).values({ customerId: createdCustomers[9].id, fleetName: 'Treasure Valley Dodge Courtesy Fleet', fleetSize: 18, accountNumber: 'TVD-CF-2026', billingCycle: 'weekly', paymentTerms: 'Net 15', contractedRateType: 'fixed', pdrDiscountPercent: 10, hailDiscountPercent: 5, interiorDiscountPercent: 5, upholsteryDiscountPercent: '0', tintDiscountPercent: 0, laborRate: 105, poRequired: 1, authorizationRequired: 0, defaultThirdPartyPayerId: createdPayers[2].id, contractStartDate: '2026-04-01', contractEndDate: '2027-03-31', status: 'active' } as any).returning().get(),
    ];
    db.insert(fleetAuthorizedContacts).values([
      { fleetAccountId: createdFleetAccounts[0].id, customerId: createdCustomers[6].id, name: 'David Kowalski', title: 'Owner', email: 'dave@kowalskifleet.com', phone: '208-555-0680', canApproveEstimates: 1, canApproveWork: 1, canApproveInvoices: 1, approvalLimit: 5000 },
      { fleetAccountId: createdFleetAccounts[0].id, customerId: createdCustomers[6].id, name: 'Amy Kowalski', title: 'Accounts Payable Manager', email: 'ap@kowalskifleet.com', phone: '208-555-0682', canApproveEstimates: 0, canApproveWork: 0, canApproveInvoices: 1, approvalLimit: 10000 },
      { fleetAccountId: createdFleetAccounts[1].id, customerId: createdCustomers[1].id, name: 'Tom Bradley', title: 'Service Manager', email: 'tom@boiseford.com', phone: '208-555-0199', canApproveEstimates: 1, canApproveWork: 1, canApproveInvoices: 0, approvalLimit: 2500 },
    ] as any).run();

    // Warranty Claims
    db.insert(warrantyClaims).values([
      { claimNumber: 'WC-2026-001', customerId: createdCustomers[0].id, vehicleId: 1, serviceHistoryId: 1, originalJobId: createdJobs[0].id, originalInvoiceId: 1, claimDate: '2026-09-18', warrantyExpiry: '2027-09-08', status: 'inspecting', issueDescription: 'Minor paint distortion became visible around repaired door dent.', assignedTech: 'James Wilson', laborHours: 1.5, claimCost: 0, notes: 'Inspection scheduled with customer.' },
      { claimNumber: 'WC-2026-002', customerId: createdCustomers[3].id, vehicleId: 2, originalJobId: createdJobs[2].id, originalInvoiceId: 2, claimDate: '2026-09-20', warrantyExpiry: '2027-09-03', status: 'approved', issueDescription: 'Small edge lift on driver window tint.', inspectionFindings: 'Film adhesion issue at lower edge.', resolution: 'Replace driver window film.', responsibility: 'warranty', assignedTech: 'Sarah Chen', laborHours: 1, claimCost: 45, notes: 'Customer approved mobile repair.' },
      { claimNumber: 'WC-2026-003', customerId: createdCustomers[4].id, assetId: 1, originalJobId: createdJobs[3].id, originalInvoiceId: 3, claimDate: '2026-09-22', warrantyExpiry: '2027-09-07', status: 'open', issueDescription: 'New crack reported adjacent to repaired dashboard area.', assignedTech: 'James Wilson', laborHours: 0, claimCost: 0 },
    ] as any).run();

    // Asset Details
    db.insert(assetDetails).values([
      { customerId: createdCustomers[4].id, assetId: 1, assetCategory: 'rv_interior', locationName: 'Sun Valley RV Resort', building: 'Unit 14', area: 'Cockpit', itemName: 'Dashboard', itemType: 'dash', manufacturer: 'Jayco', model: 'Precept', materialType: 'vinyl', color: 'Tan', dimensions: '60 x 18 in', quantity: 1, condition: 'fair', damageLocation: 'Passenger side', damageDescription: 'Cracking and peeling vinyl.', repairNotes: 'Color-match vinyl repair compound.', replacementValue: 1200, status: 'active' },
      { customerId: createdCustomers[7].id, assetId: 2, assetCategory: 'office_furniture', locationName: 'The Grove Hotel', building: 'Conference Center', floor: '2', roomNumber: 'Aspen A', itemName: 'Conference Chair', itemType: 'chair', manufacturer: 'Steelcase', model: 'Think', materialType: 'fabric', fabricType: 'Commercial weave', color: 'Charcoal', quantity: 120, condition: 'fair', damageLocation: 'Seats and backs', damageDescription: 'Worn fabric and staining.', replacementValue: 36000, status: 'active' },
      { customerId: createdCustomers[5].id, assetId: 4, assetCategory: 'marine_seat', locationName: 'Idaho Boat Works', area: 'Sundancer 320 cabin', itemName: 'V-berth Cushion Set', itemType: 'cushion', manufacturer: 'Sea Ray', model: 'Sundancer 320', materialType: 'marine_vinyl', fabricType: 'Sunbrella', color: 'Navy', quantity: 4, condition: 'poor', damageLocation: 'V-berth', damageDescription: 'Sun fading and cracked seams.', replacementValue: 3600, status: 'active' },
    ] as any).run();

    // Tax Jurisdictions
    db.insert(taxJurisdictions).values([
      { jurisdictionName: 'Boise City Sales Tax', city: 'Boise', county: 'Ada', state: 'ID', zip: '83702', taxRate: 6, taxCode: 'ID-BOI-06', qbTaxCode: 'ID SALES', taxExemptAllowed: 1, status: 'active' },
      { jurisdictionName: 'Meridian Sales Tax', city: 'Meridian', county: 'Ada', state: 'ID', zip: '83646', taxRate: 6, taxCode: 'ID-MER-06', qbTaxCode: 'ID SALES', taxExemptAllowed: 1, status: 'active' },
      { jurisdictionName: 'Nampa Sales Tax', city: 'Nampa', county: 'Canyon', state: 'ID', zip: '83686', taxRate: 6, taxCode: 'ID-NAM-06', qbTaxCode: 'ID SALES', taxExemptAllowed: 1, status: 'active' },
    ] as any).run();
  }
}

export const storage = new DatabaseStorage();
import { actorLabel } from "./security-context";
