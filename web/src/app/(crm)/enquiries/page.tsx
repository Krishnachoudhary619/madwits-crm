"use client";

import { Suspense } from "react";
import { JobDirectory } from "@/features/jobs/JobDirectory";
import { Spinner } from "@/components/ui";

function EnquiriesBody() {
  return (
    <JobDirectory
      mode="enquiries"
      title="Enquiries & quotations"
      description="Open inquiries, prepared quotations, and jobs awaiting confirmation. Confirming updates the same job."
    />
  );
}

export default function EnquiriesPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <EnquiriesBody />
    </Suspense>
  );
}
