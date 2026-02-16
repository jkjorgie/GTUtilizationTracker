"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createUser, updateUser, UserFormData } from "@/app/actions/users";

const formSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().optional(),
  role: z.nativeEnum(UserRole),
  consultantId: z.string().nullable(),
});

type FormData = z.infer<typeof formSchema>;

type UserForEdit = {
  id: string;
  email: string;
  role: UserRole;
  consultantId: string | null;
};

type ConsultantForLinking = {
  id: string;
  name: string;
  user: { id: string } | null;
};

interface UserFormProps {
  user?: UserForEdit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultants: ConsultantForLinking[];
}

export function UserForm({ user, open, onOpenChange, consultants }: UserFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      role: UserRole.EMPLOYEE,
      consultantId: null,
    },
  });

  // Reset form when user changes
  useEffect(() => {
    if (open) {
      form.reset({
        email: user?.email || "",
        password: "",
        role: user?.role || UserRole.EMPLOYEE,
        consultantId: user?.consultantId || null,
      });
      setError(null);
    }
  }, [user, open, form]);

  // Get available consultants (unlinked + currently linked one for editing)
  const availableConsultants = consultants.filter(
    (c) => !c.user || c.user.id === user?.id || c.id === user?.consultantId
  );

  const onSubmit = async (data: FormData) => {
    setError(null);
    setLoading(true);

    try {
      const submitData: UserFormData = {
        email: data.email,
        role: data.role,
        consultantId: data.consultantId,
      };

      // Only include password if it's provided
      if (data.password) {
        submitData.password = data.password;
      }

      if (user) {
        await updateUser(user.id, submitData);
      } else {
        if (!data.password) {
          throw new Error("Password is required for new users");
        }
        submitData.password = data.password;
        await createUser(submitData);
      }
      form.reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {user ? "Edit User" : "Create User"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md">
                {error}
              </div>
            )}

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="user@company.com" {...field} />
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
                  <FormLabel>{user ? "New Password (optional)" : "Password"}</FormLabel>
                  <FormControl>
                    <Input 
                      type="password" 
                      placeholder={user ? "Leave blank to keep current" : "Min 8 characters"} 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    {user 
                      ? "Leave blank to keep the current password" 
                      : "Password must be at least 8 characters"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={UserRole.ADMIN}>Administrator</SelectItem>
                      <SelectItem value={UserRole.MANAGER}>Manager</SelectItem>
                      <SelectItem value={UserRole.EMPLOYEE}>Employee</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Admins can manage all settings. Managers can approve PTO and mass load. Employees can view utilization and submit PTO.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="consultantId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link to Consultant</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(value === "none" ? null : value)} 
                    value={field.value || "none"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select consultant" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No linked consultant</SelectItem>
                      {availableConsultants.map((consultant) => (
                        <SelectItem key={consultant.id} value={consultant.id}>
                          {consultant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Link this user account to a consultant record for utilization tracking
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : user ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
