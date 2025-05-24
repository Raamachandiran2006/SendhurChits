
export interface User {
  id: string; // Firestore document ID
  username: string; // Auto-generated unique ID (e.g., user001), not for login
  fullname: string;
  phone: string; // Used for login, must be unique
  dob: string; // YYYY-MM-DD
  password?: string; // Stored for custom auth, SHOULD BE HASHED in a real app
  address: string;
  referralSourceName?: string;
  referralSourcePhone?: string;
  referralSourceAddress?: string;
  aadhaarCardUrl?: string;
  panCardUrl?: string;
  photoUrl?: string;
  groups: string[]; // Array of group IDs
  isAdmin?: boolean;
  dueAmount?: number; // Optional: due amount for the user
  dueType?: "Day" | "Week" | "Month";
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
  penaltyPercentage?: number;
  biddingType?: "auction" | "random" | "pre-fixed"; // Optional: type of bidding
  minBid?: number; // Optional: min bid amount
  auctionMonth?: string;
  auctionScheduledDate?: string; // e.g., "YYYY-MM-DD" or descriptive string
  auctionScheduledTime?: string; // e.g., "03:00 PM"
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
  virtualTransactionId?: string;
}

export interface AuctionRecord {
  id: string; // Firestore document ID for this auction record
  groupId: string; // Firestore doc ID of the group
  groupName: string;
  auctionNumber?: number;
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
  netDiscount?: number | null;
  dividendPerMember?: number | null;
  finalAmountToBePaid?: number | null; // This is the installment paid by all members (including winner)
  amountPaidToWinner?: number | null; // DEPRECATED - To be removed manually from Firestore
  recordedAt: import('firebase/firestore').Timestamp;
  virtualTransactionId?: string;
}

export interface ExpenseRecord {
  id: string; // Firestore document ID
  type: 'spend' | 'received';
  date: string; // YYYY-MM-DD
  time?: string | null; // HH:MM AM/PM for spend, optional for received
  amount: number;
  reason?: string | null; // For spend
  fromPerson?: string | null; // For received
  paymentMode?: 'Cash' | 'UPI' | 'Netbanking' | null; // For received
  remarks?: string | null;
  recordedAt: import('firebase/firestore').Timestamp;
  virtualTransactionId?: string;
}

export interface CollectionRecord { // For payments RECEIVED FROM CUSTOMERS
  id: string; // Firestore document ID
  groupId: string;
  groupName: string;
  auctionId?: string | null;     // New field
  auctionNumber?: number | null; // New field
  userId: string;
  userUsername: string;
  userFullname: string;
  paymentDate: string; // YYYY-MM-DD
  paymentTime: string; // HH:MM AM/PM
  paymentType: "Full Payment" | "Partial Payment";
  paymentMode: "Cash" | "UPI" | "Netbanking";
  amount: number;
  remarks?: string | null;
  recordedAt: import('firebase/firestore').Timestamp;
  collectionLocation?: string | null;
  recordedByEmployeeId?: string | null;
  recordedByEmployeeName?: string | null;
  virtualTransactionId?: string;
}

// For payments MADE BY THE COMPANY (e.g., to auction winners, other payouts recorded by admin)
export interface PaymentRecord {
  id: string; // Firestore document ID
  groupId?: string | null;
  groupName?: string | null;
  auctionId?: string | null;
  auctionNumber?: number | null;
  userId?: string | null;
  userUsername?: string | null;
  userFullname?: string | null;
  paymentDate: string; // YYYY-MM-DD
  paymentTime: string; // HH:MM AM/PM
  paymentMode: "Cash" | "UPI" | "Netbanking" | "Cheque";
  amount: number;
  remarks?: string | null;
  recordedAt: import('firebase/firestore').Timestamp;
  recordedBy?: "Admin" | string; // Can be admin or employee ID
  virtualTransactionId?: string;
  // Guarantor fields
  guarantorFullName?: string;
  guarantorRelationship?: string;
  guarantorPhone?: string;
  guarantorAddress?: string;
  guarantorAadhaarNumber?: string;
  guarantorPanCardNumber?: string;
  guarantorAuthDocUrl?: string;
}
