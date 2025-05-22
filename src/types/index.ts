
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
  dueAmount?: number; // Optional: due amount for the user
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
  auctionMonth?: string;
  auctionScheduledDate?: string; // e.g., "YYYY-MM-DD" or descriptive string
  auctionScheduledTime?: string; // e.g., "03:00 PM IST"
  lastAuctionWinner?: string; // e.g., username or "To be determined"
  lastWinningBidAmount?: number; 
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
  hasUnreadSalaryNotification?: boolean;
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

export interface AuctionRecord {
  id: string; // Firestore document ID for this auction record
  groupId: string; // Firestore doc ID of the group
  groupName: string;
  auctionNumber?: number; // Explicit auction number
  auctionMonth: string; // e.g., "August 2024"
  auctionDate: string; // YYYY-MM-DD
  auctionTime: string; // e.g., "03:00 PM"
  auctionMode?: string;
  winnerUserId: string; // Firestore doc ID of the winning User
  winnerFullname: string;
  winnerUsername: string; // The user00X style ID of the winner
  winningBidAmount: number;
  discount?: number | null;
  commissionAmount?: number | null;
  netDiscount?: number | null; // Added
  dividendPerMember?: number | null; // Added
  finalAmountToBePaid?: number | null; // This will store the final amount for other members
  recordedAt: import('firebase/firestore').Timestamp;
}

