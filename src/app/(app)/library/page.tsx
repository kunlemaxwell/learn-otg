import { redirect } from "next/navigation";

/** The library became "Chats" (courses have their own page). */
export default function LibraryPage() {
  redirect("/chats");
}
