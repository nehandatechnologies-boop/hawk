export type Role = "Administrator" | "Security Officer" | "Operator" | "Supervisor" | "Auditor" | "Viewer";

/**
 * Subject categories — drives alert priority and UI badges.
 * "Personnel" naming is kept on the wire/types for backward compatibility
 * with the in-memory store and the original REST contract; the UI surfaces
 * them as "Persons of Interest / Subjects".
 */
export type SubjectCategory = "Wanted" | "Missing" | "Person of Interest" | "Cleared";
export type DangerLevel = "Armed & Dangerous" | "Caution" | "Non-violent" | "Unknown";
export type PersonnelStatus = "Active" | "Inactive" | "Located" | "Apprehended" | "Archived";

export interface Personnel {
  id: string;
  /** Case / file number used for cross-referencing with police / NGO partners. */
  employeeNumber: string;
  /** National ID, where available. */
  nationalId: string;
  firstName: string;
  lastName: string;
  /** Issuing agency or originating unit (e.g. "ZRP CID", "Interpol", "Family"). */
  department: string;
  /** Role/title — repurposed as physical descriptor headline (e.g. "Bank fraud suspect"). */
  position: string;
  phone: string;
  email: string;
  status: PersonnelStatus;
  photoUrl?: string;
  createdAt: string;

  // -- Subject-specific intelligence fields --
  category?: SubjectCategory;
  dangerLevel?: DangerLevel;
  /** Free-form aliases, comma-separated. */
  aliases?: string;
  dateOfBirth?: string;
  gender?: "Male" | "Female" | "Other" | "Unknown";
  /** Last reported sighting (free-text location). */
  lastSeenLocation?: string;
  lastSeenAt?: string;
  /** Long-form intelligence notes / charges / circumstances. */
  notes?: string;
}

export type AssetStatus = "In Use" | "Available" | "Maintenance" | "Retired";
export interface Asset {
  id: string;
  assetId: string;
  name: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  category: string;
  department: string;
  assignedUser?: string;
  purchaseDate: string;
  warrantyUntil: string;
  status: AssetStatus;
  imageUrl?: string;
  barcode: string;
}

export type CameraStatus = "Online" | "Offline" | "Degraded";
export interface Camera {
  id: string;
  name: string;
  location: string;
  building: string;
  floor: string;
  rtspUrl: string;
  status: CameraStatus;
  resolution: string;
  lastHeartbeat: string;
  notes?: string;
  latitude?: number | null;
  longitude?: number | null;
}


export type AlertPriority = "Critical" | "High" | "Medium" | "Low";
export type AlertStatus = "Open" | "Acknowledged" | "Resolved" | "Closed";
export interface SecurityAlert {
  id: string;
  title: string;
  priority: AlertPriority;
  status: AlertStatus;
  assignedOfficer?: string;
  source: string;
  timestamp: string;
  description: string;
  /** Optional subject linkage so the alerts feed can deep-link back to the file. */
  subjectId?: string;
  subjectCategory?: SubjectCategory;
  cameraId?: string;
  confidence?: number;
  latitude?: number | null;
  longitude?: number | null;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  head: string;
  headcount: number;
}

export interface AuditEntry {
  id: string;
  user: string;
  action: string;
  module: string;
  recordId: string;
  ipAddress: string;
  timestamp: string;
}

export interface DashboardStats {
  totalPersonnel: number;
  activePersonnel: number;
  totalAssets: number;
  onlineCameras: number;
  totalCameras: number;
  openAlerts: number;
  closedAlerts: number;
  todayActivity: number;
  systemHealth: number;
  monthlyAlerts: { month: string; critical: number; high: number; medium: number; low: number }[];
  assetDistribution: { name: string; value: number }[];
  personnelDistribution: { department: string; count: number }[];
  cameraStatus: { name: string; value: number }[];
  /** Subjects broken down by category — drives the dashboard donut. */
  subjectCategories?: { name: string; value: number }[];
  recentActivity: { id: string; user: string; action: string; time: string }[];
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  operatorId?: string | null;
  status?: string;
}
