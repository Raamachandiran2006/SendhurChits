
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Group, User } from "@/types";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, deleteDoc, writeBatch, arrayRemove } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { 
  Loader2, 
  ArrowLeft, 
  Users as UsersIconLucide, 
  User as UserIcon, 
  Info, 
  AlertTriangle, 
  Phone, 
  Mail, 
  CalendarDays, 
  Landmark, 
  Clock, 
  Tag, 
  LandmarkIcon as GroupLandmarkIcon, 
  SearchCode,
  Trash2,
  Megaphone, 
  CalendarClock 
} from "lucide-react";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

// Helper function to format date safely
const formatDateSafe = (dateString: string | undefined | null, outputFormat: string = "dd MMM yyyy") => {
  if (!dateString) return "N/A";
  try {
    const date = dateString.includes('T') ? parseISO(dateString) : new Date(dateString + 'T00:00:00');
    if (isNaN(date.getTime())) return "N/A";
    return format(date, outputFormat);
  } catch (e) {
    return "N/A";
  }
};

const getBiddingTypeLabel = (type: string | undefined) => {
  if (!type) return "N/A";
  switch (type) {
    case "auction": return "Auction Based";
    case "random": return "Random Draw";
    case "pre-fixed": return "Pre-fixed";
    default: return type; 
  }
};

