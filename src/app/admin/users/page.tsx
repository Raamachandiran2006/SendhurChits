
"use client";

import { useEffect, useState } from "react";
import type { User } from "@/types";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Users, PlusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext"; // Import useLanguage

export default function AdminUsersPage() {
  const { t } = useLanguage(); // Get translation function
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, orderBy("fullname")); 
        const querySnapshot = await getDocs(q);
        const fetchedUsers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
        setUsers(fetchedUsers);
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const formatDateSafe = (dateString: string | undefined | null): string => {
    if (!dateString) {
      return t('common.notAvailable');
    }
    try {
      const date = parseISO(dateString);
      if (isNaN(date.getTime())) {
        return t('common.notAvailable');
      }
      return format(date, "dd MMM yyyy");
    } catch (e) {
      console.warn("Date formatting error for:", dateString, e);
      return t('common.notAvailable');
    }
  };

  const handleUserRowClick = (userId: string) => {
    router.push(`/admin/users/${userId}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8">
        <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-primary"/>
            <div>
                <h1 className="text-3xl font-bold text-foreground">{t('adminUsersPageTitle')}</h1>
                <p className="text-muted-foreground">{t('adminUsersPageDescription')}</p>
            </div>
        </div>
        <Button asChild className="mt-4 sm:mt-0 bg-accent text-accent-foreground hover:bg-accent/90">
          <Link href="/admin/users/create">
            <PlusCircle className="mr-2 h-4 w-4" /> {t('adminUsersCreateUserButton')}
          </Link>
        </Button>
      </div>

      <Card className="shadow-xl">
        <CardHeader>
           {/* Title moved up */}
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground">{t('adminUsersNoUsersFound')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('adminUsersTableFullName')}</TableHead>
                    <TableHead>{t('adminUsersTableUsernameId')}</TableHead>
                    <TableHead>{t('adminUsersTablePhone')}</TableHead>
                    <TableHead>{t('adminUsersTableDob')}</TableHead>
                    <TableHead>{t('adminUsersTableRole')}</TableHead>
                    <TableHead className="text-right">{t('adminUsersTableGroupsJoined')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow 
                      key={user.id} 
                      onClick={() => handleUserRowClick(user.id)}
                      className="cursor-pointer hover:bg-muted/70 transition-colors"
                    >
                      <TableCell className="font-medium">{user.fullname}</TableCell><TableCell>{user.username}</TableCell><TableCell>{user.phone}</TableCell><TableCell>{formatDateSafe(user.dob)}</TableCell><TableCell>{user.isAdmin || user.username === 'admin' ? (<Badge variant="destructive">{t('common.admin')}</Badge>) : (<Badge variant="secondary">{t('common.user')}</Badge>)}</TableCell><TableCell className="text-right">{user.groups?.length || 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

    