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
  tenure?: string; // e.g., "10 months", "1 year"
  startDate?: string; // YYYY-MM-DD
}
