"use client";

import { Suspense } from "react";
import { JobDirectory } from "@/features/jobs/JobDirectory";
import { Spinner } from "@/components/ui";

function JobsBody() {
  return (
    <JobDirectory
      mode="jobs"
      title="Jobs"
      description="Each row is a job card: who it is for, what to print, and which step it is on."
    />
  );
}

export default function JobsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <JobsBody />
    </Suspense>
  );
}
