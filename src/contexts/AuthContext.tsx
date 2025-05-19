
"use client";

import type { User } from "@/types";
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
  getDoc,
  runTransaction,
  Timestamp,
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  login: (usernameOrPhone: string, passwordInput: string) => Promise<void>;
  signup: (userData: Omit<User, "id" | "username" | "groups" | "isAdmin" | "password"> & {password: string}) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const storedUser = localStorage.getItem("chitConnectUser");
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser) as User;
      setUser(parsedUser);
      setIsAdmin(parsedUser.username === "admin" || !!parsedUser.isAdmin); // 'admin' is always admin
    }
    setLoading(false);
  }, []);

  const login = async (usernameInput: string, passwordInput: string) => {
    setLoading(true);
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("username", "==", usernameInput));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({ title: "Login Failed", description: "Invalid username or password.", variant: "destructive" });
        setLoading(false);
        return;
      }

      const userData = querySnapshot.docs[0].data() as Omit<User, "id">;
      const userId = querySnapshot.docs[0].id;

      if (userData.password !== passwordInput) { // Direct password comparison (NOT SECURE for production)
        toast({ title: "Login Failed", description: "Invalid username or password.", variant: "destructive" });
        setLoading(false);
        return;
      }
      
      const loggedInUser: User = { ...userData, id: userId };
      setUser(loggedInUser);
      localStorage.setItem("chitConnectUser", JSON.stringify(loggedInUser));
      const isAdminUser = loggedInUser.username === "admin" || !!loggedInUser.isAdmin;
      setIsAdmin(isAdminUser);
      toast({ title: "Login Successful", description: `Welcome back, ${loggedInUser.fullname}!` });
      if (isAdminUser) {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
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
      // Check if phone number already exists
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
        if (!counterDoc.exists()) {
          transaction.set(counterRef, { userCount: 1 });
          userCount = 0;
        } else {
          userCount = counterDoc.data().userCount;
          transaction.update(counterRef, { userCount: userCount + 1 });
        }
        newUsername = `user${String(userCount + 1).padStart(3, "0")}`;
      });
      
      const newUserDocRef = doc(collection(db, "users"));
      const newUser: Omit<User, "id"> = {
        ...userData,
        username: newUsername,
        groups: [],
        isAdmin: newUsername === "admin", // First user or 'admin' could be admin
      };

      await setDoc(newUserDocRef, newUser);
      
      toast({ title: "Signup Successful", description: `Welcome, ${newUser.fullname}! Your username is ${newUser.username}.` });
      router.push("/login");
    } catch (error) {
      console.error("Signup error:", error);
      toast({ title: "Signup Error", description: "An unexpected error occurred during signup.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setIsAdmin(false);
    localStorage.removeItem("chitConnectUser");
    router.push("/login");
    toast({ title: "Logged Out", description: "You have been successfully logged out." });
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, login, signup, logout }}>
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
