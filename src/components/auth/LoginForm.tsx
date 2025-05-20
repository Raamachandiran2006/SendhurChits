
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  username: z.string().min(1, "Username is required"), // This should be phone
  password: z.string().min(1, "Password is required"),
});

export function LoginForm() {
  const { login, loading } = useAuth();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "", // Will be used for phone input
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    await login(values.username, values.password); // Pass username as phone
  }

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle className="text-3xl font-bold text-center text-primary">ChitConnect Login</CardTitle>
        <CardDescription className="text-center">Enter your phone number and password to access your account.</CardDescription>
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
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Login
            </Button>
          </form>
        </Form>
      </CardContent>
      {/* Footer with signup link removed */}
    </Card>
  );
}
