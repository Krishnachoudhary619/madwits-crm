"use client";

import { Suspense } from "react";
import { JobDirectory } from "@/features/jobs/JobDirectory";
import { Spinner } from "@/components/ui";

function JobsBody() {
  return (
    <JobDirectory
      mode="jobs"
      title="Jobs & job cards"
      description="Search confirmed production jobs and the full lifecycle, including lost and cancelled records."
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
