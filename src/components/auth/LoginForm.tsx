
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import Image from "next/image";

const formSchema = z.object({
  username: z.string().min(1, "Phone number is required"), // This is for phone
  password: z.string().min(1, "Password is required"),
});

export function LoginForm() {
  const { login, loading } = useAuth();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "", // For phone input
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    await login(values.username, values.password); // Pass username as phone
  }

  return (
    <Card className="shadow-xl">
      <CardHeader className="items-center text-center space-y-0 pb-4">
        <Image
          src="/sendhur_chits_logo_login.png"
          alt="Sendhur Chits Logo"
          width={300} 
          height={112} 
          priority 
          data-ai-hint="company logo"
          className="mb-4"
        />
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="e.g., 9876543210" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button 
              type="submit" 
              className="w-full bg-[#f5b200] hover:bg-[#f5b200]/90 text-neutral-900" 
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Login
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
