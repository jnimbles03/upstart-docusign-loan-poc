import { redirect } from "next/navigation";

// Landing page = the guided demo (Docusign App Center start).
export default function Home() {
  redirect("/demo");
}
