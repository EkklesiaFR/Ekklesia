"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

import { firestore, useUser } from "@/firebase";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type NotificationItem = {
  id: string;
  title: string;
  body?: string;
  read: boolean;
  link?: string;
  type?: string;
  createdAt?: unknown;
  assemblyId?: string;
  voteId?: string;
};

export function NotificationBell() {
  const { user } = useUser();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const notificationsQuery = query(
      collection(firestore, "members", user.uid, "notifications"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const data: NotificationItem[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<NotificationItem, "id">),
        }));

        setNotifications(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading notifications:", error);
        setNotifications([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  const markAsRead = async (id: string) => {
    if (!user) return;

    try {
      await updateDoc(
        doc(firestore, "members", user.uid, "notifications", id),
        {
          read: true,
        }
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const batch = writeBatch(firestore);

      notifications.forEach((notification) => {
        if (!notification.read) {
          const notificationRef = doc(
            firestore,
            "members",
            user.uid,
            "notifications",
            notification.id
          );

          batch.update(notificationRef, { read: true });
        }
      });

      await batch.commit();
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />

          {unreadCount > 0 && (
            <Badge className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] leading-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Notifications</div>
            <div className="text-xs text-muted-foreground">
              Vos dernières mises à jour
            </div>
          </div>

          {notifications.some((notification) => !notification.read) && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="text-xs text-[#7DC092] transition-opacity hover:opacity-80"
            >
              Tout lire
            </button>
          )}
        </div>

        <div className="space-y-3 p-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">Chargement...</div>
          ) : notifications.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Aucune notification
            </div>
          ) : (
            notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => markAsRead(notification.id)}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition-colors",
                  notification.read ? "opacity-60" : "hover:bg-muted"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">
                      {notification.title}
                    </div>

                    {notification.body && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {notification.body}
                      </div>
                    )}
                  </div>

                  {!notification.read && (
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#7DC092]" />
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}