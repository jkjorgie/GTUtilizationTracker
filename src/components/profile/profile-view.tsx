"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserRole, Consultant, ConsultantGroup, ConsultantRole } from "@prisma/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { changePassword, ChangePasswordData } from "@/app/actions/profile";
import { Check, KeyRound } from "lucide-react";

type ConsultantWithRelations = Consultant & {
  groups: ConsultantGroup[];
  roles: ConsultantRole[];
};

interface ProfileViewProps {
  profile: {
    id: string;
    email: string;
    role: UserRole;
    consultant: ConsultantWithRelations | null;
  };
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export function ProfileView({ profile }: ProfileViewProps) {
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ChangePasswordData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: ChangePasswordData) => {
    setError(null);
    setPasswordSuccess(false);
    
    try {
      await changePassword(data);
      setPasswordSuccess(true);
      form.reset();
      setTimeout(() => {
        setIsChangingPassword(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    }
  };

  const roleLabels: Record<UserRole, string> = {
    ADMIN: "Administrator",
    MANAGER: "Manager",
    EMPLOYEE: "Employee",
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Email</label>
            <p className="text-sm mt-1">{profile.email}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Role</label>
            <div className="mt-1">
              <Badge variant="secondary">{roleLabels[profile.role]}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Linked Consultant */}
      <Card>
        <CardHeader>
          <CardTitle>Consultant Profile</CardTitle>
          <CardDescription>Your linked consultant record</CardDescription>
        </CardHeader>
        <CardContent>
          {profile.consultant ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Name</label>
                <p className="text-sm mt-1 font-medium">{profile.consultant.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Groups</label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {profile.consultant.groups.map((g) => (
                    <Badge key={g.id} variant="outline">{g.group}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Roles</label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {profile.consultant.roles.map((r) => (
                    <Badge key={r.id} variant="secondary">{r.level.replace("LVL", "Level ")}</Badge>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Standard Hours</label>
                  <p className="text-sm mt-1">{profile.consultant.standardHours} hrs/week</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">OT Available</label>
                  <p className="text-sm mt-1">{profile.consultant.overtimeHoursAvailable} hrs</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No consultant profile is linked to your account. Contact an administrator if this is incorrect.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Change Password
          </CardTitle>
          <CardDescription>Update your account password</CardDescription>
        </CardHeader>
        <CardContent>
          {!isChangingPassword ? (
            <Button variant="outline" onClick={() => setIsChangingPassword(true)}>
              Change Password
            </Button>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-md">
                {error && (
                  <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md">
                    {error}
                  </div>
                )}
                
                {passwordSuccess && (
                  <div className="p-3 text-sm text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400 rounded-md flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    Password changed successfully!
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2">
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Saving..." : "Save Password"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setIsChangingPassword(false);
                      setError(null);
                      form.reset();
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
