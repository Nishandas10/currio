"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Copy,
  Check,
  Mail,
  Twitter,
  Facebook,
  Linkedin,
  Instagram,
} from "lucide-react";
import Image from "next/image";

interface ShareCourseDialogProps {
  courseTitle: string;
  courseDescription: string;
  courseThumbnail?: string | null;
  courseSlug: string;
}

export function ShareCourseDialog({
  courseTitle,
  courseDescription,
  courseThumbnail,
  courseSlug,
}: ShareCourseDialogProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/course/${courseSlug}` : "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const shareLinks = [
    {
      name: "Email",
      icon: Mail,
      href: `mailto:?subject=Check out this course: ${courseTitle}&body=I found this interesting course on Currio: ${shareUrl}`,
    },
    {
      name: "WhatsApp",
      icon: () => (
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-message-circle"
        >
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        </svg>
      ),
      href: `https://wa.me/?text=${encodeURIComponent(
        `Check out this course: ${courseTitle} ${shareUrl}`
      )}`,
    },
    {
      name: "Twitter",
      icon: Twitter,
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        `Check out this course: ${courseTitle}`
      )}&url=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: "LinkedIn",
      icon: Linkedin,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
        shareUrl
      )}`,
    },
    {
      name: "Facebook",
      icon: Facebook,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
        shareUrl
      )}`,
    },
    {
      name: "Reddit",
      icon: () => (
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-reddit"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M17 13c0-1.7-1.3-3-3-3s-3 1.3-3 3c0 .3.1.5.2.7-2.4.4-4.2 2.3-4.2 4.8h14c0-2.5-1.8-4.4-4.2-4.8.1-.2.2-.4.2-.7Z" />
          <path d="M10 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
          <path d="M14 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
        </svg>
      ),
      href: `https://reddit.com/submit?url=${encodeURIComponent(
        shareUrl
      )}&title=${encodeURIComponent(courseTitle)}`,
    },
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="rounded-full border border-black/40 bg-white px-5 py-2 text-sm font-medium text-[#1A1A1A] hover:bg-black/5 transition-colors"
        >
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-medium">
            Share Course
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-6 py-4">
          <div className="flex gap-4">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-gray-100">
              {courseThumbnail ? (
                <Image
                  src={courseThumbnail}
                  alt={courseTitle}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl">
                  🎓
                </div>
              )}
            </div>
            <div className="flex flex-col justify-center gap-1">
              <h3 className="font-serif text-lg font-medium leading-tight">
                {courseTitle}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {courseDescription}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                readOnly
                value={shareUrl}
                className="pr-12 font-mono text-sm bg-gray-50"
              />
            </div>
            <Button
              size="icon"
              variant="outline"
              className="shrink-0"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {shareLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg border p-3 hover:bg-gray-50 transition-colors"
              >
                <link.icon className="h-5 w-5" />
                <span className="text-sm font-medium">{link.name}</span>
              </a>
            ))}
            <div className="flex items-center gap-3 rounded-lg border p-3 opacity-50 cursor-not-allowed">
              <Instagram className="h-5 w-5" />
              <span className="text-sm font-medium">Instagram</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
