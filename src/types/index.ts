export interface User {
  id: string; // Firestore document ID
  username: string;
  fullname: string;
  phone: string;
  dob: string; // YYYY-MM-DD
  password?: string; // Stored for custom auth, SHOULD BE HASHED in a real app
  groups: string[]; // Array of group IDs
  isAdmin?: boolean;
}

export interface Group {
  id: string; // Firestore document ID
  groupName: string;
  description: string;
  totalPeople: number;
  totalAmount: number;
  members: string[]; // Array of usernames
}
