
export interface User {
  id: string; // Firestore document ID
  username: string; // Auto-generated unique ID (e.g., user001), not for login
  fullname: string;
  phone: string; // Used for login, must be unique
  dob: string; // YYYY-MM-DD
  password?: string; // Stored for custom auth, SHOULD BE HASHED in a real app
  address: string;
  referralPerson?: string;
  aadhaarCardUrl?: string;
  panCardUrl?: string;
  photoUrl?: string;
  groups: string[]; // Array of group IDs
  isAdmin?: boolean;
}

export interface Group {
  id: string; // Firestore document ID
  groupName: string;
  description: string;
  totalPeople: number;
  totalAmount: number;
  members: string[]; // Array of usernames (the auto-generated ones)
  tenure?: number; // Number of months
  startDate?: string; // YYYY-MM-DD
  rate?: number; // Monthly installment amount
  commission?: number; // Optional: foreman commission percentage
  biddingType?: "auction" | "random" | "pre-fixed"; // Optional: type of bidding
  minBid?: number; // Optional: minimum bid amount
}

export interface Employee {
  id: string; // Firestore document ID
  employeeId: string; // Auto-generated unique ID (e.g., EMP001)
  fullname: string;
  phone: string; // Used for login, must be unique
  dob: string; // YYYY-MM-DD
  password?: string; // Stored for custom auth, SHOULD BE HASHED
  address: string;
  aadhaarNumber?: string; // 12-digit number
  panCardNumber?: string; // 10-character alphanumeric
  photoUrl?: string;
  role: string; // e.g., "Manager", "Agent", "Accountant"
  joiningDate: string; // YYYY-MM-DD
  salary?: number; // Optional monthly salary
}

export interface SalaryRecord {
  id: string; // Firestore document ID
  employeeDocId: string; // Firestore document ID of the employee from 'employees' collection
  employeeReadableId: string; // Human-readable employeeId (e.g., EMP001)
  employeeName: string; // Full name of the employee for easier display
  amount: number;
  paymentDate: string; // YYYY-MM-DD
  remarks?: string;
  recordedAt: import('firebase/firestore').Timestamp; // Firestore Timestamp
}
