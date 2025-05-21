
"use client";

import type { Group } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Users, Landmark } from "lucide-react";
import Image from "next/image"; // Import next/image

export interface UserGroupCardProps {
  group: Group;
}

export function UserGroupCard({ group }: UserGroupCardProps) {
  // Placeholder image, replace with actual group image logic if available
  const groupImageUrl = `https://placehold.co/600x400.png?text=${encodeURIComponent(group.groupName)}`;

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col">
      <div className="relative w-full h-40">
        <Image 
            src={groupImageUrl} 
            alt={`${group.groupName} group image`} 
            layout="fill" 
            objectFit="cover" 
            className="rounded-t-lg"
            data-ai-hint="group discussion"
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
  );
}
