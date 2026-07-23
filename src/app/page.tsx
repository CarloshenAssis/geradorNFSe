import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/context";

export default async function HomePage() {
  const ctx = await getSessionContext();
  redirect(ctx ? "/dashboard" : "/login");
}
