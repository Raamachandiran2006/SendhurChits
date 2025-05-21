
"use client";

import type { User, Employee } from "@/types";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  runTransaction,
  updateDoc,
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  loggedInEntity: User | Employee | null; 
  userType: 'user' | 'admin' | 'employee' | null; 
  loading: boolean;
  login: (phone: string, passwordInput: string) => Promise<void>;
  signup: (userData: Omit<User, "id" | "username" | "groups" | "isAdmin" | "password"> & {password: string}) => Promise<void>;
  logout: () => void;
  clearSalaryNotificationForEmployee: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [loggedInEntity, setLoggedInEntity] = useState<User | Employee | null>(null);
  const [userType, setUserType] = useState<'user' | 'admin' | 'employee' | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const storedEntity = localStorage.getItem("chitConnectEntity");
    const storedUserType = localStorage.getItem("chitConnectUserType") as 'user' | 'admin' | 'employee' | null;
    
    if (storedEntity && storedUserType) {
      setLoggedInEntity(JSON.parse(storedEntity));
      setUserType(storedUserType);
    }
    setLoading(false);
  }, []);

  const login = async (phoneInput: string, passwordInput: string) => {
    setLoading(true);
    try {
      const usersRef = collection(db, "users");
      const userQuery = query(usersRef, where("phone", "==", phoneInput));
      const userQuerySnapshot = await getDocs(userQuery);

      if (!userQuerySnapshot.empty) {
        const userData = userQuerySnapshot.docs[0].data() as Omit<User, "id">;
        const userId = userQuerySnapshot.docs[0].id;

        if (userData.password !== passwordInput) {
          toast({ title: "Login Failed", description: "Invalid phone number or password.", variant: "destructive" });
          setLoading(false);
          return;
        }
        
        const entity: User = { ...userData, id: userId };
        setLoggedInEntity(entity);
        localStorage.setItem("chitConnectEntity", JSON.stringify(entity));

        const isAdminUser = entity.username === "admin" || !!entity.isAdmin;
        const currentType = isAdminUser ? 'admin' : 'user';
        setUserType(currentType);
        localStorage.setItem("chitConnectUserType", currentType);

        toast({ title: "Login Successful", description: `Welcome back, ${entity.fullname}!` });
        if (isAdminUser) {
          router.push("/admin");
        } else {
          router.push("/dashboard");
        }
        setLoading(false);
        return;
      }

      const employeesRef = collection(db, "employees");
      const employeeQuery = query(employeesRef, where("phone", "==", phoneInput));
      const employeeQuerySnapshot = await getDocs(employeeQuery);

      if (!employeeQuerySnapshot.empty) {
        const employeeData = employeeQuerySnapshot.docs[0].data() as Omit<Employee, "id">;
        const employeeId = employeeQuerySnapshot.docs[0].id;
        
        if (employeeData.password !== passwordInput) { 
          toast({ title: "Login Failed", description: "Invalid phone number or password.", variant: "destructive" });
          setLoading(false);
          return;
        }

        const entity: Employee = { ...employeeData, id: employeeId };
        setLoggedInEntity(entity);
        localStorage.setItem("chitConnectEntity", JSON.stringify(entity));
        setUserType('employee');
        localStorage.setItem("chitConnectUserType", 'employee');
        
        toast({ title: "Login Successful", description: `Welcome back, ${entity.fullname}!` });
        router.push("/employee/dashboard");
        setLoading(false);
        return;
      }

      toast({ title: "Login Failed", description: "Invalid phone number or password.", variant: "destructive" });

    } catch (error) {
      console.error("Login error:", error);
      toast({ title: "Login Error", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const signup = async (userData: Omit<User, "id" | "username" | "groups" | "isAdmin" | "password"> & {password: string}) => {
    setLoading(true);
    try {
      const phoneQuery = query(collection(db, "users"), where("phone", "==", userData.phone));
      const phoneSnapshot = await getDocs(phoneQuery);
      if (!phoneSnapshot.empty) {
        toast({ title: "Signup Failed", description: "Phone number already registered.", variant: "destructive" });
        setLoading(false);
        return;
      }

      const counterRef = doc(db, "metadata", "counters");
      let newUsername = ""; 

      await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let userCount = 0;
        if (!counterDoc.exists() || !counterDoc.data()?.userCount) {
          transaction.set(counterRef, { userCount: 1 }, {merge: true});
          userCount = 0; 
        } else {
          userCount = counterDoc.data().userCount;
          transaction.update(counterRef, { userCount: userCount + 1 });
        }
        newUsername = `user${String(userCount + 1).padStart(3, "0")}`;
      });
      
      const newUserDocRef = doc(collection(db, "users")); 
      const newUserOmitId: Omit<User, "id"> = {
        username: newUsername, 
        fullname: userData.fullname,
        phone: userData.phone, 
        dob: userData.dob,
        password: userData.password, 
        address: userData.address,
        referralPerson: userData.referralPerson || "",
        aadhaarCardUrl: userData.aadhaarCardUrl || "",
        panCardUrl: userData.panCardUrl || "",
        photoUrl: userData.photoUrl || "",
        groups: [], 
        isAdmin: newUsername === "admin", 
      };

      await setDoc(newUserDocRef, newUserOmitId);
      
      toast({ title: "Signup Successful", description: `Welcome, ${newUserOmitId.fullname}! You can now log in with your phone number.` });
      router.push("/login");
    } catch (error) {
      console.error("Signup error:", error);
      toast({ title: "Signup Error", description: "An unexpected error occurred during signup.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setLoggedInEntity(null);
    setUserType(null);
    localStorage.removeItem("chitConnectEntity");
    localStorage.removeItem("chitConnectUserType");
    router.push("/login");
    toast({ title: "Logged Out", description: "You have been successfully logged out." });
  };

  const clearSalaryNotificationForEmployee = async () => {
    if (loggedInEntity && userType === 'employee' && 'hasUnreadSalaryNotification' in loggedInEntity && loggedInEntity.hasUnreadSalaryNotification) {
      try {
        const employeeDocRef = doc(db, "employees", loggedInEntity.id);
        await updateDoc(employeeDocRef, { hasUnreadSalaryNotification: false });
        
        const updatedEmployeeEntity = { ...loggedInEntity, hasUnreadSalaryNotification: false };
        setLoggedInEntity(updatedEmployeeEntity);
        localStorage.setItem("chitConnectEntity", JSON.stringify(updatedEmployeeEntity));

      } catch (error) {
        console.error("Error clearing salary notification:", error);
        toast({ title: "Error", description: "Could not clear salary notification.", variant: "destructive" });
      }
    }
  };


  return (
    <AuthContext.Provider value={{ loggedInEntity, userType, loading, login, signup, logout, clearSalaryNotificationForEmployee }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
