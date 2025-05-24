
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
    adminOverview: "அட்மின் ஓவர்வியூ",
    totalUsers: "டோட்டல் யூசர்ஸ்",
    totalGroups: "டோட்டல் குரூப்ஸ்",
    totalEmployees: "டோட்டல் எம்ப்ளாயீஸ்",
    systemStatus: "சிஸ்டம் ஸ்டேட்டஸ்",
    operational: "ஆப்பரேஷனல்",
    quickActions: "குயிக் ஆக்ஷன்ஸ்",
    manageUsers: "மேனேஜ் யூசர்ஸ்",
    manageGroups: "மேனேஜ் குரூப்ஸ்",
    manageEmployees: "மேனேஜ் எம்ப்ளாயீஸ்",
    createGroup: "கிரியேட் குரூப்",
    welcomeAdmin: "வெல்கம், {name}!", 
    adminTips: "சிட்கனெக்டை நிர்வகிப்பதற்கான சில குறிப்புகள்:", // This can stay more traditional Tamil if preferred
    sidebarOverview: "ஓவர்வியூ",
    sidebarManageUsers: "மேனேஜ் யூசர்ஸ்",
    sidebarManageGroups: "மேனேஜ் குரூப்ஸ்",
    sidebarCreateGroup: "கிரியேட் குரூப்",
    sidebarManageEmployees: "மேனேஜ் எம்ப்ளாயீஸ்",
    sidebarPayments: "பேமெண்ட்ஸ்",
    sidebarLogout: "லாக்அவுட்",
    language: "லாங்குவேஜ்",
    english: "இங்கிலீஷ்",
    tamil: "தமிழ்",
  }
};

// This helps with type safety and autocompletion for keys
export type TranslationKeys = keyof typeof translations.en;

