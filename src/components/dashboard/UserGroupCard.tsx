
"use client";

import type { Group } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Users, Landmark } from "lucide-react";
import Image from "next/image"; // Import next/image
import Link from "next/link"; // Import Link

export interface UserGroupCardProps {
  group: Group;
}

const logoOptions: Array<{ value: Group['logoType']; label: string; src?: string }> = [
  { value: "gold", label: "Gold", src: "/gold.png" },
  { value: "silver", label: "Silver", src: "/silver.png" },
  { value: "diamond", label: "Diamond", src: "/diamond.png" },
  { value: "emerald", label: "Emerald", src: "/emerald.png" },
  { value: "ruby", label: "Ruby", src: "/ruby.png" },
];

export function UserGroupCard({ group }: UserGroupCardProps) {
  const selectedLogo = logoOptions.find(opt => opt.value === group.logoType);
  const groupImageUrl = selectedLogo?.src || `https://placehold.co/600x400.png?text=${encodeURIComponent(group.groupName)}`;
  const dataAiHint = selectedLogo?.value || "group discussion";


  return (
    <Link href={`/dashboard/groups/${group.id}`} className="block h-full">
      <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col h-full">
        <div className="relative w-full h-40">
          <Image 
              src={groupImageUrl} 
              alt={`${group.groupName} group image`} 
              layout="fill" 
              objectFit="cover" 
              className="rounded-t-lg"
              data-ai-hint={dataAiHint}
          />
        </div>
        <CardHeader className="pt-4">
          <CardTitle className="text-xl text-primary">{group.groupName}</CardTitle>
          <CardDescription className="h-12 overflow-hidden text-ellipsis">{group.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 flex-grow">
          <div className="flex items-center text-sm">
            <Users className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Total Members: {group.totalPeople} (Currently: {group.members.length})</span>
          </div>
          <div className="flex items-center text-sm">
            <Landmark className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Total Amount: ₹{group.totalAmount.toLocaleString()}</span>
          </div>
        </CardContent>
        <CardFooter>
           <p className="text-xs text-muted-foreground">Group ID: {group.id}</p>
        </CardFooter>
      </Card>
    </Link>
  );
}