export default function AdminGroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const groupId = params.groupId as string;

  const [group, setGroup] = useState<Group | null>(null);
  const [membersDetails, setMembersDetails] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");

  useEffect(() => {
    if (!groupId) {
      setError("Group ID is missing.");
      setLoading(false);
      return;
    }

    const fetchGroupAndMembers = async () => {
      setLoading(true);
      setError(null);
      try {
        const groupDocRef = doc(db, "groups", groupId);
        const groupDocSnap = await getDoc(groupDocRef);

        if (!groupDocSnap.exists()) {
          setError("Group not found.");
          setLoading(false);
          return;
        }
        const groupData = { id: groupDocSnap.id, ...groupDocSnap.data() } as Group;
        setGroup(groupData);

        if (groupData.members && groupData.members.length > 0) {
          const memberUsernames = groupData.members;
          const fetchedMembers: User[] = [];
          const batchSize = 30; 

          for (let i = 0; i < memberUsernames.length; i += batchSize) {
            const batchUsernames = memberUsernames.slice(i, i + batchSize);
            if (batchUsernames.length > 0) {
              const usersRef = collection(db, "users");
              const q = query(usersRef, where("username", "in", batchUsernames));
              const querySnapshot = await getDocs(q);
              querySnapshot.docs.forEach(docSnap => {
                fetchedMembers.push({ id: docSnap.id, ...docSnap.data() } as User);
              });
            }
          }
          setMembersDetails(fetchedMembers);
        } else {
          setMembersDetails([]);
        }
      } catch (err) {
        console.error("Error fetching group details:", err);
        setError("Failed to fetch group details. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchGroupAndMembers();
  }, [groupId]);

  const handleDeleteGroup = async () => {
    if (!group || deleteConfirmationText !== "delete") return;

    setIsDeleting(true);
    try {
      const groupDocRef = doc(db, "groups", groupId);
      
      const batchDB = writeBatch(db);
      const usersToUpdateQuery = query(collection(db, "users"), where("groups", "array-contains", groupId));
      const usersToUpdateSnapshot = await getDocs(usersToUpdateQuery);
      
      usersToUpdateSnapshot.forEach(userDoc => {
        batchDB.update(userDoc.ref, {
          groups: arrayRemove(groupId)
        });
      });
      
      await batchDB.commit();
      
      await deleteDoc(groupDocRef);

      toast({
        title: "Group Deleted",
        description: `Group "${group.groupName}" and its member associations have been successfully deleted.`,
      });
      router.push("/admin/groups");
    } catch (err) {
      console.error("Error deleting group:", err);
      toast({
        title: "Error Deleting Group",
        description: "Failed to delete the group. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteConfirmationText("");
    }
  };


  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-foreground">Loading group details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 text-center">
        <Card className="max-w-md mx-auto shadow-lg">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center justify-center">
              <AlertTriangle className="mr-2 h-6 w-6" /> Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={() => router.push("/admin/groups")} className="mt-6">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Groups
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!group) {
    return <div className="container mx-auto py-8 text-center text-muted-foreground">Group data not available.</div>;
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex justify-between items-center mb-6">
        <Button variant="outline" onClick={() => router.push("/admin/groups")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Groups
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" /> Delete Group
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the group
                <strong className="text-foreground"> {group.groupName} </strong> 
                and remove it from all associated users. Type "delete" to confirm.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input 
              type="text"
              placeholder='Type "delete" to confirm'
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
              className="my-2"
            />
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteConfirmationText("")}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteGroup}
                disabled={deleteConfirmationText !== "delete" || isDeleting}
                className="bg-destructive hover:bg-destructive/90"
              >
                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <UsersIconLucide className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl font-bold text-foreground">{group.groupName}</CardTitle>
              <CardDescription>{group.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center">
            <UsersIconLucide className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Capacity: {group.totalPeople} members</span>
          </div>
          <div className="flex items-center">
            <Badge variant="secondary">Members: {group.members.length} / {group.totalPeople}</Badge>
          </div>
          <div className="flex items-center">
            <Landmark className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Total Amount: ₹{group.totalAmount.toLocaleString()}</span>
          </div>
          <div className="flex items-center">
            <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Tenure: {group.tenure ? `${group.tenure} months` : "N/A"}</span>
          </div>
          <div className="flex items-center">
            <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Start Date: {formatDateSafe(group.startDate)}</span>
          </div>
            <div className="flex items-center">
            <Info className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Group ID: {group.id}</span>
          </div>
          {group.rate !== undefined && (
            <div className="flex items-center">
              <GroupLandmarkIcon className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Monthly Installment: ₹{group.rate.toLocaleString()}</span>
            </div>
          )}
          {group.commission !== undefined && (
            <div className="flex items-center">
              <Tag className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Commission: {group.commission}%</span>
            </div>
          )}
          {group.biddingType && (
            <div className="flex items-center">
              <SearchCode className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Bidding Type: {getBiddingTypeLabel(group.biddingType)}</span>
            </div>
          )}
          {group.minBid !== undefined && (
            <div className="flex items-center">
              <GroupLandmarkIcon className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Min Bid Amount: ₹{group.minBid.toLocaleString()}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <UserIcon className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl font-bold text-foreground">Group Members</CardTitle>
              <CardDescription>Details of users in this group.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {membersDetails.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No members have been added to this group yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Full Name</TableHead><TableHead>Username</TableHead><TableHead>Phone Number</TableHead><TableHead>Date of Birth</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {membersDetails.map((member) => (
                    <TableRow key={member.id}>{/* Compacted JSX below */}
                      <TableCell className="font-medium">{member.fullname}</TableCell><TableCell>{member.username}</TableCell><TableCell><div className="flex items-center"><Phone className="mr-2 h-3 w-3 text-muted-foreground" /> {member.phone || "N/A"}</div></TableCell><TableCell><div className="flex items-center"><CalendarDays className="mr-2 h-3 w-3 text-muted-foreground" /> {formatDateSafe(member.dob)}</div></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Separator />

      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Megaphone className="h-6 w-6 text-primary" />
            <CardTitle className="text-xl font-bold text-foreground">Group Auction Details</CardTitle>
          </div>
          <CardDescription>Information about auction events for this group.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center p-3 bg-secondary/50 rounded-md">
            <CalendarClock className="mr-3 h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-semibold text-foreground">Auction Month</p>
              <p className="text-muted-foreground">{format(new Date(), "MMMM yyyy")}</p> {/* Placeholder */}
            </div>
          </div>
          <div className="flex items-center p-3 bg-secondary/50 rounded-md">
            <CalendarDays className="mr-3 h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-semibold text-foreground">Next Scheduled Date</p>
              <p className="text-muted-foreground">15th {format(new Date(), "MMMM yyyy")}</p> {/* Placeholder */}
            </div>
          </div>
          <div className="flex items-center p-3 bg-secondary/50 rounded-md">
            <Clock className="mr-3 h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-semibold text-foreground">Next Scheduled Time</p>
              <p className="text-muted-foreground">02:00 PM IST</p> {/* Placeholder */}
            </div>
          </div>
          <div className="flex items-center p-3 bg-secondary/50 rounded-md">
            <Info className="mr-3 h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-semibold text-foreground">Last Auction Winner</p>
              <p className="text-muted-foreground">To be determined</p> {/* Placeholder */}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
