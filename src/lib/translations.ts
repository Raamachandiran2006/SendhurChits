
export type Language = 'en' | 'ta';

export const translations = {
  en: {
    adminOverview: "Admin Overview",
    totalUsers: "Total Users",
    totalGroups: "Total Groups",
    totalEmployees: "Total Employees",
    systemStatus: "System Status",
    operational: "Operational",
    quickActions: "Quick Actions",
    manageUsers: "Manage Users",
    manageGroups: "Manage Groups",
    manageEmployees: "Manage Employees",
    createGroup: "Create Group",
    welcomeAdmin: "Welcome, {name}!", // Placeholder for dynamic name
    adminTips: "Here are some tips for managing ChitConnect:",
    sidebarOverview: "Overview",
    sidebarManageUsers: "Manage Users",
    sidebarManageGroups: "Manage Groups",
    sidebarCreateGroup: "Create Group",
    sidebarManageEmployees: "Manage Employees",
    sidebarPayments: "Payments",
    sidebarLogout: "Logout",
    language: "Language",
    english: "English",
    tamil: "Tamil",
  },
  ta: {
    adminOverview: "நிர்வாக கண்ணோட்டம்", // Tamil: Admin Overview
    totalUsers: "மொத்த பயனர்கள்", // Tamil: Total Users
    totalGroups: "மொத்த குழுக்கள்", // Tamil: Total Groups
    totalEmployees: "மொத்த ஊழியர்கள்", // Tamil: Total Employees
    systemStatus: "கணினி நிலை", // Tamil: System Status
    operational: "செயல்பாட்டில் உள்ளது", // Tamil: Operational
    quickActions: "விரைவு நடவடிக்கைகள்", // Tamil: Quick Actions
    manageUsers: "பயனர்களை நிர்வகி", // Tamil: Manage Users
    manageGroups: "குழுக்களை நிர்வகி", // Tamil: Manage Groups
    manageEmployees: "ஊழியர்களை நிர்வகி", // Tamil: Manage Employees
    createGroup: "புதிய குழுவை உருவாக்கு", // Tamil: Create Group
    welcomeAdmin: "வரவேற்கிறோம், {name}!", // Tamil: Welcome, {name}!
    adminTips: "சிட்கனெக்டை நிர்வகிப்பதற்கான சில குறிப்புகள் இங்கே:", // Tamil: Admin Tips
    sidebarOverview: "கண்ணோட்டம்", // Tamil: Overview
    sidebarManageUsers: "பயனர்களை நிர்வகி", // Tamil: Manage Users
    sidebarManageGroups: "குழுக்களை நிர்வகி", // Tamil: Manage Groups
    sidebarCreateGroup: "குழுவை உருவாக்கு", // Tamil: Create Group
    sidebarManageEmployees: "ஊழியர்களை நிர்வகி", // Tamil: Manage Employees
    sidebarPayments: "பணம் செலுத்துதல்", // Tamil: Payments
    sidebarLogout: "வெளியேறு", // Tamil: Logout
    language: "மொழி", // Tamil: Language
    english: "ஆங்கிலம்", // Tamil: English
    tamil: "தமிழ்", // Tamil: Tamil
  }
};

// This helps with type safety and autocompletion for keys
export type TranslationKeys = keyof typeof translations.en;
