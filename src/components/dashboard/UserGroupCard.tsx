
"use client";

import type { Group } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Users, Landmark } from "lucide-react";

interface UserGroupCardProps {
  group: Group;
}

export function UserGroupCard({ group }: UserGroupCardProps) {
  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader>
        <CardTitle className="text-xl text-primary">{group.groupName}</CardTitle>
        <CardDescription className="h-12 overflow-hidden text-ellipsis">{group.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
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
