import { firebaseStorage } from "@/lib/firebase";
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";

function base64ToUint8Array(base64: string): Uint8Array {
  // Accept both raw base64 and data URLs
  const raw = base64.includes(",") ? base64.split(",").pop() ?? "" : base64;
  const binString = atob(raw);
  const bytes = new Uint8Array(binString.length);
  for (let i = 0; i < binString.length; i++) bytes[i] = binString.charCodeAt(i);
  return bytes;
}

export async function uploadCourseImage(params: {
  userId: string;
  courseId: string;
  /** base64 png, may include data: prefix */
  base64Png: string;
}) {
  const bytes = base64ToUint8Array(params.base64Png);
  const path = `images/${params.userId}/${params.courseId}/img`;
  const r = storageRef(firebaseStorage, path);
  await uploadBytes(r, bytes, { contentType: "image/png" });
  const url = await getDownloadURL(r);
  return { path, url };
}

export async function uploadPodcastAudio(params: {
  userId: string;
  courseId: string;
  moduleId: string | number;
  bytes: ArrayBuffer;
  mimeType: string;
}) {
  const path = `podcasts/${params.userId}/${params.courseId}/${params.moduleId}/podcast`;
  const r = storageRef(firebaseStorage, path);
  await uploadBytes(r, new Uint8Array(params.bytes), {
    contentType: params.mimeType,
  });
  const url = await getDownloadURL(r);
  return { path, url };
}
